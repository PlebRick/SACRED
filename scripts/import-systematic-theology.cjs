/**
 * Import Systematic Theology Script
 *
 * Parses Logos HTML exports (Wayne Grudem's Systematic Theology) and populates the database.
 *
 * HTML Parsing Strategy:
 * - Part: <p style="font-weight:bold; font-size:24pt; ...">Part X</p>
 * - Chapter: <p style="font-size:18pt; ...">Chapter X</p> + <p style="font-size:24pt; ...">Title</p>
 * - Section: <p style="font-weight:bold; font-size:14pt; ...">A. Title</p>
 * - Sub-section: <span style="font-weight:bold;">1. Title.</span>
 * - Scripture refs: <a href="logosref:Bible.Jn1.1">John 1:1</a>
 *
 * Usage:
 *   node scripts/import-systematic-theology.cjs <html-file-or-directory>
 *   node scripts/import-systematic-theology.cjs --resume           # Resume failed import
 *   node scripts/import-systematic-theology.cjs --skip-summaries   # Skip AI summary generation
 *   node scripts/import-systematic-theology.cjs --clear            # Clear existing data first
 *   node scripts/import-systematic-theology.cjs --dry-run          # Parse but don't save
 */

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Command line args
const args = process.argv.slice(2);
const shouldClear = args.includes('--clear');
const shouldResume = args.includes('--resume');
const skipSummaries = args.includes('--skip-summaries');
const dryRun = args.includes('--dry-run');
const inputPath = args.find(a => !a.startsWith('--'));

// Database setup
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/sacred.db');
const db = new Database(dbPath);

// Book code mappings (Logos format to SACRED format)
const logosBookMap = {
  // Old Testament
  'Ge': 'GEN', 'Gen': 'GEN', 'Genesis': 'GEN',
  'Ex': 'EXO', 'Exod': 'EXO', 'Exodus': 'EXO',
  'Le': 'LEV', 'Lev': 'LEV', 'Leviticus': 'LEV',
  'Nu': 'NUM', 'Num': 'NUM', 'Numbers': 'NUM',
  'Dt': 'DEU', 'Deut': 'DEU', 'Deuteronomy': 'DEU',
  'Jos': 'JOS', 'Josh': 'JOS', 'Joshua': 'JOS',
  'Jdg': 'JDG', 'Judg': 'JDG', 'Judges': 'JDG',
  'Ru': 'RUT', 'Ruth': 'RUT',
  '1Sa': '1SA', '1Sam': '1SA', '1 Samuel': '1SA',
  '2Sa': '2SA', '2Sam': '2SA', '2 Samuel': '2SA',
  '1Ki': '1KI', '1Kgs': '1KI', '1 Kings': '1KI',
  '2Ki': '2KI', '2Kgs': '2KI', '2 Kings': '2KI',
  '1Ch': '1CH', '1Chr': '1CH', '1 Chronicles': '1CH',
  '2Ch': '2CH', '2Chr': '2CH', '2 Chronicles': '2CH',
  'Ezr': 'EZR', 'Ezra': 'EZR',
  'Ne': 'NEH', 'Neh': 'NEH', 'Nehemiah': 'NEH',
  'Es': 'EST', 'Esth': 'EST', 'Esther': 'EST',
  'Job': 'JOB',
  'Ps': 'PSA', 'Psa': 'PSA', 'Psalm': 'PSA', 'Psalms': 'PSA',
  'Pr': 'PRO', 'Prov': 'PRO', 'Proverbs': 'PRO',
  'Ec': 'ECC', 'Eccl': 'ECC', 'Ecclesiastes': 'ECC',
  'So': 'SNG', 'Song': 'SNG', 'SongOfSolomon': 'SNG', 'Song of Solomon': 'SNG',
  'Is': 'ISA', 'Isa': 'ISA', 'Isaiah': 'ISA',
  'Je': 'JER', 'Jer': 'JER', 'Jeremiah': 'JER',
  'La': 'LAM', 'Lam': 'LAM', 'Lamentations': 'LAM',
  'Eze': 'EZK', 'Ezek': 'EZK', 'Ezekiel': 'EZK',
  'Da': 'DAN', 'Dan': 'DAN', 'Daniel': 'DAN',
  'Ho': 'HOS', 'Hos': 'HOS', 'Hosea': 'HOS',
  'Joe': 'JOL', 'Joel': 'JOL',
  'Am': 'AMO', 'Amos': 'AMO',
  'Ob': 'OBA', 'Obad': 'OBA', 'Obadiah': 'OBA',
  'Jon': 'JON', 'Jonah': 'JON',
  'Mic': 'MIC', 'Micah': 'MIC',
  'Na': 'NAM', 'Nah': 'NAM', 'Nahum': 'NAM',
  'Hab': 'HAB', 'Habakkuk': 'HAB',
  'Zep': 'ZEP', 'Zeph': 'ZEP', 'Zephaniah': 'ZEP',
  'Hag': 'HAG', 'Haggai': 'HAG',
  'Zec': 'ZEC', 'Zech': 'ZEC', 'Zechariah': 'ZEC',
  'Mal': 'MAL', 'Malachi': 'MAL',
  // New Testament
  'Mt': 'MAT', 'Matt': 'MAT', 'Matthew': 'MAT',
  'Mk': 'MRK', 'Mark': 'MRK',
  'Lk': 'LUK', 'Luke': 'LUK',
  'Jn': 'JHN', 'John': 'JHN',
  'Ac': 'ACT', 'Acts': 'ACT',
  'Ro': 'ROM', 'Rom': 'ROM', 'Romans': 'ROM',
  '1Co': '1CO', '1Cor': '1CO', '1 Corinthians': '1CO',
  '2Co': '2CO', '2Cor': '2CO', '2 Corinthians': '2CO',
  'Ga': 'GAL', 'Gal': 'GAL', 'Galatians': 'GAL',
  'Eph': 'EPH', 'Ephesians': 'EPH',
  'Php': 'PHP', 'Phil': 'PHP', 'Philippians': 'PHP',
  'Col': 'COL', 'Colossians': 'COL',
  '1Th': '1TH', '1Thess': '1TH', '1 Thessalonians': '1TH',
  '2Th': '2TH', '2Thess': '2TH', '2 Thessalonians': '2TH',
  '1Ti': '1TI', '1Tim': '1TI', '1 Timothy': '1TI',
  '2Ti': '2TI', '2Tim': '2TI', '2 Timothy': '2TI',
  'Tit': 'TIT', 'Titus': 'TIT',
  'Phm': 'PHM', 'Phlm': 'PHM', 'Philemon': 'PHM',
  'Heb': 'HEB', 'Hebrews': 'HEB',
  'Jas': 'JAS', 'James': 'JAS',
  '1Pe': '1PE', '1Pet': '1PE', '1 Peter': '1PE',
  '2Pe': '2PE', '2Pet': '2PE', '2 Peter': '2PE',
  '1Jn': '1JN', '1John': '1JN', '1 John': '1JN',
  '2Jn': '2JN', '2John': '2JN', '2 John': '2JN',
  '3Jn': '3JN', '3John': '3JN', '3 John': '3JN',
  'Jud': 'JUD', 'Jude': 'JUD',
  'Re': 'REV', 'Rev': 'REV', 'Revelation': 'REV'
};

// Part to tag mapping (Grudem's 7 parts)
const partToTag = {
  1: 'doctrine-word',
  2: 'doctrine-god',
  3: 'doctrine-man',
  4: 'doctrine-christ-spirit',
  5: 'doctrine-salvation',
  6: 'doctrine-church',
  7: 'doctrine-future'
};

// Chapters to Parts mapping (Grudem's structure)
const chapterToPart = {};
// Part 1: Doctrine of the Word of God (Ch 1-8)
for (let i = 1; i <= 8; i++) chapterToPart[i] = 1;
// Part 2: Doctrine of God (Ch 9-20)
for (let i = 9; i <= 20; i++) chapterToPart[i] = 2;
// Part 3: Doctrine of Man (Ch 21-25)
for (let i = 21; i <= 25; i++) chapterToPart[i] = 3;
// Part 4: Doctrines of Christ and the Holy Spirit (Ch 26-30)
for (let i = 26; i <= 30; i++) chapterToPart[i] = 4;
// Part 5: Doctrine of the Application of Redemption (Ch 31-43)
for (let i = 31; i <= 43; i++) chapterToPart[i] = 5;
// Part 6: Doctrine of the Church (Ch 44-53)
for (let i = 44; i <= 53; i++) chapterToPart[i] = 6;
// Part 7: Doctrine of the Future (Ch 54-57)
for (let i = 54; i <= 57; i++) chapterToPart[i] = 7;

/**
 * Parse Logos scripture reference format
 * Handles multiple formats:
 * - "logosref:Bible.Jn1.1" -> { book: 'JHN', chapter: 1, verse: 1 }
 * - "https://ref.ly/Ro1.21" -> { book: 'ROM', chapter: 1, verse: 21 }
 * - "https://ref.ly/Ps10.3-4" -> { book: 'PSA', chapter: 10, startVerse: 3, endVerse: 4 }
 */
function parseLogosRef(href) {
  // Try ref.ly format first: ref.ly/BookChapter.Verse or ref.ly/BookChapter.Verse-Verse
  let match = href.match(/ref\.ly\/([A-Za-z0-9]+)(\d+)\.(\d+)(?:[–-](\d+))?/);
  if (match) {
    const [, bookCode, chapter, startVerse, endVerse] = match;
    const book = logosBookMap[bookCode];
    if (book) {
      return {
        book,
        chapter: parseInt(chapter, 10),
        startVerse: parseInt(startVerse, 10),
        endVerse: endVerse ? parseInt(endVerse, 10) : null
      };
    }
  }

  // Try logosref format: Bible.Book#Chapter.Verse
  match = href.match(/Bible\.([A-Za-z0-9]+)(\d+)\.(\d+)(?:-(\d+))?/);
  if (match) {
    const [, bookCode, chapter, startVerse, endVerse] = match;
    const book = logosBookMap[bookCode];
    if (book) {
      return {
        book,
        chapter: parseInt(chapter, 10),
        startVerse: parseInt(startVerse, 10),
        endVerse: endVerse ? parseInt(endVerse, 10) : null
      };
    }
  }

  return null;
}

/**
 * Convert Logos HTML content to clean HTML with SACRED scripture links
 */
function convertContent(html) {
  if (!html) return '';

  let content = html;

  // Remove page markers: <span style="color:rgb(255, 128, 23)...">  p XX  </span>
  content = content.replace(/<span[^>]*color:\s*rgb\(255,\s*128,\s*23\)[^>]*>[^<]*p\s*\d+[^<]*<\/span>/gi, '');

  // Convert ref.ly scripture references to SACRED format
  // <a href="https://ref.ly/Ro1.21">Rom. 1:21</a> -> <a data-scripture="ROM.1.21">Rom. 1:21</a>
  content = content.replace(
    /<a[^>]*href="([^"]*ref\.ly[^"]*)"[^>]*>([^<]+)<\/a>/gi,
    (match, ref, text) => {
      const parsed = parseLogosRef(ref);
      if (!parsed) return text; // Just return text if can't parse

      const dataRef = parsed.endVerse
        ? `${parsed.book}.${parsed.chapter}.${parsed.startVerse}-${parsed.endVerse}`
        : `${parsed.book}.${parsed.chapter}.${parsed.startVerse}`;

      return `<a data-scripture="${dataRef}" class="scripture-link">${text}</a>`;
    }
  );

  // Convert logosref scripture references to SACRED format (fallback)
  content = content.replace(
    /<a[^>]*href="logosref:([^"]+)"[^>]*>([^<]+)<\/a>/gi,
    (match, ref, text) => {
      const parsed = parseLogosRef('logosref:' + ref);
      if (!parsed) return text;

      const dataRef = parsed.endVerse
        ? `${parsed.book}.${parsed.chapter}.${parsed.startVerse}-${parsed.endVerse}`
        : `${parsed.book}.${parsed.chapter}.${parsed.startVerse}`;

      return `<a data-scripture="${dataRef}" class="scripture-link">${text}</a>`;
    }
  );

  // Clean up excessive whitespace
  content = content.replace(/\s+/g, ' ').trim();

  return content;
}

/**
 * Extract scripture references from content for indexing
 */
function extractScriptureRefs(content) {
  const refs = [];
  const regex = /<a[^>]*data-scripture="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const [, dataRef, text] = match;
    const parts = dataRef.split('.');

    if (parts.length >= 3) {
      const book = parts[0];
      const chapter = parseInt(parts[1], 10);
      const versePart = parts[2];

      let startVerse, endVerse;
      if (versePart.includes('-')) {
        [startVerse, endVerse] = versePart.split('-').map(v => parseInt(v, 10));
      } else {
        startVerse = parseInt(versePart, 10);
        endVerse = null;
      }

      refs.push({
        book,
        chapter,
        startVerse,
        endVerse,
        text
      });
    }
  }

  return refs;
}

/**
 * Parse "see chapter X" cross-references
 */
function extractCrossRefs(content) {
  const refs = [];
  // Match patterns like "see chapter 32", "see ch. 32", "chapters 32-35"
  const regex = /see\s+(?:also\s+)?(?:chapter|ch\.?)\s*(\d+)(?:\s*[-–]\s*(\d+))?/gi;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const startChapter = parseInt(match[1], 10);
    const endChapter = match[2] ? parseInt(match[2], 10) : startChapter;

    for (let ch = startChapter; ch <= endChapter; ch++) {
      if (!refs.includes(ch)) {
        refs.push(ch);
      }
    }
  }

  return refs;
}

/**
 * Count words in HTML content
 */
function countWords(html) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.split(' ').filter(w => w.length > 0).length;
}

/**
 * Get or create a part entry (checks database first)
 */
function getOrCreatePart(partNum, title) {
  // Check if part already exists in database
  const existing = db.prepare(
    "SELECT id FROM systematic_theology WHERE entry_type = 'part' AND part_number = ? LIMIT 1"
  ).get(partNum);

  if (existing) {
    return existing.id;
  }

  // Create new part
  const id = uuidv4();
  const now = new Date().toISOString();
  const sortOrder = partNum * 1000; // Leave room for chapters

  db.prepare(`
    INSERT INTO systematic_theology (
      id, entry_type, part_number, chapter_number, section_letter, subsection_number,
      title, content, summary, parent_id, sort_order, word_count, created_at, updated_at
    ) VALUES (?, 'part', ?, NULL, NULL, NULL, ?, '', NULL, NULL, ?, 0, ?, ?)
  `).run(id, partNum, title || `Part ${partNum}`, sortOrder, now, now);

  return id;
}

/**
 * Parse HTML file and extract systematic theology structure
 */
