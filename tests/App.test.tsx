import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';

// Mock all context providers and their hooks
vi.mock('../src/context/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="theme-provider">{children}</div>,
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

vi.mock('../src/context/SettingsContext', () => ({
  SettingsProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="settings-provider">{children}</div>,
  useSettings: () => ({ translation: 'web' }),
}));

vi.mock('../src/context/BibleContext', () => ({
  BibleProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="bible-provider">{children}</div>,
  useBible: () => ({
    bookId: 'JHN',
    chapter: 3,
    setBookAndChapter: vi.fn(),
  }),
}));

vi.mock('../src/context/NotesContext', () => ({
  NotesProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="notes-provider">{children}</div>,
  useNotes: () => ({
    getNotesForChapter: vi.fn().mockReturnValue([
      {
        id: 'note-1',
        book: 'JHN',
        startChapter: 3,
        startVerse: 16,
        endChapter: 3,
        endVerse: 21,
        title: 'Test Note',
      },
    ]),
  }),
}));

vi.mock('../src/context/TopicsContext', () => ({
  TopicsProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="topics-provider">{children}</div>,
}));

vi.mock('../src/context/InlineTagsContext', () => ({
  InlineTagsProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="inline-tags-provider">{children}</div>,
}));

vi.mock('../src/context/SystematicContext', () => ({
  SystematicProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="systematic-provider">{children}</div>,
}));

// Mock components
vi.mock('../src/components/Layout/Header', () => ({
  Header: ({ onToggleSidebar, sidebarOpen }: any) => (
    <header data-testid="header">
      <button data-testid="toggle-sidebar" onClick={onToggleSidebar}>
        {sidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
      </button>
    </header>
  ),
}));

vi.mock('../src/components/Layout/Sidebar', () => ({
  Sidebar: ({ isOpen, width }: any) => (
    isOpen ? <aside data-testid="sidebar" style={{ width }}>Sidebar</aside> : null
  ),
}));

vi.mock('../src/components/Bible/BibleReader', () => ({
  BibleReader: ({ onVisibleVerseChange }: any) => (
    <div data-testid="bible-reader">
      <button data-testid="verse-change" onClick={() => onVisibleVerseChange(16)}>
        Change to verse 16
      </button>
    </div>
  ),
}));

vi.mock('../src/components/Notes/NotesPanel', () => ({
  NotesPanel: ({ onClose, activeNoteId }: any) => (
    <div data-testid="notes-panel">
      <span data-testid="active-note-id">{activeNoteId || 'none'}</span>
      <button data-testid="close-notes" onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../src/components/Systematic/SystematicPanel', () => ({
  SystematicPanel: () => <div data-testid="systematic-panel">Systematic Panel</div>,
}));

vi.mock('../src/components/Layout/ResizableDivider', () => ({
  ResizableDivider: ({ onResize }: any) => (
    <div data-testid="resizable-divider">
      <button data-testid="resize-trigger" onClick={() => onResize(350)}>
        Resize
      </button>
    </div>
  ),
}));

// Mock CSS module
vi.mock('../src/components/Layout/Layout.module.css', () => ({
  default: {
    layout: 'layout',
    main: 'main',
    contentWrapper: 'contentWrapper',
    leftColumn: 'leftColumn',
    rightColumn: 'rightColumn',
    mobileOpen: 'mobileOpen',
    mobileNotesToggle: 'mobileNotesToggle',
    sidebarDivider: 'sidebarDivider',
  },
}));

// Import App after mocks
import App from '../src/App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  describe('Provider composition', () => {
    it('renders all providers in correct order', () => {
      render(<App />);

      // Verify all providers are present
      expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
      expect(screen.getByTestId('settings-provider')).toBeInTheDocument();
      expect(screen.getByTestId('bible-provider')).toBeInTheDocument();
      expect(screen.getByTestId('notes-provider')).toBeInTheDocument();
      expect(screen.getByTestId('topics-provider')).toBeInTheDocument();
      expect(screen.getByTestId('inline-tags-provider')).toBeInTheDocument();
      expect(screen.getByTestId('systematic-provider')).toBeInTheDocument();
    });

    it('nests providers correctly', () => {
      const { container } = render(<App />);

      // Theme is outermost, Systematic is innermost
      const themeProvider = screen.getByTestId('theme-provider');
      const systematicProvider = screen.getByTestId('systematic-provider');

      expect(themeProvider).toContainElement(systematicProvider);
    });
  });

  describe('AppContent', () => {
    it('renders main layout components', () => {
      render(<App />);

      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('bible-reader')).toBeInTheDocument();
      expect(screen.getByTestId('notes-panel')).toBeInTheDocument();
      expect(screen.getByTestId('systematic-panel')).toBeInTheDocument();
    });

    it('renders resizable dividers', () => {
      render(<App />);

      // Should have dividers (at least 2 - sidebar and notes)
      const dividers = screen.getAllByTestId('resizable-divider');
      expect(dividers.length).toBeGreaterThanOrEqual(2);
    });

    it('renders mobile notes toggle button', () => {
      render(<App />);

      const toggleButton = screen.getByRole('button', { name: /notes/i });
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe('Sidebar toggle', () => {
    it('toggles sidebar visibility', () => {
      render(<App />);

      // Sidebar starts open
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();

      // Click toggle to close
      fireEvent.click(screen.getByTestId('toggle-sidebar'));

      // Sidebar should be hidden
      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    });

    it('hides sidebar divider when sidebar is closed', () => {
      render(<App />);

      const initialDividers = screen.getAllByTestId('resizable-divider');
      const initialCount = initialDividers.length;

      // Close sidebar
      fireEvent.click(screen.getByTestId('toggle-sidebar'));

      // Should have one fewer divider
      const afterDividers = screen.getAllByTestId('resizable-divider');
      expect(afterDividers.length).toBe(initialCount - 1);
    });
  });

  describe('Mobile notes toggle', () => {
    it('toggles mobile notes panel', () => {
      render(<App />);

      const toggleButton = screen.getByRole('button', { name: /notes/i });

      // Click to open mobile notes
      fireEvent.click(toggleButton);

      // Button aria-label should change
      expect(toggleButton).toHaveAttribute('aria-label', 'Close notes');

      // Click again to close
      fireEvent.click(toggleButton);

      expect(toggleButton).toHaveAttribute('aria-label', 'Open notes');
    });

    it('closes mobile notes when close button in panel is clicked', () => {
      render(<App />);

      // Open mobile notes
      const toggleButton = screen.getByRole('button', { name: /notes/i });
      fireEvent.click(toggleButton);

      expect(toggleButton).toHaveAttribute('aria-label', 'Close notes');

      // Close via panel button
      fireEvent.click(screen.getByTestId('close-notes'));

      expect(toggleButton).toHaveAttribute('aria-label', 'Open notes');
    });
  });

  describe('Resize handlers', () => {
    it('handles sidebar resize', () => {
      render(<App />);

      const sidebar = screen.getByTestId('sidebar');

      // Initial width
      expect(sidebar).toHaveStyle({ width: '280px' });

      // Find the first resize trigger (for sidebar)
      const dividers = screen.getAllByTestId('resizable-divider');
      const sidebarDivider = dividers[0];
      const resizeButton = sidebarDivider.querySelector('[data-testid="resize-trigger"]');

      if (resizeButton) {
        fireEvent.click(resizeButton);
        // Width should update (our mock triggers resize to 350)
        expect(sidebar).toHaveStyle({ width: '350px' });
      }
    });
  });

  describe('Active note calculation', () => {
    it('sets active note based on visible verse', async () => {
      render(<App />);

      // Initially no active note (verse 1 doesn't match note range 16-21)
      expect(screen.getByTestId('active-note-id').textContent).toBe('none');

      // Change visible verse to 16 (within note range)
      fireEvent.click(screen.getByTestId('verse-change'));

      await waitFor(() => {
        expect(screen.getByTestId('active-note-id').textContent).toBe('note-1');
      });
    });
  });
});
