import { createContext, useContext, useReducer, useCallback } from 'react';
import { getNextChapter, getPrevChapter } from '../utils/bibleBooks';

const BibleContext = createContext();

const STORAGE_KEY = 'sacred_bible_location';

const initialState = {
  bookId: 'JHN',
  chapter: 1,
  loading: false,
  error: null,
  verses: [],
  reference: ''
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

  const navigate = useCallback((bookId, chapter) => {
    dispatch({ type: 'NAVIGATE', bookId, chapter });
    saveLocation(bookId, chapter);
  }, []);

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

  const setVerses = useCallback((verses, reference) => {
    dispatch({ type: 'LOAD_SUCCESS', verses, reference });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: 'LOAD_ERROR', error });
  }, []);

  return (
    <BibleContext.Provider value={{
      ...state,
      navigate,
      goNext,
      goPrev,
      setVerses,
      setError
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
