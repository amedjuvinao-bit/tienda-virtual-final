// backend/scripts/testAdminPosOrderModel.js

const mongoose = require('mongoose');
const Order = require('../models/Order');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  console.log('🧪 Test modelo Order preparado para POS');

  const branchId = new mongoose.Types.ObjectId();
  const cashierId = new mongoose.Types.ObjectId();

  const order = new Order({
    sessionId: `pos_test_${Date.now()}`,
    orderNumber: `POS-TEST-${Date.now()}`,
    status: 'paid',
    source: 'pos',
    branch: branchId,
    branchSnapshot: {
      name: 'Bodega Principal',
      code: 'bodega',
      type: 'warehouse',
    },
    createdByAdmin: cashierId,
    createdByAdminSnapshot: {
      username: 'cajero.test',
      displayName: 'Cajero Test',
      role: 'seller',
      adminRole: 'seller',
    },
    cashier: cashierId,
    cashierSnapshot: {
      username: 'cajero.test',
      displayName: 'Cajero Test',
      role: 'seller',
      adminRole: 'seller',
    },
    pos: {
      receiptNumber: 'REC-TEST-001',
      registerCode: 'caja-1',
      customerMode: 'guest',
    },
    items: [
      {
        productId: String(new mongoose.Types.ObjectId()),
        title: 'Vestido prueba POS',
        color: 'Lila',
        size: '8',
        quantity: 2,
        price: 50000,
      },
    ],
    discount: {
      type: 'amount',
      value: 5000,
      amount: 5000,
      reason: 'Promoción de prueba',
    },
    subtotal: 100000,
    shipping: 0,
    total: 95000,
    payment: {
      provider: 'pos',
      providerLabel: 'Venta física',
      status: 'paid',
      method: 'cash',
      methodLabel: 'Efectivo',
      amount: 95000,
      receivedAmount: 100000,
      changeAmount: 5000,
      splitPayments: [],
    },
  });

  await order.validate();

  assert(order.source === 'pos', 'source debe quedar como pos.');
  assert(order.channel === 'physical_store', 'channel debe quedar como physical_store.');
  assert(order.saleType === 'pos_sale', 'saleType debe quedar como pos_sale.');
  assert(order.fulfillmentStatus === 'delivered', 'fulfillmentStatus debe quedar delivered.');
  assert(order.payment.provider === 'pos', 'payment.provider debe aceptar pos.');
  assert(order.payment.status === 'paid', 'payment.status debe quedar paid.');
  assert(order.payment.paidAt instanceof Date, 'payment.paidAt debe establecerse para POS pagado.');
  assert(order.pos.confirmedAt instanceof Date, 'pos.confirmedAt debe establecerse para POS pagado.');
  assert(order.branchSnapshot.code === 'BODEGA', 'branchSnapshot.code debe normalizarse en mayúsculas.');
  assert(order.pos.registerCode === 'CAJA-1', 'pos.registerCode debe normalizarse en mayúsculas.');
  assert(order.discount.amount === 5000, 'discount.amount debe conservarse.');
  assert(order.inventoryControl.discountedAtCheckout === false, 'POS no debe marcar discountedAtCheckout como venta online.');

  console.log('✅ Modelo Order soporta ventas POS correctamente.');
}

main()
  .catch((error) => {
    console.error('❌ Error validando modelo Order POS:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {}
  });
