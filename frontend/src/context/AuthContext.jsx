// src/context/AuthContext.jsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
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

function buildFallbackAdminUserFromToken(token) {
  const payload = decodeJwtPayload(token);

  if (!payload) return null;

  const username = payload.username || '';
  const adminRole = payload.adminRole || payload.actualRole || payload.role || '';

  return {
    id: payload.adminUserId || '',
    username,
    displayName: username,
    fullName: username,
    email: '',
    role: payload.role || 'admin',
    adminRole,
    actualRole: adminRole,
    roleRef: payload.roleRef || null,
    defaultBranch: payload.defaultBranch || null,
    permissions: [],
    branches: [],
    status: 'active',
    active: true,
    mustChangePassword: false,
  };
}

function normalizeAdminUser(user, fallbackToken = '') {
  if (!user || typeof user !== 'object') {
    return buildFallbackAdminUserFromToken(fallbackToken);
  }

  const username = user.username || user.profile?.username || '';
  const displayName =
    user.displayName ||
    user.fullName ||
    user.profile?.displayName ||
    user.profile?.fullName ||
    username ||
    'Usuario';

  const adminRole =
    user.adminRole ||
    user.actualRole ||
    user.profile?.role ||
    user.role ||
    'admin';

  return {
    ...user,
    id: user.id || user._id || user.profile?._id || '',
    username,
    displayName,
    fullName: user.fullName || displayName,
    email: user.email || user.profile?.email || '',
    role: user.role || 'admin',
    adminRole,
    actualRole: user.actualRole || adminRole,
    roleRef: user.roleRef || user.profile?.roleRef || null,
    defaultBranch: user.defaultBranch || user.profile?.defaultBranch || null,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    branches: Array.isArray(user.branches) ? user.branches : [],
    status: user.status || user.profile?.status || 'active',
    active: user.active !== undefined ? user.active : true,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminToken, setAdminTokenState] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
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
    setAdminUser(null);
    localStorage.removeItem('auth');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
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

        const response = await api.get('/api/admin/auth/verify');
        const verifiedUser = normalizeAdminUser(response?.data?.user, storedToken);

        setIsAuthenticated(true);
        setAdminTokenState(storedToken);
        setAdminUser(verifiedUser);
        localStorage.setItem('auth', 'true');

        if (verifiedUser) {
          localStorage.setItem('admin_user', JSON.stringify(verifiedUser));
        } else {
          localStorage.removeItem('admin_user');
        }

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

  const login = (token, user = null) => {
    const normalizedUser = normalizeAdminUser(user, token);

    setIsAuthenticated(true);
    setAdminTokenState(token);
    setAdminUser(normalizedUser);

    localStorage.setItem('auth', 'true');
    localStorage.setItem('admin_token', token);

    if (normalizedUser) {
      localStorage.setItem('admin_user', JSON.stringify(normalizedUser));
    } else {
      localStorage.removeItem('admin_user');
    }

    setAdminToken(token);
    scheduleAutoLogout(token);
  };

  const refreshAdminUser = async () => {
    if (!adminToken) return null;

    const response = await api.get('/api/admin/auth/verify');
    const verifiedUser = normalizeAdminUser(response?.data?.user, adminToken);

    setAdminUser(verifiedUser);

    if (verifiedUser) {
      localStorage.setItem('admin_user', JSON.stringify(verifiedUser));
    } else {
      localStorage.removeItem('admin_user');
    }

    return verifiedUser;
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        adminToken,
        adminUser,
        currentAdminUser: adminUser,
        authLoading,
        login,
        logout,
        refreshAdminUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}