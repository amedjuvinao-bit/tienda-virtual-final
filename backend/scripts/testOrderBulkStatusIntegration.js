/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Order = require('../models/Order');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryReservation = require('../models/InventoryReservation');
const {
  createInventoryReservation,
} = require('../services/inventoryReservationService');
const {
  processBulkOrderStatusTransitions,
} = require('../services/orderStatusTransitionService');

const MONGO_URI =
  process.env.PRODUCTS_TEST_MONGO_URI ||
  process.env.MONGODB_REPLICA_URI ||
  process.env.MONGODB_URI ||
  '';
const RUN_ID = Math.random()
  .toString(36)
  .slice(2, 9)
  .toUpperCase();
const PREFIX = `BULK-${RUN_ID}`;

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
    description: 'Producto temporal para estados masivos.',
    category: `${PREFIX} Pruebas`,
    price: 50000,
    active: true,
    visible: true,
    ...overrides,
  };
}

function orderItem(product, overrides = {}) {
  const quantity = Number(overrides.quantity || 1);
  const price = Number(overrides.price || product.price || 50000);

  return {
    product: product._id,
    productId: String(product._id),
    title: product.title,
    productType: product.productType || 'physical',
    requiresShipping:
      !['digital', 'service'].includes(product.productType),
    fulfillmentKind:
      product.productType === 'digital'
        ? 'digital_delivery'
        : product.productType === 'service'
          ? 'service'
          : product.productType === 'bundle'
            ? 'bundle'
            : 'shipment',
    size: '',
    color: '',
    variantKey: 'default__default',
    quantity,
    qty: quantity,
    price,
    unitPrice: price,
    lineTotal: quantity * price,
    ...overrides,
  };
}

