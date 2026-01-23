import { useState, useMemo, useCallback } from 'react';
import { useBible } from '../../context/BibleContext';
import { useNotes } from '../../context/NotesContext';
import { books, getBookById } from '../../utils/bibleBooks';
import { formatVerseRange } from '../../utils/verseRange';
import { notesService } from '../../services/notesService';
import styles from './NotesTree.module.css';

// Helper to get type icon SVG
const getTypeIcon = (type) => {
  switch (type) {
    case 'commentary':
      // Open book icon
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case 'sermon':
      // Microphone icon
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      );
    case 'note':
    default:
      // Pencil icon
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      );
  }
};

export const NotesTree = () => {
  const [expandedBooks, setExpandedBooks] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const { navigate } = useBible();
  const { notes, setSelectedNote, setEditingNote } = useNotes();

  // Debounced search
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await notesService.search(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  // Group notes by book and chapter (starting chapter only, per spec)
  const notesByBook = useMemo(() => {
    const grouped = {};

    // Initialize all books
    books.forEach(book => {
      grouped[book.id] = {
        book,
        chapters: {},
        noteCount: 0
      };
    });

    // Group notes
    notes.forEach(note => {
      if (!grouped[note.book]) return;

      const chapter = note.startChapter;
      if (!grouped[note.book].chapters[chapter]) {
        grouped[note.book].chapters[chapter] = [];
      }
      grouped[note.book].chapters[chapter].push(note);
      grouped[note.book].noteCount++;
    });

    // Sort notes within each chapter by verse
    Object.values(grouped).forEach(bookData => {
      Object.values(bookData.chapters).forEach(chapterNotes => {
        chapterNotes.sort((a, b) => (a.startVerse || 0) - (b.startVerse || 0));
      });
    });

    return grouped;
  }, [notes]);

  const toggleBook = (bookId) => {
    setExpandedBooks(prev => ({
      ...prev,
      [bookId]: !prev[bookId]
    }));
  };

  const toggleChapter = (bookId, chapter) => {
    const key = `${bookId}-${chapter}`;
    setExpandedChapters(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleNoteClick = (note) => {
    navigate(note.book, note.startChapter);
    setSelectedNote(note.id);
    setEditingNote(note.id);
  };

  // Render search results
  const renderSearchResults = () => (
    <div className={styles.searchResults}>
      {isSearching ? (
        <div className={styles.searchStatus}>Searching...</div>
      ) : searchResults.length === 0 ? (
        <div className={styles.searchStatus}>No results found</div>
      ) : (
        <>
          <div className={styles.searchStatus}>
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </div>
          {searchResults.map(result => (
            <button
              key={result.id}
              className={styles.searchResultItem}
              onClick={() => handleNoteClick(result)}
            >
              <span className={styles.noteTypeIcon} data-type={result.type || 'note'}>
                {getTypeIcon(result.type || 'note')}
              </span>
              <div className={styles.searchResultContent}>
                <div className={styles.searchResultHeader}>
                  <span className={styles.noteReference}>
                    {getBookById(result.book)?.name} {formatVerseRange(result)}
                  </span>
                </div>
                {result.titleSnippet && (
                  <div
                    className={styles.searchResultTitle}
                    dangerouslySetInnerHTML={{ __html: result.titleSnippet }}
                  />
                )}
                {result.contentSnippet && (
                  <div
                    className={styles.searchResultSnippet}
                    dangerouslySetInnerHTML={{ __html: result.contentSnippet }}
                  />
                )}
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );

  if (notes.length === 0 && !searchQuery) {
    return (
      <div className={styles.emptyState}>
        <p>No notes yet.</p>
        <p>Select verses in the Bible text to create a note.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Search Input */}
      <div className={styles.searchContainer}>
        <div className={styles.searchInputWrapper}>
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
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchQuery && (
            <button
              className={styles.clearButton}
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Search Results or Book Tree */}
      {searchQuery.trim().length >= 2 ? (
        renderSearchResults()
      ) : (
        books.map(book => {
        const bookData = notesByBook[book.id];
        const hasNotes = bookData.noteCount > 0;
        const isExpanded = expandedBooks[book.id];
        const chapters = Object.entries(bookData.chapters)
          .sort(([a], [b]) => parseInt(a) - parseInt(b));

        return (
          <div
            key={book.id}
            className={`${styles.bookItem} ${hasNotes ? '' : styles.empty}`}
          >
            <button
              className={styles.bookButton}
              onClick={() => hasNotes && toggleBook(book.id)}
              disabled={!hasNotes}
            >
              <span className={styles.bookName}>{book.name}</span>
              {hasNotes && (
                <>
                  <span className={styles.count}>{bookData.noteCount}</span>
                  <svg
                    className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </>
              )}
            </button>

            {isExpanded && hasNotes && (
              <div className={styles.chapterList}>
                {chapters.map(([chapter, chapterNotes]) => {
                  const chapterKey = `${book.id}-${chapter}`;
                  const isChapterExpanded = expandedChapters[chapterKey];

                  return (
                    <div key={chapter} className={styles.chapterItem}>
                      <button
                        className={styles.chapterButton}
                        onClick={() => toggleChapter(book.id, chapter)}
                      >
                        <span className={styles.chapterLabel}>
                          Chapter {chapter}
                        </span>
                        <span className={styles.chapterCount}>
                          {chapterNotes.length}
                        </span>
                        <svg
                          className={`${styles.chevron} ${isChapterExpanded ? styles.expanded : ''}`}
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {isChapterExpanded && (
                        <div className={styles.notesList}>
                          {chapterNotes.map(note => (
                            <button
                              key={note.id}
                              className={styles.noteItem}
                              onClick={() => handleNoteClick(note)}
                              data-type={note.type || 'note'}
                            >
                              <span className={styles.noteTypeIcon} data-type={note.type || 'note'}>
                                {getTypeIcon(note.type || 'note')}
                              </span>
                              <span className={styles.noteContent}>
                                <span className={styles.noteReference}>
                                  {formatVerseRange(note)}
                                </span>
                                <span className={styles.noteTitle}>
                                  {note.title || 'Untitled'}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })
      )}
    </div>
  );
};

export default NotesTree;
