import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { inlineTagsService } from '../services/inlineTagsService';

const InlineTagsContext = createContext();

const initialState = {
  tagTypes: [],           // All tag types (default + custom)
  tagCountsByType: [],    // Tag types with instance counts
  loading: true,
  error: null,
  selectedTagType: null,  // For browse view
  tagInstances: [],       // Current filtered tag instances
  loadingInstances: false
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return { ...state, loading: false, tagTypes: action.tagTypes };
    case 'LOAD_COUNTS_SUCCESS':
      return { ...state, tagCountsByType: action.counts };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'ADD_TAG_TYPE':
      return {
        ...state,
        tagTypes: [...state.tagTypes, action.tagType]
      };
    case 'UPDATE_TAG_TYPE':
      return {
        ...state,
        tagTypes: state.tagTypes.map(t =>
          t.id === action.tagType.id ? action.tagType : t
        )
      };
    case 'DELETE_TAG_TYPE':
      return {
        ...state,
        tagTypes: state.tagTypes.filter(t => t.id !== action.id),
        selectedTagType: state.selectedTagType === action.id ? null : state.selectedTagType
      };
    case 'SET_SELECTED_TAG_TYPE':
      return { ...state, selectedTagType: action.id };
    case 'LOAD_INSTANCES_START':
      return { ...state, loadingInstances: true };
    case 'LOAD_INSTANCES_SUCCESS':
      return { ...state, loadingInstances: false, tagInstances: action.instances };
    case 'LOAD_INSTANCES_ERROR':
      return { ...state, loadingInstances: false };
    default:
      return state;
  }
};

export const InlineTagsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load tag types and counts on mount
  const loadTagTypes = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const [types, counts] = await Promise.all([
        inlineTagsService.getTypes(),
        inlineTagsService.getCountsByType()
      ]);
      dispatch({ type: 'LOAD_SUCCESS', tagTypes: types });
      dispatch({ type: 'LOAD_COUNTS_SUCCESS', counts });
    } catch (error) {
      dispatch({ type: 'LOAD_ERROR', error: error.message });
    }
  }, []);

  useEffect(() => {
    loadTagTypes();
  }, [loadTagTypes]);

  const createTagType = useCallback(async (typeData) => {
    try {
      const tagType = await inlineTagsService.createType(typeData);
      dispatch({ type: 'ADD_TAG_TYPE', tagType });
      // Refresh counts
      const counts = await inlineTagsService.getCountsByType();
      dispatch({ type: 'LOAD_COUNTS_SUCCESS', counts });
      return tagType;
    } catch (error) {
      console.error('Failed to create tag type:', error);
      throw error;
    }
  }, []);

  const updateTagType = useCallback(async (id, updates) => {
    try {
      const tagType = await inlineTagsService.updateType(id, updates);
      dispatch({ type: 'UPDATE_TAG_TYPE', tagType });
      return tagType;
    } catch (error) {
      console.error('Failed to update tag type:', error);
      throw error;
    }
  }, []);

  const deleteTagType = useCallback(async (id) => {
    try {
      await inlineTagsService.deleteType(id);
      dispatch({ type: 'DELETE_TAG_TYPE', id });
      // Refresh counts
      const counts = await inlineTagsService.getCountsByType();
      dispatch({ type: 'LOAD_COUNTS_SUCCESS', counts });
    } catch (error) {
      console.error('Failed to delete tag type:', error);
      throw error;
    }
  }, []);

  const setSelectedTagType = useCallback((id) => {
    dispatch({ type: 'SET_SELECTED_TAG_TYPE', id });
  }, []);

  const loadTagInstances = useCallback(async (filters = {}) => {
    dispatch({ type: 'LOAD_INSTANCES_START' });
    try {
      const instances = await inlineTagsService.getTags(filters);
      dispatch({ type: 'LOAD_INSTANCES_SUCCESS', instances });
      return instances;
    } catch (error) {
      console.error('Failed to load tag instances:', error);
      dispatch({ type: 'LOAD_INSTANCES_ERROR' });
      throw error;
    }
  }, []);

  const searchTags = useCallback(async (query, limit = 50) => {
    dispatch({ type: 'LOAD_INSTANCES_START' });
    try {
      const instances = await inlineTagsService.search(query, limit);
      dispatch({ type: 'LOAD_INSTANCES_SUCCESS', instances });
      return instances;
    } catch (error) {
      console.error('Failed to search tags:', error);
      dispatch({ type: 'LOAD_INSTANCES_ERROR' });
      throw error;
    }
  }, []);

  const refreshCounts = useCallback(async () => {
    try {
      const counts = await inlineTagsService.getCountsByType();
      dispatch({ type: 'LOAD_COUNTS_SUCCESS', counts });
    } catch (error) {
      console.error('Failed to refresh tag counts:', error);
    }
  }, []);

  const getTagTypeById = useCallback((id) => {
    return state.tagTypes.find(t => t.id === id);
  }, [state.tagTypes]);

  return (
    <InlineTagsContext.Provider value={{
      ...state,
      createTagType,
      updateTagType,
      deleteTagType,
      setSelectedTagType,
      loadTagInstances,
      searchTags,
      refreshCounts,
      refreshTagTypes: loadTagTypes,
      getTagTypeById
    }}>
      {children}
    </InlineTagsContext.Provider>
  );
};

export const useInlineTags = () => {
  const context = useContext(InlineTagsContext);
  if (!context) {
    throw new Error('useInlineTags must be used within an InlineTagsProvider');
  }
  return context;
};
