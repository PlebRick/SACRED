'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cheerio = require('cheerio');
const db = require('../db.cjs');
const { analyzeDoctrineLinks, loadRules } = require('../lib/doctrine-matching-engine.cjs');

const router = express.Router();

// Convert db row to API format
const toApiFormat = (row) => ({
  id: row.id,
  noteId: row.note_id,
  chapterNumber: row.chapter_number,
  sectionLetter: row.section_letter,
  subsectionNumber: row.subsection_number,
  linkSyntax: row.link_syntax,
  title: row.title,
  summary: row.summary,
  confidence: row.confidence,
  signals: row.signals ? JSON.parse(row.signals) : [],
  status: row.status,
  createdAt: row.created_at,
  reviewedAt: row.reviewed_at,
});

// POST /api/doctrine-matching/analyze/:noteId - Run engine, store suggestions
router.post('/analyze/:noteId', (req, res) => {
  try {
    const { noteId } = req.params;

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const rules = loadRules();
    const now = new Date().toISOString();

    // Clear existing pending suggestions for this note (re-analysis)
    db.prepare("DELETE FROM doctrine_suggestions WHERE note_id = ? AND status = 'pending'").run(noteId);

    // Run analysis
    const analysisResults = analyzeDoctrineLinks(note, db, rules);

    // Store suggestions
    const insertStmt = db.prepare(`
      INSERT INTO doctrine_suggestions
        (id, note_id, chapter_number, section_letter, subsection_number,
         link_syntax, title, summary, confidence, signals, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `);

    const suggestions = [];
    for (const result of analysisResults) {
      const id = uuidv4();
      insertStmt.run(
        id, noteId, result.chapterNumber, result.sectionLetter,
        result.subsectionNumber, result.linkSyntax, result.title,
        result.summary, result.confidence, JSON.stringify(result.signals), now
      );

      suggestions.push({
        id,
        noteId,
        ...result,
        status: 'pending',
      });
    }

    res.json({
      noteId,
      noteTitle: note.title,
      noteType: note.type,
      passage: `${note.book} ${note.start_chapter}${note.start_verse ? ':' + note.start_verse : ''}`,
      suggestions,
      count: suggestions.length,
    });
  } catch (err) {
    console.error('Error analyzing doctrine links:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/doctrine-matching/suggestions/:noteId - Get stored suggestions
router.get('/suggestions/:noteId', (req, res) => {
  try {
    const { noteId } = req.params;
    const { status } = req.query;

    let query = 'SELECT * FROM doctrine_suggestions WHERE note_id = ?';
    const params = [noteId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY confidence DESC';

    const rows = db.prepare(query).all(...params);
    const suggestions = rows.map(toApiFormat);

    res.json({ noteId, suggestions, count: suggestions.length });
  } catch (err) {
    console.error('Error getting doctrine suggestions:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/doctrine-matching/apply - Accept/reject suggestions
router.post('/apply', (req, res) => {
  try {
    const { accepted = [], rejected = [] } = req.body;
    const now = new Date().toISOString();
    const results = { applied: [], rejected: [], errors: [] };

    // Process accepted suggestions
    for (const suggId of accepted) {
      const sugg = db.prepare('SELECT * FROM doctrine_suggestions WHERE id = ?').get(suggId);
      if (!sugg) {
        results.errors.push({ id: suggId, error: 'Suggestion not found' });
        continue;
      }

      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(sugg.note_id);
      if (!note) {
        results.errors.push({ id: suggId, error: 'Note not found' });
        continue;
      }

      // Build the link span HTML
      const ref = sugg.link_syntax.replace(/^\[\[ST:/, '').replace(/\]\]$/, '');
      const linkSpan = `<span class="systematic-link" data-st-ref="${ref}" data-st-display="${sugg.link_syntax}">${sugg.link_syntax}</span>`;

      // Insert into note content
      const updatedContent = insertDoctrineLink(note.content, linkSpan);

      db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?')
        .run(updatedContent, now, sugg.note_id);

      // Mark suggestion as accepted
      db.prepare("UPDATE doctrine_suggestions SET status = 'accepted', reviewed_at = ? WHERE id = ?")
        .run(now, suggId);

      results.applied.push({
        id: suggId,
        linkSyntax: sugg.link_syntax,
        noteId: sugg.note_id,
      });
    }

    // Process rejected suggestions
    for (const suggId of rejected) {
      db.prepare("UPDATE doctrine_suggestions SET status = 'rejected', reviewed_at = ? WHERE id = ?")
        .run(now, suggId);
      results.rejected.push({ id: suggId });
    }

    res.json(results);
  } catch (err) {
    console.error('Error applying doctrine suggestions:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/doctrine-matching/queue - Notes without doctrine links
router.get('/queue', (req, res) => {
  try {
    const { book, type } = req.query;

    // Notes that have no systematic-link spans in their content
    let query = `
      SELECT n.id, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse,
             n.title, n.type, n.updated_at,
             (SELECT COUNT(*) FROM doctrine_suggestions ds WHERE ds.note_id = n.id AND ds.status = 'pending') as pending_count
      FROM notes n
      WHERE n.content NOT LIKE '%systematic-link%'
    `;
    const params = [];

    if (book) {
      query += ' AND n.book = ?';
      params.push(book.toUpperCase());
    }
    if (type) {
      query += ' AND n.type = ?';
      params.push(type);
    }

    query += ' ORDER BY n.book, n.start_chapter, n.start_verse';

    const notes = db.prepare(query).all(...params);

    // Get total counts
    const totalNotes = db.prepare('SELECT COUNT(*) as count FROM notes').get().count;
    const linkedNotes = db.prepare("SELECT COUNT(*) as count FROM notes WHERE content LIKE '%systematic-link%'").get().count;

    res.json({
      queue: notes.map(n => ({
        id: n.id,
        book: n.book,
        startChapter: n.start_chapter,
        startVerse: n.start_verse,
        endChapter: n.end_chapter,
        endVerse: n.end_verse,
        title: n.title,
        type: n.type,
        pendingSuggestions: n.pending_count,
        updatedAt: n.updated_at,
      })),
      stats: {
        totalNotes,
        linkedNotes,
        unlinkedNotes: totalNotes - linkedNotes,
        progress: totalNotes > 0 ? Math.round((linkedNotes / totalNotes) * 100) : 0,
      },
      count: notes.length,
    });
  } catch (err) {
    console.error('Error getting doctrine matching queue:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/doctrine-matching/batch - Batch analyze or auto-link
router.post('/batch', (req, res) => {
  try {
    const { mode = 'analyze', noteIds, minConfidence = 0.5 } = req.body;

    // Get target notes
    let notes;
    if (noteIds && noteIds.length > 0) {
      const placeholders = noteIds.map(() => '?').join(',');
      notes = db.prepare(`SELECT * FROM notes WHERE id IN (${placeholders})`).all(...noteIds);
    } else {
      // Default: all notes without doctrine links
      notes = db.prepare("SELECT * FROM notes WHERE content NOT LIKE '%systematic-link%'").all();
    }

    const rules = loadRules();
    const now = new Date().toISOString();
    const results = { processed: 0, linked: 0, skipped: 0, suggestions: 0 };

    const insertStmt = db.prepare(`
      INSERT INTO doctrine_suggestions
        (id, note_id, chapter_number, section_letter, subsection_number,
         link_syntax, title, summary, confidence, signals, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const note of notes) {
      results.processed++;

      // Clear existing pending suggestions
      db.prepare("DELETE FROM doctrine_suggestions WHERE note_id = ? AND status = 'pending'").run(note.id);

      // Analyze
      const analysisResults = analyzeDoctrineLinks(note, db, rules);

      // Store all suggestions
      for (const result of analysisResults) {
        const id = uuidv4();
        const status = mode === 'auto' && result.confidence >= minConfidence ? 'accepted' : 'pending';

        insertStmt.run(
          id, note.id, result.chapterNumber, result.sectionLetter,
          result.subsectionNumber, result.linkSyntax, result.title,
          result.summary, result.confidence, JSON.stringify(result.signals),
          status, now
        );
        results.suggestions++;
      }

      // Auto-apply mode: insert high-confidence links
      if (mode === 'auto') {
        const toApply = analysisResults.filter(r => r.confidence >= minConfidence);
        if (toApply.length > 0) {
          let content = note.content || '';
          for (const result of toApply) {
            const ref = result.linkSyntax.replace(/^\[\[ST:/, '').replace(/\]\]$/, '');
            const linkSpan = `<span class="systematic-link" data-st-ref="${ref}" data-st-display="${result.linkSyntax}">${result.linkSyntax}</span>`;
            content = insertDoctrineLink(content, linkSpan);
          }

          db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?')
            .run(content, now, note.id);

          // Mark these suggestions as accepted
          db.prepare(`
            UPDATE doctrine_suggestions SET status = 'accepted', reviewed_at = ?
            WHERE note_id = ? AND status = 'pending' AND confidence >= ?
          `).run(now, note.id, minConfidence);

          results.linked++;
        } else {
          results.skipped++;
        }
      }
    }

    res.json(results);
  } catch (err) {
    console.error('Error in batch doctrine matching:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Helper: Insert a doctrine link span into note content ---

/**
 * Insert a link span into the "Related Doctrines:" block in the note content.
 * If no such block exists, create one at the end.
 */
function insertDoctrineLink(content, linkSpan) {
  if (!content) {
    return `<p><strong>Related Doctrines:</strong> ${linkSpan}</p>`;
  }

  // Check if there's an existing "Related Doctrines:" block
  const relatedIdx = content.indexOf('Related Doctrines:');
  if (relatedIdx !== -1) {
    // Find the closing </p> tag for this block
    const afterIdx = content.indexOf('</p>', relatedIdx);
    if (afterIdx !== -1) {
      // Insert before the closing </p>
      return content.substring(0, afterIdx) + ' | ' + linkSpan + content.substring(afterIdx);
    }
  }

  // No existing block; append new one
  return content + `<p><strong>Related Doctrines:</strong> ${linkSpan}</p>`;
}

module.exports = router;
