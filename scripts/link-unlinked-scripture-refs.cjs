/**
 * Link Unlinked Scripture References
 *
 * Scans systematic_theology.content for scripture references that are NOT
 * already wrapped in <a data-scripture> tags and converts them to linked format.
 *
 * Usage:
 *   node scripts/link-unlinked-scripture-refs.cjs --dry-run          # Preview changes
 *   node scripts/link-unlinked-scripture-refs.cjs --dry-run --verbose
 *   node scripts/link-unlinked-scripture-refs.cjs --dry-run --limit 10
 *   node scripts/link-unlinked-scripture-refs.cjs --chapter 32       # Process specific chapter
 *   node scripts/link-unlinked-scripture-refs.cjs --backup           # Create backup before changes
 */

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Parse command line args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const backup = args.includes('--backup');
const limitArg = args.find(a => a.startsWith('--limit'));
const limit = limitArg ? parseInt(args[args.indexOf(limitArg) + 1], 10) : null;
const chapterArg = args.find(a => a.startsWith('--chapter'));
const chapterFilter = chapterArg ? parseInt(args[args.indexOf(chapterArg) + 1], 10) : null;

// Database setup
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/sacred.db');
const db = new Database(dbPath);

// Comprehensive book name to code mapping
// Combines logosBookMap from import script with all common abbreviations
const bookNameToCode = {
  // Old Testament
  'genesis': 'GEN', 'gen': 'GEN', 'ge': 'GEN',
  'exodus': 'EXO', 'exod': 'EXO', 'exo': 'EXO', 'ex': 'EXO',
  'leviticus': 'LEV', 'lev': 'LEV', 'le': 'LEV',
  'numbers': 'NUM', 'num': 'NUM', 'nu': 'NUM', 'numb': 'NUM',
  'deuteronomy': 'DEU', 'deut': 'DEU', 'deu': 'DEU', 'dt': 'DEU',
  'joshua': 'JOS', 'josh': 'JOS', 'jos': 'JOS',
  'judges': 'JDG', 'judg': 'JDG', 'jdg': 'JDG', 'jgs': 'JDG',
  'ruth': 'RUT', 'rut': 'RUT', 'ru': 'RUT',
  '1 samuel': '1SA', '1samuel': '1SA', '1 sam': '1SA', '1sam': '1SA', '1sa': '1SA',
  '2 samuel': '2SA', '2samuel': '2SA', '2 sam': '2SA', '2sam': '2SA', '2sa': '2SA',
  '1 kings': '1KI', '1kings': '1KI', '1 kgs': '1KI', '1kgs': '1KI', '1ki': '1KI', '1 ki': '1KI',
  '2 kings': '2KI', '2kings': '2KI', '2 kgs': '2KI', '2kgs': '2KI', '2ki': '2KI', '2 ki': '2KI',
  '1 chronicles': '1CH', '1chronicles': '1CH', '1 chr': '1CH', '1chr': '1CH', '1ch': '1CH', '1 chron': '1CH',
  '2 chronicles': '2CH', '2chronicles': '2CH', '2 chr': '2CH', '2chr': '2CH', '2ch': '2CH', '2 chron': '2CH',
  'ezra': 'EZR', 'ezr': 'EZR',
  'nehemiah': 'NEH', 'neh': 'NEH', 'ne': 'NEH',
  'esther': 'EST', 'esth': 'EST', 'est': 'EST', 'es': 'EST',
  'job': 'JOB',
  'psalms': 'PSA', 'psalm': 'PSA', 'psa': 'PSA', 'ps': 'PSA', 'pss': 'PSA',
  'proverbs': 'PRO', 'prov': 'PRO', 'pro': 'PRO', 'pr': 'PRO',
  'ecclesiastes': 'ECC', 'eccl': 'ECC', 'ecc': 'ECC', 'eccles': 'ECC', 'ec': 'ECC',
  'song of solomon': 'SNG', 'song of songs': 'SNG', 'song': 'SNG', 'sos': 'SNG', 'sng': 'SNG', 'so': 'SNG', 'canticles': 'SNG', 'cant': 'SNG',
  'isaiah': 'ISA', 'isa': 'ISA', 'is': 'ISA',
  'jeremiah': 'JER', 'jer': 'JER', 'je': 'JER',
  'lamentations': 'LAM', 'lam': 'LAM', 'la': 'LAM',
  'ezekiel': 'EZK', 'ezek': 'EZK', 'ezk': 'EZK', 'eze': 'EZK',
  'daniel': 'DAN', 'dan': 'DAN', 'da': 'DAN',
  'hosea': 'HOS', 'hos': 'HOS', 'ho': 'HOS',
  'joel': 'JOL', 'jol': 'JOL', 'joe': 'JOL',
  'amos': 'AMO', 'amo': 'AMO', 'am': 'AMO',
  'obadiah': 'OBA', 'obad': 'OBA', 'oba': 'OBA', 'ob': 'OBA',
  'jonah': 'JON', 'jon': 'JON',
  'micah': 'MIC', 'mic': 'MIC', 'mi': 'MIC',
  'nahum': 'NAM', 'nah': 'NAM', 'nam': 'NAM', 'na': 'NAM',
  'habakkuk': 'HAB', 'hab': 'HAB',
  'zephaniah': 'ZEP', 'zeph': 'ZEP', 'zep': 'ZEP',
  'haggai': 'HAG', 'hag': 'HAG',
  'zechariah': 'ZEC', 'zech': 'ZEC', 'zec': 'ZEC',
  'malachi': 'MAL', 'mal': 'MAL',

  // New Testament
  'matthew': 'MAT', 'matt': 'MAT', 'mat': 'MAT', 'mt': 'MAT',
  'mark': 'MRK', 'mrk': 'MRK', 'mk': 'MRK', 'mar': 'MRK',
  'luke': 'LUK', 'luk': 'LUK', 'lk': 'LUK',
  'john': 'JHN', 'jhn': 'JHN', 'jn': 'JHN',
  'acts': 'ACT', 'act': 'ACT', 'ac': 'ACT',
  'romans': 'ROM', 'rom': 'ROM', 'ro': 'ROM',
  '1 corinthians': '1CO', '1corinthians': '1CO', '1 cor': '1CO', '1cor': '1CO', '1co': '1CO',
  '2 corinthians': '2CO', '2corinthians': '2CO', '2 cor': '2CO', '2cor': '2CO', '2co': '2CO',
  'galatians': 'GAL', 'gal': 'GAL', 'ga': 'GAL',
  'ephesians': 'EPH', 'eph': 'EPH',
  'philippians': 'PHP', 'phil': 'PHP', 'php': 'PHP', 'pp': 'PHP',
  'colossians': 'COL', 'col': 'COL',
  '1 thessalonians': '1TH', '1thessalonians': '1TH', '1 thess': '1TH', '1thess': '1TH', '1th': '1TH', '1 thes': '1TH',
  '2 thessalonians': '2TH', '2thessalonians': '2TH', '2 thess': '2TH', '2thess': '2TH', '2th': '2TH', '2 thes': '2TH',
  '1 timothy': '1TI', '1timothy': '1TI', '1 tim': '1TI', '1tim': '1TI', '1ti': '1TI',
  '2 timothy': '2TI', '2timothy': '2TI', '2 tim': '2TI', '2tim': '2TI', '2ti': '2TI',
  'titus': 'TIT', 'tit': 'TIT',
  'philemon': 'PHM', 'phm': 'PHM', 'phlm': 'PHM', 'philem': 'PHM', 'pm': 'PHM',
  'hebrews': 'HEB', 'heb': 'HEB',
  'james': 'JAS', 'jas': 'JAS', 'jm': 'JAS',
  '1 peter': '1PE', '1peter': '1PE', '1 pet': '1PE', '1pet': '1PE', '1pe': '1PE', '1 pt': '1PE',
  '2 peter': '2PE', '2peter': '2PE', '2 pet': '2PE', '2pet': '2PE', '2pe': '2PE', '2 pt': '2PE',
  '1 john': '1JN', '1john': '1JN', '1 jn': '1JN', '1jn': '1JN',
  '2 john': '2JN', '2john': '2JN', '2 jn': '2JN', '2jn': '2JN',
  '3 john': '3JN', '3john': '3JN', '3 jn': '3JN', '3jn': '3JN',
  'jude': 'JUD', 'jud': 'JUD',
  'revelation': 'REV', 'revelations': 'REV', 'rev': 'REV', 're': 'REV',

  // Roman numeral variants (I, II, III for 1, 2, 3)
  'i samuel': '1SA', 'ii samuel': '2SA',
  'i kings': '1KI', 'ii kings': '2KI',
  'i chronicles': '1CH', 'ii chronicles': '2CH',
  'i corinthians': '1CO', 'ii corinthians': '2CO',
  'i thessalonians': '1TH', 'ii thessalonians': '2TH',
  'i timothy': '1TI', 'ii timothy': '2TI',
  'i peter': '1PE', 'ii peter': '2PE',
  'i john': '1JN', 'ii john': '2JN', 'iii john': '3JN',

  // Short roman variants
  'i sam': '1SA', 'ii sam': '2SA',
  'i kgs': '1KI', 'ii kgs': '2KI',
  'i chr': '1CH', 'ii chr': '2CH',
  'i cor': '1CO', 'ii cor': '2CO',
  'i thess': '1TH', 'ii thess': '2TH',
  'i tim': '1TI', 'ii tim': '2TI',
  'i pet': '1PE', 'ii pet': '2PE',
  'i jn': '1JN', 'ii jn': '2JN', 'iii jn': '3JN',
};

// Build a regex pattern for book names (sorted by length descending to match longest first)
const bookPatterns = Object.keys(bookNameToCode)
  .sort((a, b) => b.length - a.length)
  .map(name => {
    // Escape special regex characters and handle optional periods after abbreviations
    let pattern = name.replace(/([.*+?^${}()|[\]\\])/g, '\\$1');
    // If it's an abbreviation (ends with a letter and is short), add optional period
    if (name.length <= 6 && /[a-z]$/i.test(name)) {
      pattern += '\\.?';
    }
    return pattern;
  });

// Build the master regex for scripture references
// Matches: Book chapter:verse[-verse]
// e.g., "Matt. 28:19", "1 Cor. 12:11", "Romans 8:28-30", "Ps. 119:18"
const scriptureRefRegex = new RegExp(
  // Book name (case insensitive)
  '(' + bookPatterns.join('|') + ')' +
  // Optional period and whitespace
  '\\s+' +
  // Chapter number
  '(\\d+)' +
  // Colon and verse (required - we skip chapter-only refs)
  ':' +
  // Start verse
  '(\\d+)' +
  // Optional verse range (handles both - and – en-dash)
  '(?:[–\\-](\\d+))?' +
  // Optional "ff" suffix (ignore it)
  '(?:ff\\.?)?',
  'gi'
);

