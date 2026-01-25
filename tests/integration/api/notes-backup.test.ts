import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, createSampleNotePayload } from '../../setup/test-app';

describe('Notes Backup API', () => {
  let app: ReturnType<typeof createTestApp>['app'];

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
  });

  describe('GET /api/notes/export', () => {
    it('returns empty export when no notes exist', async () => {
      const response = await request(app)
        .get('/api/notes/export')
        .expect(200);

      // Mock DB returns version 1; production returns version 4
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('exportedAt');
      expect(response.body).toHaveProperty('notes');
      expect(response.body.notes).toEqual([]);
    });

    it('returns export with version, exportedAt, and notes array', async () => {
      await request(app).post('/api/notes').send(createSampleNotePayload());

      const response = await request(app)
        .get('/api/notes/export')
        .expect(200);

      expect(response.body.version).toBeDefined();
      expect(response.body.exportedAt).toBeDefined();
      expect(new Date(response.body.exportedAt).getTime()).not.toBeNaN();
      expect(response.body.notes).toHaveLength(1);
    });

    it('exports all notes sorted by created_at ASC', async () => {
      // Create notes with different timestamps
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'First' }));
      await new Promise((r) => setTimeout(r, 10));
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Second' }));
      await new Promise((r) => setTimeout(r, 10));
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Third' }));

      const response = await request(app)
        .get('/api/notes/export')
        .expect(200);

      expect(response.body.notes).toHaveLength(3);
      // Oldest first (ASC order for export)
      expect(response.body.notes[0].title).toBe('First');
      expect(response.body.notes[1].title).toBe('Second');
      expect(response.body.notes[2].title).toBe('Third');
    });

    it('exports notes in camelCase format', async () => {
      await request(app).post('/api/notes').send(createSampleNotePayload());

      const response = await request(app)
        .get('/api/notes/export')
        .expect(200);

      const note = response.body.notes[0];
      expect(note).toHaveProperty('startChapter');
      expect(note).toHaveProperty('endChapter');
      expect(note).toHaveProperty('createdAt');
      expect(note).toHaveProperty('updatedAt');
    });

    it('returns Content-Type application/json', async () => {
      const response = await request(app)
        .get('/api/notes/export')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('POST /api/notes/import', () => {
    it('imports new notes successfully', async () => {
      const importData = {
        notes: [
          {
            id: 'import-note-1',
            book: 'ROM',
            startChapter: 1,
            startVerse: 1,
            endChapter: 1,
            endVerse: 7,
            title: 'Imported Note 1',
            content: '<p>Imported content</p>',
            type: 'note',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'import-note-2',
            book: 'GEN',
            startChapter: 1,
            startVerse: 1,
            endChapter: 1,
            endVerse: 31,
            title: 'Imported Note 2',
            content: '<p>Genesis notes</p>',
            type: 'commentary',
            createdAt: '2024-01-02T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/notes/import')
        .send(importData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.inserted).toBe(2);
      expect(response.body.updated).toBe(0);

      // Verify notes were imported
      const allNotes = await request(app).get('/api/notes').expect(200);
      expect(allNotes.body).toHaveLength(2);
    });

    it('updates existing notes on import (upsert)', async () => {
      // First create a note
      const createResponse = await request(app)
        .post('/api/notes')
        .send(createSampleNotePayload({ title: 'Original Title' }));

      const noteId = createResponse.body.id;

      // Import with same ID but different data
      const importData = {
        notes: [
          {
            id: noteId,
            book: 'ROM',
            startChapter: 1,
            startVerse: 1,
            endChapter: 1,
            endVerse: 7,
            title: 'Updated via Import',
            content: '<p>Updated content</p>',
            type: 'note',
          },
        ],
      };

      const response = await request(app)
        .post('/api/notes/import')
        .send(importData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.inserted).toBe(0);
      expect(response.body.updated).toBe(1);

      // Verify the note was updated
      const getResponse = await request(app).get(`/api/notes/${noteId}`).expect(200);
      expect(getResponse.body.title).toBe('Updated via Import');
    });

    it('preserves timestamps on update', async () => {
      const createResponse = await request(app)
        .post('/api/notes')
        .send(createSampleNotePayload());

      const noteId = createResponse.body.id;
      const customUpdatedAt = '2025-06-15T12:00:00.000Z';

      const importData = {
        notes: [
          {
            id: noteId,
            book: 'ROM',
            startChapter: 1,
            endChapter: 1,
            title: 'Updated',
            updatedAt: customUpdatedAt,
          },
        ],
      };

      await request(app)
        .post('/api/notes/import')
        .send(importData)
        .expect(200);

      const getResponse = await request(app).get(`/api/notes/${noteId}`).expect(200);
      expect(getResponse.body.updatedAt).toBe(customUpdatedAt);
    });

    it('handles mixed insert and update', async () => {
      // Create an existing note
      const createResponse = await request(app)
        .post('/api/notes')
        .send(createSampleNotePayload({ title: 'Existing Note' }));

      const existingId = createResponse.body.id;

      // Import with one existing and one new
      const importData = {
        notes: [
          {
            id: existingId,
            book: 'ROM',
            startChapter: 1,
            endChapter: 1,
            title: 'Updated Existing',
          },
          {
            id: 'brand-new-note',
            book: 'GEN',
            startChapter: 1,
            endChapter: 1,
            title: 'New Note',
          },
        ],
      };

      const response = await request(app)
        .post('/api/notes/import')
        .send(importData)
        .expect(200);

      expect(response.body.inserted).toBe(1);
      expect(response.body.updated).toBe(1);
    });

    it('returns 400 for invalid import data', async () => {
      const response = await request(app)
        .post('/api/notes/import')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body.error).toContain('notes array required');
    });

    it('returns 400 when notes is not an array', async () => {
      const response = await request(app)
        .post('/api/notes/import')
        .send({ notes: 'not-an-array' })
        .expect(400);

      expect(response.body.error).toContain('notes array required');
    });

    it('generates IDs for notes without them', async () => {
      const importData = {
        notes: [
          {
            book: 'JHN',
            startChapter: 3,
            startVerse: 16,
            endChapter: 3,
            endVerse: 16,
            title: 'John 3:16 Note',
          },
        ],
      };

      const response = await request(app)
        .post('/api/notes/import')
        .send(importData)
        .expect(200);

      expect(response.body.inserted).toBe(1);

      const allNotes = await request(app).get('/api/notes').expect(200);
      expect(allNotes.body[0].id).toBeDefined();
      expect(allNotes.body[0].id).not.toBe('');
    });
  });

  describe('DELETE /api/notes', () => {
    it('deletes all notes and returns count', async () => {
      // Create some notes
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 1' }));
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 2' }));
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 3' }));

      const response = await request(app)
        .delete('/api/notes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(3);

      // Verify all notes are gone
      const remaining = await request(app).get('/api/notes').expect(200);
      expect(remaining.body).toHaveLength(0);
    });

    it('returns 0 when no notes to delete', async () => {
      const response = await request(app)
        .delete('/api/notes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(0);
    });
  });

  describe('GET /api/notes/count', () => {
    it('returns count of 0 when no notes exist', async () => {
      const response = await request(app)
        .get('/api/notes/count')
        .expect(200);

      expect(response.body).toEqual({ count: 0 });
    });

    it('returns correct count', async () => {
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 1' }));
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 2' }));
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 3' }));

      const response = await request(app)
        .get('/api/notes/count')
        .expect(200);

      expect(response.body.count).toBe(3);
    });

    it('updates count after deletion', async () => {
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 1' }));
      const note2 = await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 2' }));

      await request(app).delete(`/api/notes/${note2.body.id}`);

      const response = await request(app)
        .get('/api/notes/count')
        .expect(200);

      expect(response.body.count).toBe(1);
    });
  });

  describe('GET /api/notes/lastModified', () => {
    it('returns null when no notes exist', async () => {
      const response = await request(app)
        .get('/api/notes/lastModified')
        .expect(200);

      expect(response.body).toEqual({ lastModified: null });
    });

    it('returns max updated_at timestamp', async () => {
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 1' }));
      await new Promise((r) => setTimeout(r, 50));
      const lastNote = await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 2' }));

      const response = await request(app)
        .get('/api/notes/lastModified')
        .expect(200);

      expect(response.body.lastModified).toBe(lastNote.body.updatedAt);
    });

    it('updates when a note is modified', async () => {
      const note = await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 1' }));

      await new Promise((r) => setTimeout(r, 50));

      await request(app).put(`/api/notes/${note.body.id}`).send({ title: 'Updated' });

      const response = await request(app)
        .get('/api/notes/lastModified')
        .expect(200);

      // Should be later than original updatedAt
      const originalTime = new Date(note.body.updatedAt).getTime();
      const lastModifiedTime = new Date(response.body.lastModified).getTime();
      expect(lastModifiedTime).toBeGreaterThan(originalTime);
    });
  });

  describe('Full backup/restore workflow', () => {
    it('can export and re-import data successfully', async () => {
      // Create some notes
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 1', book: 'ROM' }));
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 2', book: 'GEN' }));

      // Export
      const exportResponse = await request(app).get('/api/notes/export').expect(200);
      const exportedData = exportResponse.body;

      // Delete all
      await request(app).delete('/api/notes').expect(200);

      // Verify empty
      const emptyResponse = await request(app).get('/api/notes').expect(200);
      expect(emptyResponse.body).toHaveLength(0);

      // Re-import
      await request(app)
        .post('/api/notes/import')
        .send({ notes: exportedData.notes })
        .expect(200);

      // Verify restored
      const restoredResponse = await request(app).get('/api/notes').expect(200);
      expect(restoredResponse.body).toHaveLength(2);
    });
  });

  // Note: Series, Topics, and Systematic Annotations backup tests require
  // the full production database. These features are tested through manual
  // testing and the actual server implementation.
  //
  // The mock database in tests/setup/mock-db.ts provides a lightweight
  // in-memory implementation for basic CRUD testing.
});
