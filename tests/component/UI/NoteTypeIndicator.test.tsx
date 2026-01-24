import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { NoteTypeIndicator } from '../../../src/components/UI/NoteTypeIndicator';

describe('NoteTypeIndicator', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering different types', () => {
    it('renders note type (default)', () => {
      const { container } = render(<NoteTypeIndicator type="note" />);

      const indicator = container.firstChild as HTMLElement;
      expect(indicator.getAttribute('data-type')).toBe('note');
    });

    it('renders commentary type', () => {
      const { container } = render(<NoteTypeIndicator type="commentary" />);

      const indicator = container.firstChild as HTMLElement;
      expect(indicator.getAttribute('data-type')).toBe('commentary');
    });

    it('renders sermon type', () => {
      const { container } = render(<NoteTypeIndicator type="sermon" />);

      const indicator = container.firstChild as HTMLElement;
      expect(indicator.getAttribute('data-type')).toBe('sermon');
    });

    it('defaults to note when type is undefined', () => {
      const { container } = render(<NoteTypeIndicator />);

      const indicator = container.firstChild as HTMLElement;
      expect(indicator.getAttribute('data-type')).toBe('note');
    });

    it('defaults to note when type is null', () => {
      const { container } = render(<NoteTypeIndicator type={null as any} />);

      const indicator = container.firstChild as HTMLElement;
      expect(indicator.getAttribute('data-type')).toBe('note');
    });

    it('handles unknown type by defaulting to note', () => {
      const { container } = render(<NoteTypeIndicator type={'unknown' as any} />);

      const indicator = container.firstChild as HTMLElement;
      expect(indicator.getAttribute('data-type')).toBe('unknown');
    });
  });

  describe('icon rendering', () => {
    it('renders icon for note type', () => {
      const { container } = render(<NoteTypeIndicator type="note" />);

      const iconContainer = container.querySelector('[class*="noteTypeIndicatorIcon"]');
      expect(iconContainer).toBeInTheDocument();
      expect(iconContainer?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders different icon for commentary type', () => {
      const { container } = render(<NoteTypeIndicator type="commentary" />);

      const iconContainer = container.querySelector('[class*="noteTypeIndicatorIcon"]');
      expect(iconContainer?.querySelector('svg')).toBeInTheDocument();
      // Commentary has book icon with two paths
      const paths = iconContainer?.querySelectorAll('path');
      expect(paths?.length).toBe(2);
    });

    it('renders different icon for sermon type', () => {
      const { container } = render(<NoteTypeIndicator type="sermon" />);

      const iconContainer = container.querySelector('[class*="noteTypeIndicatorIcon"]');
      expect(iconContainer?.querySelector('svg')).toBeInTheDocument();
      // Sermon has microphone icon with path and line
      const paths = iconContainer?.querySelectorAll('path');
      expect(paths).toBeTruthy();
    });
  });

  describe('label rendering', () => {
    it('does not show label by default', () => {
      render(<NoteTypeIndicator type="note" />);

      expect(screen.queryByText('Note')).not.toBeInTheDocument();
    });

    it('shows label when showLabel is true', () => {
      render(<NoteTypeIndicator type="note" showLabel />);

      expect(screen.getByText('Note')).toBeInTheDocument();
    });

    it('shows "Commentary" label for commentary type', () => {
      render(<NoteTypeIndicator type="commentary" showLabel />);

      expect(screen.getByText('Commentary')).toBeInTheDocument();
    });

    it('shows "Sermon" label for sermon type', () => {
      render(<NoteTypeIndicator type="sermon" showLabel />);

      expect(screen.getByText('Sermon')).toBeInTheDocument();
    });

    it('shows "Note" label for unknown type', () => {
      render(<NoteTypeIndicator type={'unknown' as any} showLabel />);

      expect(screen.getByText('Note')).toBeInTheDocument();
    });
  });

  describe('size variants', () => {
    it('applies sm size class by default', () => {
      const { container } = render(<NoteTypeIndicator type="note" />);

      const indicator = container.firstChild as HTMLElement;
      expect(indicator.className).toContain('sm');
    });

    it('applies md size class when specified', () => {
      const { container } = render(<NoteTypeIndicator type="note" size="md" />);

      const indicator = container.firstChild as HTMLElement;
      expect(indicator.className).toContain('md');
    });

    it('applies sm size class when specified', () => {
      const { container } = render(<NoteTypeIndicator type="note" size="sm" />);

      const indicator = container.firstChild as HTMLElement;
      expect(indicator.className).toContain('sm');
    });
  });

  describe('CSS class application', () => {
    it('has noteTypeIndicator class', () => {
      const { container } = render(<NoteTypeIndicator type="note" />);

      const indicator = container.firstChild as HTMLElement;
      expect(indicator.className).toContain('noteTypeIndicator');
    });

    it('has noteTypeIndicatorIcon class on icon container', () => {
      const { container } = render(<NoteTypeIndicator type="note" />);

      expect(container.querySelector('[class*="noteTypeIndicatorIcon"]')).toBeInTheDocument();
    });

    it('has noteTypeIndicatorLabel class on label when shown', () => {
      const { container } = render(<NoteTypeIndicator type="note" showLabel />);

      expect(container.querySelector('[class*="noteTypeIndicatorLabel"]')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('renders as span element', () => {
      const { container } = render(<NoteTypeIndicator type="note" />);

      const indicator = container.firstChild;
      expect(indicator?.nodeName).toBe('SPAN');
    });

    it('has proper data attribute for styling hooks', () => {
      const { container } = render(<NoteTypeIndicator type="sermon" />);

      const indicator = container.firstChild as HTMLElement;
      expect(indicator.dataset.type).toBe('sermon');
    });
  });
});
