import { describe, expect, it } from 'vitest';

import {
  createRmaCreationIdempotency,
  createRmaIdempotencyKey,
  RMA_IDEMPOTENCY_KEY_LIMITS,
} from './rmaCreationIdempotency';

function sequentialCrypto() {
  let sequence = 0;
  return {
    randomUUID() {
      sequence += 1;
      return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
    },
  };
}

describe('idempotencia efímera para creación RMA', () => {
  it('genera claves seguras con el tamaño admitido por el contrato', () => {
    const key = createRmaIdempotencyKey(sequentialCrypto());
    expect(key.length).toBeGreaterThanOrEqual(RMA_IDEMPOTENCY_KEY_LIMITS.min);
    expect(key.length).toBeLessThanOrEqual(RMA_IDEMPOTENCY_KEY_LIMITS.max);
    expect(key).toMatch(/^rma-v1-[a-zA-Z0-9_-]+$/);
  });

  it('reutiliza el intento exacto, rota al cambiar el payload y limpia tras éxito', () => {
    const tracker = createRmaCreationIdempotency({
      cryptoSource: sequentialCrypto(),
    });
    const first = {
      endpoint: 'customer-order-return-create',
      orderId: 'order-1',
      payload: { items: [{ quantity: 1, orderItemId: 'line-1' }] },
    };
    const sameWithDifferentKeyOrder = {
      payload: { items: [{ orderItemId: 'line-1', quantity: 1 }] },
      orderId: 'order-1',
      endpoint: 'customer-order-return-create',
    };
    const changed = {
      ...first,
      payload: { items: [{ quantity: 2, orderItemId: 'line-1' }] },
    };

    const firstKey = tracker.keyFor(first);
    expect(tracker.keyFor(sameWithDifferentKeyOrder)).toBe(firstKey);

    const changedKey = tracker.keyFor(changed);
    expect(changedKey).not.toBe(firstKey);
    expect(tracker.complete(first, firstKey)).toBe(false);
    expect(tracker.keyFor(changed)).toBe(changedKey);
    expect(tracker.complete(changed, changedKey)).toBe(true);
    expect(tracker.keyFor(changed)).not.toBe(changedKey);
  });

  it('falla cerrado cuando el navegador no ofrece aleatoriedad criptográfica', () => {
    expect(() => createRmaIdempotencyKey({})).toThrow(
      'RMA_SECURE_RANDOM_UNAVAILABLE'
    );
  });
});
