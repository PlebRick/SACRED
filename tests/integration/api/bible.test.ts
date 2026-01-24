import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock fs module for local Bible loading
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import fs from 'fs';

// Create a fresh router for each test
function createBibleRouter() {
  const router = express.Router();

  // Reset the module cache to get fresh state
  let webBibleData: Record<string, Record<number, { reference: string; verses: Array<{ verse: number; text: string }> }>> | null = null;
  let webBibleLoadAttempted = false;

  const bookIdToApiName: Record<string, string> = {
    'GEN': 'genesis', 'EXO': 'exodus', 'ROM': 'romans', 'JHN': 'john',
    'MAT': 'matthew', 'MRK': 'mark', 'LUK': 'luke', 'ACT': 'acts',
    'REV': 'revelation',
  };

  const bookIdToEsvName: Record<string, string> = {
    'GEN': 'Genesis', 'EXO': 'Exodus', 'ROM': 'Romans', 'JHN': 'John',
    'MAT': 'Matthew', 'MRK': 'Mark', 'LUK': 'Luke', 'ACT': 'Acts',
    'REV': 'Revelation',
  };

  function loadLocalWebBible() {
    if (webBibleLoadAttempted) {
      return webBibleData;
    }
    webBibleLoadAttempted = true;

    const possiblePaths = ['/test/path/web-bible-complete.json'];

    for (const filePath of possiblePaths) {
      try {
        if ((fs.existsSync as any)(filePath)) {
          const data = (fs.readFileSync as any)(filePath, 'utf8');
          webBibleData = JSON.parse(data);
          return webBibleData;
        }
      } catch (error) {
        // Continue to next path
      }
    }

    return null;
  }

  function getLocalWebChapter(bookId: string, chapter: number) {
    const bible = loadLocalWebBible();
    if (!bible) return null;

    const bookData = bible[bookId];
    if (!bookData) return null;

    const chapterData = bookData[chapter];
    if (!chapterData) return null;

    return {
      reference: chapterData.reference,
      translation: 'WEB',
      verses: chapterData.verses,
    };
  }

  function parseEsvVerses(text: string) {
    const verses: Array<{ verse: number; text: string }> = [];
    const regex = /\[(\d+)\]\s*([^\[]*)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const verseNum = parseInt(match[1], 10);
      const verseText = match[2].trim();
      if (verseNum && verseText) {
        verses.push({ verse: verseNum, text: verseText });
      }
    }

    return verses;
  }

  async function fetchWeb(bookId: string, chapter: number) {
    // Try local data first
    const localData = getLocalWebChapter(bookId, chapter);
    if (localData) {
      return localData;
    }

    // Fallback to API
    const apiBookName = bookIdToApiName[bookId];
    if (!apiBookName) {
      throw new Error(`Unknown book ID: ${bookId}`);
    }

    const url = `https://bible-api.com/${apiBookName}+${chapter}?translation=web`;
    const response = await mockFetch(url);

    if (!response.ok) {
      throw new Error(`Bible API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      reference: data.reference,
      translation: 'WEB',
      verses: data.verses.map((v: { verse: number; text: string }) => ({
        verse: v.verse,
        text: v.text.trim(),
      })),
    };
  }

  async function fetchEsv(bookId: string, chapter: number) {
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

    const response = await mockFetch(url, {
      headers: { 'Authorization': `Token ${apiKey}` },
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
      verses,
    };
  }

  // GET /status
  router.get('/status', (req, res) => {
    const webBible = loadLocalWebBible();
    const esvApiKey = process.env.ESV_API_KEY;

    res.json({
      translations: {
        web: {
          available: true,
          offline: webBible !== null,
          source: webBible ? 'local' : 'api',
        },
        esv: {
          available: !!esvApiKey,
          offline: false,
          source: esvApiKey ? 'api' : null,
        },
      },
    });
  });

  // GET /:translation/:book/:chapter
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

describe('Bible API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    delete process.env.ESV_API_KEY;
    // Reset fs mocks
    (fs.existsSync as any).mockReturnValue(false);
    (fs.readFileSync as any).mockReturnValue('{}');

    app = express();
    app.use(express.json());
    app.use('/api/bible', createBibleRouter());
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('GET /api/bible/status', () => {
    it('returns status when no local Bible and no ESV key', async () => {
      const res = await request(app).get('/api/bible/status');

      expect(res.status).toBe(200);
      expect(res.body.translations.web).toEqual({
        available: true,
        offline: false,
        source: 'api',
      });
      expect(res.body.translations.esv).toEqual({
        available: false,
        offline: false,
        source: null,
      });
    });

    it('returns offline status when local WEB Bible exists', async () => {
      const mockBibleData = { JHN: { 1: { reference: 'John 1', verses: [] } } };
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockBibleData));

      // Create new app to pick up new mock state
      const newApp = express();
      newApp.use(express.json());
      newApp.use('/api/bible', createBibleRouter());

      const res = await request(newApp).get('/api/bible/status');

      expect(res.status).toBe(200);
      expect(res.body.translations.web.offline).toBe(true);
      expect(res.body.translations.web.source).toBe('local');
    });

    it('returns ESV available when API key is set', async () => {
      process.env.ESV_API_KEY = 'test-api-key';

      // Create new app to pick up new env state
      const newApp = express();
      newApp.use(express.json());
      newApp.use('/api/bible', createBibleRouter());

      const res = await request(newApp).get('/api/bible/status');

      expect(res.status).toBe(200);
      expect(res.body.translations.esv).toEqual({
        available: true,
        offline: false,
        source: 'api',
      });
    });
  });

  describe('GET /api/bible/:translation/:book/:chapter', () => {
    describe('input validation', () => {
      it('rejects invalid chapter number', async () => {
        const res = await request(app).get('/api/bible/web/JHN/abc');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid chapter number');
      });

      it('rejects negative chapter number', async () => {
        const res = await request(app).get('/api/bible/web/JHN/-1');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid chapter number');
      });

      it('rejects zero chapter number', async () => {
        const res = await request(app).get('/api/bible/web/JHN/0');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid chapter number');
      });

      it('rejects unknown translation', async () => {
        const res = await request(app).get('/api/bible/kjv/JHN/1');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Unknown translation: kjv');
      });
    });

    describe('WEB translation', () => {
      it('fetches from local data when available', async () => {
        const mockBibleData = {
          JHN: {
            1: {
              reference: 'John 1',
              verses: [
                { verse: 1, text: 'In the beginning was the Word...' },
              ],
            },
          },
        };
        (fs.existsSync as any).mockReturnValue(true);
        (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockBibleData));

        // Create new app to pick up mock state
        const newApp = express();
        newApp.use(express.json());
        newApp.use('/api/bible', createBibleRouter());

        const res = await request(newApp).get('/api/bible/web/JHN/1');

        expect(res.status).toBe(200);
        expect(res.body.reference).toBe('John 1');
        expect(res.body.translation).toBe('WEB');
        expect(res.body.verses).toHaveLength(1);
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('fetches from API when local data not available', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            reference: 'John 3',
            verses: [
              { verse: 1, text: 'Now there was a man of the Pharisees named Nicodemus...' },
            ],
          }),
        });

        const res = await request(app).get('/api/bible/web/JHN/3');

        expect(res.status).toBe(200);
        expect(res.body.translation).toBe('WEB');
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('bible-api.com/john+3')
        );
      });

      it('handles unknown book ID', async () => {
        const res = await request(app).get('/api/bible/web/UNKNOWN/1');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Unknown book ID: UNKNOWN');
      });

      it('handles API error', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 503,
        });

        const res = await request(app).get('/api/bible/web/JHN/1');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Bible API error: 503');
      });
    });

    describe('ESV translation', () => {
      beforeEach(() => {
        process.env.ESV_API_KEY = 'test-esv-key';
      });

      it('returns error when API key not configured', async () => {
        delete process.env.ESV_API_KEY;

        // Create new app without ESV key
        const newApp = express();
        newApp.use(express.json());
        newApp.use('/api/bible', createBibleRouter());

        const res = await request(newApp).get('/api/bible/esv/JHN/1');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('ESV API key not configured');
      });

      it('fetches from ESV API', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            passages: ['[1] In the beginning was the Word, and the Word was with God.'],
          }),
        });

        // Create new app with ESV key
        const newApp = express();
        newApp.use(express.json());
        newApp.use('/api/bible', createBibleRouter());

        const res = await request(newApp).get('/api/bible/esv/JHN/1');

        expect(res.status).toBe(200);
        expect(res.body.translation).toBe('ESV');
        expect(res.body.reference).toBe('John 1');
        expect(res.body.verses).toHaveLength(1);
        expect(res.body.verses[0].verse).toBe(1);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('api.esv.org'),
          expect.objectContaining({
            headers: { Authorization: 'Token test-esv-key' },
          })
        );
      });

      it('parses multiple verses from ESV response', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            passages: ['[1] First verse text. [2] Second verse text. [3] Third verse text.'],
          }),
        });

        const newApp = express();
        newApp.use(express.json());
        newApp.use('/api/bible', createBibleRouter());

        const res = await request(newApp).get('/api/bible/esv/ROM/1');

        expect(res.status).toBe(200);
        expect(res.body.verses).toHaveLength(3);
        expect(res.body.verses[0]).toEqual({ verse: 1, text: 'First verse text.' });
        expect(res.body.verses[1]).toEqual({ verse: 2, text: 'Second verse text.' });
        expect(res.body.verses[2]).toEqual({ verse: 3, text: 'Third verse text.' });
      });

      it('handles invalid API key (401)', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 401,
        });

        const newApp = express();
        newApp.use(express.json());
        newApp.use('/api/bible', createBibleRouter());

        const res = await request(newApp).get('/api/bible/esv/JHN/1');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Invalid ESV API key');
      });

      it('handles empty passages response', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ passages: [] }),
        });

        const newApp = express();
        newApp.use(express.json());
        newApp.use('/api/bible', createBibleRouter());

        const res = await request(newApp).get('/api/bible/esv/JHN/1');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('No passage found');
      });

      it('handles unknown book ID for ESV', async () => {
        const newApp = express();
        newApp.use(express.json());
        newApp.use('/api/bible', createBibleRouter());

        const res = await request(newApp).get('/api/bible/esv/UNKNOWN/1');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Unknown book ID: UNKNOWN');
      });
    });
  });
});
