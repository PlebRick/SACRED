import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * MCP Tools Tests
 *
 * These tests verify the MCP tool logic patterns without importing the actual
 * MCP server modules (which are a separate TypeScript project).
 *
 * The tests validate:
 * 1. Tool registration patterns
 * 2. Response format (content array with text type)
 * 3. Error handling patterns
 * 4. Data transformation (snake_case to camelCase)
 */

// Mock database interface matching better-sqlite3
interface MockStatement {
  run: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
}

interface MockDb {
  prepare: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
}

// Sample database row in snake_case format (as stored in SQLite)
const sampleDbNote = {
  id: 'note-1',
  book: 'ROM',
  start_chapter: 1,
  start_verse: 1,
  end_chapter: 1,
  end_verse: 7,
  title: 'Test Note',
  content: '<p>Test content</p>',
  type: 'note',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

// API format conversion (mirrors mcp/src/utils/format.ts)
interface DbNote {
  id: string;
  book: string;
  start_chapter: number;
  start_verse: number | null;
  end_chapter: number;
  end_verse: number | null;
  title: string;
  content: string;
  type: string;
  created_at: string;
  updated_at: string;
}

interface ApiNote {
  id: string;
  book: string;
  startChapter: number;
  startVerse: number | null;
  endChapter: number;
  endVerse: number | null;
  title: string;
  content: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

const toApiFormat = (row: DbNote): ApiNote => ({
  id: row.id,
  book: row.book,
  startChapter: row.start_chapter,
  startVerse: row.start_verse,
  endChapter: row.end_chapter,
  endVerse: row.end_verse,
  title: row.title,
  content: row.content,
  type: row.type,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// MCP response format
interface McpResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// Helper to create mock prepared statement
function createMockStatement(returnValue: unknown = undefined): MockStatement {
  return {
    run: vi.fn().mockReturnValue({ changes: 1 }),
    get: vi.fn().mockReturnValue(returnValue),
    all: vi.fn().mockReturnValue(returnValue ?? []),
  };
}

// Tool handler implementations (mirrors MCP server logic)
function createNoteHandler(
  db: MockDb,
  params: {
    book: string;
    startChapter: number;
    startVerse?: number;
    endChapter: number;
    endVerse?: number;
    title?: string;
    content?: string;
    type?: string;
  }
): McpResponse {
  try {
    const id = 'test-uuid-1234';
    const now = new Date().toISOString();

    db.prepare('INSERT...').run(
      id,
      params.book.toUpperCase(),
      params.startChapter,
      params.startVerse ?? null,
      params.endChapter,
      params.endVerse ?? null,
      params.title ?? '',
      params.content ?? '',
      params.type ?? 'note',
      now,
      now
    );

    const note = db.prepare('SELECT...').get(id) as DbNote;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              success: true,
              message: 'Note created successfully',
              note: toApiFormat(note),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error creating note: ${error}` }],
      isError: true,
    };
  }
}

function getNoteHandler(db: MockDb, params: { id: string }): McpResponse {
  try {
    const note = db.prepare('SELECT...').get(params.id) as DbNote | undefined;

    if (!note) {
      return {
        content: [{ type: 'text' as const, text: `Note not found with ID: ${params.id}` }],
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
    return {
      content: [{ type: 'text' as const, text: `Error: ${error}` }],
      isError: true,
    };
  }
}

function listNotesHandler(
  db: MockDb,
  params: { limit?: number; offset?: number }
): McpResponse {
  try {
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;

    const notes = db.prepare('SELECT...').all(limit, offset) as DbNote[];
    const total = (db.prepare('COUNT...').get() as { count: number }).count;

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
    return {
      content: [{ type: 'text' as const, text: `Error: ${error}` }],
      isError: true,
    };
  }
}

function deleteNoteHandler(db: MockDb, params: { id: string }): McpResponse {
  try {
    const note = db.prepare('SELECT...').get(params.id) as DbNote | undefined;

    if (!note) {
      return {
        content: [{ type: 'text' as const, text: `Note not found with ID: ${params.id}` }],
        isError: true,
      };
    }

    db.prepare('DELETE...').run(params.id);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              success: true,
              message: 'Note deleted successfully',
              deletedNote: toApiFormat(note),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error deleting note: ${error}` }],
      isError: true,
    };
  }
}

function exportNotesHandler(db: MockDb): McpResponse {
  try {
    const notes = db.prepare('SELECT...').all() as DbNote[];

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      notes: notes.map(toApiFormat),
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(exportData, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error exporting notes: ${error}` }],
      isError: true,
    };
  }
}

describe('MCP Tools', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      prepare: vi.fn(),
      exec: vi.fn(),
      transaction: vi.fn(),
    };
  });

  describe('create_note', () => {
    it('creates a note with valid data', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('INSERT')) {
          return createMockStatement();
        }
        return createMockStatement(sampleDbNote);
      });

      const result = createNoteHandler(mockDb, {
        book: 'ROM',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 7,
        title: 'Test Note',
        content: '<p>Test content</p>',
        type: 'note',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.message).toBe('Note created successfully');
      expect(response.note.book).toBe('ROM');
      expect(response.note.startChapter).toBe(1);
    });

    it('creates a chapter-level note (no verses)', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('INSERT')) {
          return createMockStatement();
        }
        return createMockStatement({
          ...sampleDbNote,
          start_verse: null,
          end_verse: null,
        });
      });

      const result = createNoteHandler(mockDb, {
        book: 'PSA',
        startChapter: 23,
        endChapter: 23,
        title: 'Psalm 23 Study',
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.note.startVerse).toBeNull();
      expect(response.note.endVerse).toBeNull();
    });

    it('handles database errors', () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = createNoteHandler(mockDb, {
        book: 'ROM',
        startChapter: 1,
        endChapter: 1,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error creating note');
    });
  });

  describe('get_note', () => {
    it('returns note when found', () => {
      mockDb.prepare.mockImplementation(() => createMockStatement(sampleDbNote));

      const result = getNoteHandler(mockDb, { id: 'note-1' });

      const response = JSON.parse(result.content[0].text);
      expect(response.id).toBe('note-1');
      expect(response.book).toBe('ROM');
      expect(response.startChapter).toBe(1);
    });

    it('returns error when note not found', () => {
      mockDb.prepare.mockImplementation(() => createMockStatement(undefined));

      const result = getNoteHandler(mockDb, { id: 'nonexistent' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Note not found');
    });
  });

  describe('list_notes', () => {
    it('returns all notes with pagination info', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT')) {
          return createMockStatement({ count: 3 });
        }
        return createMockStatement([sampleDbNote, { ...sampleDbNote, id: 'note-2' }]);
      });

      const result = listNotesHandler(mockDb, { limit: 10, offset: 0 });

      const response = JSON.parse(result.content[0].text);
      expect(response.notes).toHaveLength(2);
      expect(response.total).toBe(3);
      expect(response.limit).toBe(10);
      expect(response.offset).toBe(0);
    });

    it('uses default pagination values', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT')) {
          return createMockStatement({ count: 0 });
        }
        return createMockStatement([]);
      });

      const result = listNotesHandler(mockDb, {});

      const response = JSON.parse(result.content[0].text);
      expect(response.limit).toBe(100);
      expect(response.offset).toBe(0);
    });
  });

  describe('delete_note', () => {
    it('deletes existing note', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return createMockStatement(sampleDbNote);
        }
        return createMockStatement();
      });

      const result = deleteNoteHandler(mockDb, { id: 'note-1' });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.message).toBe('Note deleted successfully');
      expect(response.deletedNote.id).toBe('note-1');
    });

    it('returns error when note not found', () => {
      mockDb.prepare.mockImplementation(() => createMockStatement(undefined));

      const result = deleteNoteHandler(mockDb, { id: 'nonexistent' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Note not found');
    });
  });

  describe('export_notes', () => {
    it('exports all notes as JSON', () => {
      mockDb.prepare.mockImplementation(() =>
        createMockStatement([sampleDbNote, { ...sampleDbNote, id: 'note-2' }])
      );

      const result = exportNotesHandler(mockDb);

      const response = JSON.parse(result.content[0].text);
      expect(response.version).toBe(1);
      expect(response.exportedAt).toBeDefined();
      expect(response.notes).toHaveLength(2);
      // Verify camelCase format
      expect(response.notes[0].startChapter).toBe(1);
      expect(response.notes[0]).not.toHaveProperty('start_chapter');
    });
  });

  describe('Response Format', () => {
    it('returns content array with text type', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('INSERT')) {
          return createMockStatement();
        }
        return createMockStatement(sampleDbNote);
      });

      const result = createNoteHandler(mockDb, {
        book: 'ROM',
        startChapter: 1,
        endChapter: 1,
      });

      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('includes isError flag on errors', () => {
      mockDb.prepare.mockImplementation(() => createMockStatement(undefined));

      const result = getNoteHandler(mockDb, { id: 'nonexistent' });

      expect(result.isError).toBe(true);
    });

    it('converts snake_case to camelCase in responses', () => {
      mockDb.prepare.mockImplementation(() => createMockStatement(sampleDbNote));

      const result = getNoteHandler(mockDb, { id: 'note-1' });

      const response = JSON.parse(result.content[0].text);
      expect(response).toHaveProperty('startChapter');
      expect(response).toHaveProperty('endChapter');
      expect(response).toHaveProperty('startVerse');
      expect(response).toHaveProperty('endVerse');
      expect(response).toHaveProperty('createdAt');
      expect(response).toHaveProperty('updatedAt');
      expect(response).not.toHaveProperty('start_chapter');
      expect(response).not.toHaveProperty('created_at');
    });
  });

  describe('Data Transformation', () => {
    it('toApiFormat converts all snake_case fields', () => {
      const apiNote = toApiFormat(sampleDbNote);

      expect(apiNote.id).toBe('note-1');
      expect(apiNote.book).toBe('ROM');
      expect(apiNote.startChapter).toBe(1);
      expect(apiNote.startVerse).toBe(1);
      expect(apiNote.endChapter).toBe(1);
      expect(apiNote.endVerse).toBe(7);
      expect(apiNote.title).toBe('Test Note');
      expect(apiNote.content).toBe('<p>Test content</p>');
      expect(apiNote.type).toBe('note');
      expect(apiNote.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(apiNote.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('handles null verse values', () => {
      const chapterNote = {
        ...sampleDbNote,
        start_verse: null,
        end_verse: null,
      };

      const apiNote = toApiFormat(chapterNote);

      expect(apiNote.startVerse).toBeNull();
      expect(apiNote.endVerse).toBeNull();
    });
  });
});

/**
 * Sermon Preparation Tools Tests
 *
 * These tests verify the sermon preparation tool patterns:
 * - get_similar_sermons: Find past sermons by book, chapter, topic, or keyword
 * - compile_illustrations_for_topic: Gather illustrations for sermon prep
 * - generate_sermon_structure: Generate outline scaffold for a passage
 */

// Sample sermon note
const sampleSermonNote = {
  id: 'sermon-1',
  book: 'JHN',
  start_chapter: 3,
  start_verse: 16,
  end_chapter: 3,
  end_verse: 21,
  title: 'The Love of God',
  content: '<p>For God so loved the world...</p>',
  type: 'sermon',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

// Sample inline tag
const sampleIllustration = {
  id: 'illus-1',
  note_id: 'note-1',
  tag_type: 'illustration',
  text_content: 'The story of the prodigal son illustrates...',
  note_title: 'Grace Study',
  book: 'LUK',
  start_chapter: 15,
  start_verse: 11,
};

// Tool handler implementations (mirrors sermon-related MCP logic)
function getSimilarSermonsHandler(
  db: MockDb,
  params: {
    book?: string;
    chapter?: number;
    topic?: string;
    keyword?: string;
    limit?: number;
  }
): McpResponse {
  try {
    const limit = params.limit ?? 20;
    const results: (DbNote & { matchType: string })[] = [];

    if (params.book) {
      const bookSermons = db.prepare('SELECT...sermons by book').all() as DbNote[];
      results.push(...bookSermons.map((s) => ({ ...s, matchType: 'same_book' })));
    }

    if (params.topic) {
      const topicSermons = db.prepare('SELECT...sermons by topic').all() as DbNote[];
      results.push(...topicSermons.map((s) => ({ ...s, matchType: 'topic_match' })));
    }

    if (params.keyword) {
      const keywordSermons = db.prepare('SELECT...sermons by keyword').all() as DbNote[];
      results.push(...keywordSermons.map((s) => ({ ...s, matchType: 'content_match' })));
    }

    if (!params.book && !params.topic && !params.keyword) {
      const recentSermons = db.prepare('SELECT...recent sermons').all() as DbNote[];
      results.push(...recentSermons.map((s) => ({ ...s, matchType: 'recent' })));
    }

    // Deduplicate
    const seen = new Set<string>();
    const uniqueSermons = results.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    const totalSermons = (db.prepare('COUNT sermons').get() as { count: number }).count;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              sermons: uniqueSermons.slice(0, limit).map((s) => ({
                ...toApiFormat(s),
                matchType: s.matchType,
              })),
              filters: params,
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
    return {
      content: [{ type: 'text' as const, text: `Error: ${error}` }],
      isError: true,
    };
  }
}

interface DbInlineTag {
  id: string;
  note_id: string;
  tag_type: string;
  text_content: string;
  note_title?: string;
  book?: string;
  start_chapter?: number;
  start_verse?: number;
}

function compileIllustrationsHandler(
  db: MockDb,
  params: {
    topic?: string;
    doctrineChapter?: number;
    limit?: number;
  }
): McpResponse {
  try {
    const limit = params.limit ?? 30;
    const illustrations: (DbInlineTag & { source: string })[] = [];

    if (params.topic) {
      const topicIllus = db.prepare('SELECT...by topic').all() as DbInlineTag[];
      illustrations.push(...topicIllus.map((i) => ({ ...i, source: 'keyword_match' })));
    }

    if (params.doctrineChapter) {
      const doctrineIllus = db.prepare('SELECT...by doctrine').all() as DbInlineTag[];
      illustrations.push(
        ...doctrineIllus.map((i) => ({
          ...i,
          source: `doctrine_ch${params.doctrineChapter}`,
        }))
      );
    }

    if (!params.topic && !params.doctrineChapter) {
      const recentIllus = db.prepare('SELECT...recent').all() as DbInlineTag[];
      illustrations.push(...recentIllus.map((i) => ({ ...i, source: 'recent' })));
    }

    const totalIllus = (db.prepare('COUNT illustrations').get() as { count: number }).count;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              illustrations: illustrations.slice(0, limit).map((i) => ({
                id: i.id,
                tagType: i.tag_type,
                textContent: i.text_content,
                source: i.source,
              })),
              filters: params,
              totalIllustrationsInLibrary: totalIllus,
              count: Math.min(illustrations.length, limit),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${error}` }],
      isError: true,
    };
  }
}

