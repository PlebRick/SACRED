import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import NoteCard from '../../../src/components/Notes/NoteCard';

describe('NoteCard', () => {
  const mockNote = {
    id: 'note-1',
    book: 'ROM',
    startChapter: 8,
    startVerse: 28,
    endChapter: 8,
    endVerse: 30,
    title: 'Test Note Title',
    content: '<p>This is the note content that should be displayed as a preview.</p>',
    type: 'note',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T12:00:00.000Z',
  };

  const mockOnSelect = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders the note reference', () => {
      render(
        <NoteCard
          note={mockNote}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Romans 8:28-30')).toBeInTheDocument();
    });

    it('renders the note title', () => {
      render(
        <NoteCard
          note={mockNote}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Test Note Title')).toBeInTheDocument();
    });

    it('renders "Untitled Note" when title is empty', () => {
      const noteWithoutTitle = { ...mockNote, title: '' };

      render(
        <NoteCard
          note={noteWithoutTitle}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Untitled Note')).toBeInTheDocument();
    });

    it('renders content preview with HTML stripped', () => {
      render(
        <NoteCard
          note={mockNote}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('This is the note content that should be displayed as a preview.')).toBeInTheDocument();
    });

    it('truncates long content preview', () => {
      const longContent = '<p>' + 'A'.repeat(100) + '</p>';
      const noteWithLongContent = { ...mockNote, content: longContent };

      render(
        <NoteCard
          note={noteWithLongContent}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const preview = screen.getByText(/^A+\.\.\.$/);
      expect(preview.textContent).toHaveLength(83); // 80 chars + "..."
    });

    it('shows "No content yet..." when content is empty', () => {
      const noteWithoutContent = { ...mockNote, content: '' };

      render(
        <NoteCard
          note={noteWithoutContent}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('No content yet...')).toBeInTheDocument();
    });

    it('displays the updated date', () => {
      render(
        <NoteCard
          note={mockNote}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      // Date format depends on locale, just check it's rendered
      expect(screen.getByText(/2024/)).toBeInTheDocument();
    });

    it('has delete button with aria-label', () => {
      render(
        <NoteCard
          note={mockNote}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByLabelText('Delete note')).toBeInTheDocument();
    });
  });

  describe('selection state', () => {
    it('applies selected class when isSelected is true', () => {
      const { container } = render(
        <NoteCard
          note={mockNote}
          isSelected={true}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('selected');
    });

    it('applies active class when isActive is true', () => {
      const { container } = render(
        <NoteCard
          note={mockNote}
          isSelected={false}
          isActive={true}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('active');
    });

    it('applies both selected and active classes', () => {
      const { container } = render(
        <NoteCard
          note={mockNote}
          isSelected={true}
          isActive={true}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('selected');
      expect(card.className).toContain('active');
    });

    it('does not apply selected/active classes when both are false', () => {
      const { container } = render(
        <NoteCard
          note={mockNote}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).not.toContain('selected');
      expect(card.className).not.toContain('active');
    });
  });

  describe('interactions', () => {
    it('calls onSelect when card is clicked', () => {
      const { container } = render(
        <NoteCard
          note={mockNote}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const card = container.firstChild as HTMLElement;
      fireEvent.click(card);

      expect(mockOnSelect).toHaveBeenCalledWith('note-1');
    });

    it('calls onDelete when delete button is clicked and confirmed', () => {
      // Mock window.confirm to return true
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(
        <NoteCard
          note={mockNote}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByLabelText('Delete note');
      fireEvent.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith('Delete this note?');
      expect(mockOnDelete).toHaveBeenCalledWith('note-1');
    });

    it('does not call onDelete when delete is cancelled', () => {
      // Mock window.confirm to return false
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(
        <NoteCard
          note={mockNote}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByLabelText('Delete note');
      fireEvent.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith('Delete this note?');
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('does not trigger onSelect when delete button is clicked', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(
        <NoteCard
          note={mockNote}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByLabelText('Delete note');
      fireEvent.click(deleteButton);

      // onSelect should not be called because of stopPropagation
      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('data attributes', () => {
    it('has data-note-id attribute', () => {
      const { container } = render(
        <NoteCard
          note={mockNote}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.getAttribute('data-note-id')).toBe('note-1');
    });
  });

  describe('edge cases', () => {
    it('handles null content', () => {
      const noteWithNullContent = { ...mockNote, content: null as unknown as string };

      render(
        <NoteCard
          note={noteWithNullContent}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('No content yet...')).toBeInTheDocument();
    });

    it('handles content that is exactly 80 characters', () => {
      const exactContent = '<p>' + 'B'.repeat(80) + '</p>';
      const noteWithExactContent = { ...mockNote, content: exactContent };

      render(
        <NoteCard
          note={noteWithExactContent}
          isSelected={false}
          isActive={false}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      // Should not be truncated
      const preview = screen.getByText('B'.repeat(80));
      expect(preview.textContent).toHaveLength(80);
    });
  });
});
