import { formatVerseRange } from '../../utils/verseRange';
import { NoteTypeIndicator } from '../UI/NoteTypeIndicator';
import styles from './Notes.module.css';

export const NoteCard = ({ note, isSelected, isActive, onSelect, onDelete }) => {
  const getPreview = (content) => {
    if (!content) return 'No content yet...';

    // If content is HTML, strip tags
    const text = content.replace(/<[^>]*>/g, '');
    return text.length > 80 ? text.substring(0, 80) + '...' : text;
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm('Delete this note?')) {
      onDelete(note.id);
    }
  };

  const cardClasses = [
    styles.noteCard,
    isSelected ? styles.selected : '',
    isActive ? styles.active : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClasses}
      onClick={() => onSelect(note.id)}
      data-note-id={note.id}
      data-type={note.type || 'note'}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderLeft}>
          <span className={styles.reference}>{formatVerseRange(note)}</span>
          <NoteTypeIndicator type={note.type} />
        </div>
        <button
          className={styles.deleteButton}
          onClick={handleDelete}
          aria-label="Delete note"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      <h3 className={styles.cardTitle}>
        {note.title || 'Untitled Note'}
      </h3>

      <p className={styles.cardPreview}>
        {getPreview(note.content)}
      </p>

      <div className={styles.cardMeta}>
        <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
};

export default NoteCard;
