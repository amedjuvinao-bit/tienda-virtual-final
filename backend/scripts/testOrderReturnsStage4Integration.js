/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const InventoryReservation = require('../models/InventoryReservation');
const InventoryStock = require('../models/InventoryStock');
const Order = require('../models/Order');
const OrderReturn = require('../models/OrderReturn');
const Product = require('../models/Product');
const StoreCredit = require('../models/StoreCredit');
const {
  createInventoryReservation,
  confirmInventoryReservation,
} = require('../services/inventoryReservationService');
const {
  createOrderReturn,
  resolveOrderReturnAutomaticExchange,
  resolveOrderReturnStoreCredit,
  updateOrderReturn,
} = require('../services/orderReturnService');
const {
  getOrderReturnPolicy,
  updateOrderReturnPolicy,
} = require('../services/orderReturnPolicyService');

const REQUIRED_DATABASE = 'orders_ci_stage4_returns';
const MONGO_URI = process.env.ORDERS_STAGE4_MONGO_URI || '';
const NOW = new Date('2026-08-24T16:00:00.000Z');
const ACTOR = { label: 'CI Etapa 4', role: 'owner' };
let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function assertSafeMongoUri(value) {
  assert(value, 'ORDERS_STAGE4_MONGO_URI no está configurado.');
  const parsed = new URL(value);
  assert.strictEqual(parsed.protocol, 'mongodb:', 'La Etapa 4 no acepta Atlas ni mongodb+srv.');
  assert(
    ['127.0.0.1', 'localhost'].includes(parsed.hostname),
    'La integración de Etapa 4 solo acepta MongoDB local.'
  );
  assert.strictEqual(
    parsed.pathname.replace(/^\//, ''),
    REQUIRED_DATABASE,
    `La base temporal debe llamarse ${REQUIRED_DATABASE}.`
  );
  assert.strictEqual(
    parsed.searchParams.get('replicaSet'),
    'rs0',
    'La integración de Etapa 4 exige replicaSet=rs0.'
  );
}

async function createDeliveredOrder() {
  const branch = await Branch.create({
    name: 'Bodega CI Etapa 4',
    code: 'STAGE4',
    type: 'warehouse',
    isMain: true,
  });
  const product = await Product.create({
    sku: 'STAGE4-RMA-PRODUCT',
    title: 'Producto físico para cambio',
    price: 100000,
    productType: 'physical',
    trackInventory: true,
    allowBackorder: false,
    variantPreset: 'none',
    variantAxes: [],
    variants: [],
  });
  const stock = await InventoryStock.create({
    branch: branch._id,
    branchSnapshot: { name: branch.name, code: branch.code, type: branch.type },
    product: product._id,
    productSnapshot: { title: product.title, sku: product.sku },
    variantKey: 'default__default',
    variant: { label: 'Sin variante', size: '', color: '' },
    stock: 2,
    reservedStock: 0,
    active: true,
  });
  const order = await Order.create({
    sessionId: 'stage4-original-order',
    orderNumber: 'ORD-STAGE4-ORIGINAL',
    status: 'paid',
    fulfillmentStatus: 'pending',
    branch: branch._id,
    branchSnapshot: { name: branch.name, code: branch.code, type: branch.type },
    source: 'online',
    channel: 'web',
    saleType: 'online_order',
    customer: {
      name: 'Cliente',
      lastname: 'Etapa Cuatro',
      email: 'orders-stage4@example.invalid',
      phone: '3000000000',
    },
    items: [{
      product: product._id,
      productId: String(product._id),
      title: product.title,
      productType: 'physical',
      requiresShipping: true,
      variantKey: 'default__default',
      quantity: 2,
      qty: 2,
      price: 100000,
      unitPrice: 100000,
      lineTotal: 200000,
    }],
    subtotal: 200000,
    shipping: 0,
    total: 200000,
    payment: {
      provider: 'manual',
      mode: 'sandbox',
      status: 'paid',
      method: 'transfer',
      currency: 'COP',
      amount: 200000,
      paidAt: NOW,
    },
    inventoryControl: {
      reservationRequired: true,
      discountedAtCheckout: false,
    },
  });
  const reservation = await createInventoryReservation({
    sessionId: order.sessionId,
    order: order._id,
    orderNumber: order.orderNumber,
    paymentReference: 'STAGE4-ORIGINAL-PAYMENT',
    source: 'checkout',
    items: order.items,
    branchPriorityIds: [String(branch._id)],
    currency: 'COP',
  });
  assert(reservation, 'No se creó la reserva original.');
  await confirmInventoryReservation(reservation._id, {
    order: order._id,
    orderNumber: order.orderNumber,
    paymentReference: 'STAGE4-ORIGINAL-PAYMENT',
  });

  const delivered = await Order.findById(order._id);
  delivered.status = 'delivered';
  delivered.fulfillmentStatus = 'delivered';
  delivered.inventoryControl.reservationId = reservation._id;
  delivered.inventoryControl.discountedAtCheckout = true;
  for (const allocation of delivered.inventoryAllocations) {
    allocation.shippedQuantity = allocation.quantity;
    allocation.deliveredQuantity = allocation.quantity;
    allocation.status = 'delivered';
    allocation.shippedAt = NOW;
    allocation.deliveredAt = NOW;
  }
  await delivered.save();
  return { branch, order: delivered, product, stock, reservation };
}

async function receiveAndInspect(order, returnCase) {
  const received = await updateOrderReturn({
    orderFilter: { _id: order._id },
    returnId: returnCase._id,
    action: 'receive',
    expectedRevision: returnCase.revision,
    payload: {},
    actor: ACTOR,
    now: NOW,
  });
  return updateOrderReturn({
    orderFilter: { _id: order._id },
    returnId: returnCase._id,
    action: 'inspect',
    expectedRevision: received.revision,
    payload: {
      items: [{
        orderItemId: String(order.items[0]._id),
        sellableQuantity: 1,
        damagedQuantity: 0,
        quarantineQuantity: 0,
        rejectedQuantity: 0,
        inspectionNote: 'Unidad apta para reventa.',
      }],
    },
    actor: ACTOR,
    now: NOW,
  });
}

async function run() {
  assertSafeMongoUri(MONGO_URI);
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await mongoose.connection.dropDatabase();

  const initialPolicy = await getOrderReturnPolicy();
  const policy = await updateOrderReturnPolicy({
    payload: {
      expectedRevision: initialPolicy.revision,
      enabled: true,
      customerPortalEnabled: true,
      windowDays: 30,
      allowedResolutions: ['exchange', 'store_credit'],
      requireReasonText: true,
      autoAuthorize: true,
      storeCreditEnabled: true,
      storeCreditExpirationDays: 365,
      automaticExchangeEnabled: true,
      instructions: 'Etiqueta el paquete con su número RMA.',
      policyText: 'Política transaccional de prueba.',
    },
    actor: ACTOR,
  });
  assert.strictEqual(policy.revision, 1);
  assert.strictEqual(policy.autoAuthorize, true);
  assert.deepStrictEqual(policy.allowedResolutions, ['exchange', 'store_credit']);
  ok('la política versionada persiste y se vuelve autoridad del autoservicio');

  const { order, stock } = await createDeliveredOrder();
  const persistedSoldStock = await InventoryStock.findById(stock._id).lean();
  assert.strictEqual(persistedSoldStock.stock, 0);
  assert.strictEqual(persistedSoldStock.reservedStock, 0);
  ok('la venta original descuenta inventario antes de iniciar la posventa');

  const lineId = String(order.items[0]._id);
  const creditRequest = await createOrderReturn({
    orderFilter: { _id: order._id },
    items: [{
      orderItemId: lineId,
      quantity: 1,
      reasonCode: 'wrong_size',
      reasonText: 'El cliente necesita otra talla.',
    }],
    requestedResolution: 'store_credit',
    reasonSummary: 'Primera unidad.',
    requestSource: 'customer',
    actor: { label: 'Cliente Etapa 4', role: 'customer' },
    now: NOW,
  });
  const exchangeRequest = await createOrderReturn({
    orderFilter: { _id: order._id },
    items: [{
      orderItemId: lineId,
      quantity: 1,
      reasonCode: 'wrong_size',
      reasonText: 'El cliente necesita otra talla.',
    }],
    requestedResolution: 'exchange',
    reasonSummary: 'Segunda unidad.',
    requestSource: 'customer',
    actor: { label: 'Cliente Etapa 4', role: 'customer' },
    now: NOW,
  });
  assert.strictEqual(creditRequest.status, 'authorized');
  assert.strictEqual(exchangeRequest.status, 'authorized');
  assert.strictEqual(creditRequest.requestSource, 'customer');
  assert.strictEqual(creditRequest.policySnapshot.revision, 1);
  ok('dos solicitudes del cliente respetan cantidad, política y autoautorización');

  const inspectedCredit = await receiveAndInspect(order, creditRequest);
  const inspectedExchange = await receiveAndInspect(order, exchangeRequest);
  assert.strictEqual(inspectedCredit.status, 'resolution_required');
  assert.strictEqual(inspectedExchange.status, 'resolution_required');
  const restoredStock = await InventoryStock.findById(stock._id).lean();
  assert.strictEqual(restoredStock.stock, 2);
  ok('recepción e inspección reponen únicamente unidades vendibles');

  const creditResult = await resolveOrderReturnStoreCredit({
    orderFilter: { _id: order._id },
    returnId: inspectedCredit._id,
    expectedRevision: inspectedCredit.revision,
    actor: ACTOR,
    now: NOW,
  });
  const repeatedCredit = await resolveOrderReturnStoreCredit({
    orderFilter: { _id: order._id },
    returnId: inspectedCredit._id,
    expectedRevision: inspectedCredit.revision,
    actor: ACTOR,
    now: NOW,
  });
  assert.strictEqual(creditResult.idempotent, false);
  assert.strictEqual(repeatedCredit.idempotent, true);
  assert.strictEqual(creditResult.storeCredit.balance, 100000);
  assert.strictEqual(await StoreCredit.countDocuments({ sourceReturn: inspectedCredit._id }), 1);
  ok('el saldo a favor se emite una sola vez por el valor aceptado');

  const exchangeResult = await resolveOrderReturnAutomaticExchange({
    orderFilter: { _id: order._id },
    returnId: inspectedExchange._id,
    expectedRevision: inspectedExchange.revision,
    actor: ACTOR,
    now: NOW,
  });
  const repeatedExchange = await resolveOrderReturnAutomaticExchange({
    orderFilter: { _id: order._id },
    returnId: inspectedExchange._id,
    expectedRevision: inspectedExchange.revision,
    actor: ACTOR,
    now: NOW,
  });
  assert.strictEqual(exchangeResult.idempotent, false);
  assert.strictEqual(repeatedExchange.idempotent, true);
  assert(exchangeResult.replacementOrder?._id);
  assert.strictEqual(exchangeResult.replacementOrder?.source, 'system');
  assert.strictEqual(exchangeResult.replacementOrder?.total, 0);
  assert.strictEqual(
    await Order.countDocuments({ sessionId: `exchange:${inspectedExchange._id}` }),
    1
  );
  assert.strictEqual(
    await InventoryReservation.countDocuments({ order: exchangeResult.replacementOrder._id }),
    1
  );
  const finalStock = await InventoryStock.findById(stock._id).lean();
  assert.strictEqual(finalStock.stock, 1);
  assert.strictEqual(finalStock.reservedStock, 0);
  ok('el cambio crea una sola orden, reserva, confirma y descuenta una unidad');

  const resolvedReturns = await OrderReturn.countDocuments({ order: order._id, status: 'resolved' });
  assert.strictEqual(resolvedReturns, 2);
  console.log(`\nIntegración de Órdenes · Etapa 4: ${passed}/${passed} controles aprobados`);
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
  console.error('\nFAIL Integración de Órdenes · Etapa 4');
  console.error(error);
  process.exitCode = 1;
});
