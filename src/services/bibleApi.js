// Bible API Service with caching
// Uses backend proxy for multiple translations

const API_BASE = '/api/bible';
const CACHE_PREFIX = 'sacred_bible_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache for session
const memoryCache = new Map();

const getCacheKey = (translation, book, chapter) => `${CACHE_PREFIX}${translation}_${book}_${chapter}`;

const getFromCache = (translation, book, chapter) => {
  const key = getCacheKey(translation, book, chapter);

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

const setCache = (translation, book, chapter, data) => {
  const key = getCacheKey(translation, book, chapter);
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

export const fetchChapter = async (bookId, chapter, translation = 'esv') => {
  // Check cache first
  const cached = getFromCache(translation, bookId, chapter);
  if (cached) {
    return cached;
  }

  // Fetch from backend proxy
  const url = `${API_BASE}/${translation}/${bookId}/${chapter}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch chapter' }));
    throw new Error(error.error || `Failed to fetch ${bookId} ${chapter}`);
  }

  const data = await response.json();

  // Normalize response format
  const result = {
    reference: data.reference,
    translation: data.translation,
    verses: data.verses
  };

  // Cache the result
  setCache(translation, bookId, chapter, result);

  return result;
};

export const prefetchChapter = async (bookId, chapter, translation = 'esv') => {
  // Prefetch without blocking - for adjacent chapters
  try {
    await fetchChapter(bookId, chapter, translation);
  } catch (e) {
    console.warn('Prefetch failed:', e);
  }
};

// Clear cache for a specific translation (useful when switching)
export const clearTranslationCache = (translation) => {
  const prefix = `${CACHE_PREFIX}${translation}_`;

  // Clear memory cache
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }

  // Clear localStorage
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (e) {
    console.warn('Cache clear error:', e);
  }
};
