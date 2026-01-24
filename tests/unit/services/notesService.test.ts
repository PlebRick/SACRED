import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notesService } from '../../../src/services/notesService';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('notesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getAll', () => {
    it('fetches all notes from API', async () => {
      const mockNotes = [
        { id: 'note-1', book: 'ROM', startChapter: 1, title: 'Test Note' },
        { id: 'note-2', book: 'JHN', startChapter: 3, title: 'Another Note' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotes),
      });

      const result = await notesService.getAll();

      expect(mockFetch).toHaveBeenCalledWith('/api/notes');
      expect(result).toEqual(mockNotes);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(notesService.getAll()).rejects.toThrow('Failed to fetch notes');
    });
  });

  describe('getById', () => {
    it('fetches single note by ID', async () => {
      const mockNote = { id: 'note-1', book: 'ROM', startChapter: 1, title: 'Test Note' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNote),
      });

      const result = await notesService.getById('note-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/notes/note-1');
      expect(result).toEqual(mockNote);
    });

    it('returns null for 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await notesService.getById('non-existent');

      expect(result).toBeNull();
    });

    it('throws error on other failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(notesService.getById('note-1')).rejects.toThrow('Failed to fetch note');
    });
  });

  describe('getByReference', () => {
    it('fetches notes for a specific book and chapter', async () => {
      const mockNotes = [
        { id: 'note-1', book: 'ROM', startChapter: 8, title: 'Romans 8 Note' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotes),
      });

      const result = await notesService.getByReference('ROM', 8);

      expect(mockFetch).toHaveBeenCalledWith('/api/notes/chapter/ROM/8');
      expect(result).toEqual(mockNotes);
    });

    it('encodes book parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await notesService.getByReference('1CO', 1);

      expect(mockFetch).toHaveBeenCalledWith('/api/notes/chapter/1CO/1');
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(notesService.getByReference('ROM', 8)).rejects.toThrow('Failed to fetch notes');
    });
  });

  describe('create', () => {
    it('creates a new note', async () => {
      const noteData = {
        book: 'ROM',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 7,
        title: 'New Note',
        content: '<p>Test content</p>',
        type: 'note',
      };
      const createdNote = { id: 'new-id', ...noteData };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createdNote),
      });

      const result = await notesService.create(noteData);

      expect(mockFetch).toHaveBeenCalledWith('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData),
      });
      expect(result).toEqual(createdNote);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(notesService.create({ book: 'ROM', startChapter: 1 })).rejects.toThrow('Failed to create note');
    });
  });

  describe('update', () => {
    it('updates an existing note', async () => {
      const updates = { title: 'Updated Title', content: '<p>Updated content</p>' };
      const updatedNote = { id: 'note-1', book: 'ROM', ...updates };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedNote),
      });

      const result = await notesService.update('note-1', updates);

      expect(mockFetch).toHaveBeenCalledWith('/api/notes/note-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      expect(result).toEqual(updatedNote);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(notesService.update('note-1', { title: 'Test' })).rejects.toThrow('Failed to update note');
    });
  });

  describe('delete', () => {
    it('deletes a note', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await notesService.delete('note-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/notes/note-1', { method: 'DELETE' });
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(notesService.delete('note-1')).rejects.toThrow('Failed to delete note');
    });
  });

  describe('getLastModified', () => {
    it('fetches last modified timestamp', async () => {
      const mockResponse = { lastModified: '2024-01-15T12:00:00.000Z' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await notesService.getLastModified();

      expect(mockFetch).toHaveBeenCalledWith('/api/notes/lastModified');
      expect(result).toEqual(mockResponse);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(notesService.getLastModified()).rejects.toThrow('Failed to get last modified');
    });
  });

  describe('search', () => {
    it('searches notes with default limit', async () => {
      const mockResults = [
        { id: 'note-1', title: 'Grace Note', snippet: '...grace...' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults),
      });

      const result = await notesService.search('grace');

      expect(mockFetch).toHaveBeenCalledWith('/api/notes/search?q=grace&limit=20');
      expect(result).toEqual(mockResults);
    });

    it('searches notes with custom limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await notesService.search('justification', 50);

      expect(mockFetch).toHaveBeenCalledWith('/api/notes/search?q=justification&limit=50');
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(notesService.search('test')).rejects.toThrow('Failed to search notes');
    });
  });
});
