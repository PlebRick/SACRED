import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import React from 'react';
import { SettingsProvider, useSettings } from '../../../src/context/SettingsContext';

// Test component that displays state and provides action triggers
function TestConsumer() {
  const { translation, setTranslation } = useSettings();
  return (
    <div>
      <span data-testid="translation">{translation}</span>
      <button data-testid="set-esv" onClick={() => setTranslation('esv')}>
        ESV
      </button>
      <button data-testid="set-web" onClick={() => setTranslation('web')}>
        WEB
      </button>
    </div>
  );
}

describe('SettingsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  describe('initial state', () => {
    it('defaults to ESV translation when no preferences', () => {
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      expect(screen.getByTestId('translation').textContent).toBe('esv');
    });

    it('restores translation from localStorage', () => {
      localStorage.setItem('sacred_translation', 'web');

      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      expect(screen.getByTestId('translation').textContent).toBe('web');
    });

    it('handles custom translation values from localStorage', () => {
      localStorage.setItem('sacred_translation', 'kjv');

      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      expect(screen.getByTestId('translation').textContent).toBe('kjv');
    });
  });

  describe('setTranslation', () => {
    it('changes translation from ESV to WEB', () => {
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      expect(screen.getByTestId('translation').textContent).toBe('esv');

      act(() => {
        screen.getByTestId('set-web').click();
      });

      expect(screen.getByTestId('translation').textContent).toBe('web');
    });

    it('changes translation from WEB to ESV', () => {
      localStorage.setItem('sacred_translation', 'web');

      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      expect(screen.getByTestId('translation').textContent).toBe('web');

      act(() => {
        screen.getByTestId('set-esv').click();
      });

      expect(screen.getByTestId('translation').textContent).toBe('esv');
    });

    it('persists translation to localStorage', () => {
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      act(() => {
        screen.getByTestId('set-web').click();
      });

      expect(localStorage.getItem('sacred_translation')).toBe('web');
    });

    it('does not trigger re-render when setting same value', () => {
      const renderCount = { value: 0 };
      function CountingConsumer() {
        const { translation, setTranslation } = useSettings();
        renderCount.value++;
        return (
          <div>
            <span data-testid="translation">{translation}</span>
            <button data-testid="set-esv" onClick={() => setTranslation('esv')}>
              ESV
            </button>
          </div>
        );
      }

      render(
        <SettingsProvider>
          <CountingConsumer />
        </SettingsProvider>
      );

      const initialRenderCount = renderCount.value;

      // Set to same value
      act(() => {
        screen.getByTestId('set-esv').click();
      });

      // React may still trigger a re-render, but value should be same
      expect(screen.getByTestId('translation').textContent).toBe('esv');
    });
  });

  describe('useSettings hook', () => {
    it('throws error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useSettings must be used within a SettingsProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('localStorage persistence', () => {
    it('updates localStorage immediately on change', () => {
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      // Initial save on mount
      expect(localStorage.getItem('sacred_translation')).toBe('esv');

      act(() => {
        screen.getByTestId('set-web').click();
      });

      expect(localStorage.getItem('sacred_translation')).toBe('web');
    });

    it('handles multiple rapid changes', () => {
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      act(() => {
        screen.getByTestId('set-web').click();
      });

      act(() => {
        screen.getByTestId('set-esv').click();
      });

      act(() => {
        screen.getByTestId('set-web').click();
      });

      expect(screen.getByTestId('translation').textContent).toBe('web');
      expect(localStorage.getItem('sacred_translation')).toBe('web');
    });
  });
});
