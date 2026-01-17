// Bible API Service with caching
// Uses bible-api.com for WEB translation

const API_BASE = 'https://bible-api.com';
const CACHE_PREFIX = 'sacred_bible_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache for session
const memoryCache = new Map();

// Rate limiting: 15 requests per 30 seconds
const requestQueue = [];
const MAX_REQUESTS = 15;
const WINDOW_MS = 30000;

const waitForRateLimit = async () => {
  const now = Date.now();
  // Remove old requests from queue
  while (requestQueue.length > 0 && requestQueue[0] < now - WINDOW_MS) {
    requestQueue.shift();
  }

  if (requestQueue.length >= MAX_REQUESTS) {
    const waitTime = requestQueue[0] + WINDOW_MS - now;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return waitForRateLimit();
  }

  requestQueue.push(now);
};

const getCacheKey = (book, chapter) => `${CACHE_PREFIX}${book}_${chapter}`;

const getFromCache = (book, chapter) => {
  const key = getCacheKey(book, chapter);

  // Check memory cache first
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }

  // Check localStorage
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        memoryCache.set(key, data);
        return data;
      }
      localStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('Cache read error:', e);
  }

  return null;
};

const setCache = (book, chapter, data) => {
  const key = getCacheKey(book, chapter);
  memoryCache.set(key, data);

  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Cache write error:', e);
  }
};

// Map book IDs to bible-api.com format
const bookIdToApiName = {
  'GEN': 'genesis',
  'EXO': 'exodus',
  'LEV': 'leviticus',
  'NUM': 'numbers',
  'DEU': 'deuteronomy',
  'JOS': 'joshua',
  'JDG': 'judges',
  'RUT': 'ruth',
  '1SA': '1samuel',
  '2SA': '2samuel',
  '1KI': '1kings',
  '2KI': '2kings',
  '1CH': '1chronicles',
  '2CH': '2chronicles',
  'EZR': 'ezra',
  'NEH': 'nehemiah',
  'EST': 'esther',
  'JOB': 'job',
  'PSA': 'psalms',
  'PRO': 'proverbs',
  'ECC': 'ecclesiastes',
  'SNG': 'songofsolomon',
  'ISA': 'isaiah',
  'JER': 'jeremiah',
  'LAM': 'lamentations',
  'EZK': 'ezekiel',
  'DAN': 'daniel',
  'HOS': 'hosea',
  'JOL': 'joel',
  'AMO': 'amos',
  'OBA': 'obadiah',
  'JON': 'jonah',
  'MIC': 'micah',
  'NAM': 'nahum',
  'HAB': 'habakkuk',
  'ZEP': 'zephaniah',
  'HAG': 'haggai',
  'ZEC': 'zechariah',
  'MAL': 'malachi',
  'MAT': 'matthew',
  'MRK': 'mark',
  'LUK': 'luke',
  'JHN': 'john',
  'ACT': 'acts',
  'ROM': 'romans',
  '1CO': '1corinthians',
  '2CO': '2corinthians',
  'GAL': 'galatians',
  'EPH': 'ephesians',
  'PHP': 'philippians',
  'COL': 'colossians',
  '1TH': '1thessalonians',
  '2TH': '2thessalonians',
  '1TI': '1timothy',
  '2TI': '2timothy',
  'TIT': 'titus',
  'PHM': 'philemon',
  'HEB': 'hebrews',
  'JAS': 'james',
  '1PE': '1peter',
  '2PE': '2peter',
  '1JN': '1john',
  '2JN': '2john',
  '3JN': '3john',
  'JUD': 'jude',
  'REV': 'revelation'
};

export const fetchChapter = async (bookId, chapter) => {
  // Check cache first
  const cached = getFromCache(bookId, chapter);
  if (cached) {
    return cached;
  }

  // Wait for rate limit
  await waitForRateLimit();

  const apiBookName = bookIdToApiName[bookId];
  if (!apiBookName) {
    throw new Error(`Unknown book ID: ${bookId}`);
  }

  // Use the reference format that bible-api.com accepts
  const url = `${API_BASE}/${apiBookName}+${chapter}?translation=web`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${bookId} ${chapter}: ${response.status}`);
  }

  const data = await response.json();

  // Transform the response to our format
  const result = {
    reference: data.reference,
    verses: data.verses.map(v => ({
      verse: v.verse,
      text: v.text.trim()
    }))
  };

  // Cache the result
  setCache(bookId, chapter, result);

  return result;
};

export const prefetchChapter = async (bookId, chapter) => {
  // Prefetch without blocking - for adjacent chapters
  try {
    await fetchChapter(bookId, chapter);
  } catch (e) {
    console.warn('Prefetch failed:', e);
  }
};
