import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { systematicService } from '../services/systematicService';
import { sessionsService } from '../services/sessionsService';
import { useBible } from './BibleContext';

const SystematicContext = createContext();

const initialState = {
  tree: [],
  loading: true,
  error: null,
  selectedEntryId: null,
  selectedEntry: null,
  isPanelOpen: false,
  relatedDoctrines: [],
  relatedDoctrinesLoading: false,
  tags: [],
  searchResults: [],
  searchQuery: '',
  annotations: [],
  annotationsLoading: false
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return { ...state, loading: false, tree: action.tree };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'SET_TAGS':
      return { ...state, tags: action.tags };
    case 'SELECT_ENTRY':
      return {
        ...state,
        selectedEntryId: action.id,
        selectedEntry: action.entry,
        isPanelOpen: true
      };
    case 'CLOSE_PANEL':
      return {
        ...state,
        isPanelOpen: false,
        selectedEntryId: null,
        selectedEntry: null
      };
    case 'TOGGLE_PANEL':
      return {
        ...state,
        isPanelOpen: !state.isPanelOpen
      };
    case 'SET_RELATED_DOCTRINES_LOADING':
      return { ...state, relatedDoctrinesLoading: action.loading };
    case 'SET_RELATED_DOCTRINES':
      return {
        ...state,
        relatedDoctrines: action.doctrines,
        relatedDoctrinesLoading: false
      };
    case 'SET_SEARCH_RESULTS':
      return {
        ...state,
        searchResults: action.results,
        searchQuery: action.query
      };
    case 'CLEAR_SEARCH':
      return {
        ...state,
        searchResults: [],
        searchQuery: ''
      };
    case 'SET_ANNOTATIONS_LOADING':
      return { ...state, annotationsLoading: action.loading };
    case 'SET_ANNOTATIONS':
      return {
        ...state,
        annotations: action.annotations,
        annotationsLoading: false
      };
    case 'ADD_ANNOTATION':
      return {
        ...state,
        annotations: [...state.annotations, action.annotation]
      };
    case 'REMOVE_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.filter(a => a.id !== action.id)
      };
    default:
      return state;
  }
};

