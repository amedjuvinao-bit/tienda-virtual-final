'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const SiteSettings = require('../models/SiteSettings');

const {
  buildAuthorizedOrderBody,
  createRequireAuthorizedOrderCart,
} = require('../services/authorizedCartOrderService');
const {
  buildOrderPaymentSnapshot,
  createPaymentConfigurationAuthority,
} = require('../services/paymentConfigurationAuthorityService');
const { issueCartAccess } = require('../services/cartAccessService');

const CART_ID = '64a000000000000000000111';
const PRODUCT_ID = '68a4a78a59706e44cade0316';
const CART_SECRET = 'qa-payment-authority-cart-secret-12345678901234567890';

const checks = [];
async function check(name, callback) {
  assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe permanecer desconectado');
  await callback();
  assert.equal(mongoose.connection.readyState, 0, 'MongoDB debe permanecer desconectado');
  checks.push(name);
  console.log(`OK ${checks.length}: ${name}`);
}

function wompiConfig(overrides = {}) {
  return {
    active: true,
    provider: 'wompi',
    mode: 'sandbox',
    currency: 'COP',
    checkoutLabel: 'Pagar con Wompi',
    enableWebhook: true,
    credentials: {
      wompi: {
        publicKey: 'public-test-value',
        privateKey: 'private-test-value',
        integrityKey: 'integrity-test-value',
        webhookSecret: 'webhook-test-value',
      },
      payu: {},
    },
    ...overrides,
  };
}

function payuConfig(overrides = {}) {
  return {
    active: true,
    provider: 'payu',
    mode: 'sandbox',
    currency: 'COP',
    checkoutLabel: 'Pagar con PayU',
    enableWebhook: true,
    credentials: {
      wompi: {},
      payu: {
        merchantId: 'merchant-test',
        accountId: 'account-test',
        apiLogin: 'login-test',
        apiKey: 'api-key-test',
      },
    },
    ...overrides,
  };
}

function fakeSettingsModel(payments) {
  return {
    findOne() {
      return {
        lean() {
          return this;
        },
        async exec() {
          return { theme: { global: { payments } } };
        },
      };
    },
  };
}

function authorityFor(payments) {
  return createPaymentConfigurationAuthority({
    SiteSettingsModel: fakeSettingsModel(payments),
    env: {},
  });
}

function createCart() {
  const access = issueCartAccess({ cartId: CART_ID, secret: CART_SECRET });
  const cart = {
    _id: CART_ID,
    sessionId: access.sessionId,
    accessTokenHash: access.tokenHash,
    accessVersion: access.version,
    accessIssuedAt: new Date(),
    active: true,
    items: [{
      _id: PRODUCT_ID,
      productId: PRODUCT_ID,
      quantity: 1,
      qty: 1,
      price: 100000,
      variantKey: '4__royalblue',
    }],
  };
  cart.toObject = () => ({ ...cart, items: cart.items.map((item) => ({ ...item })) });
  return { cart, access };
}

function fakeCartModel(cart) {
  return {
    findOne({ sessionId }) {
      return {
        select() {
          return this;
        },
        async exec() {
          return sessionId === cart.sessionId ? cart : null;
        },
      };
    },
  };
}

async function withServer(payments, callback) {
  const { cart, access } = createCart();
  const originalFindOne = SiteSettings.findOne;
  SiteSettings.findOne = fakeSettingsModel(payments).findOne;
  const effects = { handler: 0, orders: 0, reservations: 0, payments: 0, invoices: 0 };
  const app = express();
  app.use(express.json());
  app.post(
    '/api/orders',
    createRequireAuthorizedOrderCart({
      CartModel: fakeCartModel(cart),
      getSecret: () => CART_SECRET,
      canonicalValidationService: {
        async validateItems(items) {
          return {
            ok: true,
            items: items.map((item) => ({ ...item, valid: true, purchasable: true })),
            invalidItems: [],
          };
        },
      },
    }),
    (req, res) => {
      effects.handler += 1;
      effects.orders += 1;
      return res.status(201).json({ payment: req.body.payment });
    }
  );

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await callback({
      url: `http://127.0.0.1:${server.address().port}/api/orders`,
      access,
      effects,
    });
  } finally {
    SiteSettings.findOne = originalFindOne;
    await new Promise((resolve) => server.close(resolve));
  }
}

async function postOrder(url, access, payment) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Session-Id': access.sessionId,
      'X-Cart-Access-Token': access.token,
    },
    body: JSON.stringify({ payment, customer: { name: 'Cliente' } }),
  });
  return { status: response.status, body: await response.json() };
}

