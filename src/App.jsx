import { useState, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import { BibleProvider, useBible } from './context/BibleContext';
import { NotesProvider, useNotes } from './context/NotesContext';
import { TopicsProvider } from './context/TopicsContext';
import { InlineTagsProvider } from './context/InlineTagsContext';
import { SystematicProvider } from './context/SystematicContext';
import { SeriesProvider } from './context/SeriesContext';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { BibleReader } from './components/Bible/BibleReader';
import { NotesPanel } from './components/Notes/NotesPanel';
import { SystematicPanel } from './components/Systematic/SystematicPanel';
import { ResizableDivider } from './components/Layout/ResizableDivider';
import { isVerseInRange } from './utils/verseRange';
import styles from './components/Layout/Layout.module.css';

// Inner component that uses context
function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
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

  const handleSidebarResize = useCallback((width) => {
    setSidebarWidth(width);
  }, []);

  const handleNotesResize = useCallback((width) => {
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
        sidebarWidth={sidebarWidth}
      />

      <main className={styles.main}>
        <Sidebar isOpen={sidebarOpen} width={sidebarWidth} />

        {sidebarOpen && (
          <ResizableDivider
            onResize={handleSidebarResize}
            minWidth={120}
            maxWidth={500}
            direction="left"
            className={styles.sidebarDivider}
          />
        )}

        <div className={styles.contentWrapper}>
          <div className={styles.leftColumn}>
            <BibleReader onVisibleVerseChange={handleVisibleVerseChange} />
          </div>

          <ResizableDivider onResize={handleNotesResize} maxWidth={900} />

          <div
            className={`${styles.rightColumn} ${mobileNotesOpen ? styles.mobileOpen : ''}`}
            style={{ width: notesWidth }}
          >
            <NotesPanel
              onClose={() => setMobileNotesOpen(false)}
              activeNoteId={activeNoteId}
            />
            <SystematicPanel />
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
      <SettingsProvider>
        <BibleProvider>
          <NotesProvider>
            <TopicsProvider>
              <InlineTagsProvider>
                <SystematicProvider>
                  <SeriesProvider>
                    <AppContent />
                  </SeriesProvider>
                </SystematicProvider>
              </InlineTagsProvider>
            </TopicsProvider>
          </NotesProvider>
        </BibleProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
