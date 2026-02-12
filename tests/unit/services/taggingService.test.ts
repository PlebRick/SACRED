import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { taggingService } from '../../../src/services/taggingService';

describe('taggingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyze', () => {
    it('sends POST to /api/tagging/analyze/:noteId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      });

      await taggingService.analyze('note-123');

      expect(mockFetch).toHaveBeenCalledWith('/api/tagging/analyze/note-123', { method: 'POST' });
    });

    it('appends type query param when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      });

      await taggingService.analyze('note-123', 'topics');

      expect(mockFetch).toHaveBeenCalledWith('/api/tagging/analyze/note-123?type=topics', { method: 'POST' });
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(taggingService.analyze('note-123')).rejects.toThrow('Failed to analyze note');
    });
  });

  describe('getSuggestions', () => {
    it('sends GET to /api/tagging/suggestions/:noteId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      });

      await taggingService.getSuggestions('note-123');

      expect(mockFetch).toHaveBeenCalledWith('/api/tagging/suggestions/note-123');
    });

    it('appends status filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      });

      await taggingService.getSuggestions('note-123', 'pending');

      expect(mockFetch).toHaveBeenCalledWith('/api/tagging/suggestions/note-123?status=pending');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(taggingService.getSuggestions('note-123')).rejects.toThrow('Failed to get suggestions');
    });
  });

  describe('apply', () => {
    it('sends POST with accepted and rejected IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ applied: 2, rejected: 1 }),
      });

      await taggingService.apply(['id-1', 'id-2'], ['id-3']);

      expect(mockFetch).toHaveBeenCalledWith('/api/tagging/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: ['id-1', 'id-2'], rejected: ['id-3'] }),
      });
    });

    it('uses empty arrays as defaults', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ applied: 0, rejected: 0 }),
      });

      await taggingService.apply();

      expect(mockFetch).toHaveBeenCalledWith('/api/tagging/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: [], rejected: [] }),
      });
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(taggingService.apply(['id-1'])).rejects.toThrow('Failed to apply suggestions');
    });
  });

  describe('getQueue', () => {
    it('sends GET to /api/tagging/queue with no params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ queue: [], stats: {} }),
      });

      await taggingService.getQueue();

      expect(mockFetch).toHaveBeenCalledWith('/api/tagging/queue');
    });

    it('sends query params for book and type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ queue: [], stats: {} }),
      });

      await taggingService.getQueue('ROM', 'commentary');

      expect(mockFetch).toHaveBeenCalledWith('/api/tagging/queue?book=ROM&type=commentary');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(taggingService.getQueue()).rejects.toThrow('Failed to get tagging queue');
    });
  });

  describe('batch', () => {
    it('sends POST with mode and options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ processed: 5, tagged: 3 }),
      });

      await taggingService.batch('auto', ['id-1'], 0.7);

      expect(mockFetch).toHaveBeenCalledWith('/api/tagging/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'auto', noteIds: ['id-1'], minConfidence: 0.7 }),
      });
    });

    it('defaults mode to analyze', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ processed: 10 }),
      });

      await taggingService.batch();

      expect(mockFetch).toHaveBeenCalledWith('/api/tagging/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'analyze', noteIds: undefined, minConfidence: undefined }),
      });
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(taggingService.batch('analyze')).rejects.toThrow('Failed to run batch tagging');
    });
  });
});
