import { describe, expect, it, vi } from 'vitest';

import {
  applyCartOperation,
  cartItemIdentity,
  createCartMutationCoordinator,
  writeVersionedCart,
} from './cartMutationConcurrency';

const PRODUCT_A = '68a4a78a59706e44cade0316';
const PRODUCT_B = '68a4a78a59706e44cade0317';
const PRODUCT_C = '68a4a78a59706e44cade0318';

function item(productId, quantity = 1, variantKey = 'default__default') {
  return {
    _id: productId,
    productId,
    quantity,
    qty: quantity,
    variantId: variantKey,
    variantKey,
    size: variantKey === '4__royalblue' ? '4' : '',
    color: variantKey === '4__royalblue' ? 'royalblue' : '',
  };
}

function conflict(state) {
  const error = new Error('conflict');
  error.response = {
    status: 409,
    data: {
      error: 'CART_WRITE_CONFLICT',
      version: state.version,
      cart: { items: state.items, version: state.version },
    },
  };
  return error;
}

function createMemoryBackend(initialItems = []) {
  const state = { items: initialItems.map((entry) => ({ ...entry })), version: 'v1' };
  let revision = 1;
  const calls = { writes: 0, reloads: 0, active: 0, maxActive: 0 };

  return {
    state,
    calls,
    async write({ items, version }) {
      calls.writes += 1;
      calls.active += 1;
      calls.maxActive = Math.max(calls.maxActive, calls.active);
      await Promise.resolve();
      try {
        if (version !== state.version) throw conflict(state);
        state.items = items.map((entry) => ({ ...entry }));
        revision += 1;
        state.version = `v${revision}`;
        return { items: state.items, version: state.version };
      } finally {
        calls.active -= 1;
      }
    },
    async reload() {
      calls.reloads += 1;
      return { items: state.items, version: state.version };
    },
  };
}

function createTab(backend, initialItems, initialVersion) {
  let snapshot = {
    items: initialItems.map((entry) => ({ ...entry })),
    version: initialVersion,
  };
  const coordinator = createCartMutationCoordinator({
    getSnapshot: async () => snapshot,
    write: (request) => backend.write(request),
    reload: () => backend.reload(),
    adopt: (next) => { snapshot = next; },
  });
  return { coordinator, getSnapshot: () => snapshot };
}

