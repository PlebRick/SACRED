/**
 * Systematic Theology API Routes
 *
 * Provides endpoints for accessing and managing systematic theology content.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db.cjs');

const router = express.Router();

// Convert database row to API format
const toApiFormat = (row) => ({
  id: row.id,
  entryType: row.entry_type,
  partNumber: row.part_number,
  chapterNumber: row.chapter_number,
  sectionLetter: row.section_letter,
  subsectionNumber: row.subsection_number,
  title: row.title,
  content: row.content,
  summary: row.summary,
  parentId: row.parent_id,
  sortOrder: row.sort_order,
  wordCount: row.word_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Convert scripture index row to API format
const toScriptureIndexFormat = (row) => ({
  id: row.id,
  systematicId: row.systematic_id,
  book: row.book,
  chapter: row.chapter,
  startVerse: row.start_verse,
  endVerse: row.end_verse,
  isPrimary: row.is_primary === 1,
  contextSnippet: row.context_snippet,
  createdAt: row.created_at
});

// Convert annotation row to API format
const toAnnotationFormat = (row) => ({
  id: row.id,
  systematicId: row.systematic_id,
  annotationType: row.annotation_type,
  color: row.color,
  content: row.content,
  textSelection: row.text_selection,
  positionStart: row.position_start,
  positionEnd: row.position_end,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Convert tag row to API format
const toTagFormat = (row) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  sortOrder: row.sort_order,
  createdAt: row.created_at
});

// Build tree structure from flat list
function buildTree(entries) {
  const map = new Map();
  const roots = [];

  // First pass: create map of all entries
  for (const entry of entries) {
    map.set(entry.id, { ...toApiFormat(entry), children: [] });
  }

  // Second pass: build tree
  for (const entry of entries) {
    const node = map.get(entry.id);
    if (entry.parent_id && map.has(entry.parent_id)) {
      map.get(entry.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by sortOrder
  function sortChildren(node) {
    node.children.sort((a, b) => a.sortOrder - b.sortOrder);
    node.children.forEach(sortChildren);
  }

  roots.sort((a, b) => a.sortOrder - b.sortOrder);
  roots.forEach(sortChildren);

  return roots;
}

// GET /api/systematic - List all entries as tree structure
router.get('/', (req, res) => {
  try {
    const entries = db.prepare(`
      SELECT * FROM systematic_theology
      ORDER BY sort_order
    `).all();

    const tree = buildTree(entries);
    res.json(tree);
  } catch (error) {
    console.error('Error fetching systematic theology:', error);
    res.status(500).json({ error: 'Failed to fetch systematic theology' });
  }
});

// GET /api/systematic/flat - List all entries as flat list
router.get('/flat', (req, res) => {
  try {
    const entries = db.prepare(`
      SELECT * FROM systematic_theology
      ORDER BY sort_order
    `).all();

    res.json(entries.map(toApiFormat));
  } catch (error) {
    console.error('Error fetching systematic theology:', error);
    res.status(500).json({ error: 'Failed to fetch systematic theology' });
  }
});

// GET /api/systematic/chapter/:num - Get chapter with all sections
router.get('/chapter/:num', (req, res) => {
  try {
    const chapterNum = parseInt(req.params.num, 10);

    // Get the chapter entry
    const chapter = db.prepare(`
      SELECT * FROM systematic_theology
      WHERE entry_type = 'chapter' AND chapter_number = ?
    `).get(chapterNum);

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    // Get all sections and subsections for this chapter
    const sections = db.prepare(`
      SELECT * FROM systematic_theology
      WHERE chapter_number = ? AND entry_type IN ('section', 'subsection')
      ORDER BY sort_order
    `).all(chapterNum);

    // Get scripture references for this chapter
    const scriptureRefs = db.prepare(`
      SELECT ssi.* FROM systematic_scripture_index ssi
      JOIN systematic_theology st ON ssi.systematic_id = st.id
      WHERE st.chapter_number = ?
      ORDER BY ssi.is_primary DESC, ssi.book, ssi.chapter, ssi.start_verse
    `).all(chapterNum);

    // Get related chapters
    const related = db.prepare(`
      SELECT sr.*, st.title as target_title
      FROM systematic_related sr
      JOIN systematic_theology st ON sr.target_chapter = st.chapter_number AND st.entry_type = 'chapter'
      WHERE sr.source_chapter = ?
    `).all(chapterNum);

    // Get tags for this chapter
    const tags = db.prepare(`
      SELECT t.* FROM systematic_tags t
      JOIN systematic_chapter_tags ct ON t.id = ct.tag_id
      WHERE ct.chapter_number = ?
    `).all(chapterNum);

    // Build response
    const response = {
      ...toApiFormat(chapter),
      sections: sections.map(toApiFormat),
      scriptureReferences: scriptureRefs.map(toScriptureIndexFormat),
      relatedChapters: related.map(r => ({
        chapterNumber: r.target_chapter,
        title: r.target_title,
        relationshipType: r.relationship_type
      })),
      tags: tags.map(toTagFormat)
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({ error: 'Failed to fetch chapter' });
  }
});

// GET /api/systematic/for-passage/:book/:chapter - Get doctrines for Bible passage
router.get('/for-passage/:book/:chapter', (req, res) => {
  try {
    const { book, chapter } = req.params;
    const chapterNum = parseInt(chapter, 10);

    // Find systematic theology entries that reference this passage
    const entries = db.prepare(`
      SELECT DISTINCT st.*, ssi.is_primary, ssi.context_snippet
      FROM systematic_theology st
      JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
      WHERE ssi.book = ? AND ssi.chapter = ?
      ORDER BY ssi.is_primary DESC, st.chapter_number, st.sort_order
    `).all(book, chapterNum);

    const result = entries.map(row => ({
      ...toApiFormat(row),
      isPrimary: row.is_primary === 1,
      contextSnippet: row.context_snippet
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching doctrines for passage:', error);
    res.status(500).json({ error: 'Failed to fetch doctrines for passage' });
  }
});

// GET /api/systematic/tags - List all tags
router.get('/tags', (req, res) => {
  try {
    const tags = db.prepare(`
      SELECT t.*, COUNT(ct.chapter_number) as chapter_count
      FROM systematic_tags t
      LEFT JOIN systematic_chapter_tags ct ON t.id = ct.tag_id
      GROUP BY t.id
      ORDER BY t.sort_order
    `).all();

    res.json(tags.map(t => ({
      ...toTagFormat(t),
      chapterCount: t.chapter_count
    })));
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// GET /api/systematic/by-tag/:tagId - Get chapters by tag
router.get('/by-tag/:tagId', (req, res) => {
  try {
    const { tagId } = req.params;

    const chapters = db.prepare(`
      SELECT st.* FROM systematic_theology st
      JOIN systematic_chapter_tags ct ON st.chapter_number = ct.chapter_number
      WHERE ct.tag_id = ? AND st.entry_type = 'chapter'
      ORDER BY st.chapter_number
    `).all(tagId);

    res.json(chapters.map(toApiFormat));
  } catch (error) {
    console.error('Error fetching chapters by tag:', error);
    res.status(500).json({ error: 'Failed to fetch chapters by tag' });
  }
});

// GET /api/systematic/search - Full-text search
router.get('/search', (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    // Search using FTS5
    const results = db.prepare(`
      SELECT st.*, snippet(systematic_theology_fts, 1, '<mark>', '</mark>', '...', 30) as snippet
      FROM systematic_theology st
      JOIN systematic_theology_fts fts ON st.rowid = fts.rowid
      WHERE systematic_theology_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(q.trim(), parseInt(limit, 10));

    res.json(results.map(row => ({
      ...toApiFormat(row),
      snippet: row.snippet
    })));
  } catch (error) {
    console.error('Error searching systematic theology:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// GET /api/systematic/summary - Get summary statistics
// NOTE: Must be before /:id to avoid being caught by catch-all
router.get('/summary', (req, res) => {
  try {
    const stats = {
      totalEntries: db.prepare('SELECT COUNT(*) as c FROM systematic_theology').get().c,
      parts: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'part'").get().c,
      chapters: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'chapter'").get().c,
      sections: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'section'").get().c,
      subsections: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'subsection'").get().c,
      scriptureReferences: db.prepare('SELECT COUNT(*) as c FROM systematic_scripture_index').get().c,
      annotations: db.prepare('SELECT COUNT(*) as c FROM systematic_annotations').get().c
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// DELETE /api/systematic/annotations/:id - Delete annotation
// NOTE: Must be before /:id to avoid "annotations" being matched as an id
router.delete('/annotations/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM systematic_annotations WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting annotation:', error);
    res.status(500).json({ error: 'Failed to delete annotation' });
  }
});

// GET /api/systematic/:id - Get single entry by ID
// NOTE: This catch-all must be LAST among GET routes
router.get('/:id', (req, res) => {
  try {
    const entry = db.prepare(`
      SELECT * FROM systematic_theology WHERE id = ?
    `).get(req.params.id);

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Get children
    const children = db.prepare(`
      SELECT * FROM systematic_theology
      WHERE parent_id = ?
      ORDER BY sort_order
    `).all(req.params.id);

    // Get scripture references
    const scriptureRefs = db.prepare(`
      SELECT * FROM systematic_scripture_index
      WHERE systematic_id = ?
      ORDER BY is_primary DESC, book, chapter, start_verse
    `).all(req.params.id);

    res.json({
      ...toApiFormat(entry),
      children: children.map(toApiFormat),
      scriptureReferences: scriptureRefs.map(toScriptureIndexFormat)
    });
  } catch (error) {
    console.error('Error fetching entry:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// POST /api/systematic/:id/annotations - Add annotation
router.post('/:id/annotations', (req, res) => {
  try {
    const { id } = req.params;
    const {
      annotationType,
      color,
      content,
      textSelection,
      positionStart,
      positionEnd
    } = req.body;

    // Verify systematic entry exists
    const entry = db.prepare('SELECT id FROM systematic_theology WHERE id = ?').get(id);
    if (!entry) {
      return res.status(404).json({ error: 'Systematic theology entry not found' });
    }

    if (!annotationType || !['highlight', 'note'].includes(annotationType)) {
      return res.status(400).json({ error: 'Invalid annotation type' });
    }

    const annotationId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO systematic_annotations (
        id, systematic_id, annotation_type, color, content, text_selection,
        position_start, position_end, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      annotationId, id, annotationType, color || null, content || null,
      textSelection || null, positionStart || null, positionEnd || null, now, now
    );

    const annotation = db.prepare('SELECT * FROM systematic_annotations WHERE id = ?').get(annotationId);
    res.status(201).json(toAnnotationFormat(annotation));
  } catch (error) {
    console.error('Error creating annotation:', error);
    res.status(500).json({ error: 'Failed to create annotation' });
  }
});

// GET /api/systematic/:id/annotations - Get annotations for entry
router.get('/:id/annotations', (req, res) => {
  try {
    const annotations = db.prepare(`
      SELECT * FROM systematic_annotations
      WHERE systematic_id = ?
      ORDER BY position_start, created_at
    `).all(req.params.id);

    res.json(annotations.map(toAnnotationFormat));
  } catch (error) {
    console.error('Error fetching annotations:', error);
    res.status(500).json({ error: 'Failed to fetch annotations' });
  }
});

// GET /api/systematic/:id/referencing-notes - Get notes that link to this entry
router.get('/:id/referencing-notes', (req, res) => {
  try {
    const { id } = req.params;

    // Get the entry to find its chapter number
    const entry = db.prepare('SELECT chapter_number, section_letter, subsection_number FROM systematic_theology WHERE id = ?').get(id);

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Build the link pattern to search for in notes
    // Links are in format: [[ST:Ch32]], [[ST:Ch32:A]], [[ST:Ch32:B.1]]
    let linkPattern;
    if (entry.subsection_number) {
      linkPattern = `[[ST:Ch${entry.chapter_number}:${entry.section_letter}.${entry.subsection_number}]]`;
    } else if (entry.section_letter) {
      linkPattern = `[[ST:Ch${entry.chapter_number}:${entry.section_letter}]]`;
    } else if (entry.chapter_number) {
      linkPattern = `[[ST:Ch${entry.chapter_number}]]`;
    } else {
      // Part level - search for any chapter in this part
      return res.json([]);
    }

    // Search notes for this link pattern
    const notes = db.prepare(`
      SELECT * FROM notes
      WHERE content LIKE ?
      ORDER BY updated_at DESC
    `).all(`%${linkPattern}%`);

    // Also search for partial matches if looking at chapter level
    // (to find notes that link to any section in this chapter)
    let additionalNotes = [];
    if (!entry.section_letter && entry.chapter_number) {
      additionalNotes = db.prepare(`
        SELECT * FROM notes
        WHERE content LIKE ? AND content NOT LIKE ?
        ORDER BY updated_at DESC
      `).all(`%[[ST:Ch${entry.chapter_number}:%`, `%${linkPattern}%`);
    }

    const allNotes = [...notes, ...additionalNotes];
    const uniqueNotes = allNotes.filter((note, index, self) =>
      index === self.findIndex(n => n.id === note.id)
    );

    res.json(uniqueNotes.map(n => ({
      id: n.id,
      book: n.book,
      startChapter: n.start_chapter,
      startVerse: n.start_verse,
      endChapter: n.end_chapter,
      endVerse: n.end_verse,
      title: n.title,
      type: n.type,
      updatedAt: n.updated_at
    })));
  } catch (error) {
    console.error('Error fetching referencing notes:', error);
    res.status(500).json({ error: 'Failed to fetch referencing notes' });
  }
});

module.exports = router;
