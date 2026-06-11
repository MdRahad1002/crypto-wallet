import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { setAccessToken, setOnTokenUpdate, setOnUnauthorized } from '../api/client';
import axios from 'axios';
import { API_URL } from '../config/env';
import { authAPI } from '../services/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const login = useCallback((accessToken, userData) => {
    setToken(accessToken);
    setUser(userData);
    setAccessToken(accessToken);

    if (typeof window !== 'undefined' && userData) {
      window.localStorage.setItem('rw:user', JSON.stringify(userData));
    }
  }, []);

  const logout = useCallback(async () => {
    // Revoke the refreshToken cookie on the server before clearing local state
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, { withCredentials: true });
    } catch (_) {
      // Non-fatal: clear local state regardless of server response
    }

    setToken(null);
    setUser(null);
    setAccessToken(null);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('rw:user');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const attemptRefresh = async (retriesLeft = 1) => {
      try {
        return await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
      } catch (err) {
        const status = err?.response?.status;
        // Don't retry explicit auth failures — token is genuinely invalid
        if (status === 401 || status === 403) throw err;
        // One retry after a short delay to handle Vercel cold-start timeouts
        if (retriesLeft > 0) {
          await new Promise(r => setTimeout(r, 1500));
          return attemptRefresh(retriesLeft - 1);
        }
        throw err;
      }
    };

    const bootstrapSession = async () => {
      try {
        let hasStoredUser = false;

        if (typeof window !== 'undefined') {
          const storedUser = window.localStorage.getItem('rw:user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
            hasStoredUser = true;
          }
        }

        if (!hasStoredUser) {
          return;
        }

        const response = await attemptRefresh();

        if (!mounted) return;

        const refreshedToken = response.data?.token || null;
        if (refreshedToken) {
          setToken(refreshedToken);
          setAccessToken(refreshedToken);
          // Bind CSRF cookie to this session (refreshToken cookie is now set)
          try { await authAPI.fetchCsrfToken(); } catch (_) { /* non-fatal */ }
        }
      } catch (error) {
        if (mounted) {
          setToken(null);
          setAccessToken(null);
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('rw:user');
          }
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsAuthReady(true);
        }
      }
    };

    bootstrapSession();

    return () => {
      mounted = false;
    };
  }, []);

  // Set up callbacks for the axios interceptor
  useEffect(() => {
    setOnTokenUpdate((newToken) => {
      setToken(newToken);
      setAccessToken(newToken);
    });

    setOnUnauthorized(() => {
      logout();
    });
  }, [logout]);

  const value = useMemo(() => ({
    token,
    user,
    isAuthReady,
    isAuthenticated: Boolean(token),
    login,
    logout
  }), [token, user, isAuthReady, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
