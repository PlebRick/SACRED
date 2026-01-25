import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import {
  DbNote,
  toApiFormat,
  DbTopic,
  topicToApiFormat,
  DbInlineTagType,
  inlineTagTypeToApiFormat,
  DbSeries,
  seriesToApiFormat,
  DbSystematicAnnotation,
  systematicAnnotationToApiFormat,
} from '../utils/format.js';
import { logger } from '../utils/logger.js';

/**
 * Get tags for a note
 */
function getNoteTags(noteId: string): string[] {
  const tags = db.prepare('SELECT topic_id FROM note_tags WHERE note_id = ?').all(noteId) as { topic_id: string }[];
  return tags.map((t) => t.topic_id);
}

/**
 * Register backup/restore tools for MCP
 */
export function registerBackupTools(server: McpServer): void {
  // full_export - Export everything as JSON
  server.tool(
    'full_export',
    'Export all SACRED data (notes, topics, inline tag types, series, systematic annotations) as JSON backup',
    {},
    async () => {
      try {
        const notes = db.prepare('SELECT * FROM notes ORDER BY created_at ASC').all() as (DbNote & { series_id: string | null })[];
        const topics = db.prepare('SELECT * FROM topics ORDER BY created_at ASC').all() as DbTopic[];
        const inlineTagTypes = db.prepare('SELECT * FROM inline_tag_types ORDER BY sort_order ASC').all() as DbInlineTagType[];
        const series = db.prepare('SELECT * FROM series ORDER BY created_at ASC').all() as DbSeries[];
        const systematicAnnotations = db.prepare('SELECT * FROM systematic_annotations ORDER BY created_at ASC').all() as DbSystematicAnnotation[];
        const noteTags = db.prepare('SELECT * FROM note_tags').all() as { note_id: string; topic_id: string }[];

        // Add tags and seriesId to each note
        const notesWithTags = notes.map((note) => ({
          ...toApiFormat(note),
          seriesId: note.series_id,
          tags: getNoteTags(note.id),
        }));

        const exportData = {
          version: 4,
          exportedAt: new Date().toISOString(),
          notes: notesWithTags,
          topics: topics.map(topicToApiFormat),
          inlineTagTypes: inlineTagTypes.map(inlineTagTypeToApiFormat),
          series: series.map(seriesToApiFormat),
          systematicAnnotations: systematicAnnotations.map(systematicAnnotationToApiFormat),
          statistics: {
            notes: notes.length,
            topics: topics.length,
            inlineTagTypes: inlineTagTypes.length,
            series: series.length,
            systematicAnnotations: systematicAnnotations.length,
            noteTags: noteTags.length,
          },
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(exportData, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error exporting data:', error);
        return {
          content: [{ type: 'text' as const, text: `Error exporting data: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // full_import - Import backup (upsert)
  server.tool(
    'full_import',
    'Import SACRED backup data (upserts: updates existing, inserts new)',
    {
      notes: z
        .array(
          z.object({
            id: z.string().optional(),
            book: z.string(),
            startChapter: z.number(),
            startVerse: z.number().nullable().optional(),
            endChapter: z.number(),
            endVerse: z.number().nullable().optional(),
            title: z.string().optional(),
            content: z.string().optional(),
            type: z.enum(['note', 'commentary', 'sermon']).optional(),
            primaryTopicId: z.string().nullable().optional(),
            seriesId: z.string().nullable().optional(),
            tags: z.array(z.string()).optional(),
            createdAt: z.string().optional(),
            updatedAt: z.string().optional(),
          })
        )
        .describe('Array of notes to import'),
      topics: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            parentId: z.string().nullable().optional(),
            sortOrder: z.number().optional(),
            systematicTagId: z.string().nullable().optional(),
            createdAt: z.string().optional(),
            updatedAt: z.string().optional(),
          })
        )
        .optional()
        .describe('Array of topics to import'),
      inlineTagTypes: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            color: z.string(),
            icon: z.string().nullable().optional(),
            isDefault: z.boolean().optional(),
            sortOrder: z.number().optional(),
            createdAt: z.string().optional(),
          })
        )
        .optional()
        .describe('Array of inline tag types to import'),
      series: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable().optional(),
            createdAt: z.string().optional(),
            updatedAt: z.string().optional(),
          })
        )
        .optional()
        .describe('Array of sermon series to import'),
      systematicAnnotations: z
        .array(
          z.object({
            id: z.string(),
            systematicId: z.string(),
            annotationType: z.string(),
            color: z.string().nullable().optional(),
            content: z.string().nullable().optional(),
            textSelection: z.string().nullable().optional(),
            positionStart: z.number().nullable().optional(),
            positionEnd: z.number().nullable().optional(),
            createdAt: z.string().optional(),
            updatedAt: z.string().optional(),
          })
        )
        .optional()
        .describe('Array of systematic theology annotations to import'),
    },
    async ({ notes, topics, inlineTagTypes, series, systematicAnnotations }) => {
      try {
        // Prepare statements
        const insertInlineTagTypeStmt = db.prepare(`
          INSERT INTO inline_tag_types (id, name, color, icon, is_default, sort_order, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const updateInlineTagTypeStmt = db.prepare(`
          UPDATE inline_tag_types SET name = ?, color = ?, icon = ?, sort_order = ?
          WHERE id = ?
        `);
        const checkInlineTagTypeStmt = db.prepare('SELECT id FROM inline_tag_types WHERE id = ?');

        const insertTopicStmt = db.prepare(`
          INSERT INTO topics (id, name, parent_id, sort_order, systematic_tag_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const updateTopicStmt = db.prepare(`
          UPDATE topics SET name = ?, parent_id = ?, sort_order = ?, systematic_tag_id = ?, updated_at = ?
          WHERE id = ?
        `);
        const checkTopicStmt = db.prepare('SELECT id FROM topics WHERE id = ?');

        const insertSeriesStmt = db.prepare(`
          INSERT INTO series (id, name, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        const updateSeriesStmt = db.prepare(`
          UPDATE series SET name = ?, description = ?, updated_at = ?
          WHERE id = ?
        `);
        const checkSeriesStmt = db.prepare('SELECT id FROM series WHERE id = ?');

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

        const insertNoteStmt = db.prepare(`
          INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, primary_topic_id, series_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const updateNoteStmt = db.prepare(`
          UPDATE notes
          SET book = ?, start_chapter = ?, start_verse = ?, end_chapter = ?, end_verse = ?,
              title = ?, content = ?, type = ?, primary_topic_id = ?, series_id = ?, updated_at = ?
          WHERE id = ?
        `);
        const checkNoteStmt = db.prepare('SELECT id FROM notes WHERE id = ?');
        const deleteTagsStmt = db.prepare('DELETE FROM note_tags WHERE note_id = ?');
        const insertTagStmt = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, topic_id) VALUES (?, ?)');

        let notesInserted = 0;
        let notesUpdated = 0;
        let topicsInserted = 0;
        let topicsUpdated = 0;
        let inlineTagTypesInserted = 0;
        let inlineTagTypesUpdated = 0;
        let seriesInserted = 0;
        let seriesUpdated = 0;
        let annotationsInserted = 0;
        let annotationsUpdated = 0;
        const errors: { id: string; type: string; error: string }[] = [];

        const importTransaction = db.transaction(() => {
          const now = new Date().toISOString();

          // Import inline tag types first
          if (inlineTagTypes && Array.isArray(inlineTagTypes)) {
            for (const tagType of inlineTagTypes) {
              try {
                const existing = checkInlineTagTypeStmt.get(tagType.id);
                if (existing) {
                  updateInlineTagTypeStmt.run(tagType.name, tagType.color, tagType.icon ?? null, tagType.sortOrder ?? 0, tagType.id);
                  inlineTagTypesUpdated++;
                } else {
                  insertInlineTagTypeStmt.run(
                    tagType.id,
                    tagType.name,
                    tagType.color,
                    tagType.icon ?? null,
                    tagType.isDefault ? 1 : 0,
                    tagType.sortOrder ?? 0,
                    tagType.createdAt ?? now
                  );
                  inlineTagTypesInserted++;
                }
              } catch (e) {
                errors.push({ id: tagType.id, type: 'inlineTagType', error: String(e) });
              }
            }
          }

          // Import topics (order matters for parent references)
          if (topics && Array.isArray(topics)) {
            for (const topic of topics) {
              try {
                const existing = checkTopicStmt.get(topic.id);
                if (existing) {
                  updateTopicStmt.run(
                    topic.name,
                    topic.parentId ?? null,
                    topic.sortOrder ?? 0,
                    topic.systematicTagId ?? null,
                    topic.updatedAt ?? now,
                    topic.id
                  );
                  topicsUpdated++;
                } else {
                  insertTopicStmt.run(
                    topic.id,
                    topic.name,
                    topic.parentId ?? null,
                    topic.sortOrder ?? 0,
                    topic.systematicTagId ?? null,
                    topic.createdAt ?? now,
                    topic.updatedAt ?? now
                  );
                  topicsInserted++;
                }
              } catch (e) {
                errors.push({ id: topic.id, type: 'topic', error: String(e) });
              }
            }
          }

          // Import series (before notes due to FK dependency)
          if (series && Array.isArray(series)) {
            for (const s of series) {
              try {
                const existing = checkSeriesStmt.get(s.id);
                if (existing) {
                  updateSeriesStmt.run(s.name, s.description ?? '', s.updatedAt ?? now, s.id);
                  seriesUpdated++;
                } else {
                  insertSeriesStmt.run(s.id, s.name, s.description ?? '', s.createdAt ?? now, s.updatedAt ?? now);
                  seriesInserted++;
                }
              } catch (e) {
                errors.push({ id: s.id, type: 'series', error: String(e) });
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
                    ann.color ?? null,
                    ann.content ?? null,
                    ann.textSelection ?? null,
                    ann.positionStart ?? null,
                    ann.positionEnd ?? null,
                    ann.updatedAt ?? now,
                    ann.id
                  );
                  annotationsUpdated++;
                } else {
                  insertAnnotationStmt.run(
                    ann.id,
                    ann.systematicId,
                    ann.annotationType,
                    ann.color ?? null,
                    ann.content ?? null,
                    ann.textSelection ?? null,
                    ann.positionStart ?? null,
                    ann.positionEnd ?? null,
                    ann.createdAt ?? now,
                    ann.updatedAt ?? now
                  );
                  annotationsInserted++;
                }
              } catch (e) {
                // Ignore annotation errors (systematic_id may not exist if ST data not imported)
                errors.push({ id: ann.id, type: 'systematicAnnotation', error: String(e) });
              }
            }
          }

          // Import notes
          for (const note of notes) {
            try {
              const id = note.id || uuidv4();
              const existing = checkNoteStmt.get(id);

              if (existing) {
                updateNoteStmt.run(
                  note.book.toUpperCase(),
                  note.startChapter,
                  note.startVerse ?? null,
                  note.endChapter,
                  note.endVerse ?? null,
                  note.title ?? '',
                  note.content ?? '',
                  note.type ?? 'note',
                  note.primaryTopicId ?? null,
                  note.seriesId ?? null,
                  note.updatedAt ?? now,
                  id
                );
                notesUpdated++;
              } else {
                insertNoteStmt.run(
                  id,
                  note.book.toUpperCase(),
                  note.startChapter,
                  note.startVerse ?? null,
                  note.endChapter,
                  note.endVerse ?? null,
                  note.title ?? '',
                  note.content ?? '',
                  note.type ?? 'note',
                  note.primaryTopicId ?? null,
                  note.seriesId ?? null,
                  note.createdAt ?? now,
                  note.updatedAt ?? now
                );
                notesInserted++;
              }

              // Handle tags
              if (note.tags && Array.isArray(note.tags)) {
                deleteTagsStmt.run(id);
                for (const tagId of note.tags) {
                  try {
                    insertTagStmt.run(id, tagId);
                  } catch {
                    // Ignore tag errors (topic may not exist)
                  }
                }
              }
            } catch (e) {
              errors.push({ id: note.id || 'new', type: 'note', error: String(e) });
            }
          }
        });

        importTransaction();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  notes: { inserted: notesInserted, updated: notesUpdated, total: notesInserted + notesUpdated },
                  topics: { inserted: topicsInserted, updated: topicsUpdated, total: topicsInserted + topicsUpdated },
                  inlineTagTypes: { inserted: inlineTagTypesInserted, updated: inlineTagTypesUpdated, total: inlineTagTypesInserted + inlineTagTypesUpdated },
                  series: { inserted: seriesInserted, updated: seriesUpdated, total: seriesInserted + seriesUpdated },
                  systematicAnnotations: { inserted: annotationsInserted, updated: annotationsUpdated, total: annotationsInserted + annotationsUpdated },
                  errors: errors.length > 0 ? errors : undefined,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error importing data:', error);
        return {
          content: [{ type: 'text' as const, text: `Error importing data: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // delete_all_notes - Clear all notes (requires confirmation)
  server.tool(
    'delete_all_notes',
    'Delete ALL notes from the database. DESTRUCTIVE - requires confirm=true parameter.',
    {
      confirm: z.boolean().describe('Must be true to confirm deletion'),
    },
    async ({ confirm }) => {
      try {
        if (!confirm) {
          const count = (db.prepare('SELECT COUNT(*) as count FROM notes').get() as { count: number }).count;
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    success: false,
                    message: `This will delete ${count} notes. Set confirm=true to proceed.`,
                    noteCount: count,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const countBefore = (db.prepare('SELECT COUNT(*) as count FROM notes').get() as { count: number }).count;
        const result = db.prepare('DELETE FROM notes').run();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  message: 'All notes deleted successfully',
                  deleted: result.changes,
                  previousCount: countBefore,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error deleting all notes:', error);
        return {
          content: [{ type: 'text' as const, text: `Error deleting notes: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_last_modified - Get timestamp of most recently modified note
  server.tool(
    'get_last_modified',
    'Get the timestamp of the most recently modified note',
    {},
    async () => {
      try {
        const result = db.prepare('SELECT MAX(updated_at) as lastModified FROM notes').get() as { lastModified: string | null };
        const noteCount = (db.prepare('SELECT COUNT(*) as count FROM notes').get() as { count: number }).count;
        const topicCount = (db.prepare('SELECT COUNT(*) as count FROM topics').get() as { count: number }).count;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  lastModified: result.lastModified,
                  counts: {
                    notes: noteCount,
                    topics: topicCount,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting last modified:', error);
        return {
          content: [{ type: 'text' as const, text: `Error getting last modified: ${error}` }],
          isError: true,
        };
      }
    }
  );

  logger.info('Registered backup tools: full_export, full_import, delete_all_notes, get_last_modified');
}
