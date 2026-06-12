const express = require('express');
const router = express.Router();
const db = require('../db.cjs');

// GET /api/coverage - Aggregated pulpit coverage statistics
// Single payload powering the Coverage Dashboard. Pure SQL/JS, no AI.
router.get('/', (req, res) => {
  try {
    // --- Scripture heatmap: per book+chapter counts by note type ---
    const noteRows = db.prepare(`
      SELECT book, start_chapter, end_chapter, type, updated_at
      FROM notes
    `).all();

    // Expand each note across its chapter span: { GEN: { 1: { note, commentary, sermon } } }
    const heatmap = {};
    for (const row of noteRows) {
      const book = row.book;
      if (!heatmap[book]) heatmap[book] = {};
      const start = row.start_chapter;
      const end = Math.max(row.end_chapter || start, start);
      for (let ch = start; ch <= end; ch++) {
        if (!heatmap[book][ch]) heatmap[book][ch] = { note: 0, commentary: 0, sermon: 0 };
        const type = ['note', 'commentary', 'sermon'].includes(row.type) ? row.type : 'note';
        heatmap[book][ch][type]++;
      }
    }

    // --- Doctrine coverage: notes linking to each Grudem chapter ---
    const doctrineChapters = db.prepare(`
      SELECT chapter_number, title, part_number
      FROM systematic_theology
      WHERE entry_type = 'chapter'
      ORDER BY chapter_number
    `).all();

    const doctrineCoverageStmt = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN type = 'sermon' THEN 1 ELSE 0 END) as sermons,
             MAX(updated_at) as last_touched
      FROM notes
      WHERE content LIKE ? OR content LIKE ?
    `);

    const doctrines = doctrineChapters.map((ch) => {
      const row = doctrineCoverageStmt.get(
        `%[[ST:Ch${ch.chapter_number}]]%`,
        `%[[ST:Ch${ch.chapter_number}:%`
      );
      return {
        chapterNumber: ch.chapter_number,
        title: ch.title,
        partNumber: ch.part_number,
        noteCount: row.total || 0,
        sermonCount: row.sermons || 0,
        lastTouched: row.last_touched || null
      };
    });

    // --- Topic frequency: primary topic + secondary tags, deduped per note ---
    const topics = db.prepare(`
      SELECT t.id, t.name, COUNT(DISTINCT n.note_id) as note_count
      FROM topics t
      LEFT JOIN (
        SELECT note_id, topic_id FROM note_tags
        UNION
        SELECT id as note_id, primary_topic_id as topic_id FROM notes WHERE primary_topic_id IS NOT NULL
      ) n ON n.topic_id = t.id
      GROUP BY t.id, t.name
      ORDER BY note_count DESC, t.name ASC
    `).all().map((t) => ({ id: t.id, name: t.name, noteCount: t.note_count }));

    // --- Illustration reuse (duplicate detection via text_signature) ---
    const illustrationTotals = db.prepare(`
      SELECT COUNT(*) as total, COUNT(DISTINCT text_signature) as unique_count
      FROM inline_tags
      WHERE tag_type = 'illustration'
    `).get();

    const duplicateRows = db.prepare(`
      SELECT it.text_signature, COUNT(*) as use_count,
             MIN(it.text_content) as sample_text
      FROM inline_tags it
      WHERE it.tag_type = 'illustration' AND it.text_signature IS NOT NULL
      GROUP BY it.text_signature
      HAVING COUNT(*) > 1
      ORDER BY use_count DESC
      LIMIT 25
    `).all();

    const duplicateNotesStmt = db.prepare(`
      SELECT DISTINCT n.id, n.title, n.book, n.start_chapter, n.type
      FROM inline_tags it
      JOIN notes n ON n.id = it.note_id
      WHERE it.text_signature = ? AND it.tag_type = 'illustration'
    `);

    const duplicateIllustrations = duplicateRows.map((d) => ({
      signature: d.text_signature,
      text: d.sample_text,
      useCount: d.use_count,
      notes: duplicateNotesStmt.all(d.text_signature).map((n) => ({
        id: n.id,
        title: n.title,
        book: n.book,
        startChapter: n.start_chapter,
        type: n.type
      }))
    }));

    // --- Series timeline ---
    const series = db.prepare(`
      SELECT s.id, s.name, s.description,
             COUNT(n.id) as sermon_count,
             MIN(n.created_at) as first_date,
             MAX(n.created_at) as last_date
      FROM series s
      LEFT JOIN notes n ON n.series_id = s.id
      GROUP BY s.id
      ORDER BY last_date DESC
    `).all().map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      sermonCount: s.sermon_count,
      firstDate: s.first_date,
      lastDate: s.last_date
    }));

    // --- Monthly activity (last 24 months of note creation) ---
    const activity = db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month,
             COUNT(*) as total,
             SUM(CASE WHEN type = 'sermon' THEN 1 ELSE 0 END) as sermons
      FROM notes
      WHERE created_at >= date('now', '-24 months')
      GROUP BY month
      ORDER BY month ASC
    `).all().map((a) => ({ month: a.month, total: a.total, sermons: a.sermons }));

    // --- Totals ---
    const typeCounts = db.prepare(`
      SELECT type, COUNT(*) as count FROM notes GROUP BY type
    `).all();
    const totals = { note: 0, commentary: 0, sermon: 0 };
    for (const t of typeCounts) {
      if (totals[t.type] !== undefined) totals[t.type] = t.count;
    }

    res.json({
      heatmap,
      doctrines,
      topics,
      illustrations: {
        total: illustrationTotals.total || 0,
        unique: illustrationTotals.unique_count || 0,
        duplicates: duplicateIllustrations
      },
      series,
      activity,
      totals: {
        notes: totals.note,
        commentary: totals.commentary,
        sermons: totals.sermon,
        booksWithNotes: Object.keys(heatmap).length,
        doctrinesCovered: doctrines.filter((d) => d.noteCount > 0).length,
        doctrinesTotal: doctrines.length
      }
    });
  } catch (error) {
    console.error('Error building coverage stats:', error);
    res.status(500).json({ error: 'Failed to build coverage statistics' });
  }
});

module.exports = router;
