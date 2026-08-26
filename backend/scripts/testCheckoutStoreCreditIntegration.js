/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const Customer = require('../models/Customer');
const StoreCredit = require('../models/StoreCredit');
const StoreCreditUsage = require('../models/StoreCreditUsage');
const {
  applyUsageSnapshotToOrder,
  consumeReservedStoreCreditForOrder,
  previewCustomerStoreCredit,
  releaseReservedStoreCreditForOrder,
  reserveStoreCreditForOrder,
} = require('../services/storeCreditCheckoutService');

const REQUIRED_DATABASE = 'orders_ci_store_credit';
const MONGO_URI = process.env.ORDERS_STORE_CREDIT_MONGO_URI || '';
const SECRET = 'checkout-store-credit-integration-secret-2026';
const NOW = new Date('2026-08-26T12:00:00.000Z');
let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function assertSafeMongoUri(value) {
  assert(value, 'ORDERS_STORE_CREDIT_MONGO_URI no está configurado.');
  const parsed = new URL(value);
  assert.strictEqual(parsed.protocol, 'mongodb:');
  assert(
    ['127.0.0.1', 'localhost'].includes(parsed.hostname),
    'La integración solo acepta MongoDB local.'
  );
  assert.strictEqual(
    parsed.pathname.replace(/^\//, ''),
    REQUIRED_DATABASE,
    `La base temporal debe llamarse ${REQUIRED_DATABASE}.`
  );
  assert.strictEqual(parsed.searchParams.get('replicaSet'), 'rs0');
}

function orderFixture(position) {
  return {
    _id: new mongoose.Types.ObjectId(),
    orderNumber: `ORD-STORE-CREDIT-${position}`,
    total: 100000,
    payment: {
      status: 'pending_gateway',
      provider: 'wompi',
      providerLabel: 'Wompi',
      currency: 'COP',
      method: 'mixed',
      amount: 40000,
      amountInCents: 4000000,
      splitPayments: [
        { method: 'store_credit', methodLabel: 'Saldo a favor', amount: 60000 },
        { method: 'wompi', methodLabel: 'Wompi', amount: 40000 },
      ],
    },
    storeCredit: {},
  };
}

async function runInTransaction(callback) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => callback(session));
  } finally {
    await session.endSession();
  }
}

async function totalBalance(customerId) {
  const credits = await StoreCredit.find({ customer: customerId }).lean();
  return credits.reduce((sum, credit) => sum + Number(credit.balance || 0), 0);
}

