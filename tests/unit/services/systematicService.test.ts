import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { systematicService } from '../../../src/services/systematicService';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('systematicService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getAll', () => {
    it('fetches all entries as tree structure', async () => {
      const mockTree = [
        {
          id: 'part-1',
          entryType: 'part',
          title: 'Part 1: Doctrine of God',
          children: [
            { id: 'ch-1', entryType: 'chapter', title: 'Chapter 1', children: [] },
          ],
        },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTree),
      });

      const result = await systematicService.getAll();

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic');
      expect(result).toEqual(mockTree);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.getAll()).rejects.toThrow('Failed to fetch systematic theology');
    });
  });

  describe('getFlat', () => {
    it('fetches all entries as flat list', async () => {
      const mockFlat = [
        { id: 'part-1', entryType: 'part', title: 'Part 1' },
        { id: 'ch-1', entryType: 'chapter', title: 'Chapter 1' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFlat),
      });

      const result = await systematicService.getFlat();

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/flat');
      expect(result).toEqual(mockFlat);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.getFlat()).rejects.toThrow('Failed to fetch systematic theology');
    });
  });

  describe('getById', () => {
    it('fetches single entry by ID', async () => {
      const mockEntry = {
        id: 'ch-32',
        entryType: 'chapter',
        chapterNumber: 32,
        title: 'The Trinity',
        content: '<p>Chapter content...</p>',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEntry),
      });

      const result = await systematicService.getById('ch-32');

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/ch-32');
      expect(result).toEqual(mockEntry);
    });

    it('returns null for 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await systematicService.getById('non-existent');

      expect(result).toBeNull();
    });

    it('throws error on other failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.getById('ch-32')).rejects.toThrow('Failed to fetch entry');
    });
  });

  describe('getChapter', () => {
    it('fetches chapter with all sections', async () => {
      const mockChapter = {
        chapter: {
          id: 'ch-32',
          chapterNumber: 32,
          title: 'The Trinity',
        },
        sections: [
          { id: 'sec-a', reference: 'A', title: 'Section A' },
        ],
        tags: [{ id: 'doctrine-god', name: 'Doctrine of God' }],
        related: [{ chapterNumber: 31, title: 'The Character of God' }],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChapter),
      });

      const result = await systematicService.getChapter(32);

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/chapter/32');
      expect(result).toEqual(mockChapter);
    });

    it('returns null for 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await systematicService.getChapter(999);

      expect(result).toBeNull();
    });

    it('throws error on other failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.getChapter(32)).rejects.toThrow('Failed to fetch chapter');
    });
  });

  describe('getForPassage', () => {
    it('fetches doctrines for a Bible passage', async () => {
      const mockDoctrines = [
        { chapterNumber: 32, title: 'The Trinity' },
        { chapterNumber: 26, title: 'The Deity of Christ' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDoctrines),
      });

      const result = await systematicService.getForPassage('JHN', 1);

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/for-passage/JHN/1');
      expect(result).toEqual(mockDoctrines);
    });

    it('encodes book parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await systematicService.getForPassage('1CO', 15);

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/for-passage/1CO/15');
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.getForPassage('ROM', 8)).rejects.toThrow('Failed to fetch doctrines for passage');
    });
  });

  describe('getTags', () => {
    it('fetches all tags', async () => {
      const mockTags = [
        { id: 'doctrine-god', name: 'Doctrine of God', color: '#4a90d9', chapterCount: 10 },
        { id: 'christology', name: 'Christology', color: '#d9a44a', chapterCount: 8 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTags),
      });

      const result = await systematicService.getTags();

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/tags');
      expect(result).toEqual(mockTags);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.getTags()).rejects.toThrow('Failed to fetch tags');
    });
  });

  describe('getByTag', () => {
    it('fetches chapters by tag', async () => {
      const mockChapters = [
        { chapterNumber: 31, title: 'The Character of God' },
        { chapterNumber: 32, title: 'The Trinity' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChapters),
      });

      const result = await systematicService.getByTag('doctrine-god');

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/by-tag/doctrine-god');
      expect(result).toEqual(mockChapters);
    });

    it('encodes tag ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await systematicService.getByTag('doctrine of god');

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/by-tag/doctrine%20of%20god');
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.getByTag('doctrine-god')).rejects.toThrow('Failed to fetch chapters by tag');
    });
  });

  describe('search', () => {
    it('searches entries with default limit', async () => {
      const mockResults = [
        { id: 'ch-32', title: 'The Trinity', snippet: '...three persons...' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults),
      });

      const result = await systematicService.search('trinity');

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/search?q=trinity&limit=20');
      expect(result).toEqual(mockResults);
    });

    it('searches with custom limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await systematicService.search('justification', 50);

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/search?q=justification&limit=50');
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.search('test')).rejects.toThrow('Failed to search');
    });
  });

  describe('getSummary', () => {
    it('fetches summary statistics', async () => {
      const mockSummary = {
        total: 776,
        byType: { part: 7, chapter: 57, section: 350, subsection: 362 },
        scriptureRefs: 4800,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSummary),
      });

      const result = await systematicService.getSummary();

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/summary');
      expect(result).toEqual(mockSummary);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.getSummary()).rejects.toThrow('Failed to fetch summary');
    });
  });

  describe('addAnnotation', () => {
    it('adds a highlight annotation', async () => {
      const annotationData = {
        annotationType: 'highlight',
        textSelection: 'three persons in one God',
        color: 'yellow',
        positionStart: 100,
        positionEnd: 124,
      };
      const createdAnnotation = { id: 'ann-1', systematicId: 'ch-32', ...annotationData };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createdAnnotation),
      });

      const result = await systematicService.addAnnotation('ch-32', annotationData);

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/ch-32/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(annotationData),
      });
      expect(result).toEqual(createdAnnotation);
    });

    it('adds a note annotation', async () => {
      const annotationData = {
        annotationType: 'note',
        textSelection: 'key text',
        content: 'My personal note about this passage',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'ann-2', ...annotationData }),
      });

      const result = await systematicService.addAnnotation('ch-32', annotationData);

      expect(result.annotationType).toBe('note');
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(systematicService.addAnnotation('ch-32', {})).rejects.toThrow('Failed to add annotation');
    });
  });

  describe('getAnnotations', () => {
    it('fetches annotations for an entry', async () => {
      const mockAnnotations = [
        { id: 'ann-1', annotationType: 'highlight', textSelection: 'text', color: 'yellow' },
        { id: 'ann-2', annotationType: 'note', content: 'My note' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAnnotations),
      });

      const result = await systematicService.getAnnotations('ch-32');

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/ch-32/annotations');
      expect(result).toEqual(mockAnnotations);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.getAnnotations('ch-32')).rejects.toThrow('Failed to fetch annotations');
    });
  });

  describe('deleteAnnotation', () => {
    it('deletes an annotation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await systematicService.deleteAnnotation('ann-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/annotations/ann-1', { method: 'DELETE' });
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(systematicService.deleteAnnotation('non-existent')).rejects.toThrow('Failed to delete annotation');
    });
  });

  describe('getReferencingNotes', () => {
    it('fetches notes that reference an entry', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Trinity Study', book: 'JHN' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotes),
      });

      const result = await systematicService.getReferencingNotes('ch-32');

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/ch-32/referencing-notes');
      expect(result).toEqual(mockNotes);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.getReferencingNotes('ch-32')).rejects.toThrow('Failed to fetch referencing notes');
    });
  });

  describe('importData', () => {
    it('imports systematic theology data', async () => {
      const importData = {
        systematic_theology: [{ id: 'ch-1', title: 'Chapter 1' }],
        scripture_index: [],
        tags: [],
      };
      const importResult = { message: 'Imported 1 entries', count: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(importResult),
      });

      const result = await systematicService.importData(importData);

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importData),
      });
      expect(result).toEqual(importResult);
    });

    it('throws error with server message on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid data format' }),
      });

      await expect(systematicService.importData({})).rejects.toThrow('Invalid data format');
    });

    it('throws generic error when no server message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error('parse error')),
      });

      await expect(systematicService.importData({})).rejects.toThrow('Failed to import');
    });
  });

  describe('exportData', () => {
    it('exports systematic theology data', async () => {
      const exportData = {
        systematic_theology: [],
        scripture_index: [],
        tags: [],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(exportData),
      });

      const result = await systematicService.exportData();

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/export');
      expect(result).toEqual(exportData);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.exportData()).rejects.toThrow('Failed to export systematic theology');
    });
  });

  describe('deleteAll', () => {
    it('deletes all systematic theology data', async () => {
      const deleteResult = { message: 'Deleted all entries', deleted: 776 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(deleteResult),
      });

      const result = await systematicService.deleteAll();

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic', { method: 'DELETE' });
      expect(result).toEqual(deleteResult);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.deleteAll()).rejects.toThrow('Failed to delete systematic theology');
    });
  });

  describe('getCount', () => {
    it('fetches entry count', async () => {
      const countResult = { count: 776 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(countResult),
      });

      const result = await systematicService.getCount();

      expect(mockFetch).toHaveBeenCalledWith('/api/systematic/count');
      expect(result).toEqual(countResult);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(systematicService.getCount()).rejects.toThrow('Failed to get count');
    });
  });
});
