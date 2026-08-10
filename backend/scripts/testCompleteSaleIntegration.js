/* eslint-disable no-console */

'use strict';

process.env.NODE_ENV = 'test';
process.env.DIGITAL_DELIVERY_TOKEN_SECRET =
  process.env.DIGITAL_DELIVERY_TOKEN_SECRET ||
  'complete-sale-ci-secret';
process.env.PUBLIC_BACKEND_URL =
  process.env.PUBLIC_BACKEND_URL ||
  'https://backend.example';
process.env.CART_ACCESS_SECRET =
  process.env.CART_ACCESS_SECRET ||
  'complete-sale-cart-access-secret-12345678901234567890';
process.env.ORDER_PAYMENT_ACCESS_SECRET =
  process.env.ORDER_PAYMENT_ACCESS_SECRET ||
  'complete-sale-payment-access-secret-1234567890123456';

const assert = require('assert');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryReservation = require('../models/InventoryReservation');
const IdempotencyKey = require('../models/IdempotencyKey');
const SiteSettings = require('../models/SiteSettings');
const {
  saveProductWithInventoryTransaction,
} = require('../services/productInventoryPersistenceService');
const {
  createInventoryMovement,
} = require('../services/inventoryService');
const {
  transitionOrderStatus,
} = require('../services/orderStatusTransitionService');
const {
  processOrderRefund,
} = require('../services/orderRefundService');
const {
  buildVariantKey,
} = require('../lib/products/productVariantConfig');
const {
  issueCartAccess,
} = require('../services/cartAccessService');
const {
  createGuestOrderAccessToken,
} = require('../services/publicPaymentAccessService');

const MONGO_URI =
  process.env.PRODUCTS_TEST_MONGO_URI ||
  process.env.MONGODB_REPLICA_URI ||
  process.env.MONGODB_URI ||
  '';
const RUN_ID = crypto.randomBytes(4).toString('hex').toUpperCase();
const PREFIX = `SALE-${RUN_ID}`;
const WEBHOOK_SECRET = `${PREFIX}-WOMPI-SECRET`;
const VARIANT_ATTRIBUTES = [
  { key: 'capacidad', label: 'Capacidad', value: '256GB' },
  { key: 'ram', label: 'RAM', value: '12GB' },
  { key: 'color', label: 'Color', value: 'Azul' },
  {
    key: 'conectividad',
    label: 'Conectividad',
    value: '5G',
  },
];
const VARIANT_KEY = buildVariantKey(
  '',
  'Azul',
  VARIANT_ATTRIBUTES
);
const UNIT_PRICE = 100000;

let passed = 0;
let server = null;
const nativeFetch = global.fetch;
let wompiFetchCalls = 0;
const wompiTransactions = new Map();

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function buildIsolatedMongoUri(uri) {
  const parsed = new URL(uri);
  parsed.pathname = `/productos_venta_${RUN_ID.toLowerCase()}`;
  return parsed.toString();
}

