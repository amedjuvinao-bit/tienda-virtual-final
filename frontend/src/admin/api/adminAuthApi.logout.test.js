import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../lib/api';
import {
  finishPendingAdminLogout,
  isAdminLogoutPending,
  loginAdmin,
  markAdminLogoutPending,
} from './adminAuthApi';

vi.mock('../../lib/api', () => ({ default: { post: vi.fn() } }));

describe('cierre pendiente antes del siguiente acceso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(async () => {
    api.post.mockResolvedValue({ data: { ok: true } });
    await finishPendingAdminLogout();
    localStorage.clear();
  });

  it('impide restaurar una sesión anterior y la cierra antes de un nuevo login', async () => {
    api.post.mockRejectedValueOnce(new Error('sin conexión'))
      .mockResolvedValueOnce({ data: { ok: true } })
      .mockResolvedValueOnce({ data: { user: { username: 'admin' } } });

    markAdminLogoutPending();
    await expect(finishPendingAdminLogout()).rejects.toThrow('sin conexión');
    expect(isAdminLogoutPending()).toBe(true);

    const result = await loginAdmin({ username: 'admin', password: 'prueba' });
    expect(result.user.username).toBe('admin');
    expect(api.post.mock.calls.map(([url]) => url)).toEqual([
      '/api/admin/auth/logout', '/api/admin/auth/logout', '/api/admin/auth/login',
    ]);
    expect(api.post.mock.calls[0][1]).toEqual({});
    expect(api.post.mock.calls[1][1]).toEqual({});
    expect(isAdminLogoutPending()).toBe(false);
  });

  it('no inicia otro login mientras sigue sin poder cerrar la sesión anterior', async () => {
    markAdminLogoutPending();
    api.post.mockRejectedValueOnce(new Error('servidor no disponible'));
    await expect(loginAdmin({ username: 'admin', password: 'prueba' }))
      .rejects.toThrow('servidor no disponible');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(isAdminLogoutPending()).toBe(true);
  });
});