function parseLogosHtml(html) {
  const entries = [];
  let currentPart = null;
  let currentPartId = null;
  let currentChapter = null;
  let currentSection = null;
  let currentSubsection = null;  // Track current subsection for content collection
  let sortOrder = 0;

  // Split by paragraph tags, keeping the tags for style detection
  const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const paragraphs = [];
  let match;
  while ((match = paragraphRegex.exec(html)) !== null) {
    paragraphs.push({
      full: match[0],
      content: match[1]
    });
  }

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    let pContent = p.content.trim();
    const pFull = p.full;
    if (!pContent) continue;

    // Remove page markers first (they interfere with pattern matching)
    pContent = pContent.replace(/<span[^>]*color:\s*rgb\(255,\s*128,\s*23\)[^>]*>[^<]*<\/span>/gi, '');

    // Strip HTML tags for text matching
    const plainText = pContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    // Detect Part headers: "Part X" (usually in 16pt font, centered)
    const partMatch = plainText.match(/^Part\s+(\d+)$/i);
    if (partMatch && pFull.includes('text-align:center')) {
      const partNum = parseInt(partMatch[1], 10);

      // Get Part title from next paragraph if it's also centered and bold
      let partTitle = `Part ${partNum}`;
      if (i + 1 < paragraphs.length) {
        const nextP = paragraphs[i + 1];
        if (nextP.full.includes('text-align:center') && nextP.content.includes('font-weight:bold')) {
          partTitle = nextP.content.replace(/<[^>]+>/g, '').trim();
          i++; // Skip the title paragraph
        }
      }

      // Get or create part in database (deduplicates across files)
      currentPartId = getOrCreatePart(partNum, partTitle);
      currentPart = partNum;
      currentChapter = null;
      currentSection = null;
      continue;
    }

    // Detect Chapter headers: "Chapter X" (centered, 16pt font)
    const chapterMatch = plainText.match(/^Chapter\s+(\d+)$/i);
    if (chapterMatch && pFull.includes('text-align:center')) {
      const chapterNum = parseInt(chapterMatch[1], 10);

      // Get Chapter title from next paragraph
      let chapterTitle = `Chapter ${chapterNum}`;
      if (i + 1 < paragraphs.length) {
        const nextP = paragraphs[i + 1];
        const nextPlain = nextP.content.replace(/<[^>]+>/g, '').trim();
        if (nextP.full.includes('text-align:center') && nextP.content.includes('font-weight:bold')) {
          chapterTitle = nextPlain;
          i++; // Skip the title paragraph

          // Check for subtitle (italicized question)
          if (i + 1 < paragraphs.length) {
            const subtitleP = paragraphs[i + 1];
            if (subtitleP.full.includes('text-align:center') && subtitleP.content.includes('font-style:italic')) {
              // Skip subtitle
              i++;
            }
          }
        }
      }

      const partNum = chapterToPart[chapterNum];
      // Ensure we have the parent part (get or create in database)
      const parentPartId = getOrCreatePart(partNum, null);

      currentPart = partNum;
      currentPartId = parentPartId;

      currentChapter = {
        id: uuidv4(),
        entryType: 'chapter',
        partNumber: partNum,
        chapterNumber: chapterNum,
        sectionLetter: null,
        subsectionNumber: null,
        title: chapterTitle,
        content: '',
        summary: null,
        parentId: parentPartId,
        sortOrder: sortOrder++,
        wordCount: 0
      };
      entries.push(currentChapter);
      currentSection = null;
      currentSubsection = null;  // Reset subsection when new chapter starts
      continue;
    }

    // Detect Section headers: "A. Title" or "B. Title" (centered, bold)
    // Bold can be on <p> tag itself OR on inner <span>
    const sectionMatch = plainText.match(/^([A-Z])\.\s+(.+)$/);
    const isBold = pFull.includes('font-weight:bold') || pContent.includes('font-weight:bold');
    if (sectionMatch && pFull.includes('text-align:center') && isBold) {
      const [, letter, title] = sectionMatch;
      currentSection = {
        id: uuidv4(),
        entryType: 'section',
        partNumber: currentChapter?.partNumber,
        chapterNumber: currentChapter?.chapterNumber,
        sectionLetter: letter,
        subsectionNumber: null,
        title: title,
        content: '',
        summary: null,
        parentId: currentChapter?.id || null,
        sortOrder: sortOrder++,
        wordCount: 0
      };
      entries.push(currentSection);
      currentSubsection = null;  // Reset subsection when new section starts
      continue;
    }

    // Detect Sub-section: "1. Title" at start of paragraph (bold)
    const subsectionMatch = plainText.match(/^(\d+)\.\s+(.+)/);
    if (subsectionMatch && pContent.includes('font-weight:bold')) {
      const [, number, rest] = subsectionMatch;
      // Extract just the title (up to first period if it's a sentence)
      const titleMatch = rest.match(/^([^.]+\.?)/);
      const title = titleMatch ? titleMatch[1].trim() : rest.trim();

      currentSubsection = {
        id: uuidv4(),
        entryType: 'subsection',
        partNumber: currentSection?.partNumber || currentChapter?.partNumber,
        chapterNumber: currentSection?.chapterNumber || currentChapter?.chapterNumber,
        sectionLetter: currentSection?.sectionLetter,
        subsectionNumber: parseInt(number, 10),
        title: title.replace(/\.$/, ''), // Remove trailing period
        content: convertContent(pContent),
        summary: null,
        parentId: currentSection?.id || currentChapter?.id || null,
        sortOrder: sortOrder++,
        wordCount: 0
      };
      currentSubsection.wordCount = countWords(currentSubsection.content);
      entries.push(currentSubsection);
      continue;
    }

    // Skip special content markers (EXPLANATION AND SCRIPTURAL BASIS, QUESTIONS, etc.)
    if (pFull.includes('text-align:center') && pContent.includes('font-weight:bold')) {
      // This is likely a section header like "EXPLANATION AND SCRIPTURAL BASIS"
      // We can skip it or use it to structure content
      continue;
    }

    // Regular content - add to current subsection/section/chapter (priority order)
    const convertedContent = convertContent(pContent);
    if (convertedContent && convertedContent.length > 10) { // Skip very short content
      const target = currentSubsection || currentSection || currentChapter;
      if (target) {
        target.content += (target.content ? '\n' : '') + `<p>${convertedContent}</p>`;
        target.wordCount = countWords(target.content);
      }
    }
  }

  return entries;
}

/**
 * Parse Roman numerals
 */
