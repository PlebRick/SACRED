import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import React from 'react';
import { InsertDoctrineModal } from '../../../src/components/Notes/InsertDoctrineModal';

// Mock the SystematicContext
vi.mock('../../../src/context/SystematicContext', () => ({
  useSystematic: vi.fn(),
}));

import { useSystematic } from '../../../src/context/SystematicContext';

const mockTree = [
  {
    id: 'part-1',
    entryType: 'part',
    children: [
      { id: 'ch-31', entryType: 'chapter', chapterNumber: 31, title: 'The Character of God', children: [] },
      { id: 'ch-32', entryType: 'chapter', chapterNumber: 32, title: 'The Trinity', children: [] },
    ],
  },
];

const mockRelatedDoctrines = [
  { id: 'ch-32', entryType: 'chapter', chapterNumber: 32, title: 'The Trinity', isPrimary: true },
];

describe('InsertDoctrineModal', () => {
  const mockOnClose = vi.fn();
  const mockOnInsert = vi.fn();
  const mockSearch = vi.fn();
  const mockOpenChapter = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (useSystematic as any).mockReturnValue({
      search: mockSearch,
      tree: mockTree,
      relatedDoctrines: mockRelatedDoctrines,
      openChapter: mockOpenChapter,
    });
    mockSearch.mockResolvedValue([]);

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.resetModules();
  });

  describe('rendering', () => {
    it('returns null when not open', () => {
      const { container } = render(
        <InsertDoctrineModal isOpen={false} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders modal when open', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      expect(screen.getByText('Insert Doctrine Link')).toBeInTheDocument();
    });

    it('shows keyboard shortcut hint', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      expect(screen.getByText('Cmd')).toBeInTheDocument();
      expect(screen.getByText('Shift')).toBeInTheDocument();
      expect(screen.getByText('D')).toBeInTheDocument();
    });

    it('shows search input with placeholder', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      expect(screen.getByPlaceholderText('Search doctrines...')).toBeInTheDocument();
    });

    it('shows navigation hints in footer', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      expect(screen.getByText(/to navigate/i)).toBeInTheDocument();
      expect(screen.getByText(/to select/i)).toBeInTheDocument();
      expect(screen.getByText(/to close/i)).toBeInTheDocument();
    });
  });

  describe('suggestions', () => {
    it('shows related doctrines section', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      expect(screen.getByText('Related to Current Passage')).toBeInTheDocument();
    });

    it('shows related doctrine from context', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      expect(screen.getByText('The Trinity')).toBeInTheDocument();
      expect(screen.getByText('Ch 32')).toBeInTheDocument();
    });

    it('shows "Key" badge for primary doctrines', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      expect(screen.getByText('Key')).toBeInTheDocument();
    });

    it('shows browse chapters section', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      expect(screen.getByText('Browse Chapters')).toBeInTheDocument();
    });

    it('shows first chapters from tree', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      expect(screen.getByText('The Character of God')).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('performs search after debounce delay', async () => {
      const searchResults = [
        { id: 'ch-35', chapterNumber: 35, title: 'Justification', entryType: 'chapter' },
      ];
      mockSearch.mockResolvedValue(searchResults);

      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.change(input, { target: { value: 'justification' } });

      // Wait for debounce
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalledWith('justification');
      });
    });

    it('does not search with less than 2 characters', async () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.change(input, { target: { value: 'a' } });

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(mockSearch).not.toHaveBeenCalled();
    });

    it('shows search results', async () => {
      const searchResults = [
        { id: 'ch-35', chapterNumber: 35, title: 'Justification', entryType: 'chapter', summary: 'About justification' },
      ];
      mockSearch.mockResolvedValue(searchResults);

      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.change(input, { target: { value: 'justification' } });

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      await waitFor(() => {
        expect(screen.getByText('Justification')).toBeInTheDocument();
      });
    });

    it('shows empty state when no results found', async () => {
      mockSearch.mockResolvedValue([]);

      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.change(input, { target: { value: 'xyz' } });

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      await waitFor(() => {
        expect(screen.getByText('No doctrines found for "xyz"')).toBeInTheDocument();
      });
    });

    it('shows spinner while searching', async () => {
      mockSearch.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 1000)));

      const { container } = render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.change(input, { target: { value: 'test' } });

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(container.querySelector('[class*="spinner"]')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('inserts chapter link on click', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      // Click on a suggested doctrine
      const doctrineButton = screen.getAllByRole('button').find(b => b.textContent?.includes('The Trinity'));
      fireEvent.click(doctrineButton!);

      expect(mockOnInsert).toHaveBeenCalledWith('[[ST:Ch32]]', 'The Trinity');
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('builds correct link for section', async () => {
      const sectionResult = {
        id: 'sec-32-a',
        chapterNumber: 32,
        sectionLetter: 'A',
        title: 'God is Three Persons',
        entryType: 'section',
      };
      mockSearch.mockResolvedValue([sectionResult]);

      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.change(input, { target: { value: 'three persons' } });

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      await waitFor(() => {
        expect(screen.getByText('God is Three Persons')).toBeInTheDocument();
      });

      const sectionButton = screen.getByText('God is Three Persons').closest('button');
      fireEvent.click(sectionButton!);

      expect(mockOnInsert).toHaveBeenCalledWith('[[ST:Ch32:A]]', 'God is Three Persons');
    });

    it('builds correct link for subsection', async () => {
      const subsectionResult = {
        id: 'subsec-32-a-1',
        chapterNumber: 32,
        sectionLetter: 'A',
        subsectionNumber: 1,
        title: 'Biblical Evidence',
        entryType: 'subsection',
      };
      mockSearch.mockResolvedValue([subsectionResult]);

      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.change(input, { target: { value: 'biblical evidence' } });

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      await waitFor(() => {
        expect(screen.getByText('Biblical Evidence')).toBeInTheDocument();
      });

      const subsectionButton = screen.getByText('Biblical Evidence').closest('button');
      fireEvent.click(subsectionButton!);

      expect(mockOnInsert).toHaveBeenCalledWith('[[ST:Ch32:A.1]]', 'Biblical Evidence');
    });
  });

  describe('keyboard navigation', () => {
    it('closes on Escape key', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('selects on Enter key', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should select first item (related doctrine - The Trinity)
      expect(mockOnInsert).toHaveBeenCalledWith('[[ST:Ch32]]', 'The Trinity');
    });

    it('navigates down with ArrowDown', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const input = screen.getByPlaceholderText('Search doctrines...');

      // First item is selected by default, navigate to second
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should select second item (first chapter - The Character of God)
      expect(mockOnInsert).toHaveBeenCalledWith('[[ST:Ch31]]', 'The Character of God');
    });

    it('navigates up with ArrowUp', () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const input = screen.getByPlaceholderText('Search doctrines...');

      // Navigate down then back up
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should select first item again
      expect(mockOnInsert).toHaveBeenCalledWith('[[ST:Ch32]]', 'The Trinity');
    });
  });

  describe('overlay interaction', () => {
    it('closes when clicking overlay', () => {
      const { container } = render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const overlay = container.querySelector('[class*="overlay"]');
      fireEvent.click(overlay!);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not close when clicking modal content', () => {
      const { container } = render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const modal = container.querySelector('[class*="modal"]');
      fireEvent.click(modal!);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('focus management', () => {
    it('focuses input when opened', async () => {
      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const input = screen.getByPlaceholderText('Search doctrines...');

      // React may need a tick to focus
      await waitFor(() => {
        expect(document.activeElement).toBe(input);
      });
    });

    it('resets state when reopened', () => {
      const { rerender } = render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.change(input, { target: { value: 'test' } });

      // Close
      rerender(
        <InsertDoctrineModal isOpen={false} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      // Reopen
      rerender(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      const newInput = screen.getByPlaceholderText('Search doctrines...');
      expect(newInput).toHaveValue('');
    });
  });

  describe('empty tree state', () => {
    it('shows empty state when no tree data', () => {
      (useSystematic as any).mockReturnValue({
        search: mockSearch,
        tree: [],
        relatedDoctrines: [],
        openChapter: mockOpenChapter,
      });

      render(
        <InsertDoctrineModal isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
      );

      expect(screen.getByText('No systematic theology content imported yet.')).toBeInTheDocument();
    });
  });
});
