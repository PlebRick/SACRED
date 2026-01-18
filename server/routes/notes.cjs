const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { JSDOM } = require('jsdom');
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
  primaryTopicId: row.primary_topic_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Get tags for a note
const getNoteTags = (noteId) => {
  return db.prepare(`
    SELECT t.* FROM topics t
    JOIN note_tags nt ON t.id = nt.topic_id
    WHERE nt.note_id = ?
  `).all(noteId).map(t => ({
    id: t.id,
    name: t.name,
    parentId: t.parent_id
  }));
};

// Add tags to note response
const toApiFormatWithTags = (row) => ({
  ...toApiFormat(row),
  tags: getNoteTags(row.id)
});

// Set tags for a note
const setNoteTags = (noteId, tagIds) => {
  // Delete existing tags
  db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId);

  // Insert new tags
  if (tagIds && tagIds.length > 0) {
    const insertStmt = db.prepare('INSERT INTO note_tags (note_id, topic_id) VALUES (?, ?)');
    for (const tagId of tagIds) {
      insertStmt.run(noteId, tagId);
    }
  }
};

// Sync inline tags from note content to inline_tags table
const syncInlineTags = (noteId, htmlContent) => {
  if (!htmlContent) {
    db.prepare('DELETE FROM inline_tags WHERE note_id = ?').run(noteId);
    return;
  }

  // Parse HTML to extract inline tags
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;
  const taggedSpans = document.querySelectorAll('span[data-inline-tag]');

  // Delete existing inline tags for this note
  db.prepare('DELETE FROM inline_tags WHERE note_id = ?').run(noteId);

  if (taggedSpans.length === 0) return;

  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO inline_tags (id, note_id, tag_type, text_content, html_fragment, position_start, position_end, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let position = 0;
  taggedSpans.forEach((span) => {
    const tagType = span.getAttribute('data-inline-tag');
    const textContent = span.textContent || '';
    const htmlFragment = span.outerHTML;
    const id = uuidv4();

    insertStmt.run(
      id,
      noteId,
      tagType,
      textContent,
      htmlFragment,
      position,
      position + textContent.length,
      now
    );

    position += textContent.length + 1;
  });
};

// GET /api/notes - Get all notes
router.get('/', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all();
    res.json(notes.map(toApiFormatWithTags));
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// GET /api/notes/by-book - Get notes grouped by book for sidebar
router.get('/by-book', (req, res) => {
  try {
    const notes = db.prepare(`
      SELECT * FROM notes
      ORDER BY book, start_chapter, start_verse
    `).all();

    // Group notes by book
    const byBook = {};
    for (const note of notes) {
      if (!byBook[note.book]) {
        byBook[note.book] = { chapters: {} };
      }
      // Place note in its starting chapter
      const chapter = note.start_chapter;
      if (!byBook[note.book].chapters[chapter]) {
        byBook[note.book].chapters[chapter] = [];
      }
      byBook[note.book].chapters[chapter].push(toApiFormat(note));
    }

    // Convert to array format with counts
    const result = Object.entries(byBook).map(([book, data]) => ({
      book,
      noteCount: Object.values(data.chapters).flat().length,
      chapters: Object.entries(data.chapters).map(([chapter, notes]) => ({
        chapter: parseInt(chapter),
        notes
      })).sort((a, b) => a.chapter - b.chapter)
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching notes by book:', error);
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

    res.json(notes.map(toApiFormatWithTags));
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

    res.json(toApiFormatWithTags(note));
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
      type = 'note',
      primaryTopicId = null,
      tags = []
    } = req.body;

    if (!book || startChapter === undefined || endChapter === undefined) {
      return res.status(400).json({ error: 'Missing required fields: book, startChapter, endChapter' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, primary_topic_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, book, startChapter, startVerse || null, endChapter, endVerse || null, title, content, type, primaryTopicId, now, now);

    // Set secondary tags
    if (tags.length > 0) {
      setNoteTags(id, tags);
    }

    // Sync inline tags from content
    syncInlineTags(id, content);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    res.status(201).json(toApiFormatWithTags(note));
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
      type = existing.type,
      primaryTopicId,
      tags
    } = req.body;

    // Use existing value if not explicitly provided
    const finalPrimaryTopicId = primaryTopicId === undefined ? existing.primary_topic_id : primaryTopicId;

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE notes
      SET book = ?, start_chapter = ?, start_verse = ?, end_chapter = ?, end_verse = ?,
          title = ?, content = ?, type = ?, primary_topic_id = ?, updated_at = ?
      WHERE id = ?
    `).run(book, startChapter, startVerse, endChapter, endVerse, title, content, type, finalPrimaryTopicId, now, id);

    // Update tags if provided
    if (tags !== undefined) {
      setNoteTags(id, tags);
    }

    // Sync inline tags from content
    syncInlineTags(id, content);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    res.json(toApiFormatWithTags(note));
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
module.exports.syncInlineTags = syncInlineTags;
