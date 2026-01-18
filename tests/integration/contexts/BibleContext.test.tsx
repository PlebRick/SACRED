import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import React from 'react';
import { BibleProvider, useBible } from '../../../src/context/BibleContext';

// Test component that displays state and provides action triggers
function TestConsumer() {
  const context = useBible();
  return (
    <div>
      <span data-testid="book-id">{context.bookId}</span>
      <span data-testid="chapter">{context.chapter}</span>
      <span data-testid="loading">{String(context.loading)}</span>
      <span data-testid="error">{context.error || 'none'}</span>
      <span data-testid="reference">{context.reference || 'none'}</span>
      <span data-testid="verses-count">{context.verses.length}</span>
      <button data-testid="navigate-rom-1" onClick={() => context.navigate('ROM', 1)}>
        Go to Romans 1
      </button>
      <button data-testid="navigate-gen-50" onClick={() => context.navigate('GEN', 50)}>
        Go to Genesis 50
      </button>
      <button data-testid="navigate-rev-22" onClick={() => context.navigate('REV', 22)}>
        Go to Revelation 22
      </button>
      <button data-testid="go-next" onClick={context.goNext}>
        Next Chapter
      </button>
      <button data-testid="go-prev" onClick={context.goPrev}>
        Previous Chapter
      </button>
      <button
        data-testid="set-verses"
        onClick={() =>
          context.setVerses(
            [{ verse: 1, text: 'Test verse' }],
            'Romans 1'
          )
        }
      >
        Set Verses
      </button>
      <button data-testid="set-error" onClick={() => context.setError('Test error')}>
        Set Error
      </button>
    </div>
  );
}

