import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { setAdminSessionActive } from '../lib/api';
import { logoutAdminSession } from '../admin/api/adminAuthApi';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../lib/api', () => ({
  default: { get: vi.fn() },
  clearLegacyAdminToken: vi.fn(),
  setAdminSessionActive: vi.fn(),
}));
vi.mock('../admin/api/adminAuthApi', () => ({ logoutAdminSession: vi.fn() }));

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
    api.get.mockResolvedValue({ data: { authenticated: true, user: { username: 'admin' } } });
  });
  afterEach(cleanup);

  it('mantiene la sesión mientras espera al servidor y la limpia al confirmar', async () => {
    let confirm;
    logoutAdminSession.mockReturnValue(new Promise((resolve) => { confirm = resolve; }));
    let attempt;
    render(<AuthProvider><SessionStatus onLogout={(promise) => { attempt = promise; }} /></AuthProvider>);
    await screen.findByText('autenticado');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(screen.getByText('autenticado')).toBeInTheDocument();
    expect(setAdminSessionActive).not.toHaveBeenCalledWith(false);

    await act(async () => { confirm({ ok: true }); await attempt; });
    expect(screen.getByText('sin sesión')).toBeInTheDocument();
    expect(setAdminSessionActive).toHaveBeenCalledWith(false);
  });

  it('conserva el estado hasta poder reintentar cuando falla el servidor', async () => {
    logoutAdminSession.mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ ok: true });
    let attempt;
    render(<AuthProvider><SessionStatus onLogout={(promise) => { attempt = promise; }} /></AuthProvider>);
    await screen.findByText('autenticado');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await expect(attempt).rejects.toThrow('database unavailable');
    expect(screen.getByText('autenticado')).toBeInTheDocument();
    expect(setAdminSessionActive).not.toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await act(async () => { await attempt; });
    await waitFor(() => expect(screen.getByText('sin sesión')).toBeInTheDocument());
    expect(logoutAdminSession).toHaveBeenCalledTimes(2);
  });
});
