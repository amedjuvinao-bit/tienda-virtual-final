import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../../lib/api';
import {
  fetchPaymentSettings,
  savePaymentSettings,
  testWompiMerchant,
} from './paymentSettingsApi';

vi.mock('../../../lib/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

describe('paymentSettingsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa la ruta administrativa dedicada para leer y guardar', async () => {
    const payload = { settings: { provider: 'wompi' }, revision: 3 };
    api.get.mockResolvedValue({ data: { revision: 3 } });
    api.put.mockResolvedValue({ data: { revision: 4 } });

    await expect(fetchPaymentSettings()).resolves.toMatchObject({ revision: 3 });
    await expect(savePaymentSettings(payload)).resolves.toMatchObject({ revision: 4 });
    expect(api.get).toHaveBeenCalledWith('/api/admin/payment-settings');
    expect(api.put).toHaveBeenCalledWith('/api/admin/payment-settings', payload);
  });

  it('conserva la prueba oficial de comercio Wompi', async () => {
    const payload = { mode: 'sandbox', publicKey: 'pub_test_value' };
    api.post.mockResolvedValue({ data: { ok: true } });
    await expect(testWompiMerchant(payload)).resolves.toMatchObject({ ok: true });
    expect(api.post).toHaveBeenCalledWith('/api/payments/admin/wompi/test-merchant', payload);
  });
});
