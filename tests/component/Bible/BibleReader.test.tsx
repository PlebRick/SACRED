import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';

// Mock ChapterView
vi.mock('../../../src/components/Bible/ChapterView', () => ({
  ChapterView: ({ onVisibleVerseChange }: { onVisibleVerseChange?: (verse: number) => void }) => (
    <div data-testid="chapter-view">
      ChapterView Component
      <button onClick={() => onVisibleVerseChange?.(5)} data-testid="trigger-visible-verse">
        Trigger
      </button>
    </div>
  ),
  default: ({ onVisibleVerseChange }: { onVisibleVerseChange?: (verse: number) => void }) => (
    <div data-testid="chapter-view">
      ChapterView Component
      <button onClick={() => onVisibleVerseChange?.(5)} data-testid="trigger-visible-verse">
        Trigger
      </button>
    </div>
  ),
}));

// Mock bibleApi
const mockFetchChapter = vi.fn();
const mockPrefetchChapter = vi.fn();

vi.mock('../../../src/services/bibleApi', () => ({
  fetchChapter: (...args: unknown[]) => mockFetchChapter(...args),
  prefetchChapter: (...args: unknown[]) => mockPrefetchChapter(...args),
}));

// Mock bibleBooks
vi.mock('../../../src/utils/bibleBooks', () => ({
  getNextChapter: (bookId: string, chapter: number) => {
    if (bookId === 'REV' && chapter === 22) return null;
    return { bookId, chapter: chapter + 1 };
  },
  getPrevChapter: (bookId: string, chapter: number) => {
    if (bookId === 'GEN' && chapter === 1) return null;
    return { bookId, chapter: chapter - 1 };
  },
}));

// Mock BibleContext
const mockSetVerses = vi.fn();
const mockSetError = vi.fn();

const mockBibleContext = {
  bookId: 'ROM',
  chapter: 8,
  setVerses: mockSetVerses,
  setError: mockSetError,
  loading: false,
};

vi.mock('../../../src/context/BibleContext', () => ({
  useBible: () => mockBibleContext,
}));

import BibleReader from '../../../src/components/Bible/BibleReader';

