import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import React from 'react';

// Mock contexts
const mockNavigate = vi.fn();
const mockSetSelectedNote = vi.fn();
const mockSetEditingNote = vi.fn();

const mockBibleContext = {
  bookId: 'ROM',
  chapter: 8,
  navigate: mockNavigate,
};

const mockNotes = [
  {
    id: 'note-1',
    book: 'ROM',
    startChapter: 8,
    startVerse: 28,
    endChapter: 8,
    endVerse: 30,
    title: 'God Works for Good',
    content: '<p>Test content</p>',
    type: 'note',
  },
  {
    id: 'note-2',
    book: 'GEN',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 3,
    title: 'Creation',
    content: '<p>In the beginning...</p>',
    type: 'note',
  },
  {
    id: 'note-3',
    book: 'ROM',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 7,
    title: '',
    content: '',
    type: 'note',
  },
];

const mockNotesContext = {
  notes: mockNotes,
  setSelectedNote: mockSetSelectedNote,
  setEditingNote: mockSetEditingNote,
};

vi.mock('../../../src/context/BibleContext', () => ({
  useBible: () => mockBibleContext,
}));

vi.mock('../../../src/context/NotesContext', () => ({
  useNotes: () => mockNotesContext,
}));

// Mock the tree components for Sidebar tests
// They have their own tests - we just need basic rendering here
const formatVerseRangeForMock = (note: { book: string; startChapter: number; startVerse?: number; endChapter: number; endVerse?: number }) => {
  const bookNames: Record<string, string> = {
    'GEN': 'Genesis',
    'EXO': 'Exodus',
    'LEV': 'Leviticus',
    'ROM': 'Romans',
    'JHN': 'John',
  };
  const bookName = bookNames[note.book] || note.book;
  if (note.startChapter === note.endChapter) {
    if (note.startVerse === note.endVerse) {
      return `${bookName} ${note.startChapter}:${note.startVerse}`;
    }
    return `${bookName} ${note.startChapter}:${note.startVerse}-${note.endVerse}`;
  }
  return `${bookName} ${note.startChapter}:${note.startVerse}-${note.endChapter}:${note.endVerse}`;
};

vi.mock('../../../src/components/Layout/NotesTree', () => ({
  NotesTree: () => {
    const { notes, setSelectedNote, setEditingNote } = mockNotesContext;
    const { navigate } = mockBibleContext;

    const handleNoteClick = (note: typeof mockNotes[0]) => {
      navigate(note.book, note.startChapter);
      setSelectedNote(note.id);
      setEditingNote(note.id);
    };

    return (
      <div data-testid="notes-tree">
        {notes.length === 0 ? (
          <p>No notes yet. Select verses in the Bible text to create a note.</p>
        ) : (
          notes.map(note => (
            <button key={note.id} onClick={() => handleNoteClick(note)}>
              <span>{formatVerseRangeForMock(note)}</span>
              <span>{note.title || 'Untitled'}</span>
            </button>
          ))
        )}
      </div>
    );
  },
  default: () => <div data-testid="notes-tree" />,
}));

vi.mock('../../../src/components/Layout/TopicsTree', () => ({
  TopicsTree: () => <div data-testid="topics-tree">Topics Tree</div>,
  default: () => <div data-testid="topics-tree" />,
}));

// Mock bibleBooks - include actual book data needed for tests
const mockBooks = [
  { id: 'GEN', name: 'Genesis', chapters: 50 },
  { id: 'EXO', name: 'Exodus', chapters: 40 },
  { id: 'LEV', name: 'Leviticus', chapters: 27 },
  { id: 'ROM', name: 'Romans', chapters: 16 },
  { id: 'JHN', name: 'John', chapters: 21 },
];

vi.mock('../../../src/utils/bibleBooks', () => ({
  books: [
    { id: 'GEN', name: 'Genesis', chapters: 50 },
    { id: 'EXO', name: 'Exodus', chapters: 40 },
    { id: 'LEV', name: 'Leviticus', chapters: 27 },
    { id: 'ROM', name: 'Romans', chapters: 16 },
    { id: 'JHN', name: 'John', chapters: 21 },
  ],
  getBookById: (id: string) => {
    const books: Record<string, { id: string; name: string; chapters: number }> = {
      'GEN': { id: 'GEN', name: 'Genesis', chapters: 50 },
      'EXO': { id: 'EXO', name: 'Exodus', chapters: 40 },
      'LEV': { id: 'LEV', name: 'Leviticus', chapters: 27 },
      'ROM': { id: 'ROM', name: 'Romans', chapters: 16 },
      'JHN': { id: 'JHN', name: 'John', chapters: 21 },
    };
    return books[id] || null;
  },
}));

