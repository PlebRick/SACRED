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

  -- Inline tag type definitions (predefined + custom)
  CREATE TABLE IF NOT EXISTS inline_tag_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    icon TEXT,
    is_default INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  -- Extracted inline tags for search/browse
  CREATE TABLE IF NOT EXISTS inline_tags (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_type TEXT NOT NULL REFERENCES inline_tag_types(id) ON DELETE CASCADE,
    text_content TEXT NOT NULL,
    html_fragment TEXT NOT NULL,
    position_start INTEGER NOT NULL,
    position_end INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_inline_tags_note ON inline_tags(note_id);
  CREATE INDEX IF NOT EXISTS idx_inline_tags_type ON inline_tags(tag_type);
`);

// Migration: Add primary_topic_id to notes table if it doesn't exist
const columns = db.prepare("PRAGMA table_info(notes)").all();
const hasPrimaryTopicId = columns.some(col => col.name === 'primary_topic_id');
if (!hasPrimaryTopicId) {
  db.exec(`ALTER TABLE notes ADD COLUMN primary_topic_id TEXT REFERENCES topics(id)`);
}

// Seed default inline tag types if table is empty
function seedDefaultInlineTagTypes() {
  const count = db.prepare('SELECT COUNT(*) as count FROM inline_tag_types').get().count;
  if (count === 0) {
    const defaultTypes = [
      { id: 'illustration', name: 'Illustration', color: '#60a5fa', icon: '💡', sort_order: 0 },
      { id: 'application', name: 'Application', color: '#34d399', icon: '✅', sort_order: 1 },
      { id: 'keypoint', name: 'Key Point', color: '#fbbf24', icon: '⭐', sort_order: 2 },
      { id: 'quote', name: 'Quote', color: '#a78bfa', icon: '💬', sort_order: 3 },
      { id: 'crossref', name: 'Cross-Ref', color: '#f472b6', icon: '🔗', sort_order: 4 }
    ];

    const insert = db.prepare(`
      INSERT INTO inline_tag_types (id, name, color, icon, is_default, sort_order, created_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `);

    const now = new Date().toISOString();
    for (const type of defaultTypes) {
      insert.run(type.id, type.name, type.color, type.icon, type.sort_order, now);
    }
  }
}

seedDefaultInlineTagTypes();

module.exports = db;
