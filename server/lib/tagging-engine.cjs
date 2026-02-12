'use strict';

const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

// Load and cache rules
let cachedRules = null;

function loadRules() {
  if (cachedRules) return cachedRules;
  const rulesPath = path.join(__dirname, '../data/tagging-rules.json');
  cachedRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  return cachedRules;
}

function reloadRules() {
  cachedRules = null;
  return loadRules();
}

/**
 * Strip HTML and return structured text zones for analysis.
 */
function stripHtmlStructured(html) {
  if (!html) return { title: '', headings: [], body: '', doctrineLinks: [] };

  const $ = cheerio.load(html);

  // Extract doctrine links [[ST:ChN]]
  const doctrineLinks = [];
  const linkRegex = /\[\[ST:Ch(\d+)(?::([A-Z])(?:\.(\d+))?)?\]\]/g;
  const fullText = $.text();
  let match;
  while ((match = linkRegex.exec(fullText)) !== null) {
    doctrineLinks.push({
      chapter: parseInt(match[1], 10),
      section: match[2] || null,
      subsection: match[3] ? parseInt(match[3], 10) : null,
    });
  }

  // Also extract from systematic-link spans
  $('span.systematic-link, span[data-st-ref]').each((_, el) => {
    const ref = $(el).attr('data-st-ref') || $(el).text();
    const refMatch = ref.match(/Ch(\d+)/);
    if (refMatch) {
      const ch = parseInt(refMatch[1], 10);
      if (!doctrineLinks.some(l => l.chapter === ch)) {
        doctrineLinks.push({ chapter: ch, section: null, subsection: null });
      }
    }
  });

  // Extract title (first h1/h2 or strong in first paragraph)
  let title = '';
  const h1 = $('h1').first().text().trim();
  const h2 = $('h2').first().text().trim();
  if (h1) title = h1;
  else if (h2) title = h2;

  // Extract all headings
  const headings = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    headings.push($(el).text().trim());
  });

  // Extract body text (strip tags)
  // Remove already-tagged inline tag spans from body to avoid double-counting
  $('span[data-inline-tag]').each((_, el) => {
    $(el).replaceWith($(el).text());
  });
  const body = $.text().trim();

  return { title, headings, body, doctrineLinks };
}

/**
 * Analyze a note and produce topic suggestions.
 *
 * @param {Object} note - { id, book, start_chapter, end_chapter, title, content, type, primary_topic_id }
 * @param {Object} db - better-sqlite3 database instance
 * @param {Object} [rules] - optional rules override (defaults to loaded rules)
 * @returns {Array<{ topicId, topicName, confidence, signals, suggestionType }>}
 */
