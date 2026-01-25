/**
 * Data Loader Utility
 * Loads bundled systematic theology and WEB Bible data on server startup
 * Used in Docker/hosted deployments (Electron uses its own loader in main.cjs)
 */

const path = require('path');
const fs = require('fs');

/**
 * Find the systematic theology JSON file
 * Checks multiple locations for Docker, dev, and production
 */
function findSystematicTheologyPath() {
  const possiblePaths = [
    // Docker container location
    '/app/myfiles/grudem-sys-theo-parsed/systematic-theology-complete.json',
    // Electron packaged app
    process.resourcesPath && path.join(process.resourcesPath, 'systematic-theology-complete.json'),
    // Development location
    path.join(__dirname, '..', '..', 'myfiles', 'grudem-sys-theo-parsed', 'systematic-theology-complete.json'),
  ].filter(Boolean);

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * Load and import systematic theology data if the database is empty
 * @param {Object} db - better-sqlite3 database instance
 */
function loadSystematicTheologyIfNeeded(db) {
  console.log('[DataLoader] Checking systematic theology data...');

  try {
    // Check if systematic_theology table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='systematic_theology'
    `).get();

    if (!tableExists) {
      console.log('[DataLoader] systematic_theology table does not exist yet');
      return;
    }

    // Check if we already have data
    const count = db.prepare('SELECT COUNT(*) as count FROM systematic_theology').get().count;
    console.log('[DataLoader] Current entry count:', count);

    if (count > 0) {
      console.log('[DataLoader] Already has data, skipping import');
      return;
    }

    // Find the JSON data file
    const jsonPath = findSystematicTheologyPath();

    if (!jsonPath) {
      console.log('[DataLoader] JSON file not found, skipping import');
      console.log('[DataLoader] Searched locations:', [
        '/app/myfiles/...',
        'process.resourcesPath/...',
        './myfiles/...'
      ]);
      return;
    }

    console.log('[DataLoader] Loading JSON from:', jsonPath);
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log('[DataLoader] JSON loaded, entries:', data.systematic_theology?.length || 'N/A');

    // Disable foreign key checks for bulk import
    db.pragma('foreign_keys = OFF');

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
      console.log(`[DataLoader] Imported ${entries.length} main entries`);

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
        console.log(`[DataLoader] Imported ${data.scripture_index.length} scripture references`);
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
        console.log(`[DataLoader] Imported ${data.tags.length} tags`);
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
        console.log(`[DataLoader] Imported ${data.chapter_tags.length} chapter-tag associations`);
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
        console.log(`[DataLoader] Imported ${data.related.length} related chapter links`);
      }
    });

    transaction();

    // Re-enable foreign key checks
    db.pragma('foreign_keys = ON');

    console.log('[DataLoader] Systematic theology import complete!');

  } catch (error) {
    console.error('[DataLoader] Failed to load systematic theology:', error.message);
    // Re-enable foreign keys even on error
    try { db.pragma('foreign_keys = ON'); } catch (_) {}
  }
}

module.exports = {
  findSystematicTheologyPath,
  loadSystematicTheologyIfNeeded
};
