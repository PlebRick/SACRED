const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(__dirname, '../data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'sacred.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
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

  CREATE INDEX IF NOT EXISTS idx_notes_book_chapter
    ON notes(book, start_chapter, end_chapter);

  -- Topics table for hierarchical categories
  CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES topics(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_topics_parent ON topics(parent_id);

  -- Many-to-many for secondary tags
  CREATE TABLE IF NOT EXISTS note_tags (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, topic_id)
  );

  CREATE INDEX IF NOT EXISTS idx_note_tags_note ON note_tags(note_id);
  CREATE INDEX IF NOT EXISTS idx_note_tags_topic ON note_tags(topic_id);
`);

// Migration: Add primary_topic_id to notes table if it doesn't exist
const columns = db.prepare("PRAGMA table_info(notes)").all();
const hasPrimaryTopicId = columns.some(col => col.name === 'primary_topic_id');
if (!hasPrimaryTopicId) {
  db.exec(`ALTER TABLE notes ADD COLUMN primary_topic_id TEXT REFERENCES topics(id)`);
}

module.exports = db;
