/**
 * In-memory database mock that doesn't require native modules.
 * Used for testing API routes without better-sqlite3.
 */

export interface MockNote {
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

export interface MockSession {
  id: string;
  session_type: string;
  reference_id: string;
  reference_label: string | null;
  duration_seconds: number | null;
  created_at: string;
}

interface PreparedStatement<T = MockNote> {
  run: (...args: (string | number | null)[]) => { changes: number };
  get: (...args: (string | number | null)[]) => T | undefined;
  all: (...args: (string | number | null)[]) => T[];
}

export class MockDatabase {
  private notes: Map<string, MockNote> = new Map();
  private sessions: Map<string, MockSession> = new Map();

  prepare(sql: string): PreparedStatement {
    const db = this;

    // Parse the SQL to determine what operation it is
    const sqlLower = sql.toLowerCase().trim();

    if (sqlLower.startsWith('select * from notes where id')) {
      return {
        run: () => ({ changes: 0 }),
        get: (id: string) => db.notes.get(id),
        all: () => Array.from(db.notes.values()),
      };
    }

    if (sqlLower.startsWith('select id from notes where id')) {
      return {
        run: () => ({ changes: 0 }),
        get: (id: string) => (db.notes.has(id) ? { id } : undefined),
        all: () => [],
      };
    }

    if (sqlLower.startsWith('select * from notes order by updated_at desc')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () =>
          Array.from(db.notes.values()).sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          ),
      };
    }

    if (sqlLower.startsWith('select * from notes order by created_at asc')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () =>
          Array.from(db.notes.values()).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ),
      };
    }

    if (sqlLower.includes('select * from notes') && sqlLower.includes('where book')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: (book: string, chapterNum: number, _chapterNum2: number) => {
          return Array.from(db.notes.values())
            .filter(
              (n) =>
                n.book === book &&
                n.start_chapter <= chapterNum &&
                n.end_chapter >= chapterNum
            )
            .sort((a, b) => {
              if (a.start_chapter !== b.start_chapter) return a.start_chapter - b.start_chapter;
              return (a.start_verse ?? 0) - (b.start_verse ?? 0);
            });
        },
      };
    }

    if (sqlLower.startsWith('select count') && sqlLower.includes('from notes')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => ({ count: db.notes.size }),
        all: () => [{ count: db.notes.size }],
      };
    }

    if (sqlLower.startsWith('select max(updated_at)')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => {
          const notes = Array.from(db.notes.values());
          if (notes.length === 0) return { lastModified: null };
          const latest = notes.reduce((a, b) =>
            new Date(a.updated_at) > new Date(b.updated_at) ? a : b
          );
          return { lastModified: latest.updated_at };
        },
        all: () => [],
      };
    }

    if (sqlLower.startsWith('insert into notes')) {
      return {
        run: (
          id: string,
          book: string,
          start_chapter: number,
          start_verse: number | null,
          end_chapter: number,
          end_verse: number | null,
          title: string,
          content: string,
          type: string,
          created_at: string,
          updated_at: string
        ) => {
          db.notes.set(id, {
            id,
            book,
            start_chapter,
            start_verse,
            end_chapter,
            end_verse,
            title,
            content,
            type,
            created_at,
            updated_at,
          });
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (sqlLower.startsWith('update notes')) {
      return {
        run: (
          book: string,
          start_chapter: number,
          start_verse: number | null,
          end_chapter: number,
          end_verse: number | null,
          title: string,
          content: string,
          type: string,
          updated_at: string,
          id: string
        ) => {
          const existing = db.notes.get(id);
          if (!existing) return { changes: 0 };
          db.notes.set(id, {
            ...existing,
            book,
            start_chapter,
            start_verse,
            end_chapter,
            end_verse,
            title,
            content,
            type,
            updated_at,
          });
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (sqlLower.startsWith('delete from notes where id')) {
      return {
        run: (id: string) => {
          const existed = db.notes.has(id);
          db.notes.delete(id);
          return { changes: existed ? 1 : 0 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (sqlLower === 'delete from notes') {
      return {
        run: () => {
          const count = db.notes.size;
          db.notes.clear();
          return { changes: count };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // Session queries
    if (sqlLower.startsWith('insert into study_sessions')) {
      return {
        run: (
          id: string,
          session_type: string,
          reference_id: string,
          reference_label: string | null,
          duration_seconds: number | null,
          created_at: string
        ) => {
          db.sessions.set(id, {
            id,
            session_type,
            reference_id,
            reference_label,
            duration_seconds,
            created_at,
          });
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (sqlLower.startsWith('select * from study_sessions where id')) {
      return {
        run: () => ({ changes: 0 }),
        get: (id: string) => db.sessions.get(id),
        all: () => Array.from(db.sessions.values()),
      };
    }

    if (sqlLower.includes('select * from study_sessions') && sqlLower.includes('order by created_at desc')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: (...args: (string | number | null)[]) => {
          let results = Array.from(db.sessions.values());
          // Simple filtering - in real tests we'd parse more carefully
          results = results.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          // Apply limit if provided (last two args are usually limit, offset)
          const limit = typeof args[args.length - 2] === 'number' ? args[args.length - 2] as number : 50;
          return results.slice(0, limit);
        },
      };
    }

    if (sqlLower.includes('select') && sqlLower.includes('from study_sessions') && sqlLower.includes('group by session_type')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => {
          const counts: Record<string, number> = {};
          db.sessions.forEach(s => {
            counts[s.session_type] = (counts[s.session_type] || 0) + 1;
          });
          return Object.entries(counts).map(([type, count]) => ({ type, count }));
        },
      };
    }

    if (sqlLower.includes('count(*)') && sqlLower.includes('study_sessions') && !sqlLower.includes('group by')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => ({ count: db.sessions.size }),
        all: () => [{ count: db.sessions.size }],
      };
    }

    if (sqlLower.startsWith('delete from study_sessions')) {
      return {
        run: () => {
          const count = db.sessions.size;
          db.sessions.clear();
          return { changes: count };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // Default fallback
    return {
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    };
  }

  transaction<T>(fn: () => T): () => T {
    return fn;
  }

  exec(_sql: string): void {
    // No-op for schema creation
  }

  clear(): void {
    this.notes.clear();
    this.sessions.clear();
  }
}

export function createMockDb(): MockDatabase {
  return new MockDatabase();
}
