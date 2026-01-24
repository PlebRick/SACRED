import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sessionsService } from '../../../src/services/sessionsService';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('sessionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('log', () => {
    it('logs a Bible study session', async () => {
      const sessionData = {
        sessionType: 'bible',
        referenceId: 'JHN:3',
        referenceLabel: 'John 3',
        durationSeconds: 300,
      };
      const createdSession = { id: 'session-1', ...sessionData, createdAt: '2024-01-15T12:00:00.000Z' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createdSession),
      });

      const result = await sessionsService.log(sessionData);

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });
      expect(result).toEqual(createdSession);
    });

    it('logs a doctrine study session', async () => {
      const sessionData = {
        sessionType: 'doctrine',
        referenceId: 'ch32',
        referenceLabel: 'The Trinity',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'session-2', ...sessionData }),
      });

      const result = await sessionsService.log(sessionData);

      expect(result.sessionType).toBe('doctrine');
    });

    it('logs a note viewing session', async () => {
      const sessionData = {
        sessionType: 'note',
        referenceId: 'note-uuid-123',
        referenceLabel: 'My Study Note',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'session-3', ...sessionData }),
      });

      const result = await sessionsService.log(sessionData);

      expect(result.sessionType).toBe('note');
    });

    it('returns null on failure without throwing', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await sessionsService.log({
        sessionType: 'bible',
        referenceId: 'JHN:1',
      });

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('returns null on network error without throwing', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await sessionsService.log({
        sessionType: 'bible',
        referenceId: 'JHN:1',
      });

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('getRecent', () => {
    it('fetches recent sessions with defaults', async () => {
      const mockResponse = {
        sessions: [
          { id: 'session-1', sessionType: 'bible', referenceId: 'JHN:3' },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await sessionsService.getRecent();

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions?');
      expect(result).toEqual(mockResponse);
    });

    it('fetches with pagination options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: [], total: 0 }),
      });

      await sessionsService.getRecent({ limit: 10, offset: 20 });

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions?limit=10&offset=20');
    });

    it('filters by session type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: [], total: 0 }),
      });

      await sessionsService.getRecent({ type: 'bible' });

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions?type=bible');
    });

    it('filters by date range', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: [], total: 0 }),
      });

      await sessionsService.getRecent({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions?startDate=2024-01-01&endDate=2024-01-31');
    });

    it('combines all filter options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: [], total: 0 }),
      });

      await sessionsService.getRecent({
        limit: 25,
        offset: 5,
        type: 'doctrine',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('limit=25');
      expect(url).toContain('offset=5');
      expect(url).toContain('type=doctrine');
      expect(url).toContain('startDate=2024-01-01');
      expect(url).toContain('endDate=2024-12-31');
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(sessionsService.getRecent()).rejects.toThrow('Failed to fetch sessions');
    });
  });

  describe('getSummary', () => {
    it('fetches summary with default days', async () => {
      const mockSummary = {
        period: { days: 30 },
        byType: { bible: 10, doctrine: 5, note: 3 },
        topBibleChapters: [{ referenceId: 'JHN:3', count: 5 }],
        topDoctrines: [{ referenceId: 'ch32', count: 3 }],
        topNotes: [],
        dailyActivity: [],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSummary),
      });

      const result = await sessionsService.getSummary();

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/summary?days=30');
      expect(result).toEqual(mockSummary);
    });

    it('fetches summary with custom days', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ period: { days: 7 } }),
      });

      await sessionsService.getSummary(7);

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/summary?days=7');
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(sessionsService.getSummary()).rejects.toThrow('Failed to fetch session summary');
    });
  });

  describe('findRelated', () => {
    it('finds sessions related to a Bible book', async () => {
      const mockRelated = {
        sessions: [{ id: 'session-1', sessionType: 'bible', referenceId: 'ROM:8' }],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRelated),
      });

      const result = await sessionsService.findRelated({ book: 'ROM' });

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/related?book=ROM');
      expect(result).toEqual(mockRelated);
    });

    it('finds sessions related to a specific chapter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: [] }),
      });

      await sessionsService.findRelated({ book: 'JHN', chapter: 3 });

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/related?book=JHN&chapter=3');
    });

    it('finds sessions related to a doctrine chapter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: [] }),
      });

      await sessionsService.findRelated({ doctrineChapter: 32 });

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/related?doctrineChapter=32');
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(sessionsService.findRelated({ book: 'ROM' })).rejects.toThrow('Failed to fetch related sessions');
    });
  });
});
