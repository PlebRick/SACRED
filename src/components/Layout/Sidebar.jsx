import { useState } from 'react';
import { useBible } from '../../context/BibleContext';
import { useNotes } from '../../context/NotesContext';
import { books, getBookById } from '../../utils/bibleBooks';
import { formatVerseRange } from '../../utils/verseRange';
import styles from './Layout.module.css';

export const Sidebar = ({ isOpen }) => {
  const [activeTab, setActiveTab] = useState('books');
  const [expandedBook, setExpandedBook] = useState(null);
  const { bookId, chapter, navigate } = useBible();
  const { notes, setSelectedNote, setEditingNote } = useNotes();

  const handleBookClick = (id) => {
    setExpandedBook(expandedBook === id ? null : id);
  };

  const handleChapterClick = (bookId, chapterNum) => {
    navigate(bookId, chapterNum);
  };

  const handleNoteClick = (note) => {
    navigate(note.book, note.startChapter);
    setSelectedNote(note.id);
    setEditingNote(note.id);
  };

  const sortedNotes = [...notes].sort((a, b) => {
    const aIndex = books.findIndex(book => book.id === a.book);
    const bIndex = books.findIndex(book => book.id === b.book);
    if (aIndex !== bIndex) return aIndex - bIndex;
    if (a.startChapter !== b.startChapter) return a.startChapter - b.startChapter;
    return a.startVerse - b.startVerse;
  });

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
      <div className={styles.sidebarTabs}>
        <button
          className={`${styles.tab} ${activeTab === 'books' ? styles.active : ''}`}
          onClick={() => setActiveTab('books')}
        >
          Books
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'notes' ? styles.active : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          Notes ({notes.length})
        </button>
      </div>

      <div className={styles.sidebarContent}>
        {activeTab === 'books' ? (
          <div className={styles.bookList}>
            {books.map((book) => (
              <div key={book.id} className={styles.bookItem}>
                <button
                  className={`${styles.bookButton} ${book.id === bookId ? styles.currentBook : ''}`}
                  onClick={() => handleBookClick(book.id)}
                >
                  <span>{book.name}</span>
                  <svg
                    className={`${styles.chevron} ${expandedBook === book.id ? styles.expanded : ''}`}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {expandedBook === book.id && (
                  <div className={styles.chapterGrid}>
                    {Array.from({ length: book.chapters }, (_, i) => i + 1).map((chapterNum) => (
                      <button
                        key={chapterNum}
                        className={`${styles.chapterButton} ${
                          book.id === bookId && chapterNum === chapter ? styles.currentChapter : ''
                        }`}
                        onClick={() => handleChapterClick(book.id, chapterNum)}
                      >
                        {chapterNum}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.notesList}>
            {sortedNotes.length === 0 ? (
              <p className={styles.emptyState}>
                No notes yet. Select verses in the Bible text to create a note.
              </p>
            ) : (
              sortedNotes.map((note) => (
                <button
                  key={note.id}
                  className={styles.sidebarNoteItem}
                  onClick={() => handleNoteClick(note)}
                >
                  <span className={styles.noteReference}>
                    {formatVerseRange(note)}
                  </span>
                  <span className={styles.noteTitle}>
                    {note.title || 'Untitled'}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
