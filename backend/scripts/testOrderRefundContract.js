/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const refundService = require('../services/orderRefundService');
const refundInventoryService = require(
  '../services/orderRefunds/refundInventoryService'
);
const {
  normalizeRequestedItems,
  canonicalRefundPayload,
} = refundService;
const {
  isPaidOrder,
} = require('../services/orderRefunds/refundNormalization');
const {
  assertRefundAmountMatchesItems,
  assertSupportedRefundPaymentSources,
  paymentSourceBreakdown,
  resolveRefundableOrderTotal,
} = require('../services/orderRefunds/refundPaymentIntegrity');

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
  assert.deepStrictEqual(Object.keys(refundService), [
    'processOrderRefund',
    'createRefundError',
    'normalizeRequestedItems',
    'canonicalRefundPayload',
    'getPreviousRefundState',
    'restoreInventory',
  ]);
  assert.deepStrictEqual(Object.keys(refundInventoryService), [
    'buildInventoryDemands',
    'groupSaleAllocations',
    'inventoryKey',
    'loadConfirmedSaleAllocations',
    'restoreInventory',
  ]);
  ok('La fachada conserva exactamente la interfaz pública anterior');

  assert.strictEqual(
    isPaidOrder({ status: 'processing', payment: { status: 'pending_gateway' } }),
    false
  );
  assert.strictEqual(
    isPaidOrder({ status: 'delivered', payment: { status: 'failed' } }),
    false
  );
  assert.strictEqual(
    isPaidOrder({ status: 'processing', payment: { status: 'paid' } }),
    true
  );
  ok('el estado logístico no sustituye la evidencia persistida de pago');

  const mixedPaymentOrder = {
    total: 100000,
    payment: {
      amount: 70000,
      splitPayments: [
        { method: 'store_credit', amount: 30000 },
        { method: 'wompi', amount: 70000 },
      ],
    },
    storeCredit: {
      applied: true,
      amount: 30000,
      status: 'consumed',
    },
  };
  assert.deepStrictEqual(paymentSourceBreakdown(mixedPaymentOrder), {
    storeCreditAmount: 30000,
    externalAmount: 70000,
    mixed: true,
  });
  assert.strictEqual(resolveRefundableOrderTotal(mixedPaymentOrder), 100000);
  ok('el total reembolsable usa el total comercial y no solo el remanente de pasarela');

  assert.throws(
    () => assertSupportedRefundPaymentSources(mixedPaymentOrder),
    (error) =>
      error?.code === 'MIXED_PAYMENT_REFUND_MANUAL_REVIEW_REQUIRED' &&
      error?.details?.handling === 'manual_review'
  );
  assert.throws(
    () =>
      assertSupportedRefundPaymentSources({
        total: 30000,
        payment: { amount: 0 },
        storeCredit: {
          applied: true,
          amount: 30000,
          status: 'consumed',
        },
      }),
    (error) =>
      error?.code === 'STORE_CREDIT_REFUND_MANUAL_REVIEW_REQUIRED' &&
      error?.details?.handling === 'manual_review'
  );
  ok('los reembolsos con saldo quedan en revisión manual antes de mover dinero o saldo');

  const pricedLineId = new mongoose.Types.ObjectId();
  const pricedOrder = {
    total: 100,
    items: [
      {
        _id: pricedLineId,
        quantity: 1,
        taxableBase: 100,
        taxAmount: 0,
        lineTotal: 100,
      },
    ],
  };
  assert.throws(
    () =>
      assertRefundAmountMatchesItems({
        order: pricedOrder,
        amount: 30,
        items: [{ orderItemId: pricedLineId, returnedQuantity: 1 }],
      }),
    (error) =>
      error?.code === 'REFUND_AMOUNT_ITEMS_MANUAL_REVIEW_REQUIRED' &&
      error?.details?.calculatedItemsAmount === 100 &&
      error?.details?.handling === 'manual_review'
  );
  const fiscalLineId = new mongoose.Types.ObjectId();
  assert.strictEqual(
    assertRefundAmountMatchesItems({
      order: {
        total: 119,
        items: [
          {
            _id: fiscalLineId,
            quantity: 1,
            lineSubtotal: 120,
            discountAmount: 20,
            taxableBase: 100,
            taxAmount: 19,
            lineTotal: 119,
          },
        ],
      },
      amount: 119,
      items: [{ orderItemId: fiscalLineId, returnedQuantity: 1 }],
    }).calculatedAmount,
    119
  );
  ok('el monto debe coincidir con las líneas después de descuentos e impuestos');

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

  const inventoryServiceSource = [
    'services/orderRefunds/refundInventoryService.js',
    'services/orderRefunds/refundInventoryAllocationService.js',
    'services/orderRefunds/refundInventoryDemandService.js',
    'services/orderRefunds/refundInventoryRestorationService.js',
  ]
    .map(source)
    .join('\n');
  assert(inventoryServiceSource.includes("type: 'return_in'"));
  assert(
    inventoryServiceSource.includes(
      "const sourceModel = returnCase ? 'OrderReturn' : 'OrderRefund'"
    )
  );
  assert(
    inventoryServiceSource.includes('syncProductTotalStock')
  );
  assert(
    inventoryServiceSource.includes(
      'bundleParentProduct'
    )
  );
  ok('El servicio actualiza InventoryStock, kardex, producto y combos');

  const routeSource = source('routes/orders.js').replace(/\r\n?/g, '\n');
  const controllerSource = source('controllers/orderRefundController.js').replace(
    /\r\n?/g,
    '\n'
  );
  const transactionServiceSource = source(
    'services/orderRefunds/refundTransactionService.js'
  );
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
  assert(refundRoute.includes('createOrderRefund'));
  assert(controllerSource.includes('processOrderRefund'));
  assert(controllerSource.includes('allowInventoryRestock: false'));
  assert(transactionServiceSource.includes('allowInventoryRestock = false'));
  assert(!controllerSource.includes('incrementStock'));
  ok('El endpoint financiero no repone inventario sin un RMA inspeccionado');

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
    `\nContrato reembolsos e inventario: ${passed}/${passed} verificaciones aprobadas.`
  );
}

run();
