// src/context/AuthContext.jsx

import React, { createContext, useContext, useEffect, useState } from 'react';
import api, {
  clearLegacyAdminToken,
  setAdminSessionActive,
} from '../lib/api';
import {
  finishPendingAdminLogout,
  isAdminLogoutPending,
  markAdminLogoutPending,
  PENDING_LOGOUT_KEY,
} from '../admin/api/adminAuthApi';

const AuthContext = createContext();
let initialSessionVerificationPromise = null;

function requestAdminSessionVerification() {
  return api.get('/api/admin/auth/verify', { skipAdminRefresh: true });
}

async function verifyInitialAdminSession() {
  if (!initialSessionVerificationPromise) {
    initialSessionVerificationPromise = requestAdminSessionVerification()
      .then(async (response) => {
        if (!response?.data?.retryable) return response;
        await new Promise((resolve) => globalThis.setTimeout(resolve, 200));
        return requestAdminSessionVerification();
      })
      .finally(() => {
        initialSessionVerificationPromise = null;
      });
  }

  return initialSessionVerificationPromise;
}

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
    let logoutObserved = false;

    const verifyStoredSession = async () => {
      removeLegacySessionStorage();

      try {
        if (isAdminLogoutPending()) {
          if (alive) clearClientSession();
          void finishPendingAdminLogout().catch(() => {});
          return;
        }
        const response = await verifyInitialAdminSession();
        if (!alive) return;
        if (logoutObserved || isAdminLogoutPending()) {
          clearClientSession();
          return;
        }
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

    const handlePendingLogout = (event) => {
      if (!alive) return;
      if (event.type === 'storage' &&
        (event.key !== PENDING_LOGOUT_KEY || event.newValue !== '1')) return;
      if (isAdminLogoutPending() || event.type === 'storage') {
        logoutObserved = true;
        clearClientSession();
        void finishPendingAdminLogout().catch(() => {});
      }
    };

    const handleTwoFactorPolicyUpdated = async () => {
      try {
        const response = await requestAdminSessionVerification();
        if (!alive || logoutObserved || isAdminLogoutPending()) return;
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
    window.addEventListener('online', handlePendingLogout);
    window.addEventListener('storage', handlePendingLogout);
    window.addEventListener(
      'admin-two-factor-policy-updated',
      handleTwoFactorPolicyUpdated
    );
    verifyStoredSession();

    return () => {
      alive = false;
      window.removeEventListener('admin-session-expired', handleSessionExpired);
      window.removeEventListener('online', handlePendingLogout);
      window.removeEventListener('storage', handlePendingLogout);
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

  const logout = () => {
    markAdminLogoutPending();
    clearClientSession();
    // La salida visual no depende de la red; el cierre pendiente impide restaurar la sesión.
    void finishPendingAdminLogout().catch(() => {});
  };

  const refreshAdminUser = async () => {
    if (!isAuthenticated) return null;
    const response = await requestAdminSessionVerification();
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
