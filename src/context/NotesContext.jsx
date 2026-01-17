import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { notesService } from '../services/notesService';

const NotesContext = createContext();

const initialState = {
  notes: [],
  loading: true,
  error: null,
  editingNoteId: null,
  selectedNoteId: null
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
    default:
      return state;
  }
};

export const NotesProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const loadNotes = async () => {
      dispatch({ type: 'LOAD_START' });
      try {
        const notes = await notesService.getAll();
        dispatch({ type: 'LOAD_SUCCESS', notes });
      } catch (error) {
        dispatch({ type: 'LOAD_ERROR', error: error.message });
      }
    };
    loadNotes();
  }, []);

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

  const setEditingNote = useCallback((id) => {
    dispatch({ type: 'SET_EDITING', id });
  }, []);

  const setSelectedNote = useCallback((id) => {
    dispatch({ type: 'SET_SELECTED', id });
  }, []);

  const refreshNotes = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const notes = await notesService.getAll();
      dispatch({ type: 'LOAD_SUCCESS', notes });
    } catch (error) {
      dispatch({ type: 'LOAD_ERROR', error: error.message });
    }
  }, []);

  const getNotesForChapter = useCallback((bookId, chapter) => {
    return state.notes.filter(note =>
      note.book === bookId &&
      ((note.startChapter <= chapter && note.endChapter >= chapter) ||
       note.startChapter === chapter ||
       note.endChapter === chapter)
    );
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
