'use strict';

const OrderEvent = require('../../models/OrderEvent');

async function closeExpiredManualOrder({ order, reservation, now, session, OrderEventModel = OrderEvent }) {
  if (
    order?.source !== 'manual' ||
    order.payment?.provider !== 'manual' ||
    order.payment?.status !== 'pending_manual' ||
    !['pending', 'processing'].includes(order.status)
  ) return false;

  const previousStatus = order.status;
  order.status = 'failed';
  order.payment.status = 'failed';
  order.fulfillmentStatus = 'cancelled';
  order.inventoryControl.discountedAtCheckout = false;
  order.inventoryControl.restockedOnFailure = true;
  order.inventoryControl.restockedAt = now;
  order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
  order.timeline.push({
    type: 'status', statusFrom: previousStatus, statusTo: 'failed',
    message: 'Pedido vencido sin pago; inventario liberado.', by: 'system', at: now,
  });
  await order.save({ session });
  await OrderEventModel.create([{
    orderId: order._id,
    type: 'status_changed',
    message: 'Pedido vencido sin pago; inventario liberado.',
    meta: {
      from: previousStatus, to: 'failed', by: 'reservation_expiration',
      reservationId: reservation._id,
    },
  }], { session });
  return true;
}

module.exports = { closeExpiredManualOrder };
