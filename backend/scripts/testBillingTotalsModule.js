/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

const {
  calculateOrderPricing,
} = require('../services/orderPricingService');
const couponService = require('../services/couponService');
const {
  buildFactusInvoicePayload,
} = require('../lib/dian/providers/factusProvider');
const {
  assertTotalsReconciled,
  calculateTotals,
} = require('../services/electronicInvoiceIssuanceService');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const results = { ok: 0, warn: 0, fail: 0 };

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function fail(message, error = null) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertMoney(actual, expected, message) {
  assert(
    Math.abs(Number(actual) - Number(expected)) <= 0.01,
    `${message} Esperado: ${expected}; recibido: ${actual}.`
  );
}

function readProjectFile(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  assert(fs.existsSync(fullPath), `No existe el archivo ${relativePath}.`);
  return fs.readFileSync(fullPath, 'utf8');
}

function baseItem(price = 100000, quantity = 1) {
  return {
    productId: '64b000000000000000000001',
    title: 'Producto gravado',
    price,
    quantity,
    category: 'general',
    categories: ['general'],
  };
}

function percentageCouponValidation(discountAmount = 10000) {
  return {
    valid: true,
    coupon: {
      _id: '64b000000000000000000099',
      code: 'IVA10',
      type: 'percentage',
      value: 10,
      appliesTo: 'all',
    },
    discount: {
      eligibleSubtotal: 100000,
      discountAmount,
      shippingDiscountAmount: 0,
      totalDiscountAmount: discountAmount,
    },
  };
}

function validateTaxWithoutCoupon() {
  const pricing = calculateOrderPricing({
    items: [baseItem()],
    originalShipping: 10000,
    taxConfig: { enabled: true, percent: 19, code: '01', name: 'IVA' },
  });

  assertMoney(pricing.subtotal, 100000, 'El subtotal no coincide.');
  assertMoney(pricing.productDiscount, 0, 'No debe existir descuento.');
  assertMoney(pricing.tax.taxableBase, 100000, 'La base gravable no coincide.');
  assertMoney(pricing.tax.amount, 19000, 'El IVA no coincide.');
  assertMoney(pricing.shipping, 10000, 'El envío no coincide.');
  assertMoney(pricing.total, 129000, 'El total sin cupón no concilia.');
  ok('IVA y envío concilian exactamente cuando no existe cupón');
}

function validateDiscountBeforeTax() {
  const pricing = calculateOrderPricing({
    items: [baseItem()],
    originalShipping: 10000,
    taxConfig: { enabled: true, percent: 19, code: '01', name: 'IVA' },
    couponValidation: percentageCouponValidation(),
  });

  assertMoney(pricing.productDiscount, 10000, 'El descuento del producto no coincide.');
  assertMoney(pricing.subtotalAfterDiscount, 90000, 'El subtotal neto no coincide.');
  assertMoney(pricing.tax.taxableBase, 90000, 'El cupón no redujo la base gravable.');
  assertMoney(pricing.tax.amount, 17100, 'El IVA debe calcularse después del descuento.');
  assertMoney(pricing.total, 117100, 'El total con cupón no concilia.');
  ok('El descuento comercial reduce la base antes de calcular el IVA');
}

function validateFreeShippingCoupon() {
  const pricing = calculateOrderPricing({
    items: [baseItem()],
    originalShipping: 10000,
    taxConfig: { enabled: true, percent: 19 },
    couponValidation: {
      valid: true,
      coupon: { code: 'ENVIO0', type: 'free_shipping', appliesTo: 'all' },
      discount: {
        eligibleSubtotal: 100000,
        discountAmount: 0,
        shippingDiscountAmount: 10000,
        totalDiscountAmount: 10000,
      },
    },
  });

  assertMoney(pricing.originalShipping, 10000, 'Debe conservarse el envío original.');
  assertMoney(pricing.shippingDiscount, 10000, 'El descuento de envío no coincide.');
  assertMoney(pricing.shipping, 0, 'El envío final debe ser gratuito.');
  assertMoney(pricing.tax.amount, 19000, 'El envío excluido no debe alterar el IVA.');
  assertMoney(pricing.total, 119000, 'El total con envío gratis no concilia.');
  ok('El cupón de envío gratis se separa del descuento de productos y del IVA');
}

