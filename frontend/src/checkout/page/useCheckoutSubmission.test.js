import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', () => ({
  default: {
    post: vi.fn(),
  },
  setSessionId: vi.fn(),
}));

import api from '../../lib/api';
import { createOrderFromAuthorizedCart } from './useCheckoutSubmission';

describe('precondición atómica carrito–orden', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ status: 201, data: { _id: 'order-1' } });
  });

  it('envía versión, huella, acceso e idempotencia en la creación', async () => {
    const order = { customer: { name: 'Cliente' } };
    await createOrderFromAuthorizedCart({
      order,
      cartAccess: {
        sessionId: 'cart_session_contract',
        token: 'ct1_contract_token',
      },
      cartVersion: '2030-01-01T00:00:00.123Z',
      cartSnapshotFingerprint: 'a'.repeat(64),
      idempotencyKey: 'checkout-contract-key',
    });

    expect(api.post).toHaveBeenCalledWith('/api/orders', order, {
      headers: {
        'X-Session-Id': 'cart_session_contract',
        'X-Cart-Access-Token': 'ct1_contract_token',
        'If-Match-Updated-At': '2030-01-01T00:00:00.123Z',
        'X-Cart-Snapshot-Fingerprint': 'a'.repeat(64),
        'Idempotency-Key': 'checkout-contract-key',
      },
    });
  });
});
