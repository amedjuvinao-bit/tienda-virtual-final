'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const CashSession = require('../models/CashSession');
const InventoryStock = require('../models/InventoryStock');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { createPosSaleWithCashSession } = require('../services/posCashSaleService');
const { buildPosReceipt } = require('../services/posReceiptService');

const MONGO_URI = String(process.env.POS_STAGE2_MONGO_URI || '').trim();
const EXPECTED_DATABASE = 'pos_stage2_ci';

function assertDedicatedDatabase(uri) {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new Error('POS_STAGE2_MONGO_URI es obligatoria.');
  }

  const database = uri.split('?')[0].split('/').pop();
  if (database !== EXPECTED_DATABASE) {
    throw new Error(`La prueba solo puede ejecutarse en la base aislada ${EXPECTED_DATABASE}.`);
  }
}

async function seedScenario() {
  const cashierId = new mongoose.Types.ObjectId();
  const branch = await Branch.create({
    name: 'Sede CI Etapa 2',
    code: 'POS-STAGE2',
    type: 'store',
    status: 'active',
    active: true,
    settings: {
      allowPosSales: true,
      allowNegativeStock: false,
      requireCashSessionForPos: true,
      defaultPaymentMethod: 'mixed',
    },
  });
  const product = await Product.create({
    title: 'Producto POS Etapa 2',
    sku: 'POS-STAGE2-PRODUCT',
    price: 100000,
    stock: 5,
    active: true,
    visible: true,
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
    stock: 5,
    reservedStock: 0,
    availableStock: 5,
    active: true,
    deletedAt: null,
  });
  const cashSession = await CashSession.create({
    sessionCode: 'CAJA-STAGE2-CI-0001',
    branch: branch._id,
    branchSnapshot: { name: branch.name, code: branch.code, type: branch.type },
    cashier: cashierId,
    cashierSnapshot: {
      username: 'cajero.stage2',
      displayName: 'Cajero Etapa 2',
      role: 'seller',
      adminRole: 'seller',
    },
    cashRegisterCode: 'CAJA STAGE2',
    openingAmount: 100000,
    status: 'open',
  });

  return { branch, cashierId, cashSession, product, stock };
}

async function main() {
  assertDedicatedDatabase(MONGO_URI);
  await mongoose.connect(MONGO_URI, { autoIndex: true });

  try {
    const scenario = await seedScenario();
    assert.equal(scenario.product.trackInventory, true);
    assert.equal(scenario.product.allowBackorder, false);
    const session = await mongoose.startSession();
    let result;

    try {
      await session.withTransaction(async () => {
        result = await createPosSaleWithCashSession({
          branchId: String(scenario.branch._id),
          registerCode: 'CAJA STAGE2',
          cashRegisterCode: 'CAJA STAGE2',
          terminalId: 'DATAFONO-CI-01',
          customerMode: 'guest',
          items: [{
            productId: String(scenario.product._id),
            quantity: 1,
            variantKey: 'default__default',
            variantLabel: 'Sin variante',
          }],
          discount: {
            type: 'percent',
            value: 10,
            reason: 'Fidelización CI',
          },
          payment: {
            method: 'mixed',
            methodLabel: 'Pago mixto',
            amount: 90000,
            splitPayments: [
              {
                method: 'cash',
                methodLabel: 'Efectivo',
                amount: 40000,
                receivedAmount: 50000,
              },
              {
                method: 'card',
                methodLabel: 'Tarjeta / Datáfono',
                amount: 50000,
                reference: 'AUTH-CI-500',
              },
            ],
          },
        }, {
          session,
          admin: {
            _id: scenario.cashierId,
            id: String(scenario.cashierId),
            username: 'cajero.stage2',
            displayName: 'Cajero Etapa 2',
            role: 'seller',
            adminRole: 'seller',
            canApplyPosDiscount: true,
            canApprovePosDiscount: false,
          },
        });
      });
    } finally {
      await session.endSession();
    }

    const order = await Order.findById(result.order._id).lean();
    assert.equal(result.movements.length, 1);
    assert.equal(order.total, 90000);
    assert.equal(order.discount.amount, 10000);
    assert.equal(order.discount.reason, 'Fidelización CI');
    assert.equal(String(order.discount.authorizedBy), String(scenario.cashierId));
    assert.equal(order.payment.method, 'mixed');
    assert.equal(order.payment.splitPayments.length, 2);
    assert.equal(order.payment.splitPayments[0].changeAmount, 10000);
    assert.equal(order.payment.splitPayments[1].reference, 'AUTH-CI-500');
    console.log('OK 01 la orden persiste total, descuento, autorizador y pago mixto');

    const cash = await CashSession.findById(scenario.cashSession._id).lean();
    assert.equal(cash.salesSummary.ordersCount, 1);
    assert.equal(cash.salesSummary.netSales, 90000);
    assert.equal(cash.salesSummary.paymentTotals.cash, 40000);
    assert.equal(cash.salesSummary.paymentTotals.card, 50000);
    assert.equal(cash.expectedCash, 140000);
    console.log('OK 02 la caja distribuye el pago mixto sin sumar el cambio como venta');

    const stock = await InventoryStock.findById(scenario.stock._id).lean();
    assert.equal(stock.stock, 4);
    assert.equal(stock.availableStock, 4);
    console.log('OK 03 inventario, orden y caja se confirman en la misma transacción');

    const receipt = await buildPosReceipt(order._id);
    assert.equal(receipt.payment.method, 'mixed');
    assert.equal(receipt.payment.splitPayments.length, 2);
    assert.equal(receipt.payment.splitPayments[1].reference, 'AUTH-CI-500');
    assert.equal(receipt.totals.discount, 10000);
    console.log('OK 04 el comprobante reconstruye descuento, referencias y desglose mixto');

    console.log('\nIntegración Etapa 2 POS: 4/4 controles superados.');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error('FAIL integración Etapa 2 POS');
  console.error(error);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => null);
  }
  process.exitCode = 1;
});
