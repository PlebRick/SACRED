import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import React from 'react';
import { NotesProvider, useNotes } from '../../../src/context/NotesContext';

// Mock the notesService
vi.mock('../../../src/services/notesService', () => ({
  notesService: {
    getAll: vi.fn(),
    getLastModified: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { notesService } from '../../../src/services/notesService';

const mockNote = {
  id: 'test-note-1',
  book: 'ROM',
  startChapter: 1,
  startVerse: 1,
  endChapter: 1,
  endVerse: 7,
  title: 'Test Note',
  content: '<p>Test content</p>',
  type: 'note',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// Test component that displays state and provides action triggers
function TestConsumer() {
  const context = useNotes();
  return (
    <div>
      <span data-testid="loading">{String(context.loading)}</span>
      <span data-testid="error">{context.error || 'none'}</span>
      <span data-testid="notes-count">{context.notes.length}</span>
      <span data-testid="editing-id">{context.editingNoteId || 'none'}</span>
      <span data-testid="selected-id">{context.selectedNoteId || 'none'}</span>
      <ul data-testid="notes-list">
        {context.notes.map((n) => (
          <li key={n.id} data-testid={`note-${n.id}`}>
            {n.title}
          </li>
        ))}
      </ul>
      <button
        data-testid="create-btn"
        onClick={() =>
          context.createNote({
            book: 'GEN',
            startChapter: 1,
            endChapter: 1,
            title: 'New Note',
          })
        }
      >
        Create
      </button>
      <button
        data-testid="update-btn"
        onClick={() => context.updateNote('test-note-1', { title: 'Updated Title' })}
      >
        Update
      </button>
      <button data-testid="delete-btn" onClick={() => context.deleteNote('test-note-1')}>
        Delete
      </button>
      <button data-testid="set-editing-btn" onClick={() => context.setEditingNote('test-note-1')}>
        Set Editing
      </button>
      <button data-testid="clear-editing-btn" onClick={() => context.setEditingNote(null)}>
        Clear Editing
      </button>
      <button data-testid="set-selected-btn" onClick={() => context.setSelectedNote('test-note-1')}>
        Set Selected
      </button>
    </div>
  );
}

describe('NotesContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Default mock implementations
    (notesService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([mockNote]);
    (notesService.getLastModified as ReturnType<typeof vi.fn>).mockResolvedValue({
      lastModified: '2024-01-01T00:00:00.000Z',
    });
    (notesService.create as ReturnType<typeof vi.fn>).mockImplementation(async (data) => ({
      ...data,
      id: 'new-note-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    (notesService.update as ReturnType<typeof vi.fn>).mockImplementation(async (id, updates) => ({
      ...mockNote,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    }));
    (notesService.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('initial load', () => {
    it('loads notes on mount', async () => {
      render(
        <NotesProvider>
          <TestConsumer />
        </NotesProvider>
      );

      // Initially loading
      expect(screen.getByTestId('loading').textContent).toBe('true');

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('notes-count').textContent).toBe('1');
      expect(notesService.getAll).toHaveBeenCalledTimes(1);
      expect(notesService.getLastModified).toHaveBeenCalledTimes(1);
    });

    it('handles load error', async () => {
      (notesService.getAll as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      render(
        <NotesProvider>
          <TestConsumer />
        </NotesProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('error').textContent).toBe('Network error');
    });
  });

  describe('createNote', () => {
    it('adds note to state and sets editing', async () => {
      render(
        <NotesProvider>
          <TestConsumer />
        </NotesProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('create-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('notes-count').textContent).toBe('2');
      });

      expect(screen.getByTestId('editing-id').textContent).toBe('new-note-id');
      expect(notesService.create).toHaveBeenCalledWith({
        book: 'GEN',
        startChapter: 1,
        endChapter: 1,
        title: 'New Note',
      });
    });
  });

  describe('updateNote', () => {
    it('updates note in state', async () => {
      render(
        <NotesProvider>
          <TestConsumer />
        </NotesProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('update-btn').click();
      });

      await waitFor(() => {
        expect(notesService.update).toHaveBeenCalledWith('test-note-1', { title: 'Updated Title' });
      });
    });
  });

  describe('deleteNote', () => {
    it('removes note from state', async () => {
      render(
        <NotesProvider>
          <TestConsumer />
        </NotesProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('notes-count').textContent).toBe('1');
      });

      await act(async () => {
        screen.getByTestId('delete-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('notes-count').textContent).toBe('0');
      });

      expect(notesService.delete).toHaveBeenCalledWith('test-note-1');
    });

    it('clears editing if deleted note was being edited', async () => {
      render(
        <NotesProvider>
          <TestConsumer />
        </NotesProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      // Set the note as editing first
      await act(async () => {
        screen.getByTestId('set-editing-btn').click();
      });

      expect(screen.getByTestId('editing-id').textContent).toBe('test-note-1');

      // Delete the note
      await act(async () => {
        screen.getByTestId('delete-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('editing-id').textContent).toBe('none');
      });
    });
  });

  describe('setEditingNote', () => {
    it('sets the editing note id', async () => {
      render(
        <NotesProvider>
          <TestConsumer />
        </NotesProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('editing-id').textContent).toBe('none');

      await act(async () => {
        screen.getByTestId('set-editing-btn').click();
      });

      expect(screen.getByTestId('editing-id').textContent).toBe('test-note-1');
    });

    it('clears editing when set to null', async () => {
      render(
        <NotesProvider>
          <TestConsumer />
        </NotesProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('set-editing-btn').click();
      });

      expect(screen.getByTestId('editing-id').textContent).toBe('test-note-1');

      await act(async () => {
        screen.getByTestId('clear-editing-btn').click();
      });

      expect(screen.getByTestId('editing-id').textContent).toBe('none');
    });
  });

  describe('setSelectedNote', () => {
    it('sets the selected note id', async () => {
      render(
        <NotesProvider>
          <TestConsumer />
        </NotesProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('selected-id').textContent).toBe('none');

      await act(async () => {
        screen.getByTestId('set-selected-btn').click();
      });

      expect(screen.getByTestId('selected-id').textContent).toBe('test-note-1');
    });
  });

  describe('getNotesForChapter', () => {
    it('filters notes for a specific chapter', async () => {
      const multipleNotes = [
        { ...mockNote, id: '1', book: 'ROM', startChapter: 1, endChapter: 1 },
        { ...mockNote, id: '2', book: 'ROM', startChapter: 2, endChapter: 2 },
        { ...mockNote, id: '3', book: 'GEN', startChapter: 1, endChapter: 1 },
        { ...mockNote, id: '4', book: 'ROM', startChapter: 1, endChapter: 3 }, // spans multiple chapters
      ];
      (notesService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(multipleNotes);

      function ChapterTestConsumer() {
        const { getNotesForChapter, loading } = useNotes();
        const chapter1Notes = getNotesForChapter('ROM', 1);
        const chapter2Notes = getNotesForChapter('ROM', 2);
        const genNotes = getNotesForChapter('GEN', 1);

        return (
          <div>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="rom-ch1-count">{chapter1Notes.length}</span>
            <span data-testid="rom-ch2-count">{chapter2Notes.length}</span>
            <span data-testid="gen-ch1-count">{genNotes.length}</span>
          </div>
        );
      }

      render(
        <NotesProvider>
          <ChapterTestConsumer />
        </NotesProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      // ROM chapter 1: note 1 and note 4 (which spans 1-3)
      expect(screen.getByTestId('rom-ch1-count').textContent).toBe('2');
      // ROM chapter 2: note 2 and note 4 (which spans 1-3)
      expect(screen.getByTestId('rom-ch2-count').textContent).toBe('2');
      // GEN chapter 1: note 3
      expect(screen.getByTestId('gen-ch1-count').textContent).toBe('1');
    });
  });

  describe('useNotes hook', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useNotes must be used within a NotesProvider');

      consoleSpy.mockRestore();
    });
  });
});
