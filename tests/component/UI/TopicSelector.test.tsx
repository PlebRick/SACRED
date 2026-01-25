import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { TopicSelector } from '../../../src/components/UI/TopicSelector';

// Mock the TopicsContext
vi.mock('../../../src/context/TopicsContext', () => ({
  useTopics: vi.fn(),
}));

import { useTopics } from '../../../src/context/TopicsContext';

const mockTopics = [
  { id: 'topic-1', name: 'Soteriology', parentId: null },
  { id: 'topic-2', name: 'Justification', parentId: 'topic-1' },
  { id: 'topic-3', name: 'Sanctification', parentId: 'topic-1' },
  { id: 'topic-4', name: 'Christology', parentId: null },
];

describe('TopicSelector', () => {
  const mockOnChange = vi.fn();
  const mockOnMultiChange = vi.fn();
  const mockCreateTopic = vi.fn();
  const mockGetTopicPath = vi.fn((id: string) => {
    const topic = mockTopics.find(t => t.id === id);
    if (!topic) return [];
    if (topic.parentId) {
      const parent = mockTopics.find(t => t.id === topic.parentId);
      return parent ? [parent, topic] : [topic];
    }
    return [topic];
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (useTopics as any).mockReturnValue({
      flatTopics: mockTopics,
      createTopic: mockCreateTopic,
      getTopicPath: mockGetTopicPath,
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  describe('rendering', () => {
    it('renders trigger button with placeholder', () => {
      render(<TopicSelector onChange={mockOnChange} />);

      expect(screen.getByText('Select topic...')).toBeInTheDocument();
    });

    it('renders custom placeholder', () => {
      render(<TopicSelector onChange={mockOnChange} placeholder="Choose a topic..." />);

      expect(screen.getByText('Choose a topic...')).toBeInTheDocument();
    });

    it('renders label when provided', () => {
      render(<TopicSelector onChange={mockOnChange} label="Primary Topic" />);

      expect(screen.getByText('Primary Topic')).toBeInTheDocument();
    });

    it('shows selected topic name', () => {
      render(<TopicSelector value="topic-1" onChange={mockOnChange} />);

      expect(screen.getByText('Soteriology')).toBeInTheDocument();
    });
  });

  describe('dropdown interaction', () => {
    it('opens dropdown on trigger click', () => {
      render(<TopicSelector onChange={mockOnChange} />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);

      expect(screen.getByPlaceholderText('Search topics...')).toBeInTheDocument();
    });

    it('closes dropdown on second click', () => {
      render(<TopicSelector onChange={mockOnChange} />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);
      fireEvent.click(trigger);

      expect(screen.queryByPlaceholderText('Search topics...')).not.toBeInTheDocument();
    });

    it('shows all topics in dropdown', () => {
      render(<TopicSelector onChange={mockOnChange} />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);

      expect(screen.getByText('Soteriology')).toBeInTheDocument();
      expect(screen.getByText('Christology')).toBeInTheDocument();
    });

    it('shows topic path for nested topics', () => {
      render(<TopicSelector onChange={mockOnChange} />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);

      expect(screen.getByText('Soteriology / Justification')).toBeInTheDocument();
      expect(screen.getByText('Soteriology / Sanctification')).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('filters topics based on search', () => {
      render(<TopicSelector onChange={mockOnChange} />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);
      const searchInput = screen.getByPlaceholderText('Search topics...');
      fireEvent.change(searchInput, { target: { value: 'justi' } });

      expect(screen.getByText('Soteriology / Justification')).toBeInTheDocument();
      expect(screen.queryByText('Christology')).not.toBeInTheDocument();
    });

    it('shows empty message when no topics match', () => {
      render(<TopicSelector onChange={mockOnChange} />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);
      const searchInput = screen.getByPlaceholderText('Search topics...');
      fireEvent.change(searchInput, { target: { value: 'xyz' } });

      expect(screen.getByText('No topics found')).toBeInTheDocument();
    });

    it('clears search on selection', () => {
      render(<TopicSelector onChange={mockOnChange} />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);
      const searchInput = screen.getByPlaceholderText('Search topics...');
      fireEvent.change(searchInput, { target: { value: 'sote' } });

      const option = screen.getByText('Soteriology');
      fireEvent.click(option);

      // Dropdown should close, so search input won't be visible
      expect(screen.queryByPlaceholderText('Search topics...')).not.toBeInTheDocument();
    });
  });

  describe('single selection', () => {
    it('calls onChange when topic is selected', () => {
      render(<TopicSelector onChange={mockOnChange} />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);
      fireEvent.click(screen.getByText('Soteriology'));

      expect(mockOnChange).toHaveBeenCalledWith('topic-1');
    });

    it('closes dropdown after selection', () => {
      render(<TopicSelector onChange={mockOnChange} />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);
      fireEvent.click(screen.getByText('Soteriology'));

      expect(screen.queryByPlaceholderText('Search topics...')).not.toBeInTheDocument();
    });

    it('shows checkmark for selected option', () => {
      render(<TopicSelector value="topic-1" onChange={mockOnChange} />);

      const trigger = screen.getByText('Soteriology').closest('button')!;
      fireEvent.click(trigger);

      // Find the option with 'selected' class
      const selectedOptions = screen.getAllByRole('button').filter(
        btn => btn.className.includes('selected')
      );
      expect(selectedOptions.length).toBeGreaterThan(0);
    });

    it('shows inline clear button when value is selected', () => {
      render(<TopicSelector value="topic-1" onChange={mockOnChange} />);

      // Inline clear button should be visible in the trigger
      expect(screen.getByTitle('Clear topic')).toBeInTheDocument();
    });

    it('clears selection when inline clear button is clicked', () => {
      render(<TopicSelector value="topic-1" onChange={mockOnChange} />);

      fireEvent.click(screen.getByTitle('Clear topic'));

      expect(mockOnChange).toHaveBeenCalledWith(null);
    });

    it('shows clear selection in dropdown when value is selected', () => {
      render(<TopicSelector value="topic-1" onChange={mockOnChange} />);

      const trigger = screen.getByText('Soteriology').closest('button')!;
      fireEvent.click(trigger);

      expect(screen.getByText('Clear selection')).toBeInTheDocument();
    });

    it('clears selection when dropdown clear button is clicked', () => {
      render(<TopicSelector value="topic-1" onChange={mockOnChange} />);

      const trigger = screen.getByText('Soteriology').closest('button')!;
      fireEvent.click(trigger);
      fireEvent.click(screen.getByText('Clear selection'));

      expect(mockOnChange).toHaveBeenCalledWith(null);
    });
  });

  describe('multi-selection', () => {
    it('shows placeholder when no selections', () => {
      render(
        <TopicSelector
          multiSelect
          selectedValues={[]}
          onMultiChange={mockOnMultiChange}
        />
      );

      expect(screen.getByText('Select topic...')).toBeInTheDocument();
    });

    it('shows selected topics as tag chips', () => {
      render(
        <TopicSelector
          multiSelect
          selectedValues={['topic-1', 'topic-4']}
          onMultiChange={mockOnMultiChange}
        />
      );

      // Each topic should be in its own chip
      expect(screen.getByText('Soteriology')).toBeInTheDocument();
      expect(screen.getByText('Christology')).toBeInTheDocument();
      // Each chip should have a remove button
      expect(screen.getAllByTitle('Remove tag')).toHaveLength(2);
    });

    it('removes tag when chip remove button is clicked', () => {
      render(
        <TopicSelector
          multiSelect
          selectedValues={['topic-1', 'topic-4']}
          onMultiChange={mockOnMultiChange}
        />
      );

      // Click the remove button on the first chip (Soteriology)
      const removeButtons = screen.getAllByTitle('Remove tag');
      fireEvent.click(removeButtons[0]);

      expect(mockOnMultiChange).toHaveBeenCalledWith(['topic-4']);
    });

    it('calls onMultiChange when topic is selected from dropdown', () => {
      render(
        <TopicSelector
          multiSelect
          selectedValues={['topic-1']}
          onMultiChange={mockOnMultiChange}
        />
      );

      // Open dropdown by clicking the trigger area (chevron)
      const trigger = screen.getByText('Soteriology').closest('button')!;
      fireEvent.click(trigger);
      fireEvent.click(screen.getByText('Christology'));

      expect(mockOnMultiChange).toHaveBeenCalledWith(['topic-1', 'topic-4']);
    });

    it('removes topic when already selected in dropdown', () => {
      render(
        <TopicSelector
          multiSelect
          selectedValues={['topic-1', 'topic-4']}
          onMultiChange={mockOnMultiChange}
        />
      );

      const trigger = screen.getByText('Soteriology').closest('button')!;
      fireEvent.click(trigger);
      // Click on Soteriology option in dropdown to deselect
      const options = screen.getAllByText('Soteriology');
      // The second one should be in the dropdown options
      fireEvent.click(options[options.length - 1]);

      expect(mockOnMultiChange).toHaveBeenCalledWith(['topic-4']);
    });

    it('does not close dropdown after multi-selection', () => {
      render(
        <TopicSelector
          multiSelect
          selectedValues={[]}
          onMultiChange={mockOnMultiChange}
        />
      );

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);
      fireEvent.click(screen.getByText('Soteriology'));

      // Dropdown should remain open
      expect(screen.getByPlaceholderText('Search topics...')).toBeInTheDocument();
    });

    it('does not show clear selection in multi-select mode', () => {
      render(
        <TopicSelector
          multiSelect
          selectedValues={['topic-1']}
          onMultiChange={mockOnMultiChange}
        />
      );

      const trigger = screen.getByText('Soteriology').closest('button')!;
      fireEvent.click(trigger);

      expect(screen.queryByText('Clear selection')).not.toBeInTheDocument();
    });
  });

  describe('create topic', () => {
    it('shows create section when allowCreate is true', () => {
      render(<TopicSelector onChange={mockOnChange} allowCreate />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);

      expect(screen.getByText('Create new topic')).toBeInTheDocument();
    });

    it('hides create section when allowCreate is false', () => {
      render(<TopicSelector onChange={mockOnChange} allowCreate={false} />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);

      expect(screen.queryByText('Create new topic')).not.toBeInTheDocument();
    });

    it('shows create form when create button is clicked', () => {
      render(<TopicSelector onChange={mockOnChange} allowCreate />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);
      fireEvent.click(screen.getByText('Create new topic'));

      expect(screen.getByPlaceholderText('New topic name...')).toBeInTheDocument();
    });

    it('creates topic and selects it', async () => {
      mockCreateTopic.mockResolvedValue({ id: 'new-topic', name: 'New Topic' });

      render(<TopicSelector onChange={mockOnChange} allowCreate />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);
      fireEvent.click(screen.getByText('Create new topic'));

      const input = screen.getByPlaceholderText('New topic name...');
      fireEvent.change(input, { target: { value: 'New Topic' } });
      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(mockCreateTopic).toHaveBeenCalledWith({ name: 'New Topic' });
      });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('new-topic');
      });
    });

    it('creates topic on Enter key', async () => {
      mockCreateTopic.mockResolvedValue({ id: 'new-topic', name: 'New Topic' });

      render(<TopicSelector onChange={mockOnChange} allowCreate />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);
      fireEvent.click(screen.getByText('Create new topic'));

      const input = screen.getByPlaceholderText('New topic name...');
      fireEvent.change(input, { target: { value: 'New Topic' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockCreateTopic).toHaveBeenCalledWith({ name: 'New Topic' });
      });
    });

    it('cancels create on Escape key', () => {
      render(<TopicSelector onChange={mockOnChange} allowCreate />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);
      fireEvent.click(screen.getByText('Create new topic'));

      const input = screen.getByPlaceholderText('New topic name...');
      fireEvent.keyDown(input, { key: 'Escape' });

      // Should hide create form and show create button again
      expect(screen.getByText('Create new topic')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('New topic name...')).not.toBeInTheDocument();
    });

    it('disables Add button when name is empty', () => {
      render(<TopicSelector onChange={mockOnChange} allowCreate />);

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);
      fireEvent.click(screen.getByText('Create new topic'));

      const addButton = screen.getByRole('button', { name: 'Add' });
      expect(addButton).toBeDisabled();
    });
  });

  describe('click outside', () => {
    it('closes dropdown when clicking outside', async () => {
      const { container } = render(
        <div>
          <TopicSelector onChange={mockOnChange} />
          <div data-testid="outside">Outside</div>
        </div>
      );

      const trigger = screen.getByText('Select topic...').closest('button')!;
      fireEvent.click(trigger);
      expect(screen.getByPlaceholderText('Search topics...')).toBeInTheDocument();

      // Simulate click outside
      fireEvent.mouseDown(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search topics...')).not.toBeInTheDocument();
      });
    });
  });
});