export const SystematicProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { currentBook, currentChapter } = useBible();

  // Initial load - get tree and tags
  useEffect(() => {
    const loadData = async () => {
      dispatch({ type: 'LOAD_START' });
      try {
        const [tree, tags] = await Promise.all([
          systematicService.getAll(),
          systematicService.getTags()
        ]);
        dispatch({ type: 'LOAD_SUCCESS', tree });
        dispatch({ type: 'SET_TAGS', tags });
      } catch (error) {
        dispatch({ type: 'LOAD_ERROR', error: error.message });
      }
    };
    loadData();
  }, []);

  // Load related doctrines when Bible chapter changes
  useEffect(() => {
    if (!currentBook || !currentChapter) {
      dispatch({ type: 'SET_RELATED_DOCTRINES', doctrines: [] });
      return;
    }

    const loadRelated = async () => {
      dispatch({ type: 'SET_RELATED_DOCTRINES_LOADING', loading: true });
      try {
        const doctrines = await systematicService.getForPassage(currentBook, currentChapter);
        dispatch({ type: 'SET_RELATED_DOCTRINES', doctrines });
      } catch (error) {
        console.error('Failed to load related doctrines:', error);
        dispatch({ type: 'SET_RELATED_DOCTRINES', doctrines: [] });
      }
    };
    loadRelated();
  }, [currentBook, currentChapter]);

  // Load annotations when selected entry changes
  useEffect(() => {
    if (!state.selectedEntryId) {
      dispatch({ type: 'SET_ANNOTATIONS', annotations: [] });
      return;
    }

    const loadAnnotations = async () => {
      dispatch({ type: 'SET_ANNOTATIONS_LOADING', loading: true });
      try {
        const annotations = await systematicService.getAnnotations(state.selectedEntryId);
        dispatch({ type: 'SET_ANNOTATIONS', annotations });
      } catch (error) {
        console.error('Failed to load annotations:', error);
        dispatch({ type: 'SET_ANNOTATIONS', annotations: [] });
      }
    };
    loadAnnotations();
  }, [state.selectedEntryId]);

  // Track last logged doctrine session to avoid duplicates
  const lastLoggedDoctrineRef = useRef(null);

  // Select and open an entry
  const selectEntry = useCallback(async (id) => {
    try {
      const entry = await systematicService.getById(id);
      if (entry) {
        dispatch({ type: 'SELECT_ENTRY', id, entry });

        // Log study session for doctrine view
        const refId = entry.chapterNumber
          ? `ch${entry.chapterNumber}${entry.sectionLetter ? `:${entry.sectionLetter}` : ''}${entry.subsectionNumber ? `.${entry.subsectionNumber}` : ''}`
          : id;

        // Avoid duplicate logs for the same entry
        if (lastLoggedDoctrineRef.current !== refId) {
          lastLoggedDoctrineRef.current = refId;
          sessionsService.log({
            sessionType: 'doctrine',
            referenceId: refId,
            referenceLabel: entry.title
          });
        }
      }
    } catch (error) {
      console.error('Failed to select entry:', error);
    }
  }, []);

  // Open a chapter
  const openChapter = useCallback(async (chapterNum) => {
    try {
      const chapter = await systematicService.getChapter(chapterNum);
      if (chapter) {
        dispatch({ type: 'SELECT_ENTRY', id: chapter.id, entry: chapter });

        // Log study session for chapter view
        const refId = `ch${chapterNum}`;
        if (lastLoggedDoctrineRef.current !== refId) {
          lastLoggedDoctrineRef.current = refId;
          sessionsService.log({
            sessionType: 'doctrine',
            referenceId: refId,
            referenceLabel: chapter.title
          });
        }
      }
    } catch (error) {
      console.error('Failed to open chapter:', error);
    }
  }, []);

  // Close the panel
  const closePanel = useCallback(() => {
    dispatch({ type: 'CLOSE_PANEL' });
  }, []);

  // Toggle panel visibility
  const togglePanel = useCallback(() => {
    dispatch({ type: 'TOGGLE_PANEL' });
  }, []);

  // Search entries
  const search = useCallback(async (query) => {
    if (!query || query.length < 2) {
      dispatch({ type: 'CLEAR_SEARCH' });
      return [];
    }

    try {
      const results = await systematicService.search(query);
      dispatch({ type: 'SET_SEARCH_RESULTS', results, query });
      return results;
    } catch (error) {
      console.error('Failed to search:', error);
      return [];
    }
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    dispatch({ type: 'CLEAR_SEARCH' });
  }, []);

  // Get entries by tag
  const getByTag = useCallback(async (tagId) => {
    try {
      return await systematicService.getByTag(tagId);
    } catch (error) {
      console.error('Failed to get entries by tag:', error);
      return [];
    }
  }, []);

  // Add annotation
  const addAnnotation = useCallback(async (systematicId, annotationData) => {
    try {
      const annotation = await systematicService.addAnnotation(systematicId, annotationData);
      dispatch({ type: 'ADD_ANNOTATION', annotation });
      return annotation;
    } catch (error) {
      console.error('Failed to add annotation:', error);
      throw error;
    }
  }, []);

  // Delete annotation
  const deleteAnnotation = useCallback(async (annotationId) => {
    try {
      await systematicService.deleteAnnotation(annotationId);
      dispatch({ type: 'REMOVE_ANNOTATION', id: annotationId });
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      throw error;
    }
  }, []);

  // Get referencing notes
  const getReferencingNotes = useCallback(async (systematicId) => {
    try {
      return await systematicService.getReferencingNotes(systematicId);
    } catch (error) {
      console.error('Failed to get referencing notes:', error);
      return [];
    }
  }, []);

  // Refresh tree data (after import)
  const refreshTree = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const [tree, tags] = await Promise.all([
        systematicService.getAll(),
        systematicService.getTags()
      ]);
      dispatch({ type: 'LOAD_SUCCESS', tree });
      dispatch({ type: 'SET_TAGS', tags });
    } catch (error) {
      dispatch({ type: 'LOAD_ERROR', error: error.message });
    }
  }, []);

  // Parse ST link reference and navigate
  const navigateToLink = useCallback(async (linkRef) => {
    // Parse link format: [[ST:Ch32]], [[ST:Ch32:A]], [[ST:Ch32:B.1]]
    const match = linkRef.match(/\[\[ST:Ch(\d+)(?::([A-Z])(?:\.(\d+))?)?\]\]/i);
    if (!match) return false;

    const [, chapterNum, sectionLetter, subsectionNum] = match;

    try {
      // First try to find the specific entry
      if (subsectionNum) {
        const entries = await systematicService.getFlat();
        const entry = entries.find(e =>
          e.chapterNumber === parseInt(chapterNum, 10) &&
          e.sectionLetter === sectionLetter?.toUpperCase() &&
          e.subsectionNumber === parseInt(subsectionNum, 10)
        );
        if (entry) {
          await selectEntry(entry.id);
          return true;
        }
      } else if (sectionLetter) {
        const entries = await systematicService.getFlat();
        const entry = entries.find(e =>
          e.chapterNumber === parseInt(chapterNum, 10) &&
          e.sectionLetter === sectionLetter?.toUpperCase() &&
          e.subsectionNumber === null
        );
        if (entry) {
          await selectEntry(entry.id);
          return true;
        }
      }

      // Fall back to opening the chapter
      await openChapter(parseInt(chapterNum, 10));
      return true;
    } catch (error) {
      console.error('Failed to navigate to link:', error);
      return false;
    }
  }, [selectEntry, openChapter]);

  // Helper to find chapter in tree
  const findChapterInTree = useCallback((chapterNum) => {
    for (const part of state.tree) {
      if (part.children) {
        const chapter = part.children.find(
          ch => ch.entryType === 'chapter' && ch.chapterNumber === chapterNum
        );
        if (chapter) return chapter;
      }
    }
    return null;
  }, [state.tree]);

  return (
    <SystematicContext.Provider value={{
      ...state,
      selectEntry,
      openChapter,
      closePanel,
      togglePanel,
      search,
      clearSearch,
      getByTag,
      addAnnotation,
      deleteAnnotation,
      getReferencingNotes,
      refreshTree,
      navigateToLink,
      findChapterInTree
    }}>
      {children}
    </SystematicContext.Provider>
  );
};

export const useSystematic = () => {
  const context = useContext(SystematicContext);
  if (!context) {
    throw new Error('useSystematic must be used within a SystematicProvider');
  }
  return context;
};
