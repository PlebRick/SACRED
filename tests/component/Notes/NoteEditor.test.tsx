import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Create a stable chain mock that returns itself for all methods
const createStableChainMock = () => {
  const chainProxy: Record<string, unknown> = {};

  const methods = [
    'focus',
    'toggleBold',
    'toggleItalic',
    'toggleStrike',
    'toggleHeading',
    'toggleBulletList',
    'toggleOrderedList',
    'toggleBlockquote',
    'run',
  ];

  methods.forEach(method => {
    chainProxy[method] = vi.fn((...args: unknown[]) => chainProxy);
  });

  return chainProxy;
};

// Hoist mock functions so they're available in vi.mock
const mockChain = createStableChainMock();

const mockEditor = {
  chain: () => mockChain,
  isActive: vi.fn().mockReturnValue(false),
  getHTML: vi.fn().mockReturnValue('<p>Test content</p>'),
  commands: {
    setContent: vi.fn(),
  },
};

let currentEditor: typeof mockEditor | null = mockEditor;

vi.mock('@tiptap/react', () => ({
  useEditor: () => currentEditor,
  EditorContent: ({ editor }: { editor: unknown }) => (
    <div data-testid="editor-content" className="ProseMirror">
      {editor ? 'Editor loaded' : 'No editor'}
    </div>
  ),
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: {},
}));

vi.mock('@tiptap/extension-placeholder', () => ({
  default: {
    configure: vi.fn().mockReturnValue({}),
  },
}));

// Import after mocks
import NoteEditor from '../../../src/components/Notes/NoteEditor';

