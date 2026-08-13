import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  api: { get: vi.fn(), delete: vi.fn() },
}));

vi.mock('../lib/api', () => ({ default: state.api }));

import favoriteAdminApi from './favoriteAdminApi';

describe('contrato administrativo centralizado de favoritos', () => {
  beforeEach(() => Object.values(state.api).forEach((mock) => mock.mockReset()));

  it('usa rutas administrativas para listado, resumen y detalle', async () => {
    state.api.get.mockResolvedValue({ data: {} });
    await favoriteAdminApi.list({ page: 1, q: '' });
    await favoriteAdminApi.summary({ view: 'recent' });
    await favoriteAdminApi.detail('favorite_safe');
    expect(state.api.get.mock.calls.map((call) => call[0])).toEqual([
      '/api/favorites/admin',
      '/api/favorites/admin/summary',
      '/api/favorites/admin/favorite_safe',
    ]);
    expect(state.api.get.mock.calls[0][1].params).toEqual({ page: 1 });
  });

  it('separa las mutaciones de ítem y documento', async () => {
    state.api.delete.mockResolvedValue({ data: {} });
    await favoriteAdminApi.removeItem('favorite_safe', 'item_safe');
    await favoriteAdminApi.remove('favorite_safe');
    expect(state.api.delete.mock.calls.map((call) => call[0])).toEqual([
      '/api/favorites/admin/favorite_safe/items/item_safe',
      '/api/favorites/admin/favorite_safe',
    ]);
  });

  it('exporta con filtros limpios y respuesta binaria', async () => {
    state.api.get.mockResolvedValue({ data: new Blob() });
    await favoriteAdminApi.export({ view: 'high_intent', q: '', minItems: null });
    expect(state.api.get).toHaveBeenCalledWith('/api/favorites/admin/export', {
      params: { view: 'high_intent' },
      responseType: 'blob',
    });
  });
});
