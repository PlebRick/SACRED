import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { getNextChapter, getPrevChapter, getBookById } from '../utils/bibleBooks';
import { sessionsService } from '../services/sessionsService';

const BibleContext = createContext();

const STORAGE_KEY = 'sacred_bible_location';

const initialState = {
  bookId: 'JHN',
  chapter: 1,
  loading: false,
  error: null,
  verses: [],
  reference: '',
  highlightVerse: null  // { verse: number } for scroll-to-verse
};

const loadSavedLocation = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load saved location:', e);
  }
  return null;
};

const saveLocation = (bookId, chapter) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bookId, chapter }));
  } catch (e) {
    console.warn('Failed to save location:', e);
  }
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'NAVIGATE':
      return {
        ...state,
        bookId: action.bookId,
        chapter: action.chapter,
        loading: true,
        error: null
      };
    case 'LOAD_SUCCESS':
      return {
        ...state,
        loading: false,
        verses: action.verses,
        reference: action.reference
      };
    case 'LOAD_ERROR':
      return {
        ...state,
        loading: false,
        error: action.error
      };
    case 'SET_HIGHLIGHT_VERSE':
      return {
        ...state,
        highlightVerse: action.verse
      };
    case 'CLEAR_HIGHLIGHT_VERSE':
      return {
        ...state,
        highlightVerse: null
      };
    default:
      return state;
  }
};

export const BibleProvider = ({ children }) => {
  const savedLocation = loadSavedLocation();
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    ...(savedLocation || {})
  });

  const navigate = useCallback((newBookId, newChapter) => {
    // Skip if already at this location (prevents stuck loading state)
    if (newBookId === state.bookId && newChapter === state.chapter) {
      return;
    }
    dispatch({ type: 'NAVIGATE', bookId: newBookId, chapter: newChapter });
    saveLocation(newBookId, newChapter);
  }, [state.bookId, state.chapter]);

  const goNext = useCallback(() => {
    const next = getNextChapter(state.bookId, state.chapter);
    if (next) {
      navigate(next.bookId, next.chapter);
    }
  }, [state.bookId, state.chapter, navigate]);

  const goPrev = useCallback(() => {
    const prev = getPrevChapter(state.bookId, state.chapter);
    if (prev) {
      navigate(prev.bookId, prev.chapter);
    }
  }, [state.bookId, state.chapter, navigate]);

  // Track last logged session to avoid duplicates
  const lastLoggedRef = useRef(null);

  const setVerses = useCallback((verses, reference) => {
    dispatch({ type: 'LOAD_SUCCESS', verses, reference });
  }, []);

  // Log study session when chapter is successfully loaded
  useEffect(() => {
    // Only log when verses are loaded (not during loading)
    if (state.loading || state.verses.length === 0) return;

    const sessionKey = `${state.bookId}:${state.chapter}`;

    // Avoid duplicate logs for the same chapter
    if (lastLoggedRef.current === sessionKey) return;
    lastLoggedRef.current = sessionKey;

    // Get book name for label
    const book = getBookById(state.bookId);
    const label = book ? `${book.name} ${state.chapter}` : sessionKey;

    // Log the session (fire and forget)
    sessionsService.log({
      sessionType: 'bible',
      referenceId: sessionKey,
      referenceLabel: label
    });
  }, [state.bookId, state.chapter, state.loading, state.verses.length]);

  const setError = useCallback((error) => {
    dispatch({ type: 'LOAD_ERROR', error });
  }, []);

  const setHighlightVerse = useCallback((verse) => {
    dispatch({ type: 'SET_HIGHLIGHT_VERSE', verse });
  }, []);

  const clearHighlightVerse = useCallback(() => {
    dispatch({ type: 'CLEAR_HIGHLIGHT_VERSE' });
  }, []);

  return (
    <BibleContext.Provider value={{
      ...state,
      navigate,
      goNext,
      goPrev,
      setVerses,
      setError,
      setHighlightVerse,
      clearHighlightVerse
    }}>
      {children}
    </BibleContext.Provider>
  );
};

export const useBible = () => {
  const context = useContext(BibleContext);
  if (!context) {
    throw new Error('useBible must be used within a BibleProvider');
  }
  return context;
};