/**
 * Check if a position in the string is inside an existing scripture link
 */
function isInsideExistingLink(content, matchIndex) {
  // Look backwards for <a and </a> to determine if we're inside a link
  const before = content.substring(0, matchIndex);
  const lastOpenTag = before.lastIndexOf('<a ');
  const lastCloseTag = before.lastIndexOf('</a>');

  // If there's an <a> tag that hasn't been closed, we're inside a link
  if (lastOpenTag > lastCloseTag) {
    return true;
  }

  return false;
}

/**
 * Check if a match is already a linked scripture reference
 */
function isAlreadyLinked(content, matchIndex, matchLength) {
  // Check if this match is the text content of an existing scripture link
  // Look for pattern: <a data-scripture="...">MATCH</a>
  const endOfMatch = matchIndex + matchLength;
  const after = content.substring(endOfMatch);
  const before = content.substring(0, matchIndex);

  // Check if immediately followed by </a>
  if (/^\s*<\/a>/i.test(after)) {
    // And preceded by <a data-scripture="...">
    if (/<a[^>]*data-scripture[^>]*>\s*$/i.test(before)) {
      return true;
    }
  }

  return isInsideExistingLink(content, matchIndex);
}

/**
 * Find and link unlinked scripture references in content
 * Returns { newContent, linkedRefs[] }
 */
function linkScriptureRefs(content, entryId) {
  if (!content || typeof content !== 'string') return { newContent: content, linkedRefs: [] };

  const linkedRefs = [];
  let newContent = content;
  let offset = 0;

  // Reset regex state
  scriptureRefRegex.lastIndex = 0;

  // Find all matches first, then process in reverse order to preserve offsets
  const matches = [];
  let match;
  while ((match = scriptureRefRegex.exec(content)) !== null) {
    matches.push({
      fullMatch: match[0],
      bookName: match[1],
      chapter: parseInt(match[2], 10),
      startVerse: parseInt(match[3], 10),
      endVerse: match[4] ? parseInt(match[4], 10) : null,
      index: match.index
    });
  }

  // Process matches in reverse order
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];

    // Skip if already linked
    if (isAlreadyLinked(content, m.index, m.fullMatch.length)) {
      continue;
    }

    // Normalize book name to code
    const bookKey = m.bookName.toLowerCase().replace(/\.\s*$/, '');
    const bookCode = bookNameToCode[bookKey];

    if (!bookCode) {
      if (verbose) {
        console.log(`  [SKIP] Unknown book: "${m.bookName}"`);
      }
      continue;
    }

    // Build the data-scripture attribute value
    const dataScripture = m.endVerse
      ? `${bookCode}.${m.chapter}.${m.startVerse}-${m.endVerse}`
      : `${bookCode}.${m.chapter}.${m.startVerse}`;

    // Build the linked version
    const linkedRef = `<a data-scripture="${dataScripture}" class="scripture-link">${m.fullMatch}</a>`;

    // Replace in newContent (using string indices since we're going in reverse)
    newContent = newContent.substring(0, m.index) + linkedRef + newContent.substring(m.index + m.fullMatch.length);

    // Record the linked reference for scripture index
    linkedRefs.push({
      book: bookCode,
      chapter: m.chapter,
      startVerse: m.startVerse,
      endVerse: m.endVerse,
      text: m.fullMatch
    });
  }

  return { newContent, linkedRefs };
}

