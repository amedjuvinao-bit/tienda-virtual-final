/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env'),
  override: false,
  quiet: true,
});

const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryReservation = require('../models/InventoryReservation');
const InventoryStock = require('../models/InventoryStock');
const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const OrderReturn = require('../models/OrderReturn');
const Product = require('../models/Product');
const { buildVariantKey } = require('../lib/products/productVariantConfig');
const {
  createOrderReturn,
  listOrderReturns,
  resolveOrderReturnRefund,
  updateOrderReturn,
} = require('../services/orderReturnService');

const CONFIRMATION_FLAG = '--confirm-persist';
const MONGO_URI = String(process.env.MONGODB_URI || '').trim();
const RUN_ID = crypto.randomBytes(4).toString('hex').toUpperCase();
const TRACE_STAMP = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const PREFIX = `RMA-DEMO-${TRACE_STAMP}-${RUN_ID}`;
const BRANCH_CODE = `RMA-${TRACE_STAMP.slice(2, 8)}-${RUN_ID}`;
const PRODUCT_SKU = `${PREFIX}-SKU`;
const VARIANT_SKU = `${PREFIX}-M-AZ`;
const ORDER_NUMBER = `${PREFIX}-ORD`;
const UNIT_PRICE = 100000;
const SOLD_QUANTITY = 2;
const STOCK_AFTER_SALE = 3;
const VARIANT_KEY = buildVariantKey('M', 'Azul');

let passed = 0;

const OrderEvent =
  mongoose.models.OrderEvent ||
  mongoose.model(
    'OrderEvent',
    new mongoose.Schema(
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Order',
          index: true,
          required: true,
        },
        type: { type: String, required: true },
        message: { type: String, default: '' },
        meta: { type: Object, default: {} },
      },
      {
        timestamps: { createdAt: true, updatedAt: false },
        versionKey: false,
      }
    ),
    'order_events'
  );

function ok(label) {
  passed += 1;
  console.log(`OK ${String(passed).padStart(2, '0')}: ${label}`);
}