function analyzeTopics(note, db, rules) {
  if (!rules) rules = loadRules();

  const { title: extractedTitle, headings, body, doctrineLinks } = stripHtmlStructured(note.content);
  const noteTitle = note.title || extractedTitle;

  const titleLower = (noteTitle || '').toLowerCase();
  const headingsLower = headings.map(h => h.toLowerCase());
  const bodyLower = body.toLowerCase();
  const bodyWordCount = bodyLower.split(/\s+/).length || 1;

  const scores = {}; // topicId -> { keyword, doctrine, passage, signals }

  const initScore = (topicId, topicName) => {
    if (!scores[topicId]) {
      scores[topicId] = {
        topicName,
        keyword: 0,
        doctrine: 0,
        passage: 0,
        signals: [],
      };
    }
  };

  // --- 1. Keyword scoring ---
  const topicKeywords = rules.topicKeywords || {};
  for (const [topicId, config] of Object.entries(topicKeywords)) {
    initScore(topicId, config.name);
    const entry = scores[topicId];

    // Check negative keywords first
    const negativeHit = (config.negativeKeywords || []).some(neg => bodyLower.includes(neg));

    // Phrase matching (higher weight)
    for (const phrase of (config.phrases || [])) {
      const phraseL = phrase.toLowerCase();
      if (titleLower.includes(phraseL)) {
        entry.keyword += 3.0 * (config.weight || 1.0);
        entry.signals.push(`phrase "${phrase}" in title`);
      }
      for (const h of headingsLower) {
        if (h.includes(phraseL)) {
          entry.keyword += 2.0 * (config.weight || 1.0);
          entry.signals.push(`phrase "${phrase}" in heading`);
        }
      }
      // Count occurrences in body
      let count = 0;
      let idx = bodyLower.indexOf(phraseL);
      while (idx !== -1) {
        count++;
        idx = bodyLower.indexOf(phraseL, idx + phraseL.length);
      }
      if (count > 0 && !negativeHit) {
        entry.keyword += count * 1.0 * (config.weight || 1.0);
        entry.signals.push(`phrase "${phrase}" x${count} in body`);
      }
    }

    // Single keyword matching
    for (const keyword of (config.keywords || [])) {
      const kwL = keyword.toLowerCase();
      // Word boundary match for single words
      const regex = kwL.length > 3 ? new RegExp(`\\b${escapeRegex(kwL)}\\b`, 'gi') : null;

      if (titleLower.includes(kwL)) {
        entry.keyword += 2.0 * (config.weight || 1.0);
        entry.signals.push(`keyword "${keyword}" in title`);
      }
      for (const h of headingsLower) {
        if (h.includes(kwL)) {
          entry.keyword += 1.5 * (config.weight || 1.0);
          entry.signals.push(`keyword "${keyword}" in heading`);
        }
      }
      if (regex) {
        const matches = bodyLower.match(regex);
        if (matches && !negativeHit) {
          // Normalize by text length: more mentions in shorter text = more relevant
          const density = matches.length / (bodyWordCount / 100);
          entry.keyword += Math.min(density, 5) * 0.5 * (config.weight || 1.0);
          if (matches.length >= 2) {
            entry.signals.push(`keyword "${keyword}" x${matches.length} in body`);
          }
        }
      }
    }
  }

  // --- 2. Doctrine mapping ---
  const doctrineToTopic = rules.doctrineToTopic || {};

  // From embedded links
  for (const link of doctrineLinks) {
    const topicId = doctrineToTopic[String(link.chapter)];
    if (topicId && topicKeywords[topicId]) {
      initScore(topicId, topicKeywords[topicId].name);
      scores[topicId].doctrine += 2.0;
      scores[topicId].signals.push(`doctrine link [[ST:Ch${link.chapter}]]`);
    }
  }

  // From scripture index: find doctrines that reference this note's passage
  if (db) {
    try {
      const scriptureDoctrines = db.prepare(`
        SELECT DISTINCT st.chapter_number
        FROM systematic_theology st
        JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
        WHERE ssi.book = ? AND ssi.chapter >= ? AND ssi.chapter <= ?
        AND st.entry_type = 'chapter'
      `).all(note.book, note.start_chapter, note.end_chapter || note.start_chapter);

      for (const row of scriptureDoctrines) {
        const topicId = doctrineToTopic[String(row.chapter_number)];
        if (topicId && topicKeywords[topicId]) {
          initScore(topicId, topicKeywords[topicId].name);
          scores[topicId].doctrine += 1.0;
          scores[topicId].signals.push(`passage maps to ST Ch${row.chapter_number}`);
        }
      }
    } catch {
      // db query failures are non-fatal
    }
  }

  // --- 3. Passage heuristics ---
  const heuristics = rules.passageHeuristics || [];
  for (const rule of heuristics) {
    if (rule.book === note.book) {
      const noteStart = note.start_chapter;
      const noteEnd = note.end_chapter || noteStart;
      // Check if note's chapter range overlaps the heuristic range
      if (noteStart <= rule.endChapter && noteEnd >= rule.startChapter) {
        for (const topicId of (rule.topicIds || [])) {
          if (topicKeywords[topicId]) {
            initScore(topicId, topicKeywords[topicId].name);
            scores[topicId].passage += rule.weight || 0.5;
            scores[topicId].signals.push(`passage heuristic: ${rule.book} ${rule.startChapter}-${rule.endChapter}`);
          }
        }
      }
    }
  }

  // --- 4. Content type weighting ---
  const contentWeights = rules.contentTypeWeights || {};
  const noteType = note.type || 'note';
  const typeWeights = contentWeights[noteType] || { doctrinal: 1.0, pastoral: 1.0 };
  const parentCategories = rules.parentCategories || {};
  const doctrinalTopics = new Set(parentCategories.doctrinal || []);
  const pastoralTopics = new Set(parentCategories.pastoral || []);

  // --- 5. Combine scores ---
  const results = [];
  for (const [topicId, entry] of Object.entries(scores)) {
    // Normalize keyword score by text length (cap contribution)
    const keywordNorm = Math.min(entry.keyword, 15);
    const doctrineNorm = Math.min(entry.doctrine, 5);
    const passageNorm = Math.min(entry.passage, 3);

    let combined = keywordNorm * 0.5 + doctrineNorm * 0.3 + passageNorm * 0.2;

    // Apply content type multiplier
    if (doctrinalTopics.has(topicId)) {
      combined *= typeWeights.doctrinal;
    } else if (pastoralTopics.has(topicId)) {
      combined *= typeWeights.pastoral;
    }

    if (combined > 0) {
      // Normalize to 0-1 range (sigmoid-like)
      const confidence = Math.min(combined / (combined + 3), 0.99);
      results.push({
        topicId,
        topicName: entry.topicName,
        confidence: Math.round(confidence * 100) / 100,
        signals: entry.signals,
        rawScore: Math.round(combined * 100) / 100,
      });
    }
  }

  // Sort by confidence descending, take top 5
  results.sort((a, b) => b.confidence - a.confidence);
  const top = results.slice(0, 5);

  // Label suggestion types
  return top.map((r, i) => ({
    ...r,
    suggestionType: i === 0 ? 'primary_topic' : 'secondary_topic',
  }));
}