describe('BibleContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Cleanup after each test
    cleanup();
    localStorage.clear();
  });

  describe('initial state', () => {
    it('starts with default location (John 1)', () => {
      render(
        <BibleProvider>
          <TestConsumer />
        </BibleProvider>
      );

      expect(screen.getByTestId('book-id').textContent).toBe('JHN');
      expect(screen.getByTestId('chapter').textContent).toBe('1');
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('error').textContent).toBe('none');
    });

    it('restores location from localStorage', () => {
      localStorage.setItem(
        'sacred_bible_location',
        JSON.stringify({ bookId: 'ROM', chapter: 8 })
      );

      render(
        <BibleProvider>
          <TestConsumer />
        </BibleProvider>
      );

      expect(screen.getByTestId('book-id').textContent).toBe('ROM');
      expect(screen.getByTestId('chapter').textContent).toBe('8');
    });

    it('handles invalid localStorage data gracefully', () => {
      localStorage.setItem('sacred_bible_location', 'invalid json');

      render(
        <BibleProvider>
          <TestConsumer />
        </BibleProvider>
      );

      // Falls back to default
      expect(screen.getByTestId('book-id').textContent).toBe('JHN');
      expect(screen.getByTestId('chapter').textContent).toBe('1');
    });
  });

  describe('navigate', () => {
    it('updates state when navigating', () => {
      render(
        <BibleProvider>
          <TestConsumer />
        </BibleProvider>
      );

      act(() => {
        screen.getByTestId('navigate-rom-1').click();
      });

      expect(screen.getByTestId('book-id').textContent).toBe('ROM');
      expect(screen.getByTestId('chapter').textContent).toBe('1');
      expect(screen.getByTestId('loading').textContent).toBe('true');
    });

    it('persists location to localStorage', () => {
      render(
        <BibleProvider>
          <TestConsumer />
        </BibleProvider>
      );

      act(() => {
        screen.getByTestId('navigate-rom-1').click();
      });

      const stored = JSON.parse(localStorage.getItem('sacred_bible_location') || '{}');
      expect(stored.bookId).toBe('ROM');
      expect(stored.chapter).toBe(1);
    });

    it('skips navigation to current location', () => {
      render(
        <BibleProvider>
          <TestConsumer />
        </BibleProvider>
      );

      // First navigate to JHN 1 (which is already the default)
      act(() => {
        screen.getByTestId('navigate-rom-1').click();
      });

      // Set verses to clear loading state
      act(() => {
        screen.getByTestId('set-verses').click();
      });

      expect(screen.getByTestId('loading').textContent).toBe('false');

      // Try to navigate to same location
      act(() => {
        screen.getByTestId('navigate-rom-1').click();
      });

      // Should not trigger loading since we're already there
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  describe('goNext', () => {
    it('navigates to next chapter within same book', () => {
      render(
        <BibleProvider>
          <TestConsumer />
        </BibleProvider>
      );

      // Default is JHN 1, go to next
      act(() => {
        screen.getByTestId('go-next').click();
      });

      expect(screen.getByTestId('book-id').textContent).toBe('JHN');
      expect(screen.getByTestId('chapter').textContent).toBe('2');
    });

    it('navigates to first chapter of next book at end of book', () => {
      render(
        <BibleProvider>
          <TestConsumer />
        </BibleProvider>
      );

      // Navigate to Genesis 50 (last chapter)
      act(() => {
        screen.getByTestId('navigate-gen-50').click();
      });

      expect(screen.getByTestId('book-id').textContent).toBe('GEN');
      expect(screen.getByTestId('chapter').textContent).toBe('50');

      // Go to next - should be Exodus 1
      act(() => {
        screen.getByTestId('go-next').click();
      });

      expect(screen.getByTestId('book-id').textContent).toBe('EXO');
      expect(screen.getByTestId('chapter').textContent).toBe('1');
    });

    it('does nothing at end of Bible (Revelation 22)', () => {
      render(
        <BibleProvider>
          <TestConsumer />
        </BibleProvider>
      );

      // Navigate to Revelation 22
      act(() => {
        screen.getByTestId('navigate-rev-22').click();
      });

      expect(screen.getByTestId('book-id').textContent).toBe('REV');
      expect(screen.getByTestId('chapter').textContent).toBe('22');

      // Try to go next - should stay at Rev 22
      act(() => {
        screen.getByTestId('go-next').click();
      });

      expect(screen.getByTestId('book-id').textContent).toBe('REV');
      expect(screen.getByTestId('chapter').textContent).toBe('22');
    });
  });

  describe('goPrev', () => {
    it('navigates to previous chapter within same book', () => {
      render(
        <BibleProvider>
          <TestConsumer />
        </BibleProvider>
      );

      // Navigate to ROM 5
      act(() => {
        screen.getByTestId('navigate-rom-1').click();
      });

      act(() => {
        screen.getByTestId('go-next').click();
      });

      // Now at ROM 2, go prev
      act(() => {
        screen.getByTestId('go-prev').click();
      });

      expect(screen.getByTestId('book-id').textContent).toBe('ROM');
      expect(screen.getByTestId('chapter').textContent).toBe('1');
    });

    it('does nothing at start of Bible (Genesis 1)', () => {
      localStorage.setItem(
        'sacred_bible_location',
        JSON.stringify({ bookId: 'GEN', chapter: 1 })
      );

      render(
        <BibleProvider>
          <TestConsumer />
        </BibleProvider>
      );

      expect(screen.getByTestId('book-id').textContent).toBe('GEN');
      expect(screen.getByTestId('chapter').textContent).toBe('1');

      // Try to go prev - should stay at Gen 1
      act(() => {
        screen.getByTestId('go-prev').click();
      });

      expect(screen.getByTestId('book-id').textContent).toBe('GEN');
      expect(screen.getByTestId('chapter').textContent).toBe('1');
    });
  });

  describe('setVerses', () => {
    it('sets verses and reference, clears loading', () => {
      render(
        <BibleProvider>
          <TestConsumer />
        </BibleProvider>
      );

      // Navigate to trigger loading
      act(() => {
        screen.getByTestId('navigate-rom-1').click();
      });

      expect(screen.getByTestId('loading').textContent).toBe('true');

      // Set verses
      act(() => {
        screen.getByTestId('set-verses').click();
      });

      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('verses-count').textContent).toBe('1');
      expect(screen.getByTestId('reference').textContent).toBe('Romans 1');
    });
  });

  describe('setError', () => {
    it('sets error and clears loading', () => {
      render(
        <BibleProvider>
          <TestConsumer />
        </BibleProvider>
      );

      // Navigate to trigger loading
      act(() => {
        screen.getByTestId('navigate-rom-1').click();
      });

      expect(screen.getByTestId('loading').textContent).toBe('true');

      // Set error
      act(() => {
        screen.getByTestId('set-error').click();
      });

      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('error').textContent).toBe('Test error');
    });
  });

  describe('useBible hook', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useBible must be used within a BibleProvider');

      consoleSpy.mockRestore();
    });
  });
});
