import { z } from 'zod';
import db from '../db.js';
import { toApiFormat } from '../utils/format.js';
import { logger } from '../utils/logger.js';
/**
 * Register read-only query tools for notes
 */
export function registerQueryTools(server) {
    // list_notes - List all notes with optional pagination
    server.tool('list_notes', 'List all Bible study notes with optional pagination', {
        limit: z.number().optional().describe('Maximum number of notes to return (default: 100)'),
        offset: z.number().optional().describe('Number of notes to skip (default: 0)'),
    }, async ({ limit = 100, offset = 0 }) => {
        try {
            const notes = db
                .prepare('SELECT * FROM notes ORDER BY updated_at DESC LIMIT ? OFFSET ?')
                .all(limit, offset);
            const total = db.prepare('SELECT COUNT(*) as count FROM notes').get().count;
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            notes: notes.map(toApiFormat),
                            total,
                            limit,
                            offset,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error listing notes:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // get_note - Get a single note by ID
    server.tool('get_note', 'Get a single Bible study note by its ID', {
        id: z.string().describe('The UUID of the note to retrieve'),
    }, async ({ id }) => {
        try {
            const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
            if (!note) {
                return {
                    content: [{ type: 'text', text: `Note not found with ID: ${id}` }],
                    isError: true,
                };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(toApiFormat(note), null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting note:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // get_chapter_notes - Get notes for a specific book/chapter
    server.tool('get_chapter_notes', 'Get all notes that overlap with a specific book and chapter', {
        book: z.string().describe('3-letter book code (e.g., "JHN", "ROM", "GEN")'),
        chapter: z.number().describe('Chapter number'),
    }, async ({ book, chapter }) => {
        try {
            const notes = db
                .prepare(`
            SELECT * FROM notes
            WHERE book = ?
              AND start_chapter <= ?
              AND end_chapter >= ?
            ORDER BY start_chapter, start_verse
          `)
                .all(book.toUpperCase(), chapter, chapter);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            book: book.toUpperCase(),
                            chapter,
                            notes: notes.map(toApiFormat),
                            count: notes.length,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting chapter notes:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // get_notes_summary - Get statistics about notes
    server.tool('get_notes_summary', 'Get summary statistics about all Bible study notes', {}, async () => {
        try {
            const total = db.prepare('SELECT COUNT(*) as count FROM notes').get().count;
            const byType = db
                .prepare('SELECT type, COUNT(*) as count FROM notes GROUP BY type')
                .all();
            const byBook = db
                .prepare('SELECT book, COUNT(*) as count FROM notes GROUP BY book ORDER BY count DESC')
                .all();
            const recentlyUpdated = db
                .prepare('SELECT * FROM notes ORDER BY updated_at DESC LIMIT 5')
                .all();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            total,
                            byType: Object.fromEntries(byType.map((r) => [r.type, r.count])),
                            byBook: Object.fromEntries(byBook.map((r) => [r.book, r.count])),
                            recentlyUpdated: recentlyUpdated.map(toApiFormat),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting notes summary:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    logger.info('Registered query tools: list_notes, get_note, get_chapter_notes, get_notes_summary');
}
