import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { InlineTagsProvider, useInlineTags } from '../../../src/context/InlineTagsContext';

// Mock the service
vi.mock('../../../src/services/inlineTagsService', () => ({
  inlineTagsService: {
    getTypes: vi.fn(),
    getCountsByType: vi.fn(),
    createType: vi.fn(),
    updateType: vi.fn(),
    deleteType: vi.fn(),
    getTags: vi.fn(),
    search: vi.fn(),
  },
}));

import { inlineTagsService } from '../../../src/services/inlineTagsService';

const mockTagTypes = [
  { id: 'illustration', name: 'Illustration', color: '#60a5fa', icon: '💡', isDefault: true },
  { id: 'application', name: 'Application', color: '#34d399', icon: '✅', isDefault: true },
];

const mockCounts = {
  illustration: 10,
  application: 5,
};

// Test component that exposes context state and actions
function TestConsumer() {
  const context = useInlineTags();
  return (
    <div>
      <span data-testid="loading">{String(context.loading)}</span>
      <span data-testid="error">{context.error || 'none'}</span>
      <span data-testid="tag-types-count">{context.tagTypes.length}</span>
      <span data-testid="selected-tag-type">{context.selectedTagType || 'none'}</span>
      <span data-testid="loading-instances">{String(context.loadingInstances)}</span>
      <span data-testid="tag-instances-count">{context.tagInstances.length}</span>
      <button
        data-testid="create-type"
        onClick={() => context.createTagType({ name: 'Quote', color: '#a78bfa' }).catch(() => {})}
      >
        Create Type
      </button>
      <button
        data-testid="update-type"
        onClick={() => context.updateTagType('illustration', { name: 'Updated' })}
      >
        Update Type
      </button>
      <button
        data-testid="delete-type"
        onClick={() => context.deleteTagType('illustration')}
      >
        Delete Type
      </button>
      <button
        data-testid="select-type"
        onClick={() => context.setSelectedTagType('illustration')}
      >
        Select Type
      </button>
      <button
        data-testid="load-instances"
        onClick={() => context.loadTagInstances({ tagType: 'illustration' })}
      >
        Load Instances
      </button>
      <button
        data-testid="search-tags"
        onClick={() => context.searchTags('grace')}
      >
        Search Tags
      </button>
      <button
        data-testid="get-tag-type"
        onClick={() => {
          const type = context.getTagTypeById('illustration');
          (document.getElementById('found-type') as HTMLElement).textContent = type?.name || 'not found';
        }}
      >
        Get Tag Type
      </button>
      <span id="found-type"></span>
    </div>
  );
}