async function assertTransactionalMongo() {
  await mongoose.connection.db.command({ ping: 1 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  const supportsTransactions = Boolean(
    hello?.setName || String(hello?.msg || '').toLowerCase() === 'isdbgrid'
  );

  assert(
    supportsTransactions,
    'La base principal responde, pero no es un replica set ni un clúster con transacciones. El RMA no puede probarse profesionalmente en un MongoDB standalone.'
  );
}

async function createFixture() {
  const branch = await Branch.create({
    name: `${PREFIX} Bodega DEMO persistente`,
    code: BRANCH_CODE,
    type: 'warehouse',
    status: 'active',
    active: true,
    isMain: false,
    isDefaultForOnlineOrders: false,
    settings: {
      allowPosSales: false,
      allowManualOrders: false,
      allowInventoryMovements: true,
      allowNegativeStock: false,
    },
    notes: `Traza persistente RMA ${PREFIX}. No usar para operación comercial.`,
  });

  const product = await Product.create({
    sku: PRODUCT_SKU,
    title: `${PREFIX} Camiseta DEMO persistente`,
    description: 'Producto demostrativo conservado para revisar la trazabilidad RMA.',
    category: 'DEMO RMA TRACE',
    price: UNIT_PRICE,
    stock: 0,
    productType: 'physical',
    trackInventory: true,
    allowBackorder: false,
    active: false,
    visible: false,
    variants: [
      {
        label: 'M / Azul',
        size: 'M',
        color: 'Azul',
        sku: VARIANT_SKU,
        price: UNIT_PRICE,
        initialStock: 0,
        active: true,
      },
    ],
  });

  let stock = await InventoryStock.findOne({
    branch: branch._id,
    product: product._id,
    variantKey: VARIANT_KEY,
    deletedAt: null,
  });
  if (!stock) {
    stock = new InventoryStock({
      branch: branch._id,
      product: product._id,
      variantKey: VARIANT_KEY,
    });
  }
  stock.set({
    branchSnapshot: {
      name: branch.name,
      code: branch.code,
      type: branch.type,
    },
    productSnapshot: {
      title: product.title,
      sku: product.sku,
      category: product.category,
    },
    variant: {
      label: 'M / Azul',
      size: 'M',
      color: 'Azul',
      sku: VARIANT_SKU,
    },
    variantKey: VARIANT_KEY,
    stock: STOCK_AFTER_SALE,
    reservedStock: 0,
    availableStock: STOCK_AFTER_SALE,
    active: true,
    deletedAt: null,
  });
  await stock.save();

  const now = new Date();
  const order = await Order.create({
    sessionId: `${PREFIX}-SESSION`,
    orderNumber: ORDER_NUMBER,
    status: 'delivered',
    fulfillmentStatus: 'delivered',
    source: 'system',
    channel: 'system',
    saleType: 'system_order',
    branch: branch._id,
    branchSnapshot: {
      name: branch.name,
      code: branch.code,
      type: branch.type,
    },
    items: [
      {
        product: product._id,
        productId: String(product._id),
        title: product.title,
        productType: 'physical',
        size: 'M',
        color: 'Azul',
        colorLabel: 'Azul',
        variantKey: VARIANT_KEY,
        variantSku: VARIANT_SKU,
        quantity: SOLD_QUANTITY,
        qty: SOLD_QUANTITY,
        price: UNIT_PRICE,
        unitPrice: UNIT_PRICE,
        lineTotal: UNIT_PRICE * SOLD_QUANTITY,
        requiresShipping: true,
      },
    ],
    subtotal: UNIT_PRICE * SOLD_QUANTITY,
    shipping: 0,
    total: UNIT_PRICE * SOLD_QUANTITY,
    payment: {
      provider: 'manual',
      providerLabel: 'Simulación interna persistente',
      mode: 'sandbox',
      enableWebhook: false,
      checkoutLabel: 'TRAZA DEMO RMA — sin movimiento externo de dinero',
      status: 'paid',
      method: 'transfer',
      methodLabel: 'Prueba RMA sin pasarela',
      amount: UNIT_PRICE * SOLD_QUANTITY,
      amountInCents: UNIT_PRICE * SOLD_QUANTITY * 100,
      currency: 'COP',
      paidAt: now,
      reference: `${PREFIX}-PAY`,
    },
    inventoryControl: {
      reservationRequired: true,
      discountedAtCheckout: true,
    },
    customer: {
      name: 'DEMO',
      lastname: `RMA TRACE ${RUN_ID}`,
      documentType: 'CC',
      id: '1000000000',
      email: 'qa-rma@example.invalid',
      phone: '3000000000',
      city: 'Zona Bananera',
      municipalityCode: '47980',
      department: 'Magdalena',
      departmentCode: '47',
      country: 'Colombia',
      countryCode: 'CO',
    },
    timeline: [
      {
        type: 'system',
        message: `Traza RMA persistente ${PREFIX}. No facturar ni despachar.`,
        by: 'rma-trace-script',
        at: now,
      },
    ],
    notes: [
      {
        text: `SIMULACIÓN PERSISTENTE ${PREFIX}. Conservar para auditoría; no facturar ni despachar físicamente.`,
        by: 'rma-trace-script',
        pinned: true,
        at: now,
      },
    ],
    tags: ['demo', 'orders-trace', 'rma-trace'],
  });

  const reservation = await InventoryReservation.create({
    reservationCode: `RES-${PREFIX}`,
    sessionId: order.sessionId,
    order: order._id,
    orderNumber: order.orderNumber,
    paymentReference: `${PREFIX}-PAY`,
    source: 'system',
    status: 'confirmed',
    items: [
      {
        product: product._id,
        inventoryStock: stock._id,
        branch: branch._id,
        orderItem: order.items[0]._id,
        productSnapshot: {
          title: product.title,
          sku: product.sku,
          category: product.category,
        },
        branchSnapshot: {
          name: branch.name,
          code: branch.code,
          type: branch.type,
        },
        size: 'M',
        color: 'Azul',
        variantKey: VARIANT_KEY,
        variantLabel: 'M / Azul',
        quantity: SOLD_QUANTITY,
        unitPrice: UNIT_PRICE,
        stockBeforeReservation: STOCK_AFTER_SALE + SOLD_QUANTITY,
        reservedBeforeReservation: 0,
        availableBeforeReservation: STOCK_AFTER_SALE + SOLD_QUANTITY,
        confirmedAt: now,
      },
    ],
    total: UNIT_PRICE * SOLD_QUANTITY,
    currency: 'COP',
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    confirmedAt: now,
    metadata: {
      purpose: 'qa-rma-main-database',
      runId: RUN_ID,
    },
  });

  order.inventoryControl.reservationId = reservation._id;
  await order.save();

  return { branch, order, product, reservation, stock };
}

async function stockValue(stockId) {
  const row = await InventoryStock.findById(stockId).lean();
  return {
    stock: Number(row?.stock || 0),
    reservedStock: Number(row?.reservedStock || 0),
    availableStock: Number(row?.availableStock || 0),
  };
}

async function run() {
  assert(
    process.argv.includes(CONFIRMATION_FLAG),
    `Esta demostración conserva todos sus datos en la base principal. Ejecútala únicamente con ${CONFIRMATION_FLAG}.`
  );
  assert(
    MONGO_URI,
    'No existe MONGODB_URI en backend/.env. La prueba no acepta una URI de reemplazo porque debe usar la base principal configurada.'
  );

  console.log(`\nTraza RMA persistente sobre MONGODB_URI principal · ${PREFIX}`);
  console.log('No se llamarán Wompi, Factus ni servicios externos.');
  console.log('La orden, RMA, inventario, kardex, reembolso y eventos se conservarán.');

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await assertTransactionalMongo();
  ok('conexión principal y soporte real de transacciones confirmados');

  const fixture = await createFixture();
  assert.deepStrictEqual(await stockValue(fixture.stock._id), {
    stock: STOCK_AFTER_SALE,
    reservedStock: 0,
    availableStock: STOCK_AFTER_SALE,
  });
  ok('sede, producto, existencia posventa, orden entregada y reserva DEMO persistente creados');

  const orderItemId = String(fixture.order.items[0]._id);
  const requestInput = {
    orderFilter: { _id: fixture.order._id },
    items: [
      {
        orderItemId,
        quantity: SOLD_QUANTITY,
        reasonCode: 'wrong_size',
        reasonText: 'Talla incorrecta en prueba transaccional.',
      },
    ],
    requestedResolution: 'refund',
    reasonSummary: 'Prueba completa RMA sobre MongoDB principal.',
    actor: { label: 'QA RMA Mongo principal', role: 'manager' },
  };
  const concurrentRequests = await Promise.allSettled([
    createOrderReturn(requestInput, { OrderEventModel: OrderEvent }),
    createOrderReturn(requestInput, { OrderEventModel: OrderEvent }),
  ]);
  const successfulRequests = concurrentRequests.filter(
    (result) => result.status === 'fulfilled'
  );
  const rejectedRequests = concurrentRequests.filter(
    (result) => result.status === 'rejected'
  );
  assert.strictEqual(successfulRequests.length, 1);
  assert.strictEqual(rejectedRequests.length, 1);
  assert(
    ['RETURN_QUANTITY_NOT_AVAILABLE', 'ITEM_ALREADY_RETURNED'].includes(
      rejectedRequests[0].reason?.code
    ),
    `La segunda solicitud concurrente falló con un motivo inesperado: ${
      rejectedRequests[0].reason?.code || rejectedRequests[0].reason?.message
    }`
  );
  assert.strictEqual(
    await OrderReturn.countDocuments({ order: fixture.order._id }),
    1
  );
  ok('dos solicitudes simultáneas reservaron las unidades una sola vez');

  let returnCase = successfulRequests[0].value;
  assert.strictEqual(returnCase.status, 'requested');
  assert.strictEqual(returnCase.revision, 0);
  ok('expediente RMA solicitado con estado y revisión inicial persistentes');

  returnCase = await updateOrderReturn(
    {
      orderFilter: { _id: fixture.order._id },
      returnId: returnCase._id,
      action: 'authorize',
      expectedRevision: returnCase.revision,
      payload: {
        items: [{ orderItemId, authorizedQuantity: SOLD_QUANTITY }],
        shipping: {
          method: 'carrier',
          carrierName: 'Transportadora de prueba',
          trackingNumber: `${PREFIX}-TRACK`,
          instructions: 'No corresponde a una guía externa real.',
        },
      },
      actor: { label: 'Bodega QA', role: 'warehouse' },
    },
    { OrderEventModel: OrderEvent }
  );
  assert.strictEqual(returnCase.status, 'authorized');
  assert.strictEqual(returnCase.items[0].authorizedQuantity, SOLD_QUANTITY);
  ok('autorización física aplicada sin alterar inventario');

  returnCase = await updateOrderReturn(
    {
      orderFilter: { _id: fixture.order._id },
      returnId: returnCase._id,
      action: 'mark_in_transit',
      expectedRevision: returnCase.revision,
      payload: {
        shipping: {
          carrierName: 'Transportadora de prueba',
          trackingNumber: `${PREFIX}-TRACK`,
        },
      },
      actor: { label: 'Bodega QA', role: 'warehouse' },
    },
    { OrderEventModel: OrderEvent }
  );
  assert.strictEqual(returnCase.status, 'in_transit');
  ok('tránsito del retorno registrado con revisión optimista');

  returnCase = await updateOrderReturn(
    {
      orderFilter: { _id: fixture.order._id },
      returnId: returnCase._id,
      action: 'receive',
      expectedRevision: returnCase.revision,
      payload: {
        items: [{ orderItemId, receivedQuantity: SOLD_QUANTITY }],
      },
      actor: { label: 'Bodega QA', role: 'warehouse' },
    },
    { OrderEventModel: OrderEvent }
  );
  assert.strictEqual(returnCase.status, 'received');
  assert.strictEqual(returnCase.items[0].receivedQuantity, SOLD_QUANTITY);
  ok('recepción de dos unidades confirmada antes de tocar existencias');

  assert.deepStrictEqual(await stockValue(fixture.stock._id), {
    stock: STOCK_AFTER_SALE,
    reservedStock: 0,
    availableStock: STOCK_AFTER_SALE,
  });

  returnCase = await updateOrderReturn(
    {
      orderFilter: { _id: fixture.order._id },
      returnId: returnCase._id,
      action: 'inspect',
      expectedRevision: returnCase.revision,
      payload: {
        items: [
          {
            orderItemId,
            sellableQuantity: 1,
            damagedQuantity: 1,
            quarantineQuantity: 0,
            rejectedQuantity: 0,
            inspectionNote: 'Una unidad apta y una averiada.',
          },
        ],
      },
      actor: { label: 'Inspector QA', role: 'warehouse' },
    },
    { OrderEventModel: OrderEvent }
  );
  assert.strictEqual(returnCase.status, 'resolution_required');
  assert.strictEqual(returnCase.items[0].acceptedQuantity, SOLD_QUANTITY);
  assert.strictEqual(returnCase.items[0].sellableQuantity, 1);
  assert.strictEqual(returnCase.items[0].damagedQuantity, 1);
  ok('inspección clasificó cada unidad y habilitó la resolución monetaria');

  assert.deepStrictEqual(await stockValue(fixture.stock._id), {
    stock: STOCK_AFTER_SALE + 1,
    reservedStock: 0,
    availableStock: STOCK_AFTER_SALE + 1,
  });
  const returnMovements = await InventoryMovement.find({
    order: fixture.order._id,
    type: 'return_in',
    status: 'posted',
  }).lean();
  assert.strictEqual(returnMovements.length, 1);
  assert.strictEqual(returnMovements[0].quantity, 1);
  assert.strictEqual(returnMovements[0].sourceModel, 'OrderReturn');
  assert.strictEqual(String(returnMovements[0].sourceId), String(returnCase._id));
  ok('solo la unidad vendible volvió al stock y creó un kardex RMA');

  const resolved = await resolveOrderReturnRefund(
    {
      orderFilter: { _id: fixture.order._id },
      returnId: returnCase._id,
      expectedRevision: returnCase.revision,
      amount: UNIT_PRICE * SOLD_QUANTITY,
      actor: { label: 'Facturación QA', role: 'billing' },
    },
    { OrderEventModel: OrderEvent }
  );
  assert.strictEqual(resolved.returnCase.status, 'resolved');
  assert.strictEqual(resolved.returnCase.resolution.type, 'refund');
  assert.strictEqual(resolved.refund.amount, UNIT_PRICE * SOLD_QUANTITY);
  assert.strictEqual(resolved.refund.totalRestockedUnits, 0);
  ok('reembolso se creó después de inspección sin reponer stock por segunda vez');

  const retry = await resolveOrderReturnRefund(
    {
      orderFilter: { _id: fixture.order._id },
      returnId: returnCase._id,
      expectedRevision: returnCase.revision,
      amount: UNIT_PRICE * SOLD_QUANTITY,
      actor: { label: 'Facturación QA', role: 'billing' },
    },
    { OrderEventModel: OrderEvent }
  );
  assert.strictEqual(retry.idempotent, true);
  assert.strictEqual(
    await OrderRefund.countDocuments({ order: fixture.order._id }),
    1
  );
  assert.strictEqual(
    await InventoryMovement.countDocuments({
      order: fixture.order._id,
      type: 'return_in',
      status: 'posted',
    }),
    1
  );
  ok('reintento monetario no duplicó reembolso, stock ni kardex');

  const [persistedOrder, persistedReturn, persistedRefund, returnsView] =
    await Promise.all([
      Order.findById(fixture.order._id).lean(),
      OrderReturn.findById(returnCase._id).lean(),
      OrderRefund.findOne({ order: fixture.order._id }).lean(),
      listOrderReturns({ orderFilter: { _id: fixture.order._id } }),
    ]);
  assert.strictEqual(persistedReturn.status, 'resolved');
  assert.strictEqual(String(persistedReturn.resolution.refund), String(persistedRefund._id));
  assert.strictEqual(String(persistedRefund.returnCase), String(persistedReturn._id));
  assert.strictEqual(persistedOrder.refundControl.transactionCount, 1);
  assert.strictEqual(persistedOrder.refundControl.totalAmount, UNIT_PRICE * SOLD_QUANTITY);
  assert.strictEqual(persistedOrder.returnControl.requestCount, 1);
  assert.strictEqual(returnsView.returns.length, 1);
  assert.strictEqual(returnsView.eligibility[0].availableQuantity, 0);
  assert(
    await OrderEvent.countDocuments({ orderId: fixture.order._id }) >= 7,
    'Faltan eventos auditables del recorrido RMA.'
  );
  ok('orden, RMA, reembolso, elegibilidad y auditoría quedaron enlazados');

  await Promise.all([
    Branch.updateOne(
      { _id: fixture.branch._id },
      {
        $set: {
          status: 'inactive',
          active: false,
          notes: `Traza persistente RMA ${PREFIX}. Conservada e inactiva; no usar comercialmente.`,
        },
      }
    ),
    InventoryStock.updateMany(
      { product: fixture.product._id },
      { $set: { active: false } }
    ),
  ]);

  const preserved = await Promise.all([
    Order.countDocuments({ _id: fixture.order._id }),
    OrderReturn.countDocuments({ _id: returnCase._id }),
    OrderRefund.countDocuments({ _id: persistedRefund._id }),
    InventoryMovement.countDocuments({ order: fixture.order._id, type: 'return_in' }),
    InventoryReservation.countDocuments({ _id: fixture.reservation._id }),
  ]);
  assert.deepStrictEqual(preserved, [1, 1, 1, 1, 1]);
  ok('todos los documentos de la traza quedaron conservados y la sede DEMO quedó inactiva');

  console.log(`\nResultado MongoDB principal: ${passed}/12 verificaciones aprobadas.`);
  console.log(`Buscar orden en el panel: ${ORDER_NUMBER}`);
  console.log(`RMA persistente: ${persistedReturn.returnNumber}`);
  console.log(`Reembolso persistente: ${persistedRefund.refundNumber}`);
  console.log(`Identificador completo: ${PREFIX}`);
  console.log('Persistencia: CONSERVADA (sin limpieza automática).');
}

async function main() {
  try {
    await run();
  } catch (error) {
    console.error('\nFALLO RMA MongoDB principal:', error?.code || error?.message || error);
    if (error?.details) console.error('Detalles:', error.details);
    console.error(`Los documentos alcanzados por ${PREFIX} se conservan para diagnóstico.`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main();