/**
 * Analyze note HTML for inline tag suggestions.
 *
 * @param {string} noteHtml - raw HTML content
 * @param {Object} [rules] - optional rules override
 * @returns {Array<{ tagType, textContent, charOffsetStart, charOffsetEnd, confidence, signals }>}
 */
function analyzeInlineTags(noteHtml, rules) {
  if (!noteHtml) return [];
  if (!rules) rules = loadRules();

  const $ = cheerio.load(noteHtml);
  const patterns = rules.inlineTagPatterns || {};

  // Build plain text with character offsets mapping
  // Walk text nodes, skip already-tagged spans
  const textParts = [];
  let currentOffset = 0;

  function walkNodes(nodes) {
    nodes.each((_, el) => {
      if (el.type === 'text') {
        const text = $(el).text();
        textParts.push({ text, start: currentOffset, end: currentOffset + text.length });
        currentOffset += text.length;
      } else if (el.type === 'tag') {
        const $el = $(el);
        // Skip already-tagged inline tag spans
        if ($el.attr('data-inline-tag')) return;
        walkNodes($el.contents());
      }
    });
  }

  walkNodes($.root().contents());
  const fullText = textParts.map(p => p.text).join('');
  const fullTextLower = fullText.toLowerCase();

  const suggestions = [];

  // Helper: find sentence boundaries around a match
  function expandToSentence(start, end) {
    // Expand backward to sentence start
    let sentStart = start;
    const sentBoundary = /[.!?]\s/;
    for (let i = start - 1; i >= Math.max(0, start - 300); i--) {
      if (sentBoundary.test(fullText.substring(i, i + 2))) {
        sentStart = i + 2;
        break;
      }
      if (i === Math.max(0, start - 300)) sentStart = i;
    }

    // Expand forward to sentence end
    let sentEnd = end;
    for (let i = end; i < Math.min(fullText.length, end + 300); i++) {
      if (sentBoundary.test(fullText.substring(i, i + 2))) {
        sentEnd = i + 1;
        break;
      }
      if (i === Math.min(fullText.length, end + 300) - 1) sentEnd = i + 1;
    }

    return { start: sentStart, end: sentEnd };
  }

  // --- Process each inline tag type ---

  // Illustration detection
  if (patterns.illustration) {
    const cfg = patterns.illustration;

    // Start markers
    for (const marker of (cfg.startMarkers || [])) {
      const markerL = marker.toLowerCase();
      let idx = fullTextLower.indexOf(markerL);
      while (idx !== -1) {
        const { start, end } = expandToSentence(idx, idx + marker.length);
        const text = fullText.substring(start, end).trim();
        if (text.length >= (cfg.minLength || 30)) {
          suggestions.push({
            tagType: 'illustration',
            textContent: text,
            charOffsetStart: start,
            charOffsetEnd: end,
            confidence: 0.6,
            signals: [`start marker "${marker}"`],
          });
        }
        idx = fullTextLower.indexOf(markerL, idx + markerL.length);
      }
    }

    // Narrative patterns
    for (const pat of (cfg.narrativePatterns || [])) {
      try {
        const regex = new RegExp(pat, 'gi');
        let m;
        while ((m = regex.exec(fullText)) !== null) {
          const { start, end } = expandToSentence(m.index, m.index + m[0].length);
          const text = fullText.substring(start, end).trim();
          if (text.length >= (cfg.minLength || 30)) {
            suggestions.push({
              tagType: 'illustration',
              textContent: text,
              charOffsetStart: start,
              charOffsetEnd: end,
              confidence: 0.65,
              signals: [`narrative pattern: ${pat.substring(0, 30)}...`],
            });
          }
        }
      } catch { /* invalid regex */ }
    }
  }

  // Application detection
  if (patterns.application) {
    const cfg = patterns.application;

    for (const marker of (cfg.startMarkers || [])) {
      const markerL = marker.toLowerCase();
      let idx = fullTextLower.indexOf(markerL);
      while (idx !== -1) {
        const { start, end } = expandToSentence(idx, idx + marker.length);
        const text = fullText.substring(start, end).trim();
        if (text.length >= (cfg.minLength || 20)) {
          suggestions.push({
            tagType: 'application',
            textContent: text,
            charOffsetStart: start,
            charOffsetEnd: end,
            confidence: 0.6,
            signals: [`start marker "${marker}"`],
          });
        }
        idx = fullTextLower.indexOf(markerL, idx + markerL.length);
      }
    }

    for (const pat of (cfg.imperativePatterns || [])) {
      try {
        const regex = new RegExp(pat, 'gi');
        let m;
        while ((m = regex.exec(fullText)) !== null) {
          const { start, end } = expandToSentence(m.index, m.index + m[0].length);
          const text = fullText.substring(start, end).trim();
          if (text.length >= (cfg.minLength || 20)) {
            suggestions.push({
              tagType: 'application',
              textContent: text,
              charOffsetStart: start,
              charOffsetEnd: end,
              confidence: 0.55,
              signals: [`imperative pattern: ${pat.substring(0, 30)}...`],
            });
          }
        }
      } catch { /* invalid regex */ }
    }
  }

  // Quote detection
  if (patterns.quote) {
    const cfg = patterns.quote;

    for (const pat of (cfg.quoteMarkers || [])) {
      try {
        const regex = new RegExp(pat, 'g');
        let m;
        while ((m = regex.exec(fullText)) !== null) {
          const text = m[0].trim();
          if (text.length >= (cfg.minLength || 15)) {
            suggestions.push({
              tagType: 'quote',
              textContent: text,
              charOffsetStart: m.index,
              charOffsetEnd: m.index + m[0].length,
              confidence: 0.7,
              signals: ['quoted text detected'],
            });
          }
        }
      } catch { /* invalid regex */ }
    }

    for (const pat of (cfg.attributionPatterns || [])) {
      try {
        const regex = new RegExp(pat, 'gi');
        let m;
        while ((m = regex.exec(fullText)) !== null) {
          const { start, end } = expandToSentence(m.index, m.index + m[0].length);
          const text = fullText.substring(start, end).trim();
          if (text.length >= (cfg.minLength || 15)) {
            suggestions.push({
              tagType: 'quote',
              textContent: text,
              charOffsetStart: start,
              charOffsetEnd: end,
              confidence: 0.6,
              signals: [`attribution pattern: ${m[0].substring(0, 40)}`],
            });
          }
        }
      } catch { /* invalid regex */ }
    }
  }

  // Key point detection
  if (patterns.keypoint) {
    const cfg = patterns.keypoint;

    for (const pat of (cfg.emphasisPatterns || [])) {
      try {
        const regex = new RegExp(pat, 'gi');
        let m;
        while ((m = regex.exec(fullText)) !== null) {
          const { start, end } = expandToSentence(m.index, m.index + m[0].length);
          const text = fullText.substring(start, end).trim();
          if (text.length >= (cfg.minLength || 15)) {
            suggestions.push({
              tagType: 'keypoint',
              textContent: text,
              charOffsetStart: start,
              charOffsetEnd: end,
              confidence: 0.6,
              signals: [`emphasis pattern: ${m[0].substring(0, 30)}`],
            });
          }
        }
      } catch { /* invalid regex */ }
    }
  }

  // Cross-reference detection
  if (patterns.crossref) {
    const cfg = patterns.crossref;

    for (const pat of (cfg.referencePatterns || [])) {
      try {
        const regex = new RegExp(pat, 'gi');
        let m;
        while ((m = regex.exec(fullText)) !== null) {
          const text = m[0].trim();
          if (text.length >= (cfg.minLength || 5)) {
            suggestions.push({
              tagType: 'crossref',
              textContent: text,
              charOffsetStart: m.index,
              charOffsetEnd: m.index + m[0].length,
              confidence: 0.75,
              signals: ['cross-reference pattern'],
            });
          }
        }
      } catch { /* invalid regex */ }
    }
  }

  // --- Deduplicate overlapping detections ---
  // Sort by start offset
  suggestions.sort((a, b) => a.charOffsetStart - b.charOffsetStart || b.confidence - a.confidence);

  const deduped = [];
  for (const s of suggestions) {
    // Check if this overlaps with an existing higher-confidence suggestion of same type
    const overlapping = deduped.find(existing =>
      existing.tagType === s.tagType &&
      existing.charOffsetStart <= s.charOffsetEnd &&
      existing.charOffsetEnd >= s.charOffsetStart
    );

    if (overlapping) {
      // Merge: boost confidence of the existing one
      overlapping.confidence = Math.min(overlapping.confidence + 0.1, 0.95);
      overlapping.signals = [...new Set([...overlapping.signals, ...s.signals])];
      // Expand to cover both ranges
      overlapping.charOffsetStart = Math.min(overlapping.charOffsetStart, s.charOffsetStart);
      overlapping.charOffsetEnd = Math.max(overlapping.charOffsetEnd, s.charOffsetEnd);
      overlapping.textContent = fullText.substring(overlapping.charOffsetStart, overlapping.charOffsetEnd).trim();
    } else {
      deduped.push({ ...s });
    }
  }

  return deduped;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  loadRules,
  reloadRules,
  stripHtmlStructured,
  analyzeTopics,
  analyzeInlineTags,
};
