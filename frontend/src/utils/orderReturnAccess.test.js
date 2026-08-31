import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildOrderReturnAccessHeaders,
  clearOrderReturnAccess,
  getOrderReturnAccess,
  storeOrderReturnAccess,
} from './orderReturnAccess';

describe('acceso seguro al autoservicio de devoluciones', () => {
  beforeEach(() => localStorage.clear());

  it('persiste un acceso vigente y construye únicamente su cabecera dedicada', () => {
    const access = {
      orderId: '64c000000000000000000001',
      token: 'signed.return.token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    expect(storeOrderReturnAccess(access)).toBe(true);
    expect(getOrderReturnAccess(access.orderId)).toEqual(access);
    expect(buildOrderReturnAccessHeaders(access)).toEqual({
      'X-Order-Return-Token': access.token,
    });
  });

  it('rechaza accesos vencidos o pertenecientes a otra orden', () => {
    const expired = {
      orderId: '64c000000000000000000001',
      token: 'expired.return.token',
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    };
    expect(storeOrderReturnAccess(expired)).toBe(false);

    const valid = { ...expired, expiresAt: new Date(Date.now() + 60_000).toISOString() };
    storeOrderReturnAccess(valid);
    expect(getOrderReturnAccess('64c000000000000000000002')).toBeNull();
    clearOrderReturnAccess(valid.orderId);
    expect(getOrderReturnAccess(valid.orderId)).toBeNull();
  });
});