describe('NoteEditor', () => {
  const mockNote = {
    id: 'note-1',
    book: 'ROM',
    startChapter: 8,
    startVerse: 28,
    endChapter: 8,
    endVerse: 30,
    title: 'Test Note Title',
    content: '<p>Test note content</p>',
    type: 'note',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockOnUpdate = vi.fn().mockResolvedValue({});
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnUpdate.mockClear();
    mockOnUpdate.mockResolvedValue({});
    mockOnClose.mockClear();
    mockEditor.getHTML.mockReturnValue('<p>Test content</p>');
    mockEditor.isActive.mockReturnValue(false);
    currentEditor = mockEditor;

    // Clear chain method call history
    Object.values(mockChain).forEach(fn => {
      if (typeof fn === 'function' && 'mockClear' in fn) {
        (fn as ReturnType<typeof vi.fn>).mockClear();
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders the editor with note data', () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    });

    it('displays the note title in input', () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const titleInput = screen.getByPlaceholderText('Note title...');
      expect(titleInput).toHaveValue('Test Note Title');
    });

    it('displays the verse reference', () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      expect(screen.getByText('Romans 8:28-30')).toBeInTheDocument();
    });

    it('renders with empty title', () => {
      const noteWithoutTitle = { ...mockNote, title: '' };
      render(
        <NoteEditor note={noteWithoutTitle} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const titleInput = screen.getByPlaceholderText('Note title...');
      expect(titleInput).toHaveValue('');
    });

    it('renders with empty content', () => {
      const noteWithoutContent = { ...mockNote, content: '' };
      render(
        <NoteEditor note={noteWithoutContent} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    });
  });

  describe('MenuBar', () => {
    it('renders all formatting buttons', () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      expect(screen.getByTitle('Bold')).toBeInTheDocument();
      expect(screen.getByTitle('Italic')).toBeInTheDocument();
      expect(screen.getByTitle('Strikethrough')).toBeInTheDocument();
      expect(screen.getByTitle('Heading')).toBeInTheDocument();
      expect(screen.getByTitle('Bullet List')).toBeInTheDocument();
      expect(screen.getByTitle('Numbered List')).toBeInTheDocument();
      expect(screen.getByTitle('Quote')).toBeInTheDocument();
    });

    it('toggles bold when Bold button is clicked', () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const boldButton = screen.getByTitle('Bold');
      fireEvent.click(boldButton);

      expect(mockChain.focus).toHaveBeenCalled();
      expect(mockChain.toggleBold).toHaveBeenCalled();
      expect(mockChain.run).toHaveBeenCalled();
    });

    it('toggles italic when Italic button is clicked', () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const italicButton = screen.getByTitle('Italic');
      fireEvent.click(italicButton);

      expect(mockChain.toggleItalic).toHaveBeenCalled();
    });

    it('toggles strikethrough when Strike button is clicked', () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const strikeButton = screen.getByTitle('Strikethrough');
      fireEvent.click(strikeButton);

      expect(mockChain.toggleStrike).toHaveBeenCalled();
    });

    it('toggles heading when Heading button is clicked', () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const headingButton = screen.getByTitle('Heading');
      fireEvent.click(headingButton);

      expect(mockChain.toggleHeading).toHaveBeenCalledWith({ level: 2 });
    });

    it('toggles bullet list when Bullet List button is clicked', () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const bulletButton = screen.getByTitle('Bullet List');
      fireEvent.click(bulletButton);

      expect(mockChain.toggleBulletList).toHaveBeenCalled();
    });

    it('toggles ordered list when Numbered List button is clicked', () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const orderedButton = screen.getByTitle('Numbered List');
      fireEvent.click(orderedButton);

      expect(mockChain.toggleOrderedList).toHaveBeenCalled();
    });

    it('toggles blockquote when Quote button is clicked', () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const quoteButton = screen.getByTitle('Quote');
      fireEvent.click(quoteButton);

      expect(mockChain.toggleBlockquote).toHaveBeenCalled();
    });

    it('shows active state for bold when bold is active', () => {
      mockEditor.isActive.mockImplementation((type: string) => type === 'bold');

      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const boldButton = screen.getByTitle('Bold');
      expect(boldButton.className).toContain('active');
    });

    it('shows active state for italic when italic is active', () => {
      mockEditor.isActive.mockImplementation((type: string) => type === 'italic');

      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const italicButton = screen.getByTitle('Italic');
      expect(italicButton.className).toContain('active');
    });
  });

  describe('title editing', () => {
    it('updates title when input changes', async () => {
      vi.useRealTimers();
      const user = userEvent.setup();

      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const titleInput = screen.getByPlaceholderText('Note title...');
      await user.clear(titleInput);
      await user.type(titleInput, 'New Title');

      expect(titleInput).toHaveValue('New Title');
    });
  });

  describe('auto-save', () => {
    it('auto-saves after 1 second when title changes', async () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const titleInput = screen.getByPlaceholderText('Note title...');
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

      // Should not save immediately
      expect(mockOnUpdate).not.toHaveBeenCalled();

      // Advance timer by 1 second
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockOnUpdate).toHaveBeenCalledWith('note-1', {
        title: 'Updated Title',
        content: '<p>Test content</p>',
      });
    });

    it('debounces multiple rapid changes', async () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const titleInput = screen.getByPlaceholderText('Note title...');

      // Make multiple rapid changes
      fireEvent.change(titleInput, { target: { value: 'A' } });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      fireEvent.change(titleInput, { target: { value: 'AB' } });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      fireEvent.change(titleInput, { target: { value: 'ABC' } });
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should only save once with final value
      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
      expect(mockOnUpdate).toHaveBeenCalledWith('note-1', {
        title: 'ABC',
        content: '<p>Test content</p>',
      });
    });

    it('does not save if content has not changed', async () => {
      // Make getHTML return same as note content
      mockEditor.getHTML.mockReturnValue('<p>Test note content</p>');

      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      // Advance timer without making changes
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('handles save errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockOnUpdate.mockRejectedValueOnce(new Error('Save failed'));

      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const titleInput = screen.getByPlaceholderText('Note title...');
      fireEvent.change(titleInput, { target: { value: 'New Title' } });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Wait for async error handling
      await act(async () => {
        await Promise.resolve();
      });

      expect(consoleError).toHaveBeenCalledWith('Failed to save note:', expect.any(Error));
      consoleError.mockRestore();
    });
  });

  describe('close button', () => {
    it('calls onClose when close button is clicked', () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      const closeButton = screen.getByLabelText('Close editor');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('verse reference formatting', () => {
    it('displays single verse reference correctly', () => {
      const singleVerseNote = {
        ...mockNote,
        startVerse: 28,
        endVerse: 28,
      };

      render(
        <NoteEditor note={singleVerseNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      expect(screen.getByText('Romans 8:28')).toBeInTheDocument();
    });

    it('displays cross-chapter reference correctly', () => {
      const crossChapterNote = {
        ...mockNote,
        startChapter: 8,
        startVerse: 28,
        endChapter: 9,
        endVerse: 5,
      };

      render(
        <NoteEditor note={crossChapterNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      expect(screen.getByText('Romans 8:28-9:5')).toBeInTheDocument();
    });

    it('displays chapter-level note correctly', () => {
      const chapterNote = {
        ...mockNote,
        startVerse: null,
        endVerse: null,
      };

      render(
        <NoteEditor note={chapterNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      expect(screen.getByText('Romans 8')).toBeInTheDocument();
    });

    it('displays multi-chapter chapter-level note correctly', () => {
      const multiChapterNote = {
        ...mockNote,
        startChapter: 8,
        startVerse: null,
        endChapter: 9,
        endVerse: null,
      };

      render(
        <NoteEditor note={multiChapterNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      expect(screen.getByText('Romans 8-9')).toBeInTheDocument();
    });
  });

  describe('note types', () => {
    it('renders note type correctly', () => {
      render(
        <NoteEditor note={mockNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    });

    it('renders commentary type correctly', () => {
      const commentaryNote = { ...mockNote, type: 'commentary' };

      render(
        <NoteEditor note={commentaryNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    });

    it('renders sermon type correctly', () => {
      const sermonNote = { ...mockNote, type: 'sermon' };

      render(
        <NoteEditor note={sermonNote} onUpdate={mockOnUpdate} onClose={mockOnClose} />
      );

      expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    });
  });
});

describe('MenuBar with null editor', () => {
  beforeEach(() => {
    currentEditor = null;
  });

  afterEach(() => {
    cleanup();
    currentEditor = mockEditor;
  });

  it('does not render menu buttons when editor is null', () => {
    render(
      <NoteEditor
        note={{
          id: 'note-1',
          book: 'ROM',
          startChapter: 1,
          startVerse: 1,
          endChapter: 1,
          endVerse: 1,
          title: '',
          content: '',
          type: 'note',
          createdAt: '',
          updatedAt: '',
        }}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // MenuBar buttons should not be rendered when editor is null
    expect(screen.queryByTitle('Bold')).not.toBeInTheDocument();
  });
});
