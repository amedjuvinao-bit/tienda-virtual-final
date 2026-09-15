import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../../lib/api';
import { fetchStoreSettings, saveStoreSettings } from './storeSettingsApi';

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
});