function validateCentAllocation() {
  const coupon = { code: 'FIJO', type: 'fixed', value: 12345.67, appliesTo: 'all' };
  const sourceItems = [
    baseItem(33333.33),
    { ...baseItem(66666.67), productId: '64b000000000000000000002' },
  ];
  const discount = couponService.calculateDiscount(coupon, {
    subtotal: 100000,
    shippingAmount: 0,
    items: sourceItems,
  });
  const pricing = calculateOrderPricing({
    items: sourceItems,
    originalShipping: 0,
    taxConfig: { enabled: true, percent: 19 },
    couponValidation: {
      valid: true,
      coupon,
      discount,
    },
  });

  const allocated = pricing.items.reduce((sum, item) => sum + item.discountAmount, 0);
  const lineTaxes = pricing.items.reduce((sum, item) => sum + item.taxAmount, 0);
  assertMoney(discount.discountAmount, 12345.67, 'El servicio de cupones redondeó a pesos enteros.');
  assertMoney(allocated, 12345.67, 'La asignación por líneas perdió centavos.');
  assertMoney(pricing.subtotalAfterDiscount, 87654.33, 'La base neta no conserva centavos.');
  assertMoney(lineTaxes, pricing.tax.amount, 'El IVA de líneas no coincide con el IVA total.');
  assertMoney(pricing.total, pricing.subtotalAfterDiscount + pricing.tax.amount, 'Las líneas no concilian.');
  ok('Los descuentos fijos se distribuyen por línea sin perder centavos');
}

function validateFactusPayload() {
  const pricing = calculateOrderPricing({
    items: [baseItem()],
    originalShipping: 10000,
    taxConfig: { enabled: true, percent: 19 },
    couponValidation: percentageCouponValidation(),
  });
  const order = {
    _id: '64b000000000000000000010',
    orderNumber: 'ORD-IVA-10',
    items: pricing.items,
    subtotal: pricing.subtotal,
    shipping: pricing.shipping,
    total: pricing.total,
    discount: { amount: pricing.productDiscount },
    pricing: {
      version: pricing.version,
      productDiscount: pricing.productDiscount,
      subtotalAfterDiscount: pricing.subtotalAfterDiscount,
      shipping: pricing.shipping,
      taxAmount: pricing.tax.amount,
      total: pricing.total,
    },
    taxes: { iva: { enabled: true, percent: 19, amount: pricing.tax.amount } },
    customer: { name: 'Cliente', email: 'cliente@example.com' },
  };
  const payload = buildFactusInvoicePayload({ order });

  assertMoney(payload.items[0].price, 100000, 'Factus no recibió el precio original.');
  assertMoney(payload.items[0].discount_amount, 10000, 'Factus no recibió el descuento de línea.');
  assert(
    JSON.stringify(payload.items[0].taxes) === JSON.stringify([{ code: '01', rate: '19.00' }]),
    'El IVA gravado debe viajar únicamente en taxes con código y tarifa.'
  );
  ['tax_rate', 'unit_measure_id', 'standard_code_id', 'is_excluded', 'tribute_id'].forEach((field) => {
    assert(
      !Object.prototype.hasOwnProperty.call(payload.items[0], field),
      `El payload Factus V2 no debe conservar el campo heredado ${field}.`
    );
  });
  assert(
    !Object.prototype.hasOwnProperty.call(payload.items[0], 'discount_rate'),
    'Factus no debe recibir simultáneamente discount_rate y discount_amount.'
  );
  assertMoney(payload.totals.discount, 10000, 'Factus no recibió el descuento total.');
  assertMoney(payload.totals.taxable_base, 90000, 'La base Factus no coincide.');
  assertMoney(payload.totals.iva, 17100, 'El IVA Factus no coincide.');
  assertMoney(payload.totals.total, 117100, 'El total Factus no coincide.');
  assert(payload.payment_details[0].amount === '117100.00', 'El pago Factus no usa el total exacto.');
  ok('Factus recibe precio, descuento, base, IVA y pago conciliados');
}

function validateFactusExcludedPayload() {
  const payload = buildFactusInvoicePayload({
    order: {
      _id: '64b000000000000000000011',
      orderNumber: 'ORD-EXCLUIDA-01',
      items: [baseItem(100000)],
      subtotal: 100000,
      shipping: 10000,
      total: 110000,
      taxes: { iva: { enabled: false, percent: 0, amount: 0 } },
      customer: { name: 'Cliente', email: 'cliente@example.com' },
    },
  });

  assert(payload.items.length === 2, 'La prueba excluida debe conservar producto y envío.');
  payload.items.forEach((item) => {
    assert(
      JSON.stringify(item.taxes) === JSON.stringify([{ is_excluded: true }]),
      'Un concepto excluido debe declarar is_excluded dentro de taxes y no IVA al 0 %.'
    );
    assert(
      !Object.prototype.hasOwnProperty.call(item, 'is_excluded') &&
        !Object.prototype.hasOwnProperty.call(item, 'tax_rate'),
      'Un concepto excluido no debe mezclar los campos fiscales heredados con Factus V2.'
    );
  });

  ok('Factus V2 recibe productos y envío excluidos con la estructura fiscal oficial');
}