async function run() {
  assertSafeMongoUri(MONGO_URI);
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await mongoose.connection.dropDatabase();
  // Esta prueba valida los índices propios del saldo. Customer conserva índices
  // heredados que MongoDB 7 no puede recrear en una base temporal vacía, pero
  // ninguno de ellos interviene en la reserva o devolución que se prueba aquí.
  await Customer.createCollection();
  await Promise.all([StoreCredit.init(), StoreCreditUsage.init()]);

  const customer = await Customer.create({
    firstName: 'Cliente',
    lastName: 'Saldo',
    fullName: 'Cliente Saldo',
    email: 'saldo@example.invalid',
    phone: '+573001112233',
    documentType: 'CC',
    documentNumber: '1010123456',
    source: 'web',
  });
  await StoreCredit.create([
    {
      creditNumber: 'SC-CHECKOUT-1',
      customer: customer._id,
      customerKey: `customer:${customer._id}`,
      currency: 'COP',
      originalAmount: 40000,
      balance: 40000,
      expiresAt: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
      sourceOrder: new mongoose.Types.ObjectId(),
      sourceOrderNumber: 'ORD-SOURCE-1',
      sourceReturn: new mongoose.Types.ObjectId(),
    },
    {
      creditNumber: 'SC-CHECKOUT-2',
      customer: customer._id,
      customerKey: `customer:${customer._id}`,
      currency: 'COP',
      originalAmount: 60000,
      balance: 60000,
      expiresAt: new Date(NOW.getTime() + 60 * 24 * 60 * 60 * 1000),
      sourceOrder: new mongoose.Types.ObjectId(),
      sourceOrderNumber: 'ORD-SOURCE-2',
      sourceReturn: new mongoose.Types.ObjectId(),
    },
  ]);

  const denied = await previewCustomerStoreCredit(
    {
      documentNumber: customer.documentNumber,
      emailOrPhone: 'otro@example.invalid',
      sessionId: 'cart-store-credit',
      currency: 'COP',
      now: NOW,
    },
    { secret: SECRET }
  );
  assert.strictEqual(denied.eligible, false);
  assert.strictEqual(denied.balance, 0);
  ok('un contacto que no coincide no puede consultar el saldo');

  const preview = await previewCustomerStoreCredit(
    {
      documentNumber: '1.010.123.456',
      emailOrPhone: customer.email,
      sessionId: 'cart-store-credit',
      currency: 'COP',
      now: NOW,
    },
    { secret: SECRET }
  );
  assert.strictEqual(preview.eligible, true);
  assert.strictEqual(preview.balance, 100000);
  assert(preview.accessToken.startsWith('sc1_'));
  ok('la identidad exacta obtiene solo el total disponible');

  const firstOrder = orderFixture(1);
  await runInTransaction(async (session) => {
    const usage = await reserveStoreCreditForOrder(
      {
        order: firstOrder,
        customerId: customer._id,
        sessionId: 'cart-store-credit',
        currency: 'COP',
        requestedAmount: 60000,
        orderTotal: 120000,
        accessToken: preview.accessToken,
        now: NOW,
      },
      { session, secret: SECRET }
    );
    applyUsageSnapshotToOrder(firstOrder, usage);
  });
  assert.strictEqual(await totalBalance(customer._id), 40000);
  const reserved = await StoreCreditUsage.findOne({ order: firstOrder._id }).lean();
  assert.strictEqual(reserved.status, 'reserved');
  assert.strictEqual(reserved.allocations.length, 2);
  ok('la reserva descuenta créditos por vencimiento dentro de una transacción');

  await runInTransaction(async (session) => {
    const result = await consumeReservedStoreCreditForOrder(firstOrder, { session });
    assert.strictEqual(result.consumed, true);
    assert.strictEqual(result.duplicate, false);
  });
  assert.strictEqual(
    (await StoreCreditUsage.findOne({ order: firstOrder._id }).lean()).status,
    'consumed'
  );
  assert.strictEqual(await totalBalance(customer._id), 40000);
  ok('la aprobación consume el saldo sin devolverlo ni descontarlo dos veces');

  const secondOrder = orderFixture(2);
  const secondPreview = await previewCustomerStoreCredit(
    {
      documentNumber: customer.documentNumber,
      emailOrPhone: customer.phone,
      sessionId: 'cart-store-credit-2',
      currency: 'COP',
      now: NOW,
    },
    { secret: SECRET }
  );
  await runInTransaction(async (session) => {
    await reserveStoreCreditForOrder(
      {
        order: secondOrder,
        customerId: customer._id,
        sessionId: 'cart-store-credit-2',
        currency: 'COP',
        requestedAmount: 30000,
        orderTotal: 50000,
        accessToken: secondPreview.accessToken,
        now: NOW,
      },
      { session, secret: SECRET }
    );
  });
  assert.strictEqual(await totalBalance(customer._id), 10000);
  await runInTransaction(async (session) => {
    const result = await releaseReservedStoreCreditForOrder(secondOrder, {
      session,
      reason: 'Pago restante rechazado en integración.',
      now: NOW,
    });
    assert.strictEqual(result.released, true);
  });
  assert.strictEqual(await totalBalance(customer._id), 40000);
  assert.strictEqual(secondOrder.payment.amount, secondOrder.total);
  assert.strictEqual(secondOrder.payment.amountInCents, secondOrder.total * 100);
  assert.strictEqual(secondOrder.payment.splitPayments.length, 1);
  assert.strictEqual(secondOrder.payment.splitPayments[0].method, 'wompi');
  assert.strictEqual(
    (await StoreCreditUsage.findOne({ order: secondOrder._id }).lean()).status,
    'released'
  );
  ok('un pago rechazado devuelve exactamente el saldo reservado');

  const thirdOrder = orderFixture(3);
  await assert.rejects(
    () =>
      runInTransaction((session) =>
        reserveStoreCreditForOrder(
          {
            order: thirdOrder,
            customerId: customer._id,
            sessionId: 'cart-store-credit-2',
            currency: 'COP',
            requestedAmount: 50000,
            orderTotal: 80000,
            accessToken: secondPreview.accessToken,
            now: NOW,
          },
          { session, secret: SECRET }
        )
      ),
    (error) => error?.code === 'STORE_CREDIT_BALANCE_CHANGED'
  );
  assert.strictEqual(await totalBalance(customer._id), 40000);
  ok('una reserva superior al saldo falla sin alterar el dinero');

  console.log(
    `\nIntegración de saldo a favor en Checkout: ${passed}/${passed} controles aprobados`
  );
}

async function main() {
  try {
    await run();
  } finally {
    if (mongoose.connection.readyState) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('\nFAIL Integración de saldo a favor en Checkout');
  console.error(error);
  process.exitCode = 1;
});
