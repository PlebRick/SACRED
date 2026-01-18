import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import VerseSearch from '../../../src/components/Layout/VerseSearch';
import { BibleProvider } from '../../../src/context/BibleContext';

// Create a test wrapper that provides context
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <BibleProvider>{children}</BibleProvider>;
}

describe('VerseSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  describe('rendering', () => {
    it('renders search input', () => {
      render(
        <TestWrapper>
          <VerseSearch />
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText('Go to verse...')).toBeInTheDocument();
    });

    it('has a search form', () => {
      render(
        <TestWrapper>
          <VerseSearch />
        </TestWrapper>
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('navigates on valid submission and clears input', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <VerseSearch />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Go to verse...') as HTMLInputElement;
      await user.type(input, 'Romans 1');

      // Submit the form
      fireEvent.submit(input.closest('form')!);

      // Check that localStorage was updated (indicating navigation occurred)
      const stored = JSON.parse(localStorage.getItem('sacred_bible_location') || '{}');
      expect(stored.bookId).toBe('ROM');
      expect(stored.chapter).toBe(1);

      // Input should be cleared
      expect(input.value).toBe('');
    });

    it('shows error for invalid reference when focused', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <VerseSearch />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Go to verse...');
      await user.click(input); // Focus
      await user.type(input, 'invalid');
      fireEvent.submit(input.closest('form')!);

      // Error should be visible when focused
      expect(screen.getByText('Invalid reference')).toBeInTheDocument();
    });

    it('clears error when input changes', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <VerseSearch />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Go to verse...');
      await user.click(input);
      await user.type(input, 'invalid');
      fireEvent.submit(input.closest('form')!);

      expect(screen.getByText('Invalid reference')).toBeInTheDocument();

      // Type more - error should clear
      await user.type(input, 'x');
      expect(screen.queryByText('Invalid reference')).not.toBeInTheDocument();
    });
  });

  describe('keyboard shortcuts', () => {
    it('clears input on Escape', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <VerseSearch />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Go to verse...') as HTMLInputElement;
      await user.type(input, 'some text');
      expect(input.value).toBe('some text');

      fireEvent.keyDown(input, { key: 'Escape' });
      expect(input.value).toBe('');
    });

    it('focuses input on Cmd+K', () => {
      render(
        <TestWrapper>
          <VerseSearch />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Go to verse...');

      // Simulate Cmd+K
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(document.activeElement).toBe(input);
    });
  });

  describe('various reference formats', () => {
    it('accepts abbreviated book names', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <VerseSearch />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Go to verse...');
      await user.type(input, 'Rom 8');
      fireEvent.submit(input.closest('form')!);

      const stored = JSON.parse(localStorage.getItem('sacred_bible_location') || '{}');
      expect(stored.bookId).toBe('ROM');
      expect(stored.chapter).toBe(8);
    });

    it('accepts verse references', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <VerseSearch />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Go to verse...');
      await user.type(input, 'John 3:16');
      fireEvent.submit(input.closest('form')!);

      const stored = JSON.parse(localStorage.getItem('sacred_bible_location') || '{}');
      expect(stored.bookId).toBe('JHN');
      expect(stored.chapter).toBe(3);
    });

    it('accepts numbered books', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <VerseSearch />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Go to verse...');
      await user.type(input, '1 Corinthians 13');
      fireEvent.submit(input.closest('form')!);

      const stored = JSON.parse(localStorage.getItem('sacred_bible_location') || '{}');
      expect(stored.bookId).toBe('1CO');
      expect(stored.chapter).toBe(13);
    });
  });
});
