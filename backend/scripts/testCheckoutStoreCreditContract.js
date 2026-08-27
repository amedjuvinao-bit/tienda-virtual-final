'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const StoreCreditUsage = require('../models/StoreCreditUsage');
const {
  isWompiTransactionOwnedByOrder,
} = require('../services/publicPaymentAccessService');
const {
  issueStoreCreditAccess,
  verifyStoreCreditAccess,
} = require('../services/storeCreditCheckoutService');
const {
  DEMO: STORE_CREDIT_DEMO,
  parseArgs: parseStoreCreditDemoArgs,
} = require('./seedCheckoutStoreCreditDemo');

const SECRET = 'checkout-store-credit-contract-secret-2026';
let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function orderFixture({ orderNumber, storeCredit, payment } = {}) {
  return new Order({
    sessionId: `session-${orderNumber}`,
    orderNumber,
    status: 'pending',
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        title: 'Producto de prueba',
        quantity: 1,
        qty: 1,
        price: 100000,
        unitPrice: 100000,
        lineSubtotal: 100000,
        lineTotal: 100000,
      },
    ],
    subtotal: 100000,
    shipping: 0,
    total: 100000,
    payment: {
      provider: 'wompi',
      providerLabel: 'Wompi',
      currency: 'COP',
      status: 'pending_gateway',
      ...payment,
    },
    storeCredit,
  });
}

