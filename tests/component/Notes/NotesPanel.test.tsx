import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock child components
vi.mock('../../../src/components/Notes/NoteCard', () => ({
  NoteCard: ({ note, isActive, onSelect, onDelete }: {
    note: { id: string; title: string };
    isActive: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
  }) => (
    <div
      data-testid={`note-card-${note.id}`}
      data-note-id={note.id}
      data-active={isActive}
      onClick={() => onSelect(note.id)}
    >
      {note.title}
      <button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} data-testid={`delete-${note.id}`}>
        Delete
      </button>
    </div>
  ),
}));

vi.mock('../../../src/components/Notes/NoteEditor', () => ({
  NoteEditor: ({ note, onClose }: { note: { id: string }; onClose: () => void }) => (
    <div data-testid="note-editor">
      Editing note: {note.id}
      <button onClick={onClose} data-testid="close-editor">Close</button>
    </div>
  ),
}));

vi.mock('../../../src/components/Notes/AddNoteModal', () => ({
  AddNoteModal: ({ isOpen, onClose, noteType }: {
    isOpen: boolean;
    onClose: () => void;
    noteType: string;
  }) => (
    isOpen ? (
      <div data-testid="add-note-modal">
        Modal for {noteType}
        <button onClick={onClose} data-testid="close-modal">Close Modal</button>
      </div>
    ) : null
  ),
}));

// Mock contexts
const mockNotes = [
  {
    id: 'note-1',
    book: 'ROM',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 7,
    title: 'Test Note 1',
    content: '<p>Content 1</p>',
    type: 'note',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'note-2',
    book: 'ROM',
    startChapter: 1,
    startVerse: 8,
    endChapter: 1,
    endVerse: 15,
    title: 'Test Note 2',
    content: '<p>Content 2</p>',
    type: 'note',
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 'commentary-1',
    book: 'ROM',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 7,
    title: 'Commentary 1',
    content: '<p>Commentary content</p>',
    type: 'commentary',
    createdAt: '2024-01-03T00:00:00.000Z',
    updatedAt: '2024-01-03T00:00:00.000Z',
  },
];

const mockNotesContext = {
  notes: mockNotes,
  editingNoteId: null as string | null,
  setEditingNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  getNotesForChapter: vi.fn().mockReturnValue(mockNotes),
  createNote: vi.fn(),
};

const mockBibleContext = {
  bookId: 'ROM',
  chapter: 1,
};

vi.mock('../../../src/context/NotesContext', () => ({
  useNotes: () => mockNotesContext,
}));

vi.mock('../../../src/context/BibleContext', () => ({
  useBible: () => mockBibleContext,
}));

// Mock SystematicContext
vi.mock('../../../src/context/SystematicContext', () => ({
  useSystematic: vi.fn(),
}));

import { useSystematic } from '../../../src/context/SystematicContext';

import NotesPanel from '../../../src/components/Notes/NotesPanel';

