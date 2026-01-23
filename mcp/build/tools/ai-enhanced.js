import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { toApiFormat, topicToApiFormat, inlineTagToApiFormat } from '../utils/format.js';
import { logger } from '../utils/logger.js';
/**
 * Bible book name to 3-letter code mapping
 */
const BOOK_CODES = {
    genesis: 'GEN', gen: 'GEN',
    exodus: 'EXO', exo: 'EXO', exod: 'EXO',
    leviticus: 'LEV', lev: 'LEV',
    numbers: 'NUM', num: 'NUM',
    deuteronomy: 'DEU', deut: 'DEU', deu: 'DEU',
    joshua: 'JOS', josh: 'JOS', jos: 'JOS',
    judges: 'JDG', judg: 'JDG', jdg: 'JDG',
    ruth: 'RUT', rut: 'RUT',
    '1 samuel': '1SA', '1samuel': '1SA', '1sam': '1SA', '1sa': '1SA',
    '2 samuel': '2SA', '2samuel': '2SA', '2sam': '2SA', '2sa': '2SA',
    '1 kings': '1KI', '1kings': '1KI', '1ki': '1KI',
    '2 kings': '2KI', '2kings': '2KI', '2ki': '2KI',
    '1 chronicles': '1CH', '1chronicles': '1CH', '1chr': '1CH', '1ch': '1CH',
    '2 chronicles': '2CH', '2chronicles': '2CH', '2chr': '2CH', '2ch': '2CH',
    ezra: 'EZR', ezr: 'EZR',
    nehemiah: 'NEH', neh: 'NEH',
    esther: 'EST', esth: 'EST', est: 'EST',
    job: 'JOB',
    psalms: 'PSA', psalm: 'PSA', psa: 'PSA', ps: 'PSA',
    proverbs: 'PRO', prov: 'PRO', pro: 'PRO',
    ecclesiastes: 'ECC', eccl: 'ECC', ecc: 'ECC',
    'song of solomon': 'SNG', 'song of songs': 'SNG', songofsolomon: 'SNG', song: 'SNG', sng: 'SNG', sos: 'SNG',
    isaiah: 'ISA', isa: 'ISA',
    jeremiah: 'JER', jer: 'JER',
    lamentations: 'LAM', lam: 'LAM',
    ezekiel: 'EZK', ezek: 'EZK', eze: 'EZK', ezk: 'EZK',
    daniel: 'DAN', dan: 'DAN',
    hosea: 'HOS', hos: 'HOS',
    joel: 'JOL', jol: 'JOL',
    amos: 'AMO', amo: 'AMO',
    obadiah: 'OBA', obad: 'OBA', oba: 'OBA',
    jonah: 'JON', jon: 'JON',
    micah: 'MIC', mic: 'MIC',
    nahum: 'NAM', nah: 'NAM', nam: 'NAM',
    habakkuk: 'HAB', hab: 'HAB',
    zephaniah: 'ZEP', zeph: 'ZEP', zep: 'ZEP',
    haggai: 'HAG', hag: 'HAG',
    zechariah: 'ZEC', zech: 'ZEC', zec: 'ZEC',
    malachi: 'MAL', mal: 'MAL',
    matthew: 'MAT', matt: 'MAT', mat: 'MAT',
    mark: 'MRK', mrk: 'MRK',
    luke: 'LUK', luk: 'LUK',
    john: 'JHN', jhn: 'JHN', jn: 'JHN',
    acts: 'ACT', act: 'ACT',
    romans: 'ROM', rom: 'ROM',
    '1 corinthians': '1CO', '1corinthians': '1CO', '1cor': '1CO', '1co': '1CO',
    '2 corinthians': '2CO', '2corinthians': '2CO', '2cor': '2CO', '2co': '2CO',
    galatians: 'GAL', gal: 'GAL',
    ephesians: 'EPH', eph: 'EPH',
    philippians: 'PHP', phil: 'PHP', php: 'PHP',
    colossians: 'COL', col: 'COL',
    '1 thessalonians': '1TH', '1thessalonians': '1TH', '1thess': '1TH', '1th': '1TH',
    '2 thessalonians': '2TH', '2thessalonians': '2TH', '2thess': '2TH', '2th': '2TH',
    '1 timothy': '1TI', '1timothy': '1TI', '1tim': '1TI', '1ti': '1TI',
    '2 timothy': '2TI', '2timothy': '2TI', '2tim': '2TI', '2ti': '2TI',
    titus: 'TIT', tit: 'TIT',
    philemon: 'PHM', phlm: 'PHM', phm: 'PHM',
    hebrews: 'HEB', heb: 'HEB',
    james: 'JAS', jas: 'JAS',
    '1 peter': '1PE', '1peter': '1PE', '1pet': '1PE', '1pe': '1PE',
    '2 peter': '2PE', '2peter': '2PE', '2pet': '2PE', '2pe': '2PE',
    '1 john': '1JN', '1john': '1JN', '1jn': '1JN',
    '2 john': '2JN', '2john': '2JN', '2jn': '2JN',
    '3 john': '3JN', '3john': '3JN', '3jn': '3JN',
    jude: 'JUD', jud: 'JUD',
    revelation: 'REV', rev: 'REV',
};
/**
 * Parse a verse reference like "Romans 3:21-26" into structured format
 */
