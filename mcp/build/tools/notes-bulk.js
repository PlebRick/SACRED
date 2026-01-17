import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { toApiFormat } from '../utils/format.js';
import { logger } from '../utils/logger.js';
/**
 * Register bulk operation tools for notes
 */
export function registerBulkTools(server) {
    // search_notes - Full-text search across notes
    server.tool('search_notes', 'Search for notes by keyword in title and content using full-text search', {
        query: z.string().describe('Search query (supports FTS5 syntax like "word1 word2" or "word1 OR word2")'),
        limit: z.number().optional().describe('Maximum number of results (default: 20)'),
    }, async ({ query, limit = 20 }) => {
        try {
            // Search using FTS5 with ranking
            const results = db
                .prepare(`
            SELECT notes.*, rank
            FROM notes_fts
            JOIN notes ON notes_fts.id = notes.id
            WHERE notes_fts MATCH ?
            ORDER BY rank
            LIMIT ?
          `)
                .all(query, limit);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            query,
                            results: results.map((r) => ({
                                ...toApiFormat(r),
                                rank: r.rank,
                            })),
                            count: results.length,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error searching notes:', error);
            return {
                content: [{ type: 'text', text: `Error searching notes: ${error}` }],
                isError: true,
            };
        }
    });
    // export_notes - Export all notes as JSON
    server.tool('export_notes', 'Export all Bible study notes as JSON (matches SACRED app backup format)', {}, async () => {
        try {
            const notes = db.prepare('SELECT * FROM notes ORDER BY created_at ASC').all();
            const exportData = {
                version: 1,
                exportedAt: new Date().toISOString(),
                notes: notes.map(toApiFormat),
            };
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(exportData, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error exporting notes:', error);
            return {
                content: [{ type: 'text', text: `Error exporting notes: ${error}` }],
                isError: true,
            };
        }
    });
    // import_notes - Import notes from JSON (upsert)
    server.tool('import_notes', 'Import Bible study notes from JSON (upsert: updates existing notes, inserts new ones)', {
        notes: z
            .array(z.object({
            id: z.string().optional().describe('Note UUID (optional, will be generated if not provided)'),
            book: z.string().describe('3-letter book code'),
            startChapter: z.number().describe('Starting chapter'),
            startVerse: z.number().nullable().optional().describe('Starting verse'),
            endChapter: z.number().describe('Ending chapter'),
            endVerse: z.number().nullable().optional().describe('Ending verse'),
            title: z.string().optional().describe('Note title'),
            content: z.string().optional().describe('Note content as HTML'),
            type: z.enum(['note', 'commentary', 'sermon']).optional().describe('Note type'),
            createdAt: z.string().optional().describe('Creation timestamp (ISO)'),
            updatedAt: z.string().optional().describe('Update timestamp (ISO)'),
        }))
            .describe('Array of notes to import'),
    }, async ({ notes }) => {
        try {
            const insertStmt = db.prepare(`
          INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
            const updateStmt = db.prepare(`
          UPDATE notes
          SET book = ?, start_chapter = ?, start_verse = ?, end_chapter = ?, end_verse = ?,
              title = ?, content = ?, type = ?, updated_at = ?
          WHERE id = ?
        `);
            const checkStmt = db.prepare('SELECT id FROM notes WHERE id = ?');
            let inserted = 0;
            let updated = 0;
            const errors = [];
            const importTransaction = db.transaction(() => {
                for (const note of notes) {
                    try {
                        const id = note.id || uuidv4();
                        const now = new Date().toISOString();
                        const existing = checkStmt.get(id);
                        if (existing) {
                            updateStmt.run(note.book.toUpperCase(), note.startChapter, note.startVerse ?? null, note.endChapter, note.endVerse ?? null, note.title ?? '', note.content ?? '', note.type ?? 'note', note.updatedAt ?? now, id);
                            updated++;
                        }
                        else {
                            insertStmt.run(id, note.book.toUpperCase(), note.startChapter, note.startVerse ?? null, note.endChapter, note.endVerse ?? null, note.title ?? '', note.content ?? '', note.type ?? 'note', note.createdAt ?? now, note.updatedAt ?? now);
                            inserted++;
                        }
                    }
                    catch (noteError) {
                        errors.push({ id: note.id || 'unknown', error: String(noteError) });
                    }
                }
            });
            importTransaction();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            inserted,
                            updated,
                            total: inserted + updated,
                            errors: errors.length > 0 ? errors : undefined,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error importing notes:', error);
            return {
                content: [{ type: 'text', text: `Error importing notes: ${error}` }],
                isError: true,
            };
        }
    });
    // get_books_with_notes - Get summary of books that have notes
    server.tool('get_books_with_notes', 'Get a summary of all Bible books that have notes, with counts', {}, async () => {
        try {
            const books = db
                .prepare(`
            SELECT
              book,
              COUNT(*) as noteCount,
              MIN(start_chapter) as firstChapter,
              MAX(end_chapter) as lastChapter
            FROM notes
            GROUP BY book
            ORDER BY
              CASE book
                WHEN 'GEN' THEN 1 WHEN 'EXO' THEN 2 WHEN 'LEV' THEN 3 WHEN 'NUM' THEN 4 WHEN 'DEU' THEN 5
                WHEN 'JOS' THEN 6 WHEN 'JDG' THEN 7 WHEN 'RUT' THEN 8 WHEN '1SA' THEN 9 WHEN '2SA' THEN 10
                WHEN '1KI' THEN 11 WHEN '2KI' THEN 12 WHEN '1CH' THEN 13 WHEN '2CH' THEN 14 WHEN 'EZR' THEN 15
                WHEN 'NEH' THEN 16 WHEN 'EST' THEN 17 WHEN 'JOB' THEN 18 WHEN 'PSA' THEN 19 WHEN 'PRO' THEN 20
                WHEN 'ECC' THEN 21 WHEN 'SNG' THEN 22 WHEN 'ISA' THEN 23 WHEN 'JER' THEN 24 WHEN 'LAM' THEN 25
                WHEN 'EZK' THEN 26 WHEN 'DAN' THEN 27 WHEN 'HOS' THEN 28 WHEN 'JOL' THEN 29 WHEN 'AMO' THEN 30
                WHEN 'OBA' THEN 31 WHEN 'JON' THEN 32 WHEN 'MIC' THEN 33 WHEN 'NAM' THEN 34 WHEN 'HAB' THEN 35
                WHEN 'ZEP' THEN 36 WHEN 'HAG' THEN 37 WHEN 'ZEC' THEN 38 WHEN 'MAL' THEN 39
                WHEN 'MAT' THEN 40 WHEN 'MRK' THEN 41 WHEN 'LUK' THEN 42 WHEN 'JHN' THEN 43 WHEN 'ACT' THEN 44
                WHEN 'ROM' THEN 45 WHEN '1CO' THEN 46 WHEN '2CO' THEN 47 WHEN 'GAL' THEN 48 WHEN 'EPH' THEN 49
                WHEN 'PHP' THEN 50 WHEN 'COL' THEN 51 WHEN '1TH' THEN 52 WHEN '2TH' THEN 53 WHEN '1TI' THEN 54
                WHEN '2TI' THEN 55 WHEN 'TIT' THEN 56 WHEN 'PHM' THEN 57 WHEN 'HEB' THEN 58 WHEN 'JAS' THEN 59
                WHEN '1PE' THEN 60 WHEN '2PE' THEN 61 WHEN '1JN' THEN 62 WHEN '2JN' THEN 63 WHEN '3JN' THEN 64
                WHEN 'JUD' THEN 65 WHEN 'REV' THEN 66
                ELSE 99
              END
          `)
                .all();
            const total = books.reduce((sum, b) => sum + b.noteCount, 0);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            books,
                            totalBooks: books.length,
                            totalNotes: total,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting books with notes:', error);
            return {
                content: [{ type: 'text', text: `Error getting books: ${error}` }],
                isError: true,
            };
        }
    });
    logger.info('Registered bulk tools: search_notes, export_notes, import_notes, get_books_with_notes');
}
