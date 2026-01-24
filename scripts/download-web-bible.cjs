#!/usr/bin/env node

/**
 * Downloads the complete World English Bible from bible-api.com
 * and saves it as a single JSON file for offline use.
 *
 * Usage: node scripts/download-web-bible.cjs
 * Output: myfiles/web-bible-complete.json (~4MB)
 *
 * Features:
 * - Resume capability: loads existing file and skips already-downloaded chapters
 * - Retry with exponential backoff for rate limits (429)
 * - Progress saving after each book
 */

const fs = require('fs');
const path = require('path');

// Bible structure with chapter counts
const books = [
  { id: 'GEN', apiName: 'genesis', chapters: 50 },
  { id: 'EXO', apiName: 'exodus', chapters: 40 },
  { id: 'LEV', apiName: 'leviticus', chapters: 27 },
  { id: 'NUM', apiName: 'numbers', chapters: 36 },
  { id: 'DEU', apiName: 'deuteronomy', chapters: 34 },
  { id: 'JOS', apiName: 'joshua', chapters: 24 },
  { id: 'JDG', apiName: 'judges', chapters: 21 },
  { id: 'RUT', apiName: 'ruth', chapters: 4 },
  { id: '1SA', apiName: '1samuel', chapters: 31 },
  { id: '2SA', apiName: '2samuel', chapters: 24 },
  { id: '1KI', apiName: '1kings', chapters: 22 },
  { id: '2KI', apiName: '2kings', chapters: 25 },
  { id: '1CH', apiName: '1chronicles', chapters: 29 },
  { id: '2CH', apiName: '2chronicles', chapters: 36 },
  { id: 'EZR', apiName: 'ezra', chapters: 10 },
  { id: 'NEH', apiName: 'nehemiah', chapters: 13 },
  { id: 'EST', apiName: 'esther', chapters: 10 },
  { id: 'JOB', apiName: 'job', chapters: 42 },
  { id: 'PSA', apiName: 'psalms', chapters: 150 },
  { id: 'PRO', apiName: 'proverbs', chapters: 31 },
  { id: 'ECC', apiName: 'ecclesiastes', chapters: 12 },
  { id: 'SNG', apiName: 'songofsolomon', chapters: 8 },
  { id: 'ISA', apiName: 'isaiah', chapters: 66 },
  { id: 'JER', apiName: 'jeremiah', chapters: 52 },
  { id: 'LAM', apiName: 'lamentations', chapters: 5 },
  { id: 'EZK', apiName: 'ezekiel', chapters: 48 },
  { id: 'DAN', apiName: 'daniel', chapters: 12 },
  { id: 'HOS', apiName: 'hosea', chapters: 14 },
  { id: 'JOL', apiName: 'joel', chapters: 3 },
  { id: 'AMO', apiName: 'amos', chapters: 9 },
  { id: 'OBA', apiName: 'obadiah', chapters: 1 },
  { id: 'JON', apiName: 'jonah', chapters: 4 },
  { id: 'MIC', apiName: 'micah', chapters: 7 },
  { id: 'NAM', apiName: 'nahum', chapters: 3 },
  { id: 'HAB', apiName: 'habakkuk', chapters: 3 },
  { id: 'ZEP', apiName: 'zephaniah', chapters: 3 },
  { id: 'HAG', apiName: 'haggai', chapters: 2 },
  { id: 'ZEC', apiName: 'zechariah', chapters: 14 },
  { id: 'MAL', apiName: 'malachi', chapters: 4 },
  { id: 'MAT', apiName: 'matthew', chapters: 28 },
  { id: 'MRK', apiName: 'mark', chapters: 16 },
  { id: 'LUK', apiName: 'luke', chapters: 24 },
  { id: 'JHN', apiName: 'john', chapters: 21 },
  { id: 'ACT', apiName: 'acts', chapters: 28 },
  { id: 'ROM', apiName: 'romans', chapters: 16 },
  { id: '1CO', apiName: '1corinthians', chapters: 16 },
  { id: '2CO', apiName: '2corinthians', chapters: 13 },
  { id: 'GAL', apiName: 'galatians', chapters: 6 },
  { id: 'EPH', apiName: 'ephesians', chapters: 6 },
  { id: 'PHP', apiName: 'philippians', chapters: 4 },
  { id: 'COL', apiName: 'colossians', chapters: 4 },
  { id: '1TH', apiName: '1thessalonians', chapters: 5 },
  { id: '2TH', apiName: '2thessalonians', chapters: 3 },
  { id: '1TI', apiName: '1timothy', chapters: 6 },
  { id: '2TI', apiName: '2timothy', chapters: 4 },
  { id: 'TIT', apiName: 'titus', chapters: 3 },
  { id: 'PHM', apiName: 'philemon', chapters: 1 },
  { id: 'HEB', apiName: 'hebrews', chapters: 13 },
  { id: 'JAS', apiName: 'james', chapters: 5 },
  { id: '1PE', apiName: '1peter', chapters: 5 },
  { id: '2PE', apiName: '2peter', chapters: 3 },
  { id: '1JN', apiName: '1john', chapters: 5 },
  { id: '2JN', apiName: '2john', chapters: 1 },
  { id: '3JN', apiName: '3john', chapters: 1 },
  { id: 'JUD', apiName: 'jude', chapters: 1 },
  { id: 'REV', apiName: 'revelation', chapters: 22 }
];

