import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import db from '../db.js';
import { logger } from '../utils/logger.js';

interface DbSeries {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  sermon_count?: number;
}

interface DbSermonSummary {
  id: string;
  book: string;
  start_chapter: number;
  start_verse: number | null;
  end_chapter: number;
  end_verse: number | null;
  title: string;
  type: string;
  created_at: string;
  updated_at: string;
}

const toApiFormat = (row: DbSeries) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  sermonCount: row.sermon_count,
});

const sermonToApiFormat = (row: DbSermonSummary) => ({
  id: row.id,
  book: row.book,
  startChapter: row.start_chapter,
  startVerse: row.start_verse,
  endChapter: row.end_chapter,
  endVerse: row.end_verse,
  title: row.title,
  type: row.type,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Register MCP tools for sermon series management
 */
export function registerSeriesTools(server: McpServer): void {
  // list_series - List all series with sermon counts
  server.tool(
    'list_series',
    'List all sermon series with their sermon counts',
    {},
    async () => {
      try {
        const series = db
          .prepare(
            `
            SELECT s.*, COUNT(n.id) as sermon_count
            FROM series s
            LEFT JOIN notes n ON n.series_id = s.id AND n.type = 'sermon'
            GROUP BY s.id
            ORDER BY s.updated_at DESC
          `
          )
          .all() as DbSeries[];

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  series: series.map(toApiFormat),
                  total: series.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error listing series:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_series - Get a series with its sermons
  server.tool(
    'get_series',
    'Get a sermon series by ID with all its sermons',
    {
      id: z.string().describe('The UUID of the series'),
    },
    async ({ id }) => {
      try {
        const series = db.prepare('SELECT * FROM series WHERE id = ?').get(id) as DbSeries | undefined;

        if (!series) {
          return {
            content: [{ type: 'text' as const, text: `Series not found: ${id}` }],
            isError: true,
          };
        }

        const sermons = db
          .prepare(
            `
            SELECT id, book, start_chapter, start_verse, end_chapter, end_verse,
                   title, type, created_at, updated_at
            FROM notes
            WHERE series_id = ? AND type = 'sermon'
            ORDER BY created_at ASC
          `
          )
          .all(id) as DbSermonSummary[];

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  ...toApiFormat(series),
                  sermons: sermons.map(sermonToApiFormat),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting series:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // create_series - Create a new sermon series
  server.tool(
    'create_series',
    'Create a new sermon series',
    {
      name: z.string().describe('Name of the series'),
      description: z.string().optional().describe('Description of the series'),
    },
    async ({ name, description }) => {
      try {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        db.prepare(
          `
          INSERT INTO series (id, name, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `
        ).run(id, name.trim(), description || null, now, now);

        const created = db.prepare('SELECT * FROM series WHERE id = ?').get(id) as DbSeries;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  message: 'Series created successfully',
                  series: toApiFormat(created),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error creating series:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // add_sermon_to_series - Link a sermon to a series
  server.tool(
    'add_sermon_to_series',
    'Add a sermon to a series',
    {
      seriesId: z.string().describe('The UUID of the series'),
      noteId: z.string().describe('The UUID of the sermon note'),
    },
    async ({ seriesId, noteId }) => {
      try {
        const series = db.prepare('SELECT * FROM series WHERE id = ?').get(seriesId);
        if (!series) {
          return {
            content: [{ type: 'text' as const, text: `Series not found: ${seriesId}` }],
            isError: true,
          };
        }

        const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as { type: string } | undefined;
        if (!note) {
          return {
            content: [{ type: 'text' as const, text: `Note not found: ${noteId}` }],
            isError: true,
          };
        }

        if (note.type !== 'sermon') {
          return {
            content: [{ type: 'text' as const, text: 'Only sermon-type notes can be added to series' }],
            isError: true,
          };
        }

        const now = new Date().toISOString();

        db.prepare('UPDATE notes SET series_id = ?, updated_at = ? WHERE id = ?').run(seriesId, now, noteId);
        db.prepare('UPDATE series SET updated_at = ? WHERE id = ?').run(now, seriesId);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ success: true, message: 'Sermon added to series' }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error adding sermon to series:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // remove_sermon_from_series - Unlink a sermon from its series
  server.tool(
    'remove_sermon_from_series',
    'Remove a sermon from its series',
    {
      noteId: z.string().describe('The UUID of the sermon note'),
    },
    async ({ noteId }) => {
      try {
        const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as
          | { series_id: string | null }
          | undefined;

        if (!note) {
          return {
            content: [{ type: 'text' as const, text: `Note not found: ${noteId}` }],
            isError: true,
          };
        }

        if (!note.series_id) {
          return {
            content: [{ type: 'text' as const, text: 'Sermon is not in a series' }],
            isError: true,
          };
        }

        const now = new Date().toISOString();

        db.prepare('UPDATE series SET updated_at = ? WHERE id = ?').run(now, note.series_id);
        db.prepare('UPDATE notes SET series_id = NULL, updated_at = ? WHERE id = ?').run(now, noteId);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ success: true, message: 'Sermon removed from series' }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error removing sermon from series:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  logger.info('Registered series tools: list_series, get_series, create_series, add_sermon_to_series, remove_sermon_from_series');
}
