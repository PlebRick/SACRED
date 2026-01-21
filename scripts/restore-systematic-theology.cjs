#!/usr/bin/env node
/**
 * Restore Systematic Theology Data from JSON Backup
 *
 * Usage: node scripts/restore-systematic-theology.cjs [path-to-json]
 *
 * Default path: myfiles/grudem-sys-theo-parsed/systematic-theology-complete.json
 *
 * This script restores all systematic theology data including:
 * - Main entries (parts, chapters, sections, subsections) with AI summaries
 * - Scripture index (4800+ verse references)
 * - Tags and chapter-tag associations
 * - Related chapter links
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Parse command line arguments
const jsonPath = process.argv[2] || path.join(__dirname, '..', 'myfiles', 'grudem-sys-theo-parsed', 'systematic-theology-complete.json');

// Determine database path
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'sacred.db');

console.log('Systematic Theology Restore');
console.log('===========================');
console.log(`JSON file: ${jsonPath}`);
console.log(`Database: ${dbPath}`);
console.log('');

// Check if JSON file exists
if (!fs.existsSync(jsonPath)) {
  console.error(`Error: JSON file not found: ${jsonPath}`);
  process.exit(1);
}

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error(`Error: Database not found: ${dbPath}`);
  console.error('Please run the app first to create the database.');
  process.exit(1);
}

// Load JSON data
console.log('Loading JSON data...');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Support both old format (array) and new format (object with multiple tables)
const isNewFormat = !Array.isArray(data) && data.systematic_theology;

if (isNewFormat) {
  console.log('Detected complete backup format');
  console.log(`  Main entries: ${data.systematic_theology?.length || 0}`);
  console.log(`  Scripture refs: ${data.scripture_index?.length || 0}`);
  console.log(`  Tags: ${data.tags?.length || 0}`);
  console.log(`  Chapter tags: ${data.chapter_tags?.length || 0}`);
  console.log(`  Related: ${data.related?.length || 0}`);
} else {
  console.log(`Detected simple format with ${data.length} entries`);
}

// Open database
const db = new Database(dbPath);

// Count existing entries
const existingCount = db.prepare('SELECT COUNT(*) as count FROM systematic_theology').get().count;
console.log(`\nExisting entries in database: ${existingCount}`);

if (existingCount > 0) {
  console.log('\nWARNING: This will replace all existing systematic theology data!');
  console.log('Press Ctrl+C within 3 seconds to cancel...\n');

  // Give user time to cancel
  const start = Date.now();
  while (Date.now() - start < 3000) {
    // Wait
  }
}

console.log('Starting restore...');

// Begin transaction
const transaction = db.transaction(() => {
  // Clear existing data (order matters due to foreign keys)
  db.prepare('DELETE FROM systematic_scripture_index').run();
  db.prepare('DELETE FROM systematic_chapter_tags').run();
  db.prepare('DELETE FROM systematic_related').run();
  db.prepare('DELETE FROM systematic_tags').run();
  db.prepare('DELETE FROM systematic_theology').run();
  console.log('Cleared existing data');

  const results = { entries: 0, scripture: 0, tags: 0, chapterTags: 0, related: 0 };

  // Get entries array (support both formats)
  const entries = isNewFormat ? data.systematic_theology : data;

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
    results.entries++;
  }
  console.log(`  Restored ${results.entries} main entries`);

  // If new format, restore additional tables
  if (isNewFormat) {
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
        results.scripture++;
      }
      console.log(`  Restored ${results.scripture} scripture references`);
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
        results.tags++;
      }
      console.log(`  Restored ${results.tags} tags`);
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
        results.chapterTags++;
      }
      console.log(`  Restored ${results.chapterTags} chapter-tag associations`);
    }

    // Related chapters
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
        results.related++;
      }
      console.log(`  Restored ${results.related} related chapter links`);
    }
  }

  return results;
});

try {
  const results = transaction();

  console.log('\n✓ Restore complete!');

  // Show summary
  const summary = db.prepare(`
    SELECT entry_type, COUNT(*) as count
    FROM systematic_theology
    GROUP BY entry_type
    ORDER BY CASE entry_type
      WHEN 'part' THEN 1
      WHEN 'chapter' THEN 2
      WHEN 'section' THEN 3
      ELSE 4
    END
  `).all();

  console.log('\nEntries by type:');
  for (const row of summary) {
    console.log(`  ${row.entry_type}: ${row.count}`);
  }

  // Check summaries
  const withSummary = db.prepare(`
    SELECT COUNT(*) as count FROM systematic_theology
    WHERE summary IS NOT NULL AND length(summary) > 0
  `).get().count;
  console.log(`\nEntries with AI summaries: ${withSummary}/${results.entries}`);

  // Check scripture refs
  const scriptureCount = db.prepare('SELECT COUNT(*) as count FROM systematic_scripture_index').get().count;
  console.log(`Scripture references: ${scriptureCount}`);

} catch (error) {
  console.error('Restore failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}

console.log('\nDone!');
