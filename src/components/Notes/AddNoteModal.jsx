import { useState, useRef, useEffect } from 'react';
import { parseReference, formatParsedReference } from '../../utils/parseReference';
import { useBible } from '../../context/BibleContext';
import { getBookById } from '../../utils/bibleBooks';
import styles from './Notes.module.css';

export const AddNoteModal = ({ isOpen, onClose, onCreateNote }) => {
  const { bookId, chapter } = useBible();
  const [referenceInput, setReferenceInput] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  // Set default reference based on current location
  useEffect(() => {
    if (isOpen) {
      const book = getBookById(bookId);
      if (book) {
        setReferenceInput(`${book.name} ${chapter}:1`);
      }
      setError('');
      // Focus input after modal opens
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, bookId, chapter]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const parsed = parseReference(referenceInput);

    if (!parsed) {
      setError('Invalid verse reference. Try formats like "Romans 1:1-7" or "Rom 1:1"');
      return;
    }

    if (parsed.isWholeChapter) {
      setError('Please specify a verse or verse range, not just a chapter');
      return;
    }

    try {
      await onCreateNote({
        book: parsed.bookId,
        startChapter: parsed.startChapter,
        startVerse: parsed.startVerse,
        endChapter: parsed.endChapter,
        endVerse: parsed.endVerse,
        title: '',
        content: ''
      });
      onClose();
    } catch (err) {
      setError('Failed to create note. Please try again.');
    }
  };

  const handleInputChange = (e) => {
    setReferenceInput(e.target.value);
    if (error) setError('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Add New Note</h3>
          <button
            className={styles.modalCloseButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <label className={styles.inputLabel}>
              Verse Range
            </label>
            <input
              ref={inputRef}
              type="text"
              className={`${styles.modalInput} ${error ? styles.inputError : ''}`}
              value={referenceInput}
              onChange={handleInputChange}
              placeholder="e.g., Romans 1:1-7"
            />
            <p className={styles.inputHint}>
              Accepts formats like: Rom 1:1-7, Romans 1:1, Genesis 1:1-2:3
            </p>
            {error && <p className={styles.errorMessage}>{error}</p>}
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.createButton}
            >
              Create Note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddNoteModal;
