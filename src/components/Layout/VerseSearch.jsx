import { useState, useRef, useEffect } from 'react';
import { parseReference } from '../../utils/parseReference';
import { useBible } from '../../context/BibleContext';
import styles from './Layout.module.css';

export const VerseSearch = () => {
  const { navigate, setHighlightVerse } = useBible();
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!query.trim()) return;

    const parsed = parseReference(query);

    if (!parsed) {
      setError('Invalid reference');
      return;
    }

    // Navigate to the parsed reference
    navigate(parsed.bookId, parsed.startChapter);

    // If a specific verse was requested, scroll to it after navigation
    if (parsed.startVerse) {
      // Delay to allow chapter to load before scrolling
      setTimeout(() => setHighlightVerse(parsed.startVerse), 100);
    }

    setQuery('');
    setError('');
    inputRef.current?.blur();
  };

  const handleChange = (e) => {
    setQuery(e.target.value);
    if (error) setError('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setQuery('');
      setError('');
      inputRef.current?.blur();
    }
  };

  // Keyboard shortcut: Cmd/Ctrl + K to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <form onSubmit={handleSubmit} className={styles.searchForm}>
      <div className={`${styles.searchContainer} ${isFocused ? styles.focused : ''} ${error ? styles.hasError : ''}`}>
        <svg
          className={styles.searchIcon}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="Go to verse..."
          value={query}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
        />
        {!isFocused && !query && (
          <kbd className={styles.searchShortcut}>
            <span>⌘</span>K
          </kbd>
        )}
      </div>
      {error && isFocused && (
        <div className={styles.searchError}>{error}</div>
      )}
    </form>
  );
};

export default VerseSearch;
