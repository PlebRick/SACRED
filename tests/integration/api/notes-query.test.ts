import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, createSampleNotePayload } from '../../setup/test-app';

describe('Notes Query API', () => {
  let app: ReturnType<typeof createTestApp>['app'];

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
  });

  describe('GET /api/notes/chapter/:book/:chapter', () => {
    it('returns notes fully within the chapter', async () => {
      // Create a note for Romans 1:1-7
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'ROM',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 7,
        title: 'Romans 1 Note',
      }));

      const response = await request(app)
        .get('/api/notes/chapter/ROM/1')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Romans 1 Note');
    });

    it('returns notes spanning multiple chapters that include this chapter', async () => {
      // Create a cross-chapter note (Genesis 1:1-2:3)
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'GEN',
        startChapter: 1,
        startVerse: 1,
        endChapter: 2,
        endVerse: 3,
        title: 'Creation Account',
      }));

      // Should be included in chapter 1
      const chapter1 = await request(app)
        .get('/api/notes/chapter/GEN/1')
        .expect(200);
      expect(chapter1.body).toHaveLength(1);
      expect(chapter1.body[0].title).toBe('Creation Account');

      // Should also be included in chapter 2
      const chapter2 = await request(app)
        .get('/api/notes/chapter/GEN/2')
        .expect(200);
      expect(chapter2.body).toHaveLength(1);
      expect(chapter2.body[0].title).toBe('Creation Account');
    });

    it('returns empty array when no notes for chapter', async () => {
      // Create a note for Romans 1
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'ROM',
        startChapter: 1,
        endChapter: 1,
        title: 'Romans 1 Note',
      }));

      // Query for Romans 2 (no notes)
      const response = await request(app)
        .get('/api/notes/chapter/ROM/2')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('returns empty array for book with no notes', async () => {
      // Create a note for Romans
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'ROM',
        startChapter: 1,
        endChapter: 1,
        title: 'Romans Note',
      }));

      // Query for Genesis (different book)
      const response = await request(app)
        .get('/api/notes/chapter/GEN/1')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('sorts notes by start_chapter, start_verse', async () => {
      // Create notes out of order
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'ROM',
        startChapter: 1,
        startVerse: 16,
        endChapter: 1,
        endVerse: 17,
        title: 'Later Note',
      }));
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'ROM',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 7,
        title: 'Earlier Note',
      }));
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'ROM',
        startChapter: 1,
        startVerse: 8,
        endChapter: 1,
        endVerse: 15,
        title: 'Middle Note',
      }));

      const response = await request(app)
        .get('/api/notes/chapter/ROM/1')
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0].title).toBe('Earlier Note');
      expect(response.body[1].title).toBe('Middle Note');
      expect(response.body[2].title).toBe('Later Note');
    });

    it('handles chapter-level notes (no verses)', async () => {
      await request(app).post('/api/notes').send({
        book: 'PSA',
        startChapter: 23,
        endChapter: 23,
        title: 'Psalm 23 Study',
      });

      const response = await request(app)
        .get('/api/notes/chapter/PSA/23')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Psalm 23 Study');
      expect(response.body[0].startVerse).toBeNull();
    });

    it('returns multiple notes for same chapter', async () => {
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'JHN',
        startChapter: 3,
        startVerse: 1,
        endChapter: 3,
        endVerse: 15,
        title: 'Nicodemus',
      }));
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'JHN',
        startChapter: 3,
        startVerse: 16,
        endChapter: 3,
        endVerse: 16,
        title: 'John 3:16',
      }));
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'JHN',
        startChapter: 3,
        startVerse: 17,
        endChapter: 3,
        endVerse: 21,
        title: 'Light and Darkness',
      }));

      const response = await request(app)
        .get('/api/notes/chapter/JHN/3')
        .expect(200);

      expect(response.body).toHaveLength(3);
    });

    it('does not return notes from adjacent chapters', async () => {
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'ROM',
        startChapter: 1,
        endChapter: 1,
        title: 'Romans 1',
      }));
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'ROM',
        startChapter: 2,
        endChapter: 2,
        title: 'Romans 2',
      }));
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'ROM',
        startChapter: 3,
        endChapter: 3,
        title: 'Romans 3',
      }));

      const response = await request(app)
        .get('/api/notes/chapter/ROM/2')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Romans 2');
    });

    it('handles wide-spanning notes correctly', async () => {
      // Create a note that spans chapters 5-10
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'ROM',
        startChapter: 5,
        startVerse: 1,
        endChapter: 10,
        endVerse: 21,
        title: 'Wide Span',
      }));

      // Should appear in chapter 5
      const ch5 = await request(app).get('/api/notes/chapter/ROM/5').expect(200);
      expect(ch5.body).toHaveLength(1);

      // Should appear in chapter 7 (middle)
      const ch7 = await request(app).get('/api/notes/chapter/ROM/7').expect(200);
      expect(ch7.body).toHaveLength(1);

      // Should appear in chapter 10
      const ch10 = await request(app).get('/api/notes/chapter/ROM/10').expect(200);
      expect(ch10.body).toHaveLength(1);

      // Should NOT appear in chapter 4 (before)
      const ch4 = await request(app).get('/api/notes/chapter/ROM/4').expect(200);
      expect(ch4.body).toHaveLength(0);

      // Should NOT appear in chapter 11 (after)
      const ch11 = await request(app).get('/api/notes/chapter/ROM/11').expect(200);
      expect(ch11.body).toHaveLength(0);
    });

    it('returns notes in camelCase format', async () => {
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'ROM',
        startChapter: 1,
        endChapter: 1,
      }));

      const response = await request(app)
        .get('/api/notes/chapter/ROM/1')
        .expect(200);

      const note = response.body[0];
      expect(note).toHaveProperty('startChapter');
      expect(note).toHaveProperty('endChapter');
      expect(note).toHaveProperty('createdAt');
      expect(note).not.toHaveProperty('start_chapter');
    });

    it('handles numbered chapters as strings', async () => {
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'PSA',
        startChapter: 119,
        endChapter: 119,
        title: 'Psalm 119',
      }));

      const response = await request(app)
        .get('/api/notes/chapter/PSA/119')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].startChapter).toBe(119);
    });

    it('handles single-chapter books', async () => {
      await request(app).post('/api/notes').send(createSampleNotePayload({
        book: 'OBA',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 21,
        title: 'Obadiah Study',
      }));

      const response = await request(app)
        .get('/api/notes/chapter/OBA/1')
        .expect(200);

      expect(response.body).toHaveLength(1);
    });
  });
});