async function cleanup() {
  if (ids.orders.length) {
    await OrderEvent.deleteMany({
      orderId: { $in: ids.orders },
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

async function getStock(product, variantKey, branch) {
  const row = await InventoryStock.findOne({
    product,
    variantKey,
    branch,
    deletedAt: null,
  }).lean();

  return {
    stock: Number(row?.stock || 0),
    reservedStock: Number(row?.reservedStock || 0),
    availableStock: Number(row?.availableStock || 0),
  };
}

async function createOrder({
  suffix,
  items,
  branch,
  reservationRequired,
}) {
  const total = items.reduce(
    (sum, item) => sum + Number(item.lineTotal || 0),
    0
  );
  const order = await Order.create({
    orderNumber: `${PREFIX}-${suffix}`,
    sessionId: `${PREFIX}-SESSION-${suffix}`,
    status: 'pending',
    branch: branch._id,
    branchSnapshot: {
      name: branch.name,
      code: branch.code,
      type: branch.type,
    },
    subtotal: total,
    total,
    items,
    payment: {
      provider: 'manual',
      providerLabel: 'Pago manual',
      status: 'pending_manual',
      amount: total,
      currency: 'COP',
    },
    inventoryControl: {
      reservationRequired,
      discountedAtCheckout: false,
      restockedOnFailure: false,
      restockedAt: null,
    },
  });
  ids.orders.push(order._id);

  if (!reservationRequired) return order;

  const reservation = await createInventoryReservation({
    sessionId: order.sessionId,
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
  return order;
}

async function bulk(orderIds, status) {
  return processBulkOrderStatusTransitions(
    {
      orderIds,
      status,
      actor: {
        label: 'ci-products',
        source: 'admin_bulk',
      },
    },
    {
      OrderEventModel: OrderEvent,
    }
  );
}

async function run() {
  assert(
    MONGO_URI,
    'PRODUCTS_TEST_MONGO_URI/MONGODB_REPLICA_URI no está configurado.'
  );
  process.env.DIGITAL_DELIVERY_TOKEN_SECRET =
    'bulk-status-ci-secret';
  process.env.PUBLIC_BACKEND_URL = 'https://backend.example';

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
            label: 'Unica / Negro',
            size: 'Unica',
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
        trackInventory: false,
        digitalDelivery: {
          deliveryMode: 'manual',
          fileName: 'guia.pdf',
        },
      })
    );
    const service = await Product.create(
      productInput({
        sku: `${PREFIX}-SRV`,
        title: `${PREFIX} Asesoría`,
        productType: 'service',
        trackInventory: false,
        serviceDelivery: {
          fulfillmentMode: 'scheduled',
          locationType: 'online',
          durationMinutes: 60,
        },
      })
    );
    const bundle = await Product.create(
      productInput({
        sku: `${PREFIX}-BND`,
        title: `${PREFIX} Combo físico`,
        productType: 'bundle',
        trackInventory: false,
        price: 90000,
        bundleComponents: [
          {
            product: component._id,
            variantKey: 'unica__negro',
            quantity: 2,
            title: component.title,
            sku: `${PREFIX}-CMP-UN-NE`,
            productType: 'physical',
            size: 'Unica',
            color: 'Negro',
            trackInventory: true,
            allowBackorder: false,
            requiresShipping: true,
          },
        ],
      })
    );
    ids.products.push(
      physical._id,
      component._id,
      digital._id,
      service._id,
      bundle._id
    );

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
        product: component._id,
        variantKey: 'unica__negro',
        variant: {
          size: 'Unica',
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
    ok('Catálogo temporal con físico, combo, digital y servicio creado');

    const physicalOrder = await createOrder({
      suffix: 'PAID',
      branch,
      reservationRequired: true,
      items: [
        orderItem(physical, {
          size: 'M',
          color: 'Azul',
          variantKey: 'm__azul',
          quantity: 2,
          qty: 2,
          lineTotal: 100000,
        }),
      ],
    });
    const comboOrder = await createOrder({
      suffix: 'CANCEL',
      branch,
      reservationRequired: true,
      items: [
        orderItem(bundle, {
          productType: 'bundle',
          fulfillmentKind: 'bundle',
          requiresShipping: true,
          quantity: 1,
          qty: 1,
          price: 90000,
          unitPrice: 90000,
          lineTotal: 90000,
        }),
      ],
    });
    const failedOrder = await createOrder({
      suffix: 'FAILED',
      branch,
      reservationRequired: true,
      items: [
        orderItem(physical, {
          size: 'M',
          color: 'Azul',
          variantKey: 'm__azul',
          quantity: 1,
          qty: 1,
          lineTotal: 50000,
        }),
      ],
    });
    const legacyPaidOrder = await createOrder({
      suffix: 'LEGACY-PAID',
      branch,
      reservationRequired: true,
      items: [
        orderItem(physical, {
          size: 'M',
          color: 'Azul',
          variantKey: 'm__azul',
          quantity: 1,
          qty: 1,
          lineTotal: 50000,
        }),
      ],
    });
    legacyPaidOrder.status = 'paid';
    await legacyPaidOrder.save();
    const virtualOrder = await createOrder({
      suffix: 'VIRTUAL',
      branch,
      reservationRequired: false,
      items: [
        orderItem(digital, {
          productType: 'digital',
          fulfillmentKind: 'digital_delivery',
          requiresShipping: false,
          lineTotal: 50000,
        }),
        orderItem(service, {
          productType: 'service',
          fulfillmentKind: 'service',
          requiresShipping: false,
          lineTotal: 50000,
        }),
      ],
    });
    ok('Cinco órdenes con reservas y un estado heredado creadas');

    assert.deepStrictEqual(
      await getStock(physical._id, 'm__azul', branch._id),
      {
        stock: 10,
        reservedStock: 4,
        availableStock: 6,
      }
    );
    assert.deepStrictEqual(
      await getStock(component._id, 'unica__negro', branch._id),
      {
        stock: 20,
        reservedStock: 2,
        availableStock: 18,
      }
    );
    ok('Las reservas previas reflejan variantes y componentes del combo');

    const paidResult = await bulk(
      [physicalOrder._id, virtualOrder._id],
      'paid'
    );
    assert.strictEqual(paidResult.modified, 2);
    assert.strictEqual(paidResult.failed, 0);
    assert.deepStrictEqual(
      await getStock(physical._id, 'm__azul', branch._id),
      {
        stock: 8,
        reservedStock: 2,
        availableStock: 6,
      }
    );
    ok('Pago masivo confirmó y descontó la variante física exacta');

    const paidReservation = await InventoryReservation.findOne({
      order: physicalOrder._id,
    }).lean();
    assert.strictEqual(paidReservation.status, 'confirmed');
    assert.strictEqual(
      await InventoryMovement.countDocuments({
        order: physicalOrder._id,
        type: 'sale_out',
        status: 'posted',
      }),
      1
    );
    ok('Pago masivo dejó reserva confirmada y movimiento sale_out');

    const reconciledPaid = await bulk(
      [legacyPaidOrder._id],
      'paid'
    );
    assert.strictEqual(reconciledPaid.modified, 1);
    assert.strictEqual(reconciledPaid.results[0].reconciled, true);
    assert.strictEqual(
      reconciledPaid.results[0].statusChanged,
      false
    );
    const refreshedLegacyPaid = await Order.findById(
      legacyPaidOrder._id
    ).lean();
    const legacyReservation = await InventoryReservation.findOne({
      order: legacyPaidOrder._id,
    }).lean();
    assert.strictEqual(refreshedLegacyPaid.payment.status, 'paid');
    assert.strictEqual(legacyReservation.status, 'confirmed');
    assert.deepStrictEqual(
      await getStock(physical._id, 'm__azul', branch._id),
      {
        stock: 7,
        reservedStock: 1,
        availableStock: 6,
      }
    );
    assert.strictEqual(
      await OrderEvent.countDocuments({
        orderId: legacyPaidOrder._id,
        type: 'status_reconciled',
      }),
      1
    );
    ok('Una orden pagada por el flujo antiguo quedó conciliada sin duplicarse');

    const refreshedVirtual = await Order.findById(
      virtualOrder._id
    ).lean();
    assert.strictEqual(refreshedVirtual.payment.status, 'paid');
    assert.strictEqual(
      refreshedVirtual.fulfillment.digitalDeliveries.length,
      1
    );
    assert.strictEqual(
      refreshedVirtual.fulfillment.services.length,
      1
    );
    assert.strictEqual(
      await InventoryReservation.countDocuments({
        order: virtualOrder._id,
      }),
      0
    );
    ok('Digital y servicio activaron cumplimiento sin crear inventario');

    const idempotentPaid = await bulk(
      [physicalOrder._id, virtualOrder._id],
      'paid'
    );
    assert.strictEqual(idempotentPaid.modified, 0);
    assert.strictEqual(idempotentPaid.unchanged, 2);
    assert.strictEqual(
      await InventoryMovement.countDocuments({
        order: physicalOrder._id,
        type: 'sale_out',
      }),
      1
    );
    ok('Repetir el pago masivo no duplicó descuento ni cumplimiento');

    const cancelledResult = await bulk(
      [comboOrder._id, physicalOrder._id],
      'cancelled'
    );
    assert.strictEqual(cancelledResult.modified, 1);
    assert.strictEqual(cancelledResult.failed, 1);
    assert.strictEqual(
      cancelledResult.results.find(
        (result) => !result.ok
      ).code,
      'ORDER_REFUND_REQUIRED'
    );
    assert.deepStrictEqual(
      await getStock(component._id, 'unica__negro', branch._id),
      {
        stock: 20,
        reservedStock: 0,
        availableStock: 20,
      }
    );
    ok('Cancelación parcial liberó el combo y rechazó la orden pagada');

    const comboReservation = await InventoryReservation.findOne({
      order: comboOrder._id,
    }).lean();
    assert.strictEqual(comboReservation.status, 'cancelled');
    assert.strictEqual(
      await InventoryMovement.countDocuments({
        order: comboOrder._id,
        type: 'sale_out',
      }),
      0
    );
    ok('Combo cancelado no descontó componentes ni creó venta');

    const failedResult = await bulk(
      [failedOrder._id],
      'failed'
    );
    assert.strictEqual(failedResult.modified, 1);
    const failedReservation = await InventoryReservation.findOne({
      order: failedOrder._id,
    }).lean();
    assert.strictEqual(failedReservation.status, 'failed');
    assert.deepStrictEqual(
      await getStock(physical._id, 'm__azul', branch._id),
      {
        stock: 7,
        reservedStock: 0,
        availableStock: 7,
      }
    );
    ok('Estado fallido liberó la reserva sin reponer stock nunca vendido');

    const directRefund = await bulk(
      [physicalOrder._id],
      'refunded'
    );
    assert.strictEqual(directRefund.modified, 0);
    assert.strictEqual(directRefund.failed, 1);
    assert.strictEqual(
      directRefund.results[0].code,
      'ORDER_REFUND_REQUIRED'
    );
    ok('Reembolsado directo quedó bloqueado para exigir devolución');

    const shipped = await bulk(
      [physicalOrder._id],
      'shipped'
    );
    const delivered = await bulk(
      [physicalOrder._id],
      'delivered'
    );
    assert.strictEqual(shipped.modified, 1);
    assert.strictEqual(delivered.modified, 1);
    const finalPhysical = await Order.findById(
      physicalOrder._id
    ).lean();
    assert.strictEqual(finalPhysical.status, 'delivered');
    assert.strictEqual(
      finalPhysical.fulfillmentStatus,
      'delivered'
    );
    assert.strictEqual(finalPhysical.payment.status, 'paid');
    ok('Orden pagada avanzó a enviada y entregada sin perder el pago');

    const eventCount = await OrderEvent.countDocuments({
      orderId: {
        $in: ids.orders,
      },
      type: 'status_changed',
      'meta.bulk': true,
    });
    assert.strictEqual(eventCount, 6);
    ok('Cada transición efectiva dejó auditoría masiva identificable');

    console.log(
      `\nEstados masivos e inventario: ${passed}/${passed} verificaciones aprobadas.`
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
