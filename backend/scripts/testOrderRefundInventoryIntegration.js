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
  confirmInventoryReservation,
} = require('../services/inventoryReservationService');
const {
  processOrderRefund,
} = require('../services/orderRefundService');

const MONGO_URI =
  process.env.PRODUCTS_TEST_MONGO_URI ||
  process.env.MONGODB_REPLICA_URI ||
  process.env.MONGODB_URI ||
  '';
const RUN_ID = Math.random()
  .toString(36)
  .slice(2, 9)
  .toUpperCase();
const PREFIX = `REFUND-${RUN_ID}`;

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
        message: { type: String },
        meta: { type: Object },
      },
      {
        timestamps: {
          createdAt: true,
          updatedAt: false,
        },
        versionKey: false,
      }
    ),
    'order_events'
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

function productInput(overrides = {}) {
  return {
    sku: `${PREFIX}-${Math.random().toString(36).slice(2, 8)}`,
    title: `${PREFIX} Producto`,
    description: 'Producto temporal para validar devoluciones.',
    category: `${PREFIX} Pruebas`,
    price: 50000,
    active: true,
    visible: true,
    ...overrides,
  };
}

async function cleanup() {
  if (ids.orders.length) {
    await OrderEvent.deleteMany({
      orderId: { $in: ids.orders },
    });
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

async function stockValue(product, variantKey) {
  const row = await InventoryStock.findOne({
    product,
    variantKey,
    deletedAt: null,
  }).lean();
  return {
    stock: Number(row?.stock || 0),
    availableStock: Number(row?.availableStock || 0),
  };
}

async function run() {
  assert(
    MONGO_URI,
    'PRODUCTS_TEST_MONGO_URI/MONGODB_REPLICA_URI no está configurado.'
  );
  await mongoose.connect(MONGO_URI);

  try {
    await cleanup();

    const branch = await Branch.create({
      name: `${PREFIX} Sede`,
      code: `${PREFIX}-BR`,
      type: 'store',
      status: 'active',
      active: true,
      settings: {
        allowPosSales: true,
        allowNegativeStock: false,
      },
    });
    ids.branches.push(branch._id);

    const physical = await Product.create(
      productInput({
        sku: `${PREFIX}-PHY`,
        title: `${PREFIX} Camiseta`,
        productType: 'physical',
        trackInventory: true,
        variants: [
          {
            variantKey: 'm__azul',
            label: 'M / Azul',
            size: 'M',
            color: 'Azul',
            sku: `${PREFIX}-PHY-M-AZ`,
            initialStock: 0,
          },
          {
            variantKey: 'l__rojo',
            label: 'L / Rojo',
            size: 'L',
            color: 'Rojo',
            sku: `${PREFIX}-PHY-L-RO`,
            initialStock: 0,
          },
        ],
      })
    );
    const component = await Product.create(
      productInput({
        sku: `${PREFIX}-CMP`,
        title: `${PREFIX} Accesorio`,
        productType: 'physical',
        trackInventory: true,
        variants: [
          {
            variantKey: 'unica__negro',
            label: 'Única / Negro',
            size: 'Única',
            color: 'Negro',
            sku: `${PREFIX}-CMP-UN-NE`,
            initialStock: 0,
          },
        ],
      })
    );
    const digital = await Product.create(
      productInput({
        sku: `${PREFIX}-DIG`,
        title: `${PREFIX} Guía digital`,
        productType: 'digital',
        digitalDelivery: {
          deliveryMode: 'manual',
          fileName: 'guia.pdf',
        },
      })
    );
    const bundle = await Product.create(
      productInput({
        sku: `${PREFIX}-BND`,
        title: `${PREFIX} Combo`,
        productType: 'bundle',
        price: 100000,
        bundleComponents: [
          {
            product: component._id,
            variantKey: 'unica__negro',
            quantity: 2,
            title: component.title,
            sku: `${PREFIX}-CMP-UN-NE`,
            productType: 'physical',
            size: 'Única',
            color: 'Negro',
            trackInventory: true,
            allowBackorder: false,
            requiresShipping: true,
          },
          {
            product: digital._id,
            variantKey: 'default__default',
            quantity: 1,
            title: digital.title,
            sku: digital.sku,
            productType: 'digital',
            trackInventory: false,
            allowBackorder: false,
            requiresShipping: false,
          },
        ],
      })
    );
    ids.products.push(
      physical._id,
      component._id,
      digital._id,
      bundle._id
    );
    ok('Catálogo temporal con variante, digital y combo creado');

    await InventoryStock.create([
      {
        branch: branch._id,
        product: physical._id,
        variantKey: 'm__azul',
        variant: {
          size: 'M',
          color: 'Azul',
          sku: `${PREFIX}-PHY-M-AZ`,
        },
        stock: 10,
        reservedStock: 0,
        availableStock: 10,
        active: true,
        deletedAt: null,
      },
      {
        branch: branch._id,
        product: physical._id,
        variantKey: 'l__rojo',
        variant: {
          size: 'L',
          color: 'Rojo',
          sku: `${PREFIX}-PHY-L-RO`,
        },
        stock: 6,
        reservedStock: 0,
        availableStock: 6,
        active: true,
        deletedAt: null,
      },
      {
        branch: branch._id,
        product: component._id,
        variantKey: 'unica__negro',
        variant: {
          size: 'Única',
          color: 'Negro',
          sku: `${PREFIX}-CMP-UN-NE`,
        },
        stock: 20,
        reservedStock: 0,
        availableStock: 20,
        active: true,
        deletedAt: null,
      },
    ]);

    const order = await Order.create({
      orderNumber: `${PREFIX}-001`,
      sessionId: `${PREFIX}-SESSION`,
      status: 'paid',
      total: 400000,
      subtotal: 400000,
      payment: {
        provider: 'manual',
        status: 'paid',
        amount: 400000,
        currency: 'COP',
        paidAt: new Date(),
      },
      inventoryControl: {
        reservationRequired: true,
        discountedAtCheckout: false,
      },
      items: [
        {
          product: physical._id,
          productId: String(physical._id),
          title: physical.title,
          productType: 'physical',
          size: 'M',
          color: 'Azul',
          variantKey: 'm__azul',
          quantity: 3,
          qty: 3,
          price: 50000,
          unitPrice: 50000,
          lineTotal: 150000,
        },
        {
          product: bundle._id,
          productId: String(bundle._id),
          title: bundle.title,
          productType: 'bundle',
          variantKey: 'default__default',
          quantity: 2,
          qty: 2,
          price: 100000,
          unitPrice: 100000,
          lineTotal: 200000,
          fulfillmentSnapshot: {
            productType: 'bundle',
            kind: 'bundle',
            bundle: {
              components: [
                {
                  product: component._id,
                  productType: 'physical',
                  variantKey: 'unica__negro',
                  quantity: 2,
                },
                {
                  product: digital._id,
                  productType: 'digital',
                  variantKey: 'default__default',
                  quantity: 1,
                },
              ],
            },
          },
        },
        {
          product: digital._id,
          productId: String(digital._id),
          title: digital.title,
          productType: 'digital',
          variantKey: 'default__default',
          quantity: 1,
          qty: 1,
          price: 50000,
          unitPrice: 50000,
          lineTotal: 50000,
        },
      ],
    });
    ids.orders.push(order._id);

    const reservation = await createInventoryReservation({
      sessionId: `${PREFIX}-SESSION`,
      order: order._id,
      orderNumber: order.orderNumber,
      source: 'checkout',
      items: order.items.map((item) => ({
        productId: item.productId,
        title: item.title,
        productType: item.productType,
        size: item.size,
        color: item.color,
        variantKey: item.variantKey,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      branchPriorityIds: [branch._id],
      total: order.total,
    });
    order.inventoryControl.reservationId = reservation._id;
    await order.save();
    await confirmInventoryReservation(
      reservation._id,
      {
        order: order._id,
        orderNumber: order.orderNumber,
        paymentReference: `${PREFIX}-PAY`,
      }
    );

    assert.deepStrictEqual(
      await stockValue(physical._id, 'm__azul'),
      { stock: 7, availableStock: 7 }
    );
    assert.deepStrictEqual(
      await stockValue(component._id, 'unica__negro'),
      { stock: 16, availableStock: 16 }
    );
    ok('La venta confirmó la variante y cuatro componentes del combo');

    const firstPayload = {
      orderId: order._id,
      amount: 200000,
      reason: 'Devolución parcial validada',
      idempotencyKey: `${PREFIX}-RETURN-1`,
      adminLabel: 'ci-products',
      items: [
        {
          orderItemId: order.items[0]._id,
          quantity: 1,
        },
        {
          orderItemId: order.items[1]._id,
          quantity: 1,
        },
        {
          orderItemId: order.items[2]._id,
          quantity: 1,
        },
      ],
    };
    const first = await processOrderRefund(firstPayload, {
      OrderEventModel: OrderEvent,
    });
    assert.strictEqual(first.idempotent, false);
    assert.strictEqual(first.refund.totalReturnedUnits, 3);
    assert.strictEqual(first.refund.totalRestockedUnits, 3);
    assert.deepStrictEqual(
      await stockValue(physical._id, 'm__azul'),
      { stock: 8, availableStock: 8 }
    );
    assert.deepStrictEqual(
      await stockValue(component._id, 'unica__negro'),
      { stock: 18, availableStock: 18 }
    );
    assert.deepStrictEqual(
      await stockValue(physical._id, 'l__rojo'),
      { stock: 6, availableStock: 6 }
    );
    ok('Reembolso parcial repuso variante y componentes en su sede original');

    const returnMovementsAfterFirst =
      await InventoryMovement.countDocuments({
        order: order._id,
        type: 'return_in',
        status: 'posted',
      });
    assert.strictEqual(returnMovementsAfterFirst, 2);
    ok('Kardex registró return_in sin movimiento para el digital');

    const retry = await processOrderRefund(firstPayload, {
      OrderEventModel: OrderEvent,
    });
    assert.strictEqual(retry.idempotent, true);
    assert.strictEqual(
      await InventoryMovement.countDocuments({
        order: order._id,
        type: 'return_in',
        status: 'posted',
      }),
      2
    );
    assert.deepStrictEqual(
      await stockValue(physical._id, 'm__azul'),
      { stock: 8, availableStock: 8 }
    );
    ok('Reintento idempotente no duplicó stock ni movimientos');

    const second = await processOrderRefund(
      {
        orderId: order._id,
        amount: 200000,
        reason: 'Cierre de devolución',
        idempotencyKey: `${PREFIX}-RETURN-2`,
        adminLabel: 'ci-products',
        items: [
          {
            orderItemId: order.items[0]._id,
            quantity: 2,
          },
          {
            orderItemId: order.items[1]._id,
            quantity: 1,
          },
        ],
      },
      {
        OrderEventModel: OrderEvent,
      }
    );
    assert.strictEqual(second.idempotent, false);
    assert.deepStrictEqual(
      await stockValue(physical._id, 'm__azul'),
      { stock: 10, availableStock: 10 }
    );
    assert.deepStrictEqual(
      await stockValue(component._id, 'unica__negro'),
      { stock: 20, availableStock: 20 }
    );
    ok('Segundo reembolso parcial completó la reposición exacta');

    const refreshedOrder = await Order.findById(order._id).lean();
    assert.strictEqual(
      Number(refreshedOrder.refundControl?.totalAmount),
      400000
    );
    assert.strictEqual(
      Number(refreshedOrder.refundControl?.transactionCount),
      2
    );
    assert.strictEqual(
      Number(refreshedOrder.refundControl?.returnedUnits),
      6
    );
    assert.strictEqual(
      Number(refreshedOrder.refundControl?.restockedUnits),
      7
    );
    ok('Orden conserva totales acumulados de reembolsos y devoluciones');

    await assert.rejects(
      () =>
        processOrderRefund(
          {
            orderId: order._id,
            amount: 1,
            reason: 'Intento duplicado',
            idempotencyKey: `${PREFIX}-RETURN-3`,
            items: [
              {
                orderItemId: order.items[0]._id,
                quantity: 1,
              },
            ],
          },
          {
            OrderEventModel: OrderEvent,
          }
        ),
      (error) =>
        error?.code ===
        'REFUND_QUANTITY_EXCEEDS_PURCHASED'
    );
    assert.deepStrictEqual(
      await stockValue(physical._id, 'm__azul'),
      { stock: 10, availableStock: 10 }
    );
    ok('Cantidad ya devuelta no puede reponerse otra vez');

    assert.strictEqual(
      await OrderRefund.countDocuments({
        order: order._id,
        status: 'processed',
      }),
      2
    );
    assert.strictEqual(
      await OrderEvent.countDocuments({
        orderId: order._id,
        type: 'refund_created',
        'meta.refundId': { $exists: true },
      }),
      2
    );
    ok('Persistencia de dos reembolsos y dos eventos auditables');

    console.log(
      `\nResultado reembolsos e inventario: ${passed}/9 verificaciones aprobadas.`
    );
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
