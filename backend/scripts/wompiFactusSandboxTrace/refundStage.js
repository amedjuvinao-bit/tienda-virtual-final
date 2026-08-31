'use strict';

const assert = require('node:assert/strict');
const ElectronicInvoice = require('../../models/ElectronicInvoice');
const Order = require('../../models/Order');
const OrderEvent = require('../../models/OrderEvent');
const OrderRefund = require('../../models/OrderRefund');
const {
  automateOrderRefund,
} = require('../../services/orderRefundAutomationService');

async function automateSandboxRefund({ order, refund }) {
  const result = await automateOrderRefund(
    {
      orderId: order._id,
      refundId: refund._id,
      adminLabel: 'QA Wompi + Factus + Envia Sandbox',
    },
    { OrderEventModel: OrderEvent }
  );
  assert.strictEqual(result?.completed, true, JSON.stringify(result?.outcomes || {}));

  const [finalOrder, finalRefund, finalInvoice] = await Promise.all([
    Order.findById(order._id),
    OrderRefund.findById(refund._id),
    ElectronicInvoice.findOne({ orderId: order._id }),
  ]);
  assert.strictEqual(finalOrder?.status, 'refunded');
  assert.strictEqual(finalRefund?.reconciliation?.state, 'completed');
  assert.strictEqual(finalRefund?.reconciliation?.inventory?.state, 'completed');
  assert.strictEqual(finalRefund?.reconciliation?.payment?.state, 'completed');
  assert.strictEqual(finalRefund?.reconciliation?.billing?.state, 'completed');
  return { finalInvoice, finalOrder, finalRefund, result };
}

module.exports = {
  automateSandboxRefund,
};