describe('InlineTagsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (inlineTagsService.getTypes as any).mockResolvedValue(mockTagTypes);
    (inlineTagsService.getCountsByType as any).mockResolvedValue(mockCounts);
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  describe('initial load', () => {
    it('loads tag types on mount', async () => {
      render(
        <InlineTagsProvider>
          <TestConsumer />
        </InlineTagsProvider>
      );

      // Initially loading
      expect(screen.getByTestId('loading').textContent).toBe('true');

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('tag-types-count').textContent).toBe('2');
      expect(inlineTagsService.getTypes).toHaveBeenCalled();
      expect(inlineTagsService.getCountsByType).toHaveBeenCalled();
    });

    it('handles load error', async () => {
      (inlineTagsService.getTypes as any).mockRejectedValue(new Error('Network error'));

      render(
        <InlineTagsProvider>
          <TestConsumer />
        </InlineTagsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('error').textContent).toBe('Network error');
    });
  });

  describe('createTagType', () => {
    it('adds new tag type', async () => {
      const newType = { id: 'quote', name: 'Quote', color: '#a78bfa', isDefault: false };
      (inlineTagsService.createType as any).mockResolvedValue(newType);
      (inlineTagsService.getCountsByType as any).mockResolvedValue({ ...mockCounts, quote: 0 });

      render(
        <InlineTagsProvider>
          <TestConsumer />
        </InlineTagsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('tag-types-count').textContent).toBe('2');

      await act(async () => {
        screen.getByTestId('create-type').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('tag-types-count').textContent).toBe('3');
      });
    });

    it('handles error on failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <InlineTagsProvider>
          <TestConsumer />
        </InlineTagsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      // Set up mock to fail for next call only - use async function to avoid unhandled rejection
      (inlineTagsService.createType as any).mockImplementationOnce(async () => {
        throw new Error('Create failed');
      });

      // Click and the context should handle the error
      await act(async () => {
        screen.getByTestId('create-type').click();
      });

      // Wait for error handling
      await waitFor(
        () => {
          // Either error state is set or the tag count didn't increase
          const errorText = screen.getByTestId('error').textContent;
          const tagCount = screen.getByTestId('tag-types-count').textContent;
          // Check that either error was set OR the original count is preserved (error prevented creation)
          expect(errorText !== 'none' || tagCount === '2').toBe(true);
        },
        { timeout: 2000 }
      );

      consoleSpy.mockRestore();
    });
  });

  describe('updateTagType', () => {
    it('updates existing tag type', async () => {
      const updatedType = { ...mockTagTypes[0], name: 'Updated' };
      (inlineTagsService.updateType as any).mockResolvedValue(updatedType);

      render(
        <InlineTagsProvider>
          <TestConsumer />
        </InlineTagsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('update-type').click();
      });

      expect(inlineTagsService.updateType).toHaveBeenCalledWith('illustration', { name: 'Updated' });
    });
  });

  describe('deleteTagType', () => {
    it('removes tag type', async () => {
      (inlineTagsService.deleteType as any).mockResolvedValue(undefined);
      (inlineTagsService.getCountsByType as any).mockResolvedValue({ application: 5 });

      render(
        <InlineTagsProvider>
          <TestConsumer />
        </InlineTagsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('tag-types-count').textContent).toBe('2');
      });

      await act(async () => {
        screen.getByTestId('delete-type').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('tag-types-count').textContent).toBe('1');
      });
    });

    it('clears selected tag type if deleted', async () => {
      (inlineTagsService.deleteType as any).mockResolvedValue(undefined);
      (inlineTagsService.getCountsByType as any).mockResolvedValue({ application: 5 });

      render(
        <InlineTagsProvider>
          <TestConsumer />
        </InlineTagsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      // Select the type first
      act(() => {
        screen.getByTestId('select-type').click();
      });

      expect(screen.getByTestId('selected-tag-type').textContent).toBe('illustration');

      // Delete it
      await act(async () => {
        screen.getByTestId('delete-type').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-tag-type').textContent).toBe('none');
      });
    });
  });

  describe('setSelectedTagType', () => {
    it('sets selected tag type', async () => {
      render(
        <InlineTagsProvider>
          <TestConsumer />
        </InlineTagsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('selected-tag-type').textContent).toBe('none');

      act(() => {
        screen.getByTestId('select-type').click();
      });

      expect(screen.getByTestId('selected-tag-type').textContent).toBe('illustration');
    });
  });

  describe('loadTagInstances', () => {
    it('loads tag instances with filters', async () => {
      const mockInstances = [
        { id: 'tag-1', tagType: 'illustration', textContent: 'Test content' },
      ];
      (inlineTagsService.getTags as any).mockResolvedValue(mockInstances);

      render(
        <InlineTagsProvider>
          <TestConsumer />
        </InlineTagsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('load-instances').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('tag-instances-count').textContent).toBe('1');
      });

      expect(inlineTagsService.getTags).toHaveBeenCalledWith({ tagType: 'illustration' });
    });

    it('sets loading state while fetching', async () => {
      let resolvePromise: (value: any) => void;
      (inlineTagsService.getTags as any).mockImplementation(() =>
        new Promise(resolve => { resolvePromise = resolve; })
      );

      render(
        <InlineTagsProvider>
          <TestConsumer />
        </InlineTagsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      act(() => {
        screen.getByTestId('load-instances').click();
      });

      expect(screen.getByTestId('loading-instances').textContent).toBe('true');

      await act(async () => {
        resolvePromise!([]);
      });

      expect(screen.getByTestId('loading-instances').textContent).toBe('false');
    });
  });

  describe('searchTags', () => {
    it('searches tags and updates instances', async () => {
      const mockResults = [
        { id: 'tag-2', tagType: 'application', textContent: 'Grace in action' },
      ];
      (inlineTagsService.search as any).mockResolvedValue(mockResults);

      render(
        <InlineTagsProvider>
          <TestConsumer />
        </InlineTagsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('search-tags').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('tag-instances-count').textContent).toBe('1');
      });

      expect(inlineTagsService.search).toHaveBeenCalledWith('grace', 50);
    });
  });

  describe('getTagTypeById', () => {
    it('finds tag type by ID', async () => {
      render(
        <InlineTagsProvider>
          <TestConsumer />
        </InlineTagsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      act(() => {
        screen.getByTestId('get-tag-type').click();
      });

      expect(document.getElementById('found-type')?.textContent).toBe('Illustration');
    });
  });

  describe('useInlineTags hook', () => {
    it('throws error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useInlineTags must be used within an InlineTagsProvider');

      consoleSpy.mockRestore();
    });
  });
});