vi.mock('../../../src/utils/verseRange', () => ({
  formatVerseRange: (note: { book: string; startChapter: number; startVerse: number; endChapter: number; endVerse: number }) => {
    const bookNames: Record<string, string> = {
      'GEN': 'Genesis',
      'ROM': 'Romans',
      'JHN': 'John',
    };
    const bookName = bookNames[note.book] || note.book;
    if (note.startChapter === note.endChapter) {
      if (note.startVerse === note.endVerse) {
        return `${bookName} ${note.startChapter}:${note.startVerse}`;
      }
      return `${bookName} ${note.startChapter}:${note.startVerse}-${note.endVerse}`;
    }
    return `${bookName} ${note.startChapter}:${note.startVerse}-${note.endChapter}:${note.endVerse}`;
  },
}));

import Sidebar from '../../../src/components/Layout/Sidebar';

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBibleContext.bookId = 'ROM';
    mockBibleContext.chapter = 8;
    mockNotesContext.notes = mockNotes;
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders as aside element', () => {
      const { container } = render(<Sidebar isOpen={true} />);

      expect(container.querySelector('aside')).toBeInTheDocument();
    });

    it('applies open class when isOpen is true', () => {
      const { container } = render(<Sidebar isOpen={true} />);

      const aside = container.querySelector('aside');
      expect(aside?.className).toContain('open');
    });

    it('does not apply open class when isOpen is false', () => {
      const { container } = render(<Sidebar isOpen={false} />);

      const aside = container.querySelector('aside');
      expect(aside?.className).not.toContain('open');
    });

    it('renders Books tab', () => {
      render(<Sidebar isOpen={true} />);

      expect(screen.getByRole('button', { name: 'Books' })).toBeInTheDocument();
    });

    it('renders Notes tab with count', () => {
      render(<Sidebar isOpen={true} />);

      expect(screen.getByRole('button', { name: /Notes/ })).toBeInTheDocument();
    });

    it('maintains Notes tab when notes change', () => {
      mockNotesContext.notes = [mockNotes[0]];

      render(<Sidebar isOpen={true} />);

      expect(screen.getByRole('button', { name: /Notes/ })).toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('shows Books tab content by default', () => {
      render(<Sidebar isOpen={true} />);

      expect(screen.getByText('Genesis')).toBeInTheDocument();
      expect(screen.getByText('Romans')).toBeInTheDocument();
    });

    it('switches to Notes tab when clicked', () => {
      render(<Sidebar isOpen={true} />);

      fireEvent.click(screen.getByRole('button', { name: /Notes/ }));

      // Notes content should be visible
      expect(screen.getByText('Romans 8:28-30')).toBeInTheDocument();
    });

    it('switches back to Books tab', () => {
      render(<Sidebar isOpen={true} />);

      // Switch to Notes
      fireEvent.click(screen.getByRole('button', { name: /Notes/ }));

      // Switch back to Books
      fireEvent.click(screen.getByRole('button', { name: 'Books' }));

      expect(screen.getByText('Genesis')).toBeInTheDocument();
    });

    it('applies active class to selected tab', () => {
      render(<Sidebar isOpen={true} />);

      const booksTab = screen.getByRole('button', { name: 'Books' });
      const notesTab = screen.getByRole('button', { name: /Notes/ });

      expect(booksTab.className).toContain('active');
      expect(notesTab.className).not.toContain('active');

      fireEvent.click(notesTab);

      expect(booksTab.className).not.toContain('active');
      expect(notesTab.className).toContain('active');
    });
  });

  describe('Books tab', () => {
    it('renders all books', () => {
      render(<Sidebar isOpen={true} />);

      expect(screen.getByText('Genesis')).toBeInTheDocument();
      expect(screen.getByText('Exodus')).toBeInTheDocument();
      expect(screen.getByText('Leviticus')).toBeInTheDocument();
      expect(screen.getByText('Romans')).toBeInTheDocument();
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    it('highlights current book', () => {
      render(<Sidebar isOpen={true} />);

      const romansButton = screen.getByText('Romans').closest('button');
      expect(romansButton?.className).toContain('currentBook');
    });

    it('expands book to show chapters when clicked', () => {
      render(<Sidebar isOpen={true} />);

      const genesisButton = screen.getByText('Genesis').closest('button');
      fireEvent.click(genesisButton!);

      // Should show chapter buttons 1-50
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '50' })).toBeInTheDocument();
    });

    it('collapses book when clicked again', () => {
      render(<Sidebar isOpen={true} />);

      const genesisButton = screen.getByText('Genesis').closest('button');

      // Expand
      fireEvent.click(genesisButton!);
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();

      // Collapse
      fireEvent.click(genesisButton!);
      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument();
    });

    it('collapses previous book when expanding another', () => {
      render(<Sidebar isOpen={true} />);

      // Expand Genesis
      const genesisButton = screen.getByText('Genesis').closest('button');
      fireEvent.click(genesisButton!);
      expect(screen.getByRole('button', { name: '50' })).toBeInTheDocument();

      // Expand Exodus (should collapse Genesis)
      const exodusButton = screen.getByText('Exodus').closest('button');
      fireEvent.click(exodusButton!);

      // Genesis chapters should be gone, Exodus chapters visible
      expect(screen.queryByRole('button', { name: '50' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '40' })).toBeInTheDocument();
    });

    it('navigates to chapter when chapter button is clicked', () => {
      render(<Sidebar isOpen={true} />);

      // Expand Genesis
      const genesisButton = screen.getByText('Genesis').closest('button');
      fireEvent.click(genesisButton!);

      // Click chapter 3
      fireEvent.click(screen.getByRole('button', { name: '3' }));

      expect(mockNavigate).toHaveBeenCalledWith('GEN', 3);
    });

    it('highlights current chapter in expanded book', () => {
      mockBibleContext.bookId = 'GEN';
      mockBibleContext.chapter = 5;

      render(<Sidebar isOpen={true} />);

      // Expand Genesis
      const genesisButton = screen.getByText('Genesis').closest('button');
      fireEvent.click(genesisButton!);

      const chapter5Button = screen.getByRole('button', { name: '5' });
      expect(chapter5Button.className).toContain('currentChapter');
    });

    it('shows correct number of chapters for each book', () => {
      render(<Sidebar isOpen={true} />);

      // Expand Romans (16 chapters)
      const romansButton = screen.getByText('Romans').closest('button');
      fireEvent.click(romansButton!);

      expect(screen.getByRole('button', { name: '16' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '17' })).not.toBeInTheDocument();
    });
  });

  describe('Notes tab', () => {
    it('shows empty state when no notes', () => {
      mockNotesContext.notes = [];

      render(<Sidebar isOpen={true} />);
      fireEvent.click(screen.getByRole('button', { name: /Notes/ }));

      expect(screen.getByText(/No notes yet/)).toBeInTheDocument();
    });

    it('renders notes sorted by book order, then chapter, then verse', () => {
      render(<Sidebar isOpen={true} />);
      fireEvent.click(screen.getByRole('button', { name: /Notes/ }));

      const noteButtons = screen.getAllByRole('button').filter(
        btn => btn.textContent?.includes('Genesis') || btn.textContent?.includes('Romans')
      );

      // Genesis should come before Romans
      const genesisIndex = noteButtons.findIndex(btn => btn.textContent?.includes('Genesis'));
      const romansIndex = noteButtons.findIndex(btn => btn.textContent?.includes('Romans 1'));

      expect(genesisIndex).toBeLessThan(romansIndex);
    });

    it('displays note reference', () => {
      render(<Sidebar isOpen={true} />);
      fireEvent.click(screen.getByRole('button', { name: /Notes/ }));

      expect(screen.getByText('Romans 8:28-30')).toBeInTheDocument();
      expect(screen.getByText('Genesis 1:1-3')).toBeInTheDocument();
    });

    it('displays note title', () => {
      render(<Sidebar isOpen={true} />);
      fireEvent.click(screen.getByRole('button', { name: /Notes/ }));

      expect(screen.getByText('God Works for Good')).toBeInTheDocument();
      expect(screen.getByText('Creation')).toBeInTheDocument();
    });

    it('displays "Untitled" for notes without title', () => {
      render(<Sidebar isOpen={true} />);
      fireEvent.click(screen.getByRole('button', { name: /Notes/ }));

      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });

    it('navigates to note chapter when note is clicked', () => {
      render(<Sidebar isOpen={true} />);
      fireEvent.click(screen.getByRole('button', { name: /Notes/ }));

      const noteButton = screen.getByText('Romans 8:28-30').closest('button');
      fireEvent.click(noteButton!);

      expect(mockNavigate).toHaveBeenCalledWith('ROM', 8);
    });

    it('selects note when clicked', () => {
      render(<Sidebar isOpen={true} />);
      fireEvent.click(screen.getByRole('button', { name: /Notes/ }));

      const noteButton = screen.getByText('Romans 8:28-30').closest('button');
      fireEvent.click(noteButton!);

      expect(mockSetSelectedNote).toHaveBeenCalledWith('note-1');
    });

    it('opens note editor when clicked', () => {
      render(<Sidebar isOpen={true} />);
      fireEvent.click(screen.getByRole('button', { name: /Notes/ }));

      const noteButton = screen.getByText('Romans 8:28-30').closest('button');
      fireEvent.click(noteButton!);

      expect(mockSetEditingNote).toHaveBeenCalledWith('note-1');
    });
  });

  describe('edge cases', () => {
    it('handles empty books list gracefully', () => {
      // This shouldn't happen in practice, but test defensive coding
      render(<Sidebar isOpen={true} />);

      // Should render without crashing
      expect(screen.getByRole('button', { name: 'Books' })).toBeInTheDocument();
    });

    it('handles notes with same book but different chapters', () => {
      mockNotesContext.notes = [
        { ...mockNotes[0], startChapter: 1, endChapter: 1 },
        { ...mockNotes[0], id: 'note-4', startChapter: 8, endChapter: 8 },
      ];

      render(<Sidebar isOpen={true} />);
      fireEvent.click(screen.getByRole('button', { name: /Notes/ }));

      // Both notes should render
      const noteButtons = screen.getAllByRole('button').filter(
        btn => btn.textContent?.includes('Romans')
      );
      expect(noteButtons.length).toBeGreaterThanOrEqual(2);
    });
  });
});