describe('NotesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotesContext.editingNoteId = null;
    mockNotesContext.getNotesForChapter.mockReturnValue(mockNotes);

    // Setup SystematicContext mock
    (useSystematic as any).mockReturnValue({
      tree: [],
      loading: false,
      error: null,
      selectedEntryId: null,
      selectedEntry: null,
      isPanelOpen: false,
      relatedDoctrines: [],
      relatedDoctrinesLoading: false,
      tags: [],
      searchResults: [],
      searchQuery: '',
      annotations: [],
      annotationsLoading: false,
      selectEntry: vi.fn(),
      openChapter: vi.fn(),
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
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders the panel header with title', () => {
      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      // Use role to find the heading specifically
      expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    });

    it('renders note count', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue(mockNotes.filter(n => n.type === 'note'));

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      expect(screen.getByText('2 notes')).toBeInTheDocument();
    });

    it('renders singular note count', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue([mockNotes[0]]);

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      expect(screen.getByText('1 note')).toBeInTheDocument();
    });

    it('renders add note button', () => {
      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      expect(screen.getByLabelText('Add new note')).toBeInTheDocument();
    });

    it('renders section tabs', () => {
      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      expect(screen.getByRole('button', { name: 'Notes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Commentary' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sermons' })).toBeInTheDocument();
    });

    it('renders note cards for notes of active tab type', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue(mockNotes);

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      // Only notes with type 'note' should be shown by default
      expect(screen.getByTestId('note-card-note-1')).toBeInTheDocument();
      expect(screen.getByTestId('note-card-note-2')).toBeInTheDocument();
      expect(screen.queryByTestId('note-card-commentary-1')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no notes exist', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue([]);

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      expect(screen.getByText('No notes for this chapter yet.')).toBeInTheDocument();
      expect(screen.getByText(/Click the \+ button/)).toBeInTheDocument();
    });

    it('shows empty state for commentary tab', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue([]);

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      // Switch to commentary tab
      fireEvent.click(screen.getByRole('button', { name: 'Commentary' }));

      expect(screen.getByText('No commentaries for this chapter yet.')).toBeInTheDocument();
    });

    it('shows empty state for sermons tab', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue([]);

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      // Switch to sermons tab
      fireEvent.click(screen.getByRole('button', { name: 'Sermons' }));

      expect(screen.getByText('No sermons for this chapter yet.')).toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('switches to commentary tab', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue(mockNotes);

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      fireEvent.click(screen.getByRole('button', { name: 'Commentary' }));

      // Check heading changes to Commentary
      expect(screen.getByRole('heading', { name: 'Commentary' })).toBeInTheDocument();
      expect(screen.getByTestId('note-card-commentary-1')).toBeInTheDocument();
    });

    it('switches to sermons tab', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue(mockNotes);

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      fireEvent.click(screen.getByRole('button', { name: 'Sermons' }));

      // Check heading changes to Sermons
      expect(screen.getByRole('heading', { name: 'Sermons' })).toBeInTheDocument();
    });

    it('updates count when switching tabs', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue(mockNotes);

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      // Notes tab shows 2 notes
      expect(screen.getByText('2 notes')).toBeInTheDocument();

      // Switch to commentary tab
      fireEvent.click(screen.getByRole('button', { name: 'Commentary' }));

      // Should show 1 commentary
      expect(screen.getByText('1 commentary')).toBeInTheDocument();
    });
  });

  describe('note selection', () => {
    it('calls setEditingNote when note is selected', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue(mockNotes);

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      fireEvent.click(screen.getByTestId('note-card-note-1'));

      expect(mockNotesContext.setEditingNote).toHaveBeenCalledWith('note-1');
    });

    it('marks active note card', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue(mockNotes);

      render(<NotesPanel onClose={vi.fn()} activeNoteId="note-1" />);

      const activeCard = screen.getByTestId('note-card-note-1');
      expect(activeCard.getAttribute('data-active')).toBe('true');
    });
  });

  describe('note deletion', () => {
    it('calls deleteNote when delete button is clicked', () => {
      mockNotesContext.getNotesForChapter.mockReturnValue(mockNotes);

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      fireEvent.click(screen.getByTestId('delete-note-1'));

      expect(mockNotesContext.deleteNote).toHaveBeenCalledWith('note-1');
    });
  });

  describe('add note modal', () => {
    it('opens modal when add button is clicked', () => {
      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      fireEvent.click(screen.getByLabelText('Add new note'));

      expect(screen.getByTestId('add-note-modal')).toBeInTheDocument();
    });

    it('passes active tab type to modal', () => {
      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      // Switch to commentary tab
      fireEvent.click(screen.getByRole('button', { name: 'Commentary' }));

      // Open modal
      fireEvent.click(screen.getByLabelText('Add new note'));

      expect(screen.getByText('Modal for commentary')).toBeInTheDocument();
    });

    it('closes modal when close button is clicked', () => {
      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      fireEvent.click(screen.getByLabelText('Add new note'));
      expect(screen.getByTestId('add-note-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('close-modal'));
      expect(screen.queryByTestId('add-note-modal')).not.toBeInTheDocument();
    });
  });

  describe('editing mode', () => {
    it('shows NoteEditor when editingNoteId is set', () => {
      mockNotesContext.editingNoteId = 'note-1';

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      expect(screen.getByTestId('note-editor')).toBeInTheDocument();
      expect(screen.getByText('Editing note: note-1')).toBeInTheDocument();
    });

    it('closes editor when close button is clicked', () => {
      mockNotesContext.editingNoteId = 'note-1';

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      fireEvent.click(screen.getByTestId('close-editor'));

      expect(mockNotesContext.setEditingNote).toHaveBeenCalledWith(null);
    });
  });

  describe('pluralization', () => {
    it('shows correct plural for commentaries', () => {
      const multipleCommentaries = [
        { ...mockNotes[2], id: 'c1' },
        { ...mockNotes[2], id: 'c2' },
      ];
      mockNotesContext.getNotesForChapter.mockReturnValue(multipleCommentaries);

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      fireEvent.click(screen.getByRole('button', { name: 'Commentary' }));

      expect(screen.getByText('2 commentaries')).toBeInTheDocument();
    });

    it('shows correct plural for sermons', () => {
      const multipleSermons = [
        { ...mockNotes[0], id: 's1', type: 'sermon' },
        { ...mockNotes[0], id: 's2', type: 'sermon' },
      ];
      mockNotesContext.getNotesForChapter.mockReturnValue(multipleSermons);

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      fireEvent.click(screen.getByRole('button', { name: 'Sermons' }));

      expect(screen.getByText('2 sermons')).toBeInTheDocument();
    });

    it('shows singular sermon', () => {
      const singleSermon = [{ ...mockNotes[0], id: 's1', type: 'sermon' }];
      mockNotesContext.getNotesForChapter.mockReturnValue(singleSermon);

      render(<NotesPanel onClose={vi.fn()} activeNoteId={null} />);

      fireEvent.click(screen.getByRole('button', { name: 'Sermons' }));

      expect(screen.getByText('1 sermon')).toBeInTheDocument();
    });
  });
});
