import { useState, useEffect } from 'react';
import { ThemeToggle } from '../UI/ThemeToggle';
import { SettingsModal } from '../UI/SettingsModal';
import { SyncIndicator } from '../UI/SyncIndicator';
import { VerseSearch } from './VerseSearch';
import { NoteSearch } from './NoteSearch';
import { useBible } from '../../context/BibleContext';
import { useTheme } from '../../context/ThemeContext';
import { getBookById } from '../../utils/bibleBooks';
import styles from './Layout.module.css';

export const Header = ({ onToggleSidebar, sidebarOpen, sidebarWidth, view, onToggleView, onToggleAssistant, assistantOpen }) => {
  const { bookId, chapter } = useBible();
  const { highlightsVisible, toggleHighlights } = useTheme();
  const book = getBookById(bookId);
  const [noteSearchOpen, setNoteSearchOpen] = useState(false);

  // Keyboard shortcut: Cmd/Ctrl + Shift + F to open note search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setNoteSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const brandStyle = sidebarWidth && sidebarOpen ? { width: sidebarWidth, minWidth: sidebarWidth } : undefined;

  return (
    <header className={styles.header}>
      <div className={styles.headerBrand} style={brandStyle}>
        <button
          className={styles.menuButton}
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {sidebarOpen ? (
              <path d="M3 12h18M3 6h18M3 18h18" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <h1 className={styles.logo}>SACRED</h1>
      </div>

      <div className={styles.headerContent}>
        <div className={styles.headerLeft}>
          <VerseSearch />
          <button
            className={styles.noteSearchButton}
            onClick={() => setNoteSearchOpen(true)}
            aria-label="Search notes"
            title="Search notes (Cmd+Shift+F)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <circle cx="11" cy="14" r="3" />
              <path d="m14 17-1.5-1.5" />
            </svg>
          </button>
        </div>

        <div className={styles.headerCenter}>
          <span className={styles.currentReference}>
            {book?.name} {chapter}
          </span>
        </div>

        <div className={styles.headerRight}>
          <SyncIndicator />
          {onToggleAssistant && (
            <button
              className={`${styles.highlightToggle} ${assistantOpen ? styles.viewToggleActive : ''}`}
              onClick={onToggleAssistant}
              aria-label="Toggle study assistant"
              title="Study assistant (Cmd+J)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" />
              </svg>
            </button>
          )}
          {onToggleView && (
            <button
              className={`${styles.highlightToggle} ${view === 'dashboard' ? styles.viewToggleActive : ''}`}
              onClick={onToggleView}
              aria-label={view === 'dashboard' ? 'Back to reader' : 'Open coverage dashboard'}
              title={view === 'dashboard' ? 'Back to reader' : 'Pulpit coverage dashboard'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {view === 'dashboard' ? (
                  <path d="M2 6s2.5-3 10-3 10 3 10 3v12s-2.5-3-10-3-10 3-10 3z M12 3v15" />
                ) : (
                  <>
                    <rect x="3" y="12" width="4" height="9" rx="1" />
                    <rect x="10" y="7" width="4" height="14" rx="1" />
                    <rect x="17" y="3" width="4" height="18" rx="1" />
                  </>
                )}
              </svg>
            </button>
          )}
          <button
            className={styles.highlightToggle}
            onClick={toggleHighlights}
            aria-label={highlightsVisible ? 'Hide highlights' : 'Show highlights'}
            title={highlightsVisible ? 'Hide highlights' : 'Show highlights'}
          >
            {highlightsVisible ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </button>
          <ThemeToggle />
          <SettingsModal />
        </div>
      </div>

      {noteSearchOpen && (
        <NoteSearch onClose={() => setNoteSearchOpen(false)} />
      )}
    </header>
  );
};

export default Header;
