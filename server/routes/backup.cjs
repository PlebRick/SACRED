const express = require('express');
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

// GET /api/notes/export - Export all notes as JSON
router.get('/export', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM notes ORDER BY created_at ASC').all();

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      notes: notes.map(toApiFormat)
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="sacred-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting notes:', error);
    res.status(500).json({ error: 'Failed to export notes' });
  }
});

// POST /api/notes/import - Import notes (upsert: update existing, insert new)
router.post('/import', (req, res) => {
  try {
    const { notes, version } = req.body;

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
    let errors = [];

    const importTransaction = db.transaction(() => {
      for (const note of notes) {
        try {
          const existing = checkStmt.get(note.id);

          if (existing) {
            // Update existing note
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
            // Insert new note
            insertStmt.run(
              note.id,
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
        } catch (noteError) {
          errors.push({ id: note.id, error: noteError.message });
        }
      }
    });

    importTransaction();

    res.json({
      success: true,
      inserted,
      updated,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error importing notes:', error);
    res.status(500).json({ error: 'Failed to import notes' });
  }
});

// DELETE /api/notes - Delete all notes
router.delete('/', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM notes').run();
    res.json({
      success: true,
      deleted: result.changes
    });
  } catch (error) {
    console.error('Error deleting all notes:', error);
    res.status(500).json({ error: 'Failed to delete notes' });
  }
});

// GET /api/notes/count - Get total note count (for delete confirmation)
router.get('/count', (req, res) => {
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM notes').get();
    res.json({ count: result.count });
  } catch (error) {
    console.error('Error counting notes:', error);
    res.status(500).json({ error: 'Failed to count notes' });
  }
});

// GET /api/notes/lastModified - Get timestamp of most recently modified note
router.get('/lastModified', (req, res) => {
  try {
    const result = db.prepare('SELECT MAX(updated_at) as lastModified FROM notes').get();
    res.json({ lastModified: result.lastModified || null });
  } catch (error) {
    console.error('Error getting last modified:', error);
    res.status(500).json({ error: 'Failed to get last modified' });
  }
});

module.exports = router;
