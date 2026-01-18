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
