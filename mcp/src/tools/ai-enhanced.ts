import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { DbNote, toApiFormat, DbTopic, topicToApiFormat, DbInlineTag, inlineTagToApiFormat } from '../utils/format.js';
import { logger } from '../utils/logger.js';

/**
 * Bible book name to 3-letter code mapping
 */
const BOOK_CODES: Record<string, string> = {
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
function parseVerseReference(text: string): {
  book: string;
  startChapter: number;
  startVerse: number | null;
  endChapter: number;
  endVerse: number | null;
} | null {
  // Remove extra whitespace
  const cleaned = text.trim().toLowerCase();

  // Match patterns like:
  // "Romans 3:21-26"
  // "1 Corinthians 13"
  // "John 3:16"
  // "Genesis 1:1-2:3"
  const match = cleaned.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+)(?::(\d+))?)?)?$/);

  if (!match) return null;

  const [, bookName, chapter, startVerse, endPart, endVerse] = match;

  // Look up book code
  const bookCode = BOOK_CODES[bookName.trim()];
  if (!bookCode) return null;

  const startChapter = parseInt(chapter, 10);
  const startVerseNum = startVerse ? parseInt(startVerse, 10) : null;

  // Handle different end patterns
  let endChapter = startChapter;
  let endVerseNum: number | null = null;

  if (endPart) {
    if (endVerse) {
      // Pattern: Genesis 1:1-2:3 (cross-chapter range)
      endChapter = parseInt(endPart, 10);
      endVerseNum = parseInt(endVerse, 10);
    } else {
      // Pattern: Romans 3:21-26 (same chapter range)
      endVerseNum = parseInt(endPart, 10);
    }
  } else if (startVerseNum) {
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
function getNoteTags(noteId: string): string[] {
  const tags = db.prepare('SELECT topic_id FROM note_tags WHERE note_id = ?').all(noteId) as { topic_id: string }[];
  return tags.map((t) => t.topic_id);
}

/**
 * Register AI-enhanced composite tools for MCP
 */
export function registerAiEnhancedTools(server: McpServer): void {
  // parse_verse_reference - Parse human-readable verse reference
  server.tool(
    'parse_verse_reference',
    'Parse a human-readable verse reference (e.g., "Romans 3:21-26") into structured format',
    {
      text: z.string().describe('Verse reference text (e.g., "Romans 3:21-26", "1 Corinthians 13", "John 3:16")'),
    },
    async ({ text }) => {
      try {
        const parsed = parseVerseReference(text);

        if (!parsed) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    success: false,
                    message: `Could not parse reference: "${text}"`,
                    hint: 'Try format like "Romans 3:21-26" or "1 Corinthians 13"',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  original: text,
                  parsed,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error parsing verse reference:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // sermon_prep_bundle - Comprehensive data for sermon prep
  server.tool(
    'sermon_prep_bundle',
    'Get comprehensive sermon prep data for a Bible passage: notes, doctrines, illustrations, applications',
    {
      book: z.string().describe('3-letter book code (e.g., "ROM", "JHN")'),
      startChapter: z.number().describe('Starting chapter'),
      startVerse: z.number().optional().describe('Starting verse (optional)'),
      endChapter: z.number().optional().describe('Ending chapter (default: same as start)'),
      endVerse: z.number().optional().describe('Ending verse (optional)'),
    },
    async ({ book, startChapter, startVerse, endChapter, endVerse }) => {
      try {
        const bookUpper = book.toUpperCase();
        const end = endChapter ?? startChapter;

        // Get notes for this passage
        const notes = db
          .prepare(
            `
            SELECT * FROM notes
            WHERE book = ?
              AND ((start_chapter >= ? AND start_chapter <= ?) OR (end_chapter >= ? AND end_chapter <= ?))
            ORDER BY start_chapter, start_verse
          `
          )
          .all(bookUpper, startChapter, end, startChapter, end) as DbNote[];

        // Get doctrines for this passage
        const doctrines = db
          .prepare(
            `
            SELECT DISTINCT st.*, ssi.is_primary, ssi.context_snippet
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ? AND ssi.chapter >= ? AND ssi.chapter <= ?
            ORDER BY ssi.is_primary DESC, st.chapter_number
            LIMIT 20
          `
          )
          .all(bookUpper, startChapter, end) as {
          id: string;
          chapter_number: number;
          title: string;
          summary: string | null;
          is_primary: number;
          context_snippet: string | null;
        }[];

        // Get illustrations and applications from notes in this passage
        const illustrations = db
          .prepare(
            `
            SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse
            FROM inline_tags it
            JOIN notes n ON it.note_id = n.id
            WHERE n.book = ? AND n.start_chapter >= ? AND n.end_chapter <= ? AND it.tag_type = 'illustration'
            ORDER BY n.start_chapter, n.start_verse
            LIMIT 20
          `
          )
          .all(bookUpper, startChapter, end) as DbInlineTag[];

        const applications = db
          .prepare(
            `
            SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse
            FROM inline_tags it
            JOIN notes n ON it.note_id = n.id
            WHERE n.book = ? AND n.start_chapter >= ? AND n.end_chapter <= ? AND it.tag_type = 'application'
            ORDER BY n.start_chapter, n.start_verse
            LIMIT 20
          `
          )
          .all(bookUpper, startChapter, end) as DbInlineTag[];

        const keyPoints = db
          .prepare(
            `
            SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse
            FROM inline_tags it
            JOIN notes n ON it.note_id = n.id
            WHERE n.book = ? AND n.start_chapter >= ? AND n.end_chapter <= ? AND it.tag_type = 'keypoint'
            ORDER BY n.start_chapter, n.start_verse
            LIMIT 20
          `
          )
          .all(bookUpper, startChapter, end) as DbInlineTag[];

        const passageRef = endVerse
          ? `${bookUpper} ${startChapter}:${startVerse}-${end}:${endVerse}`
          : startVerse
          ? `${bookUpper} ${startChapter}:${startVerse}-${endVerse ?? startVerse}`
          : `${bookUpper} ${startChapter}` + (end !== startChapter ? `-${end}` : '');

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
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
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting sermon prep bundle:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // doctrine_study_bundle - All data for doctrine study
  server.tool(
    'doctrine_study_bundle',
    'Get comprehensive doctrine study data: chapter content, related chapters, scripture refs, and linked notes',
    {
      chapterNumber: z.number().describe('Systematic theology chapter number (1-57)'),
    },
    async ({ chapterNumber }) => {
      try {
        // Get chapter
        const chapter = db
          .prepare("SELECT * FROM systematic_theology WHERE chapter_number = ? AND entry_type = 'chapter'")
          .get(chapterNumber) as {
          id: string;
          title: string;
          content: string | null;
          summary: string | null;
        } | undefined;

        if (!chapter) {
          return {
            content: [{ type: 'text' as const, text: `Chapter ${chapterNumber} not found` }],
            isError: true,
          };
        }

        // Get sections
        const sections = db
          .prepare(
            `
            SELECT * FROM systematic_theology
            WHERE chapter_number = ? AND entry_type = 'section'
            ORDER BY sort_order
          `
          )
          .all(chapterNumber) as { id: string; section_letter: string; title: string; summary: string | null }[];

        // Get scripture references
        const scriptureRefs = db
          .prepare(
            `
            SELECT ssi.* FROM systematic_scripture_index ssi
            JOIN systematic_theology st ON ssi.systematic_id = st.id
            WHERE st.chapter_number = ?
            ORDER BY ssi.is_primary DESC, ssi.book, ssi.chapter, ssi.start_verse
            LIMIT 50
          `
          )
          .all(chapterNumber) as {
          book: string;
          chapter: number;
          start_verse: number | null;
          end_verse: number | null;
          is_primary: number;
          context_snippet: string | null;
        }[];

        // Get related chapters
        const relatedChapters = db
          .prepare(
            `
            SELECT sr.target_chapter, st.title
            FROM systematic_related sr
            JOIN systematic_theology st ON sr.target_chapter = st.chapter_number AND st.entry_type = 'chapter'
            WHERE sr.source_chapter = ?
          `
          )
          .all(chapterNumber) as { target_chapter: number; title: string }[];

        // Get tags
        const tags = db
          .prepare(
            `
            SELECT t.* FROM systematic_tags t
            JOIN systematic_chapter_tags ct ON t.id = ct.tag_id
            WHERE ct.chapter_number = ?
          `
          )
          .all(chapterNumber) as { id: string; name: string; color: string }[];

        // Get notes that link to this chapter
        const linkPattern = `[[ST:Ch${chapterNumber}`;
        const linkedNotes = db
          .prepare(
            `
            SELECT * FROM notes
            WHERE content LIKE ?
            ORDER BY updated_at DESC
            LIMIT 20
          `
          )
          .all(`%${linkPattern}%`) as DbNote[];

        // Get user annotations
        const annotations = db
          .prepare(
            `
            SELECT sa.* FROM systematic_annotations sa
            JOIN systematic_theology st ON sa.systematic_id = st.id
            WHERE st.chapter_number = ?
            ORDER BY sa.created_at DESC
          `
          )
          .all(chapterNumber) as {
          id: string;
          annotation_type: string;
          color: string | null;
          content: string | null;
          text_selection: string | null;
        }[];

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
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
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting doctrine study bundle:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // suggest_topics_for_passage - Suggest topics for a Bible passage
  server.tool(
    'suggest_topics_for_passage',
    'Suggest relevant topics for a Bible passage based on systematic theology connections and existing notes',
    {
      book: z.string().describe('3-letter book code'),
      chapter: z.number().describe('Chapter number'),
      verse: z.number().optional().describe('Verse number (optional)'),
    },
    async ({ book, chapter, verse }) => {
      try {
        const bookUpper = book.toUpperCase();

        // Find doctrines that reference this passage
        const doctrines = db
          .prepare(
            `
            SELECT DISTINCT st.chapter_number, st.title, ssi.is_primary
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ? AND ssi.chapter = ?
            ${verse ? 'AND (ssi.start_verse <= ? AND (ssi.end_verse >= ? OR ssi.end_verse IS NULL))' : ''}
            ORDER BY ssi.is_primary DESC
            LIMIT 10
          `
          )
          .all(...(verse ? [bookUpper, chapter, verse, verse] : [bookUpper, chapter])) as {
          chapter_number: number;
          title: string;
          is_primary: number;
        }[];

        // Get tags for these doctrines
        const chapterNumbers = doctrines.map((d) => d.chapter_number);
        let systemticTags: { id: string; name: string }[] = [];
        if (chapterNumbers.length > 0) {
          const placeholders = chapterNumbers.map(() => '?').join(',');
          systemticTags = db
            .prepare(
              `
              SELECT DISTINCT t.id, t.name FROM systematic_tags t
              JOIN systematic_chapter_tags ct ON t.id = ct.tag_id
              WHERE ct.chapter_number IN (${placeholders})
            `
            )
            .all(...chapterNumbers) as { id: string; name: string }[];
        }

        // Find topics linked to these systematic tags
        const suggestedTopics: DbTopic[] = [];
        for (const sysTag of systemticTags) {
          const topics = db
            .prepare('SELECT * FROM topics WHERE systematic_tag_id = ?')
            .all(sysTag.id) as DbTopic[];
          suggestedTopics.push(...topics);
        }

        // Look at existing notes for this passage to see what topics they use
        const existingNotes = db
          .prepare(
            `
            SELECT DISTINCT primary_topic_id FROM notes
            WHERE book = ? AND start_chapter <= ? AND end_chapter >= ? AND primary_topic_id IS NOT NULL
          `
          )
          .all(bookUpper, chapter, chapter) as { primary_topic_id: string }[];

        const existingTopicIds = existingNotes.map((n) => n.primary_topic_id);
        let existingTopics: DbTopic[] = [];
        if (existingTopicIds.length > 0) {
          const placeholders = existingTopicIds.map(() => '?').join(',');
          existingTopics = db
            .prepare(`SELECT * FROM topics WHERE id IN (${placeholders})`)
            .all(...existingTopicIds) as DbTopic[];
        }

        // Combine and deduplicate
        const allTopics = [...suggestedTopics, ...existingTopics];
        const uniqueTopics = allTopics.filter(
          (topic, index, self) => index === self.findIndex((t) => t.id === topic.id)
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
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
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error suggesting topics:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // extract_illustrations - Get all illustration tags
  server.tool(
    'extract_illustrations',
    'Extract all illustrations tagged in notes, optionally filtered by book or search term',
    {
      book: z.string().optional().describe('Filter by Bible book code'),
      search: z.string().optional().describe('Search within illustration text'),
      limit: z.number().optional().describe('Maximum results (default: 50)'),
    },
    async ({ book, search, limit = 50 }) => {
      try {
        let query = `
          SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
          FROM inline_tags it
          JOIN notes n ON it.note_id = n.id
          WHERE it.tag_type = 'illustration'
        `;
        const params: (string | number)[] = [];

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

        const illustrations = db.prepare(query).all(...params) as DbInlineTag[];

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  illustrations: illustrations.map(inlineTagToApiFormat),
                  count: illustrations.length,
                  filters: { book, search, limit },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error extracting illustrations:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // extract_applications - Get all application tags
  server.tool(
    'extract_applications',
    'Extract all applications tagged in notes, optionally filtered by book or search term',
    {
      book: z.string().optional().describe('Filter by Bible book code'),
      search: z.string().optional().describe('Search within application text'),
      limit: z.number().optional().describe('Maximum results (default: 50)'),
    },
    async ({ book, search, limit = 50 }) => {
      try {
        let query = `
          SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
          FROM inline_tags it
          JOIN notes n ON it.note_id = n.id
          WHERE it.tag_type = 'application'
        `;
        const params: (string | number)[] = [];

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

        const applications = db.prepare(query).all(...params) as DbInlineTag[];

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  applications: applications.map(inlineTagToApiFormat),
                  count: applications.length,
                  filters: { book, search, limit },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error extracting applications:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // find_related_notes - Find similar notes
  server.tool(
    'find_related_notes',
    'Find notes related to a given note by topic, book, or content similarity',
    {
      noteId: z.string().describe('The UUID of the note to find related notes for'),
      limit: z.number().optional().describe('Maximum results (default: 10)'),
    },
    async ({ noteId, limit = 10 }) => {
      try {
        const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as DbNote | undefined;

        if (!note) {
          return {
            content: [{ type: 'text' as const, text: `Note not found: ${noteId}` }],
            isError: true,
          };
        }

        const related: (DbNote & { relationshipType: string })[] = [];

        // 1. Same topic
        if (note.primary_topic_id) {
          const sameTopicNotes = db
            .prepare(
              `
              SELECT * FROM notes
              WHERE primary_topic_id = ? AND id != ?
              ORDER BY updated_at DESC
              LIMIT 5
            `
            )
            .all(note.primary_topic_id, noteId) as DbNote[];
          related.push(...sameTopicNotes.map((n) => ({ ...n, relationshipType: 'same_topic' })));
        }

        // 2. Same book and nearby chapters
        const nearbyNotes = db
          .prepare(
            `
            SELECT * FROM notes
            WHERE book = ? AND id != ?
              AND ABS(start_chapter - ?) <= 2
            ORDER BY ABS(start_chapter - ?), updated_at DESC
            LIMIT 5
          `
          )
          .all(note.book, noteId, note.start_chapter, note.start_chapter) as DbNote[];
        related.push(...nearbyNotes.map((n) => ({ ...n, relationshipType: 'nearby_passage' })));

        // 3. Shared tags
        const noteTags = getNoteTags(noteId);
        if (noteTags.length > 0) {
          const placeholders = noteTags.map(() => '?').join(',');
          const sharedTagNotes = db
            .prepare(
              `
              SELECT DISTINCT n.* FROM notes n
              JOIN note_tags nt ON n.id = nt.note_id
              WHERE nt.topic_id IN (${placeholders}) AND n.id != ?
              ORDER BY n.updated_at DESC
              LIMIT 5
            `
            )
            .all(...noteTags, noteId) as DbNote[];
          related.push(...sharedTagNotes.map((n) => ({ ...n, relationshipType: 'shared_tags' })));
        }

        // Deduplicate
        const seen = new Set<string>();
        const uniqueRelated = related.filter((n) => {
          if (seen.has(n.id)) return false;
          seen.add(n.id);
          return true;
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
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
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error finding related notes:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // summarize_topic_notes - Summarize notes under a topic
  server.tool(
    'summarize_topic_notes',
    'Get a summary of all notes under a topic with statistics and key themes',
    {
      topicId: z.string().describe('The UUID of the topic'),
    },
    async ({ topicId }) => {
      try {
        const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId) as DbTopic | undefined;

        if (!topic) {
          return {
            content: [{ type: 'text' as const, text: `Topic not found: ${topicId}` }],
            isError: true,
          };
        }

        // Get all descendant topic IDs
        const getDescendantIds = (id: string): string[] => {
          const children = db.prepare('SELECT id FROM topics WHERE parent_id = ?').all(id) as { id: string }[];
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
          .prepare(
            `
            SELECT DISTINCT n.* FROM notes n
            LEFT JOIN note_tags nt ON n.id = nt.note_id
            WHERE n.primary_topic_id IN (${placeholders}) OR nt.topic_id IN (${placeholders})
            ORDER BY n.book, n.start_chapter, n.start_verse
          `
          )
          .all(...allIds, ...allIds) as DbNote[];

        // Group by book
        const byBook: Record<string, DbNote[]> = {};
        for (const note of notes) {
          if (!byBook[note.book]) byBook[note.book] = [];
          byBook[note.book].push(note);
        }

        // Group by type
        const byType: Record<string, number> = {};
        for (const note of notes) {
          byType[note.type] = (byType[note.type] || 0) + 1;
        }

        // Get inline tags from these notes
        const noteIds = notes.map((n) => n.id);
        let tagCounts: { tag_type: string; count: number }[] = [];
        if (noteIds.length > 0) {
          const notePlaceholders = noteIds.map(() => '?').join(',');
          tagCounts = db
            .prepare(
              `
              SELECT tag_type, COUNT(*) as count
              FROM inline_tags
              WHERE note_id IN (${notePlaceholders})
              GROUP BY tag_type
            `
            )
            .all(...noteIds) as { tag_type: string; count: number }[];
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
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
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error summarizing topic notes:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // create_enriched_note - Create note with auto-suggested topics and doctrines
  server.tool(
    'create_enriched_note',
    'Create a note and automatically suggest relevant topics and doctrine links based on the passage',
    {
      book: z.string().describe('3-letter book code'),
      startChapter: z.number().describe('Starting chapter number'),
      startVerse: z.number().optional().describe('Starting verse number'),
      endChapter: z.number().describe('Ending chapter number'),
      endVerse: z.number().optional().describe('Ending verse number'),
      title: z.string().optional().describe('Note title'),
      content: z.string().optional().describe('Note content as HTML'),
      type: z.enum(['note', 'commentary', 'sermon']).optional().describe('Note type'),
    },
    async ({ book, startChapter, startVerse, endChapter, endVerse, title = '', content = '', type = 'note' }) => {
      try {
        const bookUpper = book.toUpperCase();
        const id = uuidv4();
        const now = new Date().toISOString();

        // Create the note first
        db.prepare(
          `
          INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(id, bookUpper, startChapter, startVerse ?? null, endChapter, endVerse ?? null, title, content, type, now, now);

        // Find relevant doctrines
        const doctrines = db
          .prepare(
            `
            SELECT DISTINCT st.chapter_number, st.title, ssi.is_primary
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ? AND ssi.chapter >= ? AND ssi.chapter <= ?
            ORDER BY ssi.is_primary DESC
            LIMIT 5
          `
          )
          .all(bookUpper, startChapter, endChapter) as { chapter_number: number; title: string; is_primary: number }[];

        // Find topics based on systematic tags
        const chapterNumbers = doctrines.map((d) => d.chapter_number);
        let suggestedTopics: DbTopic[] = [];
        if (chapterNumbers.length > 0) {
          const placeholders = chapterNumbers.map(() => '?').join(',');
          const sysTagIds = db
            .prepare(
              `
              SELECT DISTINCT tag_id FROM systematic_chapter_tags
              WHERE chapter_number IN (${placeholders})
            `
            )
            .all(...chapterNumbers) as { tag_id: string }[];

          if (sysTagIds.length > 0) {
            const tagPlaceholders = sysTagIds.map(() => '?').join(',');
            suggestedTopics = db
              .prepare(`SELECT * FROM topics WHERE systematic_tag_id IN (${tagPlaceholders})`)
              .all(...sysTagIds.map((t) => t.tag_id)) as DbTopic[];
          }
        }

        const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as DbNote;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
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
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error creating enriched note:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // auto_tag_note - Auto-assign topics to existing note
  server.tool(
    'auto_tag_note',
    'Analyze a note and automatically suggest or assign topics based on its content and passage',
    {
      noteId: z.string().describe('The UUID of the note'),
      applyPrimary: z.boolean().optional().describe('Automatically set the best-matching primary topic (default: false)'),
      applySecondary: z.boolean().optional().describe('Automatically add suggested secondary topics (default: false)'),
    },
    async ({ noteId, applyPrimary = false, applySecondary = false }) => {
      try {
        const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as DbNote | undefined;

        if (!note) {
          return {
            content: [{ type: 'text' as const, text: `Note not found: ${noteId}` }],
            isError: true,
          };
        }

        // Find doctrines for this passage
        const doctrines = db
          .prepare(
            `
            SELECT DISTINCT st.chapter_number, st.title
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ? AND ssi.chapter >= ? AND ssi.chapter <= ?
            ORDER BY ssi.is_primary DESC
            LIMIT 10
          `
          )
          .all(note.book, note.start_chapter, note.end_chapter) as { chapter_number: number; title: string }[];

        // Get systematic tag IDs from these doctrines
        const chapterNumbers = doctrines.map((d) => d.chapter_number);
        const suggestedTopics: DbTopic[] = [];

        if (chapterNumbers.length > 0) {
          const placeholders = chapterNumbers.map(() => '?').join(',');
          const sysTagIds = db
            .prepare(`SELECT DISTINCT tag_id FROM systematic_chapter_tags WHERE chapter_number IN (${placeholders})`)
            .all(...chapterNumbers) as { tag_id: string }[];

          if (sysTagIds.length > 0) {
            const tagPlaceholders = sysTagIds.map(() => '?').join(',');
            const topics = db
              .prepare(`SELECT * FROM topics WHERE systematic_tag_id IN (${tagPlaceholders})`)
              .all(...sysTagIds.map((t) => t.tag_id)) as DbTopic[];
            suggestedTopics.push(...topics);
          }
        }

        let appliedPrimary: DbTopic | null = null;
        const appliedSecondary: DbTopic[] = [];

        // Apply primary topic if requested and suggestions exist
        if (applyPrimary && suggestedTopics.length > 0 && !note.primary_topic_id) {
          appliedPrimary = suggestedTopics[0];
          db.prepare('UPDATE notes SET primary_topic_id = ?, updated_at = ? WHERE id = ?').run(
            appliedPrimary.id,
            new Date().toISOString(),
            noteId
          );
        }

        // Apply secondary topics if requested
        if (applySecondary && suggestedTopics.length > 1) {
          const insertTag = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, topic_id) VALUES (?, ?)');
          for (let i = 1; i < suggestedTopics.length; i++) {
            insertTag.run(noteId, suggestedTopics[i].id);
            appliedSecondary.push(suggestedTopics[i]);
          }
        }

        const updatedNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as DbNote;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
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
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error auto-tagging note:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // insert_doctrine_links - Add doctrine links to note content
  server.tool(
    'insert_doctrine_links',
    'Preview or insert doctrine links ([[ST:ChX]]) into a note based on its passage',
    {
      noteId: z.string().describe('The UUID of the note'),
      apply: z.boolean().optional().describe('Actually insert the links (default: false, just preview)'),
    },
    async ({ noteId, apply = false }) => {
      try {
        const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as DbNote | undefined;

        if (!note) {
          return {
            content: [{ type: 'text' as const, text: `Note not found: ${noteId}` }],
            isError: true,
          };
        }

        // Find doctrines for this passage
        const doctrines = db
          .prepare(
            `
            SELECT DISTINCT st.chapter_number, st.title
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ? AND ssi.chapter >= ? AND ssi.chapter <= ?
            AND ssi.is_primary = 1
            ORDER BY st.chapter_number
            LIMIT 5
          `
          )
          .all(note.book, note.start_chapter, note.end_chapter) as { chapter_number: number; title: string }[];

        // Check which links already exist
        const existingLinks: string[] = [];
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

          db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?').run(
            updatedContent,
            new Date().toISOString(),
            noteId
          );
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
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
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error inserting doctrine links:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_similar_sermons - Find past sermons on similar topics
  server.tool(
    'get_similar_sermons',
    'Find past sermons related to a passage, topic, or keyword. Use this to see what you have preached on similar topics.',
    {
      book: z.string().optional().describe('3-letter Bible book code to find sermons in (e.g., "ROM", "JHN")'),
      chapter: z.number().optional().describe('Chapter number to find sermons near'),
      topic: z.string().optional().describe('Topic name to search for in sermon titles/content'),
      keyword: z.string().optional().describe('Keyword to search in sermon content'),
      limit: z.number().optional().describe('Maximum results (default: 20)'),
    },
    async ({ book, chapter, topic, keyword, limit = 20 }) => {
      try {
        const results: (DbNote & { matchType: string })[] = [];

        // Find sermons by book/chapter proximity
        if (book) {
          const bookUpper = book.toUpperCase();
          let chapterQuery = `
            SELECT * FROM notes
            WHERE type = 'sermon' AND book = ?
          `;
          const params: (string | number)[] = [bookUpper];

          if (chapter) {
            // Find sermons within 3 chapters
            chapterQuery += ' AND ((start_chapter >= ? AND start_chapter <= ?) OR (end_chapter >= ? AND end_chapter <= ?))';
            params.push(chapter - 3, chapter + 3, chapter - 3, chapter + 3);
          }

          chapterQuery += ' ORDER BY start_chapter, updated_at DESC LIMIT ?';
          params.push(limit);

          const bookSermons = db.prepare(chapterQuery).all(...params) as DbNote[];
          results.push(...bookSermons.map((s) => ({ ...s, matchType: 'same_book' })));
        }

        // Find sermons by topic (search in title and primary topic)
        if (topic) {
          // First try to find the topic by name
          const topicMatch = db
            .prepare("SELECT id FROM topics WHERE name LIKE ? OR name LIKE ?")
            .get(`%${topic}%`, topic) as { id: string } | undefined;

          if (topicMatch) {
            const topicSermons = db
              .prepare(`
                SELECT DISTINCT n.* FROM notes n
                LEFT JOIN note_tags nt ON n.id = nt.note_id
                WHERE n.type = 'sermon'
                  AND (n.primary_topic_id = ? OR nt.topic_id = ?)
                ORDER BY n.updated_at DESC
                LIMIT ?
              `)
              .all(topicMatch.id, topicMatch.id, limit) as DbNote[];
            results.push(...topicSermons.map((s) => ({ ...s, matchType: 'topic_match' })));
          }

          // Also search by title containing topic keyword
          const titleSermons = db
            .prepare(`
              SELECT * FROM notes
              WHERE type = 'sermon' AND title LIKE ?
              ORDER BY updated_at DESC
              LIMIT ?
            `)
            .all(`%${topic}%`, limit) as DbNote[];
          results.push(...titleSermons.map((s) => ({ ...s, matchType: 'title_match' })));
        }

        // Find sermons by keyword in content (FTS)
        if (keyword) {
          try {
            const ftsSermons = db
              .prepare(`
                SELECT n.* FROM notes n
                JOIN notes_fts fts ON n.id = fts.id
                WHERE notes_fts MATCH ? AND n.type = 'sermon'
                ORDER BY rank
                LIMIT ?
              `)
              .all(keyword, limit) as DbNote[];
            results.push(...ftsSermons.map((s) => ({ ...s, matchType: 'content_match' })));
          } catch {
            // FTS might not exist, fall back to LIKE
            const likeSermons = db
              .prepare(`
                SELECT * FROM notes
                WHERE type = 'sermon' AND (content LIKE ? OR title LIKE ?)
                ORDER BY updated_at DESC
                LIMIT ?
              `)
              .all(`%${keyword}%`, `%${keyword}%`, limit) as DbNote[];
            results.push(...likeSermons.map((s) => ({ ...s, matchType: 'content_match' })));
          }
        }

        // If no specific filter, get most recent sermons
        if (!book && !topic && !keyword) {
          const recentSermons = db
            .prepare(`
              SELECT * FROM notes
              WHERE type = 'sermon'
              ORDER BY updated_at DESC
              LIMIT ?
            `)
            .all(limit) as DbNote[];
          results.push(...recentSermons.map((s) => ({ ...s, matchType: 'recent' })));
        }

        // Deduplicate
        const seen = new Set<string>();
        const uniqueSermons = results.filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });

        // Get total sermon count for context
        const { count: totalSermons } = db
          .prepare("SELECT COUNT(*) as count FROM notes WHERE type = 'sermon'")
          .get() as { count: number };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  sermons: uniqueSermons.slice(0, limit).map((s) => ({
                    ...toApiFormat(s),
                    matchType: s.matchType,
                    tags: getNoteTags(s.id),
                    reference: `${s.book} ${s.start_chapter}${s.start_verse ? ':' + s.start_verse : ''}${s.end_chapter !== s.start_chapter ? '-' + s.end_chapter : s.end_verse && s.end_verse !== s.start_verse ? '-' + s.end_verse : ''}`,
                  })),
                  filters: { book, chapter, topic, keyword },
                  totalSermonsInLibrary: totalSermons,
                  count: Math.min(uniqueSermons.length, limit),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting similar sermons:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // compile_illustrations_for_topic - Get illustrations by topic/keyword
  server.tool(
    'compile_illustrations_for_topic',
    'Gather all illustrations tagged in notes that relate to a specific topic or keyword. Great for finding stories and examples for sermons.',
    {
      topic: z.string().optional().describe('Topic keyword to search (e.g., "grace", "faith", "redemption")'),
      doctrineChapter: z.number().optional().describe('Systematic theology chapter number to find illustrations from related passages'),
      limit: z.number().optional().describe('Maximum results (default: 30)'),
    },
    async ({ topic, doctrineChapter, limit = 30 }) => {
      try {
        const illustrations: (DbInlineTag & { source: string })[] = [];

        // Search by topic keyword
        if (topic) {
          const topicIllustrations = db
            .prepare(`
              SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
              FROM inline_tags it
              JOIN notes n ON it.note_id = n.id
              WHERE it.tag_type = 'illustration' AND it.text_content LIKE ?
              ORDER BY n.updated_at DESC
              LIMIT ?
            `)
            .all(`%${topic}%`, limit) as DbInlineTag[];
          illustrations.push(...topicIllustrations.map((i) => ({ ...i, source: 'keyword_match' })));

          // Also find illustrations from notes with matching titles/topics
          const noteIllustrations = db
            .prepare(`
              SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
              FROM inline_tags it
              JOIN notes n ON it.note_id = n.id
              WHERE it.tag_type = 'illustration' AND n.title LIKE ?
              ORDER BY n.updated_at DESC
              LIMIT ?
            `)
            .all(`%${topic}%`, limit) as DbInlineTag[];
          illustrations.push(...noteIllustrations.map((i) => ({ ...i, source: 'note_title_match' })));
        }

        // Find illustrations from passages that relate to a doctrine chapter
        if (doctrineChapter) {
          // Get scripture references for this doctrine
          const scriptures = db
            .prepare(`
              SELECT DISTINCT ssi.book, ssi.chapter
              FROM systematic_scripture_index ssi
              JOIN systematic_theology st ON ssi.systematic_id = st.id
              WHERE st.chapter_number = ? AND ssi.is_primary = 1
              LIMIT 20
            `)
            .all(doctrineChapter) as { book: string; chapter: number }[];

          for (const scripture of scriptures) {
            const passageIllustrations = db
              .prepare(`
                SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
                FROM inline_tags it
                JOIN notes n ON it.note_id = n.id
                WHERE it.tag_type = 'illustration'
                  AND n.book = ?
                  AND n.start_chapter <= ?
                  AND n.end_chapter >= ?
                LIMIT 5
              `)
              .all(scripture.book, scripture.chapter, scripture.chapter) as DbInlineTag[];
            illustrations.push(
              ...passageIllustrations.map((i) => ({
                ...i,
                source: `doctrine_ch${doctrineChapter}_${scripture.book}_${scripture.chapter}`,
              }))
            );
          }
        }

        // If no filter, get recent illustrations
        if (!topic && !doctrineChapter) {
          const recentIllustrations = db
            .prepare(`
              SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
              FROM inline_tags it
              JOIN notes n ON it.note_id = n.id
              WHERE it.tag_type = 'illustration'
              ORDER BY n.updated_at DESC
              LIMIT ?
            `)
            .all(limit) as DbInlineTag[];
          illustrations.push(...recentIllustrations.map((i) => ({ ...i, source: 'recent' })));
        }

        // Deduplicate by ID
        const seen = new Set<string>();
        const uniqueIllustrations = illustrations.filter((i) => {
          if (seen.has(i.id)) return false;
          seen.add(i.id);
          return true;
        });

        // Get total illustration count
        const { count: totalIllustrations } = db
          .prepare("SELECT COUNT(*) as count FROM inline_tags WHERE tag_type = 'illustration'")
          .get() as { count: number };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  illustrations: uniqueIllustrations.slice(0, limit).map((i) => ({
                    ...inlineTagToApiFormat(i),
                    source: i.source,
                  })),
                  filters: { topic, doctrineChapter },
                  totalIllustrationsInLibrary: totalIllustrations,
                  count: Math.min(uniqueIllustrations.length, limit),
                  tip: 'Use these illustrations in your sermon to make doctrines concrete and memorable',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error compiling illustrations:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // generate_sermon_structure - Generate a structured sermon outline scaffold
  server.tool(
    'generate_sermon_structure',
    'Generate a structured sermon outline scaffold for a passage with suggested sections based on the text, related doctrines, and your existing notes. Claude can then fill in the details.',
    {
      book: z.string().describe('3-letter book code (e.g., "ROM", "JHN")'),
      startChapter: z.number().describe('Starting chapter'),
      startVerse: z.number().optional().describe('Starting verse'),
      endChapter: z.number().optional().describe('Ending chapter (default: same as start)'),
      endVerse: z.number().optional().describe('Ending verse'),
      sermonTitle: z.string().optional().describe('Optional sermon title'),
      mainTheme: z.string().optional().describe('Optional main theme or big idea'),
    },
    async ({ book, startChapter, startVerse, endChapter, endVerse, sermonTitle, mainTheme }) => {
      try {
        const bookUpper = book.toUpperCase();
        const end = endChapter ?? startChapter;

        // Build reference string
        const passageRef = endVerse
          ? `${bookUpper} ${startChapter}:${startVerse}-${end}:${endVerse}`
          : startVerse
          ? `${bookUpper} ${startChapter}:${startVerse}${endVerse ? '-' + endVerse : ''}`
          : `${bookUpper} ${startChapter}${end !== startChapter ? '-' + end : ''}`;

        // Get existing notes for this passage
        const existingNotes = db
          .prepare(`
            SELECT * FROM notes
            WHERE book = ?
              AND ((start_chapter >= ? AND start_chapter <= ?) OR (end_chapter >= ? AND end_chapter <= ?))
            ORDER BY start_chapter, start_verse
          `)
          .all(bookUpper, startChapter, end, startChapter, end) as DbNote[];

        // Get related doctrines
        const doctrines = db
          .prepare(`
            SELECT DISTINCT st.chapter_number, st.title, st.summary, ssi.is_primary
            FROM systematic_theology st
            JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
            WHERE ssi.book = ? AND ssi.chapter >= ? AND ssi.chapter <= ?
            ORDER BY ssi.is_primary DESC
            LIMIT 10
          `)
          .all(bookUpper, startChapter, end) as {
          chapter_number: number;
          title: string;
          summary: string | null;
          is_primary: number;
        }[];

        // Get illustrations and applications from this passage
        const illustrations = db
          .prepare(`
            SELECT it.text_content FROM inline_tags it
            JOIN notes n ON it.note_id = n.id
            WHERE n.book = ? AND n.start_chapter >= ? AND n.end_chapter <= ? AND it.tag_type = 'illustration'
            LIMIT 5
          `)
          .all(bookUpper, startChapter, end) as { text_content: string }[];

        const applications = db
          .prepare(`
            SELECT it.text_content FROM inline_tags it
            JOIN notes n ON it.note_id = n.id
            WHERE n.book = ? AND n.start_chapter >= ? AND n.end_chapter <= ? AND it.tag_type = 'application'
            LIMIT 5
          `)
          .all(bookUpper, startChapter, end) as { text_content: string }[];

        const keyPoints = db
          .prepare(`
            SELECT it.text_content FROM inline_tags it
            JOIN notes n ON it.note_id = n.id
            WHERE n.book = ? AND n.start_chapter >= ? AND n.end_chapter <= ? AND it.tag_type = 'keypoint'
            LIMIT 10
          `)
          .all(bookUpper, startChapter, end) as { text_content: string }[];

        // Check for similar past sermons
        const similarSermons = db
          .prepare(`
            SELECT title, book, start_chapter, start_verse, updated_at FROM notes
            WHERE type = 'sermon' AND book = ?
              AND ((start_chapter >= ? AND start_chapter <= ?) OR (end_chapter >= ? AND end_chapter <= ?))
            ORDER BY updated_at DESC
            LIMIT 5
          `)
          .all(bookUpper, startChapter - 2, end + 2, startChapter - 2, end + 2) as {
          title: string;
          book: string;
          start_chapter: number;
          start_verse: number | null;
          updated_at: string;
        }[];

        // Build the sermon structure scaffold
        const structure = {
          metadata: {
            passage: passageRef,
            title: sermonTitle || `[Sermon on ${passageRef}]`,
            mainTheme: mainTheme || '[To be determined from text study]',
            dateCreated: new Date().toISOString(),
          },
          outline: {
            introduction: {
              hook: '[Opening story, question, or observation to capture attention]',
              context: '[Historical/literary context of the passage]',
              thesis: mainTheme || '[Central truth/proposition of this sermon]',
              preview: '[Brief overview of main points]',
            },
            mainPoints: [
              {
                point: '[Main Point 1 - derived from text]',
                scripture: '[Supporting verses]',
                explanation: '[Exegetical explanation]',
                illustration: illustrations[0]?.text_content || '[Illustration needed]',
                application: applications[0]?.text_content || '[Application needed]',
              },
              {
                point: '[Main Point 2 - derived from text]',
                scripture: '[Supporting verses]',
                explanation: '[Exegetical explanation]',
                illustration: illustrations[1]?.text_content || '[Illustration needed]',
                application: applications[1]?.text_content || '[Application needed]',
              },
              {
                point: '[Main Point 3 - derived from text]',
                scripture: '[Supporting verses]',
                explanation: '[Exegetical explanation]',
                illustration: illustrations[2]?.text_content || '[Illustration needed]',
                application: applications[2]?.text_content || '[Application needed]',
              },
            ],
            conclusion: {
              summary: '[Recap of main points]',
              finalApplication: '[Call to action/response]',
              closingIllustration: '[Final story or image]',
              invitation: '[Gospel invitation if appropriate]',
            },
          },
          resources: {
            existingNotes: existingNotes.map((n) => ({
              id: n.id,
              title: n.title,
              type: n.type,
              preview: (n.content || '').slice(0, 200).replace(/<[^>]*>/g, ''),
            })),
            relatedDoctrines: doctrines.map((d) => ({
              chapter: d.chapter_number,
              title: d.title,
              summary: d.summary,
              isPrimary: d.is_primary === 1,
              linkSyntax: `[[ST:Ch${d.chapter_number}]]`,
            })),
            keyPointsFromNotes: keyPoints.map((k) => k.text_content),
            similarPastSermons: similarSermons.map((s) => ({
              title: s.title,
              passage: `${s.book} ${s.start_chapter}${s.start_verse ? ':' + s.start_verse : ''}`,
              date: s.updated_at,
            })),
          },
          instructions: {
            nextSteps: [
              '1. Study the passage carefully and refine the main points',
              '2. Use sermon_prep_bundle to gather more context',
              '3. Use get_similar_sermons to check what you\'ve preached before',
              '4. Use compile_illustrations_for_topic to find more illustrations',
              '5. Fill in the outline scaffold with your exegesis',
              '6. Create the sermon note with create_note (type: "sermon")',
            ],
            doctrineLinks: doctrines.slice(0, 3).map((d) => `[[ST:Ch${d.chapter_number}]] - ${d.title}`),
          },
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(structure, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error generating sermon structure:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  logger.info(
    'Registered AI-enhanced tools: parse_verse_reference, sermon_prep_bundle, doctrine_study_bundle, suggest_topics_for_passage, extract_illustrations, extract_applications, find_related_notes, summarize_topic_notes, create_enriched_note, auto_tag_note, insert_doctrine_links, get_similar_sermons, compile_illustrations_for_topic, generate_sermon_structure'
  );
}