function parseRomanNumeral(str) {
  const romanMap = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const upper = str.toUpperCase();
  let result = 0;
  let prev = 0;

  for (let i = upper.length - 1; i >= 0; i--) {
    const current = romanMap[upper[i]];
    if (!current) return null;
    if (current < prev) {
      result -= current;
    } else {
      result += current;
    }
    prev = current;
  }

  return result;
}

/**
 * Clear existing systematic theology data
 */
function clearData() {
  console.log('Clearing existing systematic theology data...');
  db.exec('DELETE FROM systematic_chapter_tags');
  db.exec('DELETE FROM systematic_related');
  db.exec('DELETE FROM systematic_annotations');
  db.exec('DELETE FROM systematic_scripture_index');
  db.exec('DELETE FROM systematic_theology');
  console.log('Data cleared.');
}

/**
 * Insert entry into database
 */
function insertEntry(entry) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO systematic_theology (
      id, entry_type, part_number, chapter_number, section_letter, subsection_number,
      title, content, summary, parent_id, sort_order, word_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    entry.id,
    entry.entryType,
    entry.partNumber,
    entry.chapterNumber,
    entry.sectionLetter,
    entry.subsectionNumber,
    entry.title,
    entry.content,
    entry.summary,
    entry.parentId,
    entry.sortOrder,
    entry.wordCount,
    now,
    now
  );
}

/**
 * Insert scripture index entry
 */
function insertScriptureIndex(systematicId, ref, isPrimary, contextSnippet) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO systematic_scripture_index (
      id, systematic_id, book, chapter, start_verse, end_verse, is_primary, context_snippet, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    uuidv4(),
    systematicId,
    ref.book,
    ref.chapter,
    ref.startVerse,
    ref.endVerse,
    isPrimary ? 1 : 0,
    contextSnippet,
    now
  );
}

/**
 * Insert cross-reference (related chapter)
 */
function insertCrossRef(sourceChapter, targetChapter) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO systematic_related (
      id, source_chapter, target_chapter, relationship_type, created_at
    ) VALUES (?, ?, ?, 'see_also', ?)
  `);

  stmt.run(uuidv4(), sourceChapter, targetChapter, now);
}

/**
 * Link chapter to tag
 */
function linkChapterToTag(chapterNumber) {
  const partNum = chapterToPart[chapterNumber];
  if (!partNum) return;

  const tagId = partToTag[partNum];
  if (!tagId) return;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO systematic_chapter_tags (chapter_number, tag_id)
    VALUES (?, ?)
  `);

  stmt.run(chapterNumber, tagId);
}

/**
 * Main import function
 */
async function importSystematicTheology(htmlContent) {
  console.log('Parsing HTML content...');
  const entries = parseLogosHtml(htmlContent);
  console.log(`Found ${entries.length} entries`);

  if (dryRun) {
    console.log('\n=== DRY RUN - Not saving to database ===\n');
    console.log('Entries by type:');
    const byType = {};
    for (const e of entries) {
      byType[e.entryType] = (byType[e.entryType] || 0) + 1;
    }
    console.log(byType);

    console.log('\nSample entries:');
    entries.slice(0, 5).forEach(e => {
      console.log(`  [${e.entryType}] ${e.title}`);
    });
    return;
  }

  console.log('Inserting entries into database...');
  const insertTransaction = db.transaction(() => {
    for (const entry of entries) {
      insertEntry(entry);

      // Extract and index scripture references
      if (entry.content) {
        const refs = extractScriptureRefs(entry.content);
        refs.forEach((ref, index) => {
          // Mark first 5 refs as primary
          insertScriptureIndex(entry.id, ref, index < 5, ref.text);
        });

        // Extract and save cross-references
        if (entry.entryType === 'chapter' && entry.chapterNumber) {
          const crossRefs = extractCrossRefs(entry.content);
          crossRefs.forEach(targetChapter => {
            if (targetChapter !== entry.chapterNumber) {
              insertCrossRef(entry.chapterNumber, targetChapter);
            }
          });

          // Link chapter to tag based on part
          linkChapterToTag(entry.chapterNumber);
        }
      }
    }
  });

  insertTransaction();
  console.log('Import complete!');

  // Print summary
  const counts = {
    parts: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'part'").get().c,
    chapters: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'chapter'").get().c,
    sections: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'section'").get().c,
    subsections: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'subsection'").get().c,
    scriptureRefs: db.prepare("SELECT COUNT(*) as c FROM systematic_scripture_index").get().c,
    crossRefs: db.prepare("SELECT COUNT(*) as c FROM systematic_related").get().c
  };

  console.log('\n=== Import Summary ===');
  console.log(`Parts: ${counts.parts}`);
  console.log(`Chapters: ${counts.chapters}`);
  console.log(`Sections: ${counts.sections}`);
  console.log(`Sub-sections: ${counts.subsections}`);
  console.log(`Scripture References: ${counts.scriptureRefs}`);
  console.log(`Cross-References: ${counts.crossRefs}`);
}