function generateSermonStructureHandler(
  db: MockDb,
  params: {
    book: string;
    startChapter: number;
    startVerse?: number;
    endChapter?: number;
    endVerse?: number;
    sermonTitle?: string;
    mainTheme?: string;
  }
): McpResponse {
  try {
    const bookUpper = params.book.toUpperCase();
    const end = params.endChapter ?? params.startChapter;

    const passageRef = params.startVerse
      ? `${bookUpper} ${params.startChapter}:${params.startVerse}`
      : `${bookUpper} ${params.startChapter}`;

    const existingNotes = db.prepare('SELECT...notes').all() as DbNote[];
    const doctrines = db.prepare('SELECT...doctrines').all() as {
      chapter_number: number;
      title: string;
    }[];
    const illustrations = db.prepare('SELECT...illustrations').all() as { text_content: string }[];
    const similarSermons = db.prepare('SELECT...similar sermons').all() as {
      title: string;
      book: string;
      start_chapter: number;
    }[];

    const structure = {
      metadata: {
        passage: passageRef,
        title: params.sermonTitle || `[Sermon on ${passageRef}]`,
        mainTheme: params.mainTheme || '[To be determined]',
        dateCreated: new Date().toISOString(),
      },
      outline: {
        introduction: {
          hook: '[Opening]',
          context: '[Context]',
          thesis: params.mainTheme || '[Thesis]',
          preview: '[Preview]',
        },
        mainPoints: [
          {
            point: '[Main Point 1]',
            illustration: illustrations[0]?.text_content || '[Illustration needed]',
          },
          {
            point: '[Main Point 2]',
            illustration: illustrations[1]?.text_content || '[Illustration needed]',
          },
        ],
        conclusion: {
          summary: '[Summary]',
          finalApplication: '[Application]',
        },
      },
      resources: {
        existingNotes: existingNotes.map((n) => ({ id: n.id, title: n.title })),
        relatedDoctrines: doctrines.map((d) => ({
          chapter: d.chapter_number,
          title: d.title,
        })),
        similarPastSermons: similarSermons.map((s) => ({
          title: s.title,
          passage: `${s.book} ${s.start_chapter}`,
        })),
      },
      instructions: {
        nextSteps: [
          '1. Study the passage',
          '2. Use sermon_prep_bundle for more context',
          '3. Fill in the outline',
        ],
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
    return {
      content: [{ type: 'text' as const, text: `Error: ${error}` }],
      isError: true,
    };
  }
}

describe('Sermon Preparation MCP Tools', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      prepare: vi.fn(),
      exec: vi.fn(),
      transaction: vi.fn(),
    };
  });

  describe('get_similar_sermons', () => {
    it('finds sermons by book', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT')) {
          return createMockStatement({ count: 5 });
        }
        return createMockStatement([sampleSermonNote]);
      });

      const result = getSimilarSermonsHandler(mockDb, { book: 'JHN' });

      const response = JSON.parse(result.content[0].text);
      expect(response.sermons).toHaveLength(1);
      expect(response.sermons[0].matchType).toBe('same_book');
      expect(response.totalSermonsInLibrary).toBe(5);
    });

    it('finds sermons by topic', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT')) {
          return createMockStatement({ count: 10 });
        }
        if (sql.includes('topic')) {
          return createMockStatement([{ ...sampleSermonNote, title: 'Grace Sermon' }]);
        }
        return createMockStatement([]);
      });

      const result = getSimilarSermonsHandler(mockDb, { topic: 'grace' });

      const response = JSON.parse(result.content[0].text);
      expect(response.sermons[0].matchType).toBe('topic_match');
    });

    it('finds sermons by keyword', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT')) {
          return createMockStatement({ count: 3 });
        }
        if (sql.includes('keyword')) {
          return createMockStatement([{ ...sampleSermonNote, title: 'Justification' }]);
        }
        return createMockStatement([]);
      });

      const result = getSimilarSermonsHandler(mockDb, { keyword: 'justification' });

      const response = JSON.parse(result.content[0].text);
      expect(response.sermons[0].matchType).toBe('content_match');
    });

    it('returns recent sermons when no filters provided', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT')) {
          return createMockStatement({ count: 20 });
        }
        return createMockStatement([sampleSermonNote, { ...sampleSermonNote, id: 'sermon-2' }]);
      });

      const result = getSimilarSermonsHandler(mockDb, {});

      const response = JSON.parse(result.content[0].text);
      expect(response.sermons).toHaveLength(2);
      expect(response.sermons[0].matchType).toBe('recent');
    });

    it('deduplicates results from multiple filters', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT')) {
          return createMockStatement({ count: 5 });
        }
        // Return same sermon from both book and topic queries
        return createMockStatement([sampleSermonNote]);
      });

      const result = getSimilarSermonsHandler(mockDb, { book: 'JHN', topic: 'love' });

      const response = JSON.parse(result.content[0].text);
      // Should be deduplicated to 1 result
      expect(response.sermons).toHaveLength(1);
    });

    it('respects limit parameter', () => {
      const manySermons = Array.from({ length: 50 }, (_, i) => ({
        ...sampleSermonNote,
        id: `sermon-${i}`,
      }));
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT')) {
          return createMockStatement({ count: 50 });
        }
        return createMockStatement(manySermons);
      });

      const result = getSimilarSermonsHandler(mockDb, { limit: 5 });

      const response = JSON.parse(result.content[0].text);
      expect(response.sermons.length).toBeLessThanOrEqual(5);
    });
  });

  describe('compile_illustrations_for_topic', () => {
    it('finds illustrations by topic keyword', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT')) {
          return createMockStatement({ count: 15 });
        }
        return createMockStatement([sampleIllustration]);
      });

      const result = compileIllustrationsHandler(mockDb, { topic: 'grace' });

      const response = JSON.parse(result.content[0].text);
      expect(response.illustrations).toHaveLength(1);
      expect(response.illustrations[0].source).toBe('keyword_match');
    });

    it('finds illustrations by doctrine chapter', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT')) {
          return createMockStatement({ count: 10 });
        }
        return createMockStatement([sampleIllustration]);
      });

      const result = compileIllustrationsHandler(mockDb, { doctrineChapter: 36 });

      const response = JSON.parse(result.content[0].text);
      expect(response.illustrations[0].source).toContain('doctrine_ch36');
    });

    it('returns recent illustrations when no filter', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT')) {
          return createMockStatement({ count: 5 });
        }
        return createMockStatement([sampleIllustration]);
      });

      const result = compileIllustrationsHandler(mockDb, {});

      const response = JSON.parse(result.content[0].text);
      expect(response.illustrations[0].source).toBe('recent');
    });

    it('includes total illustration count', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT')) {
          return createMockStatement({ count: 42 });
        }
        return createMockStatement([]);
      });

      const result = compileIllustrationsHandler(mockDb, { topic: 'test' });

      const response = JSON.parse(result.content[0].text);
      expect(response.totalIllustrationsInLibrary).toBe(42);
    });
  });

  describe('generate_sermon_structure', () => {
    it('generates scaffold for passage', () => {
      mockDb.prepare.mockImplementation(() => createMockStatement([]));

      const result = generateSermonStructureHandler(mockDb, {
        book: 'JHN',
        startChapter: 3,
        startVerse: 16,
        endChapter: 3,
        endVerse: 21,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.metadata.passage).toBe('JHN 3:16');
      expect(response.outline.introduction).toBeDefined();
      expect(response.outline.mainPoints).toBeDefined();
      expect(response.outline.conclusion).toBeDefined();
      expect(response.resources).toBeDefined();
      expect(response.instructions.nextSteps).toBeDefined();
    });

    it('uses provided sermon title', () => {
      mockDb.prepare.mockImplementation(() => createMockStatement([]));

      const result = generateSermonStructureHandler(mockDb, {
        book: 'ROM',
        startChapter: 8,
        sermonTitle: 'No Condemnation',
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.metadata.title).toBe('No Condemnation');
    });

    it('uses provided main theme', () => {
      mockDb.prepare.mockImplementation(() => createMockStatement([]));

      const result = generateSermonStructureHandler(mockDb, {
        book: 'ROM',
        startChapter: 5,
        mainTheme: 'Justified by faith, we have peace with God',
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.metadata.mainTheme).toBe('Justified by faith, we have peace with God');
      expect(response.outline.introduction.thesis).toBe(
        'Justified by faith, we have peace with God'
      );
    });

    it('includes existing notes in resources', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('notes')) {
          return createMockStatement([sampleDbNote]);
        }
        return createMockStatement([]);
      });

      const result = generateSermonStructureHandler(mockDb, {
        book: 'ROM',
        startChapter: 1,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.resources.existingNotes).toBeDefined();
    });

    it('includes related doctrines in resources', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('doctrines')) {
          return createMockStatement([{ chapter_number: 36, title: 'Justification' }]);
        }
        return createMockStatement([]);
      });

      const result = generateSermonStructureHandler(mockDb, {
        book: 'ROM',
        startChapter: 3,
        startVerse: 21,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.resources.relatedDoctrines).toBeDefined();
    });

    it('handles chapter-level passage (no verses)', () => {
      mockDb.prepare.mockImplementation(() => createMockStatement([]));

      const result = generateSermonStructureHandler(mockDb, {
        book: 'PSA',
        startChapter: 23,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.metadata.passage).toBe('PSA 23');
    });

    it('handles database errors gracefully', () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = generateSermonStructureHandler(mockDb, {
        book: 'JHN',
        startChapter: 3,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });
  });
});
