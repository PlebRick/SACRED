import Database from 'better-sqlite3';

export interface TestNote {
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

/**
 * Create an in-memory SQLite database for testing
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');

  // Create the notes table with the same schema as production
  db.exec(`
    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      book TEXT NOT NULL,
      start_chapter INTEGER NOT NULL,
      start_verse INTEGER,
      end_chapter INTEGER NOT NULL,
      end_verse INTEGER,
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      type TEXT DEFAULT 'note',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX idx_notes_book_chapter ON notes(book, start_chapter, end_chapter);
  `);

  return db;
}

/**
 * Create a sample note for testing
 */
export function createSampleNote(overrides: Partial<TestNote> = {}): TestNote {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    book: 'ROM',
    start_chapter: 1,
    start_verse: 1,
    end_chapter: 1,
    end_verse: 7,
    title: 'Test Note',
    content: '<p>Test content</p>',
    type: 'note',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/**
 * Insert a sample note into the test database
 */
export function insertTestNote(db: Database.Database, note: TestNote): void {
  db.prepare(`
    INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    note.id,
    note.book,
    note.start_chapter,
    note.start_verse,
    note.end_chapter,
    note.end_verse,
    note.title,
    note.content,
    note.type,
    note.created_at,
    note.updated_at
  );
}

/**
 * Get all notes from the test database
 */
export function getAllNotes(db: Database.Database): TestNote[] {
  return db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all() as TestNote[];
}
