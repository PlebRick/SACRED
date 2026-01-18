import express from 'express';
import { MockDatabase, createMockDb, MockNote } from './mock-db';
import { v4 as uuidv4 } from 'uuid';

export interface TestNote {
  id: string;
  book: string;
  start_chapter: number;
  start_verse: number | null;
  end_chapter: number;
  end_verse: number | null;
  title: string;
  content: string;
  type: string;
  created_at: string;
  updated_at: string;
}

// Convert database row (snake_case) to API format (camelCase)
const toApiFormat = (row: MockNote) => ({
  id: row.id,
  book: row.book,
  startChapter: row.start_chapter,
  startVerse: row.start_verse,
  endChapter: row.end_chapter,
  endVerse: row.end_verse,
  title: row.title,
  content: row.content,
  type: row.type,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Create an Express app with an in-memory mock database for testing
 * Uses MockDatabase instead of better-sqlite3 to avoid native module issues in test workers
 */
export function createTestApp() {
  const app = express();
  const db = createMockDb();

  app.use(express.json());

  // Backup routes (must come first to handle /export, /import, /count before /:id)

  // GET /api/notes/export
  app.get('/api/notes/export', (req, res) => {
    try {
      const notes = db.prepare('SELECT * FROM notes ORDER BY created_at ASC').all() as MockNote[];
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        notes: notes.map(toApiFormat),
      };
      res.setHeader('Content-Type', 'application/json');
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to export notes' });
    }
  });

  // POST /api/notes/import
  app.post('/api/notes/import', (req, res) => {
    try {
      const { notes } = req.body;
      if (!notes || !Array.isArray(notes)) {
        return res.status(400).json({ error: 'Invalid import data: notes array required' });
      }

      const insertStmt = db.prepare(`
        INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateStmt = db.prepare(`
        UPDATE notes
        SET book = ?, start_chapter = ?, start_verse = ?, end_chapter = ?, end_verse = ?,
            title = ?, content = ?, type = ?, updated_at = ?
        WHERE id = ?
      `);

      const checkStmt = db.prepare('SELECT id FROM notes WHERE id = ?');

      let inserted = 0;
      let updated = 0;

      const importTransaction = db.transaction(() => {
        for (const note of notes) {
          const existing = checkStmt.get(note.id);
          if (existing) {
            updateStmt.run(
              note.book,
              note.startChapter,
              note.startVerse || null,
              note.endChapter,
              note.endVerse || null,
              note.title || '',
              note.content || '',
              note.type || 'note',
              note.updatedAt || new Date().toISOString(),
              note.id
            );
            updated++;
          } else {
            insertStmt.run(
              note.id || uuidv4(),
              note.book,
              note.startChapter,
              note.startVerse || null,
              note.endChapter,
              note.endVerse || null,
              note.title || '',
              note.content || '',
              note.type || 'note',
              note.createdAt || new Date().toISOString(),
              note.updatedAt || new Date().toISOString()
            );
            inserted++;
          }
        }
      });

      importTransaction();
      res.json({ success: true, inserted, updated });
    } catch (error) {
      res.status(500).json({ error: 'Failed to import notes' });
    }
  });

  // GET /api/notes/count
  app.get('/api/notes/count', (req, res) => {
    try {
      const result = db.prepare('SELECT COUNT(*) as count FROM notes').get() as { count: number };
      res.json({ count: result.count });
    } catch (error) {
      res.status(500).json({ error: 'Failed to count notes' });
    }
  });

  // GET /api/notes/lastModified
  app.get('/api/notes/lastModified', (req, res) => {
    try {
      const result = db.prepare('SELECT MAX(updated_at) as lastModified FROM notes').get() as { lastModified: string | null };
      res.json({ lastModified: result.lastModified || null });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get last modified' });
    }
  });

  // DELETE /api/notes (delete all)
  app.delete('/api/notes', (req, res) => {
    try {
      const result = db.prepare('DELETE FROM notes').run();
      res.json({ success: true, deleted: result.changes });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete notes' });
    }
  });

  // Notes CRUD routes

  // GET /api/notes
  app.get('/api/notes', (req, res) => {
    try {
      const notes = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all() as MockNote[];
      res.json(notes.map(toApiFormat));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch notes' });
    }
  });

  // GET /api/notes/chapter/:book/:chapter
  app.get('/api/notes/chapter/:book/:chapter', (req, res) => {
    try {
      const { book, chapter } = req.params;
      const chapterNum = parseInt(chapter, 10);
      const notes = db.prepare(`
        SELECT * FROM notes
        WHERE book = ?
          AND start_chapter <= ?
          AND end_chapter >= ?
        ORDER BY start_chapter, start_verse
      `).all(book, chapterNum, chapterNum) as MockNote[];
      res.json(notes.map(toApiFormat));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch notes' });
    }
  });

  // GET /api/notes/:id
  app.get('/api/notes/:id', (req, res) => {
    try {
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id) as MockNote | undefined;
      if (!note) {
        return res.status(404).json({ error: 'Note not found' });
      }
      res.json(toApiFormat(note));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch note' });
    }
  });

  // POST /api/notes
  app.post('/api/notes', (req, res) => {
    try {
      const { book, startChapter, startVerse, endChapter, endVerse, title = '', content = '', type = 'note' } = req.body;

      if (!book || startChapter === undefined || endChapter === undefined) {
        return res.status(400).json({ error: 'Missing required fields: book, startChapter, endChapter' });
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, book, startChapter, startVerse || null, endChapter, endVerse || null, title, content, type, now, now);

      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as MockNote;
      res.status(201).json(toApiFormat(note));
    } catch (error) {
      res.status(500).json({ error: 'Failed to create note' });
    }
  });

  // PUT /api/notes/:id
  app.put('/api/notes/:id', (req, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as MockNote | undefined;

      if (!existing) {
        return res.status(404).json({ error: 'Note not found' });
      }

      const {
        book = existing.book,
        startChapter = existing.start_chapter,
        startVerse = existing.start_verse,
        endChapter = existing.end_chapter,
        endVerse = existing.end_verse,
        title = existing.title,
        content = existing.content,
        type = existing.type,
      } = req.body;

      const now = new Date().toISOString();

      db.prepare(`
        UPDATE notes
        SET book = ?, start_chapter = ?, start_verse = ?, end_chapter = ?, end_verse = ?,
            title = ?, content = ?, type = ?, updated_at = ?
        WHERE id = ?
      `).run(book, startChapter, startVerse, endChapter, endVerse, title, content, type, now, id);

      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as MockNote;
      res.json(toApiFormat(note));
    } catch (error) {
      res.status(500).json({ error: 'Failed to update note' });
    }
  });

  // DELETE /api/notes/:id
  app.delete('/api/notes/:id', (req, res) => {
    try {
      const { id } = req.params;
      const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Note not found' });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete note' });
    }
  });

  return { app, db };
}

/**
 * Helper to create a sample note for tests
 */
export function createSampleNotePayload(overrides: Partial<{
  book: string;
  startChapter: number;
  startVerse: number | null;
  endChapter: number;
  endVerse: number | null;
  title: string;
  content: string;
  type: string;
}> = {}) {
  return {
    book: 'ROM',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 7,
    title: 'Test Note',
    content: '<p>Test content</p>',
    type: 'note',
    ...overrides,
  };
}
