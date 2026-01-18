import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    // Store callback for potential use in tests
  }
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

// Mock the Verse component
vi.mock('../../../src/components/Bible/Verse', () => ({
  Verse: React.forwardRef(({ number, text, isHighlighted, isFirstInRange, isLastInRange, onClick }: {
    number: number;
    text: string;
    isHighlighted: boolean;
    isFirstInRange: boolean;
    isLastInRange: boolean;
    onClick: () => void;
  }, ref: React.Ref<HTMLSpanElement>) => (
    <span
      ref={ref}
      data-testid={`verse-${number}`}
      data-verse={number}
      data-highlighted={isHighlighted}
      data-first={isFirstInRange}
      data-last={isLastInRange}
      onClick={onClick}
    >
      <sup>{number}</sup>
      <span>{text}</span>
    </span>
  )),
  default: React.forwardRef(({ number, text, isHighlighted, isFirstInRange, isLastInRange, onClick }: {
    number: number;
    text: string;
    isHighlighted: boolean;
    isFirstInRange: boolean;
    isLastInRange: boolean;
    onClick: () => void;
  }, ref: React.Ref<HTMLSpanElement>) => (
    <span
      ref={ref}
      data-testid={`verse-${number}`}
      data-verse={number}
      data-highlighted={isHighlighted}
      data-first={isFirstInRange}
      data-last={isLastInRange}
      onClick={onClick}
    >
      <sup>{number}</sup>
      <span>{text}</span>
    </span>
  )),
}));

// Mock contexts
const mockBibleContext = {
  bookId: 'ROM',
  chapter: 8,
  verses: [
    { verse: 1, text: 'There is therefore now no condemnation...' },
    { verse: 2, text: 'For the law of the Spirit of life...' },
    { verse: 28, text: 'And we know that in all things God works for the good...' },
  ],
  reference: 'Romans 8',
  loading: false,
  error: null as string | null,
  goNext: vi.fn(),
  goPrev: vi.fn(),
};

const mockNotesContext = {
  getNotesForChapter: vi.fn().mockReturnValue([]),
  setSelectedNote: vi.fn(),
  setEditingNote: vi.fn(),
};

vi.mock('../../../src/context/BibleContext', () => ({
  useBible: () => mockBibleContext,
}));

vi.mock('../../../src/context/NotesContext', () => ({
  useNotes: () => mockNotesContext,
}));

vi.mock('../../../src/utils/bibleBooks', () => ({
  getBookById: (id: string) => {
    const books: Record<string, { id: string; name: string }> = {
      'ROM': { id: 'ROM', name: 'Romans' },
      'GEN': { id: 'GEN', name: 'Genesis' },
      'JHN': { id: 'JHN', name: 'John' },
    };
    return books[id] || null;
  },
}));

vi.mock('../../../src/utils/verseRange', () => ({
  isVerseInRange: (chapter: number, verse: number, note: { startChapter: number; startVerse: number; endChapter: number; endVerse: number }) => {
    if (note.startChapter === note.endChapter) {
      return chapter === note.startChapter && verse >= note.startVerse && verse <= note.endVerse;
    }
    return false;
  },
}));

import ChapterView from '../../../src/components/Bible/ChapterView';

