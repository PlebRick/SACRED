import { useState, useEffect, useCallback } from 'react';
import { doctrineMatchingService } from '../../services/doctrineMatchingService';
import { DoctrineReviewModal } from './DoctrineReviewModal';
import styles from './DoctrineMatchingQueue.module.css';

export const DoctrineMatchingQueue = ({ isOpen, onClose, onNotesUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [filterBook, setFilterBook] = useState('');
  const [filterType, setFilterType] = useState('');
  const [batchResult, setBatchResult] = useState(null);
  const [batchRunning, setBatchRunning] = useState(false);

  // Review modal state
  const [reviewNote, setReviewNote] = useState(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const result = await doctrineMatchingService.getQueue(filterBook || undefined, filterType || undefined);
      setQueue(result.queue || []);
      setStats(result.stats || null);
    } catch (err) {
      console.error('Failed to load doctrine matching queue:', err);
    }
    setLoading(false);
  }, [filterBook, filterType]);

  useEffect(() => {
    if (isOpen) loadQueue();
  }, [isOpen, loadQueue]);

  useEffect(() => {
    if (!isOpen) {
      setQueue([]);
      setStats(null);
      setBatchResult(null);
    }
  }, [isOpen]);

  const handleAnalyzeAll = async () => {
    setBatchRunning(true);
    setBatchResult(null);
    try {
      const result = await doctrineMatchingService.batch('analyze');
      setBatchResult(result);
      await loadQueue();
    } catch (err) {
      console.error('Failed to batch analyze:', err);
    }
    setBatchRunning(false);
  };

  const handleAutoLink = async () => {
    setBatchRunning(true);
    setBatchResult(null);
    try {
      const result = await doctrineMatchingService.batch('auto', undefined, 0.5);
      setBatchResult(result);
      await loadQueue();
      if (onNotesUpdated) onNotesUpdated();
    } catch (err) {
      console.error('Failed to auto-link:', err);
    }
    setBatchRunning(false);
  };

  const handleReviewNote = (note) => {
    setReviewNote(note);
  };

  const handleReviewDone = async () => {
    setReviewNote(null);
    await loadQueue();
    if (onNotesUpdated) onNotesUpdated();
  };

  // Get unique books from queue for filter
  const books = [...new Set(queue.map(n => n.book))].sort();

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <h3 className={styles.title}>Doctrine Linking Queue</h3>
              <span className={styles.subtitle}>
                {stats ? `${stats.unlinkedNotes} unlinked of ${stats.totalNotes} notes` : 'Loading...'}
              </span>
            </div>
            <button className={styles.closeButton} onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Progress */}
          {stats && (
            <div className={styles.progressSection}>
              <div className={styles.progressLabel}>
                <span>Doctrine Linking Progress</span>
                <span>{stats.progress}%</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${stats.progress}%` }} />
              </div>
            </div>
          )}

          {/* Batch Result */}
          {batchResult && (
            <div className={styles.batchResult}>
              <span>
                Processed {batchResult.processed} notes
                {batchResult.linked > 0 && `, linked ${batchResult.linked}`}
                {batchResult.suggestions > 0 && `, ${batchResult.suggestions} suggestions`}
              </span>
              <button onClick={() => setBatchResult(null)}>dismiss</button>
            </div>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            <select
              className={styles.filterSelect}
              value={filterBook}
              onChange={e => setFilterBook(e.target.value)}
            >
              <option value="">All books</option>
              {books.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select
              className={styles.filterSelect}
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="">All types</option>
              <option value="commentary">Commentary</option>
              <option value="sermon">Sermon</option>
              <option value="note">Note</option>
            </select>
            <div className={styles.spacer} />
            <button
              className={styles.actionButton}
              onClick={handleAnalyzeAll}
              disabled={batchRunning || queue.length === 0}
            >
              {batchRunning ? 'Running...' : 'Analyze All'}
            </button>
            <button
              className={`${styles.actionButton} ${styles.primary}`}
              onClick={handleAutoLink}
              disabled={batchRunning || queue.length === 0}
            >
              Auto-Link
            </button>
          </div>

          {/* Queue */}
          <div className={styles.queueList}>
            {loading ? (
              <div className={styles.loading}>
                <div className={styles.spinner} />
                Loading queue...
              </div>
            ) : queue.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>&#x1F517;</div>
                <div className={styles.emptyTitle}>All notes linked!</div>
                <div className={styles.emptyDescription}>
                  Every note has doctrine links assigned.
                </div>
              </div>
            ) : (
              queue.map(note => (
                <div
                  key={note.id}
                  className={styles.queueItem}
                  onClick={() => handleReviewNote(note)}
                >
                  <div className={styles.queueItemBook}>
                    {note.book}<br/>{note.startChapter}{note.startVerse ? ':' + note.startVerse : ''}
                  </div>
                  <div className={styles.queueItemInfo}>
                    <div className={styles.queueItemTitle}>
                      {note.title || 'Untitled'}
                    </div>
                    <div className={styles.queueItemMeta}>
                      {note.type} &middot; {note.book} {note.startChapter}
                      {note.startVerse ? ':' + note.startVerse : ''}
                      {note.endChapter !== note.startChapter ? '-' + note.endChapter : ''}
                    </div>
                  </div>
                  <div className={`${styles.queueItemBadge} ${note.pendingSuggestions > 0 ? styles.hasSuggestions : ''}`}>
                    {note.pendingSuggestions > 0
                      ? `${note.pendingSuggestions} suggestions`
                      : 'Not analyzed'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {reviewNote && (
        <DoctrineReviewModal
          isOpen={!!reviewNote}
          noteId={reviewNote.id}
          noteTitle={reviewNote.title}
          noteType={reviewNote.type}
          notePassage={`${reviewNote.book} ${reviewNote.startChapter}${reviewNote.startVerse ? ':' + reviewNote.startVerse : ''}`}
          onClose={() => setReviewNote(null)}
          onApplied={handleReviewDone}
        />
      )}
    </>
  );
};

export default DoctrineMatchingQueue;
