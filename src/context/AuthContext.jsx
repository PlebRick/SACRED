import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authRequired, setAuthRequired] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const status = await authService.checkAuth();
      setIsAuthenticated(status.authenticated);
      setAuthRequired(status.authRequired);
    } catch (err) {
      console.error('Auth check failed:', err);
      // On error, assume auth is required and not authenticated
      setIsAuthenticated(false);
      setAuthRequired(true);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (password) => {
    setError(null);

    try {
      await authService.login(password);
      setIsAuthenticated(true);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsAuthenticated(false);
    }
  }, []);

  const value = {
    isAuthenticated,
    authRequired,
    loading,
    error,
    login,
    logout,
    clearError: () => setError(null)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
