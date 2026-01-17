import { useEffect } from 'react';
import { ChapterView } from './ChapterView';
import { useBible } from '../../context/BibleContext';
import { fetchChapter, prefetchChapter } from '../../services/bibleApi';
import { getNextChapter, getPrevChapter } from '../../utils/bibleBooks';

export const BibleReader = ({ onVisibleVerseChange }) => {
  const { bookId, chapter, setVerses, setError, loading } = useBible();

  useEffect(() => {
    let cancelled = false;

    const loadChapter = async () => {
      try {
        const data = await fetchChapter(bookId, chapter);
        if (!cancelled) {
          setVerses(data.verses, data.reference);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    };

    loadChapter();

    // Prefetch adjacent chapters
    const next = getNextChapter(bookId, chapter);
    const prev = getPrevChapter(bookId, chapter);
    if (next) {
      prefetchChapter(next.bookId, next.chapter);
    }
    if (prev) {
      prefetchChapter(prev.bookId, prev.chapter);
    }

    return () => {
      cancelled = true;
    };
  }, [bookId, chapter, setVerses, setError]);

  return <ChapterView onVisibleVerseChange={onVisibleVerseChange} />;
};

export default BibleReader;
