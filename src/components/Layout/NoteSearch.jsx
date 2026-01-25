import { useState, useRef, useEffect, useCallback } from 'react';
import { useNotes } from '../../context/NotesContext';
import { useBible } from '../../context/BibleContext';
import { notesService } from '../../services/notesService';
import { getBookById } from '../../utils/bibleBooks';
import styles from './NoteSearch.module.css';

export const NoteSearch = ({ onClose }) => {
  const { setEditingNote, setSelectedNote, setHighlightQuery } = useNotes();
  const { navigate } = useBible();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  const doSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchResults = await notesService.search(searchQuery);
      setResults(searchResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle input change with debounce
  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      doSearch(value);
    }, 200);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          selectNote(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose?.();
        break;
    }
  };

  // Select a note from results
  const selectNote = (note) => {
    // Navigate to the note's chapter
    navigate(note.book, note.startChapter);
    // Select and open the note for editing
    setSelectedNote(note.id);
    setEditingNote(note.id);
    // Pass search query for scroll-to-match
    setHighlightQuery(query);
    onClose?.();
  };

  // Format reference string
  const formatReference = (note) => {
    const book = getBookById(note.book);
    const bookName = book?.name || note.book;

    if (note.startVerse && note.endVerse) {
      if (note.startChapter === note.endChapter) {
        return `${bookName} ${note.startChapter}:${note.startVerse}-${note.endVerse}`;
      }
      return `${bookName} ${note.startChapter}:${note.startVerse} - ${note.endChapter}:${note.endVerse}`;
    }
    if (note.startVerse) {
      return `${bookName} ${note.startChapter}:${note.startVerse}`;
    }
    if (note.startChapter === note.endChapter) {
      return `${bookName} ${note.startChapter}`;
    }
    return `${bookName} ${note.startChapter}-${note.endChapter}`;
  };

  // Strip HTML tags for display
  const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').substring(0, 100);
  };

  return (
    <div className={styles.searchOverlay} onClick={onClose}>
      <div className={styles.searchModal} onClick={e => e.stopPropagation()}>
        <div className={styles.searchHeader}>
          <svg
            className={styles.searchIcon}
            width="20"
            height="20"
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
            placeholder="Search notes..."
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          {loading && <div className={styles.spinner} />}
          <kbd className={styles.escHint}>esc</kbd>
        </div>

        {query.length >= 2 && (
          <div className={styles.resultsContainer}>
            {results.length === 0 && !loading && (
              <div className={styles.noResults}>
                No notes found for "{query}"
              </div>
            )}

            {results.map((note, index) => (
              <button
                key={note.id}
                className={`${styles.resultItem} ${index === selectedIndex ? styles.selected : ''}`}
                onClick={() => selectNote(note)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className={styles.resultHeader}>
                  <span className={styles.resultReference}>
                    {formatReference(note)}
                  </span>
                  <span className={styles.resultType}>{note.type}</span>
                </div>
                <div className={styles.resultTitle}>
                  {note.titleSnippet ? (
                    <span dangerouslySetInnerHTML={{ __html: note.titleSnippet }} />
                  ) : (
                    note.title || 'Untitled'
                  )}
                </div>
                {note.contentSnippet && (
                  <div
                    className={styles.resultSnippet}
                    dangerouslySetInnerHTML={{ __html: note.contentSnippet }}
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {query.length < 2 && query.length > 0 && (
          <div className={styles.resultsContainer}>
            <div className={styles.noResults}>
              Type at least 2 characters to search
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NoteSearch;
