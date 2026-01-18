import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, createSampleNotePayload } from '../../setup/test-app';

describe('Notes CRUD API', () => {
  let app: ReturnType<typeof createTestApp>['app'];

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
  });

  describe('POST /api/notes', () => {
    it('creates a note with valid data (201)', async () => {
      const payload = createSampleNotePayload();

      const response = await request(app)
        .post('/api/notes')
        .send(payload)
        .expect(201);

      expect(response.body).toMatchObject({
        book: 'ROM',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 7,
        title: 'Test Note',
        content: '<p>Test content</p>',
        type: 'note',
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });

    it('creates a note with minimal required fields', async () => {
      const payload = {
        book: 'GEN',
        startChapter: 1,
        endChapter: 1,
      };

      const response = await request(app)
        .post('/api/notes')
        .send(payload)
        .expect(201);

      expect(response.body.book).toBe('GEN');
      expect(response.body.startChapter).toBe(1);
      expect(response.body.endChapter).toBe(1);
      expect(response.body.title).toBe('');
      expect(response.body.content).toBe('');
      expect(response.body.type).toBe('note');
    });

    it('creates a note with commentary type', async () => {
      const payload = createSampleNotePayload({ type: 'commentary' });

      const response = await request(app)
        .post('/api/notes')
        .send(payload)
        .expect(201);

      expect(response.body.type).toBe('commentary');
    });

    it('creates a note with sermon type', async () => {
      const payload = createSampleNotePayload({ type: 'sermon' });

      const response = await request(app)
        .post('/api/notes')
        .send(payload)
        .expect(201);

      expect(response.body.type).toBe('sermon');
    });

    it('returns 400 when book is missing', async () => {
      const payload = {
        startChapter: 1,
        endChapter: 1,
      };

      const response = await request(app)
        .post('/api/notes')
        .send(payload)
        .expect(400);

      expect(response.body.error).toContain('Missing required fields');
    });

    it('returns 400 when startChapter is missing', async () => {
      const payload = {
        book: 'ROM',
        endChapter: 1,
      };

      const response = await request(app)
        .post('/api/notes')
        .send(payload)
        .expect(400);

      expect(response.body.error).toContain('Missing required fields');
    });

    it('returns 400 when endChapter is missing', async () => {
      const payload = {
        book: 'ROM',
        startChapter: 1,
      };

      const response = await request(app)
        .post('/api/notes')
        .send(payload)
        .expect(400);

      expect(response.body.error).toContain('Missing required fields');
    });

    it('creates a chapter-level note (no verses)', async () => {
      const payload = {
        book: 'PSA',
        startChapter: 23,
        endChapter: 23,
        title: 'Psalm 23 Study',
      };

      const response = await request(app)
        .post('/api/notes')
        .send(payload)
        .expect(201);

      expect(response.body.startVerse).toBeNull();
      expect(response.body.endVerse).toBeNull();
    });

    it('creates a cross-chapter note', async () => {
      const payload = createSampleNotePayload({
        book: 'ISA',
        startChapter: 52,
        startVerse: 13,
        endChapter: 53,
        endVerse: 12,
        title: 'Suffering Servant',
      });

      const response = await request(app)
        .post('/api/notes')
        .send(payload)
        .expect(201);

      expect(response.body.startChapter).toBe(52);
      expect(response.body.endChapter).toBe(53);
    });
  });

  describe('GET /api/notes', () => {
    it('returns empty array when no notes exist', async () => {
      const response = await request(app)
        .get('/api/notes')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('returns all notes sorted by updated_at DESC', async () => {
      // Create multiple notes
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 1' }));
      await new Promise((r) => setTimeout(r, 10)); // Small delay for different timestamps
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 2' }));
      await new Promise((r) => setTimeout(r, 10));
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Note 3' }));

      const response = await request(app)
        .get('/api/notes')
        .expect(200);

      expect(response.body).toHaveLength(3);
      // Most recently updated first
      expect(response.body[0].title).toBe('Note 3');
      expect(response.body[1].title).toBe('Note 2');
      expect(response.body[2].title).toBe('Note 1');
    });

    it('returns notes with correct camelCase format', async () => {
      await request(app).post('/api/notes').send(createSampleNotePayload());

      const response = await request(app)
        .get('/api/notes')
        .expect(200);

      const note = response.body[0];
      expect(note).toHaveProperty('startChapter');
      expect(note).toHaveProperty('startVerse');
      expect(note).toHaveProperty('endChapter');
      expect(note).toHaveProperty('endVerse');
      expect(note).toHaveProperty('createdAt');
      expect(note).toHaveProperty('updatedAt');
      // Should NOT have snake_case
      expect(note).not.toHaveProperty('start_chapter');
      expect(note).not.toHaveProperty('created_at');
    });
  });

  describe('GET /api/notes/:id', () => {
    it('returns note when found (200)', async () => {
      const createResponse = await request(app)
        .post('/api/notes')
        .send(createSampleNotePayload());

      const noteId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/notes/${noteId}`)
        .expect(200);

      expect(response.body.id).toBe(noteId);
      expect(response.body.book).toBe('ROM');
    });

    it('returns 404 when note not found', async () => {
      const response = await request(app)
        .get('/api/notes/nonexistent-id')
        .expect(404);

      expect(response.body.error).toBe('Note not found');
    });

    it('returns 404 for random UUID', async () => {
      const response = await request(app)
        .get('/api/notes/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);

      expect(response.body.error).toBe('Note not found');
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('updates note with full data', async () => {
      const createResponse = await request(app)
        .post('/api/notes')
        .send(createSampleNotePayload());

      const noteId = createResponse.body.id;
      const originalCreatedAt = createResponse.body.createdAt;

      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));

      const updatePayload = {
        book: 'GEN',
        startChapter: 2,
        startVerse: 5,
        endChapter: 2,
        endVerse: 10,
        title: 'Updated Title',
        content: '<p>Updated content</p>',
        type: 'commentary',
      };

      const response = await request(app)
        .put(`/api/notes/${noteId}`)
        .send(updatePayload)
        .expect(200);

      expect(response.body.id).toBe(noteId);
      expect(response.body.book).toBe('GEN');
      expect(response.body.startChapter).toBe(2);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.type).toBe('commentary');
      // createdAt should be preserved, updatedAt should change
      expect(response.body.createdAt).toBe(originalCreatedAt);
      expect(response.body.updatedAt).not.toBe(createResponse.body.updatedAt);
    });

    it('updates note with partial data', async () => {
      const createResponse = await request(app)
        .post('/api/notes')
        .send(createSampleNotePayload());

      const noteId = createResponse.body.id;

      // Only update title
      const response = await request(app)
        .put(`/api/notes/${noteId}`)
        .send({ title: 'New Title Only' })
        .expect(200);

      expect(response.body.title).toBe('New Title Only');
      // Other fields should remain unchanged
      expect(response.body.book).toBe('ROM');
      expect(response.body.content).toBe('<p>Test content</p>');
    });

    it('returns 404 when note not found', async () => {
      const response = await request(app)
        .put('/api/notes/nonexistent-id')
        .send({ title: 'Updated' })
        .expect(404);

      expect(response.body.error).toBe('Note not found');
    });

    it('updates content only', async () => {
      const createResponse = await request(app)
        .post('/api/notes')
        .send(createSampleNotePayload());

      const noteId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/notes/${noteId}`)
        .send({ content: '<p>Brand new content</p>' })
        .expect(200);

      expect(response.body.content).toBe('<p>Brand new content</p>');
      expect(response.body.title).toBe('Test Note'); // Unchanged
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('deletes note successfully (204)', async () => {
      const createResponse = await request(app)
        .post('/api/notes')
        .send(createSampleNotePayload());

      const noteId = createResponse.body.id;

      await request(app)
        .delete(`/api/notes/${noteId}`)
        .expect(204);

      // Verify it's gone
      await request(app)
        .get(`/api/notes/${noteId}`)
        .expect(404);
    });

    it('returns 404 when note not found', async () => {
      const response = await request(app)
        .delete('/api/notes/nonexistent-id')
        .expect(404);

      expect(response.body.error).toBe('Note not found');
    });

    it('actually removes note from database', async () => {
      // Create 3 notes
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Keep 1' }));
      const toDelete = await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Delete Me' }));
      await request(app).post('/api/notes').send(createSampleNotePayload({ title: 'Keep 2' }));

      // Delete one
      await request(app).delete(`/api/notes/${toDelete.body.id}`).expect(204);

      // Verify only 2 remain
      const remaining = await request(app).get('/api/notes').expect(200);
      expect(remaining.body).toHaveLength(2);
      expect(remaining.body.some((n: { title: string }) => n.title === 'Delete Me')).toBe(false);
    });
  });
});
