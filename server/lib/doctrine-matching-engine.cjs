'use strict';

const path = require('path');
const fs = require('fs');
const { stripHtmlStructured } = require('./tagging-engine.cjs');

// Load and cache rules
let cachedRules = null;

function loadRules() {
  if (cachedRules) return cachedRules;
  const rulesPath = path.join(__dirname, '../data/doctrine-matching-rules.json');
  cachedRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  return cachedRules;
}

function reloadRules() {
  cachedRules = null;
  return loadRules();
}

// Cache for correction learning data
let correctionCache = null;
let correctionCacheTime = 0;
const CORRECTION_CACHE_TTL = 60000; // 1 minute

/**
 * Load correction learning data from doctrine_link_edits table.
 * Aggregates boosts (chapters users added) and penalties (chapters users removed).
 */
function loadCorrections(db) {
  const now = Date.now();
  if (correctionCache && (now - correctionCacheTime) < CORRECTION_CACHE_TTL) {
    return correctionCache;
  }

  const boosts = {};   // chapterNumber -> count of times manually added
  const penalties = {}; // chapterNumber -> count of times manually removed

  try {
    const edits = db.prepare(`
      SELECT links_added, links_removed FROM doctrine_link_edits
      WHERE links_added IS NOT NULL OR links_removed IS NOT NULL
    `).all();

    for (const edit of edits) {
      if (edit.links_added) {
        const added = JSON.parse(edit.links_added);
        for (const ref of added) {
          const m = ref.match(/Ch(\d+)/);
          if (m) boosts[m[1]] = (boosts[m[1]] || 0) + 1;
        }
      }
      if (edit.links_removed) {
        const removed = JSON.parse(edit.links_removed);
        for (const ref of removed) {
          const m = ref.match(/Ch(\d+)/);
          if (m) penalties[m[1]] = (penalties[m[1]] || 0) + 1;
        }
      }
    }
  } catch {
    // Non-fatal: table may not have data
  }

  correctionCache = { boosts, penalties };
  correctionCacheTime = now;
  return correctionCache;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Invert doctrineToTopic mapping: topicId -> [chapterNumbers]
 */
function invertDoctrineToTopic(doctrineToTopic) {
  const topicToChapters = {};
  for (const [ch, topicId] of Object.entries(doctrineToTopic)) {
    if (!topicToChapters[topicId]) topicToChapters[topicId] = [];
    topicToChapters[topicId].push(parseInt(ch, 10));
  }
  return topicToChapters;
}

// Cache inverted mapping
let topicToChaptersCache = null;

function getTopicToChapters() {
  if (topicToChaptersCache) return topicToChaptersCache;
  try {
    const taggingRulesPath = path.join(__dirname, '../data/tagging-rules.json');
    const taggingRules = JSON.parse(fs.readFileSync(taggingRulesPath, 'utf8'));
    topicToChaptersCache = invertDoctrineToTopic(taggingRules.doctrineToTopic || {});
  } catch {
    topicToChaptersCache = {};
  }
  return topicToChaptersCache;
}

/**
 * Analyze a note and produce doctrine link suggestions.
 *
 * @param {Object} note - { id, book, start_chapter, end_chapter, start_verse, end_verse, title, content, type, primary_topic_id }
 * @param {Object} db - better-sqlite3 database instance
 * @param {Object} [rules] - optional rules override
 * @returns {Array<{ chapterNumber, sectionLetter, subsectionNumber, linkSyntax, title, summary, confidence, signals, rawScore }>}
 */
function analyzeDoctrineLinks(note, db, rules) {
  if (!rules) rules = loadRules();

  const { title: extractedTitle, headings, body, doctrineLinks: existingLinks } = stripHtmlStructured(note.content);
  const noteTitle = note.title || extractedTitle;

  const titleLower = (noteTitle || '').toLowerCase();
  const headingsLower = headings.map(h => h.toLowerCase());
  const bodyLower = body.toLowerCase();
  const bodyWordCount = bodyLower.split(/\s+/).length || 1;

  // Build set of existing links for dedup
  const existingLinkSet = new Set();
  for (const link of existingLinks) {
    let key = `Ch${link.chapter}`;
    if (link.section) key += `:${link.section}`;
    if (link.subsection) key += `.${link.subsection}`;
    existingLinkSet.add(key);
  }

  // Score accumulator: key (e.g., "36" or "36:A" or "36:A.1") -> { scores, metadata }
  const scores = {};

  function initScore(key, meta) {
    if (!scores[key]) {
      scores[key] = {
        ...meta,
        scripture: 0,
        keyword: 0,
        topic: 0,
        correction: 0,
        signals: [],
      };
    }
  }

  // ==============================================================
  // Signal 1: Scripture index (weight 0.40)
  // ==============================================================
  try {
    const noteStart = note.start_chapter;
    const noteEnd = note.end_chapter || noteStart;

    // Query entries whose scripture refs overlap this note's passage
    const scriptureHits = db.prepare(`
      SELECT DISTINCT
        st.chapter_number,
        st.section_letter,
        st.subsection_number,
        st.entry_type,
        st.title,
        st.summary,
        ssi.is_primary,
        ssi.start_verse,
        ssi.end_verse,
        ssi.chapter as ref_chapter
      FROM systematic_scripture_index ssi
      JOIN systematic_theology st ON ssi.systematic_id = st.id
      WHERE ssi.book = ?
        AND ssi.chapter >= ? AND ssi.chapter <= ?
        AND st.chapter_number IS NOT NULL
      ORDER BY st.chapter_number, st.section_letter, st.subsection_number
    `).all(note.book, noteStart, noteEnd);

    for (const hit of scriptureHits) {
      let key, linkSyntax;
      if (hit.entry_type === 'section' && hit.section_letter) {
        key = `${hit.chapter_number}:${hit.section_letter}`;
        linkSyntax = `[[ST:Ch${hit.chapter_number}:${hit.section_letter}]]`;
      } else if (hit.entry_type === 'subsection' && hit.section_letter && hit.subsection_number != null) {
        key = `${hit.chapter_number}:${hit.section_letter}.${hit.subsection_number}`;
        linkSyntax = `[[ST:Ch${hit.chapter_number}:${hit.section_letter}.${hit.subsection_number}]]`;
      } else {
        key = String(hit.chapter_number);
        linkSyntax = `[[ST:Ch${hit.chapter_number}]]`;
      }

      initScore(key, {
        chapterNumber: hit.chapter_number,
        sectionLetter: hit.section_letter || null,
        subsectionNumber: hit.subsection_number != null ? hit.subsection_number : null,
        linkSyntax,
        title: hit.title,
        summary: (hit.summary || '').substring(0, 150),
      });

      const entry = scores[key];

      if (hit.is_primary) {
        if (hit.entry_type === 'section' || hit.entry_type === 'subsection') {
          entry.scripture += 4.0;
          entry.signals.push(`primary ref ${note.book} ${hit.ref_chapter}${hit.start_verse ? ':' + hit.start_verse : ''} (section)`);
        } else {
          entry.scripture += 3.0;
          entry.signals.push(`primary ref ${note.book} ${hit.ref_chapter}${hit.start_verse ? ':' + hit.start_verse : ''}`);
        }
      } else {
        if (hit.entry_type === 'section' || hit.entry_type === 'subsection') {
          entry.scripture += 1.5;
          entry.signals.push(`secondary ref ${note.book} ${hit.ref_chapter} (section)`);
        } else {
          entry.scripture += 1.0;
          entry.signals.push(`secondary ref ${note.book} ${hit.ref_chapter}`);
        }
      }

      // Verse overlap bonus: if note has verse range and ref has verse range
      if (note.start_verse && hit.start_verse) {
        const noteVStart = note.start_verse;
        const noteVEnd = note.end_verse || noteVStart;
        const refVEnd = hit.end_verse || hit.start_verse;
        // Check overlap
        if (noteVStart <= refVEnd && noteVEnd >= hit.start_verse) {
          entry.scripture += 1.0;
          entry.signals.push(`verse overlap ${hit.start_verse}-${refVEnd}`);
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // ==============================================================
  // Signal 2: Keyword matching (weight 0.30)
  // ==============================================================
  const chapterKw = rules.chapterKeywords || {};
  const sectionKw = rules.sectionKeywords || {};

  // Check chapter keywords
  for (const [chStr, config] of Object.entries(chapterKw)) {
    const chNum = parseInt(chStr, 10);
    const key = chStr;

    initScore(key, {
      chapterNumber: chNum,
      sectionLetter: null,
      subsectionNumber: null,
      linkSyntax: `[[ST:Ch${chNum}]]`,
      title: config.title,
      summary: '',
    });

    const entry = scores[key];
    const weight = config.weight || 1.0;

    // Phrase matching (higher value)
    for (const phrase of (config.phrases || [])) {
      const phraseL = phrase.toLowerCase();
      if (titleLower.includes(phraseL)) {
        entry.keyword += 2.5 * weight;
        entry.signals.push(`phrase "${phrase}" in title`);
      }
      for (const h of headingsLower) {
        if (h.includes(phraseL)) {
          entry.keyword += 2.0 * weight;
          entry.signals.push(`phrase "${phrase}" in heading`);
        }
      }
      // Body density
      let count = 0;
      let idx = bodyLower.indexOf(phraseL);
      while (idx !== -1) {
        count++;
        idx = bodyLower.indexOf(phraseL, idx + phraseL.length);
      }
      if (count > 0) {
        entry.keyword += Math.min(count * 0.8, 3.0) * weight;
        if (count >= 2) entry.signals.push(`phrase "${phrase}" x${count} in body`);
        else entry.signals.push(`phrase "${phrase}" in body`);
      }
    }

    // Single keyword matching
    for (const keyword of (config.keywords || [])) {
      const kwL = keyword.toLowerCase();
      if (kwL.length <= 3) continue;

      const regex = new RegExp(`\\b${escapeRegex(kwL)}\\b`, 'gi');

      if (titleLower.includes(kwL)) {
        entry.keyword += 1.5 * weight;
        entry.signals.push(`keyword "${keyword}" in title`);
      }

      const bodyMatches = bodyLower.match(regex);
      if (bodyMatches) {
        const density = bodyMatches.length / (bodyWordCount / 100);
        entry.keyword += Math.min(density, 3.0) * 0.4 * weight;
        if (bodyMatches.length >= 3) {
          entry.signals.push(`keyword "${keyword}" x${bodyMatches.length} in body`);
        }
      }
    }
  }

  // Check section keywords
  for (const [secKey, config] of Object.entries(sectionKw)) {
    // Parse section key: "36:A" or "36:A.1"
    const m = secKey.match(/^(\d+):([A-Z])(?:\.(\d+))?$/);
    if (!m) continue;

    const chNum = parseInt(m[1], 10);
    const secLetter = m[2];
    const subNum = m[3] ? parseInt(m[3], 10) : null;

    let linkSyntax = `[[ST:Ch${chNum}:${secLetter}]]`;
    if (subNum != null) linkSyntax = `[[ST:Ch${chNum}:${secLetter}.${subNum}]]`;

    initScore(secKey, {
      chapterNumber: chNum,
      sectionLetter: secLetter,
      subsectionNumber: subNum,
      linkSyntax,
      title: config.title,
      summary: '',
    });

    const entry = scores[secKey];
    const weight = config.weight || 1.0;

    // Phrase matching
    for (const phrase of (config.phrases || [])) {
      const phraseL = phrase.toLowerCase();
      if (titleLower.includes(phraseL)) {
        entry.keyword += 2.5 * weight;
        entry.signals.push(`section phrase "${phrase}" in title`);
      }
      for (const h of headingsLower) {
        if (h.includes(phraseL)) {
          entry.keyword += 2.0 * weight;
          entry.signals.push(`section phrase "${phrase}" in heading`);
        }
      }
      let count = 0;
      let idx = bodyLower.indexOf(phraseL);
      while (idx !== -1) {
        count++;
        idx = bodyLower.indexOf(phraseL, idx + phraseL.length);
      }
      if (count > 0) {
        entry.keyword += Math.min(count * 0.8, 3.0) * weight;
        entry.signals.push(`section phrase "${phrase}" x${count} in body`);
      }
    }

    // Single keyword matching for sections
    for (const keyword of (config.keywords || [])) {
      const kwL = keyword.toLowerCase();
      if (kwL.length <= 3) continue;

      const regex = new RegExp(`\\b${escapeRegex(kwL)}\\b`, 'gi');
      const bodyMatches = bodyLower.match(regex);
      if (bodyMatches && bodyMatches.length >= 2) {
        const density = bodyMatches.length / (bodyWordCount / 100);
        entry.keyword += Math.min(density, 2.0) * 0.3 * weight;
        if (bodyMatches.length >= 3) {
          entry.signals.push(`section keyword "${keyword}" x${bodyMatches.length}`);
        }
      }
    }
  }

  // ==============================================================
  // Signal 3: Topic correlation (weight 0.15)
  // ==============================================================
  if (note.primary_topic_id) {
    const topicToChapters = getTopicToChapters();
    const matchedChapters = topicToChapters[note.primary_topic_id] || [];

    for (const chNum of matchedChapters) {
      const key = String(chNum);
      const chConfig = chapterKw[key];
      initScore(key, {
        chapterNumber: chNum,
        sectionLetter: null,
        subsectionNumber: null,
        linkSyntax: `[[ST:Ch${chNum}]]`,
        title: chConfig ? chConfig.title : `Chapter ${chNum}`,
        summary: '',
      });
      scores[key].topic += 2.0;
      scores[key].signals.push(`topic correlation (primary topic maps to Ch${chNum})`);
    }
  }

  // ==============================================================
  // Signal 4: Correction learning (weight 0.15)
  // ==============================================================
  const corrections = loadCorrections(db);

  for (const [key, entry] of Object.entries(scores)) {
    const chStr = String(entry.chapterNumber);

    // Boost for chapters that have been manually added often
    const addCount = corrections.boosts[chStr] || 0;
    if (addCount > 1) {
      entry.correction += 0.5 * (addCount - 1);
      entry.signals.push(`correction boost: added ${addCount} times`);
    }

    // Penalty for chapters that have been manually removed often
    const removeCount = corrections.penalties[chStr] || 0;
    if (removeCount > 2) {
      entry.correction -= 0.5 * (removeCount - 2);
      entry.signals.push(`correction penalty: removed ${removeCount} times`);
    }
  }

  // Also check correctionOverrides from rules file
  const overrides = rules.correctionOverrides || {};
  for (const [key, entry] of Object.entries(scores)) {
    const chStr = String(entry.chapterNumber);
    if (overrides.boosts && overrides.boosts[chStr]) {
      entry.correction += overrides.boosts[chStr];
    }
    if (overrides.penalties && overrides.penalties[chStr]) {
      entry.correction -= overrides.penalties[chStr];
    }
  }

  // ==============================================================
  // Combine scores and normalize
  // ==============================================================
  const results = [];

  for (const [key, entry] of Object.entries(scores)) {
    // Skip existing links
    if (existingLinkSet.has(key.startsWith('Ch') ? key : `Ch${key}`)) continue;
    // Also check linkSyntax format
    const refFromSyntax = entry.linkSyntax.replace(/^\[\[ST:/, '').replace(/\]\]$/, '');
    if (existingLinkSet.has(refFromSyntax)) continue;

    // Cap individual signal contributions
    const scriptureNorm = Math.min(entry.scripture, 10);
    const keywordNorm = Math.min(entry.keyword, 10);
    const topicNorm = Math.min(entry.topic, 4);
    const correctionNorm = Math.max(Math.min(entry.correction, 3), -3);

    const combined =
      scriptureNorm * 0.40 +
      keywordNorm * 0.30 +
      topicNorm * 0.15 +
      correctionNorm * 0.15;

    if (combined > 0.1) {
      // Normalize to 0-1: sigmoid with denominator 4 (harder than tagging's 3)
      const confidence = Math.min(combined / (combined + 4), 0.99);

      results.push({
        chapterNumber: entry.chapterNumber,
        sectionLetter: entry.sectionLetter,
        subsectionNumber: entry.subsectionNumber,
        linkSyntax: entry.linkSyntax,
        title: entry.title,
        summary: entry.summary,
        confidence: Math.round(confidence * 100) / 100,
        signals: entry.signals,
        rawScore: Math.round(combined * 100) / 100,
      });
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  // Return top 8 suggestions
  return results.slice(0, 8);
}

module.exports = {
  loadRules,
  reloadRules,
  analyzeDoctrineLinks,
};
