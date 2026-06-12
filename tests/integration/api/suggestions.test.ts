import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import os from 'os';
import fs from 'fs';

// The vmThreads pool's VM context lacks some web globals that undici
// (a transitive dependency of the server import chain) expects.
import { ReadableStream, WritableStream, TransformStream } from 'node:stream/web';
globalThis.ReadableStream ??= ReadableStream as any;
globalThis.WritableStream ??= WritableStream as any;
globalThis.TransformStream ??= TransformStream as any;

// Isolate the database BEFORE importing any server modules.
// server/db.cjs reads DB_PATH at require time, so the dev database
// (data/sacred.db) is never touched. The require cache for server .cjs
// modules is shared across test files in a worker, so all API test files
// share one temp database (env-guarded) and isolate via beforeEach cleanup.
if (!process.env.SACRED_TEST_DB_DIR) {
  process.env.SACRED_TEST_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sacred-api-test-'));
}
process.env.DB_PATH = path.join(process.env.SACRED_TEST_DB_DIR, 'test.db');
delete process.env.ANTHROPIC_API_KEY; // keep enrichment a no-op

let app: express.Application;
let db: any;

const NOTE_ID = 'note-with-suggestions';
const TOPIC_ID = 'topic-grace';

describe('Note Suggestions API', () => {
  beforeAll(async () => {
    db = (await import('../../../server/db.cjs')).default;
    const notesRouter = (await import('../../../server/routes/notes.cjs')).default;

    app = express();
    app.use(express.json());
    app.use('/api/notes', notesRouter);
  });

  // Note: the db connection is intentionally never closed here — server/db.cjs
  // is a singleton shared across test files in the same worker.

  const insertSuggestion = (
    kind: string,
    payload: Record<string, unknown>,
    overrides: Partial<{ id: string; noteId: string; status: string; createdAt: string }> = {}
  ) => {
    const id = overrides.id || uuidv4();
    db.prepare(`
      INSERT INTO note_suggestions (id, note_id, kind, payload, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      overrides.noteId || NOTE_ID,
      kind,
      JSON.stringify(payload),
      overrides.status || 'pending',
      overrides.createdAt || new Date().toISOString()
    );
    return id;
  };

  beforeEach(() => {
    db.exec(`
      DELETE FROM note_suggestions;
      DELETE FROM note_tags;
      DELETE FROM notes;
      DELETE FROM topics;
    `);

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, created_at, updated_at)
      VALUES (?, 'ROM', 5, 1, 5, 11, 'Peace with God', '<p>Sermon on grace</p>', 'sermon', ?, ?)
    `).run(NOTE_ID, now, now);

    db.prepare(`
      INSERT INTO topics (id, name, parent_id, sort_order, created_at, updated_at)
      VALUES (?, 'Grace', NULL, 0, ?, ?)
    `).run(TOPIC_ID, now, now);
  });

  describe('GET /api/notes/:id/suggestions', () => {
    it('returns pending suggestions with payload fields spread into the object', async () => {
      const doctrineId = insertSuggestion('doctrine', {
        chapterNumber: 36,
        title: 'Justification',
        reason: 'The note discusses being declared righteous',
      });
      const topicId = insertSuggestion('topic', {
        topicId: TOPIC_ID,
        name: 'Grace',
        reason: 'Central theme of the sermon',
      });
      const illustrationId = insertSuggestion('illustration', {
        excerpt: 'Like a judge who pays the fine himself...',
        summary: 'Judge paying the fine',
      });

      const res = await request(app).get(`/api/notes/${NOTE_ID}/suggestions`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);

      const doctrine = res.body.find((s: any) => s.id === doctrineId);
      expect(doctrine).toMatchObject({
        kind: 'doctrine',
        chapterNumber: 36,
        title: 'Justification',
        reason: 'The note discusses being declared righteous',
      });
      expect(doctrine.createdAt).toBeDefined();

      const topic = res.body.find((s: any) => s.id === topicId);
      expect(topic).toMatchObject({
        kind: 'topic',
        topicId: TOPIC_ID,
        name: 'Grace',
        reason: 'Central theme of the sermon',
      });

      const illustration = res.body.find((s: any) => s.id === illustrationId);
      expect(illustration).toMatchObject({
        kind: 'illustration',
        excerpt: 'Like a judge who pays the fine himself...',
        summary: 'Judge paying the fine',
      });
    });

    it('returns an empty array when there are no suggestions', async () => {
      const res = await request(app).get(`/api/notes/${NOTE_ID}/suggestions`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('excludes accepted and dismissed suggestions', async () => {
      insertSuggestion('doctrine', { chapterNumber: 1, title: 'Intro', reason: 'r' }, { status: 'accepted' });
      insertSuggestion('topic', { topicId: TOPIC_ID, name: 'Grace', reason: 'r' }, { status: 'dismissed' });
      const pendingId = insertSuggestion('illustration', { excerpt: 'e', summary: 's' });

      const res = await request(app).get(`/api/notes/${NOTE_ID}/suggestions`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(pendingId);
    });

    it('only returns suggestions for the requested note', async () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, created_at, updated_at)
        VALUES ('other-note', 'JHN', 1, 1, 1, 18, 'Other', '<p>Other</p>', 'note', ?, ?)
      `).run(now, now);
      insertSuggestion('doctrine', { chapterNumber: 26, title: 'Christ', reason: 'r' }, { noteId: 'other-note' });

      const res = await request(app).get(`/api/notes/${NOTE_ID}/suggestions`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /api/notes/suggestions/:sid/accept', () => {
    it('accepts a topic suggestion and inserts the note_tags row', async () => {
      const sid = insertSuggestion('topic', {
        topicId: TOPIC_ID,
        name: 'Grace',
        reason: 'Central theme',
      });

      const res = await request(app).post(`/api/notes/suggestions/${sid}/accept`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        kind: 'topic',
        topicId: TOPIC_ID,
        name: 'Grace',
      });

      const tagRow = db
        .prepare('SELECT * FROM note_tags WHERE note_id = ? AND topic_id = ?')
        .get(NOTE_ID, TOPIC_ID);
      expect(tagRow).toBeDefined();

      const suggestionRow = db.prepare('SELECT status FROM note_suggestions WHERE id = ?').get(sid);
      expect(suggestionRow.status).toBe('accepted');
    });

    it('accepts a doctrine suggestion without touching note_tags', async () => {
      const sid = insertSuggestion('doctrine', {
        chapterNumber: 36,
        title: 'Justification',
        reason: 'Discusses imputed righteousness',
      });

      const res = await request(app).post(`/api/notes/suggestions/${sid}/accept`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, kind: 'doctrine', chapterNumber: 36 });

      const tagCount = db.prepare('SELECT COUNT(*) as count FROM note_tags').get();
      expect(tagCount.count).toBe(0);

      const suggestionRow = db.prepare('SELECT status FROM note_suggestions WHERE id = ?').get(sid);
      expect(suggestionRow.status).toBe('accepted');
    });

    it('removes the suggestion from the pending list after accepting', async () => {
      const sid = insertSuggestion('topic', { topicId: TOPIC_ID, name: 'Grace', reason: 'r' });

      await request(app).post(`/api/notes/suggestions/${sid}/accept`).expect(200);

      const res = await request(app).get(`/api/notes/${NOTE_ID}/suggestions`);
      expect(res.body).toEqual([]);
    });

    it('accepting a topic suggestion twice does not duplicate note_tags', async () => {
      const first = insertSuggestion('topic', { topicId: TOPIC_ID, name: 'Grace', reason: 'r' });
      const second = insertSuggestion('topic', { topicId: TOPIC_ID, name: 'Grace', reason: 'again' });

      await request(app).post(`/api/notes/suggestions/${first}/accept`).expect(200);
      await request(app).post(`/api/notes/suggestions/${second}/accept`).expect(200);

      const tagCount = db
        .prepare('SELECT COUNT(*) as count FROM note_tags WHERE note_id = ? AND topic_id = ?')
        .get(NOTE_ID, TOPIC_ID);
      expect(tagCount.count).toBe(1);
    });

    it('returns 404 for a missing suggestion', async () => {
      const res = await request(app).post('/api/notes/suggestions/nonexistent/accept');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Suggestion not found');
    });
  });

  describe('POST /api/notes/suggestions/:sid/dismiss', () => {
    it('dismisses a suggestion and removes it from the pending list', async () => {
      const sid = insertSuggestion('illustration', { excerpt: 'e', summary: 's' });

      const res = await request(app).post(`/api/notes/suggestions/${sid}/dismiss`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });

      const suggestionRow = db.prepare('SELECT status FROM note_suggestions WHERE id = ?').get(sid);
      expect(suggestionRow.status).toBe('dismissed');

      const listRes = await request(app).get(`/api/notes/${NOTE_ID}/suggestions`);
      expect(listRes.body).toEqual([]);
    });

    it('returns 404 for a missing suggestion', async () => {
      const res = await request(app).post('/api/notes/suggestions/nonexistent/dismiss');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Suggestion not found');
    });
  });
});
