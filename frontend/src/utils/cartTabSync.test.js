import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCartTabSync } from './cartTabSync';
const bridges = [];
class Channel {
  static peers = new Set();
  constructor() {
    this.listeners = new Set();
    Channel.peers.add(this);
  }
  addEventListener(_event, listener) {
    this.listeners.add(listener);
  }
  removeEventListener(_event, listener) {
    this.listeners.delete(listener);
  }
  postMessage(data) {
    for (const peer of Channel.peers)
      if (peer !== this)
        queueMicrotask(() => {
          for (const listener of peer.listeners)
            listener({ data: structuredClone(data) });
        });
  }
  close() {
    Channel.peers.delete(this);
  }
}
const bridge = (options) => {
  const value = createCartTabSync({ ...options, waitMs: 5 });
  bridges.push(value);
  return value;
};
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('BroadcastChannel', Channel);
});
afterEach(() => {
  bridges.splice(0).forEach((value) => value.close());
  vi.unstubAllGlobals();
  localStorage.clear();
});
it('entrega el mismo par de acceso a una pestaña nueva sin persistir la credencial', async () => {
  const access = { sessionId: 'cart-a', token: 'secret-a' };
  localStorage.setItem('session_id', 'cart-a');
  bridge({ getAccess: () => access, onChange: vi.fn() });
  const second = bridge({ getAccess: () => null, onChange: vi.fn() });
  expect(await second.resolve()).toEqual(access);
  expect(JSON.stringify({ ...localStorage })).not.toContain('secret-a');
});
it('notifica cambios a las otras pestañas y distribuye una credencial rotada completa', async () => {
  let own = { sessionId: 'cart-a', token: 'old' };
  localStorage.setItem('session_id', 'cart-a');
  const onChange = vi.fn();
  const first = bridge({ getAccess: () => own, onChange });
  const second = bridge({ getAccess: () => own, onChange: vi.fn() });
  await Promise.resolve();
  onChange.mockClear();
  second.publishChange();
  await Promise.resolve();
  expect(onChange).toHaveBeenCalledOnce();
  own = { ...own, token: 'rotated' };
  second.publishAccess();
  await Promise.resolve();
  expect(await first.resolve()).toEqual(own);
});
it('no sustituye un acceso propio por un identificador sin credencial y libera solicitudes al cerrar', async () => {
  localStorage.setItem('cart_shared_session', 'another');
  const value = bridge({
    getAccess: () => ({ sessionId: 'own', token: 'safe' }),
    onChange: vi.fn(),
  });
  expect(await value.resolve()).toBeNull();
  const pending = value.resolve();
  value.close();
  expect(await pending).toBeNull();
});
it('mantiene operativo el carrito si el navegador bloquea el canal entre pestañas', async () => {
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      constructor() {
        throw new Error('Blocked');
      }
    }
  );
  const value = bridge({ getAccess: () => null, onChange: vi.fn() });
  expect(await value.resolve()).toBeNull();
  expect(() => value.publishChange()).not.toThrow();
});
