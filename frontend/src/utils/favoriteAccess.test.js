import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFavoriteAccessHeaders,
  clearFavoriteAccess,
  ensureFavoriteAccess,
  getFavoriteAccess,
  storeFavoriteAccess,
} from './favoriteAccess';

const sessionId = `fav_${'a'.repeat(32)}`;
const token = `ft1_${'b'.repeat(43)}.${'c'.repeat(43)}`;

describe('acceso seguro de favoritos', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('persiste una capacidad completa y construye encabezados dedicados', () => {
    expect(storeFavoriteAccess(sessionId, token)).toBe(true);
    expect(getFavoriteAccess()).toEqual({ sessionId, token });
    expect(buildFavoriteAccessHeaders()).toEqual({
      'X-Favorite-Session-Id': sessionId,
      'X-Favorite-Access-Token': token,
    });
  });

  it('solicita una identidad al servidor una sola vez', async () => {
    const api = {
      post: vi.fn().mockResolvedValue({
        data: { sessionId, favoriteAccessToken: token },
      }),
    };
    await expect(ensureFavoriteAccess(api)).resolves.toEqual({
      sessionId,
      token,
    });
    await expect(ensureFavoriteAccess(api)).resolves.toEqual({
      sessionId,
      token,
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/api/favorites/access');
  });

  it('elimina sesión y credencial juntas', () => {
    storeFavoriteAccess(sessionId, token);
    clearFavoriteAccess();
    expect(getFavoriteAccess()).toBeNull();
    expect(buildFavoriteAccessHeaders()).toEqual({});
  });
});

it('migra las dos claves anteriores a una pareja atómica sin cambiar la sesión', () => {
  localStorage.clear();
  localStorage.setItem('favorite_session_id', sessionId);
  localStorage.setItem('favorite_access_token', token);
  expect(getFavoriteAccess()).toEqual({ sessionId, token });
  expect(JSON.parse(localStorage.getItem('favorite_access'))).toEqual({
    sessionId,
    token,
  });
  expect(localStorage.getItem('favorite_access_token')).toBeNull();
});
it('deduplica emisiones simultáneas dentro de la misma página', async () => {
  localStorage.clear();
  const api = {
    post: vi.fn(async () => ({
      data: { sessionId, favoriteAccessToken: token },
    })),
  };
  const values = await Promise.all([
    ensureFavoriteAccess(api),
    ensureFavoriteAccess(api),
  ]);
  expect(values[0]).toEqual(values[1]);
  expect(api.post).toHaveBeenCalledTimes(1);
});