function validateInvoiceReconciliationGuard() {
  const order = {
    subtotal: 100000,
    shipping: 10000,
    total: 117100,
    pricing: {
      version: 2,
      currency: 'COP',
      subtotal: 100000,
      productDiscount: 10000,
      subtotalAfterDiscount: 90000,
      originalShipping: 10000,
      shippingDiscount: 0,
      shipping: 10000,
      totalDiscount: 10000,
      taxableBase: 90000,
      taxAmount: 17100,
      total: 117100,
    },
    taxes: { iva: { enabled: true, percent: 19, taxableBase: 90000, amount: 17100 } },
    payment: { currency: 'COP', amount: 117100 },
  };
  const totals = calculateTotals(order);

  assertMoney(totals.total, 117100, 'La factura no reutilizó el total de la orden.');
  assertMoney(totals.taxAmount, 17100, 'La factura no reutilizó el IVA de la orden.');
  assertTotalsReconciled(order, totals);

  let mismatch = null;
  try {
    assertTotalsReconciled(
      { ...order, payment: { ...order.payment, amount: 117000 } },
      totals
    );
  } catch (error) {
    mismatch = error;
  }
  assert(mismatch?.code === 'BILLING_PAYMENT_TOTAL_MISMATCH', 'No se bloqueó un pago diferente.');

  let snapshotMismatch = null;
  try {
    assertTotalsReconciled(
      { ...order, pricing: { ...order.pricing, taxAmount: 17000 } },
      totals
    );
  } catch (error) {
    snapshotMismatch = error;
  }
  assert(
    snapshotMismatch?.code === 'BILLING_PRICING_SNAPSHOT_MISMATCH',
    'No se bloqueó una fotografía económica alterada.'
  );
  ok('La emisión se bloquea si orden, pago y factura no tienen el mismo total');
}

function validateAtomicCheckoutAndGatewayGuards() {
  const orders = readProjectFile('backend/routes/orders.js');
  const payments = readProjectFile('backend/routes/payments.js');
  const checkout = readProjectFile('frontend/src/pages/CheckoutPage.jsx');
  const main = readProjectFile('frontend/src/main.jsx');

  [
    'buildOrderQuote',
    'recordCouponRedemption',
    'amountInCents: Math.round(pricing.total * 100)',
    'coupon_applied',
  ].forEach((needle) => assert(orders.includes(needle), `orders.js no contiene ${needle}.`));
  assert(payments.includes('WOMPI_AMOUNT_MISMATCH'), 'Wompi no valida el valor confirmado.');
  assert(payments.includes('WOMPI_CURRENCY_MISMATCH'), 'Wompi no valida la moneda confirmada.');
  assert(checkout.includes("api.post('/api/orders/quote'"), 'Checkout no consume la cotización real.');
  assert(!main.includes('checkoutCouponBridge'), 'main.jsx todavía carga el bridge antiguo.');
  ok('Checkout, transacción y webhook usan los totales autoritativos');
}

function validatePackageScript() {
  const pkg = readProjectFile('backend/package.json');
  assert(pkg.includes('test:billing-totals'), 'package.json no registra test:billing-totals.');
  ok('Prueba de conciliación registrada para ejecución desde terminal');
}

function main() {
  console.log('Validando IVA, cupones y conciliación de totales...');

  [
    validateTaxWithoutCoupon,
    validateDiscountBeforeTax,
    validateFreeShippingCoupon,
    validateCentAllocation,
    validateFactusPayload,
    validateFactusExcludedPayload,
    validateInvoiceReconciliationGuard,
    validateAtomicCheckoutAndGatewayGuards,
    validatePackageScript,
  ].forEach((step) => {
    try {
      step();
    } catch (error) {
      fail(step.name, error);
    }
  });

  console.log('');
  console.log(`Resumen totales Facturación -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);

  if (results.fail > 0) process.exit(1);
}

main();
