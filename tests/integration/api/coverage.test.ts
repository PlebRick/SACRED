import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
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
delete process.env.ANTHROPIC_API_KEY; // keep enrichment a no-op on note saves

let app: express.Application;
let db: any;

describe('Coverage API', () => {
  beforeAll(async () => {
    db = (await import('../../../server/db.cjs')).default;
    const notesRouter = (await import('../../../server/routes/notes.cjs')).default;
    const coverageRouter = (await import('../../../server/routes/coverage.cjs')).default;

    app = express();
    app.use(express.json());
    app.use('/api/notes', notesRouter);
    app.use('/api/coverage', coverageRouter);
  });

  // Note: the db connection is intentionally never closed here — server/db.cjs
  // is a singleton shared across test files in the same worker.

  beforeEach(() => {
    db.exec(`
      DELETE FROM inline_tags;
      DELETE FROM note_tags;
      DELETE FROM note_suggestions;
      DELETE FROM notes;
      DELETE FROM series;
      DELETE FROM topics;
      DELETE FROM systematic_theology;
    `);
  });

  const createNote = async (overrides: Record<string, unknown> = {}) => {
    const res = await request(app)
      .post('/api/notes')
      .send({
        book: 'ROM',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 7,
        title: 'Coverage Test Note',
        content: '<p>Test content</p>',
        type: 'note',
        ...overrides,
      });
    expect(res.status).toBe(201);
    return res.body;
  };

  describe('GET /api/coverage', () => {
    it('returns 200 with all top-level keys', async () => {
      const res = await request(app).get('/api/coverage');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('heatmap');
      expect(res.body).toHaveProperty('doctrines');
      expect(res.body).toHaveProperty('topics');
      expect(res.body).toHaveProperty('illustrations');
      expect(res.body).toHaveProperty('series');
      expect(res.body).toHaveProperty('activity');
      expect(res.body).toHaveProperty('totals');
    });

    it('returns empty structures when database is empty', async () => {
      const res = await request(app).get('/api/coverage');

      expect(res.status).toBe(200);
      expect(res.body.heatmap).toEqual({});
      expect(res.body.doctrines).toEqual([]);
      expect(res.body.series).toEqual([]);
      expect(res.body.activity).toEqual([]);
      expect(res.body.totals).toMatchObject({
        notes: 0,
        commentary: 0,
        sermons: 0,
        booksWithNotes: 0,
        doctrinesCovered: 0,
        doctrinesTotal: 0,
      });
      expect(res.body.illustrations).toMatchObject({
        total: 0,
        unique: 0,
        duplicates: [],
      });
    });

    it('heatmap reflects inserted notes by book, chapter, and type', async () => {
      await createNote({ book: 'ROM', startChapter: 1, endChapter: 1, type: 'note' });
      await createNote({ book: 'ROM', startChapter: 1, endChapter: 1, type: 'commentary' });
      await createNote({ book: 'JHN', startChapter: 3, endChapter: 3, type: 'sermon' });

      const res = await request(app).get('/api/coverage');

      expect(res.status).toBe(200);
      expect(res.body.heatmap.ROM['1']).toEqual({ note: 1, commentary: 1, sermon: 0 });
      expect(res.body.heatmap.JHN['3']).toEqual({ note: 0, commentary: 0, sermon: 1 });
    });

    it('expands a note spanning chapters 1-3 into all three heatmap chapters', async () => {
      await createNote({
        book: 'GEN',
        startChapter: 1,
        startVerse: 1,
        endChapter: 3,
        endVerse: 24,
        type: 'sermon',
      });

      const res = await request(app).get('/api/coverage');

      expect(res.status).toBe(200);
      expect(res.body.heatmap.GEN['1']).toEqual({ note: 0, commentary: 0, sermon: 1 });
      expect(res.body.heatmap.GEN['2']).toEqual({ note: 0, commentary: 0, sermon: 1 });
      expect(res.body.heatmap.GEN['3']).toEqual({ note: 0, commentary: 0, sermon: 1 });
    });

    it('totals.sermons counts sermon-type notes', async () => {
      await createNote({ type: 'sermon', book: 'ROM', startChapter: 8, endChapter: 8 });
      await createNote({ type: 'sermon', book: 'JHN', startChapter: 1, endChapter: 1 });
      await createNote({ type: 'note', book: 'ROM', startChapter: 1, endChapter: 1 });
      await createNote({ type: 'commentary', book: 'ROM', startChapter: 2, endChapter: 2 });

      const res = await request(app).get('/api/coverage');

      expect(res.status).toBe(200);
      expect(res.body.totals.sermons).toBe(2);
      expect(res.body.totals.notes).toBe(1);
      expect(res.body.totals.commentary).toBe(1);
      expect(res.body.totals.booksWithNotes).toBe(2);
    });

    it('counts doctrine coverage from [[ST:ChN]] links in note content', async () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO systematic_theology (id, entry_type, part_number, chapter_number, title, sort_order, created_at, updated_at)
        VALUES (?, 'chapter', 1, 1, 'Introduction to Systematic Theology', 1, ?, ?)
      `).run('st-ch-1', now, now);

      await createNote({
        type: 'sermon',
        content: '<p>See <a>[[ST:Ch1]]</a> for more.</p>',
      });

      const res = await request(app).get('/api/coverage');

      expect(res.status).toBe(200);
      expect(res.body.doctrines).toHaveLength(1);
      expect(res.body.doctrines[0]).toMatchObject({
        chapterNumber: 1,
        title: 'Introduction to Systematic Theology',
        partNumber: 1,
        noteCount: 1,
        sermonCount: 1,
      });
      expect(res.body.totals.doctrinesCovered).toBe(1);
      expect(res.body.totals.doctrinesTotal).toBe(1);
    });

    it('reports monthly activity for created notes', async () => {
      await createNote({ type: 'sermon' });
      await createNote({ type: 'note' });

      const res = await request(app).get('/api/coverage');

      expect(res.status).toBe(200);
      const currentMonth = new Date().toISOString().slice(0, 7);
      expect(res.body.activity).toHaveLength(1);
      expect(res.body.activity[0]).toEqual({
        month: currentMonth,
        total: 2,
        sermons: 1,
      });
    });
  });
});
