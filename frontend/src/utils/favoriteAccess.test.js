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
    await expect(ensureFavoriteAccess(api)).resolves.toEqual({ sessionId, token });
    await expect(ensureFavoriteAccess(api)).resolves.toEqual({ sessionId, token });
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