function installWompiFetchStub() {
  global.fetch = async (input, options) => {
    const url = String(input?.url || input || '');
    if (url.includes('.wompi.co/v1/merchants/')) {
      wompiFetchCalls += 1;
      return new Response(JSON.stringify({
        data: {
          presigned_acceptance: {
            acceptance_token: `${PREFIX}-ACCEPTANCE`,
            permalink: 'https://wompi.example/acceptance',
          },
          presigned_personal_data_auth: {
            acceptance_token: `${PREFIX}-PERSONAL-DATA`,
            permalink: 'https://wompi.example/personal-data',
          },
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('.wompi.co/v1/transactions/')) {
      wompiFetchCalls += 1;
      const transactionId = decodeURIComponent(url.split('/').pop() || '');
      const transaction = wompiTransactions.get(transactionId);
      return new Response(JSON.stringify(
        transaction
          ? { data: transaction }
          : { error: { reason: 'not found' } }
      ), {
        status: transaction ? 200 : 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return nativeFetch(input, options);
  };
}

function getNestedValue(value, pathValue) {
  return String(pathValue || '')
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => current?.[key], value);
}

function buildWompiEventChecksum(payload, secret) {
  const properties = Array.isArray(
    payload?.signature?.properties
  )
    ? payload.signature.properties
    : [];
  const values = properties
    .map((property) =>
      getNestedValue(payload?.data || {}, property)
    )
    .map((value) =>
      value === null || value === undefined ? '' : String(value)
    )
    .join('');
  const raw = `${values}${String(payload?.timestamp || '')}${secret}`;
  return crypto
    .createHash('sha256')
    .update(raw)
    .digest('hex');
}

function buildWompiPayload({
  orderNumber,
  total,
  transactionId,
}) {
  const payload = {
    event: 'transaction.updated',
    timestamp: Date.now(),
    data: {
      transaction: {
        id: transactionId,
        status: 'APPROVED',
        reference: `ORDER-${orderNumber}__TRY__${PREFIX}`,
        amount_in_cents: Math.round(Number(total || 0) * 100),
        currency: 'COP',
        payment_method_type: 'CARD',
        payment_method: {
          type: 'CARD',
        },
        created_at: new Date().toISOString(),
        finalized_at: new Date().toISOString(),
      },
    },
    signature: {
      properties: [
        'transaction.id',
        'transaction.status',
        'transaction.reference',
        'transaction.amount_in_cents',
      ],
      checksum: '',
    },
  };
  payload.signature.checksum = buildWompiEventChecksum(
    payload,
    WEBHOOK_SECRET
  );
  return payload;
}

async function requestJson(
  baseUrl,
  path,
  { method = 'GET', headers = {}, body } = {}
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

async function waitFor(work, message, timeoutMs = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await work();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(message);
}

function branchQuantity(order, branchId, field) {
  return (order.inventoryAllocations || [])
    .filter(
      (allocation) =>
        String(allocation.branch) === String(branchId)
    )
    .reduce(
      (sum, allocation) =>
        sum + Number(allocation?.[field] || 0),
      0
    );
}

async function stockState(productId, branchId) {
  const row = await InventoryStock.findOne({
    product: productId,
    branch: branchId,
    variantKey: VARIANT_KEY,
    deletedAt: null,
  }).lean();

  return {
    stock: Number(row?.stock || 0),
    reserved: Number(row?.reservedStock || 0),
    available: Number(row?.availableStock || 0),
  };
}

async function startHttpServer() {
  const orderRoutes = require('../routes/orders');
  const paymentRoutes = require('../routes/payments');
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/api/orders', orderRoutes);
  app.use('/api/payments', paymentRoutes);

  server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () =>
      resolve(instance)
    );
    instance.once('error', reject);
  });

  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function createSettings() {
  await SiteSettings.collection.insertOne({
    publicUrl: 'https://store.example',
    theme: {
      global: {
        payments: {
          active: true,
          provider: 'wompi',
          mode: 'sandbox',
          currency: 'COP',
          enableWebhook: true,
          credentials: {
            wompi: {
              publicKey: `${PREFIX}-PUBLIC`,
              privateKey: `${PREFIX}-PRIVATE`,
              integrityKey: `${PREFIX}-INTEGRITY`,
              webhookSecret: WEBHOOK_SECRET,
            },
          },
        },
      },
    },
    billing: {
      dian: {
        enabled: false,
        mode: 'internal',
        environment: '2',
      },
      electronicProvider: {
        provider: 'mock',
      },
      taxes: {
        iva: {
          enabled: false,
          percent: 0,
          code: '01',
          name: 'IVA',
        },
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function createCatalog() {
  const [branchA, branchB] = await Branch.create([
    {
      name: `${PREFIX} Centro`,
      code: `${PREFIX}-A`,
      type: 'store',
      status: 'active',
      active: true,
      isMain: true,
      isDefaultForOnlineOrders: true,
    },
    {
      name: `${PREFIX} Bodega`,
      code: `${PREFIX}-B`,
      type: 'warehouse',
      status: 'active',
      active: true,
    },
  ]);

  const product = new Product({
    sku: `${PREFIX}-PHONE`,
    title: `${PREFIX} Teléfono`,
    description:
      'Producto temporal para validar una venta integral.',
    category: `${PREFIX} Pruebas`,
    categories: [`${PREFIX} Pruebas`],
    productType: 'physical',
    unitOfMeasure: 'unit',
    trackInventory: true,
    allowBackorder: false,
    variantPreset: 'generic',
    variantAxes: [
      {
        key: 'capacidad',
        label: 'Capacidad',
        values: ['256GB'],
      },
      { key: 'ram', label: 'RAM', values: ['12GB'] },
      { key: 'color', label: 'Color', values: ['Azul'] },
      {
        key: 'conectividad',
        label: 'Conectividad',
        values: ['5G'],
      },
    ],
    price: UNIT_PRICE,
    cost: 60000,
    averageCost: 60000,
    variants: [
      {
        variantKey: VARIANT_KEY,
        label: '256GB / 12GB / Azul / 5G',
        attributes: VARIANT_ATTRIBUTES,
        color: 'Azul',
        sku: `${PREFIX}-PHONE-256-12-AZ-5G`,
        price: UNIT_PRICE,
        cost: 60000,
        initialStock: 4,
        active: true,
      },
    ],
    stock: 4,
    active: true,
    visible: true,
  });

  const savedProduct =
    await saveProductWithInventoryTransaction(product, {
      variantsAuthoritative: true,
    });

  await createInventoryMovement({
    type: 'transfer',
    product: savedProduct._id,
    variantKey: VARIANT_KEY,
    variantAttributes: VARIANT_ATTRIBUTES,
    color: 'Azul',
    branchFrom: branchA._id,
    branchTo: branchB._id,
    quantity: 2,
    reason: 'Distribución inicial para venta integral',
    reference: `${PREFIX}-TRANSFER`,
  });

  return {
    branchA,
    branchB,
    product: savedProduct,
  };
}

function buildCheckoutPayload(product) {
  return {
    sessionId: `${PREFIX}-SESSION`,
    cart: [
      {
        productId: String(product._id),
        title: 'Título manipulado por cliente',
        price: 1,
        quantity: 3,
        color: 'Azul',
        variantKey: VARIANT_KEY,
        variantLabel: '256GB / 12GB / Azul / 5G',
        variantAttributes: VARIANT_ATTRIBUTES,
      },
    ],
    subtotal: 3,
    shipping: 0,
    total: 3,
    customer: {
      name: 'Cliente',
      lastname: 'Integral',
      id: '123456789',
      documentType: 'CC',
      emailOrPhone: 'cliente.integral@example.com',
      email: 'cliente.integral@example.com',
      phone: '3000000000',
      address: 'Calle 1 # 2-3',
      city: 'Santa Marta',
      municipalityId: '47001',
      country: 'Colombia',
      countryCode: 'CO',
      department: 'Magdalena',
      departmentCode: '47',
      deliveryType: 'retiro',
      wantsNewsletter: false,
    },
    billing: {
      useSameAddress: true,
      personType: 'natural',
      documentType: 'CC',
      documentNumber: '123456789',
      firstName: 'Cliente',
      lastName: 'Integral',
      email: 'cliente.integral@example.com',
      address: 'Calle 1 # 2-3',
      city: 'Santa Marta',
      municipalityCode: '47001',
      department: 'Magdalena',
      departmentCode: '47',
      country: 'Colombia',
      countryCode: 'CO',
      tributeCode: 'ZZ',
    },
    payment: {
      active: true,
      provider: 'wompi',
      providerLabel: 'Wompi',
      mode: 'sandbox',
      currency: 'COP',
      checkoutLabel: 'Wompi',
      enableWebhook: true,
      status: 'pending_gateway',
    },
  };
}

async function createAuthorizedCart(product, { quantity = 3 } = {}) {
  const cartId = new mongoose.Types.ObjectId();
  const access = issueCartAccess({
    cartId,
    secret: process.env.CART_ACCESS_SECRET,
  });
  const cart = await Cart.create({
    _id: cartId,
    sessionId: access.sessionId,
    accessTokenHash: access.tokenHash,
    accessVersion: access.version,
    accessIssuedAt: new Date(),
    items: [{
      _id: product._id,
      price: 1,
      qty: quantity,
      quantity,
      color: 'Azul',
      variantId: VARIANT_KEY,
      variantKey: VARIANT_KEY,
      variantLabel: '256GB / 12GB / Azul / 5G',
      variantAttributes: VARIANT_ATTRIBUTES,
      title: 'Titulo manipulado por cliente',
    }],
    lastCustomerActivityAt: new Date(),
  });
  return { cart, access };
}

function cartAccessHeaders(access) {
  return {
    'X-Session-Id': access.sessionId,
    'X-Cart-Access-Token': access.token,
  };
}

function paymentAccessHeaders(access) {
  return {
    'X-Session-Id': access.sessionId,
    'X-Order-Access-Token': access.token,
  };
}

function alterCredential(value) {
  const safe = String(value || '');
  const last = safe.slice(-1);
  return `${safe.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`;
}

async function run() {
  assert(
    MONGO_URI,
    'PRODUCTS_TEST_MONGO_URI/MONGODB_REPLICA_URI no está configurado.'
  );

  await mongoose.connect(buildIsolatedMongoUri(MONGO_URI));
  await createSettings();
  const baseUrl = await startHttpServer();
  const { branchA, branchB, product } = await createCatalog();

  assert.deepStrictEqual(
    await stockState(product._id, branchA._id),
    { stock: 2, reserved: 0, available: 2 }
  );
  assert.deepStrictEqual(
    await stockState(product._id, branchB._id),
    { stock: 2, reserved: 0, available: 2 }
  );
  assert.strictEqual(
    await InventoryMovement.countDocuments({
      product: product._id,
      type: 'initial_stock',
    }),
    1
  );
  ok('Producto e inventario inicial se confirman juntos');

  assert.strictEqual(
    await InventoryMovement.countDocuments({
      product: product._id,
      type: 'transfer',
      status: 'posted',
    }),
    1
  );
  ok('El traslado deja dos unidades en cada sede');

  const { cart: checkoutCart, access: checkoutAccess } =
    await createAuthorizedCart(product);
  const { access: otherCartAccess } = await createAuthorizedCart(product, {
    quantity: 1,
  });
  const checkoutPayload = {
    ...buildCheckoutPayload(product),
    sessionId: checkoutAccess.sessionId,
  };
  const idempotencyKey = `${PREFIX}-CHECKOUT`;

  const missingOrderAccess = await requestJson(baseUrl, '/api/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': `${PREFIX}-MISSING` },
    body: checkoutPayload,
  });
  assert.strictEqual(missingOrderAccess.status, 404);

  const alteredOrderAccess = await requestJson(baseUrl, '/api/orders', {
    method: 'POST',
    headers: {
      ...cartAccessHeaders({
        ...checkoutAccess,
        token: alterCredential(checkoutAccess.token),
      }),
      'Idempotency-Key': `${PREFIX}-ALTERED`,
    },
    body: checkoutPayload,
  });
  assert.strictEqual(alteredOrderAccess.status, 404);

  const otherCartOrderAccess = await requestJson(baseUrl, '/api/orders', {
    method: 'POST',
    headers: {
      'X-Session-Id': checkoutAccess.sessionId,
      'X-Cart-Access-Token': otherCartAccess.token,
      'Idempotency-Key': `${PREFIX}-OTHER-CART`,
    },
    body: checkoutPayload,
  });
  assert.strictEqual(otherCartOrderAccess.status, 404);

  await Cart.updateOne(
    { _id: checkoutCart._id },
    { $set: { accessIssuedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } }
  );
  const expiredOrderAccess = await requestJson(baseUrl, '/api/orders', {
    method: 'POST',
    headers: {
      ...cartAccessHeaders(checkoutAccess),
      'Idempotency-Key': `${PREFIX}-EXPIRED`,
    },
    body: checkoutPayload,
  });
  assert.strictEqual(expiredOrderAccess.status, 404);
  await Cart.updateOne(
    { _id: checkoutCart._id },
    { $set: { accessIssuedAt: new Date() } }
  );
  assert.strictEqual(await Order.countDocuments({}), 0);
  assert.strictEqual(await InventoryReservation.countDocuments({}), 0);
  ok('POST /api/orders rechaza credenciales ausentes, alteradas, vencidas o de otro carrito');

  const created = await requestJson(
    baseUrl,
    '/api/orders',
    {
      method: 'POST',
      headers: {
        ...cartAccessHeaders(checkoutAccess),
        'Idempotency-Key': idempotencyKey,
      },
      body: checkoutPayload,
    }
  );
  assert.strictEqual(created.status, 201, JSON.stringify(created.data));
  assert.strictEqual(created.data.paymentAccess?.orderId, String(created.data._id));
  assert.strictEqual(created.data.paymentAccess?.sessionId, checkoutAccess.sessionId);
  assert.ok(created.data.paymentAccess?.token);
  assert.strictEqual(created.data.total, UNIT_PRICE * 3);
  assert.strictEqual(created.data.subtotal, UNIT_PRICE * 3);
  const completedCheckoutKey = await IdempotencyKey.findOne({
    key: idempotencyKey,
    endpoint: 'POST /orders',
  }).lean();
  assert.strictEqual(completedCheckoutKey?.status, 'completed');
  assert.strictEqual(
    String(completedCheckoutKey?.orderId || ''),
    String(created.data._id)
  );
  ok('Checkout crea la orden con precio autoritativo del servidor');

  const reusedForAnotherOrder = await requestJson(baseUrl, '/api/orders', {
    method: 'POST',
    headers: {
      ...cartAccessHeaders(checkoutAccess),
      'Idempotency-Key': `${PREFIX}-SECOND-ORDER`,
    },
    body: checkoutPayload,
  });
  assert.strictEqual(reusedForAnotherOrder.status, 404);
  assert.strictEqual(await Order.countDocuments({}), 1);
  ok('La credencial consumida no crea una segunda orden');

  const repeatedCheckout = await requestJson(
    baseUrl,
    '/api/orders',
    {
      method: 'POST',
      headers: {
        ...cartAccessHeaders(checkoutAccess),
        'Idempotency-Key': idempotencyKey,
      },
      body: checkoutPayload,
    }
  );
  assert.strictEqual(
    repeatedCheckout.status,
    200,
    JSON.stringify(repeatedCheckout.data)
  );
  assert.strictEqual(
    String(repeatedCheckout.data._id),
    String(created.data._id)
  );
  assert.strictEqual(
    await Order.countDocuments({
      sessionId: checkoutPayload.sessionId,
    }),
    1
  );
  ok('Reintentar checkout reutiliza la misma orden');

  let order = await Order.findById(created.data._id).lean();
  assert.strictEqual(
    order.inventoryAllocationSummary.branchCount,
    2
  );
  assert.strictEqual(
    branchQuantity(order, branchA._id, 'reservedQuantity'),
    2
  );
  assert.strictEqual(
    branchQuantity(order, branchB._id, 'reservedQuantity'),
    1
  );
  assert.strictEqual(
    await InventoryReservation.countDocuments({
      order: order._id,
    }),
    1
  );
  ok('La orden reserva dos sedes y una sola reserva');

  installWompiFetchStub();
  const paymentAccess = created.data.paymentAccess;
  const alteredPaymentAccess = {
    ...paymentAccess,
    token: alterCredential(paymentAccess.token),
  };
  const expiredPaymentToken = createGuestOrderAccessToken({
    orderId: order._id,
    sessionId: checkoutAccess.sessionId,
    secret: process.env.ORDER_PAYMENT_ACCESS_SECRET,
    now: Date.now() - 2 * 24 * 60 * 60 * 1000,
    ttlMs: 60_000,
  });
  const otherOrderPaymentToken = createGuestOrderAccessToken({
    orderId: new mongoose.Types.ObjectId(),
    sessionId: checkoutAccess.sessionId,
    secret: process.env.ORDER_PAYMENT_ACCESS_SECRET,
  });

  for (const deniedHeaders of [
    {},
    paymentAccessHeaders(alteredPaymentAccess),
    paymentAccessHeaders({ ...paymentAccess, token: expiredPaymentToken }),
    paymentAccessHeaders({ ...paymentAccess, token: otherOrderPaymentToken }),
  ]) {
    const denied = await requestJson(
      baseUrl,
      '/api/payments/wompi/checkout-data',
      {
        method: 'POST',
        headers: deniedHeaders,
        body: { orderId: String(order._id) },
      }
    );
    assert.strictEqual(denied.status, 404, JSON.stringify(denied.data));
  }
  assert.strictEqual(wompiFetchCalls, 0);

  const checkoutData = await requestJson(
    baseUrl,
    '/api/payments/wompi/checkout-data',
    {
      method: 'POST',
      headers: paymentAccessHeaders(paymentAccess),
      body: { orderId: String(order._id) },
    }
  );
  assert.strictEqual(checkoutData.status, 200, JSON.stringify(checkoutData.data));
  assert.strictEqual(checkoutData.data.orderId, String(order._id));
  assert.strictEqual(checkoutData.data.amountInCents, Math.round(order.total * 100));
  assert.strictEqual(wompiFetchCalls, 1);
  for (const forbidden of [
    'customerEmail',
    'customerData',
    'rawTransaction',
    'privateKey',
    'integrityKey',
  ]) {
    assert.strictEqual(Object.hasOwn(checkoutData.data, forbidden), false);
  }
  ok('Checkout Wompi real exige acceso exacto antes de consultar la pasarela');

  const deniedThanks = await requestJson(
    baseUrl,
    `/api/orders/${order._id}/thanks`
  );
  assert.strictEqual(deniedThanks.status, 404);
  const otherOrderThanks = await requestJson(
    baseUrl,
    `/api/orders/${order._id}/thanks`,
    { headers: paymentAccessHeaders({ ...paymentAccess, token: otherOrderPaymentToken }) }
  );
  assert.strictEqual(otherOrderThanks.status, 404);
  const allowedThanks = await requestJson(
    baseUrl,
    `/api/orders/${order._id}/thanks`,
    { headers: paymentAccessHeaders(paymentAccess) }
  );
  assert.strictEqual(allowedThanks.status, 200, JSON.stringify(allowedThanks.data));
  assert.strictEqual(allowedThanks.data.orderId, String(order._id));
  assert.strictEqual(Object.hasOwn(allowedThanks.data, 'customerEmail'), false);
  assert.strictEqual(Object.hasOwn(allowedThanks.data, 'customerPhone'), false);
  assert.strictEqual(Object.hasOwn(allowedThanks.data, 'customerAddress'), false);
  ok('Gracias consulta solo el resumen minimo de la orden autorizada');

  const validLookupId = `${PREFIX}-STATUS`;
  const wrongLookupId = `${PREFIX}-OTHER-TX`;
  const wrongAmountLookupId = `${PREFIX}-WRONG-AMOUNT`;
  wompiTransactions.set(validLookupId, {
    id: validLookupId,
    status: 'PENDING',
    reference: `ORDER-${order.orderNumber}__TRY__${PREFIX}`,
    amount_in_cents: Math.round(order.total * 100),
    currency: 'COP',
    customer_email: 'no-debe-salir@example.com',
    raw_secret: 'no-debe-salir',
  });
  wompiTransactions.set(wrongLookupId, {
    id: wrongLookupId,
    status: 'APPROVED',
    reference: `ORDER-OTRA-ORDEN__TRY__${PREFIX}`,
    amount_in_cents: Math.round(order.total * 100),
    currency: 'COP',
    customer_email: 'otro@example.com',
  });
  wompiTransactions.set(wrongAmountLookupId, {
    id: wrongAmountLookupId,
    status: 'APPROVED',
    reference: `ORDER-${order.orderNumber}__TRY__${PREFIX}`,
    amount_in_cents: Math.round(order.total * 100) - 1,
    currency: 'COP',
  });

  for (const deniedHeaders of [
    {},
    paymentAccessHeaders(alteredPaymentAccess),
    paymentAccessHeaders({ ...paymentAccess, token: expiredPaymentToken }),
    paymentAccessHeaders({ ...paymentAccess, token: otherOrderPaymentToken }),
  ]) {
    const denied = await requestJson(
      baseUrl,
      `/api/payments/wompi/transaction/${validLookupId}`,
      { headers: deniedHeaders }
    );
    assert.strictEqual(denied.status, 404, JSON.stringify(denied.data));
  }
  assert.strictEqual(wompiFetchCalls, 1);

  const wrongTransaction = await requestJson(
    baseUrl,
    `/api/payments/wompi/transaction/${wrongLookupId}`,
    { headers: paymentAccessHeaders(paymentAccess) }
  );
  assert.strictEqual(wrongTransaction.status, 404);
  assert.strictEqual(wompiFetchCalls, 2);

  const wrongAmountTransaction = await requestJson(
    baseUrl,
    `/api/payments/wompi/transaction/${wrongAmountLookupId}`,
    { headers: paymentAccessHeaders(paymentAccess) }
  );
  assert.strictEqual(wrongAmountTransaction.status, 404);
  assert.strictEqual(wompiFetchCalls, 3);

  const transactionStatus = await requestJson(
    baseUrl,
    `/api/payments/wompi/transaction/${validLookupId}`,
    { headers: paymentAccessHeaders(paymentAccess) }
  );
  assert.strictEqual(transactionStatus.status, 200, JSON.stringify(transactionStatus.data));
  assert.strictEqual(transactionStatus.data.transactionId, validLookupId);
  assert.strictEqual(transactionStatus.data.orderId, String(order._id));
  assert.strictEqual(wompiFetchCalls, 4);
  for (const forbidden of [
    'customerEmail',
    'rawTransaction',
    'paymentMethodType',
    'reference',
  ]) {
    assert.strictEqual(Object.hasOwn(transactionStatus.data, forbidden), false);
  }
  ok('Estado Wompi valida orden y transaccion y devuelve una respuesta minima');

  const badPaymentPayload = buildWompiPayload({
    orderNumber: order.orderNumber,
    total: order.total - 0.01,
    transactionId: `${PREFIX}-BAD-AMOUNT`,
  });
  const badPayment = await requestJson(
    baseUrl,
    '/api/payments/wompi/webhook',
    {
      method: 'POST',
      headers: {
        'X-Event-Checksum':
          badPaymentPayload.signature.checksum,
      },
      body: badPaymentPayload,
    }
  );
  assert.strictEqual(badPayment.status, 409);
  assert.strictEqual(
    badPayment.data.error,
    'WOMPI_AMOUNT_MISMATCH'
  );
  order = await Order.findById(order._id).lean();
  assert.strictEqual(order.status, 'pending');
  ok('Wompi no puede aprobar un valor distinto al total');

  const approvedPayload = buildWompiPayload({
    orderNumber: order.orderNumber,
    total: order.total,
    transactionId: `${PREFIX}-APPROVED`,
  });
  const approved = await requestJson(
    baseUrl,
    '/api/payments/wompi/webhook',
    {
      method: 'POST',
      headers: {
        'X-Event-Checksum':
          approvedPayload.signature.checksum,
      },
      body: approvedPayload,
    }
  );
  assert.strictEqual(approved.status, 200, JSON.stringify(approved.data));
  assert.strictEqual(approved.data.orderStatus, 'paid');
  assert.strictEqual(approved.data.paymentStatus, 'paid');

  order = await waitFor(
    async () => {
      const current = await Order.findById(order._id).lean();
      return current?.fulfillment?.processedAt ? current : null;
    },
    'El proceso posterior al pago no terminó.'
  );
  const reservation = await InventoryReservation.findOne({
    order: order._id,
  }).lean();
  assert.strictEqual(reservation.status, 'confirmed');
  assert.strictEqual(
    order.payment.transactionId,
    `${PREFIX}-APPROVED`
  );
  ok('Webhook firmado confirma pago, reserva y cumplimiento');

  assert.deepStrictEqual(
    await stockState(product._id, branchA._id),
    { stock: 0, reserved: 0, available: 0 }
  );
  assert.deepStrictEqual(
    await stockState(product._id, branchB._id),
    { stock: 1, reserved: 0, available: 1 }
  );
  assert.strictEqual(
    order.inventoryAllocationSummary.soldQuantity,
    3
  );
  ok('El pago descuenta 2 + 1 en las sedes correctas');

  let saleMovements = await InventoryMovement.find({
    order: order._id,
    type: 'sale_out',
    status: 'posted',
  }).lean();
  assert.strictEqual(saleMovements.length, 2);
  assert.deepStrictEqual(
    saleMovements
      .map((movement) => Number(movement.quantity))
      .sort((a, b) => a - b),
    [1, 2]
  );
  ok('El kardex registra una salida independiente por sede');

  const repeatedPayment = await requestJson(
    baseUrl,
    '/api/payments/wompi/webhook',
    {
      method: 'POST',
      headers: {
        'X-Event-Checksum':
          approvedPayload.signature.checksum,
      },
      body: approvedPayload,
    }
  );
  assert.strictEqual(
    repeatedPayment.status,
    200,
    JSON.stringify(repeatedPayment.data)
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  saleMovements = await InventoryMovement.find({
    order: order._id,
    type: 'sale_out',
    status: 'posted',
  }).lean();
  assert.strictEqual(saleMovements.length, 2);
  assert.deepStrictEqual(
    await stockState(product._id, branchB._id),
    { stock: 1, reserved: 0, available: 1 }
  );
  ok('Repetir el webhook no duplica salidas ni descuentos');

  await transitionOrderStatus({
    orderId: order._id,
    status: 'shipped',
    actor: {
      label: 'ci-products',
      source: 'complete_sale',
    },
  });
  order = await Order.findById(order._id).lean();
  assert.strictEqual(order.status, 'shipped');
  assert.strictEqual(
    order.inventoryAllocationSummary.shippedQuantity,
    3
  );
  ok('El despacho conserva las cantidades de cada sede');

  await transitionOrderStatus({
    orderId: order._id,
    status: 'delivered',
    actor: {
      label: 'ci-products',
      source: 'complete_sale',
    },
  });
  order = await Order.findById(order._id).lean();
  assert.strictEqual(order.status, 'delivered');
  assert.strictEqual(
    order.inventoryAllocationSummary.deliveredQuantity,
    3
  );
  ok('La entrega cierra las tres unidades');

  const refundInput = {
    orderId: order._id,
    amount: order.total,
    reason: 'Devolución integral de prueba',
    items: [
      {
        orderItemId: String(order.items[0]._id),
        quantity: 3,
        restock: true,
      },
    ],
    idempotencyKey: `${PREFIX}-REFUND`,
    adminLabel: 'ci-products',
  };
  const refund = await processOrderRefund(refundInput);
  assert.strictEqual(refund.idempotent, false);
  order = await Order.findById(order._id).lean();
  assert.strictEqual(
    order.inventoryAllocationSummary.returnedQuantity,
    3
  );
  assert.strictEqual(
    branchQuantity(order, branchA._id, 'returnedQuantity'),
    2
  );
  assert.strictEqual(
    branchQuantity(order, branchB._id, 'returnedQuantity'),
    1
  );
  ok('La devolución repone cada unidad en su sede de origen');

  const repeatedRefund = await processOrderRefund(refundInput);
  assert.strictEqual(repeatedRefund.idempotent, true);
  assert.strictEqual(
    await OrderRefund.countDocuments({
      order: order._id,
      status: 'processed',
    }),
    1
  );
  assert.strictEqual(
    await InventoryMovement.countDocuments({
      order: order._id,
      type: 'return_in',
      status: 'posted',
    }),
    2
  );
  ok('Repetir el reembolso no duplica dinero ni devoluciones');

  assert.deepStrictEqual(
    await stockState(product._id, branchA._id),
    { stock: 2, reserved: 0, available: 2 }
  );
  assert.deepStrictEqual(
    await stockState(product._id, branchB._id),
    { stock: 2, reserved: 0, available: 2 }
  );
  const finalProduct = await Product.findById(product._id).lean();
  assert.strictEqual(Number(finalProduct.stock || 0), 4);
  ok('El inventario final reconcilia producto, sedes y kardex');

  console.log(
    `\nVenta integral completa: ${passed}/20 verificaciones aprobadas.`
  );
}

run()
  .catch((error) => {
    console.error(
      '\nFALLO venta integral completa:',
      error
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    global.fetch = nativeFetch;
    if (server) {
      await new Promise((resolve) =>
        server.close(() => resolve())
      );
    }

    if (mongoose.connection.readyState === 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });
