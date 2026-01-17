import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Database path: use env var or default to ../data/sacred.db relative to mcp folder
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/sacred.db');
logger.info(`Connecting to database at: ${dbPath}`);
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
// Verify connection by checking if notes table exists
const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'").get();
if (!tableCheck) {
    logger.error('Notes table not found. Ensure the SACRED app has been run at least once.');
}
// Create FTS5 virtual table for full-text search
try {
    db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      id,
      title,
      content,
      content=notes,
      content_rowid=rowid
    );
  `);
    // Check if triggers exist before creating
    const triggerCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='notes_ai'").get();
    if (!triggerCheck) {
        db.exec(`
      CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, id, title, content)
        VALUES (NEW.rowid, NEW.id, NEW.title, NEW.content);
      END;

      CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, id, title, content)
        VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.content);
      END;

      CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, id, title, content)
        VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.content);
        INSERT INTO notes_fts(rowid, id, title, content)
        VALUES (NEW.rowid, NEW.id, NEW.title, NEW.content);
      END;
    `);
        // Rebuild index with existing data
        db.exec(`INSERT INTO notes_fts(notes_fts) VALUES('rebuild')`);
        logger.info('FTS5 search index created and populated');
    }
}
catch (error) {
    logger.error('Error setting up FTS5:', error);
}
export default db;
