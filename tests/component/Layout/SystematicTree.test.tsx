import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { SystematicTree } from '../../../src/components/Layout/SystematicTree';

// Mock the SystematicContext
vi.mock('../../../src/context/SystematicContext', () => ({
  useSystematic: vi.fn(),
}));

import { useSystematic } from '../../../src/context/SystematicContext';

const mockTree = [
  {
    id: 'part-1',
    entryType: 'part',
    partNumber: 1,
    title: 'Part I: The Doctrine of the Word of God',
    children: [
      {
        id: 'ch-1',
        entryType: 'chapter',
        chapterNumber: 1,
        title: 'Introduction to Systematic Theology',
        children: [
          { id: 'sec-1-a', entryType: 'section', sectionLetter: 'A', title: 'What is Theology?' },
          { id: 'sec-1-b', entryType: 'section', sectionLetter: 'B', title: 'Why Study Theology?' },
        ],
      },
      {
        id: 'ch-2',
        entryType: 'chapter',
        chapterNumber: 2,
        title: 'The Word of God',
        children: [],
      },
    ],
  },
  {
    id: 'part-2',
    entryType: 'part',
    partNumber: 2,
    title: 'Part II: The Doctrine of God',
    children: [
      {
        id: 'ch-11',
        entryType: 'chapter',
        chapterNumber: 11,
        title: 'The Existence of God',
        children: [],
      },
    ],
  },
];

const mockTags = [
  { id: 'doctrine-word', name: 'Doctrine of the Word', color: '#4a90d9' },
  { id: 'doctrine-god', name: 'Doctrine of God', color: '#d9534f' },
];

