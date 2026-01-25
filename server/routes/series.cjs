const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db.cjs');

const router = express.Router();

// Convert database row (snake_case) to API format (camelCase)
const toApiFormat = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  sermonCount: row.sermon_count
});

// GET / - List all series with sermon counts
router.get('/', (req, res) => {
  try {
    const series = db.prepare(`
      SELECT s.*, COUNT(n.id) as sermon_count
      FROM series s
      LEFT JOIN notes n ON n.series_id = s.id AND n.type = 'sermon'
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `).all();

    res.json(series.map(toApiFormat));
  } catch (error) {
    console.error('Failed to list series:', error);
    res.status(500).json({ error: 'Failed to list series' });
  }
});

// GET /:id - Get series with its sermons
router.get('/:id', (req, res) => {
  try {
    const series = db.prepare('SELECT * FROM series WHERE id = ?').get(req.params.id);

    if (!series) {
      return res.status(404).json({ error: 'Series not found' });
    }

    // Get sermons in this series
    const sermons = db.prepare(`
      SELECT id, book, start_chapter, start_verse, end_chapter, end_verse,
             title, type, created_at, updated_at
      FROM notes
      WHERE series_id = ? AND type = 'sermon'
      ORDER BY created_at ASC
    `).all(req.params.id);

    res.json({
      ...toApiFormat(series),
      sermons: sermons.map(s => ({
        id: s.id,
        book: s.book,
        startChapter: s.start_chapter,
        startVerse: s.start_verse,
        endChapter: s.end_chapter,
        endVerse: s.end_verse,
        title: s.title,
        type: s.type,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }))
    });
  } catch (error) {
    console.error('Failed to get series:', error);
    res.status(500).json({ error: 'Failed to get series' });
  }
});

// POST / - Create series
router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO series (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name.trim(), description || null, now, now);

    const created = db.prepare('SELECT * FROM series WHERE id = ?').get(id);
    res.status(201).json(toApiFormat(created));
  } catch (error) {
    console.error('Failed to create series:', error);
    res.status(500).json({ error: 'Failed to create series' });
  }
});

// PUT /:id - Update series
router.put('/:id', (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const existing = db.prepare('SELECT * FROM series WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Series not found' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE series SET name = ?, description = ?, updated_at = ?
      WHERE id = ?
    `).run(name.trim(), description || null, now, req.params.id);

    const updated = db.prepare('SELECT * FROM series WHERE id = ?').get(req.params.id);
    res.json(toApiFormat(updated));
  } catch (error) {
    console.error('Failed to update series:', error);
    res.status(500).json({ error: 'Failed to update series' });
  }
});

// DELETE /:id - Delete series (sets sermons' series_id to NULL)
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM series WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Series not found' });
    }

    db.prepare('DELETE FROM series WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete series:', error);
    res.status(500).json({ error: 'Failed to delete series' });
  }
});

// POST /:id/sermons/:noteId - Add sermon to series
router.post('/:id/sermons/:noteId', (req, res) => {
  try {
    const { id, noteId } = req.params;

    const series = db.prepare('SELECT * FROM series WHERE id = ?').get(id);
    if (!series) {
      return res.status(404).json({ error: 'Series not found' });
    }

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (note.type !== 'sermon') {
      return res.status(400).json({ error: 'Only sermon-type notes can be added to series' });
    }

    const now = new Date().toISOString();

    db.prepare('UPDATE notes SET series_id = ?, updated_at = ? WHERE id = ?').run(id, now, noteId);
    db.prepare('UPDATE series SET updated_at = ? WHERE id = ?').run(now, id);

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to add sermon to series:', error);
    res.status(500).json({ error: 'Failed to add sermon to series' });
  }
});

// DELETE /:id/sermons/:noteId - Remove sermon from series
router.delete('/:id/sermons/:noteId', (req, res) => {
  try {
    const { id, noteId } = req.params;

    const note = db.prepare('SELECT * FROM notes WHERE id = ? AND series_id = ?').get(noteId, id);
    if (!note) {
      return res.status(404).json({ error: 'Sermon not found in this series' });
    }

    const now = new Date().toISOString();

    db.prepare('UPDATE notes SET series_id = NULL, updated_at = ? WHERE id = ?').run(now, noteId);
    db.prepare('UPDATE series SET updated_at = ? WHERE id = ?').run(now, id);

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to remove sermon from series:', error);
    res.status(500).json({ error: 'Failed to remove sermon from series' });
  }
});

module.exports = router;
