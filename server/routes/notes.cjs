const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const cheerio = require('cheerio');
const db = require('../db.cjs');
const { queueEnrichment } = require('../assistant/enrichment.cjs');

const router = express.Router();

// Extract [[ST:ChN]] doctrine link references from HTML content
function extractDoctrineLinks(html) {
  if (!html) return [];
  const refs = new Set();
  // Match data-ref attributes on systematic link spans
  const dataRefPattern = /data-ref="([^"]+)"/g;
  let m;
  while ((m = dataRefPattern.exec(html)) !== null) {
    refs.add(m[1]);
  }
  // Also match raw [[ST:ChN]] syntax in text
  const rawPattern = /\[\[ST:(Ch\d+(?::[A-Z](?:\.\d+)?)?)\]\]/g;
  while ((m = rawPattern.exec(html)) !== null) {
    refs.add(m[1]);
  }
  return [...refs].sort();
}

// Capture doctrine link snapshot on import (original links from insert_doctrine_links)
function captureDoctrineLinks(noteId, content) {
  const links = extractDoctrineLinks(content);
  if (links.length === 0) return;

  const existing = db.prepare('SELECT id FROM doctrine_link_edits WHERE note_id = ?').get(noteId);
  if (!existing) {
    db.prepare(`
      INSERT INTO doctrine_link_edits (id, note_id, original_links, captured_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), noteId, JSON.stringify(links), new Date().toISOString());
  }
}

// Track doctrine link edits (compare old content vs new content)
function trackDoctrineLinkEdits(noteId, oldContent, newContent) {
  const oldLinks = extractDoctrineLinks(oldContent);
  const newLinks = extractDoctrineLinks(newContent);

  // No change
  if (JSON.stringify(oldLinks) === JSON.stringify(newLinks)) return;

  const added = newLinks.filter(l => !oldLinks.includes(l));
  const removed = oldLinks.filter(l => !newLinks.includes(l));

  // No meaningful edit (both empty or no actual adds/removes)
  if (added.length === 0 && removed.length === 0) return;

  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id, original_links FROM doctrine_link_edits WHERE note_id = ?').get(noteId);

  if (existing) {
    db.prepare(`
      UPDATE doctrine_link_edits
      SET current_links = ?, links_added = ?, links_removed = ?, edited_at = ?
      WHERE note_id = ?
    `).run(JSON.stringify(newLinks), JSON.stringify(added), JSON.stringify(removed), now, noteId);
  } else {
    // No import snapshot exists — create one with old content as baseline
    db.prepare(`
      INSERT INTO doctrine_link_edits (id, note_id, original_links, current_links, links_added, links_removed, captured_at, edited_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), noteId, JSON.stringify(oldLinks), JSON.stringify(newLinks), JSON.stringify(added), JSON.stringify(removed), now, now);
  }
}

// Generate text signature for duplicate detection
const generateSignature = (text) => {
  if (!text || text.length < 20) return null;  // Skip short text
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);
};

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
  seriesId: row.series_id,
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

  // Parse HTML to extract inline tags using cheerio
  const $ = cheerio.load(htmlContent);
  const taggedSpans = $('span[data-inline-tag]');

  // Delete existing inline tags for this note
  db.prepare('DELETE FROM inline_tags WHERE note_id = ?').run(noteId);

  if (taggedSpans.length === 0) return;

  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO inline_tags (id, note_id, tag_type, text_content, html_fragment, position_start, position_end, text_signature, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let position = 0;
  taggedSpans.each((index, span) => {
    const $span = $(span);
    const tagType = $span.attr('data-inline-tag');
    const textContent = $span.text() || '';
    const htmlFragment = $.html($span);
    const id = uuidv4();
    const signature = generateSignature(textContent);

    insertStmt.run(
      id,
      noteId,
      tagType,
      textContent,
      htmlFragment,
      position,
      position + textContent.length,
      signature,
      now
    );

    position += textContent.length + 1;
  });
};

// GET /api/notes/search - Full-text search across notes
// Must be before GET /api/notes/:id to avoid "search" being treated as an id
router.get('/search', (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    // Search using FTS5 with snippets
    const results = db.prepare(`
      SELECT
        n.*,
        snippet(notes_fts, 0, '<mark>', '</mark>', '...', 10) as title_snippet,
        snippet(notes_fts, 1, '<mark>', '</mark>', '...', 30) as content_snippet
      FROM notes n
      JOIN notes_fts fts ON n.rowid = fts.rowid
      WHERE notes_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(q.trim(), parseInt(limit, 10));

    res.json(results.map(row => ({
      ...toApiFormat(row),
      titleSnippet: row.title_snippet,
      contentSnippet: row.content_snippet
    })));
  } catch (error) {
    console.error('Error searching notes:', error);
    res.status(500).json({ error: 'Failed to search notes' });
  }
});

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

    // Queue AI enrichment (no-op without API key)
    queueEnrichment(id, type);

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

    // Track doctrine link edits (compare old vs new content)
    trackDoctrineLinkEdits(id, existing.content, content);

    // Queue AI enrichment (no-op without API key)
    queueEnrichment(id, type);

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

// GET /api/notes/:id/suggestions - pending AI enrichment suggestions
router.get('/:id/suggestions', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, kind, payload, created_at
      FROM note_suggestions
      WHERE note_id = ? AND status = 'pending'
      ORDER BY kind, created_at
    `).all(req.params.id);
    res.json(rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      ...JSON.parse(r.payload),
      createdAt: r.created_at
    })));
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// POST /api/notes/suggestions/:sid/accept - accept a suggestion
router.post('/suggestions/:sid/accept', (req, res) => {
  try {
    const suggestion = db.prepare('SELECT * FROM note_suggestions WHERE id = ?').get(req.params.sid);
    if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

    const payload = JSON.parse(suggestion.payload);

    // Topic suggestions apply server-side; doctrine links are inserted by the
    // editor (client) so unsaved editor state isn't clobbered; illustration/
    // application suggestions are informational nudges.
    if (suggestion.kind === 'topic' && payload.topicId) {
      db.prepare(`
        INSERT OR IGNORE INTO note_tags (note_id, topic_id) VALUES (?, ?)
      `).run(suggestion.note_id, payload.topicId);
    }

    db.prepare("UPDATE note_suggestions SET status = 'accepted' WHERE id = ?").run(req.params.sid);
    res.json({ success: true, kind: suggestion.kind, ...payload });
  } catch (error) {
    console.error('Error accepting suggestion:', error);
    res.status(500).json({ error: 'Failed to accept suggestion' });
  }
});

// POST /api/notes/suggestions/:sid/dismiss
router.post('/suggestions/:sid/dismiss', (req, res) => {
  try {
    const result = db.prepare("UPDATE note_suggestions SET status = 'dismissed' WHERE id = ?").run(req.params.sid);
    if (result.changes === 0) return res.status(404).json({ error: 'Suggestion not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error dismissing suggestion:', error);
    res.status(500).json({ error: 'Failed to dismiss suggestion' });
  }
});

module.exports = router;
module.exports.syncInlineTags = syncInlineTags;
module.exports.captureDoctrineLinks = captureDoctrineLinks;
