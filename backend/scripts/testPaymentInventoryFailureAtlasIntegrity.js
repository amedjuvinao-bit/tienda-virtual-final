'use strict';

const assert = require('assert/strict');
const crypto = require('crypto');
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

const envFile = process.env.PAYMENT_INVENTORY_ATLAS_ENV_FILE ||
  path.resolve(__dirname, '..', '.env');
require('dotenv').config({ path: envFile, quiet: true });

process.env.NODE_ENV = 'test';
process.env.DIGITAL_DELIVERY_TOKEN_SECRET =
  process.env.DIGITAL_DELIVERY_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
process.env.PUBLIC_BACKEND_URL = process.env.PUBLIC_BACKEND_URL || 'https://backend.example';
process.env.CART_ACCESS_SECRET =
  process.env.CART_ACCESS_SECRET || crypto.randomBytes(32).toString('hex');
process.env.ORDER_PAYMENT_ACCESS_SECRET =
  process.env.ORDER_PAYMENT_ACCESS_SECRET || crypto.randomBytes(32).toString('hex');

const Branch = require('../models/Branch');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const InventoryStock = require('../models/InventoryStock');
const InventoryReservation = require('../models/InventoryReservation');
const InventoryMovement = require('../models/InventoryMovement');
const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const IdempotencyKey = require('../models/IdempotencyKey');
const Counter = require('../models/Counter');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const SiteSettings = require('../models/SiteSettings');
const {
  applyReservationToOrderDocument,
} = require('../services/orderInventoryAllocationService');
const {
  buildPaymentFailureReleaseReason,
  confirmInventoryReservation,
  reconcilePaymentFailureReservation,
  releaseInventoryReservation,
} = require('../services/inventoryReservationService');
const {
  createPaymentInventoryFailureService,
  getLegacyCompensationPlan,
  isRetryablePaymentInventoryError,
  restoreLegacyAllocation,
  runPaymentInventoryTransaction,
} = require('../services/paymentInventoryFailureService');
const {
  createWompiWebhookIntegrityService,
  getCanonicalPaymentApprovalEvidence,
  isApprovedPayment,
  resolveMonotonicWompiTransition,
} = require('../services/wompiWebhookIntegrityService');
const {
  isBillableOrder,
} = require('../services/electronicInvoiceIssuanceService');
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

const RUN_ID = `AUDIT_PAYMENT_TX_REAL_20260812_${crypto.randomBytes(8).toString('hex')}`;
let WEBHOOK_SECRET = crypto.randomBytes(24).toString('hex');
const AMOUNT = 100;
const AMOUNT_IN_CENTS = AMOUNT * 100;
const INTEGRAL_UNIT_PRICE = 100000;
const INTEGRAL_VARIANT_ATTRIBUTES = Object.freeze([
  { key: 'capacidad', label: 'Capacidad', value: '256GB' },
  { key: 'ram', label: 'RAM', value: '12GB' },
  { key: 'color', label: 'Color', value: 'Azul' },
  { key: 'conectividad', label: 'Conectividad', value: '5G' },
]);
const INTEGRAL_VARIANT_KEY = buildVariantKey('', 'Azul', INTEGRAL_VARIANT_ATTRIBUTES);
const trackedIds = new Map();
const initialCounts = new Map();
const finalCounts = new Map();
const cleanupCounts = new Map();
const managedExistingDocuments = [];
let controlCount = 0;
let conflictEvidence = null;
let retryEvidence = null;
let server = null;
let integralFixture = null;
let wompiFetchCalls = 0;
let connectedDatabaseName = '';
const wompiTransactions = new Map();
const nativeFetch = global.fetch;

function connectionUri() {
  const uri = String(process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
  if (!uri) throw new Error('ATLAS_URI_MISSING');
  if (/localhost|127\.0\.0\.1/i.test(uri)) throw new Error('ATLAS_URI_IS_NOT_REMOTE');
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) throw new Error('ATLAS_URI_INVALID');
  return uri;
}

function remember(collectionName, id) {
  if (!id) return;
  const key = String(collectionName);
  if (!trackedIds.has(key)) trackedIds.set(key, new Set());
  trackedIds.get(key).add(String(id));
}

async function rememberDocument(model, document) {
  remember(model.collection.name, document?._id);
  return document;
}

async function check(name, work) {
  await work();
  controlCount += 1;
  console.log(`OK ${controlCount}/42: ${name}`);
}

