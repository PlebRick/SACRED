import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { SystematicPanel } from '../../../src/components/Systematic/SystematicPanel';

// Mock the contexts
vi.mock('../../../src/context/SystematicContext', () => ({
  useSystematic: vi.fn(),
}));

vi.mock('../../../src/context/BibleContext', () => ({
  useBible: vi.fn(),
}));

import { useSystematic } from '../../../src/context/SystematicContext';
import { useBible } from '../../../src/context/BibleContext';

const mockEntry = {
  id: 'ch-32',
  entryType: 'chapter',
  partNumber: 4,
  chapterNumber: 32,
  title: 'The Trinity',
  summary: 'God eternally exists as three persons.',
  content: '<p>The doctrine of the Trinity...</p>',
  sections: [
    {
      id: 'sec-32-a',
      entryType: 'section',
      sectionLetter: 'A',
      title: 'God is Three Persons',
      content: '<p>Scripture reveals three distinct persons...</p>',
    },
  ],
  scriptureReferences: [
    { book: 'JHN', chapter: 1, startVerse: 1, endVerse: 3, isPrimary: true },
    { book: 'MAT', chapter: 28, startVerse: 19, endVerse: null, isPrimary: true },
  ],
  relatedChapters: [
    { chapterNumber: 26, title: 'The Deity of Christ' },
    { chapterNumber: 30, title: 'The Work of the Holy Spirit' },
  ],
  tags: [
    { id: 'doctrine-god', name: 'Doctrine of God', color: '#4a90d9' },
  ],
};

