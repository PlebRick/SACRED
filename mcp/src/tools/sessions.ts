import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import db from '../db.js';
import { logger } from '../utils/logger.js';

interface DbSession {
  id: string;
  session_type: string;
  reference_id: string;
  reference_label: string | null;
  duration_seconds: number | null;
  created_at: string;
}

const toApiFormat = (row: DbSession) => ({
  id: row.id,
  sessionType: row.session_type,
  referenceId: row.reference_id,
  referenceLabel: row.reference_label,
  durationSeconds: row.duration_seconds,
  createdAt: row.created_at,
});

/**
 * Register MCP tools for study session tracking
 */
export function registerSessionTools(server: McpServer): void {
  // get_recent_sessions - Get recent study sessions
  server.tool(
    'get_recent_sessions',
    'Get recent study sessions to understand what the user has been studying',
    {
      limit: z.number().optional().describe('Maximum number of sessions to return (default: 50)'),
      offset: z.number().optional().describe('Number of sessions to skip (default: 0)'),
      type: z
        .enum(['bible', 'doctrine', 'note'])
        .optional()
        .describe('Filter by session type'),
      days: z.number().optional().describe('Only include sessions from the last N days'),
    },
    async ({ limit = 50, offset = 0, type, days }) => {
      try {
        let sql = 'SELECT * FROM study_sessions WHERE 1=1';
        const params: (string | number)[] = [];

        if (type) {
          sql += ' AND session_type = ?';
          params.push(type);
        }

        if (days) {
          sql += ` AND created_at >= datetime('now', '-${days} days')`;
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const sessions = db.prepare(sql).all(...params) as DbSession[];

        // Get total count
        let countSql = 'SELECT COUNT(*) as count FROM study_sessions WHERE 1=1';
        const countParams: (string | number)[] = [];

        if (type) {
          countSql += ' AND session_type = ?';
          countParams.push(type);
        }

        if (days) {
          countSql += ` AND created_at >= datetime('now', '-${days} days')`;
        }

        const { count: total } = db.prepare(countSql).get(...countParams) as { count: number };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  sessions: sessions.map(toApiFormat),
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
        logger.error('Error getting recent sessions:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_study_summary - Get aggregated study statistics
  server.tool(
    'get_study_summary',
    'Get summary statistics about what the user has been studying (most viewed books, doctrines, notes)',
    {
      days: z.number().optional().describe('Number of days to include (default: 30)'),
    },
    async ({ days = 30 }) => {
      try {
        // Total sessions by type
        const byType = db
          .prepare(
            `
            SELECT session_type as type, COUNT(*) as count
            FROM study_sessions
            WHERE created_at >= datetime('now', '-${days} days')
            GROUP BY session_type
          `
          )
          .all() as { type: string; count: number }[];

        // Most studied Bible chapters
        const topBibleChapters = db
          .prepare(
            `
            SELECT reference_id as referenceId, reference_label as referenceLabel, COUNT(*) as count
            FROM study_sessions
            WHERE session_type = 'bible' AND created_at >= datetime('now', '-${days} days')
            GROUP BY reference_id
            ORDER BY count DESC
            LIMIT 10
          `
          )
          .all() as { referenceId: string; referenceLabel: string | null; count: number }[];

        // Most viewed doctrines
        const topDoctrines = db
          .prepare(
            `
            SELECT reference_id as referenceId, reference_label as referenceLabel, COUNT(*) as count
            FROM study_sessions
            WHERE session_type = 'doctrine' AND created_at >= datetime('now', '-${days} days')
            GROUP BY reference_id
            ORDER BY count DESC
            LIMIT 10
          `
          )
          .all() as { referenceId: string; referenceLabel: string | null; count: number }[];

        // Most accessed notes
        const topNotes = db
          .prepare(
            `
            SELECT reference_id as referenceId, reference_label as referenceLabel, COUNT(*) as count
            FROM study_sessions
            WHERE session_type = 'note' AND created_at >= datetime('now', '-${days} days')
            GROUP BY reference_id
            ORDER BY count DESC
            LIMIT 10
          `
          )
          .all() as { referenceId: string; referenceLabel: string | null; count: number }[];

        // Unique references studied
        const uniqueCounts = db
          .prepare(
            `
            SELECT
              session_type as type,
              COUNT(DISTINCT reference_id) as uniqueCount
            FROM study_sessions
            WHERE created_at >= datetime('now', '-${days} days')
            GROUP BY session_type
          `
          )
          .all() as { type: string; uniqueCount: number }[];

        // Daily activity
        const dailyActivity = db
          .prepare(
            `
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM study_sessions
            WHERE created_at >= datetime('now', '-7 days')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
          `
          )
          .all() as { date: string; count: number }[];

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  period: { days },
                  totalByType: Object.fromEntries(byType.map((r) => [r.type, r.count])),
                  uniqueByType: Object.fromEntries(uniqueCounts.map((r) => [r.type, r.uniqueCount])),
                  topBibleChapters,
                  topDoctrines,
                  topNotes,
                  dailyActivity,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting study summary:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // find_related_sessions - Find sessions related to a topic/passage
  server.tool(
    'find_related_sessions',
    'Find study sessions related to a specific Bible book, chapter, or doctrine',
    {
      book: z.string().optional().describe('3-letter Bible book code (e.g., "ROM", "JHN")'),
      doctrineChapter: z
        .number()
        .optional()
        .describe('Doctrine chapter number to find related sessions'),
      limit: z.number().optional().describe('Maximum results (default: 20)'),
    },
    async ({ book, doctrineChapter, limit = 20 }) => {
      try {
        const results: DbSession[] = [];

        if (book) {
          // Find sessions for the same Bible book
          const biblePattern = `${book.toUpperCase()}:%`;
          const bibleSessions = db
            .prepare(
              `
              SELECT * FROM study_sessions
              WHERE session_type = 'bible' AND reference_id LIKE ?
              ORDER BY created_at DESC
              LIMIT ?
            `
            )
            .all(biblePattern, limit) as DbSession[];
          results.push(...bibleSessions);
        }

        if (doctrineChapter) {
          // Find sessions for the specified doctrine chapter
          const doctrinePattern = `ch${doctrineChapter}%`;
          const doctrineSessions = db
            .prepare(
              `
              SELECT * FROM study_sessions
              WHERE session_type = 'doctrine' AND reference_id LIKE ?
              ORDER BY created_at DESC
              LIMIT ?
            `
            )
            .all(doctrinePattern, limit) as DbSession[];
          results.push(...doctrineSessions);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  sessions: results.map(toApiFormat),
                  count: results.length,
                  filters: { book, doctrineChapter },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error finding related sessions:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_last_studied - Get the most recent session for a specific reference
  server.tool(
    'get_last_studied',
    'Get when the user last studied a specific Bible chapter, doctrine, or note',
    {
      referenceId: z
        .string()
        .describe('Reference ID (e.g., "JHN:3" for John 3, "ch32" for doctrine chapter 32)'),
    },
    async ({ referenceId }) => {
      try {
        const session = db
          .prepare(
            `
            SELECT * FROM study_sessions
            WHERE reference_id = ?
            ORDER BY created_at DESC
            LIMIT 1
          `
          )
          .get(referenceId) as DbSession | undefined;

        if (!session) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    found: false,
                    message: `No study session found for reference: ${referenceId}`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Count total times studied
        const { count } = db
          .prepare('SELECT COUNT(*) as count FROM study_sessions WHERE reference_id = ?')
          .get(referenceId) as { count: number };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  found: true,
                  lastSession: toApiFormat(session),
                  totalTimesStudied: count,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting last studied:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  logger.info(
    'Registered session tools: get_recent_sessions, get_study_summary, find_related_sessions, get_last_studied'
  );
}
