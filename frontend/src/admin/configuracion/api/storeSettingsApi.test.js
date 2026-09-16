import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../../lib/api';
import {
  fetchStoreCities,
  fetchStoreRegions,
  fetchStoreSettings,
  saveStoreSettings,
} from './storeSettingsApi';

vi.mock('../../../lib/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('storeSettingsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta únicamente la ruta administrativa protegida', async () => {
    api.get.mockResolvedValue({ data: { ok: true, revision: 2 } });

    await expect(fetchStoreSettings()).resolves.toMatchObject({ revision: 2 });
    expect(api.get).toHaveBeenCalledWith('/api/admin/store-settings');
  });

  it('envía Tienda con su revisión de concurrencia', async () => {
    const payload = { store: { name: 'Rosa Boutique' }, revision: 2 };
    api.put.mockResolvedValue({ data: { ok: true, revision: 3 } });

    await expect(saveStoreSettings(payload)).resolves.toMatchObject({ revision: 3 });
    expect(api.put).toHaveBeenCalledWith('/api/admin/store-settings', payload);
  });

  it('consulta los catálogos geográficos con país y departamento', async () => {
    api.get
      .mockResolvedValueOnce({ data: [{ code: '47', name: 'Magdalena' }] })
      .mockResolvedValueOnce({ data: [{ code: '47189', name: 'Ciénaga' }] });

    await expect(fetchStoreRegions('CO')).resolves.toHaveLength(1);
    await expect(fetchStoreCities('CO', '47')).resolves.toHaveLength(1);
    expect(api.get).toHaveBeenNthCalledWith(1, '/api/geo/regions', {
      params: { country: 'CO' },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/api/geo/cities', {
      params: { country: 'CO', region: '47', limit: 10000 },
    });
  });
});
