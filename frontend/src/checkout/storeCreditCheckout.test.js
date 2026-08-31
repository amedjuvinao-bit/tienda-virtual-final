import { describe, expect, it } from 'vitest';

import {
  buildStoreCreditOrderPayload,
  calculateStoreCreditApplication,
} from './storeCreditCheckout';

describe('saldo a favor en Checkout', () => {
  it('aplica solo el valor solicitado y calcula el remanente', () => {
    expect(
      calculateStoreCreditApplication({
        enabled: true,
        eligible: true,
        balance: 80000,
        requestedAmount: 60000,
        orderTotal: 100000,
      })
    ).toEqual({ appliedAmount: 60000, amountDue: 40000 });
  });

  it('nunca aplica más que el saldo disponible', () => {
    expect(
      calculateStoreCreditApplication({
        enabled: true,
        eligible: true,
        balance: 30000,
        requestedAmount: 90000,
        orderTotal: 100000,
      })
    ).toEqual({ appliedAmount: 30000, amountDue: 70000 });
  });

  it('un saldo superior al total evita abrir la pasarela', () => {
    expect(
      calculateStoreCreditApplication({
        enabled: true,
        eligible: true,
        balance: 150000,
        requestedAmount: 150000,
        orderTotal: 100000,
      })
    ).toEqual({ appliedAmount: 100000, amountDue: 0 });
  });

  it('solo envía el token cuando realmente se aplica saldo', () => {
    expect(
      buildStoreCreditOrderPayload({ amount: 40000, accessToken: 'sc1_token.firma' })
    ).toEqual({ apply: true, amount: 40000, accessToken: 'sc1_token.firma' });
    expect(buildStoreCreditOrderPayload({ amount: 0, accessToken: 'sc1_token.firma' })).toEqual({
      apply: false,
    });
  });
});
