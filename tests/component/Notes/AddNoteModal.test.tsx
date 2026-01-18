import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import AddNoteModal from '../../../src/components/Notes/AddNoteModal';
import { BibleProvider } from '../../../src/context/BibleContext';

// Mock TopicsContext
vi.mock('../../../src/context/TopicsContext', () => ({
  useTopics: () => ({
    topics: [],
    flatTopics: [],
    loading: false,
    error: null,
    selectedTopicId: null,
    createTopic: vi.fn(),
    updateTopic: vi.fn(),
    deleteTopic: vi.fn(),
    setSelectedTopic: vi.fn(),
    refreshTopics: vi.fn(),
    seedDefaultTopics: vi.fn(),
    getTopicById: vi.fn().mockReturnValue(null),
    getTopicPath: vi.fn().mockReturnValue([]),
  }),
}));

// Wrapper component with BibleProvider
function renderWithProviders(ui: React.ReactElement) {
  return render(<BibleProvider>{ui}</BibleProvider>);
}

describe('AddNoteModal', () => {
  const mockOnClose = vi.fn();
  const mockOnCreateNote = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockOnCreateNote.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  describe('rendering', () => {
    it('renders when open', () => {
      renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
        />
      );

      expect(screen.getByText('Add New Note')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g., Romans 1:1-7')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      renderWithProviders(
        <AddNoteModal
          isOpen={false}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
        />
      );

      expect(screen.queryByText('Add New Note')).not.toBeInTheDocument();
    });

    it('renders with commentary type', () => {
      renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
          noteType="commentary"
        />
      );

      expect(screen.getByText('Add New Commentary')).toBeInTheDocument();
    });

    it('renders with sermon type', () => {
      renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
          noteType="sermon"
        />
      );

      expect(screen.getByText('Add New Sermon')).toBeInTheDocument();
    });
  });

  describe('pre-filling', () => {
    it('pre-fills input from current Bible location', async () => {
      renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
        />
      );

      // Default location is John 1
      const input = screen.getByPlaceholderText('e.g., Romans 1:1-7') as HTMLInputElement;
      await waitFor(() => {
        expect(input.value).toBe('John 1:1');
      });
    });
  });

  describe('validation', () => {
    it('shows error for invalid reference', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
        />
      );

      const input = screen.getByPlaceholderText('e.g., Romans 1:1-7');
      await user.clear(input);
      await user.type(input, 'invalid reference');
      await user.click(screen.getByText('Create Note'));

      expect(screen.getByText(/Invalid verse reference/)).toBeInTheDocument();
      expect(mockOnCreateNote).not.toHaveBeenCalled();
    });

    it('shows error for whole chapter reference', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
        />
      );

      const input = screen.getByPlaceholderText('e.g., Romans 1:1-7');
      await user.clear(input);
      await user.type(input, 'Romans 1');
      await user.click(screen.getByText('Create Note'));

      expect(screen.getByText(/Please specify a verse/)).toBeInTheDocument();
      expect(mockOnCreateNote).not.toHaveBeenCalled();
    });

    it('clears error when input changes', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
        />
      );

      const input = screen.getByPlaceholderText('e.g., Romans 1:1-7');
      await user.clear(input);
      await user.type(input, 'invalid');
      await user.click(screen.getByText('Create Note'));

      expect(screen.getByText(/Invalid verse reference/)).toBeInTheDocument();

      await user.type(input, ' something');
      expect(screen.queryByText(/Invalid verse reference/)).not.toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('calls onCreateNote with parsed data', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
        />
      );

      const input = screen.getByPlaceholderText('e.g., Romans 1:1-7');
      await user.clear(input);
      await user.type(input, 'Romans 1:1-7');
      await user.click(screen.getByText('Create Note'));

      await waitFor(() => {
        expect(mockOnCreateNote).toHaveBeenCalledWith({
          book: 'ROM',
          startChapter: 1,
          startVerse: 1,
          endChapter: 1,
          endVerse: 7,
          title: '',
          content: '',
          type: 'note',
          primaryTopicId: null,
          tags: [],
        });
      });
    });

    it('closes modal after successful creation', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
        />
      );

      const input = screen.getByPlaceholderText('e.g., Romans 1:1-7');
      await user.clear(input);
      await user.type(input, 'Romans 1:1');
      await user.click(screen.getByText('Create Note'));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('shows error when creation fails', async () => {
      mockOnCreateNote.mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();

      renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
        />
      );

      const input = screen.getByPlaceholderText('e.g., Romans 1:1-7');
      await user.clear(input);
      await user.type(input, 'Romans 1:1');
      await user.click(screen.getByText('Create Note'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to create note/)).toBeInTheDocument();
      });
    });
  });

  describe('closing', () => {
    it('closes on Cancel button click', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
        />
      );

      await user.click(screen.getByText('Cancel'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes on Escape key', async () => {
      renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
        />
      );

      const modal = screen.getByText('Add New Note').closest('div');
      fireEvent.keyDown(modal!, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes on overlay click', async () => {
      const user = userEvent.setup();

      const { container } = renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
        />
      );

      // Find the overlay (first child of container is the overlay div)
      const overlay = container.firstChild as HTMLElement;
      await user.click(overlay);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes on close button click', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AddNoteModal
          isOpen={true}
          onClose={mockOnClose}
          onCreateNote={mockOnCreateNote}
        />
      );

      await user.click(screen.getByLabelText('Close modal'));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
