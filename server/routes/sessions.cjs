const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db.cjs');

const router = express.Router();

// Convert database row to API format
const toApiFormat = (row) => ({
  id: row.id,
  sessionType: row.session_type,
  referenceId: row.reference_id,
  referenceLabel: row.reference_label,
  durationSeconds: row.duration_seconds,
  createdAt: row.created_at
});

// POST /api/sessions - Log a study session
router.post('/', (req, res) => {
  try {
    const { sessionType, referenceId, referenceLabel, durationSeconds } = req.body;

    if (!sessionType || !referenceId) {
      return res.status(400).json({
        error: 'Missing required fields: sessionType, referenceId'
      });
    }

    // Validate session type
    const validTypes = ['bible', 'doctrine', 'note'];
    if (!validTypes.includes(sessionType)) {
      return res.status(400).json({
        error: `Invalid sessionType. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO study_sessions (id, session_type, reference_id, reference_label, duration_seconds, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, sessionType, referenceId, referenceLabel || null, durationSeconds || null, now);

    const session = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(id);
    res.status(201).json(toApiFormat(session));
  } catch (error) {
    console.error('Error logging session:', error);
    res.status(500).json({ error: 'Failed to log session' });
  }
});

// GET /api/sessions - Get recent sessions
router.get('/', (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      type,
      startDate,
      endDate
    } = req.query;

    let sql = 'SELECT * FROM study_sessions WHERE 1=1';
    const params = [];

    if (type) {
      sql += ' AND session_type = ?';
      params.push(type);
    }

    if (startDate) {
      sql += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND created_at <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const sessions = db.prepare(sql).all(...params);

    // Get total count with same filters
    let countSql = 'SELECT COUNT(*) as count FROM study_sessions WHERE 1=1';
    const countParams = [];

    if (type) {
      countSql += ' AND session_type = ?';
      countParams.push(type);
    }

    if (startDate) {
      countSql += ' AND created_at >= ?';
      countParams.push(startDate);
    }

    if (endDate) {
      countSql += ' AND created_at <= ?';
      countParams.push(endDate);
    }

    const { count: total } = db.prepare(countSql).get(...countParams);

    res.json({
      sessions: sessions.map(toApiFormat),
      total,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/sessions/summary - Get aggregated statistics
router.get('/summary', (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days, 10));
    const startDateStr = startDate.toISOString();

    // Total sessions by type
    const byType = db.prepare(`
      SELECT session_type as type, COUNT(*) as count
      FROM study_sessions
      WHERE created_at >= ?
      GROUP BY session_type
    `).all(startDateStr);

    // Most studied Bible chapters
    const topBibleChapters = db.prepare(`
      SELECT reference_id as referenceId, reference_label as referenceLabel, COUNT(*) as count
      FROM study_sessions
      WHERE session_type = 'bible' AND created_at >= ?
      GROUP BY reference_id
      ORDER BY count DESC
      LIMIT 10
    `).all(startDateStr);

    // Most viewed doctrines
    const topDoctrines = db.prepare(`
      SELECT reference_id as referenceId, reference_label as referenceLabel, COUNT(*) as count
      FROM study_sessions
      WHERE session_type = 'doctrine' AND created_at >= ?
      GROUP BY reference_id
      ORDER BY count DESC
      LIMIT 10
    `).all(startDateStr);

    // Most accessed notes
    const topNotes = db.prepare(`
      SELECT reference_id as referenceId, reference_label as referenceLabel, COUNT(*) as count
      FROM study_sessions
      WHERE session_type = 'note' AND created_at >= ?
      GROUP BY reference_id
      ORDER BY count DESC
      LIMIT 10
    `).all(startDateStr);

    // Sessions per day (last 7 days)
    const dailyActivity = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM study_sessions
      WHERE created_at >= DATE('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all();

    // Total unique references studied
    const uniqueCounts = db.prepare(`
      SELECT
        session_type as type,
        COUNT(DISTINCT reference_id) as uniqueCount
      FROM study_sessions
      WHERE created_at >= ?
      GROUP BY session_type
    `).all(startDateStr);

    res.json({
      period: {
        days: parseInt(days, 10),
        startDate: startDateStr
      },
      byType: Object.fromEntries(byType.map(r => [r.type, r.count])),
      uniqueByType: Object.fromEntries(uniqueCounts.map(r => [r.type, r.uniqueCount])),
      topBibleChapters,
      topDoctrines,
      topNotes,
      dailyActivity
    });
  } catch (error) {
    console.error('Error fetching session summary:', error);
    res.status(500).json({ error: 'Failed to fetch session summary' });
  }
});

// GET /api/sessions/related - Find sessions related to a reference
router.get('/related', (req, res) => {
  try {
    const { book, chapter, doctrineChapter } = req.query;
    const results = [];

    if (book && chapter) {
      // Find sessions for the same Bible book
      const biblePattern = `${book}:%`;
      const relatedBible = db.prepare(`
        SELECT * FROM study_sessions
        WHERE session_type = 'bible' AND reference_id LIKE ?
        ORDER BY created_at DESC
        LIMIT 20
      `).all(biblePattern);
      results.push(...relatedBible.map(toApiFormat));
    }

    if (doctrineChapter) {
      // Find sessions for related doctrines
      const doctrinePattern = `ch${doctrineChapter}%`;
      const relatedDoctrine = db.prepare(`
        SELECT * FROM study_sessions
        WHERE session_type = 'doctrine' AND reference_id LIKE ?
        ORDER BY created_at DESC
        LIMIT 20
      `).all(doctrinePattern);
      results.push(...relatedDoctrine.map(toApiFormat));
    }

    res.json({ sessions: results });
  } catch (error) {
    console.error('Error fetching related sessions:', error);
    res.status(500).json({ error: 'Failed to fetch related sessions' });
  }
});

// DELETE /api/sessions - Clear old sessions (optional cleanup)
router.delete('/', (req, res) => {
  try {
    const { olderThan } = req.query;

    if (!olderThan) {
      return res.status(400).json({
        error: 'olderThan query parameter required (ISO date string)'
      });
    }

    const result = db.prepare(`
      DELETE FROM study_sessions WHERE created_at < ?
    `).run(olderThan);

    res.json({
      deleted: result.changes,
      message: `Deleted ${result.changes} sessions older than ${olderThan}`
    });
  } catch (error) {
    console.error('Error clearing sessions:', error);
    res.status(500).json({ error: 'Failed to clear sessions' });
  }
});

module.exports = router;
