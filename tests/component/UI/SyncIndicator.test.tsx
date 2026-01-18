import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

// Mock context
const mockRefreshNotes = vi.fn();
const mockDismissExternalChanges = vi.fn();
let mockHasExternalChanges = false;

vi.mock('../../../src/context/NotesContext', () => ({
  useNotes: () => ({
    hasExternalChanges: mockHasExternalChanges,
    refreshNotes: mockRefreshNotes,
    dismissExternalChanges: mockDismissExternalChanges,
  }),
}));

import { SyncIndicator } from '../../../src/components/UI/SyncIndicator';

describe('SyncIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasExternalChanges = false;
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders nothing when hasExternalChanges is false', () => {
      mockHasExternalChanges = false;

      const { container } = render(<SyncIndicator />);

      expect(container.firstChild).toBeNull();
    });

    it('renders indicator when hasExternalChanges is true', () => {
      mockHasExternalChanges = true;

      render(<SyncIndicator />);

      expect(screen.getByText('Notes updated')).toBeInTheDocument();
    });

    it('renders sync icon', () => {
      mockHasExternalChanges = true;

      const { container } = render(<SyncIndicator />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders refresh button', () => {
      mockHasExternalChanges = true;

      render(<SyncIndicator />);

      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });

    it('renders dismiss button with aria-label', () => {
      mockHasExternalChanges = true;

      render(<SyncIndicator />);

      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls refreshNotes when Refresh button is clicked', () => {
      mockHasExternalChanges = true;

      render(<SyncIndicator />);

      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

      expect(mockRefreshNotes).toHaveBeenCalledTimes(1);
    });

    it('calls dismissExternalChanges when Dismiss button is clicked', () => {
      mockHasExternalChanges = true;

      render(<SyncIndicator />);

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(mockDismissExternalChanges).toHaveBeenCalledTimes(1);
    });
  });

  describe('visibility transitions', () => {
    it('appears when hasExternalChanges changes to true', () => {
      mockHasExternalChanges = false;

      const { container, rerender } = render(<SyncIndicator />);

      expect(container.firstChild).toBeNull();

      // Simulate change
      mockHasExternalChanges = true;
      rerender(<SyncIndicator />);

      expect(screen.getByText('Notes updated')).toBeInTheDocument();
    });

    it('disappears when hasExternalChanges changes to false', () => {
      mockHasExternalChanges = true;

      const { container, rerender } = render(<SyncIndicator />);

      expect(screen.getByText('Notes updated')).toBeInTheDocument();

      // Simulate change
      mockHasExternalChanges = false;
      rerender(<SyncIndicator />);

      expect(container.firstChild).toBeNull();
    });
  });
});
