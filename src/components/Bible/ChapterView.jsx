import { useState, useCallback, useRef, useEffect } from 'react';
import { Verse } from './Verse';
import { useBible } from '../../context/BibleContext';
import { useNotes } from '../../context/NotesContext';
import { isVerseInRange } from '../../utils/verseRange';
import { getBookById } from '../../utils/bibleBooks';
import styles from './Bible.module.css';

export const ChapterView = ({ onVisibleVerseChange }) => {
  const { bookId, chapter, verses, reference, loading, error, goNext, goPrev, highlightVerse, clearHighlightVerse } = useBible();
  const { getNotesForChapter, setSelectedNote, setEditingNote } = useNotes();
  const versesContainerRef = useRef(null);
  const verseRefs = useRef({});

  const notesForChapter = getNotesForChapter(bookId, chapter);
  const book = getBookById(bookId);

  // Scroll to highlighted verse when set (also re-run when verses load)
  useEffect(() => {
    // Don't scroll while loading (prevents scrolling to wrong verse from previous chapter)
    if (!highlightVerse || verses.length === 0 || loading) return;

    // Use requestAnimationFrame to ensure DOM refs are populated after render
    const rafId = requestAnimationFrame(() => {
      const el = verseRefs.current[highlightVerse];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add(styles.scrollHighlighted);

        setTimeout(() => {
          el.classList.remove(styles.scrollHighlighted);
          clearHighlightVerse();
        }, 2000);
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [highlightVerse, clearHighlightVerse, verses, loading]);

  // Track visible verse using Intersection Observer
  useEffect(() => {
    if (!versesContainerRef.current || verses.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first visible verse (topmost in viewport)
        const visibleEntries = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visibleEntries.length > 0) {
          const verseNum = parseInt(visibleEntries[0].target.dataset.verse, 10);
          if (onVisibleVerseChange) {
            onVisibleVerseChange(verseNum);
          }
        }
      },
      {
        root: null,
        rootMargin: '-64px 0px -50% 0px', // Account for header and show top half of viewport
        threshold: 0
      }
    );

    // Observe all verse elements
    Object.values(verseRefs.current).forEach(ref => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [verses, onVisibleVerseChange]);

  const getHighlightInfo = useCallback((verseNum) => {
    for (const note of notesForChapter) {
      if (isVerseInRange(chapter, verseNum, note)) {
        const isFirst = note.startChapter === chapter && note.startVerse === verseNum;
        const isLast = note.endChapter === chapter && note.endVerse === verseNum;
        return { isHighlighted: true, isFirstInRange: isFirst, isLastInRange: isLast, noteId: note.id };
      }
    }
    return { isHighlighted: false, isFirstInRange: false, isLastInRange: false, noteId: null };
  }, [notesForChapter, chapter]);

  const handleVerseClick = (verseNum) => {
    const highlightInfo = getHighlightInfo(verseNum);
    if (highlightInfo.isHighlighted) {
      setSelectedNote(highlightInfo.noteId);
      setEditingNote(highlightInfo.noteId);
    }
  };

  if (loading) {
    return (
      <div className={styles.chapterView}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <span>Loading {book?.name} {chapter}...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.chapterView}>
        <div className={styles.error}>
          <p>Failed to load chapter</p>
          <p className={styles.errorDetail}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chapterView}>
      <h2 className={styles.chapterTitle}>{reference || `${book?.name} ${chapter}`}</h2>

      <div className={styles.versesContainer} ref={versesContainerRef}>
        {verses.map((verse) => {
          const highlightInfo = getHighlightInfo(verse.verse);
          return (
            <Verse
              key={verse.verse}
              ref={(el) => { verseRefs.current[verse.verse] = el; }}
              number={verse.verse}
              text={verse.text}
              isHighlighted={highlightInfo.isHighlighted}
              isFirstInRange={highlightInfo.isFirstInRange}
              isLastInRange={highlightInfo.isLastInRange}
              onClick={() => handleVerseClick(verse.verse)}
            />
          );
        })}
      </div>

      <div className={styles.chapterNav}>
        <button className={styles.navButton} onClick={goPrev}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Previous
        </button>
        <button className={styles.navButton} onClick={goNext}>
          Next
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChapterView;
