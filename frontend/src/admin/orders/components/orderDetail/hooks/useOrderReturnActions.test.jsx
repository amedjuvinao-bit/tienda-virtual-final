import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import api from '../../../../../lib/api';
import useOrderReturnActions from './useOrderReturnActions';

vi.mock('../../../../../lib/api', () => ({
  default: {
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('creación RMA administrativa idempotente', () => {
  it('reutiliza la clave en reintentos, rota con el payload y limpia al crear', async () => {
    api.post
      .mockRejectedValueOnce({ response: { status: 503, data: {} } })
      .mockRejectedValueOnce({ response: { status: 503, data: {} } })
      .mockRejectedValueOnce({ response: { status: 503, data: {} } })
      .mockResolvedValueOnce({ data: { ok: true } })
      .mockResolvedValueOnce({ data: { ok: true } });

    const synchronizeAfterMutation = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useOrderReturnActions({
        orderId: 'order-admin-1',
        canManageReturns: true,
        synchronizeAfterMutation,
        fetchReturns: vi.fn(),
        showToast: vi.fn(),
      })
    );
    const firstPayload = {
      requestedResolution: 'refund',
      items: [{ orderItemId: 'line-1', quantity: 1, reasonCode: 'damaged' }],
    };
    const changedPayload = {
      ...firstPayload,
      items: [{ ...firstPayload.items[0], quantity: 2 }],
    };

    await act(async () => result.current.createReturn(firstPayload));
    await act(async () => result.current.createReturn(firstPayload));
    await act(async () => result.current.createReturn(changedPayload));
    await act(async () => result.current.createReturn(changedPayload));
    await act(async () => result.current.createReturn(changedPayload));

    const calls = api.post.mock.calls;
    expect(calls).toHaveLength(5);
    calls.forEach(([url, body, config]) => {
      expect(url).toBe('/api/orders/order-admin-1/returns');
      expect(body).not.toHaveProperty('idempotencyKey');
      expect(Object.keys(config.headers)).toEqual(['Idempotency-Key']);
      expect(config.headers['Idempotency-Key'].length).toBeGreaterThanOrEqual(8);
      expect(config.headers['Idempotency-Key'].length).toBeLessThanOrEqual(200);
    });

    const keys = calls.map((call) => call[2].headers['Idempotency-Key']);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
    expect(keys[3]).toBe(keys[2]);
    expect(keys[4]).not.toBe(keys[3]);
    expect(synchronizeAfterMutation).toHaveBeenCalledTimes(2);
  });
});

describe('logística RMA idempotente', () => {
  it('reutiliza la clave de guía cuando la respuesta de red falla', async () => {
    api.post
      .mockRejectedValueOnce({ response: { status: 503, data: {} } })
      .mockResolvedValueOnce({ data: { ok: true, returnCase: { revision: 2 } } });
    const synchronizeAfterMutation = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useOrderReturnActions({
        orderId: 'order-shipping-1',
        canManageReturns: true,
        synchronizeAfterMutation,
        fetchReturns: vi.fn(),
        showToast: vi.fn(),
      })
    );
    const returnCase = { _id: 'return-1', revision: 1 };
    const payload = {
      destinationBranchId: 'branch-1',
      packages: [{ weightGrams: 900, lengthCm: 30, widthCm: 20, heightCm: 12 }],
      rate: { carrier: 'coordinadora', service: 'standard', totalPrice: 18500 },
    };

    let firstError;
    await act(async () => {
      try {
        await result.current.runReturnShipping(returnCase, 'label', payload);
      } catch (error) {
        firstError = error;
      }
    });
    expect(firstError).toBeDefined();
    await act(async () => result.current.runReturnShipping(returnCase, 'label', payload));

    expect(api.post).toHaveBeenCalledTimes(2);
    const first = api.post.mock.calls[0];
    const second = api.post.mock.calls[1];
    expect(first[0]).toBe('/api/orders/order-shipping-1/returns/return-1/shipping/label');
    expect(first[2].headers['Idempotency-Key']).toBe(second[2].headers['Idempotency-Key']);
    expect(synchronizeAfterMutation).toHaveBeenCalledTimes(1);
  });
});
