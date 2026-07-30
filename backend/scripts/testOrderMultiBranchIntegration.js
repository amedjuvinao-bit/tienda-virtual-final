/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryReservation = require('../models/InventoryReservation');
const {
  createInventoryReservation,
} = require('../services/inventoryReservationService');
const {
  applyReservationToOrderDocument,
} = require('../services/orderInventoryAllocationService');
const {
  transitionOrderStatus,
} = require('../services/orderStatusTransitionService');
const {
  processOrderRefund,
} = require('../services/orderRefundService');
const {
  buildVariantKey,
} = require('../lib/products/productVariantConfig');

const MONGO_URI =
  process.env.PRODUCTS_TEST_MONGO_URI ||
  process.env.MONGODB_REPLICA_URI ||
  process.env.MONGODB_URI ||
  '';
const RUN_ID = Math.random()
  .toString(36)
  .slice(2, 9)
  .toUpperCase();
const PREFIX = `MULTI-${RUN_ID}`;
const VARIANT_ATTRIBUTES = [
  { key: 'capacidad', label: 'Capacidad', value: '128GB' },
  { key: 'ram', label: 'RAM', value: '8GB' },
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

const ids = {
  products: [],
  orders: [],
  branches: [],
};
let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

async function cleanup() {
  if (ids.orders.length) {
    await OrderRefund.deleteMany({
      order: { $in: ids.orders },
    });
    await InventoryReservation.deleteMany({
      order: { $in: ids.orders },
    });
    await Order.deleteMany({
      _id: { $in: ids.orders },
    });
  }

  if (ids.products.length) {
    await InventoryMovement.deleteMany({
      product: { $in: ids.products },
    });
    await InventoryStock.deleteMany({
      product: { $in: ids.products },
    });
    await Product.deleteMany({
      _id: { $in: ids.products },
    });
  }

  if (ids.branches.length) {
    await Branch.deleteMany({
      _id: { $in: ids.branches },
    });
  }
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

async function stockState(product, branch) {
  const row = await InventoryStock.findOne({
    product,
    branch,
    variantKey: VARIANT_KEY,
    deletedAt: null,
  }).lean();

  return {
    stock: Number(row?.stock || 0),
    reserved: Number(row?.reservedStock || 0),
    available: Number(row?.availableStock || 0),
  };
}

async function createOrderWithReservation({
  suffix,
  product,
  primaryBranch,
}) {
  const order = await Order.create({
    orderNumber: `${PREFIX}-${suffix}`,
    sessionId: `${PREFIX}-SESSION-${suffix}`,
    status: 'pending',
    branch: primaryBranch._id,
    branchSnapshot: {
      name: primaryBranch.name,
      code: primaryBranch.code,
      type: primaryBranch.type,
    },
    subtotal: 300000,
    total: 300000,
    items: [
      {
        product: product._id,
        productId: String(product._id),
        title: product.title,
        productType: 'physical',
        requiresShipping: true,
        fulfillmentKind: 'shipment',
        variantKey: VARIANT_KEY,
        variantLabel: '128GB / 8GB / Azul / 5G',
        variantAttributes: VARIANT_ATTRIBUTES,
        size: '',
        color: 'Azul',
        quantity: 3,
        qty: 3,
        price: 100000,
        unitPrice: 100000,
        lineTotal: 300000,
      },
    ],
    payment: {
      provider: 'manual',
      providerLabel: 'Pago manual',
      status: 'pending_manual',
      amount: 300000,
      currency: 'COP',
    },
    inventoryControl: {
      reservationRequired: true,
      discountedAtCheckout: false,
      restockedOnFailure: false,
    },
  });
  ids.orders.push(order._id);

  const reservation = await createInventoryReservation({
    sessionId: order.sessionId,
    order: order._id,
    orderNumber: order.orderNumber,
    source: 'checkout',
    items: order.items,
    branchPriorityIds: [String(primaryBranch._id)],
    currency: 'COP',
  });

  order.inventoryControl.reservationId = reservation._id;
  applyReservationToOrderDocument(order, reservation);
  await order.save();
  return order;
}

async function run() {
  assert(
    MONGO_URI,
    'PRODUCTS_TEST_MONGO_URI/MONGODB_REPLICA_URI no está configurado.'
  );
  await mongoose.connect(MONGO_URI);

  try {
    await cleanup();

    const [branchA, branchB] = await Branch.create([
      {
        name: `${PREFIX} Centro`,
        code: `${PREFIX}-A`,
        type: 'store',
        status: 'active',
        active: true,
      },
      {
        name: `${PREFIX} Bodega Norte`,
        code: `${PREFIX}-B`,
        type: 'warehouse',
        status: 'active',
        active: true,
      },
    ]);
    ids.branches.push(branchA._id, branchB._id);

    const product = await Product.create({
      sku: `${PREFIX}-PHONE`,
      title: `${PREFIX} Teléfono`,
      description: 'Producto temporal para orden multisede.',
      category: `${PREFIX} Pruebas`,
      productType: 'physical',
      trackInventory: true,
      price: 100000,
      active: true,
      visible: true,
      variants: [
        {
          variantKey: VARIANT_KEY,
          label: '128GB / 8GB / Azul / 5G',
          attributes: VARIANT_ATTRIBUTES,
          color: 'Azul',
          sku: `${PREFIX}-PHONE-128-8-AZ-5G`,
          initialStock: 0,
        },
      ],
    });
    ids.products.push(product._id);

    await InventoryStock.create([
      {
        branch: branchA._id,
        product: product._id,
        variantKey: VARIANT_KEY,
        variant: {
          label: '128GB / 8GB / Azul / 5G',
          attributes: VARIANT_ATTRIBUTES,
          color: 'Azul',
          sku: `${PREFIX}-PHONE-128-8-AZ-5G`,
        },
        stock: 2,
        reservedStock: 0,
        availableStock: 2,
        active: true,
        deletedAt: null,
      },
      {
        branch: branchB._id,
        product: product._id,
        variantKey: VARIANT_KEY,
        variant: {
          label: '128GB / 8GB / Azul / 5G',
          attributes: VARIANT_ATTRIBUTES,
          color: 'Azul',
          sku: `${PREFIX}-PHONE-128-8-AZ-5G`,
        },
        stock: 2,
        reservedStock: 0,
        availableStock: 2,
        active: true,
        deletedAt: null,
      },
    ]);
    ok('Catálogo y dos sedes temporales creados');

    let order = await createOrderWithReservation({
      suffix: 'SALE',
      product,
      primaryBranch: branchA,
    });
    assert.strictEqual(
      order.inventoryAllocationSummary.branchCount,
      2
    );
    assert.strictEqual(
      order.inventoryAllocationSummary.splitAcrossBranches,
      true
    );
    assert.strictEqual(
      branchQuantity(order, branchA._id, 'reservedQuantity'),
      2
    );
    assert.strictEqual(
      branchQuantity(order, branchB._id, 'reservedQuantity'),
      1
    );
    assert.strictEqual(String(order.branch), String(branchA._id));
    ok('La reserva 2 + 1 queda visible sin reemplazar la sede preferida');

    const reservedA = await stockState(product._id, branchA._id);
    const reservedB = await stockState(product._id, branchB._id);
    assert.deepStrictEqual(reservedA, {
      stock: 2,
      reserved: 2,
      available: 0,
    });
    assert.deepStrictEqual(reservedB, {
      stock: 2,
      reserved: 1,
      available: 1,
    });
    ok('El stock reservado coincide con cada asignación');

    await transitionOrderStatus({
      orderId: order._id,
      status: 'paid',
      actor: {
        label: 'ci-products',
        source: 'integration',
      },
    });
    order = await Order.findById(order._id).lean();
    assert.strictEqual(
      order.inventoryAllocationSummary.soldQuantity,
      3
    );
    assert.strictEqual(
      branchQuantity(order, branchA._id, 'soldQuantity'),
      2
    );
    assert.strictEqual(
      branchQuantity(order, branchB._id, 'soldQuantity'),
      1
    );
    assert.deepStrictEqual(
      await stockState(product._id, branchA._id),
      { stock: 0, reserved: 0, available: 0 }
    );
    assert.deepStrictEqual(
      await stockState(product._id, branchB._id),
      { stock: 1, reserved: 0, available: 1 }
    );
    ok('El pago descuenta exactamente las dos sedes');

    const saleMovements = await InventoryMovement.find({
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
    ok('El kardex conserva una salida independiente por sede');

    await transitionOrderStatus({
      orderId: order._id,
      status: 'shipped',
      actor: {
        label: 'ci-products',
        source: 'integration',
      },
    });
    order = await Order.findById(order._id).lean();
    assert.strictEqual(
      order.inventoryAllocationSummary.shippedQuantity,
      3
    );
    assert.strictEqual(
      branchQuantity(order, branchA._id, 'shippedQuantity'),
      2
    );
    assert.strictEqual(
      branchQuantity(order, branchB._id, 'shippedQuantity'),
      1
    );
    ok('El despacho queda cuantificado por cada sede');

    await transitionOrderStatus({
      orderId: order._id,
      status: 'delivered',
      actor: {
        label: 'ci-products',
        source: 'integration',
      },
    });
    order = await Order.findById(order._id).lean();
    assert.strictEqual(
      order.inventoryAllocationSummary.deliveredQuantity,
      3
    );
    assert(
      order.inventoryAllocations.every(
        (allocation) => allocation.status === 'delivered'
      )
    );
    ok('La entrega cierra las asignaciones de ambas sedes');

    await processOrderRefund({
      orderId: order._id,
      amount: 300000,
      reason: 'Devolución total multisede',
      items: [
        {
          orderItemId: String(order.items[0]._id),
          quantity: 3,
          restock: true,
        },
      ],
      idempotencyKey: `${PREFIX}-REFUND`,
      adminLabel: 'ci-products',
    });
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
    assert.deepStrictEqual(
      await stockState(product._id, branchA._id),
      { stock: 2, reserved: 0, available: 2 }
    );
    assert.deepStrictEqual(
      await stockState(product._id, branchB._id),
      { stock: 2, reserved: 0, available: 2 }
    );
    ok('La devolución repone la cantidad original en cada sede');

    const returnMovements = await InventoryMovement.find({
      order: order._id,
      type: 'return_in',
      status: 'posted',
    }).lean();
    assert.strictEqual(returnMovements.length, 2);
    assert.strictEqual(
      new Set(
        returnMovements.map((movement) =>
          String(movement.branchTo)
        )
      ).size,
      2
    );
    ok('El kardex de devolución mantiene las dos ubicaciones');

    const cancelledOrder = await createOrderWithReservation({
      suffix: 'CANCEL',
      product,
      primaryBranch: branchA,
    });
    await transitionOrderStatus({
      orderId: cancelledOrder._id,
      status: 'cancelled',
      actor: {
        label: 'ci-products',
        source: 'integration',
      },
    });
    const cancelled = await Order.findById(
      cancelledOrder._id
    ).lean();
    assert.strictEqual(
      cancelled.inventoryAllocationSummary.releasedQuantity,
      3
    );
    assert.strictEqual(
      cancelled.inventoryAllocationSummary.activeReservedQuantity,
      0
    );
    assert(
      cancelled.inventoryAllocations.every(
        (allocation) => allocation.status === 'released'
      )
    );
    assert.deepStrictEqual(
      await stockState(product._id, branchA._id),
      { stock: 2, reserved: 0, available: 2 }
    );
    assert.deepStrictEqual(
      await stockState(product._id, branchB._id),
      { stock: 2, reserved: 0, available: 2 }
    );
    ok('Cancelar libera todas las sedes sin descontar existencias');

    const visibleFromSecondaryBranch = await Order.countDocuments({
      _id: order._id,
      'inventoryAllocations.branch': branchB._id,
    });
    assert.strictEqual(visibleFromSecondaryBranch, 1);
    ok('La sede secundaria puede localizar la orden compartida');

    console.log(
      `\nÓrdenes multisede: ${passed}/10 verificaciones aprobadas.`
    );
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(
    '\nFALLO integración de órdenes multisede:',
    error
  );
  process.exitCode = 1;
});
