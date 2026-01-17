import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import db from '../db.js';
import { toApiFormat } from '../utils/format.js';
import { logger } from '../utils/logger.js';
/**
 * Register MCP resources for notes
 */
export function registerResources(server) {
    // Static resource: All notes
    server.resource('all-notes', 'sacred://notes/all', { description: 'All Bible study notes' }, async (uri) => {
        const notes = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all();
        return {
            contents: [
                {
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify(notes.map(toApiFormat), null, 2),
                },
            ],
        };
    });
    // Static resource: Summary statistics
    server.resource('notes-summary', 'sacred://notes/summary', { description: 'Summary statistics of Bible study notes' }, async (uri) => {
        const total = db.prepare('SELECT COUNT(*) as count FROM notes').get().count;
        const byType = db
            .prepare('SELECT type, COUNT(*) as count FROM notes GROUP BY type')
            .all();
        const byBook = db
            .prepare('SELECT book, COUNT(*) as count FROM notes GROUP BY book ORDER BY count DESC')
            .all();
        return {
            contents: [
                {
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify({
                        total,
                        byType: Object.fromEntries(byType.map((r) => [r.type, r.count])),
                        byBook: Object.fromEntries(byBook.map((r) => [r.book, r.count])),
                    }, null, 2),
                },
            ],
        };
    });
    // Template resource: Single note by ID
    server.resource('note-by-id', new ResourceTemplate('sacred://notes/{id}', { list: undefined }), { description: 'A single Bible study note by ID' }, async (uri, variables) => {
        const id = variables.id;
        const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
        if (!note) {
            return {
                contents: [
                    {
                        uri: uri.href,
                        mimeType: 'application/json',
                        text: JSON.stringify({ error: `Note not found with ID: ${id}` }),
                    },
                ],
            };
        }
        return {
            contents: [
                {
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify(toApiFormat(note), null, 2),
                },
            ],
        };
    });
    // Template resource: Notes by book
    server.resource('notes-by-book', new ResourceTemplate('sacred://notes/book/{book}', { list: undefined }), { description: 'All notes for a specific Bible book' }, async (uri, variables) => {
        const book = String(variables.book).toUpperCase();
        const notes = db
            .prepare('SELECT * FROM notes WHERE book = ? ORDER BY start_chapter, start_verse')
            .all(book);
        return {
            contents: [
                {
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify({
                        book,
                        notes: notes.map(toApiFormat),
                        count: notes.length,
                    }, null, 2),
                },
            ],
        };
    });
    // Template resource: Notes by chapter
    server.resource('notes-by-chapter', new ResourceTemplate('sacred://notes/chapter/{book}/{chapter}', { list: undefined }), { description: 'All notes for a specific Bible book and chapter' }, async (uri, variables) => {
        const book = String(variables.book).toUpperCase();
        const chapterNum = parseInt(String(variables.chapter), 10);
        const notes = db
            .prepare(`
          SELECT * FROM notes
          WHERE book = ?
            AND start_chapter <= ?
            AND end_chapter >= ?
          ORDER BY start_chapter, start_verse
        `)
            .all(book, chapterNum, chapterNum);
        return {
            contents: [
                {
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify({
                        book,
                        chapter: chapterNum,
                        notes: notes.map(toApiFormat),
                        count: notes.length,
                    }, null, 2),
                },
            ],
        };
    });
    logger.info('Registered resources: sacred://notes/all, sacred://notes/summary, and templates for single note, book, chapter');
}
