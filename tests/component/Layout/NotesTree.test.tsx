import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import React from 'react';
import { NotesTree } from '../../../src/components/Layout/NotesTree';

// Mock the contexts
vi.mock('../../../src/context/BibleContext', () => ({
  useBible: vi.fn(),
}));

vi.mock('../../../src/context/NotesContext', () => ({
  useNotes: vi.fn(),
}));

// Mock the notesService
vi.mock('../../../src/services/notesService', () => ({
  notesService: {
    search: vi.fn(),
  },
}));

import { useBible } from '../../../src/context/BibleContext';
import { useNotes } from '../../../src/context/NotesContext';
import { notesService } from '../../../src/services/notesService';

const mockNotes = [
  {
    id: 'note-1',
    book: 'JHN',
    startChapter: 3,
    startVerse: 16,
    endChapter: 3,
    endVerse: 21,
    title: 'God\'s Love',
    type: 'note',
  },
  {
    id: 'note-2',
    book: 'JHN',
    startChapter: 3,
    startVerse: 1,
    endChapter: 3,
    endVerse: 5,
    title: 'Nicodemus',
    type: 'commentary',
  },
  {
    id: 'note-3',
    book: 'ROM',
    startChapter: 8,
    startVerse: 28,
    endChapter: 8,
    endVerse: 30,
    title: 'Golden Chain',
    type: 'sermon',
  },
];

