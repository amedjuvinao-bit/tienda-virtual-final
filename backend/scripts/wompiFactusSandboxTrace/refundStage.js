'use strict';

const assert = require('node:assert/strict');

const ElectronicInvoice = require('../../models/ElectronicInvoice');
const Order = require('../../models/Order');
const OrderEvent = require('../../models/OrderEvent');
const OrderRefund = require('../../models/OrderRefund');
const {
  automateOrderRefund,
} = require('../../services/orderRefundAutomationService');
const { processOrderRefund } = require('../../services/orderRefundService');
const {
  resolveRefundableOrderTotal,
} = require('../../services/orderRefunds/refundPaymentIntegrity');
const { clean } = require('./config');

function quantity(item = {}) {
  return Math.max(0, Math.floor(Number(item.quantity ?? item.qty ?? 0)));
}

function buildFullRefundItems(order = {}) {
  return (order.items || []).map((item) => {
    const productType = clean(item.productType || 'physical', 40).toLowerCase();
    const sold = quantity(item);
    assert(sold > 0, `La línea ${item.title || item._id} no tiene cantidad válida.`);
    return {
      orderItemId: String(item._id),
      quantity: sold,
      restockQuantity: ['digital', 'service'].includes(productType) ? 0 : sold,
    };
  });
}

async function createFullCancellationRefund(order) {
  assert.strictEqual(clean(order?.payment?.status, 40).toLowerCase(), 'paid');
  assert(!['shipped', 'delivered'].includes(clean(order.status, 40).toLowerCase()),
    'La prueba automática solo cancela una compra antes del despacho.');
  assert(
    !(order?.fulfillment?.shipments || []).some((shipment) =>
      ['dispatched', 'in_transit', 'delivered'].includes(
        clean(shipment?.status, 40).toLowerCase()
      )
    ),
    'La prueba no cancela una orden con envíos despachados.'
  );
  const amount = resolveRefundableOrderTotal(order);
  const items = buildFullRefundItems(order);
  assert(items.length > 0, 'La orden no tiene líneas reembolsables.');

  const result = await processOrderRefund(
    {
      orderId: order._id,
      amount,
      reason: 'Cancelación integral de prueba Wompi Sandbox + Factus habilitación.',
      items,
      idempotencyKey: `SANDBOX-WOMPI-FACTUS-${order.orderNumber}`,
      adminLabel: 'QA Wompi + Factus Sandbox',
    },
    {
      OrderEventModel: OrderEvent,
      allowInventoryRestock: true,
    }
  );
  return OrderRefund.findById(result.refund._id);
}

async function automateSandboxRefund({ order, refund }) {
  const result = await automateOrderRefund(
    {
      orderId: order._id,
      refundId: refund._id,
      adminLabel: 'QA Wompi + Factus Sandbox',
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
  buildFullRefundItems,
  createFullCancellationRefund,
};
