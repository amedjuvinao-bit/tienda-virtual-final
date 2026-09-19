// src/context/AuthContext.jsx

import React, { createContext, useContext, useEffect, useState } from 'react';
import api, {
  clearLegacyAdminToken,
  setAdminSessionActive,
} from '../lib/api';
import { logoutAdminSession } from '../admin/api/adminAuthApi';

const AuthContext = createContext();

function normalizeAdminUser(user) {
  if (!user || typeof user !== 'object') return null;

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
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    twoFactorRequired: Boolean(user.twoFactorRequired),
    twoFactorSetupRequired: Boolean(user.twoFactorSetupRequired),
    twoFactorPolicyMisconfigured: Boolean(user.twoFactorPolicyMisconfigured),
  };
}

function removeLegacySessionStorage() {
  clearLegacyAdminToken();
  try {
    localStorage.removeItem('auth');
    localStorage.removeItem('admin_user');
  } catch {
    // El estado sensible ya no se persiste en JavaScript.
  }
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const clearClientSession = () => {
    setAdminSessionActive(false);
    setIsAuthenticated(false);
    setAdminUser(null);
    removeLegacySessionStorage();
  };

  useEffect(() => {
    let alive = true;

    const verifyStoredSession = async () => {
      removeLegacySessionStorage();

      try {
        const response = await api.get('/api/admin/auth/verify');
        if (!alive) return;
        const verifiedUser = normalizeAdminUser(response?.data?.user);
        if (response?.data?.authenticated === false || !verifiedUser) {
          clearClientSession();
          return;
        }
        setAdminSessionActive(true);
        setIsAuthenticated(true);
        setAdminUser(verifiedUser);
      } catch {
        if (alive) clearClientSession();
      } finally {
        if (alive) setAuthLoading(false);
      }
    };

    const handleSessionExpired = () => {
      if (alive) clearClientSession();
    };

    const handleTwoFactorPolicyUpdated = async () => {
      try {
        const response = await api.get('/api/admin/auth/verify');
        if (!alive) return;
        const verifiedUser = normalizeAdminUser(response?.data?.user);
        if (response?.data?.authenticated === false || !verifiedUser) {
          clearClientSession();
          return;
        }
        setAdminUser(verifiedUser);
      } catch {
        if (alive) clearClientSession();
      }
    };

    window.addEventListener('admin-session-expired', handleSessionExpired);
    window.addEventListener(
      'admin-two-factor-policy-updated',
      handleTwoFactorPolicyUpdated
    );
    verifyStoredSession();

    return () => {
      alive = false;
      window.removeEventListener('admin-session-expired', handleSessionExpired);
      window.removeEventListener(
        'admin-two-factor-policy-updated',
        handleTwoFactorPolicyUpdated
      );
    };
  }, []);

  const login = (user = null) => {
    const normalizedUser = normalizeAdminUser(user);
    setAdminSessionActive(true);
    setIsAuthenticated(true);
    setAdminUser(normalizedUser);
    removeLegacySessionStorage();
  };

  const logout = async () => {
    clearClientSession();
    try {
      await logoutAdminSession();
    } catch {
      // El servidor expirará la cookie si momentáneamente no hay conexión.
    }
  };

  const refreshAdminUser = async () => {
    if (!isAuthenticated) return null;
    const response = await api.get('/api/admin/auth/verify');
    const verifiedUser = normalizeAdminUser(response?.data?.user);
    if (response?.data?.authenticated === false || !verifiedUser) {
      clearClientSession();
      return null;
    }
    setAdminUser(verifiedUser);
    return verifiedUser;
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        // Los módulos existentes solo comprueban si hay sesión; nunca reciben
        // el JWT real, que permanece en una cookie HttpOnly.
        adminToken: isAuthenticated ? 'http-only-session' : null,
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
