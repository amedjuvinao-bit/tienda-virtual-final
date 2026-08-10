import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildOrderPaymentAccessHeaders,
  clearOrderPaymentAccess,
  getOrderPaymentAccess,
  storeOrderPaymentAccess,
} from './orderPaymentAccess';

const access = {
  orderId: '64b64b64b64b64b64b64d001',
  sessionId: `cart_${'a'.repeat(32)}`,
  token: `eyJ2IjoxLCJvaWQiOiJ0ZXN0In0.${'b'.repeat(43)}`,
  expiresAt: '2035-01-01T00:00:00.000Z',
};

describe('acceso publico de pagos por orden', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('guarda la credencial solamente en sessionStorage', () => {
    expect(storeOrderPaymentAccess(access)).toBe(true);
    expect(localStorage.getItem('order_payment_access_v1')).toBeNull();
    expect(getOrderPaymentAccess(access.orderId)).toEqual(access);
  });

  it('no entrega una credencial para otra orden', () => {
    storeOrderPaymentAccess(access);
    expect(getOrderPaymentAccess('64b64b64b64b64b64b64d999')).toBeNull();
  });

  it('descarta credenciales vencidas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2036-01-01T00:00:00.000Z'));
    sessionStorage.setItem('order_payment_access_v1', JSON.stringify(access));
    expect(getOrderPaymentAccess(access.orderId)).toBeNull();
    expect(sessionStorage.getItem('order_payment_access_v1')).toBeNull();
  });

  it('construye encabezados dedicados sin incluir la credencial en URL o cuerpo', () => {
    expect(buildOrderPaymentAccessHeaders(access)).toEqual({
      'X-Session-Id': access.sessionId,
      'X-Order-Access-Token': access.token,
    });
  });

  it('elimina solamente el acceso de la orden solicitada', () => {
    storeOrderPaymentAccess(access);
    clearOrderPaymentAccess('64b64b64b64b64b64b64d999');
    expect(getOrderPaymentAccess(access.orderId)).toEqual(access);
    clearOrderPaymentAccess(access.orderId);
    expect(getOrderPaymentAccess(access.orderId)).toBeNull();
  });
});
