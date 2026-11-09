import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('zuno_user');
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('zuno_token') || null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Validate active session against server
  const checkAuth = useCallback(async () => {
    const existingToken = localStorage.getItem('zuno_token');
    if (!existingToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      if (res.success && res.user) {
        setUser(res.user);
        localStorage.setItem('zuno_user', JSON.stringify(res.user));
      } else {
        throw new Error('Invalid session response');
      }
    } catch (err) {
      console.warn('[AuthContext] Session expired or invalid:', err.message);
      localStorage.removeItem('zuno_token');
      localStorage.removeItem('zuno_user');
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('zuno-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('zuno-unauthorized', handleUnauthorized);
  }, [checkAuth]);

  const login = async (email, password) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.success && res.user && res.token) {
        localStorage.setItem('zuno_token', res.token);
        localStorage.setItem('zuno_user', JSON.stringify(res.user));
        setUser(res.user);
        setToken(res.token);
        return { success: true, user: res.user };
      } else {
        throw new Error(res.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError(err.message || 'Login failed. Please check your credentials.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (fullName, email, password, confirmPassword) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const res = await api.register(fullName, email, password, confirmPassword);
      if (res.success && res.user && res.token) {
        localStorage.setItem('zuno_token', res.token);
        localStorage.setItem('zuno_user', JSON.stringify(res.user));
        setUser(res.user);
        setToken(res.token);
        return { success: true, user: res.user };
      } else {
        throw new Error(res.error || 'Registration failed');
      }
    } catch (err) {
      setAuthError(err.message || 'Registration failed. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
    } finally {
      setUser(null);
      setToken(null);
      setAuthError(null);
      setIsLoading(false);
    }
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    authError,
    setAuthError,
    login,
    register,
    logout,
    checkAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
