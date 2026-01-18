import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import React from 'react';
import { TopicsProvider, useTopics } from '../../../src/context/TopicsContext';

// Mock the topicsService
vi.mock('../../../src/services/topicsService', () => ({
  topicsService: {
    getTree: vi.fn(),
    getFlat: vi.fn(),
    getById: vi.fn(),
    getNotes: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    seed: vi.fn(),
  },
}));

import { topicsService } from '../../../src/services/topicsService';

const mockTopic = {
  id: 'topic-1',
  name: 'Soteriology',
  parentId: null,
  sortOrder: 0,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockChildTopic = {
  id: 'topic-2',
  name: 'Justification',
  parentId: 'topic-1',
  sortOrder: 0,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockTreeTopic = {
  ...mockTopic,
  noteCount: 5,
  children: [
    { ...mockChildTopic, noteCount: 2, children: [] }
  ]
};

// Test component that displays state and provides action triggers
function TestConsumer() {
  const context = useTopics();
  return (
    <div>
      <span data-testid="loading">{String(context.loading)}</span>
      <span data-testid="error">{context.error || 'none'}</span>
      <span data-testid="topics-count">{context.topics.length}</span>
      <span data-testid="flat-count">{context.flatTopics.length}</span>
      <span data-testid="selected-id">{context.selectedTopicId || 'none'}</span>
      <ul data-testid="topics-list">
        {context.topics.map((t) => (
          <li key={t.id} data-testid={`topic-${t.id}`}>
            {t.name}
          </li>
        ))}
      </ul>
      <button
        data-testid="create-btn"
        onClick={() => context.createTopic({ name: 'New Topic', parentId: null })}
      >
        Create
      </button>
      <button
        data-testid="update-btn"
        onClick={() => context.updateTopic('topic-1', { name: 'Updated Name' })}
      >
        Update
      </button>
      <button
        data-testid="delete-btn"
        onClick={() => context.deleteTopic('topic-1')}
      >
        Delete
      </button>
      <button
        data-testid="set-selected-btn"
        onClick={() => context.setSelectedTopic('topic-1')}
      >
        Set Selected
      </button>
      <button
        data-testid="clear-selected-btn"
        onClick={() => context.setSelectedTopic(null)}
      >
        Clear Selected
      </button>
      <button
        data-testid="refresh-btn"
        onClick={() => context.refreshTopics()}
      >
        Refresh
      </button>
      <button
        data-testid="seed-btn"
        onClick={() => context.seedDefaultTopics()}
      >
        Seed
      </button>
      <span data-testid="get-by-id-result">
        {context.getTopicById('topic-1')?.name || 'not found'}
      </span>
      <span data-testid="get-path-length">
        {context.getTopicPath('topic-2').length}
      </span>
    </div>
  );
}

describe('TopicsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Default mock implementations
    (topicsService.getTree as ReturnType<typeof vi.fn>).mockResolvedValue([mockTreeTopic]);
    (topicsService.getFlat as ReturnType<typeof vi.fn>).mockResolvedValue([mockTopic, mockChildTopic]);
    (topicsService.create as ReturnType<typeof vi.fn>).mockImplementation(async (data) => ({
      ...data,
      id: 'new-topic-id',
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    (topicsService.update as ReturnType<typeof vi.fn>).mockImplementation(async (id, updates) => ({
      ...mockTopic,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    }));
    (topicsService.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (topicsService.seed as ReturnType<typeof vi.fn>).mockResolvedValue({ message: 'Seeded' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('initial load', () => {
    it('loads topics on mount', async () => {
      render(
        <TopicsProvider>
          <TestConsumer />
        </TopicsProvider>
      );

      // Initially loading
      expect(screen.getByTestId('loading').textContent).toBe('true');

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('topics-count').textContent).toBe('1');
      expect(screen.getByTestId('flat-count').textContent).toBe('2');
      expect(topicsService.getTree).toHaveBeenCalledTimes(1);
      expect(topicsService.getFlat).toHaveBeenCalledTimes(1);
    });

    it('handles load error', async () => {
      (topicsService.getTree as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      render(
        <TopicsProvider>
          <TestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('error').textContent).toBe('Network error');
    });
  });

  describe('createTopic', () => {
    it('adds topic to state and reloads tree', async () => {
      render(
        <TopicsProvider>
          <TestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('create-btn').click();
      });

      await waitFor(() => {
        expect(topicsService.create).toHaveBeenCalledWith({ name: 'New Topic', parentId: null });
      });

      // Should reload tree after create
      expect(topicsService.getTree).toHaveBeenCalledTimes(2);
    });

    it('handles create error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (topicsService.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Create failed'));

      // Create a test component that catches errors
      function ErrorTestConsumer() {
        const { createTopic, loading } = useTopics();
        const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

        const handleCreate = async () => {
          try {
            await createTopic({ name: 'New Topic', parentId: null });
          } catch (e) {
            setErrorMsg((e as Error).message);
          }
        };

        return (
          <div>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="error-msg">{errorMsg || 'none'}</span>
            <button data-testid="create-btn" onClick={handleCreate}>Create</button>
          </div>
        );
      }

      render(
        <TopicsProvider>
          <ErrorTestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('create-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-msg').textContent).toBe('Create failed');
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('updateTopic', () => {
    it('updates topic in state and reloads tree', async () => {
      render(
        <TopicsProvider>
          <TestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('update-btn').click();
      });

      await waitFor(() => {
        expect(topicsService.update).toHaveBeenCalledWith('topic-1', { name: 'Updated Name' });
      });

      // Should reload tree after update
      expect(topicsService.getTree).toHaveBeenCalledTimes(2);
    });

    it('handles update error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (topicsService.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Update failed'));

      function ErrorTestConsumer() {
        const { updateTopic, loading } = useTopics();
        const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

        const handleUpdate = async () => {
          try {
            await updateTopic('topic-1', { name: 'Updated Name' });
          } catch (e) {
            setErrorMsg((e as Error).message);
          }
        };

        return (
          <div>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="error-msg">{errorMsg || 'none'}</span>
            <button data-testid="update-btn" onClick={handleUpdate}>Update</button>
          </div>
        );
      }

      render(
        <TopicsProvider>
          <ErrorTestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('update-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-msg').textContent).toBe('Update failed');
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('deleteTopic', () => {
    it('removes topic from state and reloads tree', async () => {
      render(
        <TopicsProvider>
          <TestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('flat-count').textContent).toBe('2');
      });

      await act(async () => {
        screen.getByTestId('delete-btn').click();
      });

      await waitFor(() => {
        expect(topicsService.delete).toHaveBeenCalledWith('topic-1');
      });

      // Should reload tree after delete
      expect(topicsService.getTree).toHaveBeenCalledTimes(2);
    });

    it('clears selection if deleted topic was selected', async () => {
      render(
        <TopicsProvider>
          <TestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      // Set the topic as selected first
      await act(async () => {
        screen.getByTestId('set-selected-btn').click();
      });

      expect(screen.getByTestId('selected-id').textContent).toBe('topic-1');

      // Delete the topic
      await act(async () => {
        screen.getByTestId('delete-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-id').textContent).toBe('none');
      });
    });

    it('handles delete error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (topicsService.delete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Delete failed'));

      function ErrorTestConsumer() {
        const { deleteTopic, loading } = useTopics();
        const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

        const handleDelete = async () => {
          try {
            await deleteTopic('topic-1');
          } catch (e) {
            setErrorMsg((e as Error).message);
          }
        };

        return (
          <div>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="error-msg">{errorMsg || 'none'}</span>
            <button data-testid="delete-btn" onClick={handleDelete}>Delete</button>
          </div>
        );
      }

      render(
        <TopicsProvider>
          <ErrorTestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('delete-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-msg').textContent).toBe('Delete failed');
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('setSelectedTopic', () => {
    it('sets the selected topic id', async () => {
      render(
        <TopicsProvider>
          <TestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('selected-id').textContent).toBe('none');

      await act(async () => {
        screen.getByTestId('set-selected-btn').click();
      });

      expect(screen.getByTestId('selected-id').textContent).toBe('topic-1');
    });

    it('clears selection when set to null', async () => {
      render(
        <TopicsProvider>
          <TestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('set-selected-btn').click();
      });

      expect(screen.getByTestId('selected-id').textContent).toBe('topic-1');

      await act(async () => {
        screen.getByTestId('clear-selected-btn').click();
      });

      expect(screen.getByTestId('selected-id').textContent).toBe('none');
    });
  });

  describe('refreshTopics', () => {
    it('reloads topics from service', async () => {
      render(
        <TopicsProvider>
          <TestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(topicsService.getTree).toHaveBeenCalledTimes(1);
      expect(topicsService.getFlat).toHaveBeenCalledTimes(1);

      await act(async () => {
        screen.getByTestId('refresh-btn').click();
      });

      await waitFor(() => {
        expect(topicsService.getTree).toHaveBeenCalledTimes(2);
        expect(topicsService.getFlat).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('seedDefaultTopics', () => {
    it('calls seed service and reloads topics', async () => {
      render(
        <TopicsProvider>
          <TestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('seed-btn').click();
      });

      await waitFor(() => {
        expect(topicsService.seed).toHaveBeenCalledTimes(1);
      });

      // Should reload after seeding
      expect(topicsService.getTree).toHaveBeenCalledTimes(2);
    });

    it('handles seed error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (topicsService.seed as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Seed failed'));

      function ErrorTestConsumer() {
        const { seedDefaultTopics, loading } = useTopics();
        const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

        const handleSeed = async () => {
          try {
            await seedDefaultTopics();
          } catch (e) {
            setErrorMsg((e as Error).message);
          }
        };

        return (
          <div>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="error-msg">{errorMsg || 'none'}</span>
            <button data-testid="seed-btn" onClick={handleSeed}>Seed</button>
          </div>
        );
      }

      render(
        <TopicsProvider>
          <ErrorTestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      await act(async () => {
        screen.getByTestId('seed-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-msg').textContent).toBe('Seed failed');
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getTopicById', () => {
    it('finds topic by id from flatTopics', async () => {
      render(
        <TopicsProvider>
          <TestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('get-by-id-result').textContent).toBe('Soteriology');
    });

    it('returns undefined for non-existent id', async () => {
      function GetByIdConsumer() {
        const { getTopicById, loading } = useTopics();
        const result = getTopicById('non-existent');
        return (
          <div>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="result">{result?.name || 'not found'}</span>
          </div>
        );
      }

      render(
        <TopicsProvider>
          <GetByIdConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('result').textContent).toBe('not found');
    });
  });

  describe('getTopicPath', () => {
    it('builds path from root to topic', async () => {
      render(
        <TopicsProvider>
          <TestConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      // topic-2 has parentId topic-1, so path length should be 2
      expect(screen.getByTestId('get-path-length').textContent).toBe('2');
    });

    it('returns single item path for root topic', async () => {
      function PathConsumer() {
        const { getTopicPath, loading } = useTopics();
        const path = getTopicPath('topic-1');
        return (
          <div>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="path-length">{path.length}</span>
          </div>
        );
      }

      render(
        <TopicsProvider>
          <PathConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      // topic-1 is root, so path length should be 1
      expect(screen.getByTestId('path-length').textContent).toBe('1');
    });

    it('returns empty path for non-existent topic', async () => {
      function PathConsumer() {
        const { getTopicPath, loading } = useTopics();
        const path = getTopicPath('non-existent');
        return (
          <div>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="path-length">{path.length}</span>
          </div>
        );
      }

      render(
        <TopicsProvider>
          <PathConsumer />
        </TopicsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('path-length').textContent).toBe('0');
    });
  });

  describe('useTopics hook', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useTopics must be used within a TopicsProvider');

      consoleSpy.mockRestore();
    });
  });
});
