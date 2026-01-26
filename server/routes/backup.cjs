const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db.cjs');
const { syncInlineTags } = require('./notes.cjs');

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
  seriesId: row.series_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Convert series row to API format
const seriesToApiFormat = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Convert systematic annotation row to API format
const systematicAnnotationToApiFormat = (row) => ({
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

// Get tags for a note
const getNoteTags = (noteId) => {
  return db.prepare(`
    SELECT topic_id FROM note_tags WHERE note_id = ?
  `).all(noteId).map(t => t.topic_id);
};

// Convert topic row to API format
const topicToApiFormat = (row) => ({
  id: row.id,
  name: row.name,
  parentId: row.parent_id,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Convert inline tag type row to API format
const inlineTagTypeToApiFormat = (row) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  icon: row.icon,
  isDefault: row.is_default === 1,
  sortOrder: row.sort_order,
  createdAt: row.created_at
});

// GET /api/notes/export - Export all notes as JSON
router.get('/export', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM notes ORDER BY created_at ASC').all();
    const topics = db.prepare('SELECT * FROM topics ORDER BY created_at ASC').all();
    const inlineTagTypes = db.prepare('SELECT * FROM inline_tag_types ORDER BY sort_order ASC').all();
    const series = db.prepare('SELECT * FROM series ORDER BY created_at ASC').all();
    const systematicAnnotations = db.prepare('SELECT * FROM systematic_annotations ORDER BY created_at ASC').all();

    // Add tags to each note
    const notesWithTags = notes.map(note => ({
      ...toApiFormat(note),
      tags: getNoteTags(note.id)
    }));

    const exportData = {
      version: 4,
      exportedAt: new Date().toISOString(),
      notes: notesWithTags,
      topics: topics.map(topicToApiFormat),
      inlineTagTypes: inlineTagTypes.map(inlineTagTypeToApiFormat),
      series: series.map(seriesToApiFormat),
      systematicAnnotations: systematicAnnotations.map(systematicAnnotationToApiFormat)
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
    const { notes, topics, inlineTagTypes, series, systematicAnnotations, version } = req.body;

    if (!notes || !Array.isArray(notes)) {
      return res.status(400).json({ error: 'Invalid import data: notes array required' });
    }

    const now = new Date().toISOString();

    // Inline tag type statements
    const insertInlineTagTypeStmt = db.prepare(`
      INSERT INTO inline_tag_types (id, name, color, icon, is_default, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const updateInlineTagTypeStmt = db.prepare(`
      UPDATE inline_tag_types SET name = ?, color = ?, icon = ?, sort_order = ?
      WHERE id = ?
    `);
    const checkInlineTagTypeStmt = db.prepare('SELECT id FROM inline_tag_types WHERE id = ?');

    // Topic statements
    const insertTopicStmt = db.prepare(`
      INSERT INTO topics (id, name, parent_id, sort_order, systematic_tag_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const updateTopicStmt = db.prepare(`
      UPDATE topics SET name = ?, parent_id = ?, sort_order = ?, systematic_tag_id = ?, updated_at = ?
      WHERE id = ?
    `);
    const checkTopicStmt = db.prepare('SELECT id FROM topics WHERE id = ?');

    // Series statements
    const insertSeriesStmt = db.prepare(`
      INSERT INTO series (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const updateSeriesStmt = db.prepare(`
      UPDATE series SET name = ?, description = ?, updated_at = ?
      WHERE id = ?
    `);
    const checkSeriesStmt = db.prepare('SELECT id FROM series WHERE id = ?');

    // Systematic annotation statements
    const insertAnnotationStmt = db.prepare(`
      INSERT INTO systematic_annotations (id, systematic_id, annotation_type, color, content, text_selection, position_start, position_end, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateAnnotationStmt = db.prepare(`
      UPDATE systematic_annotations
      SET annotation_type = ?, color = ?, content = ?, text_selection = ?, position_start = ?, position_end = ?, updated_at = ?
      WHERE id = ?
    `);
    const checkAnnotationStmt = db.prepare('SELECT id FROM systematic_annotations WHERE id = ?');

    // Note statements
    const insertStmt = db.prepare(`
      INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, primary_topic_id, series_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = db.prepare(`
      UPDATE notes
      SET book = ?, start_chapter = ?, start_verse = ?, end_chapter = ?, end_verse = ?,
          title = ?, content = ?, type = ?, primary_topic_id = ?, series_id = ?, updated_at = ?
      WHERE id = ?
    `);

    const checkStmt = db.prepare('SELECT id FROM notes WHERE id = ?');
    const deleteTagsStmt = db.prepare('DELETE FROM note_tags WHERE note_id = ?');
    const insertTagStmt = db.prepare('INSERT INTO note_tags (note_id, topic_id) VALUES (?, ?)');

    let inserted = 0;
    let updated = 0;
    let topicsInserted = 0;
    let topicsUpdated = 0;
    let inlineTagTypesInserted = 0;
    let inlineTagTypesUpdated = 0;
    let seriesInserted = 0;
    let seriesUpdated = 0;
    let annotationsInserted = 0;
    let annotationsUpdated = 0;
    let errors = [];

    const importTransaction = db.transaction(() => {
      // Import inline tag types first (if provided)
      if (inlineTagTypes && Array.isArray(inlineTagTypes)) {
        for (const tagType of inlineTagTypes) {
          try {
            const existing = checkInlineTagTypeStmt.get(tagType.id);
            if (existing) {
              updateInlineTagTypeStmt.run(
                tagType.name,
                tagType.color,
                tagType.icon || null,
                tagType.sortOrder || 0,
                tagType.id
              );
              inlineTagTypesUpdated++;
            } else {
              insertInlineTagTypeStmt.run(
                tagType.id,
                tagType.name,
                tagType.color,
                tagType.icon || null,
                tagType.isDefault ? 1 : 0,
                tagType.sortOrder || 0,
                tagType.createdAt || now
              );
              inlineTagTypesInserted++;
            }
          } catch (tagTypeError) {
            errors.push({ id: tagType.id, type: 'inlineTagType', error: tagTypeError.message });
          }
        }
      }

      // Import topics (if provided)
      if (topics && Array.isArray(topics)) {
        for (const topic of topics) {
          try {
            const existing = checkTopicStmt.get(topic.id);
            if (existing) {
              updateTopicStmt.run(
                topic.name,
                topic.parentId || null,
                topic.sortOrder || 0,
                topic.systematicTagId || null,
                topic.updatedAt || now,
                topic.id
              );
              topicsUpdated++;
            } else {
              insertTopicStmt.run(
                topic.id,
                topic.name,
                topic.parentId || null,
                topic.sortOrder || 0,
                topic.systematicTagId || null,
                topic.createdAt || now,
                topic.updatedAt || now
              );
              topicsInserted++;
            }
          } catch (topicError) {
            errors.push({ id: topic.id, type: 'topic', error: topicError.message });
          }
        }
      }

      // Import series (before notes due to FK dependency)
      if (series && Array.isArray(series)) {
        for (const s of series) {
          try {
            const existing = checkSeriesStmt.get(s.id);
            if (existing) {
              updateSeriesStmt.run(
                s.name,
                s.description || '',
                s.updatedAt || now,
                s.id
              );
              seriesUpdated++;
            } else {
              insertSeriesStmt.run(
                s.id,
                s.name,
                s.description || '',
                s.createdAt || now,
                s.updatedAt || now
              );
              seriesInserted++;
            }
          } catch (seriesError) {
            errors.push({ id: s.id, type: 'series', error: seriesError.message });
          }
        }
      }

      // Import systematic annotations (if provided)
      if (systematicAnnotations && Array.isArray(systematicAnnotations)) {
        for (const ann of systematicAnnotations) {
          try {
            const existing = checkAnnotationStmt.get(ann.id);
            if (existing) {
              updateAnnotationStmt.run(
                ann.annotationType,
                ann.color || null,
                ann.content || null,
                ann.textSelection || null,
                ann.positionStart || null,
                ann.positionEnd || null,
                ann.updatedAt || now,
                ann.id
              );
              annotationsUpdated++;
            } else {
              insertAnnotationStmt.run(
                ann.id,
                ann.systematicId,
                ann.annotationType,
                ann.color || null,
                ann.content || null,
                ann.textSelection || null,
                ann.positionStart || null,
                ann.positionEnd || null,
                ann.createdAt || now,
                ann.updatedAt || now
              );
              annotationsInserted++;
            }
          } catch (annError) {
            // Ignore annotation errors (systematic_id may not exist if ST data not imported)
            errors.push({ id: ann.id, type: 'systematicAnnotation', error: annError.message });
          }
        }
      }

      // Import notes
      for (const note of notes) {
        // Generate UUID if not provided (declare outside try for error reporting)
        const noteId = note.id || uuidv4();
        try {
          const existing = checkStmt.get(noteId);

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
              note.primaryTopicId || null,
              note.seriesId || null,
              note.updatedAt || now,
              noteId
            );
            updated++;
          } else {
            // Insert new note
            insertStmt.run(
              noteId,
              note.book,
              note.startChapter,
              note.startVerse || null,
              note.endChapter,
              note.endVerse || null,
              note.title || '',
              note.content || '',
              note.type || 'note',
              note.primaryTopicId || null,
              note.seriesId || null,
              note.createdAt || now,
              note.updatedAt || now
            );
            inserted++;
          }

          // Handle tags if present
          if (note.tags && Array.isArray(note.tags)) {
            deleteTagsStmt.run(noteId);
            for (const tagId of note.tags) {
              try {
                insertTagStmt.run(noteId, tagId);
              } catch (tagError) {
                // Ignore tag errors (e.g., topic doesn't exist)
              }
            }
          }

          // Sync inline tags from note content
          if (note.content) {
            syncInlineTags(noteId, note.content);
          }
        } catch (noteError) {
          errors.push({ id: noteId, type: 'note', error: noteError.message });
        }
      }
    });

    importTransaction();

    res.json({
      success: true,
      inserted,
      updated,
      topicsInserted,
      topicsUpdated,
      inlineTagTypesInserted,
      inlineTagTypesUpdated,
      seriesInserted,
      seriesUpdated,
      annotationsInserted,
      annotationsUpdated,
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

// DELETE /api/notes/cleanup-null - Delete notes with null IDs (repair endpoint)
router.delete('/cleanup-null', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM notes WHERE id IS NULL').run();
    res.json({
      success: true,
      deleted: result.changes
    });
  } catch (error) {
    console.error('Error cleaning up null notes:', error);
    res.status(500).json({ error: 'Failed to cleanup null notes' });
  }
});

module.exports = router;