describe('BibleReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBibleContext.bookId = 'ROM';
    mockBibleContext.chapter = 8;
    mockFetchChapter.mockResolvedValue({
      verses: [
        { verse: 1, text: 'Test verse 1' },
        { verse: 2, text: 'Test verse 2' },
      ],
      reference: 'Romans 8',
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders ChapterView component', () => {
      render(<BibleReader onVisibleVerseChange={vi.fn()} />);

      expect(screen.getByTestId('chapter-view')).toBeInTheDocument();
    });

    it('passes onVisibleVerseChange to ChapterView', () => {
      const mockOnVisibleVerseChange = vi.fn();
      render(<BibleReader onVisibleVerseChange={mockOnVisibleVerseChange} />);

      // Trigger the callback via the mocked ChapterView
      screen.getByTestId('trigger-visible-verse').click();

      expect(mockOnVisibleVerseChange).toHaveBeenCalledWith(5);
    });
  });

  describe('chapter loading', () => {
    it('fetches chapter on mount', async () => {
      render(<BibleReader onVisibleVerseChange={vi.fn()} />);

      await waitFor(() => {
        expect(mockFetchChapter).toHaveBeenCalledWith('ROM', 8);
      });
    });

    it('sets verses after successful fetch', async () => {
      render(<BibleReader onVisibleVerseChange={vi.fn()} />);

      await waitFor(() => {
        expect(mockSetVerses).toHaveBeenCalledWith(
          [
            { verse: 1, text: 'Test verse 1' },
            { verse: 2, text: 'Test verse 2' },
          ],
          'Romans 8'
        );
      });
    });

    it('sets error on fetch failure', async () => {
      mockFetchChapter.mockRejectedValue(new Error('Network error'));

      render(<BibleReader onVisibleVerseChange={vi.fn()} />);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('Network error');
      });
    });

    it('refetches when bookId changes', async () => {
      const { rerender } = render(<BibleReader onVisibleVerseChange={vi.fn()} />);

      await waitFor(() => {
        expect(mockFetchChapter).toHaveBeenCalledWith('ROM', 8);
      });

      mockBibleContext.bookId = 'GEN';
      mockBibleContext.chapter = 1;

      rerender(<BibleReader onVisibleVerseChange={vi.fn()} />);

      await waitFor(() => {
        expect(mockFetchChapter).toHaveBeenCalledWith('GEN', 1);
      });
    });

    it('refetches when chapter changes', async () => {
      const { rerender } = render(<BibleReader onVisibleVerseChange={vi.fn()} />);

      await waitFor(() => {
        expect(mockFetchChapter).toHaveBeenCalledWith('ROM', 8);
      });

      mockBibleContext.chapter = 9;

      rerender(<BibleReader onVisibleVerseChange={vi.fn()} />);

      await waitFor(() => {
        expect(mockFetchChapter).toHaveBeenCalledWith('ROM', 9);
      });
    });
  });

  describe('prefetching', () => {
    it('prefetches next chapter', async () => {
      render(<BibleReader onVisibleVerseChange={vi.fn()} />);

      await waitFor(() => {
        expect(mockPrefetchChapter).toHaveBeenCalledWith('ROM', 9);
      });
    });

    it('prefetches previous chapter', async () => {
      render(<BibleReader onVisibleVerseChange={vi.fn()} />);

      await waitFor(() => {
        expect(mockPrefetchChapter).toHaveBeenCalledWith('ROM', 7);
      });
    });

    it('does not prefetch next when at end of Bible', async () => {
      mockBibleContext.bookId = 'REV';
      mockBibleContext.chapter = 22;

      render(<BibleReader onVisibleVerseChange={vi.fn()} />);

      await waitFor(() => {
        expect(mockFetchChapter).toHaveBeenCalled();
      });

      // Should only prefetch previous, not next
      expect(mockPrefetchChapter).toHaveBeenCalledTimes(1);
      expect(mockPrefetchChapter).toHaveBeenCalledWith('REV', 21);
    });

    it('does not prefetch previous when at start of Bible', async () => {
      mockBibleContext.bookId = 'GEN';
      mockBibleContext.chapter = 1;

      render(<BibleReader onVisibleVerseChange={vi.fn()} />);

      await waitFor(() => {
        expect(mockFetchChapter).toHaveBeenCalled();
      });

      // Should only prefetch next, not previous
      expect(mockPrefetchChapter).toHaveBeenCalledTimes(1);
      expect(mockPrefetchChapter).toHaveBeenCalledWith('GEN', 2);
    });
  });

  describe('cleanup', () => {
    it('cancels fetch on unmount', async () => {
      const { unmount } = render(<BibleReader onVisibleVerseChange={vi.fn()} />);

      // Unmount before fetch completes
      unmount();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // setVerses should have been called before unmount potentially,
      // but the cancelled flag should prevent state updates after unmount
      // This is hard to test directly, but we verify no errors are thrown
    });

    it('does not set state after unmount', async () => {
      // Create a delayed promise
      let resolvePromise: (value: unknown) => void;
      mockFetchChapter.mockImplementation(() => new Promise(resolve => {
        resolvePromise = resolve;
      }));

      const { unmount } = render(<BibleReader onVisibleVerseChange={vi.fn()} />);

      // Unmount immediately
      unmount();

      // Now resolve the promise
      resolvePromise!({
        verses: [{ verse: 1, text: 'Test' }],
        reference: 'Romans 8',
      });

      // Wait a tick
      await new Promise(resolve => setTimeout(resolve, 50));

      // setVerses should not have been called because component was unmounted
      // The cancelled flag should prevent it
      expect(mockSetVerses).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('does not set error after unmount', async () => {
      // Create a delayed promise that rejects
      let rejectPromise: (error: Error) => void;
      mockFetchChapter.mockImplementation(() => new Promise((_, reject) => {
        rejectPromise = reject;
      }));

      const { unmount } = render(<BibleReader onVisibleVerseChange={vi.fn()} />);

      // Unmount immediately
      unmount();

      // Now reject the promise
      rejectPromise!(new Error('Network error'));

      // Wait a tick
      await new Promise(resolve => setTimeout(resolve, 50));

      // setError should not have been called because component was unmounted
      expect(mockSetError).not.toHaveBeenCalled();
    });
  });
});
