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

  -- ===========================================
  -- SYSTEMATIC THEOLOGY TABLES
  -- ===========================================

  -- Main content table: parts, chapters, sections, sub-sections
  CREATE TABLE IF NOT EXISTS systematic_theology (
    id TEXT PRIMARY KEY,                    -- UUID
    entry_type TEXT NOT NULL,               -- 'part', 'chapter', 'section', 'subsection'
    part_number INTEGER,                    -- 1-7 (null for top-level)
    chapter_number INTEGER,                 -- 1-57 (null for parts)
    section_letter TEXT,                    -- 'A', 'B', etc. (null for parts/chapters)
    subsection_number INTEGER,              -- 1, 2, 3, etc. (null unless subsection)
    title TEXT NOT NULL,                    -- Display title
    content TEXT,                           -- HTML content
    summary TEXT,                           -- AI-generated summary for tooltips
    parent_id TEXT REFERENCES systematic_theology(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,  -- For ordering within parent
    word_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_st_entry_type ON systematic_theology(entry_type);
  CREATE INDEX IF NOT EXISTS idx_st_chapter ON systematic_theology(chapter_number);
  CREATE INDEX IF NOT EXISTS idx_st_parent ON systematic_theology(parent_id);
  CREATE INDEX IF NOT EXISTS idx_st_part_chapter ON systematic_theology(part_number, chapter_number);

  -- Scripture index: maps Bible verses to systematic theology entries
  CREATE TABLE IF NOT EXISTS systematic_scripture_index (
    id TEXT PRIMARY KEY,
    systematic_id TEXT NOT NULL REFERENCES systematic_theology(id) ON DELETE CASCADE,
    book TEXT NOT NULL,                     -- 3-letter code: 'JHN', 'ROM'
    chapter INTEGER NOT NULL,
    start_verse INTEGER,                    -- null for chapter-level reference
    end_verse INTEGER,                      -- null for single verse
    is_primary INTEGER DEFAULT 0,           -- 1 = key/primary reference for this doctrine
    context_snippet TEXT,                   -- Brief context from ST content
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ssi_systematic ON systematic_scripture_index(systematic_id);
  CREATE INDEX IF NOT EXISTS idx_ssi_book_chapter ON systematic_scripture_index(book, chapter);
  CREATE INDEX IF NOT EXISTS idx_ssi_primary ON systematic_scripture_index(is_primary);

  -- User annotations on systematic theology content
  CREATE TABLE IF NOT EXISTS systematic_annotations (
    id TEXT PRIMARY KEY,
    systematic_id TEXT NOT NULL REFERENCES systematic_theology(id) ON DELETE CASCADE,
    annotation_type TEXT NOT NULL,          -- 'highlight', 'note'
    color TEXT,                             -- For highlights: 'yellow', 'green', 'blue', 'pink'
    content TEXT,                           -- User's note text (HTML)
    text_selection TEXT,                    -- The selected text being annotated
    position_start INTEGER,                 -- Character position in content
    position_end INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sa_systematic ON systematic_annotations(systematic_id);
  CREATE INDEX IF NOT EXISTS idx_sa_type ON systematic_annotations(annotation_type);

  -- Cross-references between chapters ("see also" links)
  CREATE TABLE IF NOT EXISTS systematic_related (
    id TEXT PRIMARY KEY,
    source_chapter INTEGER NOT NULL,        -- Chapter number of source
    target_chapter INTEGER NOT NULL,        -- Chapter number of target
    relationship_type TEXT DEFAULT 'see_also', -- 'see_also', 'contrasts_with', 'builds_on'
    note TEXT,                              -- Optional context
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sr_source ON systematic_related(source_chapter);
  CREATE INDEX IF NOT EXISTS idx_sr_target ON systematic_related(target_chapter);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sr_unique ON systematic_related(source_chapter, target_chapter);

  -- Tag definitions for filtering/categorizing ST chapters
  CREATE TABLE IF NOT EXISTS systematic_tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,              -- 'Doctrine of God', 'Christology', etc.
    color TEXT,                             -- Display color
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  -- Many-to-many: chapters to tags
  CREATE TABLE IF NOT EXISTS systematic_chapter_tags (
    chapter_number INTEGER NOT NULL,
    tag_id TEXT NOT NULL REFERENCES systematic_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (chapter_number, tag_id)
  );

  CREATE INDEX IF NOT EXISTS idx_sct_chapter ON systematic_chapter_tags(chapter_number);
  CREATE INDEX IF NOT EXISTS idx_sct_tag ON systematic_chapter_tags(tag_id);

  -- ===========================================
  -- STUDY SESSION TRACKING
  -- ===========================================

  -- Track what the user studies for Claude's memory
  CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY,                    -- UUID
    session_type TEXT NOT NULL,             -- 'bible', 'doctrine', 'note'
    reference_id TEXT NOT NULL,             -- 'JHN:3', 'ch32', note UUID
    reference_label TEXT,                   -- 'John 3', 'The Trinity', note title
    duration_seconds INTEGER,               -- Time spent (optional, for future use)
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_type ON study_sessions(session_type);
  CREATE INDEX IF NOT EXISTS idx_sessions_date ON study_sessions(created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_ref ON study_sessions(reference_id);
`);

// Full-text search for systematic theology
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS systematic_theology_fts USING fts5(
    title,
    content,
    summary,
    content='systematic_theology',
    content_rowid='rowid'
  );
`);

// Triggers to keep FTS in sync
db.exec(`
  CREATE TRIGGER IF NOT EXISTS systematic_theology_ai AFTER INSERT ON systematic_theology BEGIN
    INSERT INTO systematic_theology_fts(rowid, title, content, summary)
    VALUES (NEW.rowid, NEW.title, NEW.content, NEW.summary);
  END;

  CREATE TRIGGER IF NOT EXISTS systematic_theology_ad AFTER DELETE ON systematic_theology BEGIN
    INSERT INTO systematic_theology_fts(systematic_theology_fts, rowid, title, content, summary)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.summary);
  END;

  CREATE TRIGGER IF NOT EXISTS systematic_theology_au AFTER UPDATE ON systematic_theology BEGIN
    INSERT INTO systematic_theology_fts(systematic_theology_fts, rowid, title, content, summary)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.summary);
    INSERT INTO systematic_theology_fts(rowid, title, content, summary)
    VALUES (NEW.rowid, NEW.title, NEW.content, NEW.summary);
  END;
`);

// Full-text search for notes
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title,
    content,
    content='notes',
    content_rowid='rowid'
  );
`);

// Triggers to keep notes FTS in sync
db.exec(`
  CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, content)
    VALUES (NEW.rowid, NEW.title, NEW.content);
  END;

  CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
  END;

  CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
    INSERT INTO notes_fts(rowid, title, content)
    VALUES (NEW.rowid, NEW.title, NEW.content);
  END;
`);

// Rebuild notes FTS index from existing data (one-time migration)
function rebuildNotesFtsIndex() {
  try {
    const notesCount = db.prepare('SELECT COUNT(*) as c FROM notes').get().c;

    if (notesCount > 0) {
      // For external content FTS5 tables, use the 'rebuild' command
      db.exec(`INSERT INTO notes_fts(notes_fts) VALUES('rebuild')`);
      console.log(`Notes FTS index rebuilt for ${notesCount} notes.`);
    }
  } catch (err) {
    console.error('Failed to rebuild notes FTS index:', err.message);
  }
}

rebuildNotesFtsIndex();

// Migration: Add primary_topic_id to notes table if it doesn't exist
const columns = db.prepare("PRAGMA table_info(notes)").all();
const hasPrimaryTopicId = columns.some(col => col.name === 'primary_topic_id');
if (!hasPrimaryTopicId) {
  db.exec(`ALTER TABLE notes ADD COLUMN primary_topic_id TEXT REFERENCES topics(id)`);
}

// Migration: Add systematic_tag_id to topics table for Grudem integration
const topicColumns = db.prepare("PRAGMA table_info(topics)").all();
const hasSystematicTagId = topicColumns.some(col => col.name === 'systematic_tag_id');
if (!hasSystematicTagId) {
  db.exec(`ALTER TABLE topics ADD COLUMN systematic_tag_id TEXT REFERENCES systematic_tags(id) ON DELETE SET NULL`);
  // Create index for efficient lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_topics_systematic_tag ON topics(systematic_tag_id)`);
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

// Seed default systematic theology tags (Grudem's 7 parts)
function seedDefaultSystematicTags() {
  const count = db.prepare('SELECT COUNT(*) as count FROM systematic_tags').get().count;
  if (count === 0) {
    const defaultTags = [
      { id: 'doctrine-word', name: 'Doctrine of the Word of God', color: '#3b82f6', sort_order: 1 },
      { id: 'doctrine-god', name: 'Doctrine of God', color: '#8b5cf6', sort_order: 2 },
      { id: 'doctrine-man', name: 'Doctrine of Man', color: '#10b981', sort_order: 3 },
      { id: 'doctrine-christ-spirit', name: 'Doctrines of Christ and the Holy Spirit', color: '#f59e0b', sort_order: 4 },
      { id: 'doctrine-salvation', name: 'Doctrine of the Application of Redemption', color: '#ef4444', sort_order: 5 },
      { id: 'doctrine-church', name: 'Doctrine of the Church', color: '#ec4899', sort_order: 6 },
      { id: 'doctrine-future', name: 'Doctrine of the Future', color: '#06b6d4', sort_order: 7 }
    ];

    const insert = db.prepare(`
      INSERT INTO systematic_tags (id, name, color, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    for (const tag of defaultTags) {
      insert.run(tag.id, tag.name, tag.color, tag.sort_order, now);
    }
  }
}

seedDefaultSystematicTags();

// ===========================================
// SERMON SERIES
// ===========================================

// Create series table for grouping sermons
db.exec(`
  CREATE TABLE IF NOT EXISTS series (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

// ===========================================
// AUTHENTICATION SESSIONS
// ===========================================

// Create auth sessions table for web hosting
db.exec(`
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )
`);

// Index for session expiry cleanup
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at)
`);

// Migration: Add series_id to notes table if it doesn't exist
const notesColumnsForSeries = db.prepare("PRAGMA table_info(notes)").all();
const hasSeriesId = notesColumnsForSeries.some(col => col.name === 'series_id');
if (!hasSeriesId) {
  db.exec(`ALTER TABLE notes ADD COLUMN series_id TEXT REFERENCES series(id) ON DELETE SET NULL`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_series ON notes(series_id)`);
}

// ===========================================
// ILLUSTRATION DUPLICATE DETECTION
// ===========================================

// Migration: Add text_signature to inline_tags for duplicate detection
const inlineTagsCols = db.prepare("PRAGMA table_info(inline_tags)").all();
const hasTextSignature = inlineTagsCols.some(col => col.name === 'text_signature');
if (!hasTextSignature) {
  db.exec(`ALTER TABLE inline_tags ADD COLUMN text_signature TEXT`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_inline_tags_signature ON inline_tags(text_signature)`);
}

module.exports = db;
