#!/usr/bin/env node
/**
 * Restore Systematic Theology Data from JSON Backup
 *
 * Usage: node scripts/restore-systematic-theology.cjs [path-to-json]
 *
 * Default path: myfiles/grudem-sys-theo-parsed/systematic-theology-export.json
 *
 * This script restores systematic theology entries (including AI summaries)
 * from a JSON export file. It will clear existing data and replace it.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Parse command line arguments
const jsonPath = process.argv[2] || path.join(__dirname, '..', 'myfiles', 'grudem-sys-theo-parsed', 'systematic-theology-export.json');

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
const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
console.log(`Found ${jsonData.length} entries to restore`);

// Open database
const db = new Database(dbPath);

// Count existing entries
const existingCount = db.prepare('SELECT COUNT(*) as count FROM systematic_theology').get().count;
console.log(`Existing entries in database: ${existingCount}`);

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
  // Clear existing data (related tables will cascade delete)
  db.prepare('DELETE FROM systematic_theology').run();
  console.log('Cleared existing data');

  // Prepare insert statement
  const insert = db.prepare(`
    INSERT INTO systematic_theology (
      id, entry_type, part_number, chapter_number, section_letter, subsection_number,
      title, content, summary, parent_id, sort_order, word_count, created_at, updated_at
    ) VALUES (
      @id, @entry_type, @part_number, @chapter_number, @section_letter, @subsection_number,
      @title, @content, @summary, @parent_id, @sort_order, @word_count, @created_at, @updated_at
    )
  `);

  // Insert all entries
  let imported = 0;
  for (const entry of jsonData) {
    insert.run({
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
    imported++;

    if (imported % 100 === 0) {
      console.log(`  Restored ${imported}/${jsonData.length} entries...`);
    }
  }

  return imported;
});

try {
  const count = transaction();
  console.log(`\nSuccess! Restored ${count} entries.`);

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

  console.log('\nRestored entries by type:');
  for (const row of summary) {
    console.log(`  ${row.entry_type}: ${row.count}`);
  }

  // Check summaries
  const withSummary = db.prepare(`
    SELECT COUNT(*) as count FROM systematic_theology
    WHERE summary IS NOT NULL AND length(summary) > 0
  `).get().count;
  console.log(`\nEntries with AI summaries: ${withSummary}/${count}`);

} catch (error) {
  console.error('Restore failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}

console.log('\nDone!');