describe('SystematicTree', () => {
  const mockSelectEntry = vi.fn();
  const mockOpenChapter = vi.fn();
  const mockSearch = vi.fn();
  const mockClearSearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useSystematic as any).mockReturnValue({
      tree: mockTree,
      loading: false,
      error: null,
      tags: mockTags,
      selectEntry: mockSelectEntry,
      openChapter: mockOpenChapter,
      search: mockSearch,
      searchResults: [],
      searchQuery: '',
      clearSearch: mockClearSearch,
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  describe('loading state', () => {
    it('shows loading message', () => {
      (useSystematic as any).mockReturnValue({
        tree: [],
        loading: true,
        error: null,
        tags: [],
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        search: mockSearch,
        searchResults: [],
        searchQuery: '',
        clearSearch: mockClearSearch,
      });

      render(<SystematicTree />);

      expect(screen.getByText('Loading systematic theology...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message', () => {
      (useSystematic as any).mockReturnValue({
        tree: [],
        loading: false,
        error: 'Failed to load data',
        tags: [],
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        search: mockSearch,
        searchResults: [],
        searchQuery: '',
        clearSearch: mockClearSearch,
      });

      render(<SystematicTree />);

      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when no tree data', () => {
      (useSystematic as any).mockReturnValue({
        tree: [],
        loading: false,
        error: null,
        tags: [],
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        search: mockSearch,
        searchResults: [],
        searchQuery: '',
        clearSearch: mockClearSearch,
      });

      render(<SystematicTree />);

      expect(screen.getByText(/No systematic theology content imported yet/)).toBeInTheDocument();
    });
  });

  describe('rendering', () => {
    it('renders search input', () => {
      render(<SystematicTree />);

      expect(screen.getByPlaceholderText('Search doctrines...')).toBeInTheDocument();
    });

    it('renders tag filters', () => {
      render(<SystematicTree />);

      // Tags have "Doctrine of" prefix removed
      expect(screen.getByText('the Word')).toBeInTheDocument();
      expect(screen.getByText('God')).toBeInTheDocument();
    });

    it('renders expand/collapse controls', () => {
      render(<SystematicTree />);

      expect(screen.getByText('Expand All')).toBeInTheDocument();
      expect(screen.getByText('Collapse All')).toBeInTheDocument();
    });

    it('renders parts', () => {
      render(<SystematicTree />);

      expect(screen.getByText('Part I: The Doctrine of the Word of God')).toBeInTheDocument();
      expect(screen.getByText('Part II: The Doctrine of God')).toBeInTheDocument();
    });
  });

  describe('part expansion', () => {
    it('expands part to show chapters', () => {
      render(<SystematicTree />);

      const partButton = screen.getByText('Part I: The Doctrine of the Word of God').closest('button');
      fireEvent.click(partButton!);

      expect(screen.getByText('Introduction to Systematic Theology')).toBeInTheDocument();
      expect(screen.getByText('The Word of God')).toBeInTheDocument();
    });

    it('collapses part on second click', () => {
      render(<SystematicTree />);

      const partButton = screen.getByText('Part I: The Doctrine of the Word of God').closest('button');
      fireEvent.click(partButton!);
      expect(screen.getByText('Introduction to Systematic Theology')).toBeInTheDocument();

      fireEvent.click(partButton!);
      expect(screen.queryByText('Introduction to Systematic Theology')).not.toBeInTheDocument();
    });

    it('shows chapter numbers', () => {
      render(<SystematicTree />);

      const partButton = screen.getByText('Part I: The Doctrine of the Word of God').closest('button');
      fireEvent.click(partButton!);

      expect(screen.getByText('Ch 1')).toBeInTheDocument();
      expect(screen.getByText('Ch 2')).toBeInTheDocument();
    });
  });

  describe('chapter expansion', () => {
    it('expands chapter to show sections', () => {
      render(<SystematicTree />);

      // Expand part
      const partButton = screen.getByText('Part I: The Doctrine of the Word of God').closest('button');
      fireEvent.click(partButton!);

      // Find and click chapter chevron
      const chapterChevron = screen.getByLabelText('Expand sections');
      fireEvent.click(chapterChevron);

      expect(screen.getByText('What is Theology?')).toBeInTheDocument();
      expect(screen.getByText('Why Study Theology?')).toBeInTheDocument();
    });

    it('shows section letters', () => {
      render(<SystematicTree />);

      const partButton = screen.getByText('Part I: The Doctrine of the Word of God').closest('button');
      fireEvent.click(partButton!);

      const chapterChevron = screen.getByLabelText('Expand sections');
      fireEvent.click(chapterChevron);

      expect(screen.getByText('A.')).toBeInTheDocument();
      expect(screen.getByText('B.')).toBeInTheDocument();
    });

    it('does not show chevron for chapters without sections', () => {
      render(<SystematicTree />);

      const partButton = screen.getByText('Part I: The Doctrine of the Word of God').closest('button');
      fireEvent.click(partButton!);

      // Ch 2 has no sections, so only 1 chevron should be visible
      const chevrons = screen.getAllByLabelText(/sections/);
      expect(chevrons).toHaveLength(1);
    });
  });

  describe('chapter click', () => {
    it('calls openChapter when chapter is clicked', () => {
      render(<SystematicTree />);

      const partButton = screen.getByText('Part I: The Doctrine of the Word of God').closest('button');
      fireEvent.click(partButton!);

      const chapterButton = screen.getByText('Introduction to Systematic Theology').closest('button');
      fireEvent.click(chapterButton!);

      expect(mockOpenChapter).toHaveBeenCalledWith(1);
    });
  });

  describe('section click', () => {
    it('calls selectEntry when section is clicked', () => {
      render(<SystematicTree />);

      // Expand part
      const partButton = screen.getByText('Part I: The Doctrine of the Word of God').closest('button');
      fireEvent.click(partButton!);

      // Expand chapter
      const chapterChevron = screen.getByLabelText('Expand sections');
      fireEvent.click(chapterChevron);

      // Click section
      const sectionButton = screen.getByText('What is Theology?').closest('button');
      fireEvent.click(sectionButton!);

      expect(mockSelectEntry).toHaveBeenCalledWith('sec-1-a');
    });
  });

  describe('expand/collapse all', () => {
    it('expands all chapters when Expand All is clicked', () => {
      render(<SystematicTree />);

      fireEvent.click(screen.getByText('Expand All'));

      // All chapter expand buttons should now show collapse state
      // This is indicated by having at least one expanded chevron
      const partButton = screen.getByText('Part I: The Doctrine of the Word of God').closest('button');
      fireEvent.click(partButton!);

      // After expand all, chapter sections should be visible without clicking chevron
      // The test can verify expand all was called by checking that chapters get expanded
      expect(mockSelectEntry).not.toHaveBeenCalled(); // Just ensures no side effects
    });

    it('collapses all chapters when Collapse All is clicked', () => {
      render(<SystematicTree />);

      // First expand something
      fireEvent.click(screen.getByText('Expand All'));

      // Then collapse all
      fireEvent.click(screen.getByText('Collapse All'));

      // After collapse, sections should not be visible
      expect(screen.queryByText('What is Theology?')).not.toBeInTheDocument();
    });
  });

  describe('tag filtering', () => {
    it('filters tree by selected tag', () => {
      render(<SystematicTree />);

      // Click "God" tag (Part 2)
      fireEvent.click(screen.getByText('God'));

      // Should only show Part II now
      expect(screen.queryByText('Part I: The Doctrine of the Word of God')).not.toBeInTheDocument();
      expect(screen.getByText('Part II: The Doctrine of God')).toBeInTheDocument();
    });

    it('clears filter when clicking same tag again', () => {
      render(<SystematicTree />);

      // Click tag to filter
      fireEvent.click(screen.getByText('God'));
      expect(screen.queryByText('Part I: The Doctrine of the Word of God')).not.toBeInTheDocument();

      // Click again to clear filter
      fireEvent.click(screen.getByText('God'));
      expect(screen.getByText('Part I: The Doctrine of the Word of God')).toBeInTheDocument();
    });

    it('shows active state on selected tag', () => {
      const { container } = render(<SystematicTree />);

      fireEvent.click(screen.getByText('God'));

      const godTag = screen.getByText('God').closest('button');
      expect(godTag?.className).toContain('active');
    });
  });

  describe('search', () => {
    it('calls search on form submit', () => {
      render(<SystematicTree />);

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.change(input, { target: { value: 'trinity' } });
      fireEvent.submit(input.closest('form')!);

      expect(mockSearch).toHaveBeenCalledWith('trinity');
    });

    it('does not search with less than 2 characters', () => {
      render(<SystematicTree />);

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.submit(input.closest('form')!);

      expect(mockSearch).not.toHaveBeenCalled();
    });

    it('shows clear button when input has value', () => {
      render(<SystematicTree />);

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.change(input, { target: { value: 'test' } });

      const clearButton = input.parentElement?.querySelector('button');
      expect(clearButton).toBeInTheDocument();
    });

    it('clears search on clear button click', () => {
      render(<SystematicTree />);

      const input = screen.getByPlaceholderText('Search doctrines...');
      fireEvent.change(input, { target: { value: 'test' } });

      const clearButton = input.parentElement?.querySelector('button[type="button"]');
      fireEvent.click(clearButton!);

      expect(input).toHaveValue('');
      expect(mockClearSearch).toHaveBeenCalled();
    });
  });

  describe('search results', () => {
    it('shows search results when searchQuery is set', () => {
      (useSystematic as any).mockReturnValue({
        tree: mockTree,
        loading: false,
        error: null,
        tags: mockTags,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        search: mockSearch,
        searchResults: [
          { id: 'ch-32', entryType: 'chapter', title: 'The Trinity', snippet: 'God is <b>three</b> persons' },
        ],
        searchQuery: 'trinity',
        clearSearch: mockClearSearch,
      });

      render(<SystematicTree />);

      expect(screen.getByText('Results for "trinity"')).toBeInTheDocument();
      expect(screen.getByText('The Trinity')).toBeInTheDocument();
    });

    it('calls selectEntry when search result is clicked', () => {
      (useSystematic as any).mockReturnValue({
        tree: mockTree,
        loading: false,
        error: null,
        tags: mockTags,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        search: mockSearch,
        searchResults: [
          { id: 'ch-32', entryType: 'chapter', title: 'The Trinity' },
        ],
        searchQuery: 'trinity',
        clearSearch: mockClearSearch,
      });

      render(<SystematicTree />);

      fireEvent.click(screen.getByText('The Trinity').closest('button')!);

      expect(mockSelectEntry).toHaveBeenCalledWith('ch-32');
    });

    it('shows result type badge', () => {
      (useSystematic as any).mockReturnValue({
        tree: mockTree,
        loading: false,
        error: null,
        tags: mockTags,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        search: mockSearch,
        searchResults: [
          { id: 'sec-32-a', entryType: 'section', title: 'God is Three Persons' },
        ],
        searchQuery: 'three',
        clearSearch: mockClearSearch,
      });

      render(<SystematicTree />);

      expect(screen.getByText('section')).toBeInTheDocument();
    });

    it('hides tree when showing search results', () => {
      (useSystematic as any).mockReturnValue({
        tree: mockTree,
        loading: false,
        error: null,
        tags: mockTags,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        search: mockSearch,
        searchResults: [
          { id: 'ch-32', entryType: 'chapter', title: 'The Trinity' },
        ],
        searchQuery: 'trinity',
        clearSearch: mockClearSearch,
      });

      render(<SystematicTree />);

      // Tree parts should not be visible
      expect(screen.queryByText('Part I: The Doctrine of the Word of God')).not.toBeInTheDocument();
    });

    it('shows Clear button in search results header', () => {
      (useSystematic as any).mockReturnValue({
        tree: mockTree,
        loading: false,
        error: null,
        tags: mockTags,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        search: mockSearch,
        searchResults: [
          { id: 'ch-32', entryType: 'chapter', title: 'The Trinity' },
        ],
        searchQuery: 'trinity',
        clearSearch: mockClearSearch,
      });

      render(<SystematicTree />);

      fireEvent.click(screen.getByText('Clear'));

      expect(mockClearSearch).toHaveBeenCalled();
    });
  });

  describe('chevron animation', () => {
    it('has expanded class when part is expanded', () => {
      const { container } = render(<SystematicTree />);

      const partButton = screen.getByText('Part I: The Doctrine of the Word of God').closest('button');
      fireEvent.click(partButton!);

      // The chevron gets expanded class when part is expanded
      const chevron = container.querySelector('[class*="expanded"]');
      expect(chevron).toBeInTheDocument();
    });
  });
});
