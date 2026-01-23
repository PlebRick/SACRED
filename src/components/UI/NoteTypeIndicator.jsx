import styles from './UI.module.css';

// Type icon SVGs (matching NotesTree.jsx)
const getTypeIcon = (type) => {
  switch (type) {
    case 'commentary':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case 'sermon':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      );
    case 'note':
    default:
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      );
  }
};

// Type labels for display
const getTypeLabel = (type) => {
  switch (type) {
    case 'commentary':
      return 'Commentary';
    case 'sermon':
      return 'Sermon';
    case 'note':
    default:
      return 'Note';
  }
};

/**
 * NoteTypeIndicator - displays note type with icon and optional label
 * @param {string} type - 'note' | 'commentary' | 'sermon'
 * @param {boolean} showLabel - whether to show text label (default: false)
 * @param {string} size - 'sm' | 'md' (default: 'sm')
 */
export const NoteTypeIndicator = ({ type = 'note', showLabel = false, size = 'sm' }) => {
  const normalizedType = type || 'note';

  return (
    <span
      className={`${styles.noteTypeIndicator} ${styles[size]}`}
      data-type={normalizedType}
    >
      <span className={styles.noteTypeIndicatorIcon}>
        {getTypeIcon(normalizedType)}
      </span>
      {showLabel && (
        <span className={styles.noteTypeIndicatorLabel}>
          {getTypeLabel(normalizedType)}
        </span>
      )}
    </span>
  );
};

export default NoteTypeIndicator;
