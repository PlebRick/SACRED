import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { notesService } from '../services/notesService';
import { sessionsService } from '../services/sessionsService';
import { getBookById } from '../utils/bibleBooks';

const NotesContext = createContext();

const initialState = {
  notes: [],
  loading: true,
  error: null,
  editingNoteId: null,
  selectedNoteId: null,
  hasExternalChanges: false,
  lastKnownModified: null,
  highlightQuery: null  // Search term for scroll-to-match
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return { ...state, loading: false, notes: action.notes };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'ADD_NOTE':
      return { ...state, notes: [...state.notes, action.note] };
    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map(n =>
          n.id === action.note.id ? action.note : n
        )
      };
    case 'DELETE_NOTE':
      return {
        ...state,
        notes: state.notes.filter(n => n.id !== action.id),
        editingNoteId: state.editingNoteId === action.id ? null : state.editingNoteId,
        selectedNoteId: state.selectedNoteId === action.id ? null : state.selectedNoteId
      };
    case 'SET_EDITING':
      return { ...state, editingNoteId: action.id };
    case 'SET_SELECTED':
      return { ...state, selectedNoteId: action.id };
    case 'EXTERNAL_CHANGES_DETECTED':
      return { ...state, hasExternalChanges: true };
    case 'CLEAR_EXTERNAL_CHANGES':
      return { ...state, hasExternalChanges: false };
    case 'SET_LAST_MODIFIED':
      return { ...state, lastKnownModified: action.lastModified };
    case 'SET_HIGHLIGHT_QUERY':
      return { ...state, highlightQuery: action.query };
    case 'CLEAR_HIGHLIGHT_QUERY':
      return { ...state, highlightQuery: null };
    default:
      return state;
  }
};

export const NotesProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Initial load - get notes and last modified timestamp
  useEffect(() => {
    const loadNotes = async () => {
      dispatch({ type: 'LOAD_START' });
      try {
        const [notes, { lastModified }] = await Promise.all([
          notesService.getAll(),
          notesService.getLastModified()
        ]);
        dispatch({ type: 'LOAD_SUCCESS', notes });
        dispatch({ type: 'SET_LAST_MODIFIED', lastModified });
      } catch (error) {
        dispatch({ type: 'LOAD_ERROR', error: error.message });
      }
    };
    loadNotes();
  }, []);

  // Poll for external changes (pause while editing)
  useEffect(() => {
    if (state.editingNoteId) return;

    const checkForChanges = async () => {
      try {
        const { lastModified } = await notesService.getLastModified();
        if (state.lastKnownModified && lastModified && lastModified !== state.lastKnownModified) {
          dispatch({ type: 'EXTERNAL_CHANGES_DETECTED' });
          // Auto-reload notes when external changes detected
          const notes = await notesService.getAll();
          dispatch({ type: 'LOAD_SUCCESS', notes });
          dispatch({ type: 'SET_LAST_MODIFIED', lastModified });
          dispatch({ type: 'CLEAR_EXTERNAL_CHANGES' });
        }
      } catch (error) {
        // Silently ignore polling errors
      }
    };

    const interval = setInterval(checkForChanges, 5000);
    return () => clearInterval(interval);
  }, [state.editingNoteId, state.lastKnownModified]);

  const createNote = useCallback(async (noteData) => {
    try {
      const note = await notesService.create(noteData);
      dispatch({ type: 'ADD_NOTE', note });
      dispatch({ type: 'SET_EDITING', id: note.id });
      return note;
    } catch (error) {
      console.error('Failed to create note:', error);
      throw error;
    }
  }, []);

  const updateNote = useCallback(async (id, updates) => {
    try {
      const note = await notesService.update(id, updates);
      dispatch({ type: 'UPDATE_NOTE', note });
      return note;
    } catch (error) {
      console.error('Failed to update note:', error);
      throw error;
    }
  }, []);

  const deleteNote = useCallback(async (id) => {
    try {
      await notesService.delete(id);
      dispatch({ type: 'DELETE_NOTE', id });
    } catch (error) {
      console.error('Failed to delete note:', error);
      throw error;
    }
  }, []);

  // Track last logged note session to avoid duplicates
  const lastLoggedNoteRef = useRef(null);

  const setEditingNote = useCallback((id) => {
    dispatch({ type: 'SET_EDITING', id });

    // Log study session when a note is opened for editing
    if (id && lastLoggedNoteRef.current !== id) {
      lastLoggedNoteRef.current = id;

      // Find the note to get its label
      const note = state.notes.find(n => n.id === id);
      if (note) {
        const book = getBookById(note.book);
        const bookName = book?.name || note.book;
        const label = note.title || `${bookName} ${note.startChapter}${note.startVerse ? `:${note.startVerse}` : ''}`;

        sessionsService.log({
          sessionType: 'note',
          referenceId: id,
          referenceLabel: label
        });
      }
    }
  }, [state.notes]);

  const setSelectedNote = useCallback((id) => {
    dispatch({ type: 'SET_SELECTED', id });
  }, []);

  const refreshNotes = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const [notes, { lastModified }] = await Promise.all([
        notesService.getAll(),
        notesService.getLastModified()
      ]);
      dispatch({ type: 'LOAD_SUCCESS', notes });
      dispatch({ type: 'SET_LAST_MODIFIED', lastModified });
      dispatch({ type: 'CLEAR_EXTERNAL_CHANGES' });
    } catch (error) {
      dispatch({ type: 'LOAD_ERROR', error: error.message });
    }
  }, []);

  const dismissExternalChanges = useCallback(() => {
    dispatch({ type: 'CLEAR_EXTERNAL_CHANGES' });
  }, []);

  const setHighlightQuery = useCallback((query) => {
    dispatch({ type: 'SET_HIGHLIGHT_QUERY', query });
  }, []);

  const clearHighlightQuery = useCallback(() => {
    dispatch({ type: 'CLEAR_HIGHLIGHT_QUERY' });
  }, []);

  const getNotesForChapter = useCallback((bookId, chapter) => {
    return state.notes
      .filter(note =>
        note.book === bookId &&
        ((note.startChapter <= chapter && note.endChapter >= chapter) ||
         note.startChapter === chapter ||
         note.endChapter === chapter)
      )
      .sort((a, b) => (a.startVerse || 0) - (b.startVerse || 0));
  }, [state.notes]);

  return (
    <NotesContext.Provider value={{
      ...state,
      createNote,
      updateNote,
      deleteNote,
      setEditingNote,
      setSelectedNote,
      refreshNotes,
      dismissExternalChanges,
      setHighlightQuery,
      clearHighlightQuery,
      getNotesForChapter
    }}>
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = () => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
};
