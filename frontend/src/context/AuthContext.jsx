// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api, { setAdminToken } from '../lib/api';

const AuthContext = createContext();

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );

    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getTokenExpirationMs(token) {
  const payload = decodeJwtPayload(token);

  if (!payload?.exp) return null;

  return payload.exp * 1000;
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminToken, setAdminTokenState] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const logoutTimerRef = useRef(null);

  const clearLogoutTimer = () => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  };

  const logout = () => {
    clearLogoutTimer();
    setIsAuthenticated(false);
    setAdminTokenState(null);
    localStorage.removeItem('auth');
    setAdminToken(null);
  };

  const scheduleAutoLogout = (token) => {
    clearLogoutTimer();

    const expiresAt = getTokenExpirationMs(token);

    if (!expiresAt) return;

    const timeLeft = expiresAt - Date.now();

    if (timeLeft <= 0) {
      logout();
      return;
    }

    logoutTimerRef.current = setTimeout(() => {
      logout();
    }, timeLeft);
  };

  useEffect(() => {
    const verifyStoredSession = async () => {
      const storedToken = localStorage.getItem('admin_token');

      if (!storedToken) {
        logout();
        setAuthLoading(false);
        return;
      }

      const expiresAt = getTokenExpirationMs(storedToken);

      if (expiresAt && expiresAt <= Date.now()) {
        logout();
        setAuthLoading(false);
        return;
      }

      try {
        setAdminToken(storedToken);

        await api.get('/api/admin/auth/verify');

        setIsAuthenticated(true);
        setAdminTokenState(storedToken);
        localStorage.setItem('auth', 'true');
        scheduleAutoLogout(storedToken);
      } catch {
        logout();
      } finally {
        setAuthLoading(false);
      }
    };

    verifyStoredSession();

    return () => {
      clearLogoutTimer();
    };
  }, []);

  const login = (token) => {
    setIsAuthenticated(true);
    setAdminTokenState(token);
    localStorage.setItem('auth', 'true');
    localStorage.setItem('admin_token', token);
    setAdminToken(token);
    scheduleAutoLogout(token);
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, adminToken, authLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}