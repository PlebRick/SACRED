import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { SystematicProvider, useSystematic } from '../../../src/context/SystematicContext';
import { BibleProvider } from '../../../src/context/BibleContext';

// Mock the services
vi.mock('../../../src/services/systematicService', () => ({
  systematicService: {
    getAll: vi.fn(),
    getTags: vi.fn(),
    getById: vi.fn(),
    getChapter: vi.fn(),
    getForPassage: vi.fn(),
    getAnnotations: vi.fn(),
    addAnnotation: vi.fn(),
    deleteAnnotation: vi.fn(),
    search: vi.fn(),
    getByTag: vi.fn(),
    getFlat: vi.fn(),
    getReferencingNotes: vi.fn(),
  },
}));

vi.mock('../../../src/services/sessionsService', () => ({
  sessionsService: {
    log: vi.fn(),
  },
}));

import { systematicService } from '../../../src/services/systematicService';
import { sessionsService } from '../../../src/services/sessionsService';

const mockTree = [
  {
    id: 'part-1',
    entryType: 'part',
    title: 'Part 1: Doctrine of God',
    children: [
      { id: 'ch-31', entryType: 'chapter', chapterNumber: 31, title: 'The Character of God', children: [] },
      { id: 'ch-32', entryType: 'chapter', chapterNumber: 32, title: 'The Trinity', children: [] },
    ],
  },
];

const mockTags = [
  { id: 'doctrine-god', name: 'Doctrine of God', color: '#4a90d9' },
  { id: 'christology', name: 'Christology', color: '#d9a44a' },
];

const mockEntry = {
  id: 'ch-32',
  entryType: 'chapter',
  chapterNumber: 32,
  title: 'The Trinity',
  content: '<p>Chapter content...</p>',
};

// Test component that exposes context state and actions
function TestConsumer() {
  const context = useSystematic();
  return (
    <div>
      <span data-testid="loading">{String(context.loading)}</span>
      <span data-testid="error">{context.error || 'none'}</span>
      <span data-testid="tree-count">{context.tree?.length ?? 0}</span>
      <span data-testid="is-panel-open">{String(context.isPanelOpen)}</span>
      <span data-testid="selected-entry-id">{context.selectedEntryId || 'none'}</span>
      <span data-testid="selected-entry-title">{context.selectedEntry?.title || 'none'}</span>
      <span data-testid="tags-count">{context.tags?.length ?? 0}</span>
      <span data-testid="related-doctrines-count">{context.relatedDoctrines?.length ?? 0}</span>
      <span data-testid="search-query">{context.searchQuery || 'none'}</span>
      <span data-testid="search-results-count">{context.searchResults?.length ?? 0}</span>
      <span data-testid="annotations-count">{context.annotations?.length ?? 0}</span>
      <button
        data-testid="select-entry"
        onClick={() => context.selectEntry('ch-32')}
      >
        Select Entry
      </button>
      <button
        data-testid="open-chapter"
        onClick={() => context.openChapter(32)}
      >
        Open Chapter
      </button>
      <button
        data-testid="close-panel"
        onClick={context.closePanel}
      >
        Close Panel
      </button>
      <button
        data-testid="toggle-panel"
        onClick={context.togglePanel}
      >
        Toggle Panel
      </button>
      <button
        data-testid="search"
        onClick={() => context.search('trinity')}
      >
        Search
      </button>
      <button
        data-testid="clear-search"
        onClick={context.clearSearch}
      >
        Clear Search
      </button>
      <button
        data-testid="add-annotation"
        onClick={() => context.addAnnotation('ch-32', { annotationType: 'highlight', textSelection: 'test' })}
      >
        Add Annotation
      </button>
      <button
        data-testid="delete-annotation"
        onClick={() => context.deleteAnnotation('ann-1')}
      >
        Delete Annotation
      </button>
      <button
        data-testid="navigate-to-link"
        onClick={() => context.navigateToLink('[[ST:Ch32]]')}
      >
        Navigate to Link
      </button>
      <button
        data-testid="find-chapter"
        onClick={() => {
          const ch = context.findChapterInTree(32);
          (document.getElementById('found-chapter') as HTMLElement).textContent = ch?.title || 'not found';
        }}
      >
        Find Chapter
      </button>
      <span id="found-chapter"></span>
    </div>
  );
}

// Wrapper component that provides BibleContext
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <BibleProvider>
      <SystematicProvider>
        {children}
      </SystematicProvider>
    </BibleProvider>
  );
}

describe('SystematicContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    (systematicService.getAll as any).mockResolvedValue(mockTree);
    (systematicService.getTags as any).mockResolvedValue(mockTags);
    (systematicService.getForPassage as any).mockResolvedValue([]);
    (systematicService.getAnnotations as any).mockResolvedValue([]);
    (systematicService.getById as any).mockResolvedValue(mockEntry);
    (systematicService.getChapter as any).mockResolvedValue(mockEntry);
    (sessionsService.log as any).mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.resetModules();
  });

  describe('initial load', () => {
    it('loads tree and tags on mount', async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      expect(screen.getByTestId('loading').textContent).toBe('true');

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('tree-count').textContent).toBe('1');
      expect(screen.getByTestId('tags-count').textContent).toBe('2');
    });

    it('handles load error', async () => {
      (systematicService.getAll as any).mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('error').textContent).toBe('Network error');
    });
  });

  describe('selectEntry', () => {
    it('selects an entry and opens panel', async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('select-entry').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-entry-id').textContent).toBe('ch-32');
      });

      expect(screen.getByTestId('is-panel-open').textContent).toBe('true');
      expect(screen.getByTestId('selected-entry-title').textContent).toBe('The Trinity');
    });

    it('logs study session when entry selected', async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('select-entry').click();
      });

      await waitFor(() => {
        expect(sessionsService.log).toHaveBeenCalledWith({
          sessionType: 'doctrine',
          referenceId: 'ch32',
          referenceLabel: 'The Trinity',
        });
      });
    });
  });

  describe('openChapter', () => {
    it('opens a chapter by number', async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('open-chapter').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-entry-title').textContent).toBe('The Trinity');
      });
    });
  });

  describe('closePanel', () => {
    it('closes the panel and clears selection', async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      // First open an entry
      await act(async () => {
        screen.getByTestId('select-entry').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-panel-open').textContent).toBe('true');
      });

      // Then close
      act(() => {
        screen.getByTestId('close-panel').click();
      });

      expect(screen.getByTestId('is-panel-open').textContent).toBe('false');
      expect(screen.getByTestId('selected-entry-id').textContent).toBe('none');
    });
  });

  describe('togglePanel', () => {
    it('toggles panel open and closed', async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('is-panel-open').textContent).toBe('false');

      act(() => {
        screen.getByTestId('toggle-panel').click();
      });

      expect(screen.getByTestId('is-panel-open').textContent).toBe('true');

      act(() => {
        screen.getByTestId('toggle-panel').click();
      });

      expect(screen.getByTestId('is-panel-open').textContent).toBe('false');
    });
  });

  describe('search', () => {
    it('searches entries and updates results', async () => {
      const mockResults = [
        { id: 'ch-32', title: 'The Trinity', snippet: '...trinity...' },
      ];
      (systematicService.search as any).mockResolvedValue(mockResults);

      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('search').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('search-query').textContent).toBe('trinity');
      });

      expect(screen.getByTestId('search-results-count').textContent).toBe('1');
    });

    it('clears search when query is too short', async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      // First do a search
      await act(async () => {
        screen.getByTestId('search').click();
      });

      // Then clear
      act(() => {
        screen.getByTestId('clear-search').click();
      });

      expect(screen.getByTestId('search-query').textContent).toBe('none');
      expect(screen.getByTestId('search-results-count').textContent).toBe('0');
    });
  });

  describe('annotations', () => {
    it('adds annotation', async () => {
      const newAnnotation = { id: 'ann-new', annotationType: 'highlight', textSelection: 'test' };
      (systematicService.addAnnotation as any).mockResolvedValue(newAnnotation);

      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('add-annotation').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('annotations-count').textContent).toBe('1');
      });
    });

    it('deletes annotation', async () => {
      // First load with an annotation
      (systematicService.getAnnotations as any).mockResolvedValue([
        { id: 'ann-1', annotationType: 'highlight' },
      ]);
      (systematicService.deleteAnnotation as any).mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      // Select entry to load annotations
      await act(async () => {
        screen.getByTestId('select-entry').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('annotations-count').textContent).toBe('1');
      });

      // Delete annotation
      await act(async () => {
        screen.getByTestId('delete-annotation').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('annotations-count').textContent).toBe('0');
      });
    });
  });

  describe('navigateToLink', () => {
    it('navigates to chapter link', async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('navigate-to-link').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-entry-title').textContent).toBe('The Trinity');
      });
    });
  });

  describe('findChapterInTree', () => {
    it('finds chapter in tree', async () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      act(() => {
        screen.getByTestId('find-chapter').click();
      });

      expect(document.getElementById('found-chapter')?.textContent).toBe('The Trinity');
    });

    it('returns null for non-existent chapter', async () => {
      // Using a component that tests non-existent chapter
      function TestFindNonExistent() {
        const { findChapterInTree } = useSystematic();
        return (
          <button
            data-testid="find-nonexistent"
            onClick={() => {
              const ch = findChapterInTree(999);
              (document.getElementById('find-result') as HTMLElement).textContent = ch ? 'found' : 'null';
            }}
          >
            Find
          </button>
        );
      }

      render(
        <TestWrapper>
          <TestFindNonExistent />
          <span id="find-result"></span>
        </TestWrapper>
      );

      await waitFor(() => {});

      act(() => {
        screen.getByTestId('find-nonexistent').click();
      });

      expect(document.getElementById('find-result')?.textContent).toBe('null');
    });
  });

  describe('useSystematic hook', () => {
    it('throws error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <BibleProvider>
            <TestConsumer />
          </BibleProvider>
        );
      }).toThrow('useSystematic must be used within a SystematicProvider');

      consoleSpy.mockRestore();
    });
  });
});