describe('concurrencia del carrito', () => {
  it('dos pestanas conservan los productos agregados por ambas', async () => {
    const backend = createMemoryBackend([]);
    const tabA = createTab(backend, [], 'v1');
    const tabB = createTab(backend, [], 'v1');

    await tabA.coordinator.enqueue({ type: 'add', item: item(PRODUCT_A) });
    const resultB = await tabB.coordinator.enqueue({ type: 'add', item: item(PRODUCT_B) });

    expect(resultB.retried).toBe(true);
    expect(backend.calls.reloads).toBe(1);
    expect(backend.state.items.map((entry) => entry.productId)).toEqual([
      PRODUCT_A,
      PRODUCT_B,
    ]);
  });

  it('dos aumentos concurrentes acumulan la cantidad correcta', async () => {
    const initial = [item(PRODUCT_A, 1, '4__royalblue')];
    const backend = createMemoryBackend(initial);
    const tabA = createTab(backend, initial, 'v1');
    const tabB = createTab(backend, initial, 'v1');
    const identity = cartItemIdentity(initial[0]);

    await tabA.coordinator.enqueue({ type: 'increase', identity });
    await tabB.coordinator.enqueue({ type: 'increase', identity });

    expect(backend.state.items[0].quantity).toBe(3);
    expect(backend.state.items[0].variantKey).toBe('4__royalblue');
  });

  it('eliminar un producto no restaura una copia antigua ni elimina una adicion ajena', async () => {
    const initial = [item(PRODUCT_A), item(PRODUCT_B)];
    const backend = createMemoryBackend(initial);
    const staleTab = createTab(backend, initial, 'v1');

    backend.state.items = [...backend.state.items, item(PRODUCT_C)];
    backend.state.version = 'v2';

    await staleTab.coordinator.enqueue({
      type: 'remove',
      identity: cartItemIdentity(initial[0]),
    });

    expect(backend.state.items.map((entry) => entry.productId)).toEqual([
      PRODUCT_B,
      PRODUCT_C,
    ]);
  });

  it('vaciar solo elimina los productos conocidos al iniciar la operacion', () => {
    const known = [item(PRODUCT_A), item(PRODUCT_B)];
    const withConcurrentAddition = [...known, item(PRODUCT_C)];
    const result = applyCartOperation(withConcurrentAddition, {
      type: 'clear',
      targetIdentities: known.map(cartItemIdentity),
    });
    expect(result.map((entry) => entry.productId)).toEqual([PRODUCT_C]);
  });

  it('serializa las mutaciones iniciadas en una misma pestana', async () => {
    const initial = [item(PRODUCT_A, 1)];
    const backend = createMemoryBackend(initial);
    const tab = createTab(backend, initial, 'v1');
    const identity = cartItemIdentity(initial[0]);

    await Promise.all([
      tab.coordinator.enqueue({ type: 'increase', identity }),
      tab.coordinator.enqueue({ type: 'increase', identity }),
    ]);

    expect(backend.calls.maxActive).toBe(1);
    expect(backend.state.items[0].quantity).toBe(3);
  });

  it('reintenta maximo una vez y conserva el servidor ante el segundo conflicto', async () => {
    const serverState = {
      items: [item(PRODUCT_B, 7, '4__royalblue')],
      version: 'server-v3',
    };
    const writes = vi.fn(async () => { throw conflict(serverState); });
    const reload = vi.fn(async () => serverState);
    let adopted = null;
    const onTerminalConflict = vi.fn();
    const coordinator = createCartMutationCoordinator({
      getSnapshot: async () => ({ items: [item(PRODUCT_A)], version: 'v1' }),
      write: writes,
      reload,
      adopt: (snapshot) => { adopted = snapshot; },
      onTerminalConflict,
    });

    await expect(
      coordinator.enqueue({ type: 'add', item: item(PRODUCT_C) })
    ).rejects.toMatchObject({ code: 'CART_WRITE_CONFLICT' });

    expect(writes).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(onTerminalConflict).toHaveBeenCalledTimes(1);
    expect(adopted).toEqual(serverState);
  });

  it('revierte la vista optimista cuando el servidor rechaza un producto sin stock', async () => {
    const serverState = { items: [item(PRODUCT_A)], version: 'v1' };
    const rejected = new Error('invalid cart items');
    rejected.response = {
      status: 409,
      data: { error: 'CART_ITEMS_INVALID' },
    };
    let adopted = null;
    const onRejected = vi.fn();
    const coordinator = createCartMutationCoordinator({
      getSnapshot: async () => serverState,
      write: async () => { throw rejected; },
      reload: async () => serverState,
      adopt: (snapshot) => { adopted = snapshot; },
      onRejected,
    });

    await expect(
      coordinator.enqueue({ type: 'add', item: item(PRODUCT_B) })
    ).rejects.toBe(rejected);

    expect(adopted).toEqual(serverState);
    expect(onRejected).toHaveBeenCalledWith(
      rejected,
      serverState,
      expect.objectContaining({ type: 'add' }),
      expect.objectContaining({ recovered: false })
    );
  });

  it('permite agregar un producto valido retirando solo un articulo antiguo invalido', async () => {
    const stale = item(PRODUCT_A);
    const available = item(PRODUCT_B);
    const serverState = { items: [stale], version: 'v1' };
    const rejected = new Error('invalid cart items');
    rejected.response = {
      status: 409,
      data: {
        error: 'CART_ITEMS_INVALID',
        items: [{ ...stale, productId: PRODUCT_A, invalidReason: 'OUT_OF_STOCK' }],
      },
    };
    const write = vi.fn()
      .mockRejectedValueOnce(rejected)
      .mockResolvedValueOnce({ items: [available], version: 'v2' });
    let adopted = null;
    const onRejected = vi.fn();
    const coordinator = createCartMutationCoordinator({
      getSnapshot: async () => serverState,
      write,
      reload: async () => serverState,
      adopt: (snapshot) => { adopted = snapshot; },
      onRejected,
    });

    await expect(
      coordinator.enqueue({ type: 'add', item: available })
    ).resolves.toMatchObject({ recoveredInvalidItems: true });

    expect(write).toHaveBeenCalledTimes(2);
    expect(adopted.items).toEqual([available]);
    expect(onRejected).toHaveBeenCalledWith(
      rejected,
      expect.objectContaining({ items: [] }),
      expect.objectContaining({ type: 'add' }),
      expect.objectContaining({ recovered: true, targetRejected: false })
    );
  });

  it('descarta de forma controlada un carrito que ya no existe en el servidor', async () => {
    const missing = new Error('missing cart');
    missing.response = {
      status: 404,
      data: { error: 'CART_ACCESS_NOT_FOUND' },
    };
    const onMissingCart = vi.fn().mockResolvedValue({
      items: [],
      version: '',
      recoveredMissingCart: true,
    });
    const write = vi.fn();
    const coordinator = createCartMutationCoordinator({
      getSnapshot: async () => { throw missing; },
      write,
      reload: vi.fn(),
      adopt: vi.fn(),
      onMissingCart,
    });
    const operation = { type: 'remove', identity: cartItemIdentity(item(PRODUCT_A)) };

    await expect(coordinator.enqueue(operation)).resolves.toMatchObject({
      recoveredMissingCart: true,
    });
    expect(onMissingCart).toHaveBeenCalledWith(operation, missing);
    expect(write).not.toHaveBeenCalled();
  });

  it('envia realmente If-Match-Updated-At junto con las credenciales', async () => {
    const api = { put: vi.fn().mockResolvedValue({ data: { version: 'v2' } }) };
    const access = {
      sessionId: 'cart_authorized_session_12345678901234567890',
      token: `ct1_${'a'.repeat(43)}`,
    };
    await writeVersionedCart({
      api,
      access,
      version: '2030-01-01T00:00:00.001Z',
      items: [item(PRODUCT_A)],
    });
    expect(api.put).toHaveBeenCalledWith(
      `/api/cart/${encodeURIComponent(access.sessionId)}`,
      { items: [item(PRODUCT_A)] },
      {
        headers: {
          'X-Session-Id': access.sessionId,
          'X-Cart-Access-Token': access.token,
          'If-Match-Updated-At': '2030-01-01T00:00:00.001Z',
        },
      }
    );
  });
});
