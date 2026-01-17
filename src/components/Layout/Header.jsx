import { ThemeToggle } from '../UI/ThemeToggle';
import { VerseSearch } from './VerseSearch';
import { useBible } from '../../context/BibleContext';
import { getBookById } from '../../utils/bibleBooks';
import styles from './Layout.module.css';

export const Header = ({ onToggleSidebar, sidebarOpen }) => {
  const { bookId, chapter } = useBible();
  const book = getBookById(bookId);

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
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
        <h1 className={styles.logo}>Sacred</h1>
        <VerseSearch />
      </div>

      <div className={styles.headerCenter}>
        <span className={styles.currentReference}>
          {book?.name} {chapter}
        </span>
      </div>

      <div className={styles.headerRight}>
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;