/**
 * Generate sample data for testing (when no HTML file provided)
 */
function generateSampleData() {
  console.log('No HTML file provided. Generating sample data for testing...');

  const now = new Date().toISOString();
  const sampleEntries = [];

  // Create Part 1
  const part1Id = uuidv4();
  sampleEntries.push({
    id: part1Id,
    entryType: 'part',
    partNumber: 1,
    chapterNumber: null,
    sectionLetter: null,
    subsectionNumber: null,
    title: 'Part 1: The Doctrine of the Word of God',
    content: '<p>This section covers the doctrine of Scripture, including its authority, clarity, necessity, and sufficiency.</p>',
    summary: 'The doctrine of Scripture: authority, clarity, necessity, and sufficiency.',
    parentId: null,
    sortOrder: 0,
    wordCount: 15
  });

  // Create Chapter 1
  const ch1Id = uuidv4();
  sampleEntries.push({
    id: ch1Id,
    entryType: 'chapter',
    partNumber: 1,
    chapterNumber: 1,
    sectionLetter: null,
    subsectionNumber: null,
    title: 'Introduction to Systematic Theology',
    content: `<p>Systematic theology is any study that answers the question, "What does the whole Bible teach us today?" about any given topic. This definition indicates that systematic theology involves collecting and understanding all the relevant passages in the Bible on various topics and then summarizing their teachings clearly.</p>
<p>The study of systematic theology is of great value because it enables us to understand and explain the teachings of the Bible more accurately and coherently. <a data-scripture="MAT.28.19-20" class="scripture-link">Matthew 28:19-20</a> commands us to teach disciples "to observe all that I have commanded you."</p>`,
    summary: 'Introduction to systematic theology: definition, purpose, and importance of studying doctrine.',
    parentId: part1Id,
    sortOrder: 1,
    wordCount: 100
  });

  // Create Section A
  const sec1AId = uuidv4();
  sampleEntries.push({
    id: sec1AId,
    entryType: 'section',
    partNumber: 1,
    chapterNumber: 1,
    sectionLetter: 'A',
    subsectionNumber: null,
    title: 'Definition of Systematic Theology',
    content: `<p>Systematic theology is the study of what the whole Bible teaches us today about any given topic. Unlike biblical theology, which traces themes through the biblical narrative, systematic theology organizes doctrine topically.</p>
<p>Key scripture: <a data-scripture="2TI.3.16-17" class="scripture-link">2 Timothy 3:16-17</a> - "All Scripture is breathed out by God and profitable for teaching, for reproof, for correction, and for training in righteousness."</p>`,
    summary: 'Definition: studying what the whole Bible teaches about any topic, organized topically.',
    parentId: ch1Id,
    sortOrder: 2,
    wordCount: 75
  });

  // Create Subsection 1
  sampleEntries.push({
    id: uuidv4(),
    entryType: 'subsection',
    partNumber: 1,
    chapterNumber: 1,
    sectionLetter: 'A',
    subsectionNumber: 1,
    title: 'Relationship to Other Disciplines',
    content: `<p>Systematic theology relates to several other disciplines: biblical theology (which traces themes through the biblical story), historical theology (how doctrines developed over time), and philosophical theology (which examines philosophical questions about God).</p>`,
    summary: 'How systematic theology relates to biblical, historical, and philosophical theology.',
    parentId: sec1AId,
    sortOrder: 3,
    wordCount: 45
  });

  // Create Chapter 32 (commonly referenced - "Regeneration")
  const ch32Id = uuidv4();
  sampleEntries.push({
    id: ch32Id,
    entryType: 'chapter',
    partNumber: 5,
    chapterNumber: 32,
    sectionLetter: null,
    subsectionNumber: null,
    title: 'Regeneration',
    content: `<p>Regeneration is a secret act of God in which he imparts new spiritual life to us. This is sometimes called "being born again" (using language from <a data-scripture="JHN.3.3-8" class="scripture-link">John 3:3-8</a>).</p>
<p>Regeneration is entirely a work of God. We do not cooperate with God or make any contribution to regeneration. <a data-scripture="EPH.2.5" class="scripture-link">Ephesians 2:5</a> says God "made us alive together with Christ."</p>
<p>See also chapter 35 on conversion and chapter 36 on justification.</p>`,
    summary: 'Regeneration: God\'s secret act of imparting new spiritual life, being "born again."',
    parentId: null,
    sortOrder: 100,
    wordCount: 85
  });

  // Create Section for Chapter 32
  sampleEntries.push({
    id: uuidv4(),
    entryType: 'section',
    partNumber: 5,
    chapterNumber: 32,
    sectionLetter: 'A',
    subsectionNumber: null,
    title: 'Regeneration Is Totally a Work of God',
    content: `<p>The Bible clearly teaches that regeneration is a work of God alone. In <a data-scripture="JHN.1.13" class="scripture-link">John 1:13</a>, believers are said to be born "not of blood nor of the will of the flesh nor of the will of man, but of God."</p>`,
    summary: 'Regeneration is entirely God\'s work, not human effort.',
    parentId: ch32Id,
    sortOrder: 101,
    wordCount: 50
  });

  return sampleEntries;
}

