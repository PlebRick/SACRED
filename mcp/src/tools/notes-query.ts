import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import db from '../db.js';
import { toApiFormat, toMetadataFormat, DbNote, DbNoteMetadata } from '../utils/format.js';
import { logger } from '../utils/logger.js';

/**
 * Register read-only query tools for notes
 */
export function registerQueryTools(server: McpServer): void {
  // list_notes - List all notes with optional pagination
  server.tool(
    'list_notes',
    'List all Bible study notes with optional pagination',
    {
      limit: z.number().optional().describe('Maximum number of notes to return (default: 100)'),
      offset: z.number().optional().describe('Number of notes to skip (default: 0)'),
    },
    async ({ limit = 100, offset = 0 }) => {
      try {
        const notes = db
          .prepare('SELECT * FROM notes ORDER BY updated_at DESC LIMIT ? OFFSET ?')
          .all(limit, offset) as DbNote[];

        const total = (db.prepare('SELECT COUNT(*) as count FROM notes').get() as { count: number }).count;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  notes: notes.map(toApiFormat),
                  total,
                  limit,
                  offset,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error listing notes:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_note - Get a single note by ID
  server.tool(
    'get_note',
    'Get a single Bible study note by its ID',
    {
      id: z.string().describe('The UUID of the note to retrieve'),
    },
    async ({ id }) => {
      try {
        const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as DbNote | undefined;

        if (!note) {
          return {
            content: [{ type: 'text' as const, text: `Note not found with ID: ${id}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(toApiFormat(note), null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting note:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_chapter_notes - Get notes for a specific book/chapter
  server.tool(
    'get_chapter_notes',
    'Get all notes that overlap with a specific book and chapter',
    {
      book: z.string().describe('3-letter book code (e.g., "JHN", "ROM", "GEN")'),
      chapter: z.number().describe('Chapter number'),
    },
    async ({ book, chapter }) => {
      try {
        const notes = db
          .prepare(
            `
            SELECT * FROM notes
            WHERE book = ?
              AND start_chapter <= ?
              AND end_chapter >= ?
            ORDER BY start_chapter, start_verse
          `
          )
          .all(book.toUpperCase(), chapter, chapter) as DbNote[];

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  book: book.toUpperCase(),
                  chapter,
                  notes: notes.map(toApiFormat),
                  count: notes.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting chapter notes:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_notes_summary - Get statistics about notes
  server.tool(
    'get_notes_summary',
    'Get summary statistics about all Bible study notes',
    {},
    async () => {
      try {
        const total = (db.prepare('SELECT COUNT(*) as count FROM notes').get() as { count: number }).count;

        const byType = db
          .prepare('SELECT type, COUNT(*) as count FROM notes GROUP BY type')
          .all() as { type: string; count: number }[];

        const byBook = db
          .prepare('SELECT book, COUNT(*) as count FROM notes GROUP BY book ORDER BY count DESC')
          .all() as { book: string; count: number }[];

        const recentlyUpdated = db
          .prepare('SELECT * FROM notes ORDER BY updated_at DESC LIMIT 5')
          .all() as DbNote[];

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  total,
                  byType: Object.fromEntries(byType.map((r) => [r.type, r.count])),
                  byBook: Object.fromEntries(byBook.map((r) => [r.book, r.count])),
                  recentlyUpdated: recentlyUpdated.map(toApiFormat),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting notes summary:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_note_metadata - Get single note without content (token-efficient)
  server.tool(
    'get_note_metadata',
    'Get note metadata without content (token-efficient). Use when you only need reference info.',
    {
      id: z.string().describe('The UUID of the note to retrieve'),
    },
    async ({ id }) => {
      try {
        const note = db
          .prepare(
            'SELECT id, book, start_chapter, start_verse, end_chapter, end_verse, title, type, primary_topic_id, created_at, updated_at FROM notes WHERE id = ?'
          )
          .get(id) as DbNoteMetadata | undefined;

        if (!note) {
          return {
            content: [{ type: 'text' as const, text: `Note not found with ID: ${id}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(toMetadataFormat(note), null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting note metadata:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // list_notes_metadata - List notes without content (token-efficient)
  server.tool(
    'list_notes_metadata',
    'List notes metadata without content (token-efficient). Supports filtering by book and type.',
    {
      book: z.string().optional().describe('Filter by 3-letter book code (e.g., "JHN", "ROM")'),
      type: z
        .enum(['note', 'commentary', 'sermon'])
        .optional()
        .describe('Filter by note type'),
      limit: z.number().optional().describe('Maximum number of notes to return (default: 50)'),
      offset: z.number().optional().describe('Number of notes to skip (default: 0)'),
    },
    async ({ book, type, limit = 50, offset = 0 }) => {
      try {
        const conditions: string[] = [];
        const params: (string | number)[] = [];

        if (book) {
          conditions.push('book = ?');
          params.push(book.toUpperCase());
        }
        if (type) {
          conditions.push('type = ?');
          params.push(type);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const notes = db
          .prepare(
            `SELECT id, book, start_chapter, start_verse, end_chapter, end_verse, title, type, primary_topic_id, created_at, updated_at
             FROM notes ${whereClause}
             ORDER BY updated_at DESC
             LIMIT ? OFFSET ?`
          )
          .all(...params, limit, offset) as DbNoteMetadata[];

        const countStmt = db.prepare(`SELECT COUNT(*) as count FROM notes ${whereClause}`);
        const total = (countStmt.get(...params) as { count: number }).count;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  notes: notes.map(toMetadataFormat),
                  total,
                  limit,
                  offset,
                  filters: { book: book?.toUpperCase(), type },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error listing notes metadata:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  logger.info(
    'Registered query tools: list_notes, get_note, get_chapter_notes, get_notes_summary, get_note_metadata, list_notes_metadata'
  );
}
