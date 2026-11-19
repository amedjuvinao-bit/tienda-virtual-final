import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  assertSelectionCurrent,
  readSelectionRetention,
  recordSelectionActivity,
  selectionRetentionKey,
  watchSelectionRetention,
} from './selectionRetention';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-11-19T03:00:00Z');
const watchers = [];
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => {
  watchers.splice(0).forEach((stop) => stop());
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('fecha una selección anterior y las lecturas conservan su vencimiento', () => {
  localStorage.setItem('cart', JSON.stringify([{ _id: 'p1' }]));
  const initial = readSelectionRetention('cart');
  vi.setSystemTime(now + 29 * DAY_MS);
  expect(readSelectionRetention('cart').expiresAt).toBe(initial.expiresAt);
  expect(localStorage.getItem('cart')).toContain('p1');
  vi.setSystemTime(initial.expiresAt);
  expect(readSelectionRetention('cart').expired).toBe(true);
  expect(localStorage.getItem('cart')).toBeNull();
});
it('vence copias y accesos propios conservando las preferencias y otros procesos', () => {
  recordSelectionActivity('favorites');
  for (const key of ['favorites', 'favorite_snapshot', 'favorite_access', 'favorite_session_id', 'favorite_access_token'])
    localStorage.setItem(key, 'contenido anterior');
  sessionStorage.setItem('favorite_pending', 'operación pendiente');
  localStorage.setItem('rb_privacy_preferences_v1', 'preferencia');
  sessionStorage.setItem('order_payment_access_v1', 'pago');
  vi.setSystemTime(now + 30 * DAY_MS);
  readSelectionRetention('favorites');
  expect(localStorage.getItem('favorite_access')).toBeNull();
  expect(localStorage.getItem('favorites')).toBeNull();
  expect(sessionStorage.getItem('favorite_pending')).toBeNull();
  expect(localStorage.getItem('rb_privacy_preferences_v1')).toBe('preferencia');
  expect(sessionStorage.getItem('order_payment_access_v1')).toBe('pago');
});
it('una acción renueva solo la selección que el cliente modificó', () => {
  recordSelectionActivity('cart');
  recordSelectionActivity('favorites');
  vi.setSystemTime(now + 29 * DAY_MS);
  recordSelectionActivity('cart');
  vi.setSystemTime(now + 30 * DAY_MS);
  expect(readSelectionRetention('cart').expired).toBe(false);
  expect(readSelectionRetention('favorites').expired).toBe(true);
});
it('una pestaña anterior descarta su acceso sin retirar la selección nueva', () => {
  const generation = recordSelectionActivity('cart');
  const values = new Map([
    ['cart_access', JSON.stringify({ sessionId: 'anterior', token: 'token' })],
    [selectionRetentionKey('cart'), JSON.stringify({ version: 1, generation, lastActivityAt: now })],
  ]);
  const other = {
    localStorage,
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };
  vi.setSystemTime(now + 30 * DAY_MS);
  recordSelectionActivity('cart');
  localStorage.setItem('cart', 'selección nueva');
  readSelectionRetention('cart', other);
  expect(values.has('cart_access')).toBe(false);
  expect(localStorage.getItem('cart')).toBe('selección nueva');
  expect(() => assertSelectionCurrent('cart', generation)).toThrow();
});
it('el observador vence una pestaña abierta a los 30 días', () => {
  recordSelectionActivity('cart');
  localStorage.setItem('cart', 'selección');
  const expired = vi.fn();
  const stop = watchSelectionRetention('cart', expired);
  watchers.push(stop);
  vi.advanceTimersByTime(30 * DAY_MS);
  expect(expired).toHaveBeenCalledOnce();
  expect(localStorage.getItem('cart')).toBeNull();
  stop();
});
it('detener el observador cancela su temporizador y sus eventos', () => {
  recordSelectionActivity('cart');
  localStorage.setItem('cart', 'selección');
  const expired = vi.fn();
  const stop = watchSelectionRetention('cart', expired);
  watchers.push(stop);
  stop();

  // jsdom also schedules storage-event timers. Verify this observer's behavior
  // without treating every timer in the test environment as its own.
  vi.advanceTimersByTime(30 * DAY_MS);
  window.dispatchEvent(new Event('focus'));
  window.dispatchEvent(new Event('online'));
  window.dispatchEvent(new StorageEvent('storage', {
    key: selectionRetentionKey('cart'),
  }));
  window.dispatchEvent(new Event('storefront-selection-activity-cart'));

  expect(expired).not.toHaveBeenCalled();
  expect(localStorage.getItem('cart')).toBe('selección');
});
it('el almacenamiento bloqueado conserva el plazo durante la visita', () => {
  const blocked = {
    get localStorage() { throw new Error('bloqueado'); },
    get sessionStorage() { throw new Error('bloqueado'); },
  };
  recordSelectionActivity('favorites', blocked);
  expect(readSelectionRetention('favorites', blocked).expired).toBe(false);
  vi.setSystemTime(now + 30 * DAY_MS);
  expect(readSelectionRetention('favorites', blocked).expired).toBe(true);
});
it('los metadatos dañados retiran la selección y una fecha futura recibe un plazo acotado', () => {
  localStorage.setItem('cart', 'selección');
  localStorage.setItem(selectionRetentionKey('cart'), '{"version":1}');
  expect(readSelectionRetention('cart').expired).toBe(true);
  expect(localStorage.getItem('cart')).toBeNull();
  localStorage.setItem(selectionRetentionKey('favorites'), JSON.stringify({
    version: 1, generation: now, lastActivityAt: now + 100 * DAY_MS,
  }));
  expect(readSelectionRetention('favorites').expiresAt).toBe(now + 30 * DAY_MS);
});

it('una copia ya leída conserva su fecha si el navegador bloquea después el almacenamiento', () => {
  const local = localStorage;
  const session = sessionStorage;
  let blocked = false;
  const view = {
    get localStorage() { if (blocked) throw new Error('bloqueado'); return local; },
    get sessionStorage() { if (blocked) throw new Error('bloqueado'); return session; },
  };
  local.setItem(selectionRetentionKey('cart'), JSON.stringify({
    version: 1, generation: now, lastActivityAt: now,
  }));
  local.setItem('cart', 'selección');
  const initial = readSelectionRetention('cart', view);
  blocked = true;
  expect(readSelectionRetention('cart', view).generation).toBe(initial.generation);
  expect(readSelectionRetention('cart', view).expiresAt).toBe(initial.expiresAt);
});
