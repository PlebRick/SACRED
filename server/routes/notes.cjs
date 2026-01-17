const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db.cjs');

const router = express.Router();

// Convert database row (snake_case) to API format (camelCase)
const toApiFormat = (row) => ({
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
  updatedAt: row.updated_at
});

// GET /api/notes - Get all notes
router.get('/', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all();
    res.json(notes.map(toApiFormat));
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// GET /api/notes/chapter/:book/:chapter - Get notes for a chapter
router.get('/chapter/:book/:chapter', (req, res) => {
  try {
    const { book, chapter } = req.params;
    const chapterNum = parseInt(chapter, 10);

    const notes = db.prepare(`
      SELECT * FROM notes
      WHERE book = ?
        AND start_chapter <= ?
        AND end_chapter >= ?
      ORDER BY start_chapter, start_verse
    `).all(book, chapterNum, chapterNum);

    res.json(notes.map(toApiFormat));
  } catch (error) {
    console.error('Error fetching notes for chapter:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// GET /api/notes/:id - Get single note
router.get('/:id', (req, res) => {
  try {
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json(toApiFormat(note));
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// POST /api/notes - Create note
router.post('/', (req, res) => {
  try {
    const {
      book,
      startChapter,
      startVerse,
      endChapter,
      endVerse,
      title = '',
      content = '',
      type = 'note'
    } = req.body;

    if (!book || startChapter === undefined || endChapter === undefined) {
      return res.status(400).json({ error: 'Missing required fields: book, startChapter, endChapter' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, book, startChapter, startVerse || null, endChapter, endVerse || null, title, content, type, now, now);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    res.status(201).json(toApiFormat(note));
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// PUT /api/notes/:id - Update note
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);

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
      type = existing.type
    } = req.body;

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE notes
      SET book = ?, start_chapter = ?, start_verse = ?, end_chapter = ?, end_verse = ?,
          title = ?, content = ?, type = ?, updated_at = ?
      WHERE id = ?
    `).run(book, startChapter, startVerse, endChapter, endVerse, title, content, type, now, id);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    res.json(toApiFormat(note));
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/notes/:id - Delete note
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
