'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cheerio = require('cheerio');
const db = require('../db.cjs');
const { analyzeTopics, analyzeInlineTags, loadRules } = require('../lib/tagging-engine.cjs');

const router = express.Router();

// Convert db row to API format
const toApiFormat = (row) => ({
  id: row.id,
  noteId: row.note_id,
  suggestionType: row.suggestion_type,
  topicId: row.topic_id,
  tagType: row.tag_type,
  textContent: row.text_content,
  htmlContext: row.html_context,
  charOffsetStart: row.char_offset_start,
  charOffsetEnd: row.char_offset_end,
  confidence: row.confidence,
  signals: row.signals ? JSON.parse(row.signals) : [],
  status: row.status,
  createdAt: row.created_at,
  reviewedAt: row.reviewed_at,
});

// POST /api/tagging/analyze/:noteId - Run analysis and store suggestions
router.post('/analyze/:noteId', (req, res) => {
  try {
    const { noteId } = req.params;
    const { type } = req.query; // 'topics', 'inline', or undefined for both

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const rules = loadRules();
    const now = new Date().toISOString();
    const suggestions = [];

    // Clear existing pending suggestions for this note (re-analysis)
    db.prepare("DELETE FROM tagging_suggestions WHERE note_id = ? AND status = 'pending'").run(noteId);

    // Topic analysis
    if (!type || type === 'topics') {
      const topicResults = analyzeTopics(note, db, rules);
      for (const result of topicResults) {
        const id = uuidv4();
        db.prepare(`
          INSERT INTO tagging_suggestions (id, note_id, suggestion_type, topic_id, confidence, signals, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        `).run(id, noteId, result.suggestionType, result.topicId, result.confidence, JSON.stringify(result.signals), now);

        suggestions.push({
          id,
          noteId,
          suggestionType: result.suggestionType,
          topicId: result.topicId,
          topicName: result.topicName,
          confidence: result.confidence,
          signals: result.signals,
          status: 'pending',
        });
      }
    }

    // Inline tag analysis
    if (!type || type === 'inline') {
      const inlineResults = analyzeInlineTags(note.content, rules);
      for (const result of inlineResults) {
        const id = uuidv4();
        // Store a snippet of surrounding HTML for context
        const htmlContext = (note.content || '').substring(
          Math.max(0, result.charOffsetStart - 50),
          Math.min((note.content || '').length, result.charOffsetEnd + 50)
        );

        db.prepare(`
          INSERT INTO tagging_suggestions (id, note_id, suggestion_type, tag_type, text_content, html_context, char_offset_start, char_offset_end, confidence, signals, status, created_at)
          VALUES (?, ?, 'inline_tag', ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `).run(
          id, noteId, result.tagType, result.textContent, htmlContext,
          result.charOffsetStart, result.charOffsetEnd,
          result.confidence, JSON.stringify(result.signals), now
        );

        suggestions.push({
          id,
          noteId,
          suggestionType: 'inline_tag',
          tagType: result.tagType,
          textContent: result.textContent,
          charOffsetStart: result.charOffsetStart,
          charOffsetEnd: result.charOffsetEnd,
          confidence: result.confidence,
          signals: result.signals,
          status: 'pending',
        });
      }
    }

    res.json({
      noteId,
      noteTitle: note.title,
      noteType: note.type,
      passage: `${note.book} ${note.start_chapter}${note.start_verse ? ':' + note.start_verse : ''}`,
      suggestions,
      counts: {
        topics: suggestions.filter(s => s.suggestionType !== 'inline_tag').length,
        inlineTags: suggestions.filter(s => s.suggestionType === 'inline_tag').length,
        total: suggestions.length,
      },
    });
  } catch (err) {
    console.error('Error analyzing note:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tagging/suggestions/:noteId - Get suggestions for a note
router.get('/suggestions/:noteId', (req, res) => {
  try {
    const { noteId } = req.params;
    const { status } = req.query;

    let query = 'SELECT * FROM tagging_suggestions WHERE note_id = ?';
    const params = [noteId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY confidence DESC';

    const rows = db.prepare(query).all(...params);

    // Enrich topic suggestions with topic names
    const topicIds = rows.filter(r => r.topic_id).map(r => r.topic_id);
    const topicNames = {};
    if (topicIds.length > 0) {
      const placeholders = topicIds.map(() => '?').join(',');
      const topics = db.prepare(`SELECT id, name FROM topics WHERE id IN (${placeholders})`).all(...topicIds);
      for (const t of topics) topicNames[t.id] = t.name;
    }

    const suggestions = rows.map(row => ({
      ...toApiFormat(row),
      topicName: row.topic_id ? topicNames[row.topic_id] || null : null,
    }));

    res.json({ noteId, suggestions, count: suggestions.length });
  } catch (err) {
    console.error('Error getting suggestions:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tagging/apply - Accept or reject suggestions
router.post('/apply', (req, res) => {
  try {
    const { accepted = [], rejected = [] } = req.body;
    const now = new Date().toISOString();
    const results = { applied: [], rejected: [], errors: [] };

    // Process accepted suggestions
    for (const suggId of accepted) {
      const sugg = db.prepare('SELECT * FROM tagging_suggestions WHERE id = ?').get(suggId);
      if (!sugg) {
        results.errors.push({ id: suggId, error: 'Suggestion not found' });
        continue;
      }

      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(sugg.note_id);
      if (!note) {
        results.errors.push({ id: suggId, error: 'Note not found' });
        continue;
      }

      if (sugg.suggestion_type === 'primary_topic') {
        // Set primary topic
        db.prepare('UPDATE notes SET primary_topic_id = ?, updated_at = ? WHERE id = ?')
          .run(sugg.topic_id, now, sugg.note_id);
        results.applied.push({ id: suggId, type: 'primary_topic', topicId: sugg.topic_id });

      } else if (sugg.suggestion_type === 'secondary_topic') {
        // Add secondary tag
        db.prepare('INSERT OR IGNORE INTO note_tags (note_id, topic_id) VALUES (?, ?)')
          .run(sugg.note_id, sugg.topic_id);
        results.applied.push({ id: suggId, type: 'secondary_topic', topicId: sugg.topic_id });

      } else if (sugg.suggestion_type === 'inline_tag') {
        // Wrap matched text in HTML
        const updated = applyInlineTag(note.content, sugg.text_content, sugg.tag_type);
        if (updated !== note.content) {
          db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?')
            .run(updated, now, sugg.note_id);
          // Re-sync inline tags
          syncInlineTags(sugg.note_id, updated);
          results.applied.push({ id: suggId, type: 'inline_tag', tagType: sugg.tag_type });
        } else {
          results.errors.push({ id: suggId, error: 'Could not find matched text in current content' });
        }
      }

      // Mark suggestion as accepted
      db.prepare("UPDATE tagging_suggestions SET status = 'accepted', reviewed_at = ? WHERE id = ?")
        .run(now, suggId);
    }

    // Process rejected suggestions
    for (const suggId of rejected) {
      db.prepare("UPDATE tagging_suggestions SET status = 'rejected', reviewed_at = ? WHERE id = ?")
        .run(now, suggId);
      results.rejected.push({ id: suggId });
    }

    res.json(results);
  } catch (err) {
    console.error('Error applying suggestions:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tagging/queue - Get untagged notes
router.get('/queue', (req, res) => {
  try {
    const { book, type } = req.query;

    let query = `
      SELECT n.id, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse,
             n.title, n.type, n.primary_topic_id, n.updated_at,
             (SELECT COUNT(*) FROM tagging_suggestions ts WHERE ts.note_id = n.id AND ts.status = 'pending') as pending_count
      FROM notes n
      WHERE n.primary_topic_id IS NULL
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
    const taggedNotes = db.prepare('SELECT COUNT(*) as count FROM notes WHERE primary_topic_id IS NOT NULL').get().count;

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
        taggedNotes,
        untaggedNotes: totalNotes - taggedNotes,
        progress: totalNotes > 0 ? Math.round((taggedNotes / totalNotes) * 100) : 0,
      },
      count: notes.length,
    });
  } catch (err) {
    console.error('Error getting tagging queue:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tagging/batch - Batch analyze or auto-tag
router.post('/batch', (req, res) => {
  try {
    const { mode = 'analyze', noteIds, minConfidence = 0.6 } = req.body;

    // Get target notes
    let notes;
    if (noteIds && noteIds.length > 0) {
      const placeholders = noteIds.map(() => '?').join(',');
      notes = db.prepare(`SELECT * FROM notes WHERE id IN (${placeholders})`).all(...noteIds);
    } else {
      // Default: all untagged notes
      notes = db.prepare('SELECT * FROM notes WHERE primary_topic_id IS NULL').all();
    }

    const rules = loadRules();
    const now = new Date().toISOString();
    const results = { processed: 0, tagged: 0, skipped: 0, suggestions: 0 };

    for (const note of notes) {
      results.processed++;

      // Clear existing pending suggestions
      db.prepare("DELETE FROM tagging_suggestions WHERE note_id = ? AND status = 'pending'").run(note.id);

      // Analyze
      const topicResults = analyzeTopics(note, db, rules);
      const inlineResults = analyzeInlineTags(note.content, rules);

      // Store all suggestions
      for (const result of topicResults) {
        const id = uuidv4();
        db.prepare(`
          INSERT INTO tagging_suggestions (id, note_id, suggestion_type, topic_id, confidence, signals, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        `).run(id, note.id, result.suggestionType, result.topicId, result.confidence, JSON.stringify(result.signals), now);
        results.suggestions++;
      }

      for (const result of inlineResults) {
        const id = uuidv4();
        db.prepare(`
          INSERT INTO tagging_suggestions (id, note_id, suggestion_type, tag_type, text_content, char_offset_start, char_offset_end, confidence, signals, status, created_at)
          VALUES (?, ?, 'inline_tag', ?, ?, ?, ?, ?, ?, 'pending', ?)
        `).run(id, note.id, result.tagType, result.textContent, result.charOffsetStart, result.charOffsetEnd, result.confidence, JSON.stringify(result.signals), now);
        results.suggestions++;
      }

      // Auto-apply mode: apply high-confidence topic suggestions
      if (mode === 'auto') {
        const primary = topicResults.find(r => r.suggestionType === 'primary_topic' && r.confidence >= minConfidence);
        if (primary && !note.primary_topic_id) {
          db.prepare('UPDATE notes SET primary_topic_id = ?, updated_at = ? WHERE id = ?')
            .run(primary.topicId, now, note.id);
          results.tagged++;

          // Mark that suggestion as accepted
          db.prepare(`
            UPDATE tagging_suggestions SET status = 'accepted', reviewed_at = ?
            WHERE note_id = ? AND topic_id = ? AND suggestion_type = 'primary_topic' AND status = 'pending'
          `).run(now, note.id, primary.topicId);
        } else {
          results.skipped++;
        }
      }
    }

    res.json(results);
  } catch (err) {
    console.error('Error in batch tagging:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Helper functions ---

/**
 * Apply an inline tag by wrapping matched text in the note's HTML content.
 * Uses text search (not position-only) to handle edits since analysis.
 */
function applyInlineTag(html, textToMatch, tagType) {
  if (!html || !textToMatch) return html;

  const $ = cheerio.load(html, { xmlMode: false, decodeEntities: false });

  // Walk text nodes looking for the match
  let found = false;

  function walkAndReplace(node) {
    if (found) return;

    node.contents().each((_, el) => {
      if (found) return;

      if (el.type === 'text') {
        const text = $(el).text();
        const idx = text.indexOf(textToMatch);
        if (idx !== -1) {
          // Found the match - wrap it
          const before = text.substring(0, idx);
          const match = text.substring(idx, idx + textToMatch.length);
          const after = text.substring(idx + textToMatch.length);
          const wrapped = `${before}<span data-inline-tag="${tagType}">${match}</span>${after}`;
          $(el).replaceWith(wrapped);
          found = true;
        }
      } else if (el.type === 'tag' && !$(el).attr('data-inline-tag')) {
        walkAndReplace($(el));
      }
    });
  }

  walkAndReplace($.root());

  if (found) {
    return $.html();
  }
  return html;
}

/**
 * Sync inline tags - mirrors the function from notes.cjs
 */
function syncInlineTags(noteId, htmlContent) {
  const crypto = require('crypto');

  const generateSignature = (text) => {
    if (!text || text.length < 20) return null;
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);
  };

  if (!htmlContent) {
    db.prepare('DELETE FROM inline_tags WHERE note_id = ?').run(noteId);
    return;
  }

  const $ = cheerio.load(htmlContent);
  const taggedSpans = $('span[data-inline-tag]');

  db.prepare('DELETE FROM inline_tags WHERE note_id = ?').run(noteId);

  if (taggedSpans.length === 0) return;

  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO inline_tags (id, note_id, tag_type, text_content, html_fragment, position_start, position_end, text_signature, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let position = 0;
  taggedSpans.each((_, span) => {
    const $span = $(span);
    const tagType = $span.attr('data-inline-tag');
    const textContent = $span.text() || '';
    const htmlFragment = $.html($span);
    const id = uuidv4();
    const signature = generateSignature(textContent);

    insertStmt.run(id, noteId, tagType, textContent, htmlFragment, position, position + textContent.length, signature, now);
    position += textContent.length + 1;
  });
}

module.exports = router;
