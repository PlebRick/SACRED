const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db.cjs');

const router = express.Router();

// Convert database row (snake_case) to API format (camelCase)
const tagTypeToApiFormat = (row) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  icon: row.icon,
  isDefault: row.is_default === 1,
  sortOrder: row.sort_order,
  createdAt: row.created_at
});

const inlineTagToApiFormat = (row) => ({
  id: row.id,
  noteId: row.note_id,
  tagType: row.tag_type,
  textContent: row.text_content,
  htmlFragment: row.html_fragment,
  positionStart: row.position_start,
  positionEnd: row.position_end,
  createdAt: row.created_at,
  // Include note info if joined
  noteTitle: row.note_title,
  book: row.book,
  startChapter: row.start_chapter,
  startVerse: row.start_verse,
  endChapter: row.end_chapter,
  endVerse: row.end_verse
});

// ============== Tag Types CRUD ==============

// GET /api/inline-tags/types - Get all tag types
router.get('/types', (req, res) => {
  try {
    const types = db.prepare('SELECT * FROM inline_tag_types ORDER BY sort_order').all();
    res.json(types.map(tagTypeToApiFormat));
  } catch (error) {
    console.error('Error fetching inline tag types:', error);
    res.status(500).json({ error: 'Failed to fetch inline tag types' });
  }
});

// POST /api/inline-tags/types - Create custom tag type
router.post('/types', (req, res) => {
  try {
    const { name, color, icon } = req.body;

    if (!name || !color) {
      return res.status(400).json({ error: 'Missing required fields: name, color' });
    }

    // Get next sort order
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM inline_tag_types').get().max || 0;

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO inline_tag_types (id, name, color, icon, is_default, sort_order, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(id, name, color, icon || null, maxOrder + 1, now);

    const type = db.prepare('SELECT * FROM inline_tag_types WHERE id = ?').get(id);
    res.status(201).json(tagTypeToApiFormat(type));
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'A tag type with this name already exists' });
    }
    console.error('Error creating inline tag type:', error);
    res.status(500).json({ error: 'Failed to create inline tag type' });
  }
});

// PUT /api/inline-tags/types/:id - Update tag type
router.put('/types/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM inline_tag_types WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Tag type not found' });
    }

    const {
      name = existing.name,
      color = existing.color,
      icon = existing.icon,
      sortOrder = existing.sort_order
    } = req.body;

    db.prepare(`
      UPDATE inline_tag_types
      SET name = ?, color = ?, icon = ?, sort_order = ?
      WHERE id = ?
    `).run(name, color, icon, sortOrder, id);

    const type = db.prepare('SELECT * FROM inline_tag_types WHERE id = ?').get(id);
    res.json(tagTypeToApiFormat(type));
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'A tag type with this name already exists' });
    }
    console.error('Error updating inline tag type:', error);
    res.status(500).json({ error: 'Failed to update inline tag type' });
  }
});

// DELETE /api/inline-tags/types/:id - Delete tag type (only non-default)
router.delete('/types/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM inline_tag_types WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Tag type not found' });
    }

    if (existing.is_default === 1) {
      return res.status(400).json({ error: 'Cannot delete default tag types' });
    }

    db.prepare('DELETE FROM inline_tag_types WHERE id = ?').run(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting inline tag type:', error);
    res.status(500).json({ error: 'Failed to delete inline tag type' });
  }
});

// POST /api/inline-tags/types/seed - Re-seed default tag types
router.post('/types/seed', (req, res) => {
  try {
    const defaultTypes = [
      { id: 'illustration', name: 'Illustration', color: '#60a5fa', icon: '💡', sort_order: 0 },
      { id: 'application', name: 'Application', color: '#34d399', icon: '✅', sort_order: 1 },
      { id: 'keypoint', name: 'Key Point', color: '#fbbf24', icon: '⭐', sort_order: 2 },
      { id: 'quote', name: 'Quote', color: '#a78bfa', icon: '💬', sort_order: 3 },
      { id: 'crossref', name: 'Cross-Ref', color: '#f472b6', icon: '🔗', sort_order: 4 }
    ];

    const now = new Date().toISOString();
    const upsert = db.prepare(`
      INSERT INTO inline_tag_types (id, name, color, icon, is_default, sort_order, created_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        color = excluded.color,
        icon = excluded.icon,
        is_default = 1,
        sort_order = excluded.sort_order
    `);

    for (const type of defaultTypes) {
      upsert.run(type.id, type.name, type.color, type.icon, type.sort_order, now);
    }

    const types = db.prepare('SELECT * FROM inline_tag_types ORDER BY sort_order').all();
    res.json(types.map(tagTypeToApiFormat));
  } catch (error) {
    console.error('Error seeding inline tag types:', error);
    res.status(500).json({ error: 'Failed to seed inline tag types' });
  }
});

// ============== Tag Instances Browse/Search ==============

// GET /api/inline-tags - Get all inline tags with optional filters
router.get('/', (req, res) => {
  try {
    const { tagType, book, search, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
      FROM inline_tags it
      JOIN notes n ON it.note_id = n.id
      WHERE 1=1
    `;
    const params = [];

    if (tagType) {
      query += ' AND it.tag_type = ?';
      params.push(tagType);
    }

    if (book) {
      query += ' AND n.book = ?';
      params.push(book);
    }

    if (search) {
      query += ' AND it.text_content LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY n.book, n.start_chapter, n.start_verse LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const tags = db.prepare(query).all(...params);
    res.json(tags.map(inlineTagToApiFormat));
  } catch (error) {
    console.error('Error fetching inline tags:', error);
    res.status(500).json({ error: 'Failed to fetch inline tags' });
  }
});

// GET /api/inline-tags/by-type - Get counts grouped by tag type
router.get('/by-type', (req, res) => {
  try {
    const counts = db.prepare(`
      SELECT itt.*, COUNT(it.id) as count
      FROM inline_tag_types itt
      LEFT JOIN inline_tags it ON itt.id = it.tag_type
      GROUP BY itt.id
      ORDER BY itt.sort_order
    `).all();

    res.json(counts.map(row => ({
      ...tagTypeToApiFormat(row),
      count: row.count
    })));
  } catch (error) {
    console.error('Error fetching inline tag counts:', error);
    res.status(500).json({ error: 'Failed to fetch inline tag counts' });
  }
});

// GET /api/inline-tags/search - Search tagged content
router.get('/search', (req, res) => {
  try {
    const { q, limit = 50 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Missing query parameter: q' });
    }

    const tags = db.prepare(`
      SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
      FROM inline_tags it
      JOIN notes n ON it.note_id = n.id
      WHERE it.text_content LIKE ?
      ORDER BY n.book, n.start_chapter, n.start_verse
      LIMIT ?
    `).all(`%${q}%`, parseInt(limit));

    res.json(tags.map(inlineTagToApiFormat));
  } catch (error) {
    console.error('Error searching inline tags:', error);
    res.status(500).json({ error: 'Failed to search inline tags' });
  }
});

module.exports = router;