describe('SystematicPanel', () => {
  const mockClosePanel = vi.fn();
  const mockSelectEntry = vi.fn();
  const mockOpenChapter = vi.fn();
  const mockGetReferencingNotes = vi.fn();
  const mockAddAnnotation = vi.fn();
  const mockDeleteAnnotation = vi.fn();
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useSystematic as any).mockReturnValue({
      isPanelOpen: true,
      selectedEntry: mockEntry,
      closePanel: mockClosePanel,
      selectEntry: mockSelectEntry,
      openChapter: mockOpenChapter,
      getReferencingNotes: mockGetReferencingNotes,
      annotations: [],
      addAnnotation: mockAddAnnotation,
      deleteAnnotation: mockDeleteAnnotation,
    });
    (useBible as any).mockReturnValue({
      navigate: mockNavigate,
    });
    mockGetReferencingNotes.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  describe('visibility', () => {
    it('returns null when panel is not open', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: false,
        selectedEntry: mockEntry,
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      const { container } = render(<SystematicPanel />);

      expect(container.firstChild).toBeNull();
    });

    it('returns null when no entry is selected', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: null,
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      const { container } = render(<SystematicPanel />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('header', () => {
    it('renders close button', () => {
      render(<SystematicPanel />);

      const closeButton = screen.getAllByRole('button')[0];
      fireEvent.click(closeButton);

      expect(mockClosePanel).toHaveBeenCalled();
    });

    it('renders breadcrumb', () => {
      render(<SystematicPanel />);

      expect(screen.getByText('Part 4')).toBeInTheDocument();
      expect(screen.getByText('Ch 32')).toBeInTheDocument();
    });

    it('renders title', () => {
      render(<SystematicPanel />);

      expect(screen.getByRole('heading', { name: 'The Trinity' })).toBeInTheDocument();
    });

    it('renders link syntax', () => {
      render(<SystematicPanel />);

      expect(screen.getByText('[[ST:Ch32]]')).toBeInTheDocument();
    });

    it('has copy button for link syntax', () => {
      render(<SystematicPanel />);

      const copyButton = screen.getByTitle('Copy link');
      expect(copyButton).toBeInTheDocument();
    });
  });

  describe('navigation buttons', () => {
    it('renders previous and next buttons', () => {
      render(<SystematicPanel />);

      expect(screen.getByTitle('Previous')).toBeInTheDocument();
      expect(screen.getByTitle('Next')).toBeInTheDocument();
    });

    it('navigates to first section on next click', () => {
      render(<SystematicPanel />);

      fireEvent.click(screen.getByTitle('Next'));

      expect(mockSelectEntry).toHaveBeenCalledWith('sec-32-a');
    });

    it('disables next when no sections', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: { ...mockEntry, sections: [] },
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      expect(screen.getByTitle('Next')).toBeDisabled();
    });
  });

  describe('content', () => {
    it('renders summary', () => {
      render(<SystematicPanel />);

      expect(screen.getByText('God eternally exists as three persons.')).toBeInTheDocument();
    });

    it('renders main content', () => {
      render(<SystematicPanel />);

      expect(screen.getByText(/The doctrine of the Trinity/)).toBeInTheDocument();
    });

    it('renders sections with headers', () => {
      render(<SystematicPanel />);

      expect(screen.getByText('A. God is Three Persons')).toBeInTheDocument();
    });

    it('renders section content', () => {
      render(<SystematicPanel />);

      expect(screen.getByText(/Scripture reveals three distinct persons/)).toBeInTheDocument();
    });
  });

  describe('scripture references', () => {
    it('renders scripture references section', () => {
      render(<SystematicPanel />);

      expect(screen.getByText('Key Scripture References')).toBeInTheDocument();
    });

    it('shows primary reference count', () => {
      render(<SystematicPanel />);

      // Should show badge with count of 2 primary refs
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders scripture reference buttons', () => {
      render(<SystematicPanel />);

      expect(screen.getByText('JHN 1:1-3')).toBeInTheDocument();
      expect(screen.getByText('MAT 28:19')).toBeInTheDocument();
    });

    it('navigates to scripture on click', () => {
      render(<SystematicPanel />);

      fireEvent.click(screen.getByText('JHN 1:1-3'));

      expect(mockNavigate).toHaveBeenCalledWith('JHN', 1);
    });
  });

  describe('related chapters', () => {
    it('renders related chapters section', () => {
      render(<SystematicPanel />);

      expect(screen.getByText('See Also')).toBeInTheDocument();
    });

    it('renders related chapter buttons', () => {
      render(<SystematicPanel />);

      expect(screen.getByText('The Deity of Christ')).toBeInTheDocument();
      expect(screen.getByText('The Work of the Holy Spirit')).toBeInTheDocument();
    });

    it('opens related chapter on click', () => {
      render(<SystematicPanel />);

      fireEvent.click(screen.getByText('The Deity of Christ').closest('button')!);

      expect(mockOpenChapter).toHaveBeenCalledWith(26);
    });
  });

  describe('tags', () => {
    it('renders tags', () => {
      render(<SystematicPanel />);

      expect(screen.getByText('Doctrine of God')).toBeInTheDocument();
    });
  });

  describe('referencing notes', () => {
    it('renders referencing notes section', () => {
      render(<SystematicPanel />);

      expect(screen.getByText('Your Notes Referencing This')).toBeInTheDocument();
    });

    it('shows empty message when no notes', async () => {
      render(<SystematicPanel />);

      await waitFor(() => {
        expect(screen.getByText(/No notes reference this doctrine yet/)).toBeInTheDocument();
      });
    });

    it('shows referencing notes', async () => {
      mockGetReferencingNotes.mockResolvedValue([
        { id: 'note-1', book: 'JHN', startChapter: 1, startVerse: 1, title: 'My Note on Trinity' },
      ]);

      render(<SystematicPanel />);

      await waitFor(() => {
        expect(screen.getByText('My Note on Trinity')).toBeInTheDocument();
      });
    });

    it('shows note count badge', async () => {
      mockGetReferencingNotes.mockResolvedValue([
        { id: 'note-1', book: 'JHN', startChapter: 1, title: 'Note 1' },
        { id: 'note-2', book: 'ROM', startChapter: 8, title: 'Note 2' },
      ]);

      render(<SystematicPanel />);

      await waitFor(() => {
        const badge = screen.getByText('Your Notes Referencing This').parentElement?.querySelector('[class*="badge"]');
        expect(badge?.textContent).toBe('2');
      });
    });

    it('shows loading state', async () => {
      let resolveNotes: (value: any[]) => void;
      mockGetReferencingNotes.mockReturnValue(new Promise(resolve => {
        resolveNotes = resolve;
      }));

      render(<SystematicPanel />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();

      resolveNotes!([]);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });
  });

  describe('annotations/highlights', () => {
    it('renders highlights section when annotations exist', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: mockEntry,
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [
          { id: 'ann-1', annotationType: 'highlight', textSelection: 'three persons', color: '#fef08a' },
        ],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      expect(screen.getByText('Your Highlights')).toBeInTheDocument();
      expect(screen.getByText('three persons')).toBeInTheDocument();
    });

    it('shows annotation count badge', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: mockEntry,
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [
          { id: 'ann-1', annotationType: 'highlight', textSelection: 'text 1', color: '#fef08a' },
          { id: 'ann-2', annotationType: 'highlight', textSelection: 'text 2', color: '#bbf7d0' },
        ],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      const highlightsBadge = screen.getByText('Your Highlights').parentElement?.querySelector('[class*="badge"]');
      expect(highlightsBadge?.textContent).toBe('2');
    });

    it('deletes annotation on delete button click', async () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: mockEntry,
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [
          { id: 'ann-1', annotationType: 'highlight', textSelection: 'test text', color: '#fef08a' },
        ],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      fireEvent.click(screen.getByTitle('Delete highlight'));

      expect(mockDeleteAnnotation).toHaveBeenCalledWith('ann-1');
    });

    it('does not show highlights section when no annotations', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: mockEntry,
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      expect(screen.queryByText('Your Highlights')).not.toBeInTheDocument();
    });
  });

  describe('link syntax variations', () => {
    it('shows section link syntax', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: {
          ...mockEntry,
          sectionLetter: 'A',
        },
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      expect(screen.getByText('[[ST:Ch32:A]]')).toBeInTheDocument();
    });

    it('shows subsection link syntax', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: {
          ...mockEntry,
          sectionLetter: 'A',
          subsectionNumber: 1,
        },
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      expect(screen.getByText('[[ST:Ch32:A.1]]')).toBeInTheDocument();
    });
  });

  describe('breadcrumb variations', () => {
    it('shows section letter in breadcrumb', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: {
          ...mockEntry,
          sectionLetter: 'B',
        },
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('shows subsection number in breadcrumb', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: {
          ...mockEntry,
          sectionLetter: 'A',
          subsectionNumber: 3,
        },
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('children vs sections', () => {
    it('handles children array instead of sections', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: {
          ...mockEntry,
          sections: undefined,
          children: [
            { id: 'child-1', entryType: 'section', sectionLetter: 'X', title: 'Child Section', content: '<p>Content</p>' },
          ],
        },
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      expect(screen.getByText('X. Child Section')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles entry without summary', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: {
          ...mockEntry,
          summary: null,
        },
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      expect(screen.queryByText('God eternally exists as three persons.')).not.toBeInTheDocument();
    });

    it('handles entry without content', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: {
          ...mockEntry,
          content: null,
        },
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      expect(screen.queryByText(/The doctrine of the Trinity/)).not.toBeInTheDocument();
    });

    it('handles entry without scripture references', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: {
          ...mockEntry,
          scriptureReferences: [],
        },
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      expect(screen.queryByText('Key Scripture References')).not.toBeInTheDocument();
    });

    it('handles entry without related chapters', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: {
          ...mockEntry,
          relatedChapters: [],
        },
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      expect(screen.queryByText('See Also')).not.toBeInTheDocument();
    });

    it('handles entry without tags', () => {
      (useSystematic as any).mockReturnValue({
        isPanelOpen: true,
        selectedEntry: {
          ...mockEntry,
          tags: [],
        },
        closePanel: mockClosePanel,
        selectEntry: mockSelectEntry,
        openChapter: mockOpenChapter,
        getReferencingNotes: mockGetReferencingNotes,
        annotations: [],
        addAnnotation: mockAddAnnotation,
        deleteAnnotation: mockDeleteAnnotation,
      });

      render(<SystematicPanel />);

      expect(screen.queryByText('Doctrine of God')).not.toBeInTheDocument();
    });
  });
});
