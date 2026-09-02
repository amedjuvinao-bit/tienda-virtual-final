import { describe, expect, it } from 'vitest';
import {
  buildPaymentPayload,
  buildPosCommercialPayload,
  calculateCheckoutSummary,
  validatePosCheckout,
} from './posCheckoutModel';

const discountPermissions = {
  canDiscount: true,
  canApproveDiscount: false,
};

describe('posCheckoutModel', () => {
  it('calcula porcentaje, descuento y total con redondeo COP', () => {
    expect(calculateCheckoutSummary(28500, { type: 'percent', value: 10 })).toEqual({
      subtotal: 28500,
      discount: 2850,
      total: 25650,
    });
  });

  it('calcula el cambio del efectivo sin alterar el valor de la venta', () => {
    expect(buildPaymentPayload({
      method: 'cash',
      total: 28500,
      details: { receivedAmount: 30000 },
    })).toMatchObject({
      method: 'cash',
      amount: 28500,
      receivedAmount: 30000,
      changeAmount: 1500,
    });
  });

  it('rechaza efectivo insuficiente', () => {
    const validation = validatePosCheckout({
      subtotal: 28500,
      paymentMethod: 'cash',
      paymentDetails: { receivedAmount: 20000 },
      permissions: discountPermissions,
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.payment).toMatch(/no cubre/i);
  });

  it('exige referencia verificable para tarjeta y transferencia', () => {
    const card = validatePosCheckout({
      subtotal: 28500,
      paymentMethod: 'card',
      paymentDetails: { reference: '' },
      permissions: discountPermissions,
    });
    const transfer = validatePosCheckout({
      subtotal: 28500,
      paymentMethod: 'transfer',
      paymentDetails: { reference: 'TRX-100' },
      permissions: discountPermissions,
    });

    expect(card.errors.payment).toMatch(/autorización/i);
    expect(transfer.valid).toBe(true);
  });

  it('valida que un pago mixto quede distribuido exactamente', () => {
    const validation = validatePosCheckout({
      subtotal: 110000,
      paymentMethod: 'mixed',
      paymentDetails: {
        splitPayments: [
          { id: 'cash', method: 'cash', amount: 60000, receivedAmount: 70000 },
          { id: 'transfer', method: 'transfer', amount: 50000, reference: 'TRX-200' },
        ],
      },
      permissions: discountPermissions,
    });

    expect(validation.valid).toBe(true);
    expect(validation.payment.amount).toBe(110000);
    expect(validation.payment.splitPayments[0].changeAmount).toBe(10000);
  });

  it('impide descuentos sin permiso, sin motivo o por encima del límite', () => {
    const withoutPermission = validatePosCheckout({
      subtotal: 100000,
      discount: { type: 'percent', value: 10, reason: 'Promoción' },
      paymentMethod: 'cash',
      paymentDetails: { receivedAmount: 90000 },
      permissions: { canDiscount: false, canApproveDiscount: false },
    });
    const withoutReason = validatePosCheckout({
      subtotal: 100000,
      discount: { type: 'percent', value: 10, reason: '' },
      paymentMethod: 'cash',
      paymentDetails: { receivedAmount: 90000 },
      permissions: discountPermissions,
    });
    const requiresApproval = validatePosCheckout({
      subtotal: 100000,
      discount: { type: 'percent', value: 25, reason: 'Caso autorizado' },
      paymentMethod: 'cash',
      paymentDetails: { receivedAmount: 75000 },
      permissions: discountPermissions,
    });

    expect(withoutPermission.errors.discount).toMatch(/permiso/i);
    expect(withoutReason.errors.discount).toMatch(/motivo/i);
    expect(requiresApproval.errors.discount).toMatch(/autorización/i);
  });

  it('construye una sola carga comercial para previsualizar y confirmar', () => {
    const payload = buildPosCommercialPayload({
      branchId: 'branch-1',
      cartItems: [{
        productId: 'product-1',
        quantity: 2,
        variantKey: '250__media',
        variantLabel: '250 g / Media',
        variantAttributes: [{ name: 'Peso', value: '250 g' }],
      }],
      paymentMethod: 'card',
      paymentDetails: { reference: 'AUTH-400', terminalId: 'DATAFONO-01' },
      discount: { type: 'amount', value: 5000, reason: 'Fidelización' },
      total: 52000,
    });

    expect(payload.terminalId).toBe('DATAFONO-01');
    expect(payload.payment).toMatchObject({ method: 'card', amount: 52000, reference: 'AUTH-400' });
    expect(payload.discount).toEqual({ type: 'amount', value: 5000, reason: 'Fidelización' });
    expect(payload.items[0].variantAttributes).toHaveLength(1);
  });
});
