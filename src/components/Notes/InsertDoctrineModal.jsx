import { useState, useEffect, useRef, useCallback } from 'react';
import { useSystematic } from '../../context/SystematicContext';
import styles from './InsertDoctrineModal.module.css';

export const InsertDoctrineModal = ({ isOpen, onClose, onInsert }) => {
  const { search, tree, relatedDoctrines, openChapter } = useSystematic();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search when query changes
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const searchDebounced = setTimeout(async () => {
      setIsSearching(true);
      try {
        const searchResults = await search(query);
        setResults(searchResults || []);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      }
      setIsSearching(false);
    }, 200);

    return () => clearTimeout(searchDebounced);
  }, [query, search]);

  // Flatten tree to get all chapters for quick access
  const allChapters = useCallback(() => {
    const chapters = [];
    for (const part of tree) {
      if (part.children) {
        for (const chapter of part.children) {
          if (chapter.entryType === 'chapter') {
            chapters.push(chapter);
          }
        }
      }
    }
    return chapters;
  }, [tree]);

  // Get suggestions - related doctrines + recent chapters
  const getSuggestions = () => {
    const suggestions = [];

    // Add related doctrines first
    if (relatedDoctrines.length > 0) {
      suggestions.push(...relatedDoctrines.slice(0, 3).map(d => ({
        ...d,
        isRelated: true
      })));
    }

    // Add first few chapters if no query
    if (!query && tree.length > 0) {
      const chapters = allChapters();
      suggestions.push(...chapters.slice(0, 5).filter(c =>
        !suggestions.find(s => s.id === c.id)
      ));
    }

    return suggestions;
  };

  // Build link reference from entry
  const buildLinkRef = (entry) => {
    if (!entry.chapterNumber) return null;

    if (entry.subsectionNumber) {
      return `[[ST:Ch${entry.chapterNumber}:${entry.sectionLetter}.${entry.subsectionNumber}]]`;
    }
    if (entry.sectionLetter) {
      return `[[ST:Ch${entry.chapterNumber}:${entry.sectionLetter}]]`;
    }
    return `[[ST:Ch${entry.chapterNumber}]]`;
  };

  const handleSelect = (entry) => {
    const linkRef = buildLinkRef(entry);
    if (linkRef && onInsert) {
      onInsert(linkRef, entry.title);
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    const displayResults = query.length >= 2 ? results : getSuggestions();

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          Math.min(prev + 1, displayResults.length - 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (displayResults[selectedIndex]) {
          handleSelect(displayResults[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
      default:
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedEl = resultsRef.current.children[selectedIndex];
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const displayResults = query.length >= 2 ? results : getSuggestions();
  const showRelatedHeader = !query && relatedDoctrines.length > 0;
  const showSuggestionsHeader = !query && tree.length > 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Insert Doctrine Link</h3>
          <span className={styles.shortcut}>
            <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>
          </span>
        </div>

        <div className={styles.searchContainer}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search doctrines..."
          />
          {isSearching && (
            <span className={styles.spinner} />
          )}
        </div>

        <div className={styles.results} ref={resultsRef}>
          {showRelatedHeader && (
            <div className={styles.sectionHeader}>Related to Current Passage</div>
          )}

          {displayResults.length === 0 && query.length >= 2 && !isSearching && (
            <div className={styles.emptyState}>
              No doctrines found for "{query}"
            </div>
          )}

          {displayResults.length === 0 && query.length < 2 && tree.length === 0 && (
            <div className={styles.emptyState}>
              No systematic theology content imported yet.
            </div>
          )}

          {displayResults.map((entry, index) => {
            // Show section header before suggestions
            const showSuggestionHeader = showSuggestionsHeader &&
              !entry.isRelated &&
              (index === 0 || displayResults[index - 1]?.isRelated);

            return (
              <div key={entry.id}>
                {showSuggestionHeader && (
                  <div className={styles.sectionHeader}>Browse Chapters</div>
                )}
                <button
                  className={`${styles.resultItem} ${index === selectedIndex ? styles.selected : ''} ${entry.isRelated ? styles.related : ''}`}
                  onClick={() => handleSelect(entry)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className={styles.resultMain}>
                    <span className={styles.chapterBadge}>
                      Ch {entry.chapterNumber}
                      {entry.sectionLetter && `:${entry.sectionLetter}`}
                      {entry.subsectionNumber && `.${entry.subsectionNumber}`}
                    </span>
                    <span className={styles.resultTitle}>{entry.title}</span>
                    {entry.isPrimary && (
                      <span className={styles.primaryBadge}>Key</span>
                    )}
                  </div>
                  {entry.summary && (
                    <span className={styles.resultSummary}>{entry.summary}</span>
                  )}
                  {entry.snippet && (
                    <span
                      className={styles.resultSnippet}
                      dangerouslySetInnerHTML={{ __html: entry.snippet }}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.footer}>
          <span className={styles.hint}>
            <kbd>↑</kbd><kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to select, <kbd>Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
};

export default InsertDoctrineModal;
