import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { topicsService } from '../../../src/services/topicsService';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('topicsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getTree', () => {
    it('fetches topics tree from API', async () => {
      const mockTree = [
        { id: 'topic-1', name: 'Soteriology', children: [], noteCount: 5 }
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTree),
      });

      const result = await topicsService.getTree();

      expect(mockFetch).toHaveBeenCalledWith('/api/topics');
      expect(result).toEqual(mockTree);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(topicsService.getTree()).rejects.toThrow('Failed to fetch topics');
    });
  });

  describe('getFlat', () => {
    it('fetches flat topics list from API', async () => {
      const mockFlat = [
        { id: 'topic-1', name: 'Soteriology', parentId: null },
        { id: 'topic-2', name: 'Justification', parentId: 'topic-1' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFlat),
      });

      const result = await topicsService.getFlat();

      expect(mockFetch).toHaveBeenCalledWith('/api/topics/flat');
      expect(result).toEqual(mockFlat);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(topicsService.getFlat()).rejects.toThrow('Failed to fetch topics');
    });
  });

  describe('getById', () => {
    it('fetches single topic by ID', async () => {
      const mockTopic = { id: 'topic-1', name: 'Soteriology', parentId: null };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTopic),
      });

      const result = await topicsService.getById('topic-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/topics/topic-1');
      expect(result).toEqual(mockTopic);
    });

    it('returns null for 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await topicsService.getById('non-existent');

      expect(result).toBeNull();
    });

    it('throws error on other failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(topicsService.getById('topic-1')).rejects.toThrow('Failed to fetch topic');
    });
  });

  describe('getNotes', () => {
    it('fetches notes for a topic', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Test Note', book: 'ROM' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotes),
      });

      const result = await topicsService.getNotes('topic-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/topics/topic-1/notes');
      expect(result).toEqual(mockNotes);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(topicsService.getNotes('topic-1')).rejects.toThrow('Failed to fetch notes for topic');
    });
  });

  describe('create', () => {
    it('creates a new topic', async () => {
      const topicData = { name: 'New Topic', parentId: null };
      const createdTopic = { id: 'new-id', ...topicData, sortOrder: 0 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createdTopic),
      });

      const result = await topicsService.create(topicData);

      expect(mockFetch).toHaveBeenCalledWith('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topicData),
      });
      expect(result).toEqual(createdTopic);
    });

    it('creates a topic with parent', async () => {
      const topicData = { name: 'Child Topic', parentId: 'parent-1' };
      const createdTopic = { id: 'new-id', ...topicData, sortOrder: 0 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createdTopic),
      });

      const result = await topicsService.create(topicData);

      expect(mockFetch).toHaveBeenCalledWith('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topicData),
      });
      expect(result).toEqual(createdTopic);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(topicsService.create({ name: 'Test' })).rejects.toThrow('Failed to create topic');
    });
  });

  describe('update', () => {
    it('updates an existing topic', async () => {
      const updates = { name: 'Updated Name' };
      const updatedTopic = { id: 'topic-1', name: 'Updated Name', parentId: null };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedTopic),
      });

      const result = await topicsService.update('topic-1', updates);

      expect(mockFetch).toHaveBeenCalledWith('/api/topics/topic-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      expect(result).toEqual(updatedTopic);
    });

    it('updates topic parent (move in tree)', async () => {
      const updates = { parentId: 'new-parent' };
      const updatedTopic = { id: 'topic-1', name: 'Test', parentId: 'new-parent' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedTopic),
      });

      const result = await topicsService.update('topic-1', updates);

      expect(result.parentId).toBe('new-parent');
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(topicsService.update('topic-1', { name: 'Test' })).rejects.toThrow('Failed to update topic');
    });
  });

  describe('delete', () => {
    it('deletes a topic', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await topicsService.delete('topic-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/topics/topic-1', { method: 'DELETE' });
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(topicsService.delete('topic-1')).rejects.toThrow('Failed to delete topic');
    });
  });

  describe('seed', () => {
    it('seeds default topics', async () => {
      const seedResult = { message: 'Seeded 15 topics', count: 15 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(seedResult),
      });

      const result = await topicsService.seed();

      expect(mockFetch).toHaveBeenCalledWith('/api/topics/seed', { method: 'POST' });
      expect(result).toEqual(seedResult);
    });

    it('throws error with message from server', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Topics already exist' }),
      });

      await expect(topicsService.seed()).rejects.toThrow('Topics already exist');
    });

    it('throws generic error when no message from server', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      await expect(topicsService.seed()).rejects.toThrow('Failed to seed topics');
    });
  });
});
