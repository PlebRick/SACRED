import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSeries } from '../../context/SeriesContext';
import { formatVerseRange } from '../../utils/verseRange';
import styles from './PrintView.module.css';

// Print-formatted manuscript view for a note/sermon. Rendered in a portal at
// document.body; while open, a body class hides the app from the print layout
// (see the @media print rules in PrintView.module.css + index.css).
export const PrintView = ({ note, onClose }) => {
  const { series } = useSeries();
  const [largePrint, setLargePrint] = useState(note.type === 'sermon');
  const [showHighlights, setShowHighlights] = useState(false);

  const seriesName = note.seriesId
    ? series?.find((s) => s.id === note.seriesId)?.name
    : null;

  useEffect(() => {
    document.body.classList.add('sacred-printing');
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.classList.remove('sacred-printing');
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const dateLabel = new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return createPortal(
    <div className={styles.printRoot}>
      <div className={styles.controls}>
        <div className={styles.controlsGroup}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={largePrint}
              onChange={(e) => setLargePrint(e.target.checked)}
            />
            Large print (pulpit)
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={showHighlights}
              onChange={(e) => setShowHighlights(e.target.checked)}
            />
            Show tag highlights
          </label>
        </div>
        <div className={styles.controlsGroup}>
          <button className={styles.printButton} onClick={() => window.print()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print / Save PDF
          </button>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close print view">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <article
        className={`${styles.page} ${largePrint ? styles.largePrint : ''} ${showHighlights ? '' : styles.noHighlights}`}
      >
        <header className={styles.manuscriptHeader}>
          <h1 className={styles.manuscriptTitle}>{note.title || 'Untitled'}</h1>
          <div className={styles.manuscriptMeta}>
            <span className={styles.manuscriptReference}>{formatVerseRange(note)}</span>
            {seriesName && <span> · {seriesName}</span>}
            <span> · {dateLabel}</span>
          </div>
        </header>
        <div
          className={styles.manuscriptBody}
          dangerouslySetInnerHTML={{ __html: note.content || '<p><em>No content</em></p>' }}
        />
      </article>
    </div>,
    document.body
  );
};

export default PrintView;
