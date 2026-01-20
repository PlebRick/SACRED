import { z } from 'zod';
import db from '../db.js';
import { logger } from '../utils/logger.js';
/**
 * Convert database row to API format
 */
const toApiFormat = (row) => ({
    id: row.id,
    entryType: row.entry_type,
    partNumber: row.part_number,
    chapterNumber: row.chapter_number,
    sectionLetter: row.section_letter,
    subsectionNumber: row.subsection_number,
    title: row.title,
    content: row.content,
    summary: row.summary,
    parentId: row.parent_id,
    sortOrder: row.sort_order,
    wordCount: row.word_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});
/**
 * Register systematic theology tools for MCP
 */
export function registerSystematicTools(server) {
    // search_systematic_theology - Full-text search
    server.tool('search_systematic_theology', 'Search systematic theology content by keyword using full-text search', {
        query: z.string().describe('Search query (supports FTS5 syntax)'),
        limit: z.number().optional().describe('Maximum results (default: 20)'),
    }, async ({ query, limit = 20 }) => {
        try {
            const results = db
                .prepare(`
            SELECT st.*, snippet(systematic_theology_fts, 1, '<mark>', '</mark>', '...', 30) as snippet
            FROM systematic_theology st
            JOIN systematic_theology_fts fts ON st.rowid = fts.rowid
            WHERE systematic_theology_fts MATCH ?
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
                                snippet: r.snippet,
                            })),
                            count: results.length,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error searching systematic theology:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // get_systematic_section - Get specific section
    server.tool('get_systematic_section', 'Get a specific systematic theology entry by ID or reference (e.g., "Ch32", "Ch32:A", "Ch32:A.1")', {
        reference: z.string().describe('Entry ID (UUID) or reference like "Ch32", "Ch32:A", "Ch32:A.1"'),
    }, async ({ reference }) => {
        try {
            let entry;
            // Check if it's a UUID
            if (reference.match(/^[0-9a-f-]{36}$/i)) {
                entry = db.prepare('SELECT * FROM systematic_theology WHERE id = ?').get(reference);
            }
            else {
                // Parse reference format: Ch32, Ch32:A, Ch32:A.1
                const match = reference.match(/^Ch(\d+)(?::([A-Z])(?:\.(\d+))?)?$/i);
                if (match) {
                    const [, chapterNum, sectionLetter, subsectionNum] = match;
                    if (subsectionNum) {
                        entry = db
                            .prepare(`
                  SELECT * FROM systematic_theology
                  WHERE chapter_number = ? AND section_letter = ? AND subsection_number = ?
                `)
                            .get(parseInt(chapterNum, 10), sectionLetter.toUpperCase(), parseInt(subsectionNum, 10));
                    }
                    else if (sectionLetter) {
                        entry = db
                            .prepare(`
                  SELECT * FROM systematic_theology
                  WHERE chapter_number = ? AND section_letter = ? AND subsection_number IS NULL
                `)
                            .get(parseInt(chapterNum, 10), sectionLetter.toUpperCase());
                    }
                    else {
                        entry = db
                            .prepare(`
                  SELECT * FROM systematic_theology
                  WHERE chapter_number = ? AND entry_type = 'chapter'
                `)
                            .get(parseInt(chapterNum, 10));
                    }
                }
            }
            if (!entry) {
                return {
                    content: [{ type: 'text', text: `Entry not found: ${reference}` }],
                    isError: true,
                };
            }
            // Get children
            const children = db
                .prepare('SELECT * FROM systematic_theology WHERE parent_id = ? ORDER BY sort_order')
                .all(entry.id);
            // Get scripture references
            const scriptureRefs = db
                .prepare(`
            SELECT * FROM systematic_scripture_index
            WHERE systematic_id = ?
            ORDER BY is_primary DESC, book, chapter, start_verse
          `)
                .all(entry.id);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            ...toApiFormat(entry),
                            children: children.map(toApiFormat),
                            scriptureReferences: scriptureRefs.map((r) => ({
                                book: r.book,
                                chapter: r.chapter,
                                startVerse: r.start_verse,
                                endVerse: r.end_verse,
                                isPrimary: r.is_primary === 1,
                                contextSnippet: r.context_snippet,
                            })),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting systematic section:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // find_doctrines_for_passage - Find doctrines for a Bible passage
    server.tool('find_doctrines_for_passage', 'Find systematic theology doctrines that reference a specific Bible passage', {
        book: z.string().describe('3-letter book code (e.g., "JHN", "ROM", "EPH")'),
        chapter: z.number().describe('Chapter number'),
        verse: z.number().optional().describe('Optional verse number for more specific results'),
    }, async ({ book, chapter, verse }) => {
        try {
            let query;
            let params;
            if (verse) {
                query = `
            SELECT DISTINCT st.*, ssi.is_primary, ssi.context_snippet
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ?
              AND ssi.chapter = ?
              AND (ssi.start_verse <= ? AND (ssi.end_verse >= ? OR ssi.end_verse IS NULL))
            ORDER BY ssi.is_primary DESC, st.chapter_number, st.sort_order
          `;
                params = [book.toUpperCase(), chapter, verse, verse];
            }
            else {
                query = `
            SELECT DISTINCT st.*, ssi.is_primary, ssi.context_snippet
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ? AND ssi.chapter = ?
            ORDER BY ssi.is_primary DESC, st.chapter_number, st.sort_order
          `;
                params = [book.toUpperCase(), chapter];
            }
            const results = db.prepare(query).all(...params);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            passage: verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`,
                            doctrines: results.map((r) => ({
                                ...toApiFormat(r),
                                isPrimary: r.is_primary === 1,
                                contextSnippet: r.context_snippet,
                            })),
                            count: results.length,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error finding doctrines for passage:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // summarize_doctrine_for_sermon - Contextual summary for sermon prep
    server.tool('summarize_doctrine_for_sermon', 'Get a doctrine summary formatted for sermon preparation, including key points and scriptures', {
        chapterNumber: z.number().describe('Chapter number (1-57)'),
    }, async ({ chapterNumber }) => {
        try {
            // Get chapter
            const chapter = db
                .prepare(`
            SELECT * FROM systematic_theology
            WHERE chapter_number = ? AND entry_type = 'chapter'
          `)
                .get(chapterNumber);
            if (!chapter) {
                return {
                    content: [{ type: 'text', text: `Chapter ${chapterNumber} not found` }],
                    isError: true,
                };
            }
            // Get sections
            const sections = db
                .prepare(`
            SELECT * FROM systematic_theology
            WHERE chapter_number = ? AND entry_type = 'section'
            ORDER BY sort_order
          `)
                .all(chapterNumber);
            // Get primary scripture references
            const primaryScriptures = db
                .prepare(`
            SELECT DISTINCT ssi.* FROM systematic_scripture_index ssi
            JOIN systematic_theology st ON ssi.systematic_id = st.id
            WHERE st.chapter_number = ? AND ssi.is_primary = 1
            ORDER BY ssi.book, ssi.chapter, ssi.start_verse
            LIMIT 10
          `)
                .all(chapterNumber);
            // Get related chapters
            const related = db
                .prepare(`
            SELECT sr.target_chapter, st.title
            FROM systematic_related sr
            JOIN systematic_theology st ON sr.target_chapter = st.chapter_number AND st.entry_type = 'chapter'
            WHERE sr.source_chapter = ?
          `)
                .all(chapterNumber);
            // Format for sermon use
            const sermonSummary = {
                title: chapter.title,
                chapterNumber,
                summary: chapter.summary || 'No summary available',
                keyPoints: sections.map((s) => ({
                    letter: s.section_letter,
                    title: s.title,
                    summary: s.summary,
                })),
                keyScriptures: primaryScriptures.map((s) => ({
                    reference: s.end_verse
                        ? `${s.book} ${s.chapter}:${s.start_verse}-${s.end_verse}`
                        : `${s.book} ${s.chapter}:${s.start_verse}`,
                    context: s.context_snippet,
                })),
                relatedDoctrines: related.map((r) => ({
                    chapter: r.target_chapter,
                    title: r.title,
                })),
                linkSyntax: `[[ST:Ch${chapterNumber}]]`,
            };
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(sermonSummary, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error summarizing doctrine:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // extract_doctrines_from_note - Analyze note and suggest doctrines
    server.tool('extract_doctrines_from_note', 'Analyze a note\'s content and suggest related systematic theology doctrines based on its scripture references', {
        noteId: z.string().describe('The UUID of the note to analyze'),
    }, async ({ noteId }) => {
        try {
            // Get the note
            const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
            if (!note) {
                return {
                    content: [{ type: 'text', text: `Note not found: ${noteId}` }],
                    isError: true,
                };
            }
            // Find doctrines for the note's passage
            const passageDoctrines = db
                .prepare(`
            SELECT DISTINCT st.*, ssi.is_primary
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ? AND ssi.chapter = ?
            ORDER BY ssi.is_primary DESC, st.chapter_number
            LIMIT 10
          `)
                .all(note.book, note.start_chapter);
            // Extract any existing ST links in the note content
            const existingLinks = [];
            const linkRegex = /\[\[ST:Ch(\d+)(?::([A-Z])(?:\.(\d+))?)?\]\]/gi;
            let match;
            while ((match = linkRegex.exec(note.content || '')) !== null) {
                existingLinks.push(match[0]);
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            note: {
                                id: note.id,
                                title: note.title,
                                passage: `${note.book} ${note.start_chapter}`,
                            },
                            existingDoctrineLinks: existingLinks,
                            suggestedDoctrines: passageDoctrines.map((d) => ({
                                ...toApiFormat(d),
                                isPrimary: d.is_primary === 1,
                                linkSyntax: d.section_letter
                                    ? d.subsection_number
                                        ? `[[ST:Ch${d.chapter_number}:${d.section_letter}.${d.subsection_number}]]`
                                        : `[[ST:Ch${d.chapter_number}:${d.section_letter}]]`
                                    : `[[ST:Ch${d.chapter_number}]]`,
                            })),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error extracting doctrines from note:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // explain_doctrine_simply - Simplified explanation
    server.tool('explain_doctrine_simply', 'Get a simplified, jargon-free explanation of a doctrine chapter', {
        chapterNumber: z.number().describe('Chapter number (1-57)'),
    }, async ({ chapterNumber }) => {
        try {
            const chapter = db
                .prepare(`
            SELECT * FROM systematic_theology
            WHERE chapter_number = ? AND entry_type = 'chapter'
          `)
                .get(chapterNumber);
            if (!chapter) {
                return {
                    content: [{ type: 'text', text: `Chapter ${chapterNumber} not found` }],
                    isError: true,
                };
            }
            // Get sections for structure
            const sections = db
                .prepare(`
            SELECT title, summary FROM systematic_theology
            WHERE chapter_number = ? AND entry_type = 'section'
            ORDER BY sort_order
          `)
                .all(chapterNumber);
            // Return the basic information - the AI can use this to formulate a simple explanation
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            title: chapter.title,
                            chapterNumber,
                            summary: chapter.summary,
                            mainPoints: sections.map((s) => s.title),
                            instruction: 'Use the title, summary, and main points above to provide a simple, jargon-free explanation of this doctrine that would be accessible to someone new to theology.',
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error explaining doctrine:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // get_systematic_summary - Get overview statistics
    server.tool('get_systematic_summary', 'Get summary statistics about the systematic theology content', {}, async () => {
        try {
            const stats = {
                totalEntries: db.prepare('SELECT COUNT(*) as c FROM systematic_theology').get().c,
                parts: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'part'").get().c,
                chapters: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'chapter'").get().c,
                sections: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'section'").get().c,
                subsections: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'subsection'").get().c,
                scriptureReferences: db.prepare('SELECT COUNT(*) as c FROM systematic_scripture_index').get()
                    .c,
                annotations: db.prepare('SELECT COUNT(*) as c FROM systematic_annotations').get().c,
            };
            // Get chapters list
            const chapters = db
                .prepare(`
            SELECT chapter_number, title FROM systematic_theology
            WHERE entry_type = 'chapter'
            ORDER BY chapter_number
          `)
                .all();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            statistics: stats,
                            chapters: chapters.map((c) => ({
                                number: c.chapter_number,
                                title: c.title,
                                link: `[[ST:Ch${c.chapter_number}]]`,
                            })),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting systematic summary:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    logger.info('Registered systematic theology tools: search_systematic_theology, get_systematic_section, find_doctrines_for_passage, summarize_doctrine_for_sermon, extract_doctrines_from_note, explain_doctrine_simply, get_systematic_summary');
}
