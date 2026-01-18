import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const STORAGE_KEY = 'sacred_theme';
const HIGHLIGHTS_KEY = 'sacred_highlights_visible';

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }

    return 'dark';
  });

  const [highlightsVisible, setHighlightsVisible] = useState(() => {
    const stored = localStorage.getItem(HIGHLIGHTS_KEY);
    return stored !== 'false'; // Default to true
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-highlights', highlightsVisible ? 'visible' : 'hidden');
    localStorage.setItem(HIGHLIGHTS_KEY, highlightsVisible);
  }, [highlightsVisible]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const toggleHighlights = () => {
    setHighlightsVisible(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, highlightsVisible, toggleHighlights }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
