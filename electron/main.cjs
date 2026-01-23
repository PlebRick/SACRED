const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');

// Database path - production uses userData, dev uses local
function getDbPath() {
  if (app.isPackaged) {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    return path.join(userDataPath, 'sacred.db');
  }
  return path.join(__dirname, '../data/sacred.db');
}

// Set DB_PATH before loading server modules
process.env.DB_PATH = getDbPath();

// Auto-restore systematic theology data if empty
function restoreSystematicTheologyIfNeeded() {
  console.log('[ST Restore] Starting systematic theology restore check...');
  console.log('[ST Restore] app.isPackaged:', app.isPackaged);
  console.log('[ST Restore] process.resourcesPath:', process.resourcesPath);

  const Database = require('better-sqlite3');
  const dbPath = process.env.DB_PATH;
  console.log('[ST Restore] Database path:', dbPath);

  if (!fs.existsSync(dbPath)) {
    console.log('[ST Restore] Database does not exist yet, skipping');
    return;
  }

  const db = new Database(dbPath);

  try {
    // Check if systematic_theology table exists and is empty
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='systematic_theology'
    `).get();

    if (!tableExists) {
      console.log('[ST Restore] systematic_theology table does not exist yet');
      db.close();
      return;
    }
    console.log('[ST Restore] Table exists');

    const count = db.prepare('SELECT COUNT(*) as count FROM systematic_theology').get().count;
    console.log('[ST Restore] Current entry count:', count);

    if (count > 0) {
      console.log('[ST Restore] Already has data, skipping restore');
      db.close();
      return;
    }

    // Find the JSON data file
    // In packaged app: extraResources are in Contents/Resources/
    // In dev: use the source file in myfiles/
    const jsonPath = app.isPackaged
      ? path.join(process.resourcesPath, 'systematic-theology-complete.json')
      : path.join(__dirname, '../myfiles/grudem-sys-theo-parsed/systematic-theology-complete.json');

    console.log('[ST Restore] Looking for JSON at:', jsonPath);
    console.log('[ST Restore] File exists:', fs.existsSync(jsonPath));

    if (!fs.existsSync(jsonPath)) {
      console.log('[ST Restore] JSON file not found!');
      // List what IS in the resources folder
      if (app.isPackaged) {
        try {
          const files = fs.readdirSync(process.resourcesPath);
          console.log('[ST Restore] Files in resourcesPath:', files.slice(0, 20));
        } catch (e) {
          console.log('[ST Restore] Could not list resourcesPath:', e.message);
        }
      }
      db.close();
      return;
    }

    console.log('[ST Restore] Loading JSON data...');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log('[ST Restore] JSON loaded, entries:', data.systematic_theology?.length || 'N/A');

    // Disable foreign key checks for bulk import (parent_id references)
    db.pragma('foreign_keys = OFF');

    // Begin transaction
    const transaction = db.transaction(() => {
      const entries = data.systematic_theology || data;

      // Insert main entries
      const insertEntry = db.prepare(`
        INSERT OR REPLACE INTO systematic_theology (
          id, entry_type, part_number, chapter_number, section_letter, subsection_number,
          title, content, summary, parent_id, sort_order, word_count, created_at, updated_at
        ) VALUES (
          @id, @entry_type, @part_number, @chapter_number, @section_letter, @subsection_number,
          @title, @content, @summary, @parent_id, @sort_order, @word_count, @created_at, @updated_at
        )
      `);

      for (const entry of entries) {
        insertEntry.run({
          id: entry.id,
          entry_type: entry.entry_type,
          part_number: entry.part_number || null,
          chapter_number: entry.chapter_number || null,
          section_letter: entry.section_letter || null,
          subsection_number: entry.subsection_number || null,
          title: entry.title,
          content: entry.content || null,
          summary: entry.summary || null,
          parent_id: entry.parent_id || null,
          sort_order: entry.sort_order || 0,
          word_count: entry.word_count || 0,
          created_at: entry.created_at,
          updated_at: entry.updated_at
        });
      }
      console.log(`  Restored ${entries.length} main entries`);

      // Scripture index
      if (data.scripture_index?.length > 0) {
        const insertScripture = db.prepare(`
          INSERT OR REPLACE INTO systematic_scripture_index (
            id, systematic_id, book, chapter, start_verse, end_verse,
            is_primary, context_snippet, created_at
          ) VALUES (
            @id, @systematic_id, @book, @chapter, @start_verse, @end_verse,
            @is_primary, @context_snippet, @created_at
          )
        `);

        for (const ref of data.scripture_index) {
          insertScripture.run({
            id: ref.id,
            systematic_id: ref.systematic_id,
            book: ref.book,
            chapter: ref.chapter,
            start_verse: ref.start_verse || null,
            end_verse: ref.end_verse || null,
            is_primary: ref.is_primary || 0,
            context_snippet: ref.context_snippet || null,
            created_at: ref.created_at
          });
        }
        console.log(`  Restored ${data.scripture_index.length} scripture references`);
      }

      // Tags
      if (data.tags?.length > 0) {
        const insertTag = db.prepare(`
          INSERT OR REPLACE INTO systematic_tags (id, name, color, sort_order, created_at)
          VALUES (@id, @name, @color, @sort_order, @created_at)
        `);

        for (const tag of data.tags) {
          insertTag.run({
            id: tag.id,
            name: tag.name,
            color: tag.color || null,
            sort_order: tag.sort_order || 0,
            created_at: tag.created_at
          });
        }
        console.log(`  Restored ${data.tags.length} tags`);
      }

      // Chapter tags
      if (data.chapter_tags?.length > 0) {
        const insertChapterTag = db.prepare(`
          INSERT OR REPLACE INTO systematic_chapter_tags (chapter_number, tag_id)
          VALUES (@chapter_number, @tag_id)
        `);

        for (const ct of data.chapter_tags) {
          insertChapterTag.run({
            chapter_number: ct.chapter_number,
            tag_id: ct.tag_id
          });
        }
        console.log(`  Restored ${data.chapter_tags.length} chapter-tag associations`);
      }

      // Related chapters
      if (data.related?.length > 0) {
        const insertRelated = db.prepare(`
          INSERT OR REPLACE INTO systematic_related (
            id, source_chapter, target_chapter, relationship_type, note, created_at
          ) VALUES (
            @id, @source_chapter, @target_chapter, @relationship_type, @note, @created_at
          )
        `);

        for (const rel of data.related) {
          insertRelated.run({
            id: rel.id,
            source_chapter: rel.source_chapter,
            target_chapter: rel.target_chapter,
            relationship_type: rel.relationship_type || 'see_also',
            note: rel.note || null,
            created_at: rel.created_at
          });
        }
        console.log(`  Restored ${data.related.length} related chapter links`);
      }
    });

    transaction();

    // Re-enable foreign key checks
    db.pragma('foreign_keys = ON');

    console.log('[ST Restore] Systematic theology restore complete!');

  } catch (error) {
    console.error('[ST Restore] Failed to restore systematic theology:', error.message);
    // Re-enable foreign keys even on error
    try { db.pragma('foreign_keys = ON'); } catch (_) {}
  } finally {
    db.close();
  }
}

const PORT = 3847;
let mainWindow;
let server;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (app.isPackaged) {
    mainWindow.loadURL(`http://localhost:${PORT}`);
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

function startServer() {
  const serverApp = express();
  serverApp.use(express.json({ limit: '100mb' }));

  // Load existing routes (works from asar)
  const notesRoutes = require('../server/routes/notes.cjs');
  const backupRoutes = require('../server/routes/backup.cjs');
  const topicsRoutes = require('../server/routes/topics.cjs');
  const inlineTagsRoutes = require('../server/routes/inlineTags.cjs');
  const systematicRoutes = require('../server/routes/systematic.cjs');
  serverApp.use('/api/notes', backupRoutes);
  serverApp.use('/api/notes', notesRoutes);
  serverApp.use('/api/topics', topicsRoutes);
  serverApp.use('/api/inline-tags', inlineTagsRoutes);
  serverApp.use('/api/systematic', systematicRoutes);

  // Debug endpoint to check systematic theology status
  serverApp.get('/api/debug/systematic-status', (req, res) => {
    const Database = require('better-sqlite3');
    const db = new Database(process.env.DB_PATH);
    try {
      const count = db.prepare('SELECT COUNT(*) as count FROM systematic_theology').get().count;
      const jsonPath = path.join(process.resourcesPath, 'systematic-theology-complete.json');
      res.json({
        isPackaged: app.isPackaged,
        dbPath: process.env.DB_PATH,
        dbExists: fs.existsSync(process.env.DB_PATH),
        resourcesPath: process.resourcesPath,
        jsonPath: jsonPath,
        jsonExists: fs.existsSync(jsonPath),
        systematicCount: count,
        resourceFiles: fs.existsSync(process.resourcesPath)
          ? fs.readdirSync(process.resourcesPath).filter(f => f.includes('systematic') || f.endsWith('.json'))
          : []
      });
    } catch (e) {
      res.json({ error: e.message });
    } finally {
      db.close();
    }
  });

  // Manual trigger to restore systematic theology data
  serverApp.post('/api/debug/restore-systematic', (req, res) => {
    const Database = require('better-sqlite3');
    const dbPath = process.env.DB_PATH;
    const jsonPath = path.join(process.resourcesPath, 'systematic-theology-complete.json');

    const logs = [];
    logs.push(`Starting restore at ${new Date().toISOString()}`);
    logs.push(`DB path: ${dbPath}`);
    logs.push(`JSON path: ${jsonPath}`);
    logs.push(`JSON exists: ${fs.existsSync(jsonPath)}`);

    if (!fs.existsSync(jsonPath)) {
      return res.json({ success: false, logs, error: 'JSON file not found' });
    }

    const db = new Database(dbPath);

    try {
      logs.push('Loading JSON...');
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const entries = data.systematic_theology || data;
      logs.push(`Loaded ${entries.length} entries`);

      // Clear existing and insert
      logs.push('Starting transaction...');

      // Disable foreign key checks for bulk import
      db.pragma('foreign_keys = OFF');

      const transaction = db.transaction(() => {
        // Clear existing
        db.prepare('DELETE FROM systematic_scripture_index').run();
        db.prepare('DELETE FROM systematic_chapter_tags').run();
        db.prepare('DELETE FROM systematic_related').run();
        db.prepare('DELETE FROM systematic_tags').run();
        db.prepare('DELETE FROM systematic_theology').run();
        logs.push('Cleared existing data');

        // Insert main entries
        const insertEntry = db.prepare(`
          INSERT INTO systematic_theology (
            id, entry_type, part_number, chapter_number, section_letter, subsection_number,
            title, content, summary, parent_id, sort_order, word_count, created_at, updated_at
          ) VALUES (
            @id, @entry_type, @part_number, @chapter_number, @section_letter, @subsection_number,
            @title, @content, @summary, @parent_id, @sort_order, @word_count, @created_at, @updated_at
          )
        `);

        for (const entry of entries) {
          insertEntry.run({
            id: entry.id,
            entry_type: entry.entry_type,
            part_number: entry.part_number || null,
            chapter_number: entry.chapter_number || null,
            section_letter: entry.section_letter || null,
            subsection_number: entry.subsection_number || null,
            title: entry.title,
            content: entry.content || null,
            summary: entry.summary || null,
            parent_id: entry.parent_id || null,
            sort_order: entry.sort_order || 0,
            word_count: entry.word_count || 0,
            created_at: entry.created_at,
            updated_at: entry.updated_at
          });
        }
        logs.push(`Inserted ${entries.length} main entries`);

        // Scripture index
        if (data.scripture_index?.length > 0) {
          const insertScripture = db.prepare(`
            INSERT INTO systematic_scripture_index (
              id, systematic_id, book, chapter, start_verse, end_verse,
              is_primary, context_snippet, created_at
            ) VALUES (
              @id, @systematic_id, @book, @chapter, @start_verse, @end_verse,
              @is_primary, @context_snippet, @created_at
            )
          `);
          for (const ref of data.scripture_index) {
            insertScripture.run({
              id: ref.id,
              systematic_id: ref.systematic_id,
              book: ref.book,
              chapter: ref.chapter,
              start_verse: ref.start_verse || null,
              end_verse: ref.end_verse || null,
              is_primary: ref.is_primary || 0,
              context_snippet: ref.context_snippet || null,
              created_at: ref.created_at
            });
          }
          logs.push(`Inserted ${data.scripture_index.length} scripture refs`);
        }

        // Tags
        if (data.tags?.length > 0) {
          const insertTag = db.prepare(`
            INSERT INTO systematic_tags (id, name, color, sort_order, created_at)
            VALUES (@id, @name, @color, @sort_order, @created_at)
          `);
          for (const tag of data.tags) {
            insertTag.run({
              id: tag.id,
              name: tag.name,
              color: tag.color || null,
              sort_order: tag.sort_order || 0,
              created_at: tag.created_at
            });
          }
          logs.push(`Inserted ${data.tags.length} tags`);
        }

        // Chapter tags
        if (data.chapter_tags?.length > 0) {
          const insertChapterTag = db.prepare(`
            INSERT INTO systematic_chapter_tags (chapter_number, tag_id)
            VALUES (@chapter_number, @tag_id)
          `);
          for (const ct of data.chapter_tags) {
            insertChapterTag.run({
              chapter_number: ct.chapter_number,
              tag_id: ct.tag_id
            });
          }
          logs.push(`Inserted ${data.chapter_tags.length} chapter-tags`);
        }

        // Related
        if (data.related?.length > 0) {
          const insertRelated = db.prepare(`
            INSERT INTO systematic_related (
              id, source_chapter, target_chapter, relationship_type, note, created_at
            ) VALUES (
              @id, @source_chapter, @target_chapter, @relationship_type, @note, @created_at
            )
          `);
          for (const rel of data.related) {
            insertRelated.run({
              id: rel.id,
              source_chapter: rel.source_chapter,
              target_chapter: rel.target_chapter,
              relationship_type: rel.relationship_type || 'see_also',
              note: rel.note || null,
              created_at: rel.created_at
            });
          }
          logs.push(`Inserted ${data.related.length} related links`);
        }
      });

      transaction();
      logs.push('Transaction committed!');

      // Re-enable foreign key checks
      db.pragma('foreign_keys = ON');

      const finalCount = db.prepare('SELECT COUNT(*) as count FROM systematic_theology').get().count;
      logs.push(`Final count: ${finalCount}`);

      res.json({ success: true, logs, finalCount });

    } catch (e) {
      logs.push(`ERROR: ${e.message}`);
      logs.push(`Stack: ${e.stack}`);
      // Re-enable foreign keys even on error
      try { db.pragma('foreign_keys = ON'); } catch (_) {}
      res.json({ success: false, logs, error: e.message });
    } finally {
      db.close();
    }
  });

  // Serve frontend in production
  if (app.isPackaged) {
    // dist is inside the asar archive, use path relative to this file
    const distPath = path.join(__dirname, '../dist');
    console.log('Serving static files from:', distPath);

    serverApp.use(express.static(distPath));

    // SPA fallback - must not match /api routes
    serverApp.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return new Promise((resolve, reject) => {
    server = serverApp.listen(PORT, () => {
      console.log(`SACRED running on port ${PORT}`);
      console.log(`Database: ${process.env.DB_PATH}`);
      resolve();
    });
    server.on('error', reject);
  });
}

app.whenReady().then(async () => {
  // Only start embedded server in production
  // In dev, Vite proxies API calls to the separate dev:server on port 3001
  if (app.isPackaged) {
    try {
      await startServer();
      // Auto-restore systematic theology data if needed (after server starts so tables exist)
      restoreSystematicTheologyIfNeeded();
    } catch (err) {
      console.error('Failed to start server:', err);
    }
  } else {
    console.log('Development mode: using Vite dev server on port 3000');
    console.log('Make sure dev:server is running on port 3001');
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (app.isReady() && BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (server) server.close();
});
