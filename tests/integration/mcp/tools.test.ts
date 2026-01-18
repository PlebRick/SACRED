import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock database before imports
const mockDb = {
  prepare: vi.fn(),
  exec: vi.fn(),
  transaction: vi.fn(),
  pragma: vi.fn(),
};

// Create prepared statement mock factory
function createMockStatement(returnValue: unknown = undefined) {
  return {
    run: vi.fn().mockReturnValue({ changes: 1 }),
    get: vi.fn().mockReturnValue(returnValue),
    all: vi.fn().mockReturnValue(returnValue ?? []),
  };
}

// Mock the db module
vi.mock('../../../mcp/src/db.js', () => ({
  default: mockDb,
  db: mockDb,
}));

// Mock logger
vi.mock('../../../mcp/src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

// Test helper to create a mock MCP server that captures tool registrations
class MockMcpServer {
  tools: Map<string, { description: string; schema: unknown; handler: Function }> = new Map();

  tool(name: string, description: string, schema: unknown, handler: Function) {
    this.tools.set(name, { description, schema, handler });
  }

  async callTool(name: string, params: Record<string, unknown>) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return tool.handler(params);
  }
}

// Sample database rows in snake_case format
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

describe('MCP Tools', () => {
  let server: MockMcpServer;

  beforeEach(async () => {
    vi.clearAllMocks();
    server = new MockMcpServer();

    // Import and register tools fresh for each test
    const { registerCrudTools } = await import('../../../mcp/src/tools/notes-crud.js');
    const { registerQueryTools } = await import('../../../mcp/src/tools/notes-query.js');
    const { registerBulkTools } = await import('../../../mcp/src/tools/notes-bulk.js');

    registerCrudTools(server as any);
    registerQueryTools(server as any);
    registerBulkTools(server as any);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('CRUD Tools', () => {
    describe('create_note', () => {
      it('creates a note with valid data', async () => {
        // Mock prepare to return different statements based on query
        mockDb.prepare.mockImplementation((sql: string) => {
          if (sql.includes('INSERT')) {
            return createMockStatement();
          }
          if (sql.includes('SELECT')) {
            return createMockStatement(sampleDbNote);
          }
          return createMockStatement();
        });

        const result = await server.callTool('create_note', {
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

      it('creates a chapter-level note (no verses)', async () => {
        mockDb.prepare.mockImplementation((sql: string) => {
          if (sql.includes('INSERT')) {
            return createMockStatement();
          }
          if (sql.includes('SELECT')) {
            return createMockStatement({
              ...sampleDbNote,
              start_verse: null,
              end_verse: null,
            });
          }
          return createMockStatement();
        });

        const result = await server.callTool('create_note', {
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

      it('handles database errors', async () => {
        mockDb.prepare.mockImplementation(() => {
          throw new Error('Database error');
        });

        const result = await server.callTool('create_note', {
          book: 'ROM',
          startChapter: 1,
          endChapter: 1,
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error creating note');
      });
    });

    describe('update_note', () => {
      it('updates note with partial data', async () => {
        mockDb.prepare.mockImplementation((sql: string) => {
          if (sql.includes('SELECT')) {
            return createMockStatement(sampleDbNote);
          }
          if (sql.includes('UPDATE')) {
            return createMockStatement();
          }
          return createMockStatement();
        });

        const result = await server.callTool('update_note', {
          id: 'note-1',
          title: 'Updated Title',
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
        expect(response.message).toBe('Note updated successfully');
      });

      it('returns error when note not found', async () => {
        mockDb.prepare.mockImplementation(() => createMockStatement(undefined));

        const result = await server.callTool('update_note', {
          id: 'nonexistent',
          title: 'Updated',
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Note not found');
      });

      it('updates all fields when provided', async () => {
        mockDb.prepare.mockImplementation((sql: string) => {
          if (sql.includes('SELECT')) {
            return createMockStatement(sampleDbNote);
          }
          if (sql.includes('UPDATE')) {
            const stmt = createMockStatement();
            return stmt;
          }
          return createMockStatement();
        });

        const result = await server.callTool('update_note', {
          id: 'note-1',
          book: 'GEN',
          startChapter: 2,
          startVerse: 5,
          endChapter: 2,
          endVerse: 10,
          title: 'New Title',
          content: '<p>New content</p>',
          type: 'commentary',
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
      });
    });

    describe('delete_note', () => {
      it('deletes existing note', async () => {
        mockDb.prepare.mockImplementation((sql: string) => {
          if (sql.includes('SELECT')) {
            return createMockStatement(sampleDbNote);
          }
          if (sql.includes('DELETE')) {
            return createMockStatement();
          }
          return createMockStatement();
        });

        const result = await server.callTool('delete_note', { id: 'note-1' });

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
        expect(response.message).toBe('Note deleted successfully');
        expect(response.deletedNote.id).toBe('note-1');
      });

      it('returns error when note not found', async () => {
        mockDb.prepare.mockImplementation(() => createMockStatement(undefined));

        const result = await server.callTool('delete_note', { id: 'nonexistent' });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Note not found');
      });
    });
  });

  describe('Query Tools', () => {
    describe('list_notes', () => {
      it('returns all notes with pagination info', async () => {
        mockDb.prepare.mockImplementation((sql: string) => {
          if (sql.includes('COUNT')) {
            return createMockStatement({ count: 3 });
          }
          if (sql.includes('SELECT *')) {
            return createMockStatement([sampleDbNote, { ...sampleDbNote, id: 'note-2' }]);
          }
          return createMockStatement();
        });

        const result = await server.callTool('list_notes', { limit: 10, offset: 0 });

        const response = JSON.parse(result.content[0].text);
        expect(response.notes).toHaveLength(2);
        expect(response.total).toBe(3);
        expect(response.limit).toBe(10);
        expect(response.offset).toBe(0);
      });

      it('uses default pagination values', async () => {
        mockDb.prepare.mockImplementation((sql: string) => {
          if (sql.includes('COUNT')) {
            return createMockStatement({ count: 0 });
          }
          return createMockStatement([]);
        });

        const result = await server.callTool('list_notes', {});

        const response = JSON.parse(result.content[0].text);
        expect(response.limit).toBe(100);
        expect(response.offset).toBe(0);
      });
    });

    describe('get_note', () => {
      it('returns note when found', async () => {
        mockDb.prepare.mockImplementation(() => createMockStatement(sampleDbNote));

        const result = await server.callTool('get_note', { id: 'note-1' });

        const response = JSON.parse(result.content[0].text);
        expect(response.id).toBe('note-1');
        expect(response.book).toBe('ROM');
        expect(response.startChapter).toBe(1);
      });

      it('returns error when note not found', async () => {
        mockDb.prepare.mockImplementation(() => createMockStatement(undefined));

        const result = await server.callTool('get_note', { id: 'nonexistent' });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Note not found');
      });
    });

    describe('get_chapter_notes', () => {
      it('returns notes for specific chapter', async () => {
        mockDb.prepare.mockImplementation(() =>
          createMockStatement([sampleDbNote, { ...sampleDbNote, id: 'note-2' }])
        );

        const result = await server.callTool('get_chapter_notes', {
          book: 'ROM',
          chapter: 1,
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.book).toBe('ROM');
        expect(response.chapter).toBe(1);
        expect(response.notes).toHaveLength(2);
        expect(response.count).toBe(2);
      });

      it('converts book code to uppercase', async () => {
        let capturedQuery: string | undefined;
        let capturedParams: unknown[] | undefined;

        mockDb.prepare.mockImplementation((sql: string) => {
          capturedQuery = sql;
          return {
            all: vi.fn().mockImplementation((...params: unknown[]) => {
              capturedParams = params;
              return [];
            }),
          };
        });

        await server.callTool('get_chapter_notes', {
          book: 'rom',
          chapter: 1,
        });

        expect(capturedParams?.[0]).toBe('ROM');
      });
    });

    describe('get_notes_summary', () => {
      it('returns summary statistics', async () => {
        mockDb.prepare.mockImplementation((sql: string) => {
          if (sql.includes('COUNT(*)') && !sql.includes('GROUP BY')) {
            return createMockStatement({ count: 10 });
          }
          if (sql.includes('GROUP BY type')) {
            return createMockStatement([
              { type: 'note', count: 5 },
              { type: 'commentary', count: 3 },
              { type: 'sermon', count: 2 },
            ]);
          }
          if (sql.includes('GROUP BY book')) {
            return createMockStatement([
              { book: 'ROM', count: 4 },
              { book: 'JHN', count: 3 },
            ]);
          }
          if (sql.includes('ORDER BY updated_at')) {
            return createMockStatement([sampleDbNote]);
          }
          return createMockStatement([]);
        });

        const result = await server.callTool('get_notes_summary', {});

        const response = JSON.parse(result.content[0].text);
        expect(response.total).toBe(10);
        expect(response.byType.note).toBe(5);
        expect(response.byType.commentary).toBe(3);
        expect(response.byBook.ROM).toBe(4);
        expect(response.recentlyUpdated).toHaveLength(1);
      });
    });
  });

  describe('Bulk Tools', () => {
    describe('search_notes', () => {
      it('searches notes using FTS5', async () => {
        mockDb.prepare.mockImplementation(() =>
          createMockStatement([
            { ...sampleDbNote, rank: -1.5 },
            { ...sampleDbNote, id: 'note-2', rank: -2.0 },
          ])
        );

        const result = await server.callTool('search_notes', {
          query: 'test content',
          limit: 20,
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.query).toBe('test content');
        expect(response.results).toHaveLength(2);
        expect(response.results[0].rank).toBe(-1.5);
        expect(response.count).toBe(2);
      });

      it('handles FTS5 search errors', async () => {
        mockDb.prepare.mockImplementation(() => {
          throw new Error('FTS5 error');
        });

        const result = await server.callTool('search_notes', {
          query: 'invalid query syntax [[',
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error searching notes');
      });
    });

    describe('export_notes', () => {
      it('exports all notes as JSON', async () => {
        mockDb.prepare.mockImplementation(() =>
          createMockStatement([sampleDbNote, { ...sampleDbNote, id: 'note-2' }])
        );

        const result = await server.callTool('export_notes', {});

        const response = JSON.parse(result.content[0].text);
        expect(response.version).toBe(1);
        expect(response.exportedAt).toBeDefined();
        expect(response.notes).toHaveLength(2);
        // Verify camelCase format
        expect(response.notes[0].startChapter).toBe(1);
        expect(response.notes[0]).not.toHaveProperty('start_chapter');
      });
    });

    describe('import_notes', () => {
      it('inserts new notes', async () => {
        const insertRun = vi.fn();
        const updateRun = vi.fn();
        const checkGet = vi.fn().mockReturnValue(undefined);

        mockDb.prepare.mockImplementation((sql: string) => {
          if (sql.includes('INSERT')) {
            return { run: insertRun };
          }
          if (sql.includes('UPDATE')) {
            return { run: updateRun };
          }
          if (sql.includes('SELECT id')) {
            return { get: checkGet };
          }
          return createMockStatement();
        });

        mockDb.transaction.mockImplementation((fn: Function) => fn);

        const result = await server.callTool('import_notes', {
          notes: [
            {
              book: 'ROM',
              startChapter: 1,
              endChapter: 1,
              title: 'New Note',
            },
            {
              book: 'GEN',
              startChapter: 1,
              endChapter: 1,
              title: 'Another Note',
            },
          ],
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
        expect(response.inserted).toBe(2);
        expect(response.updated).toBe(0);
        expect(response.total).toBe(2);
      });

      it('updates existing notes', async () => {
        const insertRun = vi.fn();
        const updateRun = vi.fn();
        const checkGet = vi.fn().mockReturnValue({ id: 'existing-id' });

        mockDb.prepare.mockImplementation((sql: string) => {
          if (sql.includes('INSERT')) {
            return { run: insertRun };
          }
          if (sql.includes('UPDATE')) {
            return { run: updateRun };
          }
          if (sql.includes('SELECT id')) {
            return { get: checkGet };
          }
          return createMockStatement();
        });

        mockDb.transaction.mockImplementation((fn: Function) => fn);

        const result = await server.callTool('import_notes', {
          notes: [
            {
              id: 'existing-id',
              book: 'ROM',
              startChapter: 1,
              endChapter: 1,
              title: 'Updated Note',
            },
          ],
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
        expect(response.inserted).toBe(0);
        expect(response.updated).toBe(1);
      });

      it('handles mixed insert and update', async () => {
        let callCount = 0;
        const checkGet = vi.fn().mockImplementation(() => {
          callCount++;
          // First note exists, second doesn't
          return callCount === 1 ? { id: 'existing-id' } : undefined;
        });

        mockDb.prepare.mockImplementation((sql: string) => {
          if (sql.includes('INSERT')) {
            return { run: vi.fn() };
          }
          if (sql.includes('UPDATE')) {
            return { run: vi.fn() };
          }
          if (sql.includes('SELECT id')) {
            return { get: checkGet };
          }
          return createMockStatement();
        });

        mockDb.transaction.mockImplementation((fn: Function) => fn);

        const result = await server.callTool('import_notes', {
          notes: [
            { id: 'existing-id', book: 'ROM', startChapter: 1, endChapter: 1 },
            { book: 'GEN', startChapter: 1, endChapter: 1 },
          ],
        });

        const response = JSON.parse(result.content[0].text);
        expect(response.inserted).toBe(1);
        expect(response.updated).toBe(1);
        expect(response.total).toBe(2);
      });
    });

    describe('get_books_with_notes', () => {
      it('returns summary of books with notes', async () => {
        mockDb.prepare.mockImplementation(() =>
          createMockStatement([
            { book: 'ROM', noteCount: 5, firstChapter: 1, lastChapter: 8 },
            { book: 'JHN', noteCount: 3, firstChapter: 1, lastChapter: 3 },
          ])
        );

        const result = await server.callTool('get_books_with_notes', {});

        const response = JSON.parse(result.content[0].text);
        expect(response.books).toHaveLength(2);
        expect(response.books[0].book).toBe('ROM');
        expect(response.books[0].noteCount).toBe(5);
        expect(response.totalBooks).toBe(2);
        expect(response.totalNotes).toBe(8);
      });

      it('returns empty when no notes exist', async () => {
        mockDb.prepare.mockImplementation(() => createMockStatement([]));

        const result = await server.callTool('get_books_with_notes', {});

        const response = JSON.parse(result.content[0].text);
        expect(response.books).toHaveLength(0);
        expect(response.totalBooks).toBe(0);
        expect(response.totalNotes).toBe(0);
      });
    });
  });

  describe('Tool Registration', () => {
    it('registers all CRUD tools', () => {
      expect(server.tools.has('create_note')).toBe(true);
      expect(server.tools.has('update_note')).toBe(true);
      expect(server.tools.has('delete_note')).toBe(true);
    });

    it('registers all query tools', () => {
      expect(server.tools.has('list_notes')).toBe(true);
      expect(server.tools.has('get_note')).toBe(true);
      expect(server.tools.has('get_chapter_notes')).toBe(true);
      expect(server.tools.has('get_notes_summary')).toBe(true);
    });

    it('registers all bulk tools', () => {
      expect(server.tools.has('search_notes')).toBe(true);
      expect(server.tools.has('export_notes')).toBe(true);
      expect(server.tools.has('import_notes')).toBe(true);
      expect(server.tools.has('get_books_with_notes')).toBe(true);
    });
  });

  describe('Response Format', () => {
    it('returns content array with text type', async () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('INSERT')) {
          return createMockStatement();
        }
        return createMockStatement(sampleDbNote);
      });

      const result = await server.callTool('create_note', {
        book: 'ROM',
        startChapter: 1,
        endChapter: 1,
      });

      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('includes isError flag on errors', async () => {
      mockDb.prepare.mockImplementation(() => createMockStatement(undefined));

      const result = await server.callTool('get_note', { id: 'nonexistent' });

      expect(result.isError).toBe(true);
    });

    it('converts snake_case to camelCase in responses', async () => {
      mockDb.prepare.mockImplementation(() => createMockStatement(sampleDbNote));

      const result = await server.callTool('get_note', { id: 'note-1' });

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
});