function parseVerseReference(text) {
    // Remove extra whitespace
    const cleaned = text.trim().toLowerCase();
    // Match patterns like:
    // "Romans 3:21-26"
    // "1 Corinthians 13"
    // "John 3:16"
    // "Genesis 1:1-2:3"
    const match = cleaned.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+)(?::(\d+))?)?)?$/);
    if (!match)
        return null;
    const [, bookName, chapter, startVerse, endPart, endVerse] = match;
    // Look up book code
    const bookCode = BOOK_CODES[bookName.trim()];
    if (!bookCode)
        return null;
    const startChapter = parseInt(chapter, 10);
    const startVerseNum = startVerse ? parseInt(startVerse, 10) : null;
    // Handle different end patterns
    let endChapter = startChapter;
    let endVerseNum = null;
    if (endPart) {
        if (endVerse) {
            // Pattern: Genesis 1:1-2:3 (cross-chapter range)
            endChapter = parseInt(endPart, 10);
            endVerseNum = parseInt(endVerse, 10);
        }
        else {
            // Pattern: Romans 3:21-26 (same chapter range)
            endVerseNum = parseInt(endPart, 10);
        }
    }
    else if (startVerseNum) {
        // Single verse, end = start
        endVerseNum = startVerseNum;
    }
    return {
        book: bookCode,
        startChapter,
        startVerse: startVerseNum,
        endChapter,
        endVerse: endVerseNum,
    };
}
/**
 * Get tags for a note
 */
function getNoteTags(noteId) {
    const tags = db.prepare('SELECT topic_id FROM note_tags WHERE note_id = ?').all(noteId);
    return tags.map((t) => t.topic_id);
}
/**
 * Register AI-enhanced composite tools for MCP
 */
