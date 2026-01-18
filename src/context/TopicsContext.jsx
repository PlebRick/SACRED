import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { topicsService } from '../services/topicsService';

const TopicsContext = createContext();

const initialState = {
  topics: [],      // Tree structure with note counts
  flatTopics: [],  // Flat list for dropdowns
  loading: true,
  error: null,
  selectedTopicId: null
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return { ...state, loading: false, topics: action.topics };
    case 'LOAD_FLAT_SUCCESS':
      return { ...state, flatTopics: action.topics };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'ADD_TOPIC':
      return {
        ...state,
        flatTopics: [...state.flatTopics, action.topic]
      };
    case 'UPDATE_TOPIC':
      return {
        ...state,
        flatTopics: state.flatTopics.map(t =>
          t.id === action.topic.id ? action.topic : t
        )
      };
    case 'DELETE_TOPIC':
      return {
        ...state,
        flatTopics: state.flatTopics.filter(t => t.id !== action.id),
        selectedTopicId: state.selectedTopicId === action.id ? null : state.selectedTopicId
      };
    case 'SET_SELECTED':
      return { ...state, selectedTopicId: action.id };
    default:
      return state;
  }
};

export const TopicsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load topics on mount
  const loadTopics = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const [tree, flat] = await Promise.all([
        topicsService.getTree(),
        topicsService.getFlat()
      ]);
      dispatch({ type: 'LOAD_SUCCESS', topics: tree });
      dispatch({ type: 'LOAD_FLAT_SUCCESS', topics: flat });
    } catch (error) {
      dispatch({ type: 'LOAD_ERROR', error: error.message });
    }
  }, []);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const createTopic = useCallback(async (topicData) => {
    try {
      const topic = await topicsService.create(topicData);
      dispatch({ type: 'ADD_TOPIC', topic });
      // Reload tree to get updated counts and structure
      const tree = await topicsService.getTree();
      dispatch({ type: 'LOAD_SUCCESS', topics: tree });
      return topic;
    } catch (error) {
      console.error('Failed to create topic:', error);
      throw error;
    }
  }, []);

  const updateTopic = useCallback(async (id, updates) => {
    try {
      const topic = await topicsService.update(id, updates);
      dispatch({ type: 'UPDATE_TOPIC', topic });
      // Reload tree to get updated structure
      const tree = await topicsService.getTree();
      dispatch({ type: 'LOAD_SUCCESS', topics: tree });
      return topic;
    } catch (error) {
      console.error('Failed to update topic:', error);
      throw error;
    }
  }, []);

  const deleteTopic = useCallback(async (id) => {
    try {
      await topicsService.delete(id);
      dispatch({ type: 'DELETE_TOPIC', id });
      // Reload tree to get updated structure
      const tree = await topicsService.getTree();
      dispatch({ type: 'LOAD_SUCCESS', topics: tree });
    } catch (error) {
      console.error('Failed to delete topic:', error);
      throw error;
    }
  }, []);

  const setSelectedTopic = useCallback((id) => {
    dispatch({ type: 'SET_SELECTED', id });
  }, []);

  const refreshTopics = useCallback(async () => {
    await loadTopics();
  }, [loadTopics]);

  const seedDefaultTopics = useCallback(async () => {
    try {
      await topicsService.seed();
      await loadTopics();
    } catch (error) {
      console.error('Failed to seed topics:', error);
      throw error;
    }
  }, [loadTopics]);

  const getTopicById = useCallback((id) => {
    return state.flatTopics.find(t => t.id === id);
  }, [state.flatTopics]);

  // Build path from root to a topic (for breadcrumbs)
  const getTopicPath = useCallback((id) => {
    const path = [];
    let current = state.flatTopics.find(t => t.id === id);
    while (current) {
      path.unshift(current);
      current = state.flatTopics.find(t => t.id === current.parentId);
    }
    return path;
  }, [state.flatTopics]);

  return (
    <TopicsContext.Provider value={{
      ...state,
      createTopic,
      updateTopic,
      deleteTopic,
      setSelectedTopic,
      refreshTopics,
      seedDefaultTopics,
      getTopicById,
      getTopicPath
    }}>
      {children}
    </TopicsContext.Provider>
  );
};

export const useTopics = () => {
  const context = useContext(TopicsContext);
  if (!context) {
    throw new Error('useTopics must be used within a TopicsProvider');
  }
  return context;
};
