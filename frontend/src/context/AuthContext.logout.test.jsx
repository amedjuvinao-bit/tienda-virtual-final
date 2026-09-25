import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { setAdminSessionActive } from '../lib/api';
import { finishPendingAdminLogout, isAdminLogoutPending, logoutAdminSession, PENDING_LOGOUT_KEY } from '../admin/api/adminAuthApi';
import { AuthProvider, useAuth } from './AuthContext';

const logoutState = vi.hoisted(() => ({ pending: false }));
vi.mock('../lib/api', () => ({
  default: { get: vi.fn() },
  clearLegacyAdminToken: vi.fn(),
  setAdminSessionActive: vi.fn(),
}));
vi.mock('../admin/api/adminAuthApi', () => {
  const logoutAdminSession = vi.fn();
  return {
    logoutAdminSession,
    PENDING_LOGOUT_KEY: 'rb_admin_logout_pending',
    isAdminLogoutPending: vi.fn(() => logoutState.pending),
    markAdminLogoutPending: vi.fn(() => { logoutState.pending = true; }),
    finishPendingAdminLogout: vi.fn(async () => {
      if (!logoutState.pending) return;
      await logoutAdminSession();
      logoutState.pending = false;
    }),
  };
});

function SessionStatus({ onLogout }) {
  const { isAuthenticated, authLoading, logout } = useAuth();
  return <>
    <span>{authLoading ? 'verificando' : isAuthenticated ? 'autenticado' : 'sin sesión'}</span>
    <button type="button" onClick={() => onLogout(logout())}>Cerrar sesión</button>
  </>;
}

describe('confirmación del cierre de sesión admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logoutState.pending = false;
    api.get.mockResolvedValue({ data: { authenticated: true, user: { username: 'admin' } } });
  });
  afterEach(cleanup);

  it('sale de inmediato y completa el cierre cuando el servidor confirma', async () => {
    let confirm;
    logoutAdminSession.mockReturnValue(new Promise((resolve) => { confirm = resolve; }));
    render(<AuthProvider><SessionStatus onLogout={() => {}} /></AuthProvider>);
    await screen.findByText('autenticado');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(screen.getByText('sin sesión')).toBeInTheDocument();
    expect(setAdminSessionActive).toHaveBeenCalledWith(false);
    expect(isAdminLogoutPending()).toBe(true);

    await act(async () => { confirm({ ok: true }); await Promise.resolve(); });
    expect(isAdminLogoutPending()).toBe(false);
  });

  it('sale del panel ante error y conserva el cierre pendiente para reintentarlo', async () => {
    logoutAdminSession.mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ ok: true });
    render(<AuthProvider><SessionStatus onLogout={() => {}} /></AuthProvider>);
    await screen.findByText('autenticado');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(screen.getByText('sin sesión')).toBeInTheDocument();
    await waitFor(() => expect(logoutAdminSession).toHaveBeenCalledTimes(1));
    expect(isAdminLogoutPending()).toBe(true);

    await act(async () => { await finishPendingAdminLogout(); });
    expect(isAdminLogoutPending()).toBe(false);
    expect(logoutAdminSession).toHaveBeenCalledTimes(2);
  });

  it('al recargar, termina el cierre pendiente antes de verificar la sesión', async () => {
    logoutState.pending = true;
    logoutAdminSession.mockResolvedValue({ ok: true });
    render(<AuthProvider><SessionStatus onLogout={() => {}} /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('sin sesión')).toBeInTheDocument());
    expect(api.get).not.toHaveBeenCalled();
    expect(logoutAdminSession).toHaveBeenCalledTimes(1);
  });

  it('ignora una verificación antigua tras cerrar sesión desde otra pestaña', async () => {
    let resolveVerification;
    api.get.mockReturnValue(new Promise((resolve) => { resolveVerification = resolve; }));
    logoutAdminSession.mockResolvedValue({ ok: true });
    render(<AuthProvider><SessionStatus onLogout={() => {}} /></AuthProvider>);
    expect(screen.getByText('verificando')).toBeInTheDocument();

    logoutState.pending = true;
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: PENDING_LOGOUT_KEY, newValue: '1' }));
      resolveVerification({ data: { authenticated: true, user: { username: 'admin' } } });
    });
    expect(screen.getByText('sin sesión')).toBeInTheDocument();
    expect(setAdminSessionActive).not.toHaveBeenCalledWith(true);
  });
});
