import { describe, expect, it } from 'vitest';
import { buildSafeCheckoutPageConfig } from './checkoutPageModel';
import {
  buildOrderDraft,
  buildValidatedOrderItems,
  formatCartAdjustments,
  validateCheckoutState,
} from './checkoutSubmissionModel';

function validFixture() {
  const resolvedDianCustomer = {
    personType: 'natural',
    documentType: 'CC',
    documentNumber: '1010123456',
    firstName: 'Cliente',
    lastName: 'Prueba',
    email: 'cliente@example.com',
    phone: '3001234567',
    address: 'Calle 1',
    extra: '',
    city: 'Bogotá',
    cityCode: '11001',
    municipalityCode: '11001',
    department: 'Bogotá D.C.',
    departmentCode: '11',
    postalCode: '110111',
    country: 'CO',
    countryName: 'Colombia',
    tributeCode: 'ZZ',
  };
  const state = {
    checkoutConfig: {
      ...buildSafeCheckoutPageConfig({}),
      showBillingSection: false,
    },
    customerAddress: 'Calle 1',
    customerCity: 'Bogotá',
    customerCityCode: '11001',
    customerCountry: 'Colombia',
    customerEmailOrPhone: 'cliente@example.com',
    customerId: '1010123456',
    customerLastname: 'Prueba',
    customerName: 'Cliente',
    customerPhone: '3001234567',
    customerPostalCode: '110111',
    deliveryType: 'envio',
    selectedRegion: '11',
    quoteLoading: false,
    sameAddress: true,
    wantsNewsletter: false,
    appliedCoupon: { code: 'PLUS10' },
    paymentsConfig: {
      active: true,
      provider: 'payu',
      mode: 'production',
      currency: 'COP',
      checkoutLabel: 'PayU',
      enableWebhook: true,
    },
    storeCreditPreview: { accessToken: 'store-credit-access' },
  };
  const derived = {
    cartNeedsElectronicDelivery: false,
    cartRequiresShipping: true,
    currentCart: [{ _id: 'product-1', quantity: 1 }],
    itemCount: 1,
    paymentCanProceed: true,
    quotePricing: { total: 80000 },
    resolvedDianCustomer,
    selectedCountry: { code: 'CO', name: 'Colombia' },
    subtotal: 100000,
    shipping: 10000,
    total: 80000,
    appliedStoreCreditAmount: 30000,
    paymentProviderMeta: { label: 'PayU' },
  };
  return { state, derived };
}

describe('estados críticos de Checkout', () => {
  it('acepta un estado completo y bloquea cotización pendiente o ausente', () => {
    const { state, derived } = validFixture();
    expect(validateCheckoutState({ state, derived })).toEqual([]);

    expect(
      validateCheckoutState({
        state: { ...state, quoteLoading: true },
        derived: { ...derived, quotePricing: null },
      })
    ).toContain('Espera mientras verificamos IVA, descuentos y total.');

    expect(
      validateCheckoutState({
        state,
        derived: { ...derived, quotePricing: null },
      })
    ).toContain('No fue posible verificar el total final con el servidor.');
  });

  it('exige dirección para envío físico y correo válido para entrega electrónica', () => {
    const { state, derived } = validFixture();
    const errors = validateCheckoutState({
      state: { ...state, customerAddress: '', customerCity: '' },
      derived: {
        ...derived,
        cartNeedsElectronicDelivery: true,
        resolvedDianCustomer: { ...derived.resolvedDianCustomer, email: 'no-es-email' },
      },
    });
    expect(errors).toContain('La dirección de envío es obligatoria.');
    expect(errors).toContain('La ciudad es obligatoria.');
    expect(errors).toContain('Los productos digitales y servicios necesitan un correo válido para la entrega.');
  });

  it('construye la orden canónica con cupón, DIAN, PayU y saldo aplicado sin alterar importes', () => {
    const { state, derived } = validFixture();
    state.checkoutConfig.showBillingSection = true;
    const finalItems = buildValidatedOrderItems(
      [{ productId: 'product-1', title: 'Producto', quantity: 2, price: 50000 }],
      []
    );
    const order = buildOrderDraft({
      state,
      derived,
      sessionId: 'session-1',
      finalItems,
      finalSummary: { subtotal: 100000 },
    });

    expect(order.sessionId).toBe('session-1');
    expect(order.cart).toEqual([
      expect.objectContaining({ _id: 'product-1', quantity: 2, price: 50000 }),
    ]);
    expect(order.subtotal).toBe(100000);
    expect(order.total).toBe(80000);
    expect(order.couponCode).toBe('PLUS10');
    expect(order.payment).toMatchObject({
      provider: 'payu',
      currency: 'COP',
      status: 'pending_gateway',
    });
    expect(order.billing).toMatchObject({
      personType: 'natural',
      municipalityCode: '11001',
    });
    expect(order.storeCredit).toEqual({
      apply: true,
      amount: 30000,
      accessToken: 'store-credit-access',
    });
  });

  it('explica ajustes por artículo sin convertir todo el carrito en agotado', () => {
    const messages = formatCartAdjustments(
      [
        { _id: 'a', title: 'Camiseta' },
        { _id: 'b', title: 'Tenis' },
      ],
      [
        { productId: 'a', requestedQty: 2, finalQty: 0 },
        { productId: 'b', requestedQty: 4, finalQty: 2 },
      ]
    );
    expect(messages).toEqual([
      'Sin stock para "Camiseta" (eliminado).',
      'Stock limitado para "Tenis": 4 → 2.',
    ]);
  });
});
