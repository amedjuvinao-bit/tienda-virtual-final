import { afterEach, beforeEach, expect, it } from 'vitest';
import { getCartAccess, storeCartAccess, clearCartAccess } from './cartAccess';
import { getSessionId } from './getSessionId';
import api from '../lib/api';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
it('mantiene juntas las credenciales de la pestaña aunque otra cambie el identificador compartido', async () => {
  storeCartAccess('cart-tab-a', 'token-a');
  localStorage.setItem('session_id', 'cart-tab-b');
  expect(getCartAccess()).toEqual({
    sessionId: 'cart-tab-a',
    token: 'token-a',
  });
  expect(getSessionId()).toBe('cart-tab-a');
  const response = await api.get('/session-probe', {
    adapter: async (config) => ({
      data: config.headers.get('X-Session-Id'),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }),
  });
  expect(response.data).toBe('cart-tab-a');
});
it('migra el acceso anterior una sola vez y conserva el par al recargar', () => {
  localStorage.setItem('session_id', 'legacy-a');
  sessionStorage.setItem('cart_access_token', 'legacy-token');
  expect(getCartAccess()).toEqual({
    sessionId: 'legacy-a',
    token: 'legacy-token',
  });
  localStorage.setItem('session_id', 'other-tab');
  expect(getCartAccess()).toEqual({
    sessionId: 'legacy-a',
    token: 'legacy-token',
  });
  expect(localStorage.getItem('cart_access_token')).toBeNull();
});
it('limpiar el acceso no borra el identificador de otra pestaña', () => {
  storeCartAccess('cart-tab-a', 'token-a');
  localStorage.setItem('session_id', 'cart-tab-b');
  clearCartAccess();
  expect(getCartAccess()).toBeNull();
  expect(localStorage.getItem('session_id')).toBe('cart-tab-b');
});
