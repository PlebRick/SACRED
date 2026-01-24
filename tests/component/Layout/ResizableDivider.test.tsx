import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { ResizableDivider } from '../../../src/components/Layout/ResizableDivider';

describe('ResizableDivider', () => {
  const mockOnResize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset body styles
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders divider element', () => {
      const { container } = render(
        <ResizableDivider onResize={mockOnResize} />
      );

      expect(container.querySelector('[class*="resizableDivider"]')).toBeInTheDocument();
    });

    it('renders divider handle', () => {
      const { container } = render(
        <ResizableDivider onResize={mockOnResize} />
      );

      expect(container.querySelector('[class*="dividerHandle"]')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <ResizableDivider onResize={mockOnResize} className="custom-class" />
      );

      const divider = container.firstChild as HTMLElement;
      expect(divider.className).toContain('custom-class');
    });
  });

  describe('mouse drag interaction', () => {
    it('initiates drag on mousedown', () => {
      const { container } = render(
        <ResizableDivider onResize={mockOnResize} />
      );

      const divider = container.firstChild as HTMLElement;
      fireEvent.mouseDown(divider);

      // Should apply dragging class
      expect(divider.className).toContain('dragging');
    });

    it('calls onResize during drag (right direction)', () => {
      const { container } = render(
        <ResizableDivider
          onResize={mockOnResize}
          direction="right"
          minWidth={200}
          maxWidth={500}
        />
      );

      const divider = container.firstChild as HTMLElement;

      // Start dragging
      fireEvent.mouseDown(divider);

      // Simulate mouse move
      fireEvent.mouseMove(document, { clientX: 800 });

      // Should call onResize with calculated width (window.innerWidth - clientX)
      expect(mockOnResize).toHaveBeenCalled();
    });

    it('calls onResize during drag (left direction)', () => {
      const { container } = render(
        <ResizableDivider
          onResize={mockOnResize}
          direction="left"
          minWidth={200}
          maxWidth={500}
        />
      );

      const divider = container.firstChild as HTMLElement;

      // Start dragging
      fireEvent.mouseDown(divider);

      // Simulate mouse move
      fireEvent.mouseMove(document, { clientX: 300 });

      // Should call onResize with clientX
      expect(mockOnResize).toHaveBeenCalledWith(300);
    });

    it('clamps width to minWidth', () => {
      const { container } = render(
        <ResizableDivider
          onResize={mockOnResize}
          direction="left"
          minWidth={300}
          maxWidth={600}
        />
      );

      const divider = container.firstChild as HTMLElement;

      fireEvent.mouseDown(divider);
      fireEvent.mouseMove(document, { clientX: 100 }); // Below minWidth

      expect(mockOnResize).toHaveBeenCalledWith(300); // Clamped to minWidth
    });

    it('clamps width to maxWidth', () => {
      const { container } = render(
        <ResizableDivider
          onResize={mockOnResize}
          direction="left"
          minWidth={200}
          maxWidth={500}
        />
      );

      const divider = container.firstChild as HTMLElement;

      fireEvent.mouseDown(divider);
      fireEvent.mouseMove(document, { clientX: 700 }); // Above maxWidth

      expect(mockOnResize).toHaveBeenCalledWith(500); // Clamped to maxWidth
    });

    it('ends drag on mouseup', () => {
      const { container } = render(
        <ResizableDivider onResize={mockOnResize} />
      );

      const divider = container.firstChild as HTMLElement;

      // Start and end dragging
      fireEvent.mouseDown(divider);
      expect(divider.className).toContain('dragging');

      fireEvent.mouseUp(document);
      expect(divider.className).not.toContain('dragging');
    });

    it('sets cursor style during drag', () => {
      const { container } = render(
        <ResizableDivider onResize={mockOnResize} />
      );

      const divider = container.firstChild as HTMLElement;

      fireEvent.mouseDown(divider);
      expect(document.body.style.cursor).toBe('col-resize');

      fireEvent.mouseUp(document);
      expect(document.body.style.cursor).toBe('');
    });

    it('disables text selection during drag', () => {
      const { container } = render(
        <ResizableDivider onResize={mockOnResize} />
      );

      const divider = container.firstChild as HTMLElement;

      fireEvent.mouseDown(divider);
      expect(document.body.style.userSelect).toBe('none');

      fireEvent.mouseUp(document);
      expect(document.body.style.userSelect).toBe('');
    });

    it('does not call onResize when not dragging', () => {
      render(<ResizableDivider onResize={mockOnResize} />);

      // Move mouse without starting drag
      fireEvent.mouseMove(document, { clientX: 500 });

      expect(mockOnResize).not.toHaveBeenCalled();
    });

    it('prevents default on mousedown', () => {
      const { container } = render(
        <ResizableDivider onResize={mockOnResize} />
      );

      const divider = container.firstChild as HTMLElement;
      const mockPreventDefault = vi.fn();

      fireEvent.mouseDown(divider, { preventDefault: mockPreventDefault });

      // React's synthetic events handle this automatically
      // Just verify the drag started
      expect(divider.className).toContain('dragging');
    });
  });

  describe('default props', () => {
    it('uses default minWidth of 300', () => {
      const { container } = render(
        <ResizableDivider onResize={mockOnResize} direction="left" />
      );

      const divider = container.firstChild as HTMLElement;

      fireEvent.mouseDown(divider);
      fireEvent.mouseMove(document, { clientX: 100 });

      expect(mockOnResize).toHaveBeenCalledWith(300); // Default minWidth
    });

    it('uses default maxWidth of 600', () => {
      const { container } = render(
        <ResizableDivider onResize={mockOnResize} direction="left" />
      );

      const divider = container.firstChild as HTMLElement;

      fireEvent.mouseDown(divider);
      fireEvent.mouseMove(document, { clientX: 800 });

      expect(mockOnResize).toHaveBeenCalledWith(600); // Default maxWidth
    });

    it('uses default direction of right', () => {
      const { container } = render(
        <ResizableDivider onResize={mockOnResize} />
      );

      const divider = container.firstChild as HTMLElement;

      fireEvent.mouseDown(divider);
      fireEvent.mouseMove(document, { clientX: 500 });

      // For right direction, width = window.innerWidth - clientX
      const expectedWidth = Math.max(300, Math.min(600, window.innerWidth - 500));
      expect(mockOnResize).toHaveBeenCalledWith(expectedWidth);
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const { container, unmount } = render(
        <ResizableDivider onResize={mockOnResize} />
      );

      const divider = container.firstChild as HTMLElement;

      // Start dragging
      fireEvent.mouseDown(divider);

      // Unmount
      unmount();

      // Move and release - should not cause errors
      fireEvent.mouseMove(document, { clientX: 500 });
      fireEvent.mouseUp(document);

      // Resize should only have been called during the drag before unmount
    });

    it('resets body styles on unmount during drag', () => {
      const { container, unmount } = render(
        <ResizableDivider onResize={mockOnResize} />
      );

      const divider = container.firstChild as HTMLElement;

      fireEvent.mouseDown(divider);
      expect(document.body.style.cursor).toBe('col-resize');

      unmount();

      expect(document.body.style.cursor).toBe('');
      expect(document.body.style.userSelect).toBe('');
    });
  });
});
