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
    // list_systematic_tags - Get doctrine category tags
    server.tool('list_systematic_tags', 'Get all systematic theology category tags (e.g., Doctrine of God, Christology)', {}, async () => {
        try {
            const tags = db
                .prepare(`
            SELECT t.*, COUNT(ct.chapter_number) as chapter_count
            FROM systematic_tags t
            LEFT JOIN systematic_chapter_tags ct ON t.id = ct.tag_id
            GROUP BY t.id
            ORDER BY t.sort_order
          `)
                .all();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            tags: tags.map((t) => ({
                                id: t.id,
                                name: t.name,
                                color: t.color,
                                sortOrder: t.sort_order,
                                chapterCount: t.chapter_count,
                            })),
                            total: tags.length,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error listing systematic tags:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // get_chapters_by_tag - Get chapters by category tag
    server.tool('get_chapters_by_tag', 'Get systematic theology chapters filtered by category tag', {
        tagId: z.string().describe('Tag ID (e.g., "doctrine-god", "doctrine-salvation")'),
    }, async ({ tagId }) => {
        try {
            const chapters = db
                .prepare(`
            SELECT st.* FROM systematic_theology st
            JOIN systematic_chapter_tags ct ON st.chapter_number = ct.chapter_number
            WHERE ct.tag_id = ? AND st.entry_type = 'chapter'
            ORDER BY st.chapter_number
          `)
                .all(tagId);
            const tag = db.prepare('SELECT * FROM systematic_tags WHERE id = ?').get(tagId);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            tag: tag ? { id: tag.id, name: tag.name, color: tag.color } : null,
                            chapters: chapters.map((c) => ({
                                ...toApiFormat(c),
                                linkSyntax: `[[ST:Ch${c.chapter_number}]]`,
                            })),
                            count: chapters.length,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting chapters by tag:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // get_systematic_chapter - Get full chapter with sections, tags, related
    server.tool('get_systematic_chapter', 'Get a complete systematic theology chapter with all sections, scripture references, related chapters, and tags', {
        chapterNumber: z.number().describe('Chapter number (1-57)'),
    }, async ({ chapterNumber }) => {
        try {
            // Get the chapter entry
            const chapter = db
                .prepare(`
            SELECT * FROM systematic_theology
            WHERE entry_type = 'chapter' AND chapter_number = ?
          `)
                .get(chapterNumber);
            if (!chapter) {
                return {
                    content: [{ type: 'text', text: `Chapter ${chapterNumber} not found` }],
                    isError: true,
                };
            }
            // Get all sections and subsections for this chapter
            const sections = db
                .prepare(`
            SELECT * FROM systematic_theology
            WHERE chapter_number = ? AND entry_type IN ('section', 'subsection')
            ORDER BY sort_order
          `)
                .all(chapterNumber);
            // Get scripture references for this chapter
            const scriptureRefs = db
                .prepare(`
            SELECT ssi.* FROM systematic_scripture_index ssi
            JOIN systematic_theology st ON ssi.systematic_id = st.id
            WHERE st.chapter_number = ?
            ORDER BY ssi.is_primary DESC, ssi.book, ssi.chapter, ssi.start_verse
          `)
                .all(chapterNumber);
            // Get related chapters
            const related = db
                .prepare(`
            SELECT sr.*, st.title as target_title
            FROM systematic_related sr
            JOIN systematic_theology st ON sr.target_chapter = st.chapter_number AND st.entry_type = 'chapter'
            WHERE sr.source_chapter = ?
          `)
                .all(chapterNumber);
            // Get tags for this chapter
            const tags = db
                .prepare(`
            SELECT t.* FROM systematic_tags t
            JOIN systematic_chapter_tags ct ON t.id = ct.tag_id
            WHERE ct.chapter_number = ?
          `)
                .all(chapterNumber);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            ...toApiFormat(chapter),
                            linkSyntax: `[[ST:Ch${chapterNumber}]]`,
                            sections: sections.map((s) => ({
                                ...toApiFormat(s),
                                linkSyntax: s.subsection_number
                                    ? `[[ST:Ch${chapterNumber}:${s.section_letter}.${s.subsection_number}]]`
                                    : `[[ST:Ch${chapterNumber}:${s.section_letter}]]`,
                            })),
                            scriptureReferences: scriptureRefs.map((r) => ({
                                book: r.book,
                                chapter: r.chapter,
                                startVerse: r.start_verse,
                                endVerse: r.end_verse,
                                isPrimary: r.is_primary === 1,
                                contextSnippet: r.context_snippet,
                            })),
                            relatedChapters: related.map((r) => ({
                                chapterNumber: r.target_chapter,
                                title: r.target_title,
                                relationshipType: r.relationship_type,
                                linkSyntax: `[[ST:Ch${r.target_chapter}]]`,
                            })),
                            tags: tags.map((t) => ({
                                id: t.id,
                                name: t.name,
                                color: t.color,
                            })),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting systematic chapter:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // add_systematic_annotation - Add highlight or note annotation
    server.tool('add_systematic_annotation', 'Add a highlight or note annotation to a systematic theology entry', {
        systematicId: z.string().describe('The UUID of the systematic theology entry'),
        annotationType: z.enum(['highlight', 'note']).describe('Type of annotation'),
        color: z.string().optional().describe('Highlight color (yellow, green, blue, pink)'),
        content: z.string().optional().describe("User's note text (for note type)"),
        textSelection: z.string().optional().describe('The selected text being annotated'),
        positionStart: z.number().optional().describe('Character position start'),
        positionEnd: z.number().optional().describe('Character position end'),
    }, async ({ systematicId, annotationType, color, content, textSelection, positionStart, positionEnd }) => {
        try {
            // Verify systematic entry exists
            const entry = db.prepare('SELECT id, title FROM systematic_theology WHERE id = ?').get(systematicId);
            if (!entry) {
                return {
                    content: [{ type: 'text', text: `Systematic theology entry not found: ${systematicId}` }],
                    isError: true,
                };
            }
            const id = require('uuid').v4();
            const now = new Date().toISOString();
            db.prepare(`
          INSERT INTO systematic_annotations (
            id, systematic_id, annotation_type, color, content, text_selection,
            position_start, position_end, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, systematicId, annotationType, color ?? null, content ?? null, textSelection ?? null, positionStart ?? null, positionEnd ?? null, now, now);
            const annotation = db.prepare('SELECT * FROM systematic_annotations WHERE id = ?').get(id);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Annotation created successfully',
                            annotation: {
                                id: annotation.id,
                                systematicId: annotation.systematic_id,
                                annotationType: annotation.annotation_type,
                                color: annotation.color,
                                content: annotation.content,
                                textSelection: annotation.text_selection,
                                positionStart: annotation.position_start,
                                positionEnd: annotation.position_end,
                                createdAt: annotation.created_at,
                                updatedAt: annotation.updated_at,
                            },
                            entry: { id: entry.id, title: entry.title },
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error creating annotation:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // get_systematic_annotations - Get annotations for an entry
    server.tool('get_systematic_annotations', 'Get all annotations (highlights and notes) for a systematic theology entry', {
        systematicId: z.string().describe('The UUID of the systematic theology entry'),
    }, async ({ systematicId }) => {
        try {
            const annotations = db
                .prepare(`
            SELECT * FROM systematic_annotations
            WHERE systematic_id = ?
            ORDER BY position_start, created_at
          `)
                .all(systematicId);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            systematicId,
                            annotations: annotations.map((a) => ({
                                id: a.id,
                                systematicId: a.systematic_id,
                                annotationType: a.annotation_type,
                                color: a.color,
                                content: a.content,
                                textSelection: a.text_selection,
                                positionStart: a.position_start,
                                positionEnd: a.position_end,
                                createdAt: a.created_at,
                                updatedAt: a.updated_at,
                            })),
                            count: annotations.length,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting annotations:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // delete_systematic_annotation - Delete an annotation
    server.tool('delete_systematic_annotation', 'Delete a systematic theology annotation by ID', {
        annotationId: z.string().describe('The UUID of the annotation to delete'),
    }, async ({ annotationId }) => {
        try {
            const existing = db.prepare('SELECT * FROM systematic_annotations WHERE id = ?').get(annotationId);
            if (!existing) {
                return {
                    content: [{ type: 'text', text: `Annotation not found: ${annotationId}` }],
                    isError: true,
                };
            }
            db.prepare('DELETE FROM systematic_annotations WHERE id = ?').run(annotationId);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Annotation deleted successfully',
                            deletedAnnotation: {
                                id: existing.id,
                                systematicId: existing.systematic_id,
                                annotationType: existing.annotation_type,
                            },
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error deleting annotation:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // get_referencing_notes - Get notes that link to a doctrine entry
    server.tool('get_referencing_notes', 'Get all notes that contain links to a specific systematic theology entry', {
        systematicId: z.string().describe('The UUID of the systematic theology entry'),
    }, async ({ systematicId }) => {
        try {
            // Get the entry to find its chapter number
            const entry = db.prepare('SELECT chapter_number, section_letter, subsection_number, title FROM systematic_theology WHERE id = ?').get(systematicId);
            if (!entry) {
                return {
                    content: [{ type: 'text', text: `Entry not found: ${systematicId}` }],
                    isError: true,
                };
            }
            // Build the link pattern to search for in notes
            let linkPattern;
            if (entry.subsection_number) {
                linkPattern = `[[ST:Ch${entry.chapter_number}:${entry.section_letter}.${entry.subsection_number}]]`;
            }
            else if (entry.section_letter) {
                linkPattern = `[[ST:Ch${entry.chapter_number}:${entry.section_letter}]]`;
            }
            else if (entry.chapter_number) {
                linkPattern = `[[ST:Ch${entry.chapter_number}]]`;
            }
            else {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({ entry: { id: systematicId, title: entry.title }, notes: [], count: 0 }, null, 2),
                        },
                    ],
                };
            }
            // Search notes for this link pattern
            const notes = db
                .prepare(`
            SELECT * FROM notes
            WHERE content LIKE ?
            ORDER BY updated_at DESC
          `)
                .all(`%${linkPattern}%`);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            entry: { id: systematicId, title: entry.title, linkPattern },
                            notes: notes.map((n) => ({
                                id: n.id,
                                book: n.book,
                                startChapter: n.start_chapter,
                                startVerse: n.start_verse,
                                endChapter: n.end_chapter,
                                endVerse: n.end_verse,
                                title: n.title,
                                type: n.type,
                                updatedAt: n.updated_at,
                            })),
                            count: notes.length,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting referencing notes:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // export_systematic_theology - Export all systematic theology data
    server.tool('export_systematic_theology', 'Export all systematic theology data as JSON (entries, scripture index, tags, related chapters)', {}, async () => {
        try {
            // Fetch all data from each table
            const entries = db.prepare('SELECT * FROM systematic_theology ORDER BY sort_order').all();
            const scriptureIndex = db.prepare('SELECT * FROM systematic_scripture_index').all();
            const tags = db.prepare('SELECT * FROM systematic_tags ORDER BY sort_order').all();
            const chapterTags = db.prepare('SELECT * FROM systematic_chapter_tags').all();
            const related = db.prepare('SELECT * FROM systematic_related').all();
            const annotations = db.prepare('SELECT * FROM systematic_annotations').all();
            const exportData = {
                version: 1,
                exportedAt: new Date().toISOString(),
                systematic_theology: entries.map((e) => ({
                    id: e.id,
                    entry_type: e.entry_type,
                    part_number: e.part_number,
                    chapter_number: e.chapter_number,
                    section_letter: e.section_letter,
                    subsection_number: e.subsection_number,
                    title: e.title,
                    content: e.content,
                    summary: e.summary,
                    parent_id: e.parent_id,
                    sort_order: e.sort_order,
                    word_count: e.word_count,
                    created_at: e.created_at,
                    updated_at: e.updated_at,
                })),
                scripture_index: scriptureIndex.map((s) => ({
                    id: s.id,
                    systematic_id: s.systematic_id,
                    book: s.book,
                    chapter: s.chapter,
                    start_verse: s.start_verse,
                    end_verse: s.end_verse,
                    is_primary: s.is_primary,
                    context_snippet: s.context_snippet,
                    created_at: s.created_at,
                })),
                tags: tags.map((t) => ({
                    id: t.id,
                    name: t.name,
                    color: t.color,
                    sort_order: t.sort_order,
                    created_at: t.created_at,
                })),
                chapter_tags: chapterTags.map((ct) => ({
                    chapter_number: ct.chapter_number,
                    tag_id: ct.tag_id,
                })),
                related: related.map((r) => ({
                    id: r.id,
                    source_chapter: r.source_chapter,
                    target_chapter: r.target_chapter,
                    relationship_type: r.relationship_type,
                    note: r.note,
                    created_at: r.created_at,
                })),
                annotations: annotations.map((a) => ({
                    id: a.id,
                    systematic_id: a.systematic_id,
                    annotation_type: a.annotation_type,
                    color: a.color,
                    content: a.content,
                    text_selection: a.text_selection,
                    position_start: a.position_start,
                    position_end: a.position_end,
                    created_at: a.created_at,
                    updated_at: a.updated_at,
                })),
                statistics: {
                    entries: entries.length,
                    scriptureReferences: scriptureIndex.length,
                    tags: tags.length,
                    annotations: annotations.length,
                },
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
            logger.error('Error exporting systematic theology:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    logger.info('Registered systematic theology tools: search_systematic_theology, get_systematic_section, find_doctrines_for_passage, summarize_doctrine_for_sermon, extract_doctrines_from_note, explain_doctrine_simply, get_systematic_summary, list_systematic_tags, get_chapters_by_tag, get_systematic_chapter, add_systematic_annotation, get_systematic_annotations, delete_systematic_annotation, get_referencing_notes, export_systematic_theology');
}
