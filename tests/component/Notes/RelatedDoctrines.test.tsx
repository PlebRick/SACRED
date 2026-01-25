import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

describe('RelatedDoctrines', () => {
  // Mock functions and state - defined fresh for each test suite
  let mockSelectEntry: ReturnType<typeof vi.fn>;
  let mockOpenChapter: ReturnType<typeof vi.fn>;
  let mockSystematicState: Record<string, any>;
  let RelatedDoctrines: React.ComponentType;

  beforeAll(async () => {
    // Reset module cache to ensure fresh mock
    vi.resetModules();

    // Create mock functions
    mockSelectEntry = vi.fn();
    mockOpenChapter = vi.fn();

    // Create mutable state
    mockSystematicState = {
      relatedDoctrines: [],
      relatedDoctrinesLoading: false,
      selectEntry: mockSelectEntry,
      openChapter: mockOpenChapter,
      tree: [],
      loading: false,
      error: null,
      selectedEntryId: null,
      selectedEntry: null,
      isPanelOpen: false,
      tags: [],
      searchResults: [],
      searchQuery: '',
      annotations: [],
      annotationsLoading: false,
      closePanel: vi.fn(),
      togglePanel: vi.fn(),
      search: vi.fn(),
      clearSearch: vi.fn(),
      getByTag: vi.fn(),
      addAnnotation: vi.fn(),
      deleteAnnotation: vi.fn(),
      getReferencingNotes: vi.fn(),
      navigateToLink: vi.fn(),
      findChapterInTree: vi.fn(),
    };

    // Mock SystematicContext
    vi.doMock('../../../src/context/SystematicContext', () => ({
      useSystematic: () => mockSystematicState,
    }));

    // Dynamically import the component after setting up mock
    const module = await import('../../../src/components/Notes/RelatedDoctrines');
    RelatedDoctrines = module.RelatedDoctrines;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default state
    mockSystematicState.relatedDoctrines = [];
    mockSystematicState.relatedDoctrinesLoading = false;
    mockSystematicState.selectEntry = mockSelectEntry;
    mockSystematicState.openChapter = mockOpenChapter;
  });

  afterEach(() => {
    cleanup();
    // Clean up mock state after each test
    mockSystematicState.relatedDoctrines = [];
    mockSystematicState.relatedDoctrinesLoading = false;
  });

  afterAll(() => {
    vi.doUnmock('../../../src/context/SystematicContext');
  });

  describe('loading state', () => {
    it('shows loading message when loading', () => {
      mockSystematicState.relatedDoctrinesLoading = true;

      render(<RelatedDoctrines />);

      expect(screen.getByText('Loading related doctrines...')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('returns null when no related doctrines', () => {
      mockSystematicState.relatedDoctrines = [];
      mockSystematicState.relatedDoctrinesLoading = false;

      const { container } = render(<RelatedDoctrines />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('rendering doctrines', () => {
    const mockDoctrines = [
      { id: 'ch-32', chapterNumber: 32, title: 'The Trinity', entryType: 'chapter' },
      { id: 'sec-26-a', chapterNumber: 26, title: 'The Deity of Christ', entryType: 'section', isPrimary: true },
    ];

    beforeEach(() => {
      mockSystematicState.relatedDoctrines = mockDoctrines;
      mockSystematicState.relatedDoctrinesLoading = false;
    });

    it('shows header with count', () => {
      render(<RelatedDoctrines />);

      expect(screen.getByText('Related Doctrines')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Badge with count
    });

    it('displays doctrine items grouped by chapter', () => {
      render(<RelatedDoctrines />);

      expect(screen.getByText('Ch 32')).toBeInTheDocument();
      expect(screen.getByText('The Trinity')).toBeInTheDocument();
      expect(screen.getByText('Ch 26')).toBeInTheDocument();
      expect(screen.getByText('The Deity of Christ')).toBeInTheDocument();
    });

    it('shows "Key" badge for primary doctrines', () => {
      render(<RelatedDoctrines />);

      expect(screen.getByText('Key')).toBeInTheDocument();
    });

    it('is expanded by default', () => {
      render(<RelatedDoctrines />);

      // Should show doctrine content
      expect(screen.getByText('The Trinity')).toBeVisible();
    });
  });

  describe('expand/collapse', () => {
    const mockDoctrines = [
      { id: 'ch-32', chapterNumber: 32, title: 'The Trinity', entryType: 'chapter' },
    ];

    beforeEach(() => {
      mockSystematicState.relatedDoctrines = mockDoctrines;
      mockSystematicState.relatedDoctrinesLoading = false;
    });

    it('collapses when header is clicked', () => {
      render(<RelatedDoctrines />);

      const header = screen.getByRole('button', { name: /Related Doctrines/i });
      fireEvent.click(header);

      // Content should be hidden after collapse
      expect(screen.queryByText('The Trinity')).not.toBeInTheDocument();
    });

    it('expands when collapsed and header is clicked', () => {
      render(<RelatedDoctrines />);

      const header = screen.getByRole('button', { name: /Related Doctrines/i });

      // Collapse
      fireEvent.click(header);
      expect(screen.queryByText('The Trinity')).not.toBeInTheDocument();

      // Expand
      fireEvent.click(header);
      expect(screen.getByText('The Trinity')).toBeVisible();
    });

    it('has expandable chevron icon', () => {
      const { container } = render(<RelatedDoctrines />);

      const chevron = container.querySelector('[class*="chevron"]');
      expect(chevron).toBeInTheDocument();
      // Default is expanded - check for expanded class somewhere in the component
      const expandedElement = container.querySelector('[class*="expanded"]');
      expect(expandedElement).toBeInTheDocument();
    });
  });

  describe('click interactions', () => {
    it('calls openChapter for chapter-type doctrines', () => {
      mockSystematicState.relatedDoctrines = [
        { id: 'ch-32', chapterNumber: 32, title: 'The Trinity', entryType: 'chapter' },
      ];

      render(<RelatedDoctrines />);

      const doctrineButton = screen.getByRole('button', { name: /Ch 32/i });
      fireEvent.click(doctrineButton);

      expect(mockOpenChapter).toHaveBeenCalledWith(32);
      expect(mockSelectEntry).not.toHaveBeenCalled();
    });

    it('calls selectEntry for non-chapter doctrines', () => {
      mockSystematicState.relatedDoctrines = [
        { id: 'sec-32-a', chapterNumber: 32, title: 'Section A', entryType: 'section', sectionLetter: 'A' },
      ];

      render(<RelatedDoctrines />);

      const doctrineButton = screen.getByRole('button', { name: /Ch 32/i });
      fireEvent.click(doctrineButton);

      expect(mockSelectEntry).toHaveBeenCalledWith('sec-32-a');
      expect(mockOpenChapter).not.toHaveBeenCalled();
    });
  });

  describe('context snippet', () => {
    it('displays context snippet when available', () => {
      mockSystematicState.relatedDoctrines = [
        {
          id: 'ch-32',
          chapterNumber: 32,
          title: 'The Trinity',
          entryType: 'chapter',
          contextSnippet: 'Referenced in verse 1',
        },
      ];

      render(<RelatedDoctrines />);

      expect(screen.getByText('Referenced in verse 1')).toBeInTheDocument();
    });

    it('does not render snippet element when not available', () => {
      mockSystematicState.relatedDoctrines = [
        { id: 'ch-32', chapterNumber: 32, title: 'The Trinity', entryType: 'chapter' },
      ];

      const { container } = render(<RelatedDoctrines />);

      expect(container.querySelector('[class*="contextSnippet"]')).not.toBeInTheDocument();
    });
  });

  describe('grouping by chapter', () => {
    it('groups multiple entries from same chapter', () => {
      mockSystematicState.relatedDoctrines = [
        { id: 'ch-32', chapterNumber: 32, title: 'The Trinity', entryType: 'chapter' },
        { id: 'sec-32-a', chapterNumber: 32, title: 'Section A', entryType: 'section' },
      ];

      render(<RelatedDoctrines />);

      // Should only show one chapter badge since they're grouped
      const chapterBadges = screen.getAllByText('Ch 32');
      expect(chapterBadges).toHaveLength(1);
    });

    it('uses chapter-level doctrine title when available', () => {
      mockSystematicState.relatedDoctrines = [
        { id: 'ch-32', chapterNumber: 32, title: 'The Trinity', entryType: 'chapter' },
        { id: 'sec-32-a', chapterNumber: 32, title: 'God is Three Persons', entryType: 'section' },
      ];

      render(<RelatedDoctrines />);

      // Should show chapter-level title, not section title
      expect(screen.getByText('The Trinity')).toBeInTheDocument();
      expect(screen.queryByText('God is Three Persons')).not.toBeInTheDocument();
    });
  });
});
