import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import React, { useRef } from 'react';
import { SystematicLinkTooltip } from '../../../src/components/Notes/SystematicLinkTooltip';

// Mock the SystematicContext
vi.mock('../../../src/context/SystematicContext', () => ({
  useSystematic: vi.fn(),
}));

// Mock createPortal
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (node: any) => node,
  };
});

import { useSystematic } from '../../../src/context/SystematicContext';

const mockTree = [
  {
    id: 'part-1',
    entryType: 'part',
    children: [
      {
        id: 'ch-32',
        entryType: 'chapter',
        chapterNumber: 32,
        title: 'The Trinity',
        summary: 'God eternally exists as three persons.',
        children: [
          {
            id: 'sec-32-a',
            entryType: 'section',
            chapterNumber: 32,
            sectionLetter: 'A',
            title: 'God is Three Persons',
            summary: 'Scripture reveals three distinct persons.',
            children: [
              {
                id: 'subsec-32-a-1',
                entryType: 'subsection',
                chapterNumber: 32,
                sectionLetter: 'A',
                subsectionNumber: 1,
                title: 'The Father',
                summary: 'The Father is God.',
              },
            ],
          },
        ],
      },
    ],
  },
];

// Test wrapper component that provides ref
function TestWrapper({ children }: { children: (ref: React.RefObject<HTMLDivElement>) => React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef} data-testid="container">
      {children(containerRef)}
    </div>
  );
}

describe('SystematicLinkTooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (useSystematic as any).mockReturnValue({
      tree: mockTree,
    });

    // Mock matchMedia for hover detection
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false, // Not a touch device
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders nothing initially', () => {
      const { container } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="Ch32">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      expect(container.querySelector('[class*="tooltip"]')).not.toBeInTheDocument();
    });

    it('returns null on touch devices', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: true, // Is a touch device
          media: query,
        })),
      });

      const { container } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="Ch32">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      // Hover over link
      const link = container.querySelector('[data-st-ref]');
      fireEvent.mouseOver(link!);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(container.querySelector('[class*="tooltip"]')).not.toBeInTheDocument();
    });
  });

  describe('hover behavior', () => {
    it('shows tooltip after hover delay', async () => {
      const { container } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="Ch32">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      const link = container.querySelector('[data-st-ref]');
      fireEvent.mouseOver(link!);

      // Before delay
      expect(container.querySelector('[class*="tooltip"]')).not.toBeInTheDocument();

      // After delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(container.querySelector('[class*="tooltip"]')).toBeInTheDocument();
      });
    });

    it('hides tooltip on mouse out', async () => {
      const { container } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="Ch32">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      const link = container.querySelector('[data-st-ref]');

      // Show tooltip
      fireEvent.mouseOver(link!);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(container.querySelector('[class*="tooltip"]')).toBeInTheDocument();
      });

      // Hide tooltip
      fireEvent.mouseOut(link!);
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(container.querySelector('[class*="tooltip"]')).not.toBeInTheDocument();
      });
    });
  });

  describe('tooltip content', () => {
    it('shows chapter information', async () => {
      const { container, getByText } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="Ch32">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      const link = container.querySelector('[data-st-ref]');
      fireEvent.mouseOver(link!);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(getByText('Ch32')).toBeInTheDocument();
        expect(getByText('The Trinity')).toBeInTheDocument();
        expect(getByText('God eternally exists as three persons.')).toBeInTheDocument();
      });
    });

    it('shows section information', async () => {
      const { container, getByText } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="Ch32:A">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      const link = container.querySelector('[data-st-ref]');
      fireEvent.mouseOver(link!);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(getByText('Ch32:A')).toBeInTheDocument();
        expect(getByText('God is Three Persons')).toBeInTheDocument();
        expect(getByText('Scripture reveals three distinct persons.')).toBeInTheDocument();
      });
    });

    it('shows subsection information', async () => {
      const { container, getByText } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="Ch32:A.1">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      const link = container.querySelector('[data-st-ref]');
      fireEvent.mouseOver(link!);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(getByText('Ch32:A.1')).toBeInTheDocument();
        expect(getByText('The Father')).toBeInTheDocument();
        expect(getByText('The Father is God.')).toBeInTheDocument();
      });
    });

    it('shows "No summary available" when entry has no summary', async () => {
      (useSystematic as any).mockReturnValue({
        tree: [
          {
            id: 'part-1',
            entryType: 'part',
            children: [
              {
                id: 'ch-99',
                entryType: 'chapter',
                chapterNumber: 99,
                title: 'Test Chapter',
                summary: null,
                children: [],
              },
            ],
          },
        ],
      });

      const { container, getByText } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="Ch99">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      const link = container.querySelector('[data-st-ref]');
      fireEvent.mouseOver(link!);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(getByText('No summary available')).toBeInTheDocument();
      });
    });
  });

  describe('reference parsing', () => {
    it('does not show tooltip for invalid reference', async () => {
      const { container } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="invalid">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      const link = container.querySelector('[data-st-ref]');
      fireEvent.mouseOver(link!);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(container.querySelector('[class*="tooltip"]')).not.toBeInTheDocument();
    });

    it('does not show tooltip for non-existent chapter', async () => {
      const { container } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="Ch999">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      const link = container.querySelector('[data-st-ref]');
      fireEvent.mouseOver(link!);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(container.querySelector('[class*="tooltip"]')).not.toBeInTheDocument();
    });

    it('handles case-insensitive references', async () => {
      const { container, getByText } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="ch32:a">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      const link = container.querySelector('[data-st-ref]');
      fireEvent.mouseOver(link!);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(getByText('God is Three Persons')).toBeInTheDocument();
      });
    });
  });

  describe('event handling', () => {
    it('hides tooltip on scroll', async () => {
      const { container } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="Ch32">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      const link = container.querySelector('[data-st-ref]');

      // Show tooltip
      fireEvent.mouseOver(link!);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(container.querySelector('[class*="tooltip"]')).toBeInTheDocument();
      });

      // Scroll
      fireEvent.scroll(window);

      await waitFor(() => {
        expect(container.querySelector('[class*="tooltip"]')).not.toBeInTheDocument();
      });
    });

    it('keeps tooltip visible when hovering over tooltip', async () => {
      const { container } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="Ch32">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      const link = container.querySelector('[data-st-ref]');

      // Show tooltip
      fireEvent.mouseOver(link!);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(container.querySelector('[class*="tooltip"]')).toBeInTheDocument();
      });

      // Hover over tooltip
      const tooltip = container.querySelector('[class*="tooltip"]');
      fireEvent.mouseEnter(tooltip!);

      // Tooltip should remain
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(container.querySelector('[class*="tooltip"]')).toBeInTheDocument();
    });

    it('hides tooltip when leaving tooltip', async () => {
      const { container } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="Ch32">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      const link = container.querySelector('[data-st-ref]');

      // Show tooltip
      fireEvent.mouseOver(link!);
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(container.querySelector('[class*="tooltip"]')).toBeInTheDocument();
      });

      // Leave tooltip
      const tooltip = container.querySelector('[class*="tooltip"]');
      fireEvent.mouseLeave(tooltip!);

      await waitFor(() => {
        expect(container.querySelector('[class*="tooltip"]')).not.toBeInTheDocument();
      });
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(HTMLElement.prototype, 'removeEventListener');

      const { unmount } = render(
        <TestWrapper>
          {(ref) => (
            <>
              <span data-st-ref="Ch32">Link</span>
              <SystematicLinkTooltip editorContainerRef={ref} />
            </>
          )}
        </TestWrapper>
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalled();
      removeEventListenerSpy.mockRestore();
    });
  });
});
