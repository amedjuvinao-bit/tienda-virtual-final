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