function installExternalBoundaryStub() {
  global.fetch = async (input, options) => {
    const url = String(input?.url || input || '');
    if (/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//i.test(url)) {
      return nativeFetch(input, options);
    }
    if (url.includes('.wompi.co/v1/merchants/')) {
      wompiFetchCalls += 1;
      return new Response(JSON.stringify({
        data: {
          presigned_acceptance: {
            acceptance_token: `${RUN_ID}_acceptance`,
            permalink: 'https://wompi.example/acceptance',
          },
          presigned_personal_data_auth: {
            acceptance_token: `${RUN_ID}_personal_data`,
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
        transaction ? { data: transaction } : { error: { reason: 'not found' } }
      ), {
        status: transaction ? 200 : 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw Object.assign(new Error('EXTERNAL_NETWORK_BLOCKED'), {
      code: 'EXTERNAL_NETWORK_BLOCKED',
    });
  };
}

async function requestJson(baseUrl, routePath, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${routePath}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: response.status, ok: response.ok, data };
}

async function waitFor(work, message, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await work();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
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
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

function alterCredential(value) {
  const safe = String(value || '');
  const last = safe.slice(-1);
  return `${safe.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`;
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

function integralBranchQuantity(order, branchId, field) {
  return (order.inventoryAllocations || [])
    .filter((allocation) => String(allocation.branch) === String(branchId))
    .reduce((sum, allocation) => sum + Number(allocation?.[field] || 0), 0);
}

async function integralStockState(productId, branchId) {
  const row = await InventoryStock.findOne({
    product: productId,
    branch: branchId,
    variantKey: INTEGRAL_VARIANT_KEY,
    deletedAt: null,
  }).lean();
  return {
    stock: Number(row?.stock || 0),
    reserved: Number(row?.reservedStock || 0),
    available: Number(row?.availableStock || 0),
  };
}

async function rememberQuery(model, filter) {
  const rows = await model.find(filter).select({ _id: 1 }).lean();
  for (const row of rows) remember(model.collection.name, row._id);
  return rows;
}

function assertNoSensitiveFields(value) {
  const forbidden = new Set([
    'customerEmail',
    'customerPhone',
    'customerAddress',
    'customerData',
    'rawTransaction',
    'privateKey',
    'integrityKey',
    'webhookSecret',
    'inventoryControl',
    'inventoryAllocations',
    'accessTokenHash',
  ]);
  const visit = (current) => {
    if (!current || typeof current !== 'object') return;
    for (const [key, child] of Object.entries(current)) {
      assert.equal(forbidden.has(key), false, `SENSITIVE_PUBLIC_FIELD:${key}`);
      visit(child);
    }
  };
  visit(value);
}

function orderNumber(label) {
  return `ATX_${RUN_ID.slice(-12)}_${label}`.slice(0, 40);
}

function canonicalReference(number, attempt = '1') {
  return `ORDER-${number}__TRY__${attempt}`;
}

function approvedTransaction(number, attempt = 'approved') {
  return {
    id: `${RUN_ID}_${attempt}`.slice(0, 118),
    reference: canonicalReference(number, attempt),
    status: 'APPROVED',
    amount_in_cents: AMOUNT_IN_CENTS,
    currency: 'COP',
    finalized_at: new Date().toISOString(),
    payment_method_type: 'CARD',
    payment_method: { type: 'CARD' },
  };
}

async function createIntegralCatalog() {
  const suffix = crypto.randomBytes(5).toString('hex');
  const product = new Product({
    sku: `${RUN_ID}-PHONE`,
    slug: `integral-${RUN_ID.toLowerCase()}`.slice(0, 160),
    title: `${RUN_ID} Telefono`,
    description: 'Producto aislado para validar el ciclo integral.',
    category: `${RUN_ID} Pruebas`,
    categories: [`${RUN_ID} Pruebas`],
    productType: 'physical',
    unitOfMeasure: 'unit',
    trackInventory: true,
    allowBackorder: false,
    variantPreset: 'generic',
    variantAxes: [
      { key: 'capacidad', label: 'Capacidad', values: ['256GB'] },
      { key: 'ram', label: 'RAM', values: ['12GB'] },
      { key: 'color', label: 'Color', values: ['Azul'] },
      { key: 'conectividad', label: 'Conectividad', values: ['5G'] },
    ],
    price: INTEGRAL_UNIT_PRICE,
    cost: 60000,
    averageCost: 60000,
    variants: [{
      variantKey: INTEGRAL_VARIANT_KEY,
      label: '256GB / 12GB / Azul / 5G',
      attributes: INTEGRAL_VARIANT_ATTRIBUTES,
      color: 'Azul',
      sku: `${RUN_ID}-PHONE-256-12-AZ-5G`,
      price: INTEGRAL_UNIT_PRICE,
      cost: 60000,
      initialStock: 4,
      active: true,
    }],
    stock: 4,
    active: true,
    visible: true,
  });
  const savedProduct = await saveProductWithInventoryTransaction(product, {
    variantsAuthoritative: true,
  });
  remember(Product.collection.name, savedProduct._id);
  const initialStock = await InventoryStock.findOne({
    product: savedProduct._id,
    variantKey: INTEGRAL_VARIANT_KEY,
    deletedAt: null,
  }).lean();
  assert.ok(initialStock, 'INTEGRAL_INITIAL_STOCK_NOT_PERSISTED');
  assert.equal(Number(initialStock.stock), 4);
  assert.equal(Number(initialStock.availableStock), 4);
  assert.equal(Number(initialStock.reservedStock), 0);
  assert.ok(initialStock.branch, 'INTEGRAL_INITIAL_STOCK_BRANCH_MISSING');
  remember(InventoryStock.collection.name, initialStock._id);

  const branchFrom = await Branch.findById(initialStock.branch).lean();
  assert.ok(branchFrom, 'INTEGRAL_INITIAL_STOCK_BRANCH_NOT_FOUND');
  const branchTo = await Branch.create({
    name: `${RUN_ID} Bodega`,
    code: `IB${suffix}`.slice(0, 30),
    type: 'warehouse',
    status: 'active',
    active: true,
  });
  remember(Branch.collection.name, branchTo._id);
  assert.notEqual(String(branchFrom._id), String(branchTo._id));

  await rememberQuery(InventoryMovement, { product: savedProduct._id });

  const createdTransferMovement = await createInventoryMovement({
    type: 'transfer',
    product: savedProduct._id,
    variantKey: INTEGRAL_VARIANT_KEY,
    variantAttributes: INTEGRAL_VARIANT_ATTRIBUTES,
    color: 'Azul',
    branchFrom: branchFrom._id,
    branchTo: branchTo._id,
    quantity: 2,
    reason: 'Distribucion aislada para venta integral',
    reference: RUN_ID,
  });
  assert.ok(createdTransferMovement?._id, 'INTEGRAL_TRANSFER_ID_MISSING');
  remember(InventoryMovement.collection.name, createdTransferMovement._id);
  await rememberQuery(InventoryStock, { product: savedProduct._id });
  await rememberQuery(InventoryMovement, { product: savedProduct._id });
  assert.deepEqual(
    await integralStockState(savedProduct._id, branchFrom._id),
    { stock: 2, reserved: 0, available: 2 }
  );
  assert.deepEqual(
    await integralStockState(savedProduct._id, branchTo._id),
    { stock: 2, reserved: 0, available: 2 }
  );
  const persistedProduct = await Product.findById(savedProduct._id).lean();
  assert.equal(Number(persistedProduct.stock), 4);
  const transferMovement = await InventoryMovement.findById(
    createdTransferMovement._id
  ).lean();
  assert.ok(transferMovement, 'INTEGRAL_TRANSFER_NOT_PERSISTED');
  assert.equal(transferMovement.type, 'transfer');
  assert.equal(transferMovement.status, 'posted');
  assert.equal(transferMovement.reference, RUN_ID.toUpperCase());
  assert.equal(String(transferMovement.branchFrom), String(branchFrom._id));
  assert.equal(String(transferMovement.branchTo), String(branchTo._id));
  assert.equal(Number(transferMovement.quantity), 2);
  assert.equal(String(transferMovement.product), String(savedProduct._id));
  assert.equal(transferMovement.variantKey, INTEGRAL_VARIANT_KEY);
  return { branchFrom, branchTo, product: savedProduct };
}

function buildIntegralCheckoutPayload(product, sessionId, branchFromId) {
  return {
    sessionId,
    branchId: String(branchFromId),
    cart: [{
      productId: String(product._id),
      title: 'Titulo manipulado por cliente',
      price: 1,
      quantity: 3,
      color: 'Azul',
      variantKey: INTEGRAL_VARIANT_KEY,
      variantLabel: '256GB / 12GB / Azul / 5G',
      variantAttributes: INTEGRAL_VARIANT_ATTRIBUTES,
    }],
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

async function createIntegralAuthorizedCart(product, quantity = 3) {
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
      variantId: INTEGRAL_VARIANT_KEY,
      variantKey: INTEGRAL_VARIANT_KEY,
      variantLabel: '256GB / 12GB / Azul / 5G',
      variantAttributes: INTEGRAL_VARIANT_ATTRIBUTES,
      title: 'Titulo manipulado por cliente',
    }],
    lastCustomerActivityAt: new Date(),
  });
  remember(Cart.collection.name, cart._id);
  return { cart, access };
}

function buildIntegralWompiPayload({ orderNumber: number, total, transactionId }) {
  const payload = {
    event: 'transaction.updated',
    timestamp: Date.now(),
    data: {
      transaction: {
        id: transactionId,
        status: 'APPROVED',
        reference: `ORDER-${number}__TRY__${RUN_ID}`,
        amount_in_cents: Math.round(Number(total || 0) * 100),
        currency: 'COP',
        payment_method_type: 'CARD',
        payment_method: { type: 'CARD' },
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
  payload.signature.checksum = signPayload(payload);
  return payload;
}

async function createFixture(label, { reservedStock = 1, status = 'pending' } = {}) {
  const suffix = crypto.randomBytes(5).toString('hex');
  const number = orderNumber(`${label}_${suffix}`);
  const reference = canonicalReference(number, 'failed');
  const failedTransactionId = `${RUN_ID}_${label}_failed_${suffix}`.slice(0, 118);
  const branch = await rememberDocument(
    Branch,
    await Branch.create({
      name: `${RUN_ID} ${label}`,
      code: `AT${suffix}`.slice(0, 30),
      type: 'warehouse',
      status: 'active',
      active: true,
    })
  );
  const product = await rememberDocument(
    Product,
    await Product.create({
      sku: `SKU-${RUN_ID}-${suffix}`,
      slug: `audit-${suffix}`,
      title: `${RUN_ID} ${label}`,
      price: AMOUNT,
      productType: 'physical',
      stock: 10,
      active: true,
      visible: false,
    })
  );
  const stock = await rememberDocument(
    InventoryStock,
    await InventoryStock.create({
      branch: branch._id,
      branchSnapshot: { name: branch.name, code: branch.code, type: branch.type },
      product: product._id,
      productSnapshot: { title: product.title, sku: product.sku },
      variant: { size: 'M', color: '#000000', label: 'M / Negro' },
      variantKey: 'm__#000000',
      stock: 10,
      reservedStock,
      availableStock: 10 - reservedStock,
      active: true,
      deletedAt: null,
    })
  );

  const orderId = new mongoose.Types.ObjectId();
  const reservationId = new mongoose.Types.ObjectId();
  const reservationItemId = new mongoose.Types.ObjectId();
  const orderItemId = new mongoose.Types.ObjectId();
  const allocationId = new mongoose.Types.ObjectId();
  const order = new Order({
    _id: orderId,
    sessionId: `${RUN_ID}_${label}`,
    orderNumber: number,
    status,
    branch: branch._id,
    source: 'online',
    channel: 'web',
    saleType: 'online_order',
    items: [{
      _id: orderItemId,
      product: product._id,
      productId: String(product._id),
      title: product.title,
      qty: 1,
      quantity: 1,
      price: AMOUNT,
      unitPrice: AMOUNT,
      variantKey: 'm__#000000',
      size: 'M',
      color: '#000000',
    }],
    subtotal: AMOUNT,
    shipping: 0,
    total: AMOUNT,
    payment: {
      active: true,
      provider: 'wompi',
      providerLabel: 'Wompi',
      mode: 'sandbox',
      currency: 'COP',
      enableWebhook: true,
      status: 'pending_gateway',
      reference,
      transactionId: failedTransactionId,
      amountInCents: AMOUNT_IN_CENTS,
      amount: AMOUNT,
    },
    inventoryControl: {
      reservationRequired: true,
      reservationId,
      discountedAtCheckout: true,
      restockedOnFailure: false,
      restockedAt: null,
    },
    inventoryAllocations: [{
      _id: allocationId,
      reservation: reservationId,
      reservationItem: reservationItemId,
      orderItem: orderItemId,
      inventoryStock: stock._id,
      branch: branch._id,
      branchSnapshot: { name: branch.name, code: branch.code, type: branch.type },
      product: product._id,
      productSnapshot: { title: product.title, sku: product.sku },
      size: 'M',
      color: '#000000',
      variantKey: 'm__#000000',
      quantity: 1,
      reservedQuantity: 1,
      soldQuantity: 0,
      releasedQuantity: 0,
      returnedQuantity: 0,
      status: 'reserved',
      reservedAt: new Date(),
    }],
    inventoryAllocationSummary: {
      totalQuantity: 1,
      soldQuantity: 0,
      activeReservedQuantity: 1,
    },
  });
  await order.save();
  remember(Order.collection.name, order._id);

  const reservation = new InventoryReservation({
    _id: reservationId,
    reservationCode: `RSV-${RUN_ID}-${suffix}`,
    sessionId: `${RUN_ID}_${label}`,
    order: order._id,
    orderNumber: number,
    paymentReference: reference,
    paymentTransactionId: failedTransactionId,
    source: 'checkout',
    status: 'pending',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    currency: 'COP',
    items: [{
      _id: reservationItemId,
      product: product._id,
      inventoryStock: stock._id,
      branch: branch._id,
      orderItem: orderItemId,
      productSnapshot: { title: product.title, sku: product.sku },
      branchSnapshot: { name: branch.name, code: branch.code, type: branch.type },
      size: 'M',
      color: '#000000',
      variantKey: 'm__#000000',
      quantity: 1,
      unitPrice: AMOUNT,
      stockBeforeReservation: 10,
      reservedBeforeReservation: 0,
      availableBeforeReservation: 10,
    }],
  });
  await reservation.save();
  remember(InventoryReservation.collection.name, reservation._id);

  return {
    number,
    reference,
    failedTransactionId,
    orderId: order._id,
    reservationId: reservation._id,
    stockId: stock._id,
    productId: product._id,
    branchId: branch._id,
  };
}

async function createLegacyFixture(label) {
  const fixture = await createFixture(label, { reservedStock: 0, status: 'failed' });
  await InventoryReservation.deleteOne({ _id: fixture.reservationId });
  trackedIds.get(InventoryReservation.collection.name)?.delete(String(fixture.reservationId));
  const order = await Order.findById(fixture.orderId);
  order.inventoryControl.reservationId = null;
  order.inventoryControl.discountedAtCheckout = true;
  order.inventoryControl.restockedOnFailure = false;
  order.inventoryAllocations[0].reservation = null;
  order.inventoryAllocations[0].reservationItem = null;
  order.inventoryAllocations[0].reservedQuantity = 0;
  order.inventoryAllocations[0].soldQuantity = 1;
  order.inventoryAllocations[0].status = 'sold';
  order.inventoryAllocationSummary = {
    totalQuantity: 1,
    soldQuantity: 1,
    activeReservedQuantity: 0,
  };
  order.payment.status = 'failed';
  await order.save();
  return fixture;
}

const paymentFailureService = createPaymentInventoryFailureService({
  releaseReservation: releaseInventoryReservation,
  applyReservation: applyReservationToOrderDocument,
  reconcileReservation: reconcilePaymentFailureReservation,
  isApprovedPayment,
  buildReleaseReason: buildPaymentFailureReleaseReason,
});

async function withOrderTransaction(number, work) {
  return runPaymentInventoryTransaction({
    startSession: () => mongoose.startSession(),
    work: async (session, meta) => {
      const order = await Order.findOne({ orderNumber: number }).session(session);
      if (!order) throw new Error(`ORDER_NOT_FOUND_${number}`);
      const result = await work(order, { session, ...meta });
      await order.save({ session });
      return result;
    },
  });
}

async function startSessionWithoutAutomaticRetry() {
  const session = await mongoose.startSession();
  session.withTransaction = async (work) => {
    session.startTransaction();
    try {
      const result = await work();
      await session.commitTransaction();
      return result;
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      throw error;
    }
  };
  return session;
}

const approvalService = createWompiWebhookIntegrityService({
  withOrderTransaction,
  confirmInventoryReservation,
  applyReservationToOrderDocument,
  reconcileFailureRecovery: (payload) => paymentFailureService.reconcileApproved(payload),
  createOrderEvent: async () => null,
  scheduleInvoiceOnce: async () => ({ scheduled: true }),
});

async function processFailure(fixture, status = 'failed', transactionId = null) {
  const tx = transactionId || fixture.failedTransactionId;
  return runPaymentInventoryTransaction({
    startSession: () => mongoose.startSession(),
    work: async (session) => {
      const order = await Order.findById(fixture.orderId).session(session);
      const context = {
        orderId: order._id,
        provider: 'wompi',
        paymentReference: fixture.reference,
        paymentTransactionId: tx,
      };
      const transition = resolveMonotonicWompiTransition(
        order,
        { paymentStatus: status, orderStatus: status },
        context
      );
      if (transition.ignored) return transition;
      const recovery = await paymentFailureService.process({
        order,
        paymentStatus: status,
        provider: 'wompi',
        paymentReference: fixture.reference,
        paymentTransactionId: tx,
        session,
        approvalContext: context,
      });
      order.status = status;
      order.payment.status = status;
      order.payment.provider = 'wompi';
      order.payment.reference = fixture.reference;
      order.payment.transactionId = tx;
      await order.save({ session });
      return recovery;
    },
  });
}

async function processApproved(fixture, attempt = 'approved') {
  const transaction = approvedTransaction(fixture.number, attempt);
  return approvalService.processApproved({
    orderNumber: fixture.number,
    transaction,
    payments: { mode: 'sandbox', currency: 'COP' },
    reference: transaction.reference,
    verified: true,
  });
}

async function persisted(fixture) {
  return {
    order: await Order.findById(fixture.orderId).lean(),
    reservation: fixture.reservationId
      ? await InventoryReservation.findById(fixture.reservationId).lean()
      : null,
    stock: await InventoryStock.findById(fixture.stockId).lean(),
    movements: await InventoryMovement.find({ order: fixture.orderId }).lean(),
    invoices: await ElectronicInvoice.find({ orderId: fixture.orderId }).lean(),
  };
}

async function assertPaidAndCoherent(fixture) {
  const state = await persisted(fixture);
  assert.equal(state.order.payment.status, 'paid');
  assert.ok(state.order.payment.paidAt);
  assert.equal(state.order.status, 'paid');
  assert.equal(state.reservation.status, 'confirmed');
  assert.equal(state.stock.reservedStock, 0);
  assert.equal(state.order.inventoryControl.restockedOnFailure, false);
  return state;
}

async function createInvoice(fixture, status, suffix = '') {
  return rememberDocument(
    ElectronicInvoice,
    await ElectronicInvoice.create({
      orderId: fixture.orderId,
      orderNumber: fixture.number,
      idempotencyKey: `${RUN_ID}:${fixture.number}:${status}:${suffix || crypto.randomBytes(3).toString('hex')}`,
      required: true,
      status,
    })
  );
}

async function authorityFor(fixture, contextOverrides = {}) {
  const order = await Order.findById(fixture.orderId).lean();
  const context = {
    orderId: fixture.orderId,
    provider: 'wompi',
    paymentReference: order.payment?.reference,
    paymentTransactionId: order.payment?.transactionId,
    ...contextOverrides,
  };
  return getCanonicalPaymentApprovalEvidence(order, context);
}

function signPayload(payload) {
  const values = payload.signature.properties
    .map((property) => property.split('.').reduce((row, key) => row?.[key], payload.data))
    .map((value) => value == null ? '' : String(value))
    .join('');
  return crypto.createHash('sha256')
    .update(`${values}${payload.timestamp}${WEBHOOK_SECRET}`)
    .digest('hex');
}

function webhookEvent(fixture, providerStatus, transactionId = null) {
  const resolvedTransactionId =
    transactionId === null ? fixture.failedTransactionId : transactionId;
  const payload = {
    event: 'transaction.updated',
    timestamp: Date.now(),
    data: {
      transaction: {
        id: resolvedTransactionId,
        reference: fixture.reference,
        status: providerStatus,
        amount_in_cents: AMOUNT_IN_CENTS,
        currency: 'COP',
      },
    },
    signature: {
      properties: [
        'transaction.id',
        'transaction.status',
        'transaction.amount_in_cents',
      ],
      checksum: '',
    },
  };
  payload.signature.checksum = signPayload(payload);
  return payload;
}

let webhookHandler = null;
function getWebhookHandler() {
  if (webhookHandler) return webhookHandler;
  const router = require('../routes/payments');
  const layer = router.stack.find((entry) => entry.route?.path === '/wompi/webhook');
  if (!layer) throw new Error('WOMPI_WEBHOOK_ROUTE_NOT_MOUNTED');
  webhookHandler = layer.route.stack[layer.route.stack.length - 1].handle;
  return webhookHandler;
}

async function invokeWebhook(fixture, status, transactionId = null) {
  const payload = webhookEvent(fixture, status, transactionId);
  return invokeWebhookPayload(payload);
}

async function invokeWebhookPayload(payload) {
  const response = { statusCode: 200, body: null };
  await getWebhookHandler()(
    { body: payload, get: () => '' },
    {
      status(code) { response.statusCode = code; return this; },
      json(body) { response.body = body; return this; },
    }
  );
  return response;
}

async function createLegacyPlan(fixture) {
  const order = await Order.findById(fixture.orderId);
  const plan = getLegacyCompensationPlan(order);
  assert.equal(plan.length, 1);
  return { order, planItem: plan[0] };
}

async function countDocumentsByCollection() {
  const rows = new Map();
  const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections) {
    rows.set(name, await mongoose.connection.db.collection(name).countDocuments({}));
  }
  return rows;
}

async function recordInitialCollectionCounts() {
  const counts = await countDocumentsByCollection();
  for (const [name, count] of counts) {
    initialCounts.set(name, count);
  }
}

function trackedObjectIds(collectionName) {
  return Array.from(trackedIds.get(collectionName) || [], (id) => {
    try { return new mongoose.Types.ObjectId(id); } catch { return id; }
  });
}

async function rememberCollectionQuery(collectionName, filter) {
  const rows = await mongoose.connection.db.collection(collectionName)
    .find(filter, { projection: { _id: 1 } }).toArray();
  for (const row of rows) remember(collectionName, row._id);
}

async function collectRunOwnedIds() {
  const orderIds = trackedObjectIds(Order.collection.name);
  const productIds = trackedObjectIds(Product.collection.name);
  if (orderIds.length) {
    await rememberQuery(InventoryReservation, { order: { $in: orderIds } });
    await rememberQuery(InventoryMovement, { order: { $in: orderIds } });
    await rememberQuery(ElectronicInvoice, { orderId: { $in: orderIds } });
    await rememberQuery(OrderRefund, { order: { $in: orderIds } });
    await rememberQuery(IdempotencyKey, { orderId: { $in: orderIds } });
    await rememberCollectionQuery('order_events', { orderId: { $in: orderIds } });
  }
  if (productIds.length) {
    await rememberQuery(InventoryStock, { product: { $in: productIds } });
    await rememberQuery(InventoryMovement, { product: { $in: productIds } });
  }
  await rememberQuery(IdempotencyKey, { key: { $regex: `^${RUN_ID}` } });
}

async function cleanupExactDocuments() {
  await collectRunOwnedIds();
  const preferredOrder = [
    'order_events',
    IdempotencyKey.collection.name,
    OrderRefund.collection.name,
    ElectronicInvoice.collection.name,
    InventoryMovement.collection.name,
    InventoryReservation.collection.name,
    Order.collection.name,
    Cart.collection.name,
    InventoryStock.collection.name,
    Product.collection.name,
    Branch.collection.name,
    SiteSettings.collection.name,
    Counter.collection.name,
  ];
  const names = [
    ...preferredOrder,
    ...Array.from(trackedIds.keys()).filter((name) => !preferredOrder.includes(name)),
  ];
  for (const name of names) {
    const ids = trackedIds.get(name);
    if (!ids) continue;
    if (!ids.size) continue;
    const objectIds = Array.from(ids, (id) => {
      try { return new mongoose.Types.ObjectId(id); } catch { return id; }
    });
    const result = await mongoose.connection.db.collection(name).deleteMany({
      _id: { $in: objectIds },
    });
    cleanupCounts.set(name, result.deletedCount);
  }

  for (const [name, ids] of trackedIds) {
    const objectIds = Array.from(ids, (id) => {
      try { return new mongoose.Types.ObjectId(id); } catch { return id; }
    });
    const remaining = await mongoose.connection.db.collection(name).countDocuments({
      _id: { $in: objectIds },
    });
    assert.equal(remaining, 0, `ATLAS_TRACKED_RESIDUE:${name}`);
  }

  const counts = await countDocumentsByCollection();
  for (const [name, count] of counts) {
    finalCounts.set(name, count);
  }
}

function buildTestSiteSettingsDocument(settingsId) {
  return {
    _id: settingsId,
    publicUrl: 'https://store.example',
    theme: { global: { payments: {
      active: true,
      provider: 'wompi',
      mode: 'sandbox',
      currency: 'COP',
      enableWebhook: true,
      credentials: { wompi: {
        publicKey: `${RUN_ID}_PUBLIC`,
        privateKey: `${RUN_ID}_PRIVATE`,
        integrityKey: `${RUN_ID}_INTEGRITY`,
        webhookSecret: WEBHOOK_SECRET,
      } },
    } } },
    billing: {
      dian: { enabled: false, mode: 'internal', environment: '2' },
      electronicProvider: { provider: 'mock' },
      taxes: { iva: { enabled: false, percent: 0, code: '01', name: 'IVA' } },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function existingSiteSettingsSupportsRun(document) {
  const payments = document?.theme?.global?.payments || {};
  const wompi = payments?.credentials?.wompi || {};
  return Boolean(
    payments.active === true &&
      String(payments.provider || '').toLowerCase() === 'wompi' &&
      String(payments.currency || 'COP').toUpperCase() === 'COP' &&
      payments.enableWebhook === true &&
      wompi.publicKey &&
      wompi.privateKey &&
      wompi.integrityKey &&
      wompi.webhookSecret &&
      document?.billing?.dian?.enabled !== true
  );
}

async function prepareSiteSettingsForRun() {
  const existing = await SiteSettings.collection.findOne({});
  if (!existing) {
    const settingsId = new mongoose.Types.ObjectId();
    await SiteSettings.collection.insertOne(buildTestSiteSettingsDocument(settingsId));
    remember(SiteSettings.collection.name, settingsId);
    return;
  }

  if (existingSiteSettingsSupportsRun(existing)) {
    WEBHOOK_SECRET = String(
      existing.theme.global.payments.credentials.wompi.webhookSecret
    );
    return;
  }

  managedExistingDocuments.push({
    collectionName: SiteSettings.collection.name,
    id: existing._id,
    document: existing,
  });
  await SiteSettings.collection.replaceOne(
    { _id: existing._id },
    buildTestSiteSettingsDocument(existing._id)
  );
}

async function prepareCounterForRun(counterId, initialSequence) {
  const existing = await Counter.collection.findOne({ _id: counterId });
  if (existing) {
    managedExistingDocuments.push({
      collectionName: Counter.collection.name,
      id: existing._id,
      document: existing,
    });
    return;
  }
  await Counter.collection.insertOne({ _id: counterId, seq: initialSequence });
  remember(Counter.collection.name, counterId);
}

async function restoreManagedExistingDocuments() {
  for (const entry of [...managedExistingDocuments].reverse()) {
    await mongoose.connection.db.collection(entry.collectionName).replaceOne(
      { _id: entry.id },
      entry.document,
      { upsert: true }
    );
  }
}

async function main() {
  const uri = connectionUri();
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 20000,
    maxPoolSize: 20,
  });
  connectedDatabaseName = String(mongoose.connection.name || '');

  try {
    // El esquema Product conserva un indice parcial heredado que Atlas rechaza;
    // no se sincronizan indices ajenos. Solo se materializa el indice productivo
    // que esta suite necesita demostrar: movementNumber unico y sparse.
    await InventoryMovement.createCollection();
    await InventoryMovement.collection.createIndex(
      { movementNumber: 1 },
      { unique: true, sparse: true, name: 'movementNumber_1' }
    );
    await recordInitialCollectionCounts();

    const movementIndex = (await InventoryMovement.collection.indexes()).find(
      (index) => index.key?.movementNumber === 1
    );
    assert.equal(movementIndex?.unique, true, 'KARDEX_MOVEMENT_NUMBER_INDEX_NOT_UNIQUE');

    await prepareSiteSettingsForRun();
    await prepareCounterForRun('orderNumber', 800000);
    await prepareCounterForRun('inventoryMovementNumber', 800000);

    await check('APPROVED primero bloquea FAILED tardio', async () => {
      const fixture = await createFixture('s01');
      const approved = await processApproved(fixture, 'approved-first');
      assert.equal(
        approved.ok,
        true,
        [approved.error?.code, approved.error?.message, approved.error?.cause?.code, approved.error?.cause?.message]
          .filter(Boolean)
          .join(':') || 'APPROVAL_NOT_OK'
      );
      const paidAt = (await persisted(fixture)).order.payment.paidAt;
      const failure = await processFailure(fixture, 'failed', `${RUN_ID}_late_failed`);
      assert.equal(failure.ignored, true);
      const state = await assertPaidAndCoherent(fixture);
      assert.equal(String(state.order.payment.paidAt), String(paidAt));
    });

    await check('APPROVED primero bloquea CANCELLED tardio', async () => {
      const fixture = await createFixture('s02');
      await processApproved(fixture, 'approved-first');
      const failure = await processFailure(fixture, 'cancelled', `${RUN_ID}_late_cancelled`);
      assert.equal(failure.ignored, true);
      await assertPaidAndCoherent(fixture);
    });

    await check('FAILED primero se reconcilia con APPROVED posterior', async () => {
      const fixture = await createFixture('s03');
      await processFailure(fixture, 'failed');
      let state = await persisted(fixture);
      assert.equal(state.reservation.status, 'failed');
      assert.equal(state.order.inventoryControl.restockedOnFailure, true);
      assert.equal((await processApproved(fixture, 'approved-retry')).ok, true);
      await assertPaidAndCoherent(fixture);
    });

    await check('CANCELLED primero se reconcilia con APPROVED posterior', async () => {
      const fixture = await createFixture('s04');
      await processFailure(fixture, 'cancelled');
      assert.equal((await persisted(fixture)).reservation.status, 'cancelled');
      assert.equal((await processApproved(fixture, 'approved-retry')).ok, true);
      await assertPaidAndCoherent(fixture);
    });

    await check('concurrencia real sobre los mismos documentos converge', async () => {
      const fixture = await createFixture('s05');
      const results = await Promise.allSettled([
        processFailure(fixture, 'failed'),
        processApproved(fixture, 'approved-concurrent'),
      ]);
      assert.ok(results.some((row) => row.status === 'fulfilled'));
      if ((await persisted(fixture)).order.payment.status !== 'paid') {
        await processApproved(fixture, 'approved-concurrent-retry');
      }
      await assertPaidAndCoherent(fixture);
    });

    await check('MongoDB produce un conflicto real de escritura', async () => {
      const fixture = await createFixture('s06');
      const first = await mongoose.startSession();
      const second = await mongoose.startSession();
      try {
        first.startTransaction();
        second.startTransaction();
        await InventoryStock.findById(fixture.stockId).session(first);
        await InventoryStock.findById(fixture.stockId).session(second);
        await InventoryStock.updateOne({ _id: fixture.stockId }, { $inc: { reorderPoint: 1 } }, { session: first });
        const competing = InventoryStock.updateOne(
          { _id: fixture.stockId },
          { $inc: { reorderPoint: 1 } },
          { session: second }
        ).then(() => null, (error) => error);
        await first.commitTransaction();
        const conflict = await competing;
        conflictEvidence = conflict;
        assert.ok(conflict);
        assert.ok(
          conflict.code === 112 || conflict.codeName === 'WriteConflict' ||
          conflict.errorLabels?.includes('TransientTransactionError')
        );
        await second.abortTransaction().catch(() => null);
      } finally {
        await first.endSession();
        await second.endSession();
      }
    });

    await check('un error transitorio reejecuta toda la transaccion', async () => {
      const fixture = await createFixture('s07');
      let attempts = 0;
      await runPaymentInventoryTransaction({
        startSession: startSessionWithoutAutomaticRetry,
        work: async (session, meta) => {
          attempts += 1;
          await InventoryStock.findById(fixture.stockId).session(session);
          if (meta.attempt === 1) {
            await InventoryStock.updateOne({ _id: fixture.stockId }, { $inc: { reorderPoint: 1 } });
          }
          await InventoryStock.updateOne(
            { _id: fixture.stockId }, { $inc: { reorderPoint: 1 } }, { session }
          );
        },
      });
      retryEvidence = attempts;
      assert.ok(attempts >= 2);
    });

    await check('la autoridad se reevalua en cada reintento', async () => {
      const fixture = await createFixture('s08');
      let evaluations = 0;
      let attempts = 0;
      await runPaymentInventoryTransaction({
        startSession: startSessionWithoutAutomaticRetry,
        work: async (session, meta) => {
          attempts += 1;
          const order = await Order.findById(fixture.orderId).session(session);
          getCanonicalPaymentApprovalEvidence(order, {
            orderId: order._id,
            provider: 'wompi',
            paymentReference: order.payment.reference,
            paymentTransactionId: order.payment.transactionId,
          });
          evaluations += 1;
          await InventoryStock.findById(fixture.stockId).session(session);
          if (meta.attempt === 1) {
            await InventoryStock.updateOne({ _id: fixture.stockId }, { $inc: { reorderPoint: 1 } });
          }
          await InventoryStock.updateOne(
            { _id: fixture.stockId }, { $inc: { reorderPoint: 1 } }, { session }
          );
        },
      });
      assert.ok(attempts >= 2);
      assert.equal(evaluations, attempts);
    });

    await check('rollback real despues de mutar stock', async () => {
      const fixture = await createFixture('s09');
      const before = await InventoryStock.findById(fixture.stockId).lean();
      const session = await mongoose.startSession();
      await assert.rejects(session.withTransaction(async () => {
        await InventoryStock.updateOne({ _id: fixture.stockId }, { $inc: { stock: 3 } }, { session });
        throw new Error('FORCED_AFTER_STOCK');
      }), /FORCED_AFTER_STOCK/);
      await session.endSession();
      const after = await InventoryStock.findById(fixture.stockId).lean();
      assert.equal(after.stock, before.stock);
    });

    await check('rollback real ante fallo posterior de asignacion', async () => {
      const fixture = await createFixture('s10');
      const before = await Order.findById(fixture.orderId).lean();
      const session = await mongoose.startSession();
      await assert.rejects(session.withTransaction(async () => {
        await Order.updateOne(
          { _id: fixture.orderId },
          { $set: { 'inventoryAllocations.0.status': 'released' } },
          { session }
        );
        throw new Error('FORCED_AFTER_ALLOCATION');
      }), /FORCED_AFTER_ALLOCATION/);
      await session.endSession();
      const after = await Order.findById(fixture.orderId).lean();
      assert.equal(after.inventoryAllocations[0].status, before.inventoryAllocations[0].status);
    });

    await check('colision real de Kardex revierte toda la transaccion', async () => {
      const fixture = await createLegacyFixture('s11');
      const { order, planItem } = await createLegacyPlan(fixture);
      const session1 = await mongoose.startSession();
      await session1.withTransaction(async () => {
        await restoreLegacyAllocation({ order, planItem, session: session1, now: new Date() });
      });
      await session1.endSession();
      const movement = await InventoryMovement.findOne({ order: fixture.orderId }).lean();
      assert.ok(movement);
      const stockBefore = await InventoryStock.findById(fixture.stockId).lean();
      const session2 = await mongoose.startSession();
      await assert.rejects(session2.withTransaction(async () => {
        await InventoryStock.updateOne({ _id: fixture.stockId }, { $inc: { stock: 2 } }, { session: session2 });
        await InventoryMovement.create([{
          movementNumber: movement.movementNumber,
          type: 'return_in', direction: 'in', status: 'posted',
          product: fixture.productId, branchTo: fixture.branchId,
          variant: { size: 'M', color: '#000000' },
          variantKey: 'm__#000000', quantity: 1,
        }], { session: session2 });
      }), (error) => String(error?.code) === '11000');
      await session2.endSession();
      const stockAfter = await InventoryStock.findById(fixture.stockId).lean();
      assert.equal(stockAfter.stock, stockBefore.stock);
    });

    const blockedFixture = await createFixture('s12');
    await processFailure(blockedFixture, 'failed');
    await InventoryStock.updateOne(
      { _id: blockedFixture.stockId },
      { $set: { stock: 0, reservedStock: 0, availableStock: 0 } }
    );
    await check('reconciliacion fallida no persiste paid ni paidAt', async () => {
      const result = await processApproved(blockedFixture, 'approved-blocked');
      assert.equal(result.ok, false);
      const state = await persisted(blockedFixture);
      assert.notEqual(state.order.payment.status, 'paid');
      assert.equal(state.order.payment.paidAt, null);
    });

    await check('nunca queda pagada con reserva liberada', async () => {
      const state = await persisted(blockedFixture);
      assert.equal(state.reservation.status, 'failed');
      assert.notEqual(state.order.payment.status, 'paid');
    });

    await check('un reintento posterior completa la reconciliacion', async () => {
      await InventoryStock.updateOne(
        { _id: blockedFixture.stockId },
        { $set: { stock: 10, reservedStock: 0, availableStock: 10 } }
      );
      const result = await processApproved(blockedFixture, 'approved-retry');
      assert.equal(result.ok, true);
      await assertPaidAndCoherent(blockedFixture);
    });

    await check('el reintento no duplica stock, reserva ni Kardex', async () => {
      const before = await persisted(blockedFixture);
      await processApproved(blockedFixture, 'approved-retry');
      const after = await persisted(blockedFixture);
      assert.equal(after.stock.stock, before.stock.stock);
      assert.equal(after.stock.reservedStock, before.stock.reservedStock);
      assert.equal(after.movements.length, before.movements.length);
    });

    await check('idempotencia secuencial y concurrente de APPROVED', async () => {
      const fixture = await createFixture('s16');
      await processApproved(fixture, 'approved');
      const before = await persisted(fixture);
      await Promise.all([processApproved(fixture, 'approved'), processApproved(fixture, 'approved')]);
      const after = await persisted(fixture);
      assert.equal(after.stock.stock, before.stock.stock);
      assert.equal(after.movements.length, before.movements.length);
      assert.equal(after.order.payment.status, 'paid');
    });

    await check('factura no canonica primero y fiscal final no alteran la autoridad', async () => {
      const fixture = await createFixture('s17');
      await processApproved(fixture, 'approved');
      await createInvoice(fixture, 'pending', 'first');
      await createInvoice(fixture, 'generated', 'second');
      assert.equal((await authorityFor(fixture)).approved, true);
    });

    await check('factura fiscal primero y no canonica despues no alteran la autoridad', async () => {
      const fixture = await createFixture('s18');
      await processApproved(fixture, 'approved');
      await createInvoice(fixture, 'accepted', 'first');
      await createInvoice(fixture, 'failed', 'second');
      assert.equal((await authorityFor(fixture)).approved, true);
    });

    await check('todas las facturas pendientes o fallidas no autorizan', async () => {
      const fixture = await createFixture('s19');
      await createInvoice(fixture, 'pending');
      await createInvoice(fixture, 'failed');
      assert.equal((await authorityFor(fixture)).approved, false);
    });

    await check('factura fiscal de otra orden no autoriza', async () => {
      const fixture = await createFixture('s20');
      const other = await createFixture('s20_other');
      await createInvoice(other, 'accepted');
      assert.equal((await authorityFor(fixture)).approved, false);
    });

    await check('la autoridad queda aislada por orderId', async () => {
      const fixture = await createFixture('s21');
      const other = await createFixture('s21_other');
      await processApproved(other, 'approved');
      assert.equal((await authorityFor(fixture, { orderId: other.orderId })).approved, false);
    });

    await check('dos ordenes conservan identidades de pago diferentes', async () => {
      const first = await createFixture('s22_a');
      const second = await createFixture('s22_b');
      await processApproved(first, 'approved');
      const firstOrder = await Order.findById(first.orderId).lean();
      assert.equal((await authorityFor(second, {
        paymentReference: firstOrder.payment.reference,
        paymentTransactionId: firstOrder.payment.transactionId,
      })).approved, false);
    });

    await check('proveedor diferente se rechaza', async () => {
      const fixture = await createFixture('s23');
      await processApproved(fixture, 'approved');
      assert.equal((await authorityFor(fixture, { provider: 'payu' })).approved, false);
    });

    await check('referencia diferente se rechaza', async () => {
      const fixture = await createFixture('s24');
      await processApproved(fixture, 'approved');
      assert.equal((await authorityFor(fixture, {
        paymentReference: canonicalReference(orderNumber('otra'), 'x'),
      })).approved, false);
    });

    await check('transaccion persistida no relacionada se rechaza', async () => {
      const fixture = await createFixture('s25');
      await processApproved(fixture, 'approved');
      assert.equal((await authorityFor(fixture, {
        paymentTransactionId: `${RUN_ID}_unrelated`,
      })).approved, false);
    });

    await check('nuevo intento legitimo de la misma compra reconcilia', async () => {
      const fixture = await createFixture('s26');
      await processFailure(fixture, 'failed');
      const result = await processApproved(fixture, 'new-approved-attempt');
      assert.equal(result.ok, true);
      await assertPaidAndCoherent(fixture);
    });

    await check('reserva terminal por otra causa no se reactiva', async () => {
      const fixture = await createFixture('s27');
      await processFailure(fixture, 'failed');
      await InventoryReservation.updateOne(
        { _id: fixture.reservationId },
        { $set: { expiredAt: new Date() } }
      );
      await assert.rejects(
        processApproved(fixture, 'approved'),
        (error) => error?.code === 'PAYMENT_FAILURE_RESERVATION_TERMINAL_EVIDENCE'
      );
      const state = await persisted(fixture);
      assert.notEqual(state.order.payment.status, 'paid');
      assert.equal(state.reservation.status, 'failed');
    });

    await check('error transitorio agotado responde HTTP 503', async () => {
      const fixture = await createFixture('s28', { reservedStock: 0 });
      const response = await invokeWebhook(fixture, 'DECLINED');
      assert.equal(response.statusCode, 503);
      assert.equal(response.body.retryable, true);
      const state = await persisted(fixture);
      assert.equal(state.order.inventoryControl.restockedOnFailure, false);
      assert.equal(state.reservation.status, 'pending');
    });

    await check('error permanente no se disfraza como reintentable', async () => {
      const fixture = await createFixture('s29');
      const payload = webhookEvent(fixture, 'DECLINED');
      payload.data.transaction.amount_in_cents += 1;
      payload.signature.checksum = signPayload(payload);
      const response = await invokeWebhookPayload(payload);
      assert.equal(response.statusCode, 409);
      assert.equal(response.body?.error, 'WOMPI_AMOUNT_MISMATCH');
      assert.notEqual(response.body?.retryable, true);
      const state = await persisted(fixture);
      assert.equal(state.order.payment.status, 'pending_gateway');
      assert.equal(state.reservation.status, 'pending');
    });

    await check('recuperacion completa e idempotente responde HTTP 200', async () => {
      const fixture = await createFixture('s30');
      const first = await invokeWebhook(fixture, 'DECLINED');
      const second = await invokeWebhook(fixture, 'DECLINED');
      assert.equal(first.statusCode, 200);
      assert.equal(second.statusCode, 200);
      const state = await persisted(fixture);
      assert.equal(state.order.inventoryControl.restockedOnFailure, true);
      assert.equal(state.stock.reservedStock, 0);
    });

    for (const [index, status] of ['generated', 'sent', 'accepted'].entries()) {
      await check(`factura ${status} sin aprobacion autentica se rechaza`, async () => {
        const fixture = await createFixture(`s${31 + index}`);
        await createInvoice(fixture, status);
        const state = await persisted(fixture);
        assert.equal(getCanonicalPaymentApprovalEvidence(state.order, {
          electronicInvoice: state.invoices[0],
          orderId: fixture.orderId,
          provider: 'wompi',
          paymentReference: state.order.payment.reference,
          paymentTransactionId: state.order.payment.transactionId,
        }).approved, false);
      });
    }

    await check('marcador scheduled sin aprobacion autentica se rechaza', async () => {
      const fixture = await createFixture('s34');
      await Order.updateOne({ _id: fixture.orderId }, {
        $set: {
          'paymentProcessing.provider': 'wompi',
          'paymentProcessing.invoice.status': 'scheduled',
        },
      });
      assert.equal((await authorityFor(fixture)).approved, false);
    });

    await check('orden processing con pago fallido no es facturable', async () => {
      const fixture = await createFixture('s35', { status: 'processing' });
      await Order.updateOne({ _id: fixture.orderId }, {
        $set: {
          status: 'processing',
          'payment.status': 'failed',
          'paymentProcessing.inventory.status': 'confirmed',
        },
      });
      const order = await Order.findById(fixture.orderId).lean();
      assert.equal(isBillableOrder(order), false);
    });

    await check('identidad Wompi incompleta se rechaza', async () => {
      const fixture = await createFixture('s36');
      await Order.updateOne({ _id: fixture.orderId }, {
        $set: { 'payment.status': 'paid', 'payment.paidAt': new Date() },
        $unset: { 'payment.reference': 1, 'payment.transactionId': 1 },
      });
      const order = await Order.findById(fixture.orderId).lean();
      assert.equal(getCanonicalPaymentApprovalEvidence(order, {
        orderId: fixture.orderId,
        provider: 'wompi',
      }).approved, false);
      assert.equal(isBillableOrder(order), false);
    });

    await check('restoreLegacyAllocation recorre documentos Atlas reales', async () => {
      const fixture = await createLegacyFixture('s37');
      const before = await InventoryStock.findById(fixture.stockId).lean();
      const { order, planItem } = await createLegacyPlan(fixture);
      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        await restoreLegacyAllocation({ order, planItem, session, now: new Date() });
      });
      await session.endSession();
      const after = await persisted(fixture);
      assert.equal(after.stock.stock, before.stock + 1);
      assert.equal(after.movements.length, 1);
      assert.equal(after.movements[0].direction, 'in');
    });

    await check('compensacion historica hace rollback real ante fallo posterior', async () => {
      const fixture = await createLegacyFixture('s38');
      const before = await persisted(fixture);
      const { order, planItem } = await createLegacyPlan(fixture);
      const session = await mongoose.startSession();
      await assert.rejects(session.withTransaction(async () => {
        await restoreLegacyAllocation({ order, planItem, session, now: new Date() });
        throw new Error('FORCED_AFTER_LEGACY_RESTORE');
      }), /FORCED_AFTER_LEGACY_RESTORE/);
      await session.endSession();
      const after = await persisted(fixture);
      assert.equal(after.stock.stock, before.stock.stock);
      assert.equal(after.movements.length, before.movements.length);
    });

    await check('compensacion historica reintenta sin duplicar stock asignacion ni Kardex', async () => {
      const fixture = await createLegacyFixture('s39');
      await processFailure(fixture, 'failed');
      const first = await persisted(fixture);
      await processFailure(fixture, 'failed');
      const second = await persisted(fixture);
      assert.equal(second.stock.stock, first.stock.stock);
      assert.equal(second.movements.length, first.movements.length);
      assert.equal(second.order.inventoryAllocations[0].returnedQuantity, 1);
      assert.equal(second.order.inventoryControl.restockedOnFailure, true);
    });

    await check('orden HTTP autorizada conserva precio canonico e idempotencia', async () => {
      installExternalBoundaryStub();
      const baseUrl = await startHttpServer();
      const { branchFrom, branchTo, product } = await createIntegralCatalog();
      assert.deepEqual(
        await integralStockState(product._id, branchFrom._id),
        { stock: 2, reserved: 0, available: 2 }
      );
      assert.deepEqual(
        await integralStockState(product._id, branchTo._id),
        { stock: 2, reserved: 0, available: 2 }
      );
      assert.equal(await InventoryMovement.countDocuments({
        product: product._id,
        type: 'initial_stock',
        status: 'posted',
      }), 1);
      assert.equal(await InventoryMovement.countDocuments({
        product: product._id,
        type: 'transfer',
        status: 'posted',
      }), 1);

      const { cart: checkoutCart, access: checkoutAccess } =
        await createIntegralAuthorizedCart(product, 3);
      const { access: otherCartAccess } =
        await createIntegralAuthorizedCart(product, 1);
      const checkoutPayload = buildIntegralCheckoutPayload(
        product,
        checkoutAccess.sessionId,
        branchFrom._id
      );
      const idempotencyKey = `${RUN_ID}-CHECKOUT`;

      const assertRejectedWithoutMutation = async (headers, key) => {
        const response = await requestJson(baseUrl, '/api/orders', {
          method: 'POST',
          headers: { ...headers, 'Idempotency-Key': key },
          body: checkoutPayload,
        });
        assert.equal(response.status, 404, JSON.stringify(response.data));
        assert.equal(await Order.countDocuments({ sessionId: checkoutAccess.sessionId }), 0);
        assert.equal(await InventoryReservation.countDocuments({
          sessionId: checkoutAccess.sessionId,
        }), 0);
        assert.deepEqual(
          await integralStockState(product._id, branchFrom._id),
          { stock: 2, reserved: 0, available: 2 }
        );
        assert.deepEqual(
          await integralStockState(product._id, branchTo._id),
          { stock: 2, reserved: 0, available: 2 }
        );
      };

      await assertRejectedWithoutMutation({}, `${RUN_ID}-MISSING`);
      await assertRejectedWithoutMutation(cartAccessHeaders({
        ...checkoutAccess,
        token: alterCredential(checkoutAccess.token),
      }), `${RUN_ID}-ALTERED`);
      await assertRejectedWithoutMutation({
        'X-Session-Id': checkoutAccess.sessionId,
        'X-Cart-Access-Token': otherCartAccess.token,
      }, `${RUN_ID}-OTHER-CART`);
      await Cart.updateOne(
        { _id: checkoutCart._id },
        { $set: { accessIssuedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } }
      );
      await assertRejectedWithoutMutation(
        cartAccessHeaders(checkoutAccess),
        `${RUN_ID}-EXPIRED`
      );
      await Cart.updateOne(
        { _id: checkoutCart._id },
        { $set: { accessIssuedAt: new Date() } }
      );

      const created = await requestJson(baseUrl, '/api/orders', {
        method: 'POST',
        headers: {
          ...cartAccessHeaders(checkoutAccess),
          'Idempotency-Key': idempotencyKey,
        },
        body: checkoutPayload,
      });
      assert.equal(created.status, 201, JSON.stringify(created.data));
      assert.ok(created.data?._id);
      assert.equal(created.data.paymentAccess?.orderId, String(created.data._id));
      assert.equal(created.data.paymentAccess?.sessionId, checkoutAccess.sessionId);
      assert.ok(created.data.paymentAccess?.token);
      remember(Order.collection.name, created.data._id);
      await collectRunOwnedIds();

      const order = await Order.findById(created.data._id).lean();
      assert.ok(order);
      assert.equal(order.items.length, 1);
      assert.equal(order.items[0].title, product.title);
      assert.equal(Number(order.items[0].price), INTEGRAL_UNIT_PRICE);
      assert.equal(Number(order.items[0].unitPrice), INTEGRAL_UNIT_PRICE);
      assert.equal(Number(order.subtotal), INTEGRAL_UNIT_PRICE * 3);
      assert.equal(Number(order.total), INTEGRAL_UNIT_PRICE * 3);
      assert.notEqual(Number(order.total), Number(checkoutPayload.total));

      const idempotency = await IdempotencyKey.findOne({
        key: idempotencyKey,
        endpoint: 'POST /orders',
      }).lean();
      assert.equal(idempotency?.status, 'completed');
      assert.equal(String(idempotency?.orderId || ''), String(order._id));
      remember(IdempotencyKey.collection.name, idempotency._id);
      const reservation = await InventoryReservation.findOne({ order: order._id }).lean();
      assert.ok(reservation);
      remember(InventoryReservation.collection.name, reservation._id);
      assert.equal(await Order.countDocuments({ sessionId: checkoutAccess.sessionId }), 1);
      assert.equal(await InventoryReservation.countDocuments({ order: order._id }), 1);
      assert.equal(order.inventoryAllocationSummary.branchCount, 2);
      assert.equal(integralBranchQuantity(order, branchFrom._id, 'reservedQuantity'), 2);
      assert.equal(integralBranchQuantity(order, branchTo._id, 'reservedQuantity'), 1);

      const reusedCredential = await requestJson(baseUrl, '/api/orders', {
        method: 'POST',
        headers: {
          ...cartAccessHeaders(checkoutAccess),
          'Idempotency-Key': `${RUN_ID}-SECOND-ORDER`,
        },
        body: checkoutPayload,
      });
      assert.equal(reusedCredential.status, 404, JSON.stringify(reusedCredential.data));

      const movementCountBeforeReplay = await InventoryMovement.countDocuments({
        product: product._id,
      });
      const replay = await requestJson(baseUrl, '/api/orders', {
        method: 'POST',
        headers: {
          ...cartAccessHeaders(checkoutAccess),
          'Idempotency-Key': idempotencyKey,
        },
        body: checkoutPayload,
      });
      assert.equal(replay.status, 200, JSON.stringify(replay.data));
      assert.equal(String(replay.data._id), String(order._id));
      assert.equal(await Order.countDocuments({ sessionId: checkoutAccess.sessionId }), 1);
      assert.equal(await InventoryReservation.countDocuments({ order: order._id }), 1);
      const replayedOrder = await Order.findById(order._id).lean();
      assert.equal(replayedOrder.inventoryAllocations.length, order.inventoryAllocations.length);
      assert.equal(await InventoryMovement.countDocuments({ product: product._id }), movementCountBeforeReplay);

      integralFixture = {
        baseUrl,
        branchFrom,
        branchTo,
        product,
        checkoutAccess,
        paymentAccess: created.data.paymentAccess,
        orderId: order._id,
        reservationId: reservation._id,
        orderNumber: order.orderNumber,
      };
    });

    await check('acceso publico real exige credencial y responde datos minimos', async () => {
      assert.ok(integralFixture?.orderId);
      const {
        baseUrl,
        orderId,
        checkoutAccess,
        paymentAccess,
        product,
        branchFrom,
        branchTo,
      } = integralFixture;
      const order = await Order.findById(orderId).lean();
      const reservationBefore = await InventoryReservation.findById(
        integralFixture.reservationId
      ).lean();
      const orderUpdatedAt = String(order.updatedAt);
      const reservationUpdatedAt = String(reservationBefore.updatedAt);
      const stockBefore = [
        await integralStockState(product._id, branchFrom._id),
        await integralStockState(product._id, branchTo._id),
      ];

      const alteredAccess = {
        ...paymentAccess,
        token: alterCredential(paymentAccess.token),
      };
      const expiredToken = createGuestOrderAccessToken({
        orderId,
        sessionId: checkoutAccess.sessionId,
        secret: process.env.ORDER_PAYMENT_ACCESS_SECRET,
        now: Date.now() - 2 * 24 * 60 * 60 * 1000,
        ttlMs: 60_000,
      });
      const otherOrderToken = createGuestOrderAccessToken({
        orderId: new mongoose.Types.ObjectId(),
        sessionId: checkoutAccess.sessionId,
        secret: process.env.ORDER_PAYMENT_ACCESS_SECRET,
      });
      const deniedHeaders = [
        {},
        paymentAccessHeaders(alteredAccess),
        paymentAccessHeaders({ ...paymentAccess, token: expiredToken }),
        paymentAccessHeaders({ ...paymentAccess, token: otherOrderToken }),
      ];
      const validLookupId = `${RUN_ID}_PUBLIC_VALID`.slice(0, 118);
      const externalCallsBeforeDenied = wompiFetchCalls;
      for (const headers of deniedHeaders) {
        const checkoutDenied = await requestJson(
          baseUrl,
          '/api/payments/wompi/checkout-data',
          { method: 'POST', headers, body: { orderId: String(orderId) } }
        );
        assert.equal(checkoutDenied.status, 404, JSON.stringify(checkoutDenied.data));
        const thanksDenied = await requestJson(
          baseUrl,
          `/api/orders/${orderId}/thanks`,
          { headers }
        );
        assert.equal(thanksDenied.status, 404, JSON.stringify(thanksDenied.data));
        const transactionDenied = await requestJson(
          baseUrl,
          `/api/payments/wompi/transaction/${validLookupId}`,
          { headers }
        );
        assert.equal(transactionDenied.status, 404, JSON.stringify(transactionDenied.data));
      }
      assert.equal(wompiFetchCalls, externalCallsBeforeDenied);

      const validHeaders = paymentAccessHeaders(paymentAccess);
      const checkoutData = await requestJson(
        baseUrl,
        '/api/payments/wompi/checkout-data',
        { method: 'POST', headers: validHeaders, body: { orderId: String(orderId) } }
      );
      assert.equal(checkoutData.status, 200, JSON.stringify(checkoutData.data));
      assert.equal(checkoutData.data.orderId, String(orderId));
      assert.equal(checkoutData.data.orderNumber, order.orderNumber);
      assert.equal(checkoutData.data.amountInCents, Math.round(order.total * 100));
      assert.match(checkoutData.data.reference, new RegExp(`^ORDER-${order.orderNumber}__TRY__`));
      assertNoSensitiveFields(checkoutData.data);

      const thanks = await requestJson(
        baseUrl,
        `/api/orders/${orderId}/thanks`,
        { headers: validHeaders }
      );
      assert.equal(thanks.status, 200, JSON.stringify(thanks.data));
      assert.equal(thanks.data.orderId, String(orderId));
      assert.equal(thanks.data.orderNumber, order.orderNumber);
      assertNoSensitiveFields(thanks.data);

      const canonicalReference = `ORDER-${order.orderNumber}__TRY__${RUN_ID}`;
      const wrongReferenceId = `${RUN_ID}_PUBLIC_WRONG_REF`.slice(0, 118);
      const wrongTransactionId = `${RUN_ID}_PUBLIC_WRONG_TX`.slice(0, 118);
      const wrongAmountId = `${RUN_ID}_PUBLIC_WRONG_AMOUNT`.slice(0, 118);
      wompiTransactions.set(validLookupId, {
        id: validLookupId,
        status: 'PENDING',
        reference: canonicalReference,
        amount_in_cents: Math.round(order.total * 100),
        currency: 'COP',
        customer_email: 'no-debe-salir@example.com',
        raw_secret: 'no-debe-salir',
      });
      wompiTransactions.set(wrongReferenceId, {
        id: wrongReferenceId,
        status: 'APPROVED',
        reference: `ORDER-OTRA-ORDEN__TRY__${RUN_ID}`,
        amount_in_cents: Math.round(order.total * 100),
        currency: 'COP',
      });
      wompiTransactions.set(wrongTransactionId, {
        id: `${wrongTransactionId}_OTHER`.slice(0, 118),
        status: 'APPROVED',
        reference: canonicalReference,
        amount_in_cents: Math.round(order.total * 100),
        currency: 'COP',
      });
      wompiTransactions.set(wrongAmountId, {
        id: wrongAmountId,
        status: 'APPROVED',
        reference: canonicalReference,
        amount_in_cents: Math.round(order.total * 100) - 1,
        currency: 'COP',
      });

      for (const rejectedId of [wrongReferenceId, wrongTransactionId, wrongAmountId]) {
        const rejected = await requestJson(
          baseUrl,
          `/api/payments/wompi/transaction/${rejectedId}`,
          { headers: validHeaders }
        );
        assert.equal(rejected.status, 404, JSON.stringify(rejected.data));
      }
      const transactionStatus = await requestJson(
        baseUrl,
        `/api/payments/wompi/transaction/${validLookupId}`,
        { headers: validHeaders }
      );
      assert.equal(transactionStatus.status, 200, JSON.stringify(transactionStatus.data));
      assert.equal(transactionStatus.data.transactionId, validLookupId);
      assert.equal(transactionStatus.data.orderId, String(orderId));
      assert.equal(transactionStatus.data.orderNumber, order.orderNumber);
      assertNoSensitiveFields(transactionStatus.data);

      const orderAfter = await Order.findById(orderId).lean();
      const reservationAfter = await InventoryReservation.findById(
        integralFixture.reservationId
      ).lean();
      assert.equal(String(orderAfter.updatedAt), orderUpdatedAt);
      assert.equal(String(reservationAfter.updatedAt), reservationUpdatedAt);
      assert.deepEqual([
        await integralStockState(product._id, branchFrom._id),
        await integralStockState(product._id, branchTo._id),
      ], stockBefore);
      integralFixture.publicTransactionId = validLookupId;
    });

    await check('ciclo integral conserva inventario multisede y reembolso idempotente', async () => {
      assert.ok(integralFixture?.orderId);
      const {
        baseUrl,
        orderId,
        branchFrom,
        branchTo,
        product,
      } = integralFixture;
      let order = await Order.findById(orderId).lean();
      const transactionId = `${RUN_ID}_INTEGRAL_APPROVED`.slice(0, 118);
      const approvedPayload = buildIntegralWompiPayload({
        orderNumber: order.orderNumber,
        total: order.total,
        transactionId,
      });
      const approved = await requestJson(baseUrl, '/api/payments/wompi/webhook', {
        method: 'POST',
        headers: { 'X-Event-Checksum': approvedPayload.signature.checksum },
        body: approvedPayload,
      });
      assert.equal(approved.status, 200, JSON.stringify(approved.data));
      assert.equal(approved.data.orderStatus, 'paid');
      assert.equal(approved.data.paymentStatus, 'paid');

      order = await waitFor(async () => {
        const current = await Order.findById(orderId).lean();
        return current?.fulfillment?.processedAt ? current : null;
      }, 'INTEGRAL_FULFILLMENT_NOT_COMPLETED');
      const firstPaidAt = String(order.payment.paidAt);
      const firstFulfillmentAt = String(order.fulfillment.processedAt);
      assert.ok(firstPaidAt);
      assert.equal(order.payment.transactionId, transactionId);
      const reservation = await InventoryReservation.findOne({ order: orderId }).lean();
      assert.equal(reservation.status, 'confirmed');
      assert.equal(await InventoryReservation.countDocuments({ order: orderId }), 1);
      assert.deepEqual(
        await integralStockState(product._id, branchFrom._id),
        { stock: 0, reserved: 0, available: 0 }
      );
      assert.deepEqual(
        await integralStockState(product._id, branchTo._id),
        { stock: 1, reserved: 0, available: 1 }
      );
      assert.equal(order.inventoryAllocationSummary.soldQuantity, 3);
      assert.equal(integralBranchQuantity(order, branchFrom._id, 'soldQuantity'), 2);
      assert.equal(integralBranchQuantity(order, branchTo._id, 'soldQuantity'), 1);

      let saleMovements = await InventoryMovement.find({
        order: orderId,
        type: 'sale_out',
        status: 'posted',
      }).lean();
      assert.equal(saleMovements.length, 2);
      assert.deepEqual(
        saleMovements.map((movement) => Number(movement.quantity)).sort((a, b) => a - b),
        [1, 2]
      );
      assert.deepEqual(
        saleMovements.map((movement) => String(movement.branchFrom)).sort(),
        [String(branchFrom._id), String(branchTo._id)].sort()
      );
      for (const movement of saleMovements) {
        assert.equal(String(movement.product), String(product._id));
        assert.equal(String(movement.order), String(orderId));
        assert.equal(movement.sourceModel, 'InventoryReservation');
        assert.equal(String(movement.sourceId), String(reservation._id));
        assert.equal(movement.variantKey, INTEGRAL_VARIANT_KEY);
        remember(InventoryMovement.collection.name, movement._id);
      }

      const repeatedPayment = await requestJson(baseUrl, '/api/payments/wompi/webhook', {
        method: 'POST',
        headers: { 'X-Event-Checksum': approvedPayload.signature.checksum },
        body: approvedPayload,
      });
      assert.equal(repeatedPayment.status, 200, JSON.stringify(repeatedPayment.data));
      await new Promise((resolve) => setTimeout(resolve, 250));
      order = await Order.findById(orderId).lean();
      saleMovements = await InventoryMovement.find({
        order: orderId,
        type: 'sale_out',
        status: 'posted',
      }).lean();
      assert.equal(saleMovements.length, 2);
      assert.equal(String(order.payment.paidAt), firstPaidAt);
      assert.equal(String(order.fulfillment.processedAt), firstFulfillmentAt);
      assert.equal(await InventoryReservation.countDocuments({ order: orderId }), 1);
      assert.deepEqual(
        await integralStockState(product._id, branchTo._id),
        { stock: 1, reserved: 0, available: 1 }
      );

      await transitionOrderStatus({
        orderId,
        status: 'shipped',
        actor: { label: 'atlas-integrity', source: 'payment_inventory_atlas' },
      });
      order = await Order.findById(orderId).lean();
      assert.equal(order.status, 'shipped');
      assert.equal(order.inventoryAllocationSummary.shippedQuantity, 3);
      assert.equal(integralBranchQuantity(order, branchFrom._id, 'shippedQuantity'), 2);
      assert.equal(integralBranchQuantity(order, branchTo._id, 'shippedQuantity'), 1);

      await transitionOrderStatus({
        orderId,
        status: 'delivered',
        actor: { label: 'atlas-integrity', source: 'payment_inventory_atlas' },
      });
      order = await Order.findById(orderId).lean();
      assert.equal(order.status, 'delivered');
      assert.equal(order.inventoryAllocationSummary.deliveredQuantity, 3);
      assert.equal(integralBranchQuantity(order, branchFrom._id, 'deliveredQuantity'), 2);
      assert.equal(integralBranchQuantity(order, branchTo._id, 'deliveredQuantity'), 1);

      const refundInput = {
        orderId,
        amount: order.total,
        reason: 'Devolucion integral aislada',
        items: [{
          orderItemId: String(order.items[0]._id),
          quantity: 3,
          restock: true,
        }],
        idempotencyKey: `${RUN_ID}-REFUND`,
        adminLabel: 'atlas-integrity',
      };
      const refund = await processOrderRefund(refundInput);
      assert.equal(refund.idempotent, false);
      const repeatedRefund = await processOrderRefund(refundInput);
      assert.equal(repeatedRefund.idempotent, true);

      const persistedRefunds = await OrderRefund.find({ order: orderId }).lean();
      assert.equal(persistedRefunds.length, 1);
      assert.equal(persistedRefunds[0].status, 'processed');
      assert.equal(Number(persistedRefunds[0].amount), Number(order.total));
      remember(OrderRefund.collection.name, persistedRefunds[0]._id);
      order = await Order.findById(orderId).lean();
      assert.equal(order.inventoryAllocationSummary.returnedQuantity, 3);
      assert.equal(integralBranchQuantity(order, branchFrom._id, 'returnedQuantity'), 2);
      assert.equal(integralBranchQuantity(order, branchTo._id, 'returnedQuantity'), 1);
      assert.equal(Number(order.refundControl.totalAmount), Number(order.total));
      assert.equal(Number(order.refundControl.transactionCount), 1);
      assert.ok(order.inventoryAllocations.every((allocation) =>
        Number(allocation.returnedQuantity) === Number(allocation.quantity)
      ));

      const returnMovements = await InventoryMovement.find({
        order: orderId,
        type: 'return_in',
        status: 'posted',
      }).lean();
      assert.equal(returnMovements.length, 2);
      assert.deepEqual(
        returnMovements.map((movement) => Number(movement.quantity)).sort((a, b) => a - b),
        [1, 2]
      );
      const allOrderMovements = await InventoryMovement.find({ order: orderId }).lean();
      assert.equal(allOrderMovements.length, 4);
      assert.equal(
        new Set(allOrderMovements.map((movement) => movement.movementNumber)).size,
        allOrderMovements.length
      );
      for (const movement of allOrderMovements) {
        remember(InventoryMovement.collection.name, movement._id);
      }
      assert.deepEqual(
        await integralStockState(product._id, branchFrom._id),
        { stock: 2, reserved: 0, available: 2 }
      );
      assert.deepEqual(
        await integralStockState(product._id, branchTo._id),
        { stock: 2, reserved: 0, available: 2 }
      );
      const finalProduct = await Product.findById(product._id).lean();
      assert.equal(Number(finalProduct.stock), 4);
      assert.equal(String(order.payment.paidAt), firstPaidAt);
      await collectRunOwnedIds();
    });

    assert.equal(controlCount, 42);
    assert.ok(conflictEvidence);
    assert.ok(retryEvidence >= 2);
    console.log(`ATLAS RUN ID: ${RUN_ID}`);
    console.log(`ATLAS REAL: ${controlCount}/${controlCount} controles aprobados.`);
  } finally {
    try {
      global.fetch = nativeFetch;
      if (server) {
        await new Promise((resolve) => server.close(() => resolve()));
        server = null;
      }
      if (mongoose.connection.readyState === 1) {
        let finalizationError = null;
        try {
          await restoreManagedExistingDocuments();
        } catch (error) {
          finalizationError = error;
        }
        try {
          await cleanupExactDocuments();
        } catch (error) {
          finalizationError = finalizationError || error;
        }
        if (finalizationError) throw finalizationError;
      }
    } finally {
      await mongoose.disconnect();
    }
  }

  console.log('ATLAS CLEANUP: cero documentos residuales propios en la base configurada.');
  console.log(`ATLAS CONFLICT: code=${conflictEvidence?.code || ''} name=${conflictEvidence?.codeName || ''}`);
  console.log(`ATLAS RETRY: intentos=${retryEvidence || 0}`);
  for (const [name, count] of cleanupCounts) {
    console.log(`ATLAS CLEANUP COLLECTION: ${name}=${count}`);
  }
}

main().catch((error) => {
  global.fetch = nativeFetch;
  const redact = (value) => {
    let safe = String(value || '')
      .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[REDACTED_MONGODB_URI]');
    if (connectedDatabaseName) {
      safe = safe.replaceAll(connectedDatabaseName, '[CONFIGURED_DB]');
    }
    return safe;
  };
  const safeMessage = redact(error?.message || '');
  console.error(
    `ATLAS INTEGRITY FAILED: ${error?.name || 'Error'} code=${error?.code || ''} ${safeMessage}`
  );
  const safeStack = redact(error?.stack || '')
    .split(/\r?\n/)
    .slice(1, 5)
    .join('\n');
  if (safeStack) console.error(safeStack);
  process.exitCode = 1;
});
