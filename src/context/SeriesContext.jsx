import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { seriesService } from '../services/seriesService';

const SeriesContext = createContext();

const initialState = {
  series: [],
  loading: true,
  error: null,
  selectedSeriesId: null
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return { ...state, loading: false, series: action.series };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'ADD_SERIES':
      return { ...state, series: [...state.series, action.series] };
    case 'UPDATE_SERIES':
      return {
        ...state,
        series: state.series.map(s =>
          s.id === action.series.id ? action.series : s
        )
      };
    case 'DELETE_SERIES':
      return {
        ...state,
        series: state.series.filter(s => s.id !== action.id),
        selectedSeriesId: state.selectedSeriesId === action.id ? null : state.selectedSeriesId
      };
    case 'SET_SELECTED':
      return { ...state, selectedSeriesId: action.id };
    default:
      return state;
  }
};

export const SeriesProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load series on mount
  const loadSeries = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const series = await seriesService.getAll();
      dispatch({ type: 'LOAD_SUCCESS', series });
    } catch (error) {
      dispatch({ type: 'LOAD_ERROR', error: error.message });
    }
  }, []);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  const createSeries = useCallback(async ({ name, description }) => {
    try {
      const series = await seriesService.create({ name, description });
      dispatch({ type: 'ADD_SERIES', series });
      return series;
    } catch (error) {
      console.error('Failed to create series:', error);
      throw error;
    }
  }, []);

  const updateSeries = useCallback(async (id, { name, description }) => {
    try {
      const series = await seriesService.update(id, { name, description });
      dispatch({ type: 'UPDATE_SERIES', series });
      return series;
    } catch (error) {
      console.error('Failed to update series:', error);
      throw error;
    }
  }, []);

  const deleteSeries = useCallback(async (id) => {
    try {
      await seriesService.delete(id);
      dispatch({ type: 'DELETE_SERIES', id });
    } catch (error) {
      console.error('Failed to delete series:', error);
      throw error;
    }
  }, []);

  const addSermonToSeries = useCallback(async (seriesId, noteId) => {
    try {
      await seriesService.addSermon(seriesId, noteId);
      // Refresh to get updated counts
      await loadSeries();
    } catch (error) {
      console.error('Failed to add sermon to series:', error);
      throw error;
    }
  }, [loadSeries]);

  const removeSermonFromSeries = useCallback(async (seriesId, noteId) => {
    try {
      await seriesService.removeSermon(seriesId, noteId);
      // Refresh to get updated counts
      await loadSeries();
    } catch (error) {
      console.error('Failed to remove sermon from series:', error);
      throw error;
    }
  }, [loadSeries]);

  const setSelectedSeries = useCallback((id) => {
    dispatch({ type: 'SET_SELECTED', id });
  }, []);

  const refreshSeries = useCallback(async () => {
    await loadSeries();
  }, [loadSeries]);

  const getSeriesById = useCallback((id) => {
    return state.series.find(s => s.id === id);
  }, [state.series]);

  return (
    <SeriesContext.Provider value={{
      ...state,
      createSeries,
      updateSeries,
      deleteSeries,
      addSermonToSeries,
      removeSermonFromSeries,
      setSelectedSeries,
      refreshSeries,
      getSeriesById
    }}>
      {children}
    </SeriesContext.Provider>
  );
};

export const useSeries = () => {
  const context = useContext(SeriesContext);
  if (!context) {
    throw new Error('useSeries must be used within a SeriesProvider');
  }
  return context;
};
