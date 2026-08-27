'use strict';

const Order = require('../../models/Order');
const InventoryReservation = require('../../models/InventoryReservation');
const {
  applyReservationToOrderDocument,
} = require('./reservationMapping');
const { cleanText, idValue } = require('./support');

async function syncOrderInventoryAllocationsFromReservation(
  reservation,
  { orderId = null, session = null, OrderModel = Order } = {}
) {
  const resolvedOrderId = idValue(orderId) || idValue(reservation?.order);
  if (!resolvedOrderId) return null;

  const order = await OrderModel.findById(resolvedOrderId).session(session);
  if (!order) return null;

  applyReservationToOrderDocument(order, reservation);
  await order.save({ session });
  return order;
}

async function hydrateOrderInventoryAllocations(
  order,
  { session = null, InventoryReservationModel = InventoryReservation } = {}
) {
  if (
    !order ||
    (Array.isArray(order.inventoryAllocations) &&
      order.inventoryAllocations.length > 0)
  ) {
    return order;
  }

  const reservationId = idValue(order?.inventoryControl?.reservationId);
  const orderId = idValue(order?._id);
  const orderNumber = cleanText(order?.orderNumber);
  const filter = reservationId
    ? { _id: reservationId }
    : {
        $or: [
          ...(orderId ? [{ order: orderId }] : []),
          ...(orderNumber ? [{ orderNumber }] : []),
        ],
      };

  if (!reservationId && filter.$or.length === 0) return order;

  const reservation = await InventoryReservationModel.findOne(filter)
    .sort({ confirmedAt: -1, createdAt: -1 })
    .session(session);

  if (reservation) applyReservationToOrderDocument(order, reservation);
  return order;
}

module.exports = {
  syncOrderInventoryAllocationsFromReservation,
  hydrateOrderInventoryAllocations,
};