// Calculate total chapters
const totalChapters = books.reduce((sum, book) => sum + book.chapters, 0);

// Rate limiting settings
const BASE_DELAY_MS = 1000; // 1 second between requests
const MAX_RETRIES = 5;
const BACKOFF_MULTIPLIER = 2;

// Output paths
const outputDir = path.join(__dirname, '..', 'myfiles');
const outputPath = path.join(outputDir, 'web-bible-complete.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchChapterWithRetry(apiName, chapter, retries = 0) {
  const url = `https://bible-api.com/${apiName}+${chapter}?translation=web`;

  try {
    const response = await fetch(url);

    if (response.status === 429) {
      // Rate limited - exponential backoff
      if (retries >= MAX_RETRIES) {
        throw new Error(`Rate limited after ${MAX_RETRIES} retries`);
      }
      const backoffMs = BASE_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, retries + 1);
      console.log(`\n  Rate limited, waiting ${backoffMs/1000}s before retry...`);
      await sleep(backoffMs);
      return fetchChapterWithRetry(apiName, chapter, retries + 1);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      reference: data.reference,
      verses: data.verses.map(v => ({
        verse: v.verse,
        text: v.text.trim()
      }))
    };
  } catch (error) {
    if (error.message.includes('Rate limited')) {
      throw error;
    }
    // Network errors - retry with backoff
    if (retries < MAX_RETRIES) {
      const backoffMs = BASE_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, retries);
      console.log(`\n  Error: ${error.message}, retrying in ${backoffMs/1000}s...`);
      await sleep(backoffMs);
      return fetchChapterWithRetry(apiName, chapter, retries + 1);
    }
    throw error;
  }
}

function loadExistingData() {
  try {
    if (fs.existsSync(outputPath)) {
      const data = fs.readFileSync(outputPath, 'utf8');
      console.log('Found existing data, will resume download...\n');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('Could not load existing data, starting fresh\n');
  }
  return {};
}

function saveProgress(bible) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(bible, null, 2));
}

function countExistingChapters(bible) {
  let count = 0;
  for (const bookId in bible) {
    count += Object.keys(bible[bookId]).length;
  }
  return count;
}

async function downloadBible() {
  console.log(`Downloading World English Bible (${totalChapters} chapters)...`);
  console.log(`Delay: ${BASE_DELAY_MS}ms between requests\n`);

  // Load existing progress
  const bible = loadExistingData();
  const existingCount = countExistingChapters(bible);

  if (existingCount > 0) {
    console.log(`Resuming: ${existingCount}/${totalChapters} chapters already downloaded\n`);
  }

  let downloaded = existingCount;
  let newDownloads = 0;
  let errors = [];

  for (const book of books) {
    if (!bible[book.id]) {
      bible[book.id] = {};
    }

    let bookHasNewDownloads = false;

    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      // Skip if already downloaded
      if (bible[book.id][chapter]) {
        continue;
      }

      try {
        const data = await fetchChapterWithRetry(book.apiName, chapter);
        bible[book.id][chapter] = data;
        downloaded++;
        newDownloads++;
        bookHasNewDownloads = true;

        const percent = Math.round((downloaded / totalChapters) * 100);
        process.stdout.write(`\r  ${book.id} ${chapter}/${book.chapters} (${percent}% complete)    `);

        await sleep(BASE_DELAY_MS);
      } catch (error) {
        errors.push({ book: book.id, chapter, error: error.message });
        console.error(`\n  Error: ${book.id} ${chapter} - ${error.message}`);
      }
    }

    // Save progress after each book
    if (bookHasNewDownloads) {
      saveProgress(bible);
      console.log(`  [saved]`);
    }
  }

  // Final save
  saveProgress(bible);

  const fileSizeKB = Math.round(fs.statSync(outputPath).size / 1024);
  const fileSizeMB = (fileSizeKB / 1024).toFixed(2);

  console.log(`\nComplete!`);
  console.log(`  Total chapters: ${downloaded}/${totalChapters}`);
  console.log(`  New downloads: ${newDownloads}`);
  console.log(`  File size: ${fileSizeMB} MB (${fileSizeKB} KB)`);
  console.log(`  Output: ${outputPath}`);

  if (errors.length > 0) {
    console.log(`\n  Errors (${errors.length}):`);
    errors.slice(0, 10).forEach(e => console.log(`    - ${e.book} ${e.chapter}: ${e.error}`));
    if (errors.length > 10) {
      console.log(`    ... and ${errors.length - 10} more`);
    }
    console.log('\n  Run the script again to retry failed chapters.');
  }
}

// Run
downloadBible().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
