import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import Verse from '../../../src/components/Bible/Verse';

describe('Verse', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders verse number', () => {
      render(
        <Verse
          number={1}
          text="In the beginning God created the heavens and the earth."
          isHighlighted={false}
          isFirstInRange={false}
          isLastInRange={false}
          onClick={vi.fn()}
        />
      );

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('renders verse text', () => {
      render(
        <Verse
          number={1}
          text="In the beginning God created the heavens and the earth."
          isHighlighted={false}
          isFirstInRange={false}
          isLastInRange={false}
          onClick={vi.fn()}
        />
      );

      expect(screen.getByText('In the beginning God created the heavens and the earth.')).toBeInTheDocument();
    });

    it('renders verse number in superscript', () => {
      const { container } = render(
        <Verse
          number={16}
          text="For God so loved the world..."
          isHighlighted={false}
          isFirstInRange={false}
          isLastInRange={false}
          onClick={vi.fn()}
        />
      );

      const sup = container.querySelector('sup');
      expect(sup).toBeInTheDocument();
      expect(sup?.textContent).toBe('16');
    });

    it('has data-verse attribute with verse number', () => {
      const { container } = render(
        <Verse
          number={28}
          text="And we know that in all things God works for the good..."
          isHighlighted={false}
          isFirstInRange={false}
          isLastInRange={false}
          onClick={vi.fn()}
        />
      );

      const verseElement = container.firstChild as HTMLElement;
      expect(verseElement.getAttribute('data-verse')).toBe('28');
    });
  });

  describe('highlighting', () => {
    it('applies highlighted class when isHighlighted is true', () => {
      const { container } = render(
        <Verse
          number={1}
          text="Test verse"
          isHighlighted={true}
          isFirstInRange={false}
          isLastInRange={false}
          onClick={vi.fn()}
        />
      );

      const verseElement = container.firstChild as HTMLElement;
      expect(verseElement.className).toContain('highlighted');
    });

    it('does not apply highlighted class when isHighlighted is false', () => {
      const { container } = render(
        <Verse
          number={1}
          text="Test verse"
          isHighlighted={false}
          isFirstInRange={false}
          isLastInRange={false}
          onClick={vi.fn()}
        />
      );

      const verseElement = container.firstChild as HTMLElement;
      expect(verseElement.className).not.toContain('highlighted');
    });

    it('applies rangeStart class when isFirstInRange is true', () => {
      const { container } = render(
        <Verse
          number={1}
          text="Test verse"
          isHighlighted={true}
          isFirstInRange={true}
          isLastInRange={false}
          onClick={vi.fn()}
        />
      );

      const verseElement = container.firstChild as HTMLElement;
      expect(verseElement.className).toContain('rangeStart');
    });

    it('applies rangeEnd class when isLastInRange is true', () => {
      const { container } = render(
        <Verse
          number={7}
          text="Test verse"
          isHighlighted={true}
          isFirstInRange={false}
          isLastInRange={true}
          onClick={vi.fn()}
        />
      );

      const verseElement = container.firstChild as HTMLElement;
      expect(verseElement.className).toContain('rangeEnd');
    });

    it('applies both rangeStart and rangeEnd for single verse highlight', () => {
      const { container } = render(
        <Verse
          number={16}
          text="For God so loved the world..."
          isHighlighted={true}
          isFirstInRange={true}
          isLastInRange={true}
          onClick={vi.fn()}
        />
      );

      const verseElement = container.firstChild as HTMLElement;
      expect(verseElement.className).toContain('highlighted');
      expect(verseElement.className).toContain('rangeStart');
      expect(verseElement.className).toContain('rangeEnd');
    });
  });

  describe('interactions', () => {
    it('calls onClick when verse is clicked', () => {
      const mockOnClick = vi.fn();

      const { container } = render(
        <Verse
          number={1}
          text="Test verse"
          isHighlighted={false}
          isFirstInRange={false}
          isLastInRange={false}
          onClick={mockOnClick}
        />
      );

      const verseElement = container.firstChild as HTMLElement;
      fireEvent.click(verseElement);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('does not throw when onClick is undefined', () => {
      const { container } = render(
        <Verse
          number={1}
          text="Test verse"
          isHighlighted={false}
          isFirstInRange={false}
          isLastInRange={false}
          onClick={undefined as unknown as () => void}
        />
      );

      const verseElement = container.firstChild as HTMLElement;
      expect(() => fireEvent.click(verseElement)).not.toThrow();
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to the span element', () => {
      const ref = React.createRef<HTMLSpanElement>();

      render(
        <Verse
          ref={ref}
          number={1}
          text="Test verse"
          isHighlighted={false}
          isFirstInRange={false}
          isLastInRange={false}
          onClick={vi.fn()}
        />
      );

      expect(ref.current).toBeInstanceOf(HTMLSpanElement);
      expect(ref.current?.getAttribute('data-verse')).toBe('1');
    });
  });

  describe('edge cases', () => {
    it('handles empty text', () => {
      render(
        <Verse
          number={1}
          text=""
          isHighlighted={false}
          isFirstInRange={false}
          isLastInRange={false}
          onClick={vi.fn()}
        />
      );

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('handles large verse numbers', () => {
      render(
        <Verse
          number={176}
          text="I have strayed like a lost sheep. Seek your servant..."
          isHighlighted={false}
          isFirstInRange={false}
          isLastInRange={false}
          onClick={vi.fn()}
        />
      );

      expect(screen.getByText('176')).toBeInTheDocument();
    });

    it('handles special characters in text', () => {
      const specialText = 'Test with special chars: & < > "';
      render(
        <Verse
          number={1}
          text={specialText}
          isHighlighted={false}
          isFirstInRange={false}
          isLastInRange={false}
          onClick={vi.fn()}
        />
      );

      expect(screen.getByText(specialText)).toBeInTheDocument();
    });
  });
});
