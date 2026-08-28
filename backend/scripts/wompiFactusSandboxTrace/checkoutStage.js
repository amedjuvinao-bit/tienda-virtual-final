'use strict';

const assert = require('node:assert/strict');
const express = require('express');

const Order = require('../../models/Order');
const PaymentAttempt = require('../../models/PaymentAttempt');
const {
  buildCheckoutPayload,
  buildTraceIdentity,
  createAuthorizedCart,
  findPurchasableInventoryItem,
} = require('./productStage');

async function requestJson(baseUrl, pathname, { headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(
      new Error(data?.message || data?.error || `HTTP ${response.status}`),
      { code: data?.error || 'SANDBOX_CHECKOUT_FAILED', status: response.status }
    );
  }
  return data;
}

async function startCheckoutServer() {
  const orderRoutes = require('../../routes/orders');
  const paymentRoutes = require('../../routes/payments');
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/api/orders', orderRoutes);
  app.use('/api/payments', paymentRoutes);

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function cartHeaders(access, idempotencyKey) {
  return {
    'X-Session-Id': access.sessionId,
    'X-Cart-Access-Token': access.token,
    'Idempotency-Key': idempotencyKey,
  };
}

function paymentHeaders(paymentAccess) {
  return {
    'X-Session-Id': paymentAccess.sessionId,
    'X-Order-Access-Token': paymentAccess.token,
  };
}

async function createAutonomousCheckout() {
  const identity = buildTraceIdentity();
  const item = await findPurchasableInventoryItem();
  const { access, cart } = await createAuthorizedCart(item, identity);
  const payload = buildCheckoutPayload({
    item,
    identity,
    sessionId: access.sessionId,
  });
  const local = await startCheckoutServer();

  try {
    const created = await requestJson(local.baseUrl, '/api/orders', {
      headers: cartHeaders(access, `${identity.runId}-ORDER`),
      body: payload,
    });
    assert(created?._id && created?.orderNumber, 'El checkout no creó la orden.');
    assert(created?.paymentAccess?.token, 'La orden no emitió acceso al pago.');

    const order = await Order.findById(created._id);
    assert(order, 'La orden creada no quedó persistida.');
    assert.notStrictEqual(order?.storeCredit?.applied, true, 'Se aplicó saldo a favor.');
    assert(order?.inventoryControl?.reservationId, 'La orden no reservó inventario.');

    const checkoutData = await requestJson(
      local.baseUrl,
      '/api/payments/wompi/checkout-data',
      {
        headers: paymentHeaders(created.paymentAccess),
        body: { orderId: String(order._id) },
      }
    );
    const attempt = await PaymentAttempt.findOne({
      order: order._id,
      provider: 'wompi',
      reference: checkoutData.reference,
    });
    assert(attempt, 'El checkout Wompi no persistió el intento de pago.');
    assert.strictEqual(Number(attempt.amountInCents), Number(checkoutData.amountInCents));

    return { cart, checkoutData, identity, item, order };
  } finally {
    await local.close();
  }
}

module.exports = {
  createAutonomousCheckout,
  requestJson,
  startCheckoutServer,
};
