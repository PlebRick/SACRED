import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { TopicsTree } from '../../../src/components/Layout/TopicsTree';

// Mock the contexts
vi.mock('../../../src/context/TopicsContext', () => ({
  useTopics: vi.fn(),
}));

vi.mock('../../../src/context/InlineTagsContext', () => ({
  useInlineTags: vi.fn(),
}));

vi.mock('../../../src/context/BibleContext', () => ({
  useBible: vi.fn(),
}));

vi.mock('../../../src/context/NotesContext', () => ({
  useNotes: vi.fn(),
}));

vi.mock('../../../src/context/SeriesContext', () => ({
  useSeries: vi.fn(),
}));

vi.mock('../../../src/services/topicsService', () => ({
  topicsService: {
    getNotes: vi.fn(),
  },
}));

vi.mock('../../../src/services/seriesService', () => ({
  seriesService: {
    getById: vi.fn(),
  },
}));

import { useTopics } from '../../../src/context/TopicsContext';
import { useInlineTags } from '../../../src/context/InlineTagsContext';
import { useBible } from '../../../src/context/BibleContext';
import { useNotes } from '../../../src/context/NotesContext';
import { useSeries } from '../../../src/context/SeriesContext';
import { topicsService } from '../../../src/services/topicsService';
import { seriesService } from '../../../src/services/seriesService';

const mockTopics = [
  {
    id: 'topic-1',
    name: 'Soteriology',
    noteCount: 5,
    children: [
      { id: 'topic-2', name: 'Justification', noteCount: 2, children: [] },
      { id: 'topic-3', name: 'Sanctification', noteCount: 3, children: [] },
    ],
  },
  {
    id: 'topic-4',
    name: 'Christology',
    noteCount: 0,
    children: [],
  },
];

const mockTagCountsByType = [
  { id: 'illustration', name: 'Illustration', icon: '💡', count: 5 },
  { id: 'application', name: 'Application', icon: '✅', count: 3 },
  { id: 'crossref', name: 'Cross-Reference', icon: '🔗', count: 10 },
];

