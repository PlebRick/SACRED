import { useEffect } from 'react';
import { ChapterView } from './ChapterView';
import { useBible } from '../../context/BibleContext';
import { useSettings } from '../../context/SettingsContext';
import { fetchChapter, prefetchChapter } from '../../services/bibleApi';
import { getNextChapter, getPrevChapter } from '../../utils/bibleBooks';

export const BibleReader = ({ onVisibleVerseChange }) => {
  const { bookId, chapter, setVerses, setError, loading } = useBible();
  const { translation } = useSettings();

  useEffect(() => {
    let cancelled = false;

    const loadChapter = async () => {
      try {
        const data = await fetchChapter(bookId, chapter, translation);
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
      prefetchChapter(next.bookId, next.chapter, translation);
    }
    if (prev) {
      prefetchChapter(prev.bookId, prev.chapter, translation);
    }

    return () => {
      cancelled = true;
    };
  }, [bookId, chapter, translation, setVerses, setError]);

  return <ChapterView onVisibleVerseChange={onVisibleVerseChange} />;
};

export default BibleReader;
