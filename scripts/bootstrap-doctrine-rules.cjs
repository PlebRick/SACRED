#!/usr/bin/env node
'use strict';

/**
 * Bootstrap script: generates server/data/doctrine-matching-rules.json
 * from the systematic_theology database tables.
 *
 * Extracts chapter titles, summaries, section titles, and builds
 * keyword lists for the doctrine matching engine.
 *
 * Run once: node scripts/bootstrap-doctrine-rules.cjs
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/sacred.db');
const db = new Database(dbPath, { readonly: true });

// Common stop words to exclude from keyword extraction
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'not', 'no', 'nor',
  'as', 'if', 'then', 'than', 'that', 'this', 'these', 'those', 'it',
  'its', 'he', 'she', 'they', 'them', 'their', 'his', 'her', 'him',
  'we', 'us', 'our', 'you', 'your', 'who', 'whom', 'which', 'what',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
  'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own',
  'same', 'so', 'very', 'just', 'because', 'also', 'about', 'up',
  'out', 'into', 'over', 'after', 'before', 'between', 'under',
  'again', 'further', 'once', 'here', 'there', 'any', 'many',
  'one', 'two', 'three', 'four', 'five', 'first', 'second', 'third',
  'new', 'old', 'see', 'way', 'well', 'now', 'even', 'still',
  'through', 'however', 'since', 'while', 'chapter', 'section',
  'part', 'question', 'questions', 'answer', 'page', 'p', 'pp',
  'must', 'yet', 'much', 'get', 'got', 'make', 'made', 'like',
  'come', 'came', 'go', 'went', 'say', 'said', 'take', 'took',
  'give', 'gave', 'know', 'knew', 'think', 'thought', 'tell', 'told',
  'use', 'used', 'find', 'found', 'want', 'need', 'seem', 'try',
  'ask', 'work', 'call', 'called', 'let', 'keep', 'put', 'set',
  'look', 'mean', 'means', 'number', 'different', 'point', 'another',
  'next', 'following', 'above', 'below',
]);

// Strip HTML tags
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract distinctive keywords from text
function extractKeywords(text, maxCount = 20) {
  if (!text) return [];
  const words = text.toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  // Count word frequency
  const freq = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  // Sort by frequency, take top N
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([word]) => word);
}

// Extract multi-word phrases from title
function extractPhrases(title) {
  if (!title) return [];
  const phrases = [];
  const clean = title.toLowerCase()
    .replace(/[^a-z\s-]/g, '')
    .trim();

  // Keep the full title as a phrase if it's meaningful
  if (clean.length > 5 && clean.split(/\s+/).length <= 6) {
    phrases.push(clean);
  }

  // Extract significant bigrams from the title
  const words = clean.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (bigram.length > 6) phrases.push(bigram);
  }

  return [...new Set(phrases)];
}

// --- Build chapter keywords ---
const chapters = db.prepare(`
  SELECT chapter_number, title, summary, content
  FROM systematic_theology
  WHERE entry_type = 'chapter'
  ORDER BY chapter_number
`).all();

const chapterKeywords = {};
for (const ch of chapters) {
  const summaryText = stripHtml(ch.summary || '');
  const titleText = ch.title || '';
  // Use summary primarily, fall back to first ~500 chars of content
  const contentSnippet = stripHtml(ch.content || '').substring(0, 500);
  const combinedText = `${titleText} ${summaryText} ${contentSnippet}`;

  chapterKeywords[String(ch.chapter_number)] = {
    title: titleText,
    keywords: extractKeywords(combinedText, 15),
    phrases: extractPhrases(titleText),
    weight: 1.0,
  };
}

console.log(`Extracted keywords for ${Object.keys(chapterKeywords).length} chapters`);

// --- Build section keywords (only for sections with distinctive titles/summaries) ---
const sections = db.prepare(`
  SELECT st.chapter_number, st.section_letter, st.subsection_number,
         st.title, st.summary, st.entry_type
  FROM systematic_theology st
  WHERE st.entry_type IN ('section', 'subsection')
  AND st.chapter_number IS NOT NULL
  AND st.section_letter IS NOT NULL
  ORDER BY st.chapter_number, st.section_letter, st.subsection_number
`).all();

const sectionKeywords = {};
let sectionCount = 0;

for (const sec of sections) {
  const titleText = sec.title || '';
  const summaryText = stripHtml(sec.summary || '');

  // Only include sections with meaningful titles (not just "A." or "1.")
  if (titleText.length < 5) continue;

  // Build the section key: "32:A" or "32:A.1"
  let key = `${sec.chapter_number}:${sec.section_letter}`;
  if (sec.subsection_number != null) {
    key += `.${sec.subsection_number}`;
  }

  const combinedText = `${titleText} ${summaryText}`;
  const keywords = extractKeywords(combinedText, 10);
  const phrases = extractPhrases(titleText);

  // Only include if we got meaningful keywords
  if (keywords.length >= 3 || phrases.length >= 1) {
    sectionKeywords[key] = {
      title: titleText,
      keywords,
      phrases,
      weight: 1.0,
    };
    sectionCount++;
  }
}

console.log(`Extracted keywords for ${sectionCount} sections`);

// --- Assemble the rules file ---
const rules = {
  _version: 1,
  _description: 'Doctrine matching rules for intelligent Grudem chapter/section linking. Auto-generated by bootstrap-doctrine-rules.cjs, then manually curated.',
  _generated: new Date().toISOString(),

  chapterKeywords,
  sectionKeywords,
  correctionOverrides: {
    boosts: {},
    penalties: {},
  },
};

const outPath = path.join(__dirname, '../server/data/doctrine-matching-rules.json');
fs.writeFileSync(outPath, JSON.stringify(rules, null, 2));
console.log(`\nWrote ${outPath}`);
console.log(`  Chapters: ${Object.keys(chapterKeywords).length}`);
console.log(`  Sections: ${Object.keys(sectionKeywords).length}`);

db.close();