async function run() {
  const customerId = new mongoose.Types.ObjectId();
  const expiresAt = new Date(Date.now() + 60_000);
  const token = issueStoreCreditAccess(
    {
      customerId,
      sessionId: 'cart-session-1',
      currency: 'COP',
      expiresAt,
    },
    { secret: SECRET }
  );
  assert.strictEqual(
    verifyStoreCreditAccess(
      token,
      {
        customerId,
        sessionId: 'cart-session-1',
        currency: 'COP',
      },
      { secret: SECRET }
    ).valid,
    true
  );
  const encodedPayload = token.slice(4).split('.')[0];
  const publicPayload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  assert(!publicPayload.includes(String(customerId)));
  ok('la autorización queda ligada al cliente, carrito y moneda');

  assert.strictEqual(
    verifyStoreCreditAccess(
      token,
      {
        customerId,
        sessionId: 'otro-carrito',
        currency: 'COP',
      },
      { secret: SECRET }
    ).valid,
    false
  );
  assert.strictEqual(
    verifyStoreCreditAccess(
      `${token.slice(0, -1)}x`,
      {
        customerId,
        sessionId: 'cart-session-1',
        currency: 'COP',
      },
      { secret: SECRET }
    ).valid,
    false
  );
  ok('el token no puede moverse a otro carrito ni alterarse');

  const normalOrder = orderFixture({
    orderNumber: 'ORD-SC-NORMAL',
    payment: { amount: 0, amountInCents: 0 },
  });
  await normalOrder.validate();
  assert.strictEqual(normalOrder.payment.amount, 100000);
  assert.strictEqual(normalOrder.payment.amountInCents, 10000000);
  ok('una compra sin saldo conserva el cobro completo');

  const fullCreditOrder = orderFixture({
    orderNumber: 'ORD-SC-FULL',
    payment: { amount: 0, amountInCents: 0 },
    storeCredit: {
      applied: true,
      usage: new mongoose.Types.ObjectId(),
      amount: 100000,
      currency: 'COP',
      status: 'reserved',
      references: ['SC-TEST-1'],
    },
  });
  await fullCreditOrder.validate();
  assert.strictEqual(fullCreditOrder.payment.amount, 0);
  assert.strictEqual(fullCreditOrder.payment.amountInCents, 0);
  ok('el pago total con saldo puede dejar cero para la pasarela');

  const partialOrder = {
    _id: new mongoose.Types.ObjectId(),
    orderNumber: 'ORD-SC-PARTIAL',
    total: 100000,
    payment: { currency: 'COP', amount: 40000 },
    storeCredit: { applied: true, amount: 60000, status: 'reserved' },
  };
  assert.strictEqual(
    isWompiTransactionOwnedByOrder({
      order: partialOrder,
      attempt: {
        provider: 'wompi',
        order: partialOrder._id,
        reference: 'ORDER-ORD-SC-PARTIAL__TRY__1',
        amountInCents: 4000000,
        currency: 'COP',
      },
      requestedTransactionId: 'tx-store-credit-partial',
      transaction: {
        id: 'tx-store-credit-partial',
        reference: 'ORDER-ORD-SC-PARTIAL__TRY__1',
        amount_in_cents: 4000000,
        currency: 'COP',
      },
    }),
    true
  );
  assert.strictEqual(
    isWompiTransactionOwnedByOrder({
      order: partialOrder,
      attempt: {
        provider: 'wompi',
        order: partialOrder._id,
        reference: 'ORDER-ORD-SC-PARTIAL__TRY__2',
        amountInCents: 4000000,
        currency: 'COP',
      },
      requestedTransactionId: 'tx-store-credit-wrong-total',
      transaction: {
        id: 'tx-store-credit-wrong-total',
        reference: 'ORDER-ORD-SC-PARTIAL__TRY__2',
        amount_in_cents: 10000000,
        currency: 'COP',
      },
    }),
    false
  );
  ok('Wompi acepta únicamente el remanente exacto después del saldo');

  const releasedOrder = {
    ...partialOrder,
    payment: { ...partialOrder.payment, amount: 100000 },
    storeCredit: { ...partialOrder.storeCredit, status: 'released' },
  };
  assert.strictEqual(
    isWompiTransactionOwnedByOrder({
      order: releasedOrder,
      attempt: {
        provider: 'wompi',
        order: releasedOrder._id,
        reference: 'ORDER-ORD-SC-PARTIAL__TRY__old',
        amountInCents: 4000000,
        currency: 'COP',
        state: 'superseded',
        active: false,
      },
      requestedTransactionId: 'tx-store-credit-old-attempt',
      transaction: {
        id: 'tx-store-credit-old-attempt',
        reference: 'ORDER-ORD-SC-PARTIAL__TRY__old',
        amount_in_cents: 4000000,
        currency: 'COP',
      },
    }),
    true
  );
  assert.strictEqual(
    isWompiTransactionOwnedByOrder({
      order: releasedOrder,
      attempt: {
        provider: 'wompi',
        order: releasedOrder._id,
        reference: 'ORDER-ORD-SC-PARTIAL__TRY__new',
        amountInCents: 10000000,
        currency: 'COP',
        state: 'issued',
        active: true,
      },
      requestedTransactionId: 'tx-store-credit-new-attempt',
      transaction: {
        id: 'tx-store-credit-new-attempt',
        reference: 'ORDER-ORD-SC-PARTIAL__TRY__new',
        amount_in_cents: 10000000,
        currency: 'COP',
      },
    }),
    true
  );
  ok('la consulta pública identifica cada intento por su ledger exacto');

  const usage = new StoreCreditUsage({
    order: fullCreditOrder._id,
    orderNumber: fullCreditOrder.orderNumber,
    customer: customerId,
    customerKey: `customer:${customerId}`,
    sessionId: 'cart-session-1',
    currency: 'COP',
    amount: 100000,
    status: 'reserved',
    allocations: [
      {
        credit: new mongoose.Types.ObjectId(),
        creditNumber: 'SC-TEST-1',
        amount: 100000,
        balanceBefore: 100000,
        balanceAfter: 0,
      },
    ],
    expiresAt,
  });
  await usage.validate();
  assert.strictEqual(usage.allocations.length, 1);
  assert.strictEqual(usage.amount, 100000);
  ok('cada uso conserva la fuente y el movimiento de saldo');

  const checkoutReservationSource = fs.readFileSync(
    path.join(__dirname, '../services/storeCreditCheckout/reservation.js'),
    'utf8'
  );
  assert(checkoutReservationSource.includes('$set: { balance: after }'));
  assert(!checkoutReservationSource.includes('$inc: { balance: -take'));
  ok('la reserva guarda el saldo restante sin aplicar setters a un incremento negativo');

  assert.strictEqual(parseStoreCreditDemoArgs([]).confirmPersist, false);
  assert.strictEqual(
    parseStoreCreditDemoArgs(['--confirm-persist']).confirmPersist,
    true
  );
  assert.strictEqual(STORE_CREDIT_DEMO.documentNumber, '1010123456');
  assert.strictEqual(STORE_CREDIT_DEMO.email, 'saldo.checkout@example.com');
  assert.strictEqual(STORE_CREDIT_DEMO.creditAmount, 300000);
  ok('el script DEMO exige confirmación y entrega credenciales estables para Checkout');

  console.log(
    `\nContrato de saldo a favor en Checkout: ${passed}/${passed} controles aprobados`
  );
}

run().catch((error) => {
  console.error('\nFAIL Contrato de saldo a favor en Checkout');
  console.error(error);
  process.exitCode = 1;
});