export function registerAiEnhancedTools(server) {
    // parse_verse_reference - Parse human-readable verse reference
    server.tool('parse_verse_reference', 'Parse a human-readable verse reference (e.g., "Romans 3:21-26") into structured format', {
        text: z.string().describe('Verse reference text (e.g., "Romans 3:21-26", "1 Corinthians 13", "John 3:16")'),
    }, async ({ text }) => {
        try {
            const parsed = parseVerseReference(text);
            if (!parsed) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: false,
                                message: `Could not parse reference: "${text}"`,
                                hint: 'Try format like "Romans 3:21-26" or "1 Corinthians 13"',
                            }, null, 2),
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            original: text,
                            parsed,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error parsing verse reference:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // sermon_prep_bundle - Comprehensive data for sermon prep
    server.tool('sermon_prep_bundle', 'Get comprehensive sermon prep data for a Bible passage: notes, doctrines, illustrations, applications', {
        book: z.string().describe('3-letter book code (e.g., "ROM", "JHN")'),
        startChapter: z.number().describe('Starting chapter'),
        startVerse: z.number().optional().describe('Starting verse (optional)'),
        endChapter: z.number().optional().describe('Ending chapter (default: same as start)'),
        endVerse: z.number().optional().describe('Ending verse (optional)'),
    }, async ({ book, startChapter, startVerse, endChapter, endVerse }) => {
        try {
            const bookUpper = book.toUpperCase();
            const end = endChapter ?? startChapter;
            // Get notes for this passage
            const notes = db
                .prepare(`
            SELECT * FROM notes
            WHERE book = ?
              AND ((start_chapter >= ? AND start_chapter <= ?) OR (end_chapter >= ? AND end_chapter <= ?))
            ORDER BY start_chapter, start_verse
          `)
                .all(bookUpper, startChapter, end, startChapter, end);
            // Get doctrines for this passage
            const doctrines = db
                .prepare(`
            SELECT DISTINCT st.*, ssi.is_primary, ssi.context_snippet
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ? AND ssi.chapter >= ? AND ssi.chapter <= ?
            ORDER BY ssi.is_primary DESC, st.chapter_number
            LIMIT 20
          `)
                .all(bookUpper, startChapter, end);
            // Get illustrations and applications from notes in this passage
            const illustrations = db
                .prepare(`
            SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse
            FROM inline_tags it
            JOIN notes n ON it.note_id = n.id
            WHERE n.book = ? AND n.start_chapter >= ? AND n.end_chapter <= ? AND it.tag_type = 'illustration'
            ORDER BY n.start_chapter, n.start_verse
            LIMIT 20
          `)
                .all(bookUpper, startChapter, end);
            const applications = db
                .prepare(`
            SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse
            FROM inline_tags it
            JOIN notes n ON it.note_id = n.id
            WHERE n.book = ? AND n.start_chapter >= ? AND n.end_chapter <= ? AND it.tag_type = 'application'
            ORDER BY n.start_chapter, n.start_verse
            LIMIT 20
          `)
                .all(bookUpper, startChapter, end);
            const keyPoints = db
                .prepare(`
            SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse
            FROM inline_tags it
            JOIN notes n ON it.note_id = n.id
            WHERE n.book = ? AND n.start_chapter >= ? AND n.end_chapter <= ? AND it.tag_type = 'keypoint'
            ORDER BY n.start_chapter, n.start_verse
            LIMIT 20
          `)
                .all(bookUpper, startChapter, end);
            const passageRef = endVerse
                ? `${bookUpper} ${startChapter}:${startVerse}-${end}:${endVerse}`
                : startVerse
                    ? `${bookUpper} ${startChapter}:${startVerse}-${endVerse ?? startVerse}`
                    : `${bookUpper} ${startChapter}` + (end !== startChapter ? `-${end}` : '');
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            passage: {
                                reference: passageRef,
                                book: bookUpper,
                                startChapter,
                                startVerse,
                                endChapter: end,
                                endVerse,
                            },
                            notes: notes.map((n) => ({
                                ...toApiFormat(n),
                                tags: getNoteTags(n.id),
                            })),
                            doctrines: doctrines.map((d) => ({
                                id: d.id,
                                chapterNumber: d.chapter_number,
                                title: d.title,
                                summary: d.summary,
                                isPrimary: d.is_primary === 1,
                                contextSnippet: d.context_snippet,
                                linkSyntax: `[[ST:Ch${d.chapter_number}]]`,
                            })),
                            illustrations: illustrations.map(inlineTagToApiFormat),
                            applications: applications.map(inlineTagToApiFormat),
                            keyPoints: keyPoints.map(inlineTagToApiFormat),
                            counts: {
                                notes: notes.length,
                                doctrines: doctrines.length,
                                illustrations: illustrations.length,
                                applications: applications.length,
                                keyPoints: keyPoints.length,
                            },
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting sermon prep bundle:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // doctrine_study_bundle - All data for doctrine study
    server.tool('doctrine_study_bundle', 'Get comprehensive doctrine study data: chapter content, related chapters, scripture refs, and linked notes', {
        chapterNumber: z.number().describe('Systematic theology chapter number (1-57)'),
    }, async ({ chapterNumber }) => {
        try {
            // Get chapter
            const chapter = db
                .prepare("SELECT * FROM systematic_theology WHERE chapter_number = ? AND entry_type = 'chapter'")
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
            // Get scripture references
            const scriptureRefs = db
                .prepare(`
            SELECT ssi.* FROM systematic_scripture_index ssi
            JOIN systematic_theology st ON ssi.systematic_id = st.id
            WHERE st.chapter_number = ?
            ORDER BY ssi.is_primary DESC, ssi.book, ssi.chapter, ssi.start_verse
            LIMIT 50
          `)
                .all(chapterNumber);
            // Get related chapters
            const relatedChapters = db
                .prepare(`
            SELECT sr.target_chapter, st.title
            FROM systematic_related sr
            JOIN systematic_theology st ON sr.target_chapter = st.chapter_number AND st.entry_type = 'chapter'
            WHERE sr.source_chapter = ?
          `)
                .all(chapterNumber);
            // Get tags
            const tags = db
                .prepare(`
            SELECT t.* FROM systematic_tags t
            JOIN systematic_chapter_tags ct ON t.id = ct.tag_id
            WHERE ct.chapter_number = ?
          `)
                .all(chapterNumber);
            // Get notes that link to this chapter
            const linkPattern = `[[ST:Ch${chapterNumber}`;
            const linkedNotes = db
                .prepare(`
            SELECT * FROM notes
            WHERE content LIKE ?
            ORDER BY updated_at DESC
            LIMIT 20
          `)
                .all(`%${linkPattern}%`);
            // Get user annotations
            const annotations = db
                .prepare(`
            SELECT sa.* FROM systematic_annotations sa
            JOIN systematic_theology st ON sa.systematic_id = st.id
            WHERE st.chapter_number = ?
            ORDER BY sa.created_at DESC
          `)
                .all(chapterNumber);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            chapter: {
                                id: chapter.id,
                                number: chapterNumber,
                                title: chapter.title,
                                summary: chapter.summary,
                                linkSyntax: `[[ST:Ch${chapterNumber}]]`,
                            },
                            sections: sections.map((s) => ({
                                id: s.id,
                                letter: s.section_letter,
                                title: s.title,
                                summary: s.summary,
                                linkSyntax: `[[ST:Ch${chapterNumber}:${s.section_letter}]]`,
                            })),
                            scriptureReferences: scriptureRefs.map((r) => ({
                                reference: r.end_verse
                                    ? `${r.book} ${r.chapter}:${r.start_verse}-${r.end_verse}`
                                    : r.start_verse
                                        ? `${r.book} ${r.chapter}:${r.start_verse}`
                                        : `${r.book} ${r.chapter}`,
                                book: r.book,
                                chapter: r.chapter,
                                startVerse: r.start_verse,
                                endVerse: r.end_verse,
                                isPrimary: r.is_primary === 1,
                                context: r.context_snippet,
                            })),
                            relatedChapters: relatedChapters.map((r) => ({
                                number: r.target_chapter,
                                title: r.title,
                                linkSyntax: `[[ST:Ch${r.target_chapter}]]`,
                            })),
                            tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
                            linkedNotes: linkedNotes.map((n) => ({
                                id: n.id,
                                book: n.book,
                                startChapter: n.start_chapter,
                                startVerse: n.start_verse,
                                title: n.title,
                                type: n.type,
                            })),
                            annotations: annotations.map((a) => ({
                                id: a.id,
                                type: a.annotation_type,
                                color: a.color,
                                content: a.content,
                                textSelection: a.text_selection,
                            })),
                            counts: {
                                sections: sections.length,
                                scriptureRefs: scriptureRefs.length,
                                relatedChapters: relatedChapters.length,
                                linkedNotes: linkedNotes.length,
                                annotations: annotations.length,
                            },
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting doctrine study bundle:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // suggest_topics_for_passage - Suggest topics for a Bible passage
    server.tool('suggest_topics_for_passage', 'Suggest relevant topics for a Bible passage based on systematic theology connections and existing notes', {
        book: z.string().describe('3-letter book code'),
        chapter: z.number().describe('Chapter number'),
        verse: z.number().optional().describe('Verse number (optional)'),
    }, async ({ book, chapter, verse }) => {
        try {
            const bookUpper = book.toUpperCase();
            // Find doctrines that reference this passage
            const doctrines = db
                .prepare(`
            SELECT DISTINCT st.chapter_number, st.title, ssi.is_primary
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ? AND ssi.chapter = ?
            ${verse ? 'AND (ssi.start_verse <= ? AND (ssi.end_verse >= ? OR ssi.end_verse IS NULL))' : ''}
            ORDER BY ssi.is_primary DESC
            LIMIT 10
          `)
                .all(...(verse ? [bookUpper, chapter, verse, verse] : [bookUpper, chapter]));
            // Get tags for these doctrines
            const chapterNumbers = doctrines.map((d) => d.chapter_number);
            let systemticTags = [];
            if (chapterNumbers.length > 0) {
                const placeholders = chapterNumbers.map(() => '?').join(',');
                systemticTags = db
                    .prepare(`
              SELECT DISTINCT t.id, t.name FROM systematic_tags t
              JOIN systematic_chapter_tags ct ON t.id = ct.tag_id
              WHERE ct.chapter_number IN (${placeholders})
            `)
                    .all(...chapterNumbers);
            }
            // Find topics linked to these systematic tags
            const suggestedTopics = [];
            for (const sysTag of systemticTags) {
                const topics = db
                    .prepare('SELECT * FROM topics WHERE systematic_tag_id = ?')
                    .all(sysTag.id);
                suggestedTopics.push(...topics);
            }
            // Look at existing notes for this passage to see what topics they use
            const existingNotes = db
                .prepare(`
            SELECT DISTINCT primary_topic_id FROM notes
            WHERE book = ? AND start_chapter <= ? AND end_chapter >= ? AND primary_topic_id IS NOT NULL
          `)
                .all(bookUpper, chapter, chapter);
            const existingTopicIds = existingNotes.map((n) => n.primary_topic_id);
            let existingTopics = [];
            if (existingTopicIds.length > 0) {
                const placeholders = existingTopicIds.map(() => '?').join(',');
                existingTopics = db
                    .prepare(`SELECT * FROM topics WHERE id IN (${placeholders})`)
                    .all(...existingTopicIds);
            }
            // Combine and deduplicate
            const allTopics = [...suggestedTopics, ...existingTopics];
            const uniqueTopics = allTopics.filter((topic, index, self) => index === self.findIndex((t) => t.id === topic.id));
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            passage: verse ? `${bookUpper} ${chapter}:${verse}` : `${bookUpper} ${chapter}`,
                            suggestedTopics: uniqueTopics.map((t) => ({
                                ...topicToApiFormat(t),
                                source: suggestedTopics.some((st) => st.id === t.id) ? 'doctrine' : 'existing_notes',
                            })),
                            relatedDoctrines: doctrines.map((d) => ({
                                chapterNumber: d.chapter_number,
                                title: d.title,
                                isPrimary: d.is_primary === 1,
                                linkSyntax: `[[ST:Ch${d.chapter_number}]]`,
                            })),
                            counts: {
                                suggestedTopics: uniqueTopics.length,
                                relatedDoctrines: doctrines.length,
                            },
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error suggesting topics:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // extract_illustrations - Get all illustration tags
    server.tool('extract_illustrations', 'Extract all illustrations tagged in notes, optionally filtered by book or search term', {
        book: z.string().optional().describe('Filter by Bible book code'),
        search: z.string().optional().describe('Search within illustration text'),
        limit: z.number().optional().describe('Maximum results (default: 50)'),
    }, async ({ book, search, limit = 50 }) => {
        try {
            let query = `
          SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
          FROM inline_tags it
          JOIN notes n ON it.note_id = n.id
          WHERE it.tag_type = 'illustration'
        `;
            const params = [];
            if (book) {
                query += ' AND n.book = ?';
                params.push(book.toUpperCase());
            }
            if (search) {
                query += ' AND it.text_content LIKE ?';
                params.push(`%${search}%`);
            }
            query += ' ORDER BY n.book, n.start_chapter, n.start_verse LIMIT ?';
            params.push(limit);
            const illustrations = db.prepare(query).all(...params);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            illustrations: illustrations.map(inlineTagToApiFormat),
                            count: illustrations.length,
                            filters: { book, search, limit },
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error extracting illustrations:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // extract_applications - Get all application tags
    server.tool('extract_applications', 'Extract all applications tagged in notes, optionally filtered by book or search term', {
        book: z.string().optional().describe('Filter by Bible book code'),
        search: z.string().optional().describe('Search within application text'),
        limit: z.number().optional().describe('Maximum results (default: 50)'),
    }, async ({ book, search, limit = 50 }) => {
        try {
            let query = `
          SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
          FROM inline_tags it
          JOIN notes n ON it.note_id = n.id
          WHERE it.tag_type = 'application'
        `;
            const params = [];
            if (book) {
                query += ' AND n.book = ?';
                params.push(book.toUpperCase());
            }
            if (search) {
                query += ' AND it.text_content LIKE ?';
                params.push(`%${search}%`);
            }
            query += ' ORDER BY n.book, n.start_chapter, n.start_verse LIMIT ?';
            params.push(limit);
            const applications = db.prepare(query).all(...params);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            applications: applications.map(inlineTagToApiFormat),
                            count: applications.length,
                            filters: { book, search, limit },
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error extracting applications:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // find_related_notes - Find similar notes
    server.tool('find_related_notes', 'Find notes related to a given note by topic, book, or content similarity', {
        noteId: z.string().describe('The UUID of the note to find related notes for'),
        limit: z.number().optional().describe('Maximum results (default: 10)'),
    }, async ({ noteId, limit = 10 }) => {
        try {
            const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
            if (!note) {
                return {
                    content: [{ type: 'text', text: `Note not found: ${noteId}` }],
                    isError: true,
                };
            }
            const related = [];
            // 1. Same topic
            if (note.primary_topic_id) {
                const sameTopicNotes = db
                    .prepare(`
              SELECT * FROM notes
              WHERE primary_topic_id = ? AND id != ?
              ORDER BY updated_at DESC
              LIMIT 5
            `)
                    .all(note.primary_topic_id, noteId);
                related.push(...sameTopicNotes.map((n) => ({ ...n, relationshipType: 'same_topic' })));
            }
            // 2. Same book and nearby chapters
            const nearbyNotes = db
                .prepare(`
            SELECT * FROM notes
            WHERE book = ? AND id != ?
              AND ABS(start_chapter - ?) <= 2
            ORDER BY ABS(start_chapter - ?), updated_at DESC
            LIMIT 5
          `)
                .all(note.book, noteId, note.start_chapter, note.start_chapter);
            related.push(...nearbyNotes.map((n) => ({ ...n, relationshipType: 'nearby_passage' })));
            // 3. Shared tags
            const noteTags = getNoteTags(noteId);
            if (noteTags.length > 0) {
                const placeholders = noteTags.map(() => '?').join(',');
                const sharedTagNotes = db
                    .prepare(`
              SELECT DISTINCT n.* FROM notes n
              JOIN note_tags nt ON n.id = nt.note_id
              WHERE nt.topic_id IN (${placeholders}) AND n.id != ?
              ORDER BY n.updated_at DESC
              LIMIT 5
            `)
                    .all(...noteTags, noteId);
                related.push(...sharedTagNotes.map((n) => ({ ...n, relationshipType: 'shared_tags' })));
            }
            // Deduplicate
            const seen = new Set();
            const uniqueRelated = related.filter((n) => {
                if (seen.has(n.id))
                    return false;
                seen.add(n.id);
                return true;
            });
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            sourceNote: {
                                id: note.id,
                                book: note.book,
                                startChapter: note.start_chapter,
                                title: note.title,
                            },
                            relatedNotes: uniqueRelated.slice(0, limit).map((n) => ({
                                ...toApiFormat(n),
                                relationshipType: n.relationshipType,
                                tags: getNoteTags(n.id),
                            })),
                            count: Math.min(uniqueRelated.length, limit),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error finding related notes:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // summarize_topic_notes - Summarize notes under a topic
    server.tool('summarize_topic_notes', 'Get a summary of all notes under a topic with statistics and key themes', {
        topicId: z.string().describe('The UUID of the topic'),
    }, async ({ topicId }) => {
        try {
            const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId);
            if (!topic) {
                return {
                    content: [{ type: 'text', text: `Topic not found: ${topicId}` }],
                    isError: true,
                };
            }
            // Get all descendant topic IDs
            const getDescendantIds = (id) => {
                const children = db.prepare('SELECT id FROM topics WHERE parent_id = ?').all(id);
                let ids = [id];
                for (const child of children) {
                    ids = ids.concat(getDescendantIds(child.id));
                }
                return ids;
            };
            const allIds = getDescendantIds(topicId);
            const placeholders = allIds.map(() => '?').join(',');
            // Get all notes
            const notes = db
                .prepare(`
            SELECT DISTINCT n.* FROM notes n
            LEFT JOIN note_tags nt ON n.id = nt.note_id
            WHERE n.primary_topic_id IN (${placeholders}) OR nt.topic_id IN (${placeholders})
            ORDER BY n.book, n.start_chapter, n.start_verse
          `)
                .all(...allIds, ...allIds);
            // Group by book
            const byBook = {};
            for (const note of notes) {
                if (!byBook[note.book])
                    byBook[note.book] = [];
                byBook[note.book].push(note);
            }
            // Group by type
            const byType = {};
            for (const note of notes) {
                byType[note.type] = (byType[note.type] || 0) + 1;
            }
            // Get inline tags from these notes
            const noteIds = notes.map((n) => n.id);
            let tagCounts = [];
            if (noteIds.length > 0) {
                const notePlaceholders = noteIds.map(() => '?').join(',');
                tagCounts = db
                    .prepare(`
              SELECT tag_type, COUNT(*) as count
              FROM inline_tags
              WHERE note_id IN (${notePlaceholders})
              GROUP BY tag_type
            `)
                    .all(...noteIds);
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            topic: topicToApiFormat(topic),
                            statistics: {
                                totalNotes: notes.length,
                                byBook: Object.fromEntries(Object.entries(byBook).map(([book, arr]) => [book, arr.length])),
                                byType,
                                inlineTagCounts: Object.fromEntries(tagCounts.map((t) => [t.tag_type, t.count])),
                            },
                            recentNotes: notes.slice(0, 5).map((n) => ({
                                ...toApiFormat(n),
                                tags: getNoteTags(n.id),
                            })),
                            booksRepresented: Object.keys(byBook).sort(),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error summarizing topic notes:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // create_enriched_note - Create note with auto-suggested topics and doctrines
    server.tool('create_enriched_note', 'Create a note and automatically suggest relevant topics and doctrine links based on the passage', {
        book: z.string().describe('3-letter book code'),
        startChapter: z.number().describe('Starting chapter number'),
        startVerse: z.number().optional().describe('Starting verse number'),
        endChapter: z.number().describe('Ending chapter number'),
        endVerse: z.number().optional().describe('Ending verse number'),
        title: z.string().optional().describe('Note title'),
        content: z.string().optional().describe('Note content as HTML'),
        type: z.enum(['note', 'commentary', 'sermon']).optional().describe('Note type'),
    }, async ({ book, startChapter, startVerse, endChapter, endVerse, title = '', content = '', type = 'note' }) => {
        try {
            const bookUpper = book.toUpperCase();
            const id = uuidv4();
            const now = new Date().toISOString();
            // Create the note first
            db.prepare(`
          INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, bookUpper, startChapter, startVerse ?? null, endChapter, endVerse ?? null, title, content, type, now, now);
            // Find relevant doctrines
            const doctrines = db
                .prepare(`
            SELECT DISTINCT st.chapter_number, st.title, ssi.is_primary
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ? AND ssi.chapter >= ? AND ssi.chapter <= ?
            ORDER BY ssi.is_primary DESC
            LIMIT 5
          `)
                .all(bookUpper, startChapter, endChapter);
            // Find topics based on systematic tags
            const chapterNumbers = doctrines.map((d) => d.chapter_number);
            let suggestedTopics = [];
            if (chapterNumbers.length > 0) {
                const placeholders = chapterNumbers.map(() => '?').join(',');
                const sysTagIds = db
                    .prepare(`
              SELECT DISTINCT tag_id FROM systematic_chapter_tags
              WHERE chapter_number IN (${placeholders})
            `)
                    .all(...chapterNumbers);
                if (sysTagIds.length > 0) {
                    const tagPlaceholders = sysTagIds.map(() => '?').join(',');
                    suggestedTopics = db
                        .prepare(`SELECT * FROM topics WHERE systematic_tag_id IN (${tagPlaceholders})`)
                        .all(...sysTagIds.map((t) => t.tag_id));
                }
            }
            const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Note created with enrichment suggestions',
                            note: toApiFormat(note),
                            suggestions: {
                                topics: suggestedTopics.map((t) => ({
                                    ...topicToApiFormat(t),
                                    action: `Use set_note_topics with noteId="${id}" and primaryTopicId="${t.id}" to assign`,
                                })),
                                doctrineLinks: doctrines.map((d) => ({
                                    chapterNumber: d.chapter_number,
                                    title: d.title,
                                    isPrimary: d.is_primary === 1,
                                    linkSyntax: `[[ST:Ch${d.chapter_number}]]`,
                                    instruction: 'Add this link to the note content to connect to systematic theology',
                                })),
                            },
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error creating enriched note:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // auto_tag_note - Auto-assign topics to existing note
    server.tool('auto_tag_note', 'Analyze a note and automatically suggest or assign topics based on its content and passage', {
        noteId: z.string().describe('The UUID of the note'),
        applyPrimary: z.boolean().optional().describe('Automatically set the best-matching primary topic (default: false)'),
        applySecondary: z.boolean().optional().describe('Automatically add suggested secondary topics (default: false)'),
    }, async ({ noteId, applyPrimary = false, applySecondary = false }) => {
        try {
            const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
            if (!note) {
                return {
                    content: [{ type: 'text', text: `Note not found: ${noteId}` }],
                    isError: true,
                };
            }
            // Find doctrines for this passage
            const doctrines = db
                .prepare(`
            SELECT DISTINCT st.chapter_number, st.title
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ? AND ssi.chapter >= ? AND ssi.chapter <= ?
            ORDER BY ssi.is_primary DESC
            LIMIT 10
          `)
                .all(note.book, note.start_chapter, note.end_chapter);
            // Get systematic tag IDs from these doctrines
            const chapterNumbers = doctrines.map((d) => d.chapter_number);
            const suggestedTopics = [];
            if (chapterNumbers.length > 0) {
                const placeholders = chapterNumbers.map(() => '?').join(',');
                const sysTagIds = db
                    .prepare(`SELECT DISTINCT tag_id FROM systematic_chapter_tags WHERE chapter_number IN (${placeholders})`)
                    .all(...chapterNumbers);
                if (sysTagIds.length > 0) {
                    const tagPlaceholders = sysTagIds.map(() => '?').join(',');
                    const topics = db
                        .prepare(`SELECT * FROM topics WHERE systematic_tag_id IN (${tagPlaceholders})`)
                        .all(...sysTagIds.map((t) => t.tag_id));
                    suggestedTopics.push(...topics);
                }
            }
            let appliedPrimary = null;
            const appliedSecondary = [];
            // Apply primary topic if requested and suggestions exist
            if (applyPrimary && suggestedTopics.length > 0 && !note.primary_topic_id) {
                appliedPrimary = suggestedTopics[0];
                db.prepare('UPDATE notes SET primary_topic_id = ?, updated_at = ? WHERE id = ?').run(appliedPrimary.id, new Date().toISOString(), noteId);
            }
            // Apply secondary topics if requested
            if (applySecondary && suggestedTopics.length > 1) {
                const insertTag = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, topic_id) VALUES (?, ?)');
                for (let i = 1; i < suggestedTopics.length; i++) {
                    insertTag.run(noteId, suggestedTopics[i].id);
                    appliedSecondary.push(suggestedTopics[i]);
                }
            }
            const updatedNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            note: {
                                ...toApiFormat(updatedNote),
                                tags: getNoteTags(noteId),
                            },
                            suggestedTopics: suggestedTopics.map(topicToApiFormat),
                            applied: {
                                primaryTopic: appliedPrimary ? topicToApiFormat(appliedPrimary) : null,
                                secondaryTopics: appliedSecondary.map(topicToApiFormat),
                            },
                            message: applyPrimary || applySecondary
                                ? `Applied ${appliedPrimary ? 1 : 0} primary and ${appliedSecondary.length} secondary topics`
                                : 'Suggestions generated (use applyPrimary/applySecondary to auto-assign)',
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error auto-tagging note:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    // insert_doctrine_links - Add doctrine links to note content
    server.tool('insert_doctrine_links', 'Preview or insert doctrine links ([[ST:ChX]]) into a note based on its passage', {
        noteId: z.string().describe('The UUID of the note'),
        apply: z.boolean().optional().describe('Actually insert the links (default: false, just preview)'),
    }, async ({ noteId, apply = false }) => {
        try {
            const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
            if (!note) {
                return {
                    content: [{ type: 'text', text: `Note not found: ${noteId}` }],
                    isError: true,
                };
            }
            // Find doctrines for this passage
            const doctrines = db
                .prepare(`
            SELECT DISTINCT st.chapter_number, st.title
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ? AND ssi.chapter >= ? AND ssi.chapter <= ?
            AND ssi.is_primary = 1
            ORDER BY st.chapter_number
            LIMIT 5
          `)
                .all(note.book, note.start_chapter, note.end_chapter);
            // Check which links already exist
            const existingLinks = [];
            const linkRegex = /\[\[ST:Ch(\d+)(?::([A-Z])(?:\.(\d+))?)?\]\]/gi;
            let match;
            while ((match = linkRegex.exec(note.content || '')) !== null) {
                existingLinks.push(match[0]);
            }
            // Generate suggested links block
            const newLinks = doctrines
                .map((d) => `[[ST:Ch${d.chapter_number}]]`)
                .filter((link) => !existingLinks.includes(link));
            let updatedContent = note.content;
            if (apply && newLinks.length > 0) {
                // Add links at the end of content
                const linksBlock = `<p><strong>Related Doctrines:</strong> ${newLinks.join(' ')}</p>`;
                updatedContent = (note.content || '') + linksBlock;
                db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?').run(updatedContent, new Date().toISOString(), noteId);
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            note: {
                                id: note.id,
                                book: note.book,
                                startChapter: note.start_chapter,
                                title: note.title,
                            },
                            existingLinks,
                            suggestedDoctrines: doctrines.map((d) => ({
                                chapterNumber: d.chapter_number,
                                title: d.title,
                                linkSyntax: `[[ST:Ch${d.chapter_number}]]`,
                                alreadyPresent: existingLinks.includes(`[[ST:Ch${d.chapter_number}]]`),
                            })),
                            newLinksToAdd: newLinks,
                            applied: apply,
                            message: apply
                                ? newLinks.length > 0
                                    ? `Inserted ${newLinks.length} new doctrine links`
                                    : 'No new links to add (all already present)'
                                : 'Preview only - set apply=true to insert links',
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error inserting doctrine links:', error);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true,
            };
        }
    });
    logger.info('Registered AI-enhanced tools: parse_verse_reference, sermon_prep_bundle, doctrine_study_bundle, suggest_topics_for_passage, extract_illustrations, extract_applications, find_related_notes, summarize_topic_notes, create_enriched_note, auto_tag_note, insert_doctrine_links');
}
