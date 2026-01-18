import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';

// Mock context
const mockRefreshNotes = vi.fn();

vi.mock('../../../src/context/NotesContext', () => ({
  useNotes: () => ({
    refreshNotes: mockRefreshNotes,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:test-url');
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

import { SettingsModal } from '../../../src/components/UI/SettingsModal';

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe('gear button', () => {
    it('renders gear button when modal is closed', () => {
      render(<SettingsModal />);

      expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument();
    });

    it('has aria-label for accessibility', () => {
      render(<SettingsModal />);

      expect(screen.getByLabelText('Open settings')).toBeInTheDocument();
    });

    it('opens modal when clicked', () => {
      render(<SettingsModal />);

      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    });
  });

  describe('modal rendering', () => {
    it('renders Settings title when open', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    });

    it('renders close button', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByLabelText('Close settings')).toBeInTheDocument();
    });

    it('renders Backup & Restore section', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
    });

    it('renders Export Backup button', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByText('Export Backup')).toBeInTheDocument();
      expect(screen.getByText('Download all notes as JSON')).toBeInTheDocument();
    });

    it('renders Import Backup button', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByText('Import Backup')).toBeInTheDocument();
      expect(screen.getByText('Restore from JSON file (merges with existing)')).toBeInTheDocument();
    });

    it('renders Danger Zone section', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByText('Danger Zone')).toBeInTheDocument();
    });

    it('renders Delete All Notes button', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByText('Delete All Notes')).toBeInTheDocument();
      expect(screen.getByText('Permanently remove all notes')).toBeInTheDocument();
    });
  });

  describe('closing modal', () => {
    it('closes when close button is clicked', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Close settings'));

      expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
    });

    it('closes when overlay is clicked', () => {
      const { container } = render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();

      // Click the overlay (the outer div with onClick={closeModal})
      const overlay = container.querySelector('[class*="modalOverlay"]');
      fireEvent.click(overlay!);

      expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
    });

    it('does not close when modal content is clicked', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      // Click inside the modal on the heading
      fireEvent.click(screen.getByRole('heading', { name: 'Settings' }));

      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    });

    it('closes on Escape key', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();

      // Find an element inside the modal and trigger keydown
      const heading = screen.getByRole('heading', { name: 'Settings' });
      fireEvent.keyDown(heading.closest('[class*="modal"]')!, { key: 'Escape' });

      expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
    });
  });

  describe('export functionality', () => {
    it('calls export API when Export Backup is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ notes: [], version: '1.0', exportedAt: new Date().toISOString() }),
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      // Find and click Export button
      const exportButton = screen.getByText('Export Backup').closest('button');
      fireEvent.click(exportButton!);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/notes/export');
      });
    });

    it('shows success message after export', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ notes: [{ id: '1' }, { id: '2' }], version: '1.0', exportedAt: new Date().toISOString() }),
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const exportButton = screen.getByText('Export Backup').closest('button');
      fireEvent.click(exportButton!);

      await waitFor(() => {
        expect(screen.getByText('Exported 2 notes successfully')).toBeInTheDocument();
      });
    });

    it('shows error message on export failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const exportButton = screen.getByText('Export Backup').closest('button');
      fireEvent.click(exportButton!);

      await waitFor(() => {
        expect(screen.getByText('Failed to export notes')).toBeInTheDocument();
      });
    });
  });

  describe('delete confirmation', () => {
    it('shows delete confirmation when Delete All Notes is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 5 }),
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Notes').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Delete All Notes?')).toBeInTheDocument();
      });
    });

    it('shows note count in confirmation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 5 }),
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Notes').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText(/5/)).toBeInTheDocument();
        expect(screen.getByText(/notes/)).toBeInTheDocument();
      });
    });

    it('requires typing DELETE to enable confirm button', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 5 }),
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Notes').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Delete All Notes?')).toBeInTheDocument();
      });

      // Confirm button should be disabled initially
      const confirmButton = screen.getByRole('button', { name: 'Delete All' });
      expect(confirmButton).toBeDisabled();

      // Type DELETE
      const input = screen.getByPlaceholderText('Type DELETE');
      fireEvent.change(input, { target: { value: 'DELETE' } });

      expect(confirmButton).not.toBeDisabled();
    });

    it('calls delete API when confirmed', async () => {
      // First call for count
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 5 }),
      });

      // Second call for delete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ deleted: 5 }),
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Notes').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Delete All Notes?')).toBeInTheDocument();
      });

      // Type DELETE and confirm
      const input = screen.getByPlaceholderText('Type DELETE');
      fireEvent.change(input, { target: { value: 'DELETE' } });

      const confirmButton = screen.getByRole('button', { name: 'Delete All' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/notes', { method: 'DELETE' });
      });
    });

    it('closes confirmation on Cancel', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 5 }),
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Notes').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Delete All Notes?')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      // Should be back to main settings, not showing delete confirmation
      expect(screen.queryByText('Delete All Notes?')).not.toBeInTheDocument();
      expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
    });

    it('closes confirmation on Escape', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 5 }),
      });

      const { container } = render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Notes').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Delete All Notes?')).toBeInTheDocument();
      });

      // Find the confirm modal and trigger keydown
      const modal = container.querySelector('[class*="confirmModal"]');
      fireEvent.keyDown(modal!, { key: 'Escape' });

      // Should show main settings, not delete confirmation
      await waitFor(() => {
        expect(screen.queryByText('Delete All Notes?')).not.toBeInTheDocument();
      });
    });

    it('shows success message after deletion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 3 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ deleted: 3 }),
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Notes').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Delete All Notes?')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type DELETE');
      fireEvent.change(input, { target: { value: 'DELETE' } });

      const confirmButton = screen.getByRole('button', { name: 'Delete All' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Deleted 3 notes')).toBeInTheDocument();
      });
    });

    it('calls refreshNotes after deletion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 3 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ deleted: 3 }),
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Notes').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Delete All Notes?')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type DELETE');
      fireEvent.change(input, { target: { value: 'DELETE' } });

      const confirmButton = screen.getByRole('button', { name: 'Delete All' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockRefreshNotes).toHaveBeenCalled();
      });
    });
  });

  describe('edge cases', () => {
    it('handles singular note count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 1 }),
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Notes').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        // Check that count shows 1 and text shows "note" (singular)
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText(/permanently delete/)).toBeInTheDocument();
      });

      // For singular, it should say "note" not "notes"
      const confirmText = screen.getByText(/permanently delete/).textContent;
      expect(confirmText).toContain('note');
      expect(confirmText).not.toContain('notes');
    });

    it('does not confirm delete if text is not exactly DELETE', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 5 }),
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Notes').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Delete All Notes?')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type DELETE');
      fireEvent.change(input, { target: { value: 'delete' } }); // lowercase

      const confirmButton = screen.getByRole('button', { name: 'Delete All' });
      expect(confirmButton).toBeDisabled();
    });
  });
});
