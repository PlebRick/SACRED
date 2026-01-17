import { useNotes } from '../../context/NotesContext';
import styles from './SyncIndicator.module.css';

export const SyncIndicator = () => {
  const { hasExternalChanges, refreshNotes, dismissExternalChanges } = useNotes();

  if (!hasExternalChanges) return null;

  return (
    <div className={styles.syncIndicator}>
      <span className={styles.icon}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 0 0-9-9M3 12a9 9 0 0 0 9 9" />
          <polyline points="21 3 21 9 15 9" />
          <polyline points="3 21 3 15 9 15" />
        </svg>
      </span>
      <span className={styles.message}>Notes updated</span>
      <button className={styles.refreshButton} onClick={refreshNotes}>
        Refresh
      </button>
      <button className={styles.dismissButton} onClick={dismissExternalChanges} aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default SyncIndicator;
