import { useState, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { BibleProvider, useBible } from './context/BibleContext';
import { NotesProvider, useNotes } from './context/NotesContext';
import { TopicsProvider } from './context/TopicsContext';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { BibleReader } from './components/Bible/BibleReader';
import { NotesPanel } from './components/Notes/NotesPanel';
import { ResizableDivider } from './components/Layout/ResizableDivider';
import { isVerseInRange } from './utils/verseRange';
import styles from './components/Layout/Layout.module.css';

// Inner component that uses context
function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notesWidth, setNotesWidth] = useState(400);
  const [mobileNotesOpen, setMobileNotesOpen] = useState(false);
  const [visibleVerse, setVisibleVerse] = useState(1);

  const { bookId, chapter } = useBible();
  const { getNotesForChapter } = useNotes();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleMobileNotes = () => {
    setMobileNotesOpen(!mobileNotesOpen);
  };

  const handleResize = useCallback((width) => {
    setNotesWidth(width);
  }, []);

  const handleVisibleVerseChange = useCallback((verseNum) => {
    setVisibleVerse(verseNum);
  }, []);

  // Calculate active note based on visible verse
  const chapterNotes = getNotesForChapter(bookId, chapter);
  const activeNote = chapterNotes.find(note =>
    isVerseInRange(chapter, visibleVerse, note)
  );
  const activeNoteId = activeNote?.id || null;

  return (
    <div className={styles.layout}>
      <Header
        onToggleSidebar={toggleSidebar}
        sidebarOpen={sidebarOpen}
      />

      <main className={styles.main}>
        <Sidebar isOpen={sidebarOpen} />

        <div className={styles.contentWrapper}>
          <div className={styles.leftColumn}>
            <BibleReader onVisibleVerseChange={handleVisibleVerseChange} />
          </div>

          <ResizableDivider onResize={handleResize} />

          <div
            className={`${styles.rightColumn} ${mobileNotesOpen ? styles.mobileOpen : ''}`}
            style={{ width: notesWidth }}
          >
            <NotesPanel
              onClose={() => setMobileNotesOpen(false)}
              activeNoteId={activeNoteId}
            />
          </div>
        </div>

        <button
          className={styles.mobileNotesToggle}
          onClick={toggleMobileNotes}
          aria-label={mobileNotesOpen ? 'Close notes' : 'Open notes'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileNotesOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />
            )}
          </svg>
        </button>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BibleProvider>
        <NotesProvider>
          <TopicsProvider>
            <AppContent />
          </TopicsProvider>
        </NotesProvider>
      </BibleProvider>
    </ThemeProvider>
  );
}

export default App;
