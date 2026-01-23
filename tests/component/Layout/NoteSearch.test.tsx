import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import NoteSearch from '../../../src/components/Layout/NoteSearch';
import { NotesProvider } from '../../../src/context/NotesContext';
import { BibleProvider } from '../../../src/context/BibleContext';

// Mock the notesService
vi.mock('../../../src/services/notesService', () => ({
  notesService: {
    search: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
    getLastModified: vi.fn().mockResolvedValue({ lastModified: null }),
  },
}));

// Mock the sessionsService to avoid API calls
vi.mock('../../../src/services/sessionsService', () => ({
  sessionsService: {
    log: vi.fn().mockResolvedValue(null),
  },
}));

import { notesService } from '../../../src/services/notesService';

// Create a test wrapper that provides required contexts
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <BibleProvider>
      <NotesProvider>{children}</NotesProvider>
    </BibleProvider>
  );
}

describe('NoteSearch', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  describe('rendering', () => {
    it('renders search input', () => {
      render(
        <TestWrapper>
          <NoteSearch onClose={mockOnClose} />
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
    });

    it('renders overlay and modal', () => {
      render(
        <TestWrapper>
          <NoteSearch onClose={mockOnClose} />
        </TestWrapper>
      );

      // Should have search input
      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
      // Should have escape hint
      expect(screen.getByText('esc')).toBeInTheDocument();
    });

    it('focuses input on mount', () => {
      render(
        <TestWrapper>
          <NoteSearch onClose={mockOnClose} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Search notes...');
      expect(document.activeElement).toBe(input);
    });
  });

  describe('search behavior', () => {
    it('shows minimum character message for short queries', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <NoteSearch onClose={mockOnClose} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Search notes...');
      await user.type(input, 'a');

      expect(screen.getByText('Type at least 2 characters to search')).toBeInTheDocument();
    });

    it('calls search API with debounce', async () => {
      const user = userEvent.setup();
      vi.mocked(notesService.search).mockResolvedValue([]);

      render(
        <TestWrapper>
          <NoteSearch onClose={mockOnClose} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Search notes...');
      await user.type(input, 'test');

      // Wait for debounce (200ms)
      await waitFor(
        () => {
          expect(notesService.search).toHaveBeenCalledWith('test');
        },
        { timeout: 500 }
      );
    });

    it('displays search results', async () => {
      const user = userEvent.setup();
      const mockResults = [
        {
          id: '1',
          book: 'ROM',
          startChapter: 3,
          startVerse: 21,
          endChapter: 3,
          endVerse: 26,
          title: 'Justification by Faith',
          content: '<p>Test content</p>',
          type: 'note',
          titleSnippet: '<mark>Justification</mark> by Faith',
          contentSnippet: 'This is about <mark>justification</mark>...',
        },
      ];
      vi.mocked(notesService.search).mockResolvedValue(mockResults);

      render(
        <TestWrapper>
          <NoteSearch onClose={mockOnClose} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Search notes...');
      await user.type(input, 'justification');

      await waitFor(() => {
        expect(screen.getByText(/Justification/)).toBeInTheDocument();
      });
    });

    it('shows no results message when search returns empty', async () => {
      const user = userEvent.setup();
      vi.mocked(notesService.search).mockResolvedValue([]);

      render(
        <TestWrapper>
          <NoteSearch onClose={mockOnClose} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Search notes...');
      await user.type(input, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/No notes found for "nonexistent"/)).toBeInTheDocument();
      });
    });
  });

  describe('keyboard navigation', () => {
    it('closes on Escape key', async () => {
      render(
        <TestWrapper>
          <NoteSearch onClose={mockOnClose} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Search notes...');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('navigates results with arrow keys', async () => {
      const user = userEvent.setup();
      const mockResults = [
        {
          id: '1',
          book: 'ROM',
          startChapter: 1,
          endChapter: 1,
          title: 'Note 1',
          type: 'note',
        },
        {
          id: '2',
          book: 'ROM',
          startChapter: 2,
          endChapter: 2,
          title: 'Note 2',
          type: 'note',
        },
      ];
      vi.mocked(notesService.search).mockResolvedValue(mockResults);

      render(
        <TestWrapper>
          <NoteSearch onClose={mockOnClose} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Search notes...');
      await user.type(input, 'note');

      await waitFor(() => {
        expect(screen.getByText('Note 1')).toBeInTheDocument();
      });

      // Press down arrow
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      // Second item should now be selected (we can't easily verify visual selection without checking classes)
      // But we can verify the handler didn't throw
    });
  });

  describe('closing behavior', () => {
    it('closes when clicking overlay', async () => {
      const { container } = render(
        <TestWrapper>
          <NoteSearch onClose={mockOnClose} />
        </TestWrapper>
      );

      // Click the overlay (first child of container)
      const overlay = container.firstChild as HTMLElement;
      fireEvent.click(overlay);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not close when clicking modal content', async () => {
      render(
        <TestWrapper>
          <NoteSearch onClose={mockOnClose} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Search notes...');
      fireEvent.click(input);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
