// Bible proxy route - handles multiple translations
// Proxies to external APIs and normalizes responses

const express = require('express');
const router = express.Router();

// Book ID to name mapping for bible-api.com (WEB)
const bookIdToApiName = {
  'GEN': 'genesis', 'EXO': 'exodus', 'LEV': 'leviticus', 'NUM': 'numbers',
  'DEU': 'deuteronomy', 'JOS': 'joshua', 'JDG': 'judges', 'RUT': 'ruth',
  '1SA': '1samuel', '2SA': '2samuel', '1KI': '1kings', '2KI': '2kings',
  '1CH': '1chronicles', '2CH': '2chronicles', 'EZR': 'ezra', 'NEH': 'nehemiah',
  'EST': 'esther', 'JOB': 'job', 'PSA': 'psalms', 'PRO': 'proverbs',
  'ECC': 'ecclesiastes', 'SNG': 'songofsolomon', 'ISA': 'isaiah', 'JER': 'jeremiah',
  'LAM': 'lamentations', 'EZK': 'ezekiel', 'DAN': 'daniel', 'HOS': 'hosea',
  'JOL': 'joel', 'AMO': 'amos', 'OBA': 'obadiah', 'JON': 'jonah',
  'MIC': 'micah', 'NAM': 'nahum', 'HAB': 'habakkuk', 'ZEP': 'zephaniah',
  'HAG': 'haggai', 'ZEC': 'zechariah', 'MAL': 'malachi', 'MAT': 'matthew',
  'MRK': 'mark', 'LUK': 'luke', 'JHN': 'john', 'ACT': 'acts',
  'ROM': 'romans', '1CO': '1corinthians', '2CO': '2corinthians', 'GAL': 'galatians',
  'EPH': 'ephesians', 'PHP': 'philippians', 'COL': 'colossians',
  '1TH': '1thessalonians', '2TH': '2thessalonians', '1TI': '1timothy',
  '2TI': '2timothy', 'TIT': 'titus', 'PHM': 'philemon', 'HEB': 'hebrews',
  'JAS': 'james', '1PE': '1peter', '2PE': '2peter', '1JN': '1john',
  '2JN': '2john', '3JN': '3john', 'JUD': 'jude', 'REV': 'revelation'
};

// Book ID to ESV book name mapping
const bookIdToEsvName = {
  'GEN': 'Genesis', 'EXO': 'Exodus', 'LEV': 'Leviticus', 'NUM': 'Numbers',
  'DEU': 'Deuteronomy', 'JOS': 'Joshua', 'JDG': 'Judges', 'RUT': 'Ruth',
  '1SA': '1 Samuel', '2SA': '2 Samuel', '1KI': '1 Kings', '2KI': '2 Kings',
  '1CH': '1 Chronicles', '2CH': '2 Chronicles', 'EZR': 'Ezra', 'NEH': 'Nehemiah',
  'EST': 'Esther', 'JOB': 'Job', 'PSA': 'Psalms', 'PRO': 'Proverbs',
  'ECC': 'Ecclesiastes', 'SNG': 'Song of Solomon', 'ISA': 'Isaiah', 'JER': 'Jeremiah',
  'LAM': 'Lamentations', 'EZK': 'Ezekiel', 'DAN': 'Daniel', 'HOS': 'Hosea',
  'JOL': 'Joel', 'AMO': 'Amos', 'OBA': 'Obadiah', 'JON': 'Jonah',
  'MIC': 'Micah', 'NAM': 'Nahum', 'HAB': 'Habakkuk', 'ZEP': 'Zephaniah',
  'HAG': 'Haggai', 'ZEC': 'Zechariah', 'MAL': 'Malachi', 'MAT': 'Matthew',
  'MRK': 'Mark', 'LUK': 'Luke', 'JHN': 'John', 'ACT': 'Acts',
  'ROM': 'Romans', '1CO': '1 Corinthians', '2CO': '2 Corinthians', 'GAL': 'Galatians',
  'EPH': 'Ephesians', 'PHP': 'Philippians', 'COL': 'Colossians',
  '1TH': '1 Thessalonians', '2TH': '2 Thessalonians', '1TI': '1 Timothy',
  '2TI': '2 Timothy', 'TIT': 'Titus', 'PHM': 'Philemon', 'HEB': 'Hebrews',
  'JAS': 'James', '1PE': '1 Peter', '2PE': '2 Peter', '1JN': '1 John',
  '2JN': '2 John', '3JN': '3 John', 'JUD': 'Jude', 'REV': 'Revelation'
};

// Parse ESV API response text into verses
// ESV returns: "[1] In the beginning... [2] The earth was..."
function parseEsvVerses(text) {
  const verses = [];
  // Match verse markers and capture verse number and following text
  const regex = /\[(\d+)\]\s*([^\[]*)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const verseNum = parseInt(match[1], 10);
    const verseText = match[2].trim();
    if (verseNum && verseText) {
      verses.push({
        verse: verseNum,
        text: verseText
      });
    }
  }

  return verses;
}

// Fetch from WEB translation (bible-api.com)
async function fetchWeb(bookId, chapter) {
  const apiBookName = bookIdToApiName[bookId];
  if (!apiBookName) {
    throw new Error(`Unknown book ID: ${bookId}`);
  }

  const url = `https://bible-api.com/${apiBookName}+${chapter}?translation=web`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Bible API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    reference: data.reference,
    translation: 'WEB',
    verses: data.verses.map(v => ({
      verse: v.verse,
      text: v.text.trim()
    }))
  };
}

// Fetch from ESV translation (api.esv.org)
async function fetchEsv(bookId, chapter) {
  const apiKey = process.env.ESV_API_KEY;
  if (!apiKey) {
    throw new Error('ESV API key not configured');
  }

  const esvBookName = bookIdToEsvName[bookId];
  if (!esvBookName) {
    throw new Error(`Unknown book ID: ${bookId}`);
  }

  const query = encodeURIComponent(`${esvBookName} ${chapter}`);
  const url = `https://api.esv.org/v3/passage/text/?q=${query}&include-verse-numbers=true&include-footnotes=false&include-headings=false&include-short-copyright=false&include-passage-references=false`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Token ${apiKey}`
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid ESV API key');
    }
    throw new Error(`ESV API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.passages || data.passages.length === 0) {
    throw new Error('No passage found');
  }

  const text = data.passages[0];
  const verses = parseEsvVerses(text);

  return {
    reference: `${esvBookName} ${chapter}`,
    translation: 'ESV',
    verses
  };
}

// GET /api/bible/:translation/:book/:chapter
router.get('/:translation/:book/:chapter', async (req, res) => {
  const { translation, book, chapter } = req.params;
  const chapterNum = parseInt(chapter, 10);

  if (isNaN(chapterNum) || chapterNum < 1) {
    return res.status(400).json({ error: 'Invalid chapter number' });
  }

  try {
    let result;

    if (translation === 'esv') {
      result = await fetchEsv(book, chapterNum);
    } else if (translation === 'web') {
      result = await fetchWeb(book, chapterNum);
    } else {
      return res.status(400).json({ error: `Unknown translation: ${translation}` });
    }

    res.json(result);
  } catch (error) {
    console.error(`Bible fetch error (${translation}/${book}/${chapter}):`, error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
