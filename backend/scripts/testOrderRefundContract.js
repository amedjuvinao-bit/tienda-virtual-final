/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const {
  normalizeRequestedItems,
  canonicalRefundPayload,
} = require('../services/orderRefundService');

let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function source(relativePath) {
  return fs.readFileSync(
    path.join(__dirname, '..', relativePath),
    'utf8'
  );
}

function buildOrder() {
  const blueProduct = new mongoose.Types.ObjectId();
  const redProduct = new mongoose.Types.ObjectId();
  return {
    items: [
      {
        _id: new mongoose.Types.ObjectId(),
        product: blueProduct,
        productId: String(blueProduct),
        title: 'Camiseta azul',
        productType: 'physical',
        variantKey: 'm__azul',
        size: 'M',
        color: 'Azul',
        quantity: 3,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        product: redProduct,
        productId: String(redProduct),
        title: 'Camiseta roja',
        productType: 'physical',
        variantKey: 'l__rojo',
        size: 'L',
        color: 'Rojo',
        quantity: 2,
      },
    ],
  };
}

function run() {
  const order = buildOrder();
  const selected = normalizeRequestedItems(order, [
    {
      orderItemId: order.items[0]._id,
      quantity: 1,
    },
  ]);
  assert.strictEqual(selected.length, 1);
  assert.strictEqual(
    selected[0].orderItemId,
    String(order.items[0]._id)
  );
  assert.strictEqual(selected[0].variantKey, 'm__blue');
  ok('La devolución se vincula a la línea histórica y su variante');

  const byProductAndVariant = normalizeRequestedItems(order, [
    {
      productId: order.items[1].product,
      variantKey: 'l__rojo',
      quantity: 1,
    },
  ]);
  assert.strictEqual(
    byProductAndVariant[0].orderItemId,
    String(order.items[1]._id)
  );
  ok('La compatibilidad anterior resuelve producto y variante sin inventar líneas');

  assert.throws(
    () =>
      normalizeRequestedItems(
        order,
        [
          {
            orderItemId: order.items[0]._id,
            quantity: 2,
          },
        ],
        new Map([[String(order.items[0]._id), 2]])
      ),
    (error) =>
      error?.code ===
      'REFUND_QUANTITY_EXCEEDS_PURCHASED'
  );
  ok('El acumulado parcial nunca supera la cantidad comprada');

  const firstCanonical = canonicalRefundPayload({
    amount: 100000,
    reason: 'Devolución',
    items: [
      {
        orderItemId: String(order.items[1]._id),
        returnedQuantity: 1,
      },
      {
        orderItemId: String(order.items[0]._id),
        returnedQuantity: 2,
      },
    ],
  });
  const secondCanonical = canonicalRefundPayload({
    amount: 100000,
    reason: 'Devolución',
    items: [
      {
        orderItemId: String(order.items[0]._id),
        returnedQuantity: 2,
      },
      {
        orderItemId: String(order.items[1]._id),
        returnedQuantity: 1,
      },
    ],
  });
  assert.deepStrictEqual(firstCanonical, secondCanonical);
  assert.strictEqual(firstCanonical.returnCaseId, undefined);
  assert.strictEqual(firstCanonical.items[0].restockQuantity, undefined);
  ok('La identidad del reembolso es estable aunque cambie el orden de las líneas');

  const indexes = OrderRefund.schema.indexes();
  assert(
    indexes.some(
      ([fields, options]) =>
        fields.order === 1 &&
        fields.idempotencyKey === 1 &&
        options.unique === true
    )
  );
  ok('El modelo impide duplicar una clave idempotente por orden');

  assert(Order.schema.path('refundControl.totalAmount'));
  assert(Order.schema.path('refundControl.lastRefund'));
  ok('La orden conserva resumen acumulado y referencia al último reembolso');

  const serviceSource = source(
    'services/orderRefundService.js'
  );
  assert(serviceSource.includes("type: 'return_in'"));
  assert(
    serviceSource.includes(
      "const sourceModel = returnCase ? 'OrderReturn' : 'OrderRefund'"
    )
  );
  assert(
    serviceSource.includes('syncProductTotalStock')
  );
  assert(
    serviceSource.includes(
      'bundleParentProduct'
    )
  );
  ok('El servicio actualiza InventoryStock, kardex, producto y combos');

  const routeSource = source('routes/orders.js').replace(/\r\n?/g, '\n');
  const refundRoute = routeSource.slice(
    routeSource.indexOf("router.post(\n  '/:id/refund'"),
    routeSource.indexOf(
      '/* =========================================================\n * POST /api/orders/admin/bulk'
    )
  );
  assert(
    refundRoute.includes(
      "requirePermission('orders:refund')"
    )
  );
  assert(refundRoute.includes('processOrderRefund'));
  assert(!refundRoute.includes('incrementStock'));
  ok('El endpoint usa el flujo transaccional protegido y no el stock heredado');

  const workflowSource = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      '.github',
      'workflows',
      'products-ci.yml'
    ),
    'utf8'
  );
  assert(
    workflowSource.includes(
      'Validar reembolsos y devoluciones'
    )
  );
  assert(workflowSource.includes('--replSet rs0'));
  ok('GitHub valida el flujo real con transacciones MongoDB');

  console.log(
    `\nContrato reembolsos e inventario: ${passed}/9 verificaciones aprobadas.`
  );
}

run();
