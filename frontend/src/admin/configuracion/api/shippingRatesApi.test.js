import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../lib/api';
import { fetchShippingRates, saveShippingRates } from './shippingRatesApi';

vi.mock('../../../lib/api', () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));

describe('shippingRatesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa el endpoint administrativo protegido', async () => {
    api.get.mockResolvedValue({ data: { ok: true, revision: 2 } });
    api.put.mockResolvedValue({ data: { ok: true, revision: 3 } });
    const payload = { revision: 2, settings: { mode: 'fixed', fixedPrice: 12000 } };

    await expect(fetchShippingRates()).resolves.toMatchObject({ revision: 2 });
    await expect(saveShippingRates(payload)).resolves.toMatchObject({ revision: 3 });
    expect(api.get).toHaveBeenCalledWith('/api/admin/shipping-rates');
    expect(api.put).toHaveBeenCalledWith('/api/admin/shipping-rates', payload);
  });

  it('expone conflicto y detalles de validación al formulario', async () => {
    api.put.mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: 'SHIPPING_RATES_CONFLICT',
          message: 'Otra persona actualizó las tarifas.',
          details: [{ currentRevision: 7 }],
        },
      },
    });

    await expect(saveShippingRates({})).rejects.toMatchObject({
      code: 'SHIPPING_RATES_CONFLICT',
      status: 409,
      details: [{ currentRevision: 7 }],
    });
  });
});