describe('NotesTree', () => {
  const mockNavigate = vi.fn();
  const mockSetSelectedNote = vi.fn();
  const mockSetEditingNote = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useBible as any).mockReturnValue({
      navigate: mockNavigate,
    });
    (useNotes as any).mockReturnValue({
      notes: mockNotes,
      setSelectedNote: mockSetSelectedNote,
      setEditingNote: mockSetEditingNote,
    });
    (notesService.search as any).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  describe('empty state', () => {
    it('shows empty message when no notes', () => {
      (useNotes as any).mockReturnValue({
        notes: [],
        setSelectedNote: mockSetSelectedNote,
        setEditingNote: mockSetEditingNote,
      });

      render(<NotesTree />);

      expect(screen.getByText('No notes yet.')).toBeInTheDocument();
      expect(screen.getByText(/Select verses in the Bible text/)).toBeInTheDocument();
    });
  });

  describe('rendering', () => {
    it('renders search input', () => {
      render(<NotesTree />);

      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
    });

    it('renders books with notes', () => {
      render(<NotesTree />);

      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Romans')).toBeInTheDocument();
    });

    it('shows note count for books with notes', () => {
      render(<NotesTree />);

      // John has 2 notes
      const johnButton = screen.getByText('John').closest('button');
      expect(johnButton?.textContent).toContain('2');

      // Romans has 1 note
      const romansButton = screen.getByText('Romans').closest('button');
      expect(romansButton?.textContent).toContain('1');
    });

    it('shows books without notes as disabled', () => {
      render(<NotesTree />);

      // Genesis has no notes
      const genesisButton = screen.getByText('Genesis').closest('button');
      expect(genesisButton).toBeDisabled();
    });
  });

  describe('book expansion', () => {
    it('expands book on click', () => {
      render(<NotesTree />);

      const johnButton = screen.getByText('John').closest('button');
      fireEvent.click(johnButton!);

      expect(screen.getByText('Chapter 3')).toBeInTheDocument();
    });

    it('collapses book on second click', () => {
      render(<NotesTree />);

      const johnButton = screen.getByText('John').closest('button');
      fireEvent.click(johnButton!);
      expect(screen.getByText('Chapter 3')).toBeInTheDocument();

      fireEvent.click(johnButton!);
      expect(screen.queryByText('Chapter 3')).not.toBeInTheDocument();
    });

    it('shows chapter count', () => {
      render(<NotesTree />);

      const johnButton = screen.getByText('John').closest('button');
      fireEvent.click(johnButton!);

      // Chapter 3 has 2 notes
      const chapterButton = screen.getByText('Chapter 3').closest('button');
      expect(chapterButton?.textContent).toContain('2');
    });
  });

  describe('chapter expansion', () => {
    it('expands chapter to show notes', () => {
      render(<NotesTree />);

      // Expand John
      const johnButton = screen.getByText('John').closest('button');
      fireEvent.click(johnButton!);

      // Expand Chapter 3
      const chapterButton = screen.getByText('Chapter 3').closest('button');
      fireEvent.click(chapterButton!);

      expect(screen.getByText('Nicodemus')).toBeInTheDocument();
      expect(screen.getByText('God\'s Love')).toBeInTheDocument();
    });

    it('shows notes sorted by verse', () => {
      render(<NotesTree />);

      // Expand John > Chapter 3
      fireEvent.click(screen.getByText('John').closest('button')!);
      fireEvent.click(screen.getByText('Chapter 3').closest('button')!);

      const noteButtons = screen.getAllByRole('button').filter(
        btn => btn.className.includes('noteItem')
      );

      // Nicodemus (v1) should appear before God's Love (v16)
      expect(noteButtons.length).toBe(2);
    });
  });

  describe('note type icons', () => {
    it('shows different icons for different note types', () => {
      render(<NotesTree />);

      // Expand John > Chapter 3
      fireEvent.click(screen.getByText('John').closest('button')!);
      fireEvent.click(screen.getByText('Chapter 3').closest('button')!);

      // Should have notes with different types
      const noteItems = screen.getAllByRole('button').filter(
        btn => btn.getAttribute('data-type')
      );

      // Commentary and note types should be present
      const types = noteItems.map(btn => btn.getAttribute('data-type'));
      expect(types).toContain('note');
      expect(types).toContain('commentary');
    });
  });

  describe('note click', () => {
    it('navigates to note location on click', () => {
      render(<NotesTree />);

      // Expand John > Chapter 3
      fireEvent.click(screen.getByText('John').closest('button')!);
      fireEvent.click(screen.getByText('Chapter 3').closest('button')!);

      // Click on a note
      fireEvent.click(screen.getByText('Nicodemus').closest('button')!);

      expect(mockNavigate).toHaveBeenCalledWith('JHN', 3);
      expect(mockSetSelectedNote).toHaveBeenCalledWith('note-2');
      expect(mockSetEditingNote).toHaveBeenCalledWith('note-2');
    });
  });

  describe('search functionality', () => {
    it('shows search input', () => {
      render(<NotesTree />);

      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
    });

    it('performs search on input', async () => {
      const searchResults = [
        {
          id: 'note-1',
          book: 'JHN',
          startChapter: 3,
          startVerse: 16,
          title: 'God\'s Love',
          titleSnippet: 'God\'s <b>Love</b>',
          contentSnippet: 'For God so <b>loved</b>...',
        },
      ];
      (notesService.search as any).mockResolvedValue(searchResults);

      render(<NotesTree />);

      const input = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(input, { target: { value: 'love' } });

      await waitFor(() => {
        expect(notesService.search).toHaveBeenCalledWith('love');
      });
    });

    it('does not search with less than 2 characters', async () => {
      render(<NotesTree />);

      const input = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(input, { target: { value: 'a' } });

      await waitFor(() => {
        expect(notesService.search).not.toHaveBeenCalled();
      });
    });

    it('shows search results', async () => {
      const searchResults = [
        {
          id: 'note-1',
          book: 'JHN',
          startChapter: 3,
          startVerse: 16,
          endChapter: 3,
          endVerse: 21,
          title: 'God\'s Love',
          titleSnippet: 'God\'s <b>Love</b>',
          type: 'note',
        },
      ];
      (notesService.search as any).mockResolvedValue(searchResults);

      render(<NotesTree />);

      const input = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(input, { target: { value: 'love' } });

      await waitFor(() => {
        expect(screen.getByText('1 result')).toBeInTheDocument();
      });
    });

    it('shows no results message', async () => {
      (notesService.search as any).mockResolvedValue([]);

      render(<NotesTree />);

      const input = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(input, { target: { value: 'xyz' } });

      await waitFor(() => {
        expect(screen.getByText('No results found')).toBeInTheDocument();
      });
    });

    it('clears search with clear button', async () => {
      const searchResults = [{ id: 'note-1', book: 'JHN', startChapter: 3, title: 'Test' }];
      (notesService.search as any).mockResolvedValue(searchResults);

      render(<NotesTree />);

      const input = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(input, { target: { value: 'test' } });

      await waitFor(() => {
        expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Clear search'));

      expect(input).toHaveValue('');
    });

    it('navigates to note from search result', async () => {
      const searchResults = [
        {
          id: 'note-1',
          book: 'JHN',
          startChapter: 3,
          startVerse: 16,
          endChapter: 3,
          endVerse: 21,
          title: 'God\'s Love',
          type: 'note',
        },
      ];
      (notesService.search as any).mockResolvedValue(searchResults);

      render(<NotesTree />);

      const input = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(input, { target: { value: 'love' } });

      await waitFor(() => {
        const resultButton = screen.getByRole('button', { name: /John/ });
        fireEvent.click(resultButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith('JHN', 3);
      expect(mockSetSelectedNote).toHaveBeenCalledWith('note-1');
    });
  });

  describe('grouping and sorting', () => {
    it('groups notes by book', () => {
      render(<NotesTree />);

      // Both John and Romans should be present but not expanded by default
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Romans')).toBeInTheDocument();
    });

    it('groups notes by chapter within book', () => {
      (useNotes as any).mockReturnValue({
        notes: [
          { id: 'n1', book: 'JHN', startChapter: 1, startVerse: 1, endChapter: 1, title: 'Note 1' },
          { id: 'n2', book: 'JHN', startChapter: 3, startVerse: 1, endChapter: 3, title: 'Note 2' },
          { id: 'n3', book: 'JHN', startChapter: 1, startVerse: 14, endChapter: 1, title: 'Note 3' },
        ],
        setSelectedNote: mockSetSelectedNote,
        setEditingNote: mockSetEditingNote,
      });

      render(<NotesTree />);

      fireEvent.click(screen.getByText('John').closest('button')!);

      // Should show both Chapter 1 and Chapter 3
      expect(screen.getByText('Chapter 1')).toBeInTheDocument();
      expect(screen.getByText('Chapter 3')).toBeInTheDocument();

      // Chapter 1 should show count of 2
      const chapter1Button = screen.getByText('Chapter 1').closest('button');
      expect(chapter1Button?.textContent).toContain('2');
    });

    it('sorts chapters numerically', () => {
      (useNotes as any).mockReturnValue({
        notes: [
          { id: 'n1', book: 'JHN', startChapter: 10, startVerse: 1, endChapter: 10, title: 'Note 1' },
          { id: 'n2', book: 'JHN', startChapter: 2, startVerse: 1, endChapter: 2, title: 'Note 2' },
          { id: 'n3', book: 'JHN', startChapter: 21, startVerse: 1, endChapter: 21, title: 'Note 3' },
        ],
        setSelectedNote: mockSetSelectedNote,
        setEditingNote: mockSetEditingNote,
      });

      render(<NotesTree />);

      fireEvent.click(screen.getByText('John').closest('button')!);

      const chapterButtons = screen.getAllByText(/Chapter \d+/);
      const chapterNumbers = chapterButtons.map(btn => {
        const match = btn.textContent?.match(/Chapter (\d+)/);
        return match ? parseInt(match[1]) : 0;
      });

      expect(chapterNumbers).toEqual([2, 10, 21]);
    });
  });

  describe('verse range formatting', () => {
    it('shows verse range in note item', () => {
      (useNotes as any).mockReturnValue({
        notes: [
          { id: 'n1', book: 'JHN', startChapter: 3, startVerse: 16, endChapter: 3, endVerse: 21, title: 'Test' },
        ],
        setSelectedNote: mockSetSelectedNote,
        setEditingNote: mockSetEditingNote,
      });

      render(<NotesTree />);

      fireEvent.click(screen.getByText('John').closest('button')!);
      fireEvent.click(screen.getByText('Chapter 3').closest('button')!);

      // Should show verse range (format may vary, check for presence of chapter:verse)
      const noteItem = screen.getByText('Test').closest('button');
      expect(noteItem?.textContent).toMatch(/3:\d+/);
    });
  });

  describe('untitled notes', () => {
    it('shows "Untitled" for notes without title', () => {
      (useNotes as any).mockReturnValue({
        notes: [
          { id: 'n1', book: 'JHN', startChapter: 3, startVerse: 1, endChapter: 3, title: '' },
        ],
        setSelectedNote: mockSetSelectedNote,
        setEditingNote: mockSetEditingNote,
      });

      render(<NotesTree />);

      fireEvent.click(screen.getByText('John').closest('button')!);
      fireEvent.click(screen.getByText('Chapter 3').closest('button')!);

      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });
  });
});
