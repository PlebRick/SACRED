import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import Button from '../../../src/components/UI/Button';

describe('Button', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders children', () => {
      render(<Button>Click me</Button>);

      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('renders as button element', () => {
      render(<Button>Test</Button>);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders with default variant class', () => {
      const { container } = render(<Button>Test</Button>);

      const button = container.querySelector('button');
      expect(button?.className).toContain('default');
    });

    it('renders with default size class', () => {
      const { container } = render(<Button>Test</Button>);

      const button = container.querySelector('button');
      expect(button?.className).toContain('md');
    });
  });

  describe('variants', () => {
    it('applies primary variant class', () => {
      const { container } = render(<Button variant="primary">Primary</Button>);

      const button = container.querySelector('button');
      expect(button?.className).toContain('primary');
    });

    it('applies secondary variant class', () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>);

      const button = container.querySelector('button');
      expect(button?.className).toContain('secondary');
    });

    it('applies danger variant class', () => {
      const { container } = render(<Button variant="danger">Danger</Button>);

      const button = container.querySelector('button');
      expect(button?.className).toContain('danger');
    });
  });

  describe('sizes', () => {
    it('applies sm size class', () => {
      const { container } = render(<Button size="sm">Small</Button>);

      const button = container.querySelector('button');
      expect(button?.className).toContain('sm');
    });

    it('applies lg size class', () => {
      const { container } = render(<Button size="lg">Large</Button>);

      const button = container.querySelector('button');
      expect(button?.className).toContain('lg');
    });
  });

  describe('custom className', () => {
    it('applies custom className', () => {
      const { container } = render(<Button className="custom-class">Custom</Button>);

      const button = container.querySelector('button');
      expect(button?.className).toContain('custom-class');
    });

    it('combines custom className with default classes', () => {
      const { container } = render(
        <Button className="my-custom" variant="primary" size="lg">
          Combined
        </Button>
      );

      const button = container.querySelector('button');
      expect(button?.className).toContain('my-custom');
      expect(button?.className).toContain('primary');
      expect(button?.className).toContain('lg');
    });
  });

  describe('props spreading', () => {
    it('passes onClick handler', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Clickable</Button>);

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('passes disabled prop', () => {
      render(<Button disabled>Disabled</Button>);

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('passes type prop', () => {
      render(<Button type="submit">Submit</Button>);

      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('passes aria-label prop', () => {
      render(<Button aria-label="Custom label">Icon</Button>);

      expect(screen.getByLabelText('Custom label')).toBeInTheDocument();
    });

    it('passes data attributes', () => {
      const { container } = render(<Button data-testid="test-button">Test</Button>);

      expect(container.querySelector('[data-testid="test-button"]')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles empty children', () => {
      const { container } = render(<Button>{''}</Button>);

      expect(container.querySelector('button')).toBeInTheDocument();
    });

    it('handles complex children', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>
      );

      expect(screen.getByText('Icon')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
    });
  });
});
