import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inlineTagsService } from '../../../src/services/inlineTagsService';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('inlineTagsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============== Tag Types Tests ==============

  describe('getTypes', () => {
    it('fetches all tag types', async () => {
      const mockTypes = [
        { id: 'illustration', name: 'Illustration', color: '#60a5fa', icon: '💡', isDefault: true },
        { id: 'application', name: 'Application', color: '#34d399', icon: '✅', isDefault: true },
        { id: 'custom', name: 'Custom Type', color: '#f472b6', icon: '🏷️', isDefault: false },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTypes),
      });

      const result = await inlineTagsService.getTypes();

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags/types');
      expect(result).toEqual(mockTypes);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(inlineTagsService.getTypes()).rejects.toThrow('Failed to fetch inline tag types');
    });
  });

  describe('createType', () => {
    it('creates a new tag type', async () => {
      const typeData = { name: 'Quote', color: '#a78bfa', icon: '📝' };
      const createdType = { id: 'quote', ...typeData, isDefault: false, sortOrder: 10 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createdType),
      });

      const result = await inlineTagsService.createType(typeData);

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeData),
      });
      expect(result).toEqual(createdType);
    });

    it('throws error with server message on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Tag type already exists' }),
      });

      await expect(inlineTagsService.createType({ name: 'Illustration' }))
        .rejects.toThrow('Tag type already exists');
    });

    it('throws generic error when no server message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(inlineTagsService.createType({ name: 'Test' }))
        .rejects.toThrow('Failed to create tag type');
    });
  });

  describe('updateType', () => {
    it('updates a tag type', async () => {
      const updates = { name: 'Updated Name', color: '#ff0000' };
      const updatedType = { id: 'custom', ...updates, isDefault: false };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedType),
      });

      const result = await inlineTagsService.updateType('custom', updates);

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags/types/custom', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      expect(result).toEqual(updatedType);
    });

    it('throws error with server message on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Cannot modify default tag type' }),
      });

      await expect(inlineTagsService.updateType('illustration', { name: 'Changed' }))
        .rejects.toThrow('Cannot modify default tag type');
    });
  });

  describe('deleteType', () => {
    it('deletes a tag type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await inlineTagsService.deleteType('custom');

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags/types/custom', { method: 'DELETE' });
    });

    it('throws error with server message on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Cannot delete default tag type' }),
      });

      await expect(inlineTagsService.deleteType('illustration'))
        .rejects.toThrow('Cannot delete default tag type');
    });
  });

  describe('seedTypes', () => {
    it('seeds default tag types', async () => {
      const seedResult = { message: 'Seeded 5 tag types', count: 5 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(seedResult),
      });

      const result = await inlineTagsService.seedTypes();

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags/types/seed', { method: 'POST' });
      expect(result).toEqual(seedResult);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(inlineTagsService.seedTypes()).rejects.toThrow('Failed to seed tag types');
    });
  });

  // ============== Tag Instances Tests ==============

  describe('getTags', () => {
    it('fetches all tags without filters', async () => {
      const mockTags = [
        { id: 'tag-1', tagType: 'illustration', textContent: 'A shepherd and his sheep', noteId: 'note-1' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTags),
      });

      const result = await inlineTagsService.getTags();

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags');
      expect(result).toEqual(mockTags);
    });

    it('fetches tags filtered by type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await inlineTagsService.getTags({ tagType: 'illustration' });

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags?tagType=illustration');
    });

    it('fetches tags filtered by book', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await inlineTagsService.getTags({ book: 'ROM' });

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags?book=ROM');
    });

    it('fetches tags with search filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await inlineTagsService.getTags({ search: 'grace' });

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags?search=grace');
    });

    it('fetches tags with pagination', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await inlineTagsService.getTags({ limit: 10, offset: 20 });

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags?limit=10&offset=20');
    });

    it('combines multiple filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await inlineTagsService.getTags({
        tagType: 'application',
        book: 'JHN',
        search: 'faith',
        limit: 50,
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('tagType=application');
      expect(url).toContain('book=JHN');
      expect(url).toContain('search=faith');
      expect(url).toContain('limit=50');
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(inlineTagsService.getTags()).rejects.toThrow('Failed to fetch inline tags');
    });
  });

  describe('getCountsByType', () => {
    it('fetches tag counts grouped by type', async () => {
      const mockCounts = {
        illustration: 15,
        application: 23,
        question: 8,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCounts),
      });

      const result = await inlineTagsService.getCountsByType();

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags/by-type');
      expect(result).toEqual(mockCounts);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(inlineTagsService.getCountsByType()).rejects.toThrow('Failed to fetch inline tag counts');
    });
  });

  describe('search', () => {
    it('searches tagged content with default limit', async () => {
      const mockResults = [
        { id: 'tag-1', tagType: 'illustration', textContent: 'The grace of God...', snippet: '...grace...' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults),
      });

      const result = await inlineTagsService.search('grace');

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags/search?q=grace&limit=50');
      expect(result).toEqual(mockResults);
    });

    it('searches with custom limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await inlineTagsService.search('faith', 100);

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags/search?q=faith&limit=100');
    });

    it('encodes search query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await inlineTagsService.search('love & grace');

      expect(mockFetch).toHaveBeenCalledWith('/api/inline-tags/search?q=love%20%26%20grace&limit=50');
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(inlineTagsService.search('test')).rejects.toThrow('Failed to search inline tags');
    });
  });
});