/**
 * Main entry point
 */
async function main() {
  console.log('=== SACRED Systematic Theology Importer ===\n');

  if (shouldClear) {
    clearData();
  }

  let htmlContent;

  if (inputPath) {
    const fullPath = path.resolve(inputPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: File not found: ${fullPath}`);
      process.exit(1);
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Process all HTML files in directory
      const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.html') || f.endsWith('.htm'));
      console.log(`Found ${files.length} HTML files in directory`);

      for (const file of files) {
        console.log(`\nProcessing: ${file}`);
        htmlContent = fs.readFileSync(path.join(fullPath, file), 'utf8');
        await importSystematicTheology(htmlContent);
      }
      return;
    } else {
      htmlContent = fs.readFileSync(fullPath, 'utf8');
      await importSystematicTheology(htmlContent);
    }
  } else {
    // Generate sample data for testing
    const sampleEntries = generateSampleData();

    if (dryRun) {
      console.log('\n=== DRY RUN - Sample Data ===\n');
      sampleEntries.forEach(e => {
        console.log(`[${e.entryType}] Ch${e.chapterNumber || '-'} ${e.sectionLetter || ''} - ${e.title}`);
      });
      return;
    }

    console.log('\nInserting sample data...');
    const insertTransaction = db.transaction(() => {
      for (const entry of sampleEntries) {
        insertEntry(entry);

        // Extract and index scripture references
        if (entry.content) {
          const refs = extractScriptureRefs(entry.content);
          refs.forEach((ref, index) => {
            insertScriptureIndex(entry.id, ref, index < 5, ref.text);
          });

          // Extract and save cross-references
          if (entry.entryType === 'chapter' && entry.chapterNumber) {
            const crossRefs = extractCrossRefs(entry.content);
            crossRefs.forEach(targetChapter => {
              if (targetChapter !== entry.chapterNumber) {
                insertCrossRef(entry.chapterNumber, targetChapter);
              }
            });

            linkChapterToTag(entry.chapterNumber);
          }
        }
      }
    });

    insertTransaction();

    console.log('\nSample data inserted successfully!');
    console.log('Use with HTML file: node scripts/import-systematic-theology.cjs <path-to-html>');

    // Print summary
    const counts = {
      entries: db.prepare("SELECT COUNT(*) as c FROM systematic_theology").get().c,
      scriptureRefs: db.prepare("SELECT COUNT(*) as c FROM systematic_scripture_index").get().c,
      crossRefs: db.prepare("SELECT COUNT(*) as c FROM systematic_related").get().c
    };

    console.log('\n=== Summary ===');
    console.log(`Entries: ${counts.entries}`);
    console.log(`Scripture References: ${counts.scriptureRefs}`);
    console.log(`Cross-References: ${counts.crossRefs}`);
  }
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