describe('TopicsTree', () => {
  const mockCreateTopic = vi.fn();
  const mockUpdateTopic = vi.fn();
  const mockDeleteTopic = vi.fn();
  const mockSeedDefaultTopics = vi.fn();
  const mockRefreshTopics = vi.fn();
  const mockNavigate = vi.fn();
  const mockSetSelectedNote = vi.fn();
  const mockSetEditingNote = vi.fn();
  const mockLoadTagInstances = vi.fn();
  const mockSearchTags = vi.fn();
  const mockCreateTagType = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useTopics as any).mockReturnValue({
      topics: mockTopics,
      loading: false,
      createTopic: mockCreateTopic,
      updateTopic: mockUpdateTopic,
      deleteTopic: mockDeleteTopic,
      seedDefaultTopics: mockSeedDefaultTopics,
      refreshTopics: mockRefreshTopics,
    });
    (useInlineTags as any).mockReturnValue({
      tagCountsByType: mockTagCountsByType,
      tagInstances: [],
      loadingInstances: false,
      loadTagInstances: mockLoadTagInstances,
      searchTags: mockSearchTags,
      createTagType: mockCreateTagType,
    });
    (useBible as any).mockReturnValue({
      navigate: mockNavigate,
    });
    (useNotes as any).mockReturnValue({
      setSelectedNote: mockSetSelectedNote,
      setEditingNote: mockSetEditingNote,
    });
    (useSeries as any).mockReturnValue({
      series: [],
      loading: false,
    });
    (topicsService.getNotes as any).mockResolvedValue([]);
    (seriesService.getById as any).mockResolvedValue({ sermons: [] });
    mockLoadTagInstances.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  describe('loading state', () => {
    it('shows loading message', () => {
      (useTopics as any).mockReturnValue({
        topics: [],
        loading: true,
        createTopic: mockCreateTopic,
        updateTopic: mockUpdateTopic,
        deleteTopic: mockDeleteTopic,
        seedDefaultTopics: mockSeedDefaultTopics,
        refreshTopics: mockRefreshTopics,
      });

      render(<TopicsTree />);

      expect(screen.getByText('Loading topics...')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      (useTopics as any).mockReturnValue({
        topics: [],
        loading: false,
        createTopic: mockCreateTopic,
        updateTopic: mockUpdateTopic,
        deleteTopic: mockDeleteTopic,
        seedDefaultTopics: mockSeedDefaultTopics,
        refreshTopics: mockRefreshTopics,
      });
    });

    it('shows empty message when no topics', () => {
      render(<TopicsTree />);

      expect(screen.getByText('No topics yet.')).toBeInTheDocument();
    });

    it('shows seed button', () => {
      render(<TopicsTree />);

      expect(screen.getByText('Add default topics')).toBeInTheDocument();
    });

    it('calls seedDefaultTopics when seed button clicked', () => {
      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Add default topics'));

      expect(mockSeedDefaultTopics).toHaveBeenCalled();
    });

    it('shows create first topic button', () => {
      render(<TopicsTree />);

      expect(screen.getByText('Create your first topic')).toBeInTheDocument();
    });

    it('shows create form when create button clicked', () => {
      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Create your first topic'));

      expect(screen.getByPlaceholderText('Topic name...')).toBeInTheDocument();
    });
  });

  describe('topic tree rendering', () => {
    it('renders topics', () => {
      render(<TopicsTree />);

      expect(screen.getByText('Soteriology')).toBeInTheDocument();
      expect(screen.getByText('Christology')).toBeInTheDocument();
    });

    it('shows note count badges', () => {
      render(<TopicsTree />);

      // Soteriology has 5 notes - find it within the topic row
      const soteriologyRow = screen.getByText('Soteriology').closest('[class*="topicRow"]');
      expect(soteriologyRow?.textContent).toContain('5');
    });

    it('renders add topic button', () => {
      render(<TopicsTree />);

      expect(screen.getByText('Add Topic')).toBeInTheDocument();
    });
  });

  describe('topic expansion', () => {
    it('expands topic to show children', () => {
      render(<TopicsTree />);

      const soteriologyButton = screen.getByText('Soteriology').closest('button');
      fireEvent.click(soteriologyButton!);

      expect(screen.getByText('Justification')).toBeInTheDocument();
      expect(screen.getByText('Sanctification')).toBeInTheDocument();
    });

    it('collapses topic on second click', () => {
      render(<TopicsTree />);

      const soteriologyButton = screen.getByText('Soteriology').closest('button');
      fireEvent.click(soteriologyButton!);
      expect(screen.getByText('Justification')).toBeInTheDocument();

      fireEvent.click(soteriologyButton!);
      expect(screen.queryByText('Justification')).not.toBeInTheDocument();
    });
  });

  describe('topic selection', () => {
    it('loads notes when leaf topic is selected', async () => {
      (topicsService.getNotes as any).mockResolvedValue([
        { id: 'note-1', book: 'ROM', startChapter: 3, title: 'Note 1' },
      ]);

      render(<TopicsTree />);

      // Expand parent
      fireEvent.click(screen.getByText('Soteriology').closest('button')!);

      // Click leaf topic
      fireEvent.click(screen.getByText('Justification').closest('button')!);

      await waitFor(() => {
        expect(topicsService.getNotes).toHaveBeenCalledWith('topic-2');
      });
    });

    it('shows topic notes when selected', async () => {
      (topicsService.getNotes as any).mockResolvedValue([
        { id: 'note-1', book: 'ROM', startChapter: 3, startVerse: 21, title: 'Justification Note' },
      ]);

      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Soteriology').closest('button')!);
      fireEvent.click(screen.getByText('Justification').closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Justification Note')).toBeInTheDocument();
      });
    });

    it('shows back button when topic is selected', async () => {
      (topicsService.getNotes as any).mockResolvedValue([]);

      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Soteriology').closest('button')!);
      fireEvent.click(screen.getByText('Justification').closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });
    });

    it('shows empty notes message', async () => {
      (topicsService.getNotes as any).mockResolvedValue([]);

      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Soteriology').closest('button')!);
      fireEvent.click(screen.getByText('Justification').closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('No notes with this topic')).toBeInTheDocument();
      });
    });

    it('navigates to note on click', async () => {
      (topicsService.getNotes as any).mockResolvedValue([
        { id: 'note-1', book: 'ROM', startChapter: 3, startVerse: 21, title: 'Test Note' },
      ]);

      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Soteriology').closest('button')!);
      fireEvent.click(screen.getByText('Justification').closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Note').closest('button')!);

      expect(mockNavigate).toHaveBeenCalledWith('ROM', 3);
      expect(mockSetSelectedNote).toHaveBeenCalledWith('note-1');
      expect(mockSetEditingNote).toHaveBeenCalledWith('note-1');
    });
  });

  describe('topic CRUD operations', () => {
    it('shows edit modal when edit button clicked', () => {
      render(<TopicsTree />);

      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);

      expect(screen.getByRole('heading', { name: 'Edit Topic' })).toBeInTheDocument();
    });

    it('saves edited topic on submit', async () => {
      render(<TopicsTree />);

      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);

      const input = screen.getByDisplayValue('Soteriology');
      fireEvent.change(input, { target: { value: 'Salvation' } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockUpdateTopic).toHaveBeenCalledWith('topic-1', { name: 'Salvation' });
      });
    });

    it('shows delete confirmation', () => {
      window.confirm = vi.fn(() => false);

      render(<TopicsTree />);

      const deleteButtons = screen.getAllByTitle('Delete');
      fireEvent.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalled();
    });

    it('deletes topic when confirmed', async () => {
      window.confirm = vi.fn(() => true);

      render(<TopicsTree />);

      const deleteButtons = screen.getAllByTitle('Delete');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockDeleteTopic).toHaveBeenCalledWith('topic-1');
      });
    });

    it('shows add child modal', () => {
      render(<TopicsTree />);

      const addButtons = screen.getAllByTitle('Add sub-topic');
      fireEvent.click(addButtons[0]);

      expect(screen.getByRole('heading', { name: 'Add Sub-topic' })).toBeInTheDocument();
    });

    it('creates child topic', async () => {
      render(<TopicsTree />);

      const addButtons = screen.getAllByTitle('Add sub-topic');
      fireEvent.click(addButtons[0]);

      const input = screen.getByPlaceholderText('Topic name...');
      fireEvent.change(input, { target: { value: 'New Child' } });
      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(mockCreateTopic).toHaveBeenCalledWith({
          name: 'New Child',
          parentId: 'topic-1',
        });
      });
    });

    it('creates root topic', async () => {
      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Add Topic'));

      const input = screen.getByPlaceholderText('Topic name...');
      fireEvent.change(input, { target: { value: 'New Root' } });

      const addButtons = screen.getAllByText('Add');
      const lastAddButton = addButtons[addButtons.length - 1];
      fireEvent.click(lastAddButton);

      await waitFor(() => {
        expect(mockCreateTopic).toHaveBeenCalledWith({
          name: 'New Root',
          parentId: null,
        });
      });
    });
  });

  describe('browse by tag section', () => {
    it('renders browse by tag section', () => {
      render(<TopicsTree />);

      expect(screen.getByText('Browse by Tag')).toBeInTheDocument();
    });

    it('shows tag count total', () => {
      render(<TopicsTree />);

      // Total is 5 + 3 + 10 = 18
      expect(screen.getByText('18')).toBeInTheDocument();
    });

    it('shows tag types', () => {
      render(<TopicsTree />);

      expect(screen.getByText('Illustration')).toBeInTheDocument();
      expect(screen.getByText('Application')).toBeInTheDocument();
      expect(screen.getByText('Cross-Reference')).toBeInTheDocument();
    });

    it('loads tag instances when tag type is selected', async () => {
      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Application').closest('button')!);

      await waitFor(() => {
        expect(mockLoadTagInstances).toHaveBeenCalledWith({ tagType: 'application' });
      });
    });

    it('shows tag instances panel', async () => {
      (useInlineTags as any).mockReturnValue({
        tagCountsByType: mockTagCountsByType,
        tagInstances: [
          { id: 'inst-1', book: 'ROM', startChapter: 3, textContent: 'Apply this', noteId: 'note-1' },
        ],
        loadingInstances: false,
        loadTagInstances: mockLoadTagInstances,
        searchTags: mockSearchTags,
        createTagType: mockCreateTagType,
      });

      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Application').closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('"Apply this"')).toBeInTheDocument();
      });
    });

    it('navigates to note when tag instance clicked', async () => {
      (useInlineTags as any).mockReturnValue({
        tagCountsByType: mockTagCountsByType,
        tagInstances: [
          { id: 'inst-1', book: 'ROM', startChapter: 3, startVerse: 21, textContent: 'Apply this', noteId: 'note-1' },
        ],
        loadingInstances: false,
        loadTagInstances: mockLoadTagInstances,
        searchTags: mockSearchTags,
        createTagType: mockCreateTagType,
      });

      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Application').closest('button')!);

      await waitFor(() => {
        const instanceButton = screen.getByText('"Apply this"').closest('button');
        fireEvent.click(instanceButton!);
      });

      expect(mockNavigate).toHaveBeenCalledWith('ROM', 3);
      expect(mockSetSelectedNote).toHaveBeenCalledWith('note-1');
    });

    it('shows back button in tag panel', async () => {
      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Application').closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });
    });

    it('collapses tag section', () => {
      render(<TopicsTree />);

      const tagHeader = screen.getByText('Browse by Tag').closest('button');
      fireEvent.click(tagHeader!);

      expect(screen.queryByText('Illustration')).not.toBeInTheDocument();
    });
  });

  describe('illustrations section', () => {
    it('renders illustrations section', () => {
      render(<TopicsTree />);

      expect(screen.getByText('Illustrations')).toBeInTheDocument();
    });

    it('shows illustration count', () => {
      render(<TopicsTree />);

      // 5 illustrations from mock data
      const illustrationsHeader = screen.getByText('Illustrations').closest('button');
      expect(illustrationsHeader?.textContent).toContain('5');
    });

    it('loads illustrations when expanded', async () => {
      mockLoadTagInstances.mockResolvedValue([
        { id: 'ill-1', book: 'JHN', startChapter: 3, textContent: 'Story about grace', noteId: 'note-1' },
      ]);

      render(<TopicsTree />);

      const illustrationsButton = screen.getByText('Illustrations').closest('button');
      fireEvent.click(illustrationsButton!);

      await waitFor(() => {
        expect(mockLoadTagInstances).toHaveBeenCalledWith({
          tagType: 'illustration',
          search: undefined,
          limit: 50,
        });
      });
    });

    it('shows search input in illustrations', () => {
      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Illustrations').closest('button')!);

      expect(screen.getByPlaceholderText('Search illustrations...')).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('creates topic on Enter key', async () => {
      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Add Topic'));

      const input = screen.getByPlaceholderText('Topic name...');
      fireEvent.change(input, { target: { value: 'Keyboard Topic' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockCreateTopic).toHaveBeenCalled();
      });
    });

    it('cancels on Escape key', () => {
      render(<TopicsTree />);

      fireEvent.click(screen.getByText('Add Topic'));

      const input = screen.getByPlaceholderText('Topic name...');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(screen.queryByPlaceholderText('Topic name...')).not.toBeInTheDocument();
    });

    it('saves edit on Enter key', async () => {
      render(<TopicsTree />);

      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);

      const input = screen.getByDisplayValue('Soteriology');
      fireEvent.change(input, { target: { value: 'Changed' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockUpdateTopic).toHaveBeenCalled();
      });
    });
  });

  describe('modal interactions', () => {
    it('closes edit modal when Cancel clicked', () => {
      render(<TopicsTree />);

      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);
      expect(screen.getByRole('heading', { name: 'Edit Topic' })).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByRole('heading', { name: 'Edit Topic' })).not.toBeInTheDocument();
    });

    it('closes modal on overlay click', () => {
      const { container } = render(<TopicsTree />);

      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);

      const overlay = container.querySelector('[class*="modalOverlay"]');
      fireEvent.click(overlay!);

      expect(screen.queryByRole('heading', { name: 'Edit Topic' })).not.toBeInTheDocument();
    });

    it('does not close when clicking modal content', () => {
      const { container } = render(<TopicsTree />);

      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);

      // The modal has class 'modal' (not overlay)
      const modal = container.querySelector('[class*="modal"]:not([class*="overlay"])');
      fireEvent.click(modal!);

      expect(screen.getByText('Edit Topic')).toBeInTheDocument();
    });
  });

  describe('systematic tag link indicator', () => {
    it('shows doctrine link icon when topic has systematicTagId', () => {
      (useTopics as any).mockReturnValue({
        topics: [
          { id: 'topic-1', name: 'God', noteCount: 0, systematicTagId: 'doctrine-god', children: [] },
        ],
        loading: false,
        createTopic: mockCreateTopic,
        updateTopic: mockUpdateTopic,
        deleteTopic: mockDeleteTopic,
        seedDefaultTopics: mockSeedDefaultTopics,
        refreshTopics: mockRefreshTopics,
      });

      render(<TopicsTree />);

      const doctrineIcon = screen.getByTitle('Linked to Systematic Theology');
      expect(doctrineIcon).toBeInTheDocument();
    });
  });
});
