import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

// Mock theme context
const mockToggleTheme = vi.fn();
let mockTheme = 'dark';

vi.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: mockTheme,
    toggleTheme: mockToggleTheme,
  }),
}));

import ThemeToggle from '../../../src/components/UI/ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = 'dark';
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders as a button', () => {
      render(<ThemeToggle />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('has aria-label for dark mode', () => {
      mockTheme = 'dark';

      render(<ThemeToggle />);

      expect(screen.getByLabelText('Switch to light mode')).toBeInTheDocument();
    });

    it('has aria-label for light mode', () => {
      mockTheme = 'light';

      render(<ThemeToggle />);

      expect(screen.getByLabelText('Switch to dark mode')).toBeInTheDocument();
    });

    it('renders sun icon in dark mode', () => {
      mockTheme = 'dark';

      const { container } = render(<ThemeToggle />);

      // Sun icon has a circle element
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.querySelector('circle')).toBeInTheDocument();
    });

    it('renders moon icon in light mode', () => {
      mockTheme = 'light';

      const { container } = render(<ThemeToggle />);

      // Moon icon has a path but no circle
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.querySelector('path')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls toggleTheme when clicked', () => {
      render(<ThemeToggle />);

      fireEvent.click(screen.getByRole('button'));

      expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    });

    it('calls toggleTheme on each click', () => {
      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockToggleTheme).toHaveBeenCalledTimes(3);
    });
  });

  describe('icon switching', () => {
    it('shows different icons for different themes', () => {
      mockTheme = 'dark';
      const { container, rerender } = render(<ThemeToggle />);

      // Dark mode - sun icon (has circle)
      let svg = container.querySelector('svg');
      expect(svg?.querySelector('circle')).toBeInTheDocument();

      // Change to light mode
      mockTheme = 'light';
      rerender(<ThemeToggle />);

      // Light mode - moon icon (no circle, has path with specific d attribute)
      svg = container.querySelector('svg');
      const path = svg?.querySelector('path');
      expect(path?.getAttribute('d')).toContain('21 12.79');
    });
  });
});