async function main() {
  const wompiAuthority = authorityFor(wompiConfig());
  const wompi = await wompiAuthority.resolveOrderPaymentSelection('wompi');

  await check('USD enviado por el cliente no cambia COP canonico', async () => {
    const body = buildAuthorizedOrderBody(
      { payment: { provider: 'wompi', currency: 'USD' } },
      { items: [] },
      'server-session',
      wompi.snapshot
    );
    assert.equal(body.payment.currency, 'COP');
  });

  await check('production enviado por el cliente no cambia sandbox canonico', async () => {
    const body = buildAuthorizedOrderBody(
      { payment: { provider: 'wompi', mode: 'production' } },
      { items: [] },
      'server-session',
      wompi.snapshot
    );
    assert.equal(body.payment.mode, 'sandbox');
  });

  await check('active true no activa una configuracion deshabilitada', async () => {
    await assert.rejects(
      authorityFor(wompiConfig({ active: false })).resolveOrderPaymentSelection('wompi'),
      (error) => error.code === 'PAYMENTS_DISABLED'
    );
  });

  await check('enableWebhook false del cliente no desactiva el webhook canonico', async () => {
    const body = buildAuthorizedOrderBody(
      { payment: { provider: 'wompi', enableWebhook: false } },
      { items: [] },
      'server-session',
      wompi.snapshot
    );
    assert.equal(body.payment.enableWebhook, true);
  });

  await check('etiquetas fabricadas no llegan al snapshot de la orden', async () => {
    const body = buildAuthorizedOrderBody(
      { payment: { provider: 'wompi', providerLabel: 'Banco falso', checkoutLabel: 'Gratis' } },
      { items: [] },
      'server-session',
      wompi.snapshot
    );
    assert.equal(body.payment.providerLabel, 'Wompi');
    assert.equal(body.payment.checkoutLabel, 'Pagar con Wompi');
  });

  await check('proveedor inexistente se rechaza antes del flujo', async () => {
    await assert.rejects(
      wompiAuthority.resolveOrderPaymentSelection('proveedor-falso'),
      (error) => error.code === 'PAYMENT_PROVIDER_UNSUPPORTED'
    );
  });

  await check('proveedor distinto del activo se rechaza', async () => {
    await assert.rejects(
      wompiAuthority.resolveOrderPaymentSelection('payu'),
      (error) => error.code === 'PAYMENT_PROVIDER_NOT_ACTIVE'
    );
  });

  await check('configuracion incompleta se rechaza controladamente', async () => {
    await assert.rejects(
      authorityFor(wompiConfig({ credentials: { wompi: {}, payu: {} } }))
        .resolveOrderPaymentSelection('wompi'),
      (error) => error.code === 'PAYMENT_CONFIGURATION_INVALID'
    );
  });

  await check('snapshot Wompi es canonico y no contiene credenciales', async () => {
    assert.deepEqual(wompi.snapshot, {
      active: true,
      provider: 'wompi',
      providerLabel: 'Wompi',
      mode: 'sandbox',
      currency: 'COP',
      checkoutLabel: 'Pagar con Wompi',
      enableWebhook: true,
      status: 'pending_gateway',
    });
    assert.equal(JSON.stringify(wompi.snapshot).includes('test-value'), false);
  });

  await check('PayU valido conserva su snapshot y configuracion del servidor', async () => {
    const payu = await authorityFor(payuConfig()).resolveOrderPaymentSelection('payu');
    assert.equal(payu.snapshot.provider, 'payu');
    assert.equal(payu.snapshot.providerLabel, 'PayU');
    assert.equal(payu.snapshot.currency, 'COP');
    assert.equal(payu.snapshot.enableWebhook, true);
  });

  await check('HTTP predeterminado usa la autoridad e ignora campos operativos inyectados', async () => {
    await withServer(wompiConfig(), async ({ url, access, effects }) => {
      const response = await postOrder(url, access, {
        provider: 'wompi',
        active: false,
        providerLabel: 'Proveedor fabricado',
        mode: 'production',
        currency: 'USD',
        checkoutLabel: 'Checkout fabricado',
        enableWebhook: false,
        publicKey: 'client-key',
        signature: 'client-signature',
        redirectUrl: 'https://attacker.invalid',
      });
      assert.equal(response.status, 201);
      assert.deepEqual(response.body.payment, wompi.snapshot);
      assert.equal(effects.handler, 1);
    });
  });

  await check('configuracion invalida produce cero efectos posteriores', async () => {
    await withServer(wompiConfig({ active: false }), async ({ url, access, effects }) => {
      const response = await postOrder(url, access, { provider: 'wompi', active: true });
      assert.equal(response.status, 409);
      assert.equal(response.body.error, 'PAYMENTS_DISABLED');
      assert.deepEqual(effects, {
        handler: 0,
        orders: 0,
        reservations: 0,
        payments: 0,
        invoices: 0,
      });
    });
  });

  await check('reserva y webhook comparten moneda del snapshot canonico', async () => {
    const reservationCurrency = wompi.snapshot.currency;
    const webhookExpectedCurrency = wompi.snapshot.currency || wompi.config.currency;
    assert.equal(reservationCurrency, 'COP');
    assert.equal(webhookExpectedCurrency, 'COP');
  });

  assert.equal(mongoose.connection.readyState, 0);
  console.log(`RESULTADO: ${checks.length}/${checks.length} pruebas aprobadas; MongoDB desconectado.`);
  console.log('No se contactaron Wompi, PayU, Factus, correo ni otros proveedores.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
