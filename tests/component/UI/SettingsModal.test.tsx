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

vi.mock('../../../src/context/SystematicContext', () => ({
  useSystematic: () => ({
    refreshTree: vi.fn(),
  }),
}));

const mockSetTranslation = vi.fn();

vi.mock('../../../src/context/SettingsContext', () => ({
  useSettings: () => ({
    translation: 'esv',
    setTranslation: mockSetTranslation,
  }),
}));

// Mock systematicService
const mockImportData = vi.fn();
const mockExportData = vi.fn();
const mockGetCount = vi.fn();
const mockDeleteAll = vi.fn();

vi.mock('../../../src/services/systematicService', () => ({
  systematicService: {
    importData: (...args: any[]) => mockImportData(...args),
    exportData: (...args: any[]) => mockExportData(...args),
    getCount: (...args: any[]) => mockGetCount(...args),
    deleteAll: (...args: any[]) => mockDeleteAll(...args),
  },
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

  describe('Bible translation settings', () => {
    it('renders translation options', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByText('Bible Translation')).toBeInTheDocument();
      expect(screen.getByText('ESV')).toBeInTheDocument();
      expect(screen.getByText('WEB')).toBeInTheDocument();
    });

    it('shows ESV as selected when translation is esv', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const esvRadio = screen.getByRole('radio', { name: /ESV/ });
      expect(esvRadio).toBeChecked();
    });

    it('calls setTranslation when WEB is selected', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const webRadio = screen.getByRole('radio', { name: /WEB/ });
      fireEvent.click(webRadio);

      expect(mockSetTranslation).toHaveBeenCalledWith('web');
    });

    it('clears Bible cache when button clicked', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const clearButton = screen.getByText('Clear Bible Cache');
      fireEvent.click(clearButton);

      // Shows success message
      expect(screen.getByText('Bible cache cleared')).toBeInTheDocument();
    });
  });

  describe('import functionality', () => {
    it('triggers file input when Import Backup is clicked', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      // Find the file input
      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      const importButton = screen.getByText('Import Backup').closest('button');
      fireEvent.click(importButton!);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('imports valid backup file', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ inserted: 3, updated: 2 }),
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      const file = new File(
        [JSON.stringify({ notes: [{ id: '1' }, { id: '2' }, { id: '3' }] })],
        'backup.json',
        { type: 'application/json' }
      );

      // Mock the File.text() method
      file.text = vi.fn().mockResolvedValue(JSON.stringify({ notes: [{ id: '1' }, { id: '2' }, { id: '3' }] }));

      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText('Imported 3 new, updated 2 existing notes')).toBeInTheDocument();
      });

      expect(mockRefreshNotes).toHaveBeenCalled();
    });

    it('shows error for invalid backup format', async () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      const file = new File(
        [JSON.stringify({ invalid: 'format' })],
        'backup.json',
        { type: 'application/json' }
      );

      file.text = vi.fn().mockResolvedValue(JSON.stringify({ invalid: 'format' }));

      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText('Invalid backup file format')).toBeInTheDocument();
      });
    });

    it('handles import API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      const file = new File(
        [JSON.stringify({ notes: [{ id: '1' }] })],
        'backup.json',
        { type: 'application/json' }
      );

      file.text = vi.fn().mockResolvedValue(JSON.stringify({ notes: [{ id: '1' }] }));

      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText('Failed to import notes')).toBeInTheDocument();
      });
    });
  });

  describe('Systematic Theology section', () => {
    beforeEach(() => {
      mockImportData.mockReset();
      mockExportData.mockReset();
      mockGetCount.mockReset();
      mockDeleteAll.mockReset();
    });

    it('renders ST section', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      expect(screen.getByText('Systematic Theology')).toBeInTheDocument();
      expect(screen.getByText('Export Systematic Theology')).toBeInTheDocument();
      expect(screen.getByText('Import Systematic Theology')).toBeInTheDocument();
      expect(screen.getByText('Delete All Systematic Theology')).toBeInTheDocument();
    });

    it('exports ST data', async () => {
      mockExportData.mockResolvedValue({
        systematic_theology: [{ id: '1' }, { id: '2' }],
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const exportButton = screen.getByText('Export Systematic Theology').closest('button');
      fireEvent.click(exportButton!);

      await waitFor(() => {
        expect(mockExportData).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('Exported 2 entries successfully')).toBeInTheDocument();
      });
    });

    it('handles ST export error', async () => {
      mockExportData.mockRejectedValue(new Error('Export failed'));

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const exportButton = screen.getByText('Export Systematic Theology').closest('button');
      fireEvent.click(exportButton!);

      await waitFor(() => {
        expect(screen.getByText('Export failed')).toBeInTheDocument();
      });
    });

    it('shows ST import confirmation modal', async () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      // Find the ST file input (second file input)
      const fileInputs = document.querySelectorAll('input[type="file"][accept=".json"]');
      const stFileInput = fileInputs[1] as HTMLInputElement;

      const fileContent = JSON.stringify({ systematic_theology: [{ id: '1' }, { id: '2' }, { id: '3' }] });
      const file = new File([fileContent], 'st-backup.json', { type: 'application/json' });
      file.text = vi.fn().mockResolvedValue(fileContent);

      Object.defineProperty(stFileInput, 'files', { value: [file] });
      fireEvent.change(stFileInput);

      await waitFor(() => {
        expect(screen.getByText('Import Systematic Theology?')).toBeInTheDocument();
      });

      // The count is in a <strong> element
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText(/entries/)).toBeInTheDocument();
    });

    it('imports ST data on confirmation', async () => {
      mockImportData.mockResolvedValue({
        entries: 5,
        scriptureRefs: 100,
      });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const fileInputs = document.querySelectorAll('input[type="file"][accept=".json"]');
      const stFileInput = fileInputs[1] as HTMLInputElement;

      const fileContent = JSON.stringify({ systematic_theology: [{ id: '1' }] });
      const file = new File([fileContent], 'st-backup.json', { type: 'application/json' });
      file.text = vi.fn().mockResolvedValue(fileContent);

      Object.defineProperty(stFileInput, 'files', { value: [file] });
      fireEvent.change(stFileInput);

      await waitFor(() => {
        expect(screen.getByText('Import Systematic Theology?')).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: 'Import' });
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(mockImportData).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('Imported 5 entries, 100 scripture refs')).toBeInTheDocument();
      });
    });

    it('cancels ST import', async () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const fileInputs = document.querySelectorAll('input[type="file"][accept=".json"]');
      const stFileInput = fileInputs[1] as HTMLInputElement;

      const fileContent = JSON.stringify({ systematic_theology: [{ id: '1' }] });
      const file = new File([fileContent], 'st-backup.json', { type: 'application/json' });
      file.text = vi.fn().mockResolvedValue(fileContent);

      Object.defineProperty(stFileInput, 'files', { value: [file] });
      fireEvent.change(stFileInput);

      await waitFor(() => {
        expect(screen.getByText('Import Systematic Theology?')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      // Should return to main settings
      expect(screen.queryByText('Import Systematic Theology?')).not.toBeInTheDocument();
      expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
    });

    it('shows error for invalid ST file', async () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const fileInputs = document.querySelectorAll('input[type="file"][accept=".json"]');
      const stFileInput = fileInputs[1] as HTMLInputElement;

      const fileContent = JSON.stringify({ invalid: 'format' });
      const file = new File([fileContent], 'st-backup.json', { type: 'application/json' });
      file.text = vi.fn().mockResolvedValue(fileContent);

      Object.defineProperty(stFileInput, 'files', { value: [file] });
      fireEvent.change(stFileInput);

      await waitFor(() => {
        expect(screen.getByText('Invalid file: systematic_theology array required')).toBeInTheDocument();
      });
    });

    it('shows ST delete confirmation modal', async () => {
      mockGetCount.mockResolvedValue({ count: 10, annotationCount: 5 });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Systematic Theology').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Delete All Systematic Theology?')).toBeInTheDocument();
      });

      // Check the text content separately
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText(/doctrine entries/)).toBeInTheDocument();
      expect(screen.getByText(/5 annotations/)).toBeInTheDocument();
    });

    it('deletes ST data on confirmation', async () => {
      mockGetCount.mockResolvedValue({ count: 3, annotationCount: 0 });
      mockDeleteAll.mockResolvedValue({ deleted: { entries: 3 } });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Systematic Theology').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Delete All Systematic Theology?')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type DELETE');
      fireEvent.change(input, { target: { value: 'DELETE' } });

      const confirmButton = screen.getByRole('button', { name: 'Delete All' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteAll).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('Deleted 3 entries')).toBeInTheDocument();
      });
    });

    it('cancels ST delete', async () => {
      mockGetCount.mockResolvedValue({ count: 3, annotationCount: 0 });

      render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Systematic Theology').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Delete All Systematic Theology?')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      expect(screen.queryByText('Delete All Systematic Theology?')).not.toBeInTheDocument();
      expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
    });

    it('closes ST delete on Escape', async () => {
      mockGetCount.mockResolvedValue({ count: 3, annotationCount: 0 });

      const { container } = render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const deleteButton = screen.getByText('Delete All Systematic Theology').closest('button');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Delete All Systematic Theology?')).toBeInTheDocument();
      });

      const modal = container.querySelector('[class*="confirmModal"]');
      fireEvent.keyDown(modal!, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Delete All Systematic Theology?')).not.toBeInTheDocument();
      });
    });

    it('closes ST import on Escape', async () => {
      const { container } = render(<SettingsModal />);
      fireEvent.click(screen.getByLabelText('Open settings'));

      const fileInputs = document.querySelectorAll('input[type="file"][accept=".json"]');
      const stFileInput = fileInputs[1] as HTMLInputElement;

      const fileContent = JSON.stringify({ systematic_theology: [{ id: '1' }] });
      const file = new File([fileContent], 'st-backup.json', { type: 'application/json' });
      file.text = vi.fn().mockResolvedValue(fileContent);

      Object.defineProperty(stFileInput, 'files', { value: [file] });
      fireEvent.change(stFileInput);

      await waitFor(() => {
        expect(screen.getByText('Import Systematic Theology?')).toBeInTheDocument();
      });

      const modal = container.querySelector('[class*="confirmModal"]');
      fireEvent.keyDown(modal!, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Import Systematic Theology?')).not.toBeInTheDocument();
      });
    });
  });
});
