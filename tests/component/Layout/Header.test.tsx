import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

// Mock child components
vi.mock('../../../src/components/UI/ThemeToggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme</button>,
}));

vi.mock('../../../src/components/UI/SettingsModal', () => ({
  SettingsModal: () => <button data-testid="settings-modal">Settings</button>,
}));

vi.mock('../../../src/components/UI/SyncIndicator', () => ({
  SyncIndicator: () => <span data-testid="sync-indicator">Sync</span>,
}));

vi.mock('../../../src/components/Layout/VerseSearch', () => ({
  VerseSearch: () => <input data-testid="verse-search" placeholder="Go to verse..." />,
}));

// Mock context
const mockBibleContext = {
  bookId: 'ROM',
  chapter: 8,
};

vi.mock('../../../src/context/BibleContext', () => ({
  useBible: () => mockBibleContext,
}));

vi.mock('../../../src/utils/bibleBooks', () => ({
  getBookById: (id: string) => {
    const books: Record<string, { id: string; name: string; chapters: number }> = {
      'ROM': { id: 'ROM', name: 'Romans', chapters: 16 },
      'GEN': { id: 'GEN', name: 'Genesis', chapters: 50 },
      'JHN': { id: 'JHN', name: 'John', chapters: 21 },
      'PSA': { id: 'PSA', name: 'Psalms', chapters: 150 },
    };
    return books[id] || null;
  },
}));

import Header from '../../../src/components/Layout/Header';

describe('Header', () => {
  const mockOnToggleSidebar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockBibleContext.bookId = 'ROM';
    mockBibleContext.chapter = 8;
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders the logo', () => {
      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />);

      expect(screen.getByText('SACRED')).toBeInTheDocument();
    });

    it('renders in header element', () => {
      const { container } = render(
        <Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />
      );

      expect(container.querySelector('header')).toBeInTheDocument();
    });

    it('renders current book and chapter reference', () => {
      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />);

      expect(screen.getByText('Romans 8')).toBeInTheDocument();
    });

    it('renders different book reference when bookId changes', () => {
      mockBibleContext.bookId = 'GEN';
      mockBibleContext.chapter = 1;

      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />);

      expect(screen.getByText('Genesis 1')).toBeInTheDocument();
    });

    it('renders VerseSearch component', () => {
      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />);

      expect(screen.getByTestId('verse-search')).toBeInTheDocument();
    });

    it('renders ThemeToggle component', () => {
      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />);

      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    });

    it('renders SettingsModal component', () => {
      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />);

      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });

    it('renders SyncIndicator component', () => {
      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />);

      expect(screen.getByTestId('sync-indicator')).toBeInTheDocument();
    });
  });

  describe('menu button', () => {
    it('renders menu button', () => {
      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />);

      const menuButton = screen.getByRole('button', { name: /sidebar/i });
      expect(menuButton).toBeInTheDocument();
    });

    it('has aria-label "Close sidebar" when sidebar is open', () => {
      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />);

      expect(screen.getByLabelText('Close sidebar')).toBeInTheDocument();
    });

    it('has aria-label "Open sidebar" when sidebar is closed', () => {
      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={false} />);

      expect(screen.getByLabelText('Open sidebar')).toBeInTheDocument();
    });

    it('calls onToggleSidebar when clicked', () => {
      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />);

      const menuButton = screen.getByLabelText('Close sidebar');
      fireEvent.click(menuButton);

      expect(mockOnToggleSidebar).toHaveBeenCalledTimes(1);
    });

    it('calls onToggleSidebar when clicked in closed state', () => {
      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={false} />);

      const menuButton = screen.getByLabelText('Open sidebar');
      fireEvent.click(menuButton);

      expect(mockOnToggleSidebar).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('handles unknown book gracefully', () => {
      mockBibleContext.bookId = 'UNKNOWN';
      mockBibleContext.chapter = 1;

      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />);

      // Should render without crashing, reference might be empty or show undefined
      expect(screen.getByText('SACRED')).toBeInTheDocument();
    });

    it('renders with chapter 1', () => {
      mockBibleContext.bookId = 'PSA';
      mockBibleContext.chapter = 1;

      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />);

      expect(screen.getByText('Psalms 1')).toBeInTheDocument();
    });

    it('renders with large chapter number', () => {
      mockBibleContext.bookId = 'PSA';
      mockBibleContext.chapter = 119;

      render(<Header onToggleSidebar={mockOnToggleSidebar} sidebarOpen={true} />);

      expect(screen.getByText('Psalms 119')).toBeInTheDocument();
    });
  });
});
