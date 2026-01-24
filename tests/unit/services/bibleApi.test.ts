import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchChapter, prefetchChapter, clearTranslationCache } from '../../../src/services/bibleApi';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage with proper store management
let localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { localStorageStore = {}; }),
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
  get length() { return Object.keys(localStorageStore).length; },
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('bibleApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage store
    localStorageStore = {};
    // Clear the module-level memory cache by calling clearTranslationCache
    clearTranslationCache('esv');
    clearTranslationCache('web');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchChapter', () => {
    it('fetches chapter from API', async () => {
      const mockData = {
        reference: 'John 1',
        translation: 'ESV',
        verses: [
          { verse: 1, text: 'In the beginning was the Word...' },
          { verse: 2, text: 'He was in the beginning with God.' },
        ],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await fetchChapter('JHN', 1, 'esv');

      expect(mockFetch).toHaveBeenCalledWith('/api/bible/esv/JHN/1');
      expect(result).toEqual({
        reference: 'John 1',
        translation: 'ESV',
        verses: mockData.verses,
      });
    });

    it('uses default translation (esv) when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reference: 'John 1', translation: 'ESV', verses: [] }),
      });

      await fetchChapter('JHN', 1);

      expect(mockFetch).toHaveBeenCalledWith('/api/bible/esv/JHN/1');
    });

    it('supports web translation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reference: 'John 1', translation: 'WEB', verses: [] }),
      });

      await fetchChapter('JHN', 1, 'web');

      expect(mockFetch).toHaveBeenCalledWith('/api/bible/web/JHN/1');
    });

    it('caches result in localStorage', async () => {
      const mockData = {
        reference: 'Romans 8',
        translation: 'ESV',
        verses: [{ verse: 1, text: 'There is therefore now no condemnation...' }],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      await fetchChapter('ROM', 8, 'esv');

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const [key, value] = localStorageMock.setItem.mock.calls[0];
      expect(key).toBe('sacred_bible_esv_ROM_8');
      const parsed = JSON.parse(value);
      expect(parsed.data.reference).toBe('Romans 8');
    });

    it('returns cached data without fetching', async () => {
      const cachedData = {
        data: { reference: 'Genesis 1', translation: 'ESV', verses: [] },
        timestamp: Date.now(),
      };
      // Populate the store directly
      localStorageStore['sacred_bible_esv_GEN_1'] = JSON.stringify(cachedData);

      const result = await fetchChapter('GEN', 1, 'esv');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData.data);
    });

    it('ignores expired cache and fetches fresh data', async () => {
      const expiredCache = {
        data: { reference: 'Genesis 1', translation: 'ESV', verses: [] },
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago (expired)
      };
      // Populate the store with expired data
      localStorageStore['sacred_bible_esv_GEN_1'] = JSON.stringify(expiredCache);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reference: 'Genesis 1', translation: 'ESV', verses: [] }),
      });

      await fetchChapter('GEN', 1, 'esv');

      expect(mockFetch).toHaveBeenCalled();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('sacred_bible_esv_GEN_1');
    });

    it('throws error with message from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid chapter number' }),
      });

      await expect(fetchChapter('JHN', 999, 'esv')).rejects.toThrow('Invalid chapter number');
    });

    it('throws generic error when API returns no message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error('parse error')),
      });

      // When json() fails to parse, the catch block returns { error: 'Failed to fetch chapter' }
      await expect(fetchChapter('JHN', 1, 'esv')).rejects.toThrow('Failed to fetch chapter');
    });

    it('handles localStorage errors gracefully', async () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('localStorage unavailable');
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reference: 'John 1', translation: 'ESV', verses: [] }),
      });

      // Should not throw, should fetch from API
      const result = await fetchChapter('JHN', 1, 'esv');

      expect(result.reference).toBe('John 1');
    });

    it('handles invalid cached JSON gracefully', async () => {
      // Populate the store with invalid JSON
      localStorageStore['sacred_bible_esv_JHN_1'] = 'invalid json';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reference: 'John 1', translation: 'ESV', verses: [] }),
      });

      const result = await fetchChapter('JHN', 1, 'esv');

      expect(mockFetch).toHaveBeenCalled();
      expect(result.reference).toBe('John 1');
    });
  });

  describe('prefetchChapter', () => {
    it('fetches chapter silently', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reference: 'John 2', translation: 'ESV', verses: [] }),
      });

      await prefetchChapter('JHN', 2, 'esv');

      expect(mockFetch).toHaveBeenCalledWith('/api/bible/esv/JHN/2');
    });

    it('does not throw on error', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      // Should not throw
      await expect(prefetchChapter('JHN', 999, 'esv')).resolves.toBeUndefined();

      consoleSpy.mockRestore();
    });

    it('uses default translation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reference: 'John 2', translation: 'ESV', verses: [] }),
      });

      await prefetchChapter('JHN', 2);

      expect(mockFetch).toHaveBeenCalledWith('/api/bible/esv/JHN/2');
    });
  });

  describe('clearTranslationCache', () => {
    it('removes all cached entries for a translation', () => {
      // Setup localStorage with multiple entries by populating the store
      localStorageStore = {
        'sacred_bible_esv_JHN_1': JSON.stringify({ data: {}, timestamp: Date.now() }),
        'sacred_bible_esv_ROM_8': JSON.stringify({ data: {}, timestamp: Date.now() }),
        'sacred_bible_web_JHN_1': JSON.stringify({ data: {}, timestamp: Date.now() }),
        'unrelated_key': 'some value',
      };
      vi.clearAllMocks(); // Clear mocks after setup to track only clearTranslationCache calls

      clearTranslationCache('esv');

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('sacred_bible_esv_JHN_1');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('sacred_bible_esv_ROM_8');
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('sacred_bible_web_JHN_1');
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('unrelated_key');
    });

    it('handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorageMock.key.mockImplementationOnce(() => {
        throw new Error('localStorage unavailable');
      });

      // Should not throw
      expect(() => clearTranslationCache('esv')).not.toThrow();

      consoleSpy.mockRestore();
    });
  });
});