/**
 * Create backup of database
 */
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, `../data/sacred-backup-${timestamp}.db`);
  fs.copyFileSync(dbPath, backupPath);
  console.log(`Backup created: ${backupPath}`);
  return backupPath;
}

/**
 * Main function
 */
function main() {
  console.log('=== Link Unlinked Scripture References ===\n');

  if (dryRun) {
    console.log('MODE: Dry run (no changes will be saved)\n');
  }

  // Get initial counts
  const initialRefCount = db.prepare('SELECT COUNT(*) as c FROM systematic_scripture_index').get().c;
  console.log(`Initial scripture references: ${initialRefCount}`);

  // Build query based on filters
  let query = 'SELECT id, chapter_number, title, content FROM systematic_theology WHERE content IS NOT NULL';
  const queryParams = [];

  if (chapterFilter) {
    query += ' AND chapter_number = ?';
    queryParams.push(chapterFilter);
  }

  query += ' ORDER BY sort_order';

  if (limit) {
    query += ' LIMIT ?';
    queryParams.push(limit);
  }

  const entries = db.prepare(query).all(...queryParams);
  console.log(`Processing ${entries.length} entries${chapterFilter ? ` (chapter ${chapterFilter})` : ''}${limit ? ` (limited to ${limit})` : ''}\n`);

  // Create backup if requested
  if (backup && !dryRun) {
    createBackup();
  }

  // Stats
  let entriesModified = 0;
  let totalRefsAdded = 0;
  const sampleTransformations = [];

  // Prepared statements for updates
  const updateContent = db.prepare('UPDATE systematic_theology SET content = ?, updated_at = ? WHERE id = ?');
  const insertScriptureIndex = db.prepare(`
    INSERT INTO systematic_scripture_index (id, systematic_id, book, chapter, start_verse, end_verse, is_primary, context_snippet, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `);

  // Process in a transaction
  const processAll = db.transaction(() => {
    for (const entry of entries) {
      const { newContent, linkedRefs } = linkScriptureRefs(entry.content, entry.id);

      if (linkedRefs.length > 0) {
        entriesModified++;
        totalRefsAdded += linkedRefs.length;

        if (verbose) {
          console.log(`[Chapter ${entry.chapter_number}] "${entry.title}": ${linkedRefs.length} refs linked`);
          linkedRefs.forEach(ref => {
            console.log(`  → ${ref.book}.${ref.chapter}.${ref.startVerse}${ref.endVerse ? '-' + ref.endVerse : ''} ("${ref.text}")`);
          });
        }

        // Collect samples
        if (sampleTransformations.length < 5) {
          sampleTransformations.push({
            chapter: entry.chapter_number,
            title: entry.title,
            refs: linkedRefs.slice(0, 3)
          });
        }

        if (!dryRun) {
          // Update content
          const now = new Date().toISOString();
          updateContent.run(newContent, now, entry.id);

          // Add to scripture index
          for (const ref of linkedRefs) {
            insertScriptureIndex.run(
              uuidv4(),
              entry.id,
              ref.book,
              ref.chapter,
              ref.startVerse,
              ref.endVerse,
              ref.text,
              now
            );
          }
        }
      }
    }
  });

  processAll();

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Entries processed: ${entries.length}`);
  console.log(`Entries modified: ${entriesModified}`);
  console.log(`References linked: ${totalRefsAdded}`);

  if (!dryRun) {
    const finalRefCount = db.prepare('SELECT COUNT(*) as c FROM systematic_scripture_index').get().c;
    console.log(`\nScripture index: ${initialRefCount} → ${finalRefCount} (+${finalRefCount - initialRefCount})`);
  }

  // Show sample transformations
  if (sampleTransformations.length > 0) {
    console.log('\n=== Sample Transformations ===');
    for (const sample of sampleTransformations) {
      console.log(`\n[Chapter ${sample.chapter}] ${sample.title}:`);
      for (const ref of sample.refs) {
        console.log(`  "${ref.text}" → ${ref.book}.${ref.chapter}.${ref.startVerse}${ref.endVerse ? '-' + ref.endVerse : ''}`);
      }
    }
  }

  if (dryRun) {
    console.log('\n✓ Dry run complete. Run without --dry-run to apply changes.');
  } else {
    console.log('\n✓ Changes saved to database.');
  }
}

// Run
try {
  main();
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