describe('ChapterView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBibleContext.loading = false;
    mockBibleContext.error = null;
    mockBibleContext.verses = [
      { verse: 1, text: 'There is therefore now no condemnation...' },
      { verse: 2, text: 'For the law of the Spirit of life...' },
      { verse: 28, text: 'And we know that in all things God works for the good...' },
    ];
    mockBibleContext.reference = 'Romans 8';
    mockNotesContext.getNotesForChapter.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders chapter title from reference', () => {
      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      expect(screen.getByText('Romans 8')).toBeInTheDocument();
    });

    it('renders fallback title when reference is empty', () => {
      mockBibleContext.reference = '';

      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      expect(screen.getByText('Romans 8')).toBeInTheDocument();
    });

    it('renders all verses', () => {
      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      expect(screen.getByTestId('verse-1')).toBeInTheDocument();
      expect(screen.getByTestId('verse-2')).toBeInTheDocument();
      expect(screen.getByTestId('verse-28')).toBeInTheDocument();
    });

    it('renders navigation buttons', () => {
      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner when loading', () => {
      mockBibleContext.loading = true;

      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      expect(screen.getByText(/Loading Romans 8/)).toBeInTheDocument();
    });

    it('does not render verses when loading', () => {
      mockBibleContext.loading = true;

      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      expect(screen.queryByTestId('verse-1')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error occurs', () => {
      mockBibleContext.error = 'Failed to fetch chapter';

      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      expect(screen.getByText('Failed to load chapter')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch chapter')).toBeInTheDocument();
    });

    it('does not render verses when error', () => {
      mockBibleContext.error = 'Network error';

      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      expect(screen.queryByTestId('verse-1')).not.toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('calls goPrev when Previous button is clicked', () => {
      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      fireEvent.click(screen.getByText('Previous'));

      expect(mockBibleContext.goPrev).toHaveBeenCalledTimes(1);
    });

    it('calls goNext when Next button is clicked', () => {
      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      fireEvent.click(screen.getByText('Next'));

      expect(mockBibleContext.goNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('verse highlighting', () => {
    it('highlights verses that are in note range', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue([
        {
          id: 'note-1',
          book: 'ROM',
          startChapter: 8,
          startVerse: 1,
          endChapter: 8,
          endVerse: 2,
          title: 'Test Note',
          content: '',
          type: 'note',
        },
      ]);

      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      const verse1 = screen.getByTestId('verse-1');
      const verse2 = screen.getByTestId('verse-2');
      const verse28 = screen.getByTestId('verse-28');

      expect(verse1.getAttribute('data-highlighted')).toBe('true');
      expect(verse2.getAttribute('data-highlighted')).toBe('true');
      expect(verse28.getAttribute('data-highlighted')).toBe('false');
    });

    it('marks first verse in range', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue([
        {
          id: 'note-1',
          book: 'ROM',
          startChapter: 8,
          startVerse: 1,
          endChapter: 8,
          endVerse: 2,
          title: 'Test Note',
          content: '',
          type: 'note',
        },
      ]);

      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      const verse1 = screen.getByTestId('verse-1');
      expect(verse1.getAttribute('data-first')).toBe('true');
    });

    it('marks last verse in range', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue([
        {
          id: 'note-1',
          book: 'ROM',
          startChapter: 8,
          startVerse: 1,
          endChapter: 8,
          endVerse: 2,
          title: 'Test Note',
          content: '',
          type: 'note',
        },
      ]);

      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      const verse2 = screen.getByTestId('verse-2');
      expect(verse2.getAttribute('data-last')).toBe('true');
    });
  });

  describe('verse click handling', () => {
    it('opens note editor when highlighted verse is clicked', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue([
        {
          id: 'note-1',
          book: 'ROM',
          startChapter: 8,
          startVerse: 1,
          endChapter: 8,
          endVerse: 2,
          title: 'Test Note',
          content: '',
          type: 'note',
        },
      ]);

      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      const verse1 = screen.getByTestId('verse-1');
      fireEvent.click(verse1);

      expect(mockNotesContext.setSelectedNote).toHaveBeenCalledWith('note-1');
      expect(mockNotesContext.setEditingNote).toHaveBeenCalledWith('note-1');
    });

    it('does not call setSelectedNote for non-highlighted verse', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue([]);

      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      const verse1 = screen.getByTestId('verse-1');
      fireEvent.click(verse1);

      expect(mockNotesContext.setSelectedNote).not.toHaveBeenCalled();
      expect(mockNotesContext.setEditingNote).not.toHaveBeenCalled();
    });
  });

  describe('empty verses', () => {
    it('renders empty container when no verses', () => {
      mockBibleContext.verses = [];

      const { container } = render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      expect(screen.queryByTestId('verse-1')).not.toBeInTheDocument();
      // Navigation should still be present
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });
  });

  describe('IntersectionObserver', () => {
    it('sets up IntersectionObserver for visible verse tracking', () => {
      render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      // Should observe all verse elements
      expect(mockObserve).toHaveBeenCalled();
    });

    it('disconnects IntersectionObserver on unmount', () => {
      const { unmount } = render(<ChapterView onVisibleVerseChange={vi.fn()} />);

      unmount();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
