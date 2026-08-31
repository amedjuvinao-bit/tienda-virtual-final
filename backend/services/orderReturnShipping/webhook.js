'use strict';

const Order = require('../../models/Order');
const OrderReturn = require('../../models/OrderReturn');
const {
  applyReturnTrackingUpdate,
  persistReturnShipping,
  returnShippingValue,
} = require('./state');

function clean(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

async function applyOrderReturnShippingWebhook(
  { parsed, eventRecord, now = new Date() } = {},
  { OrderModel = Order, OrderReturnModel = OrderReturn } = {}
) {
  const returnCase = await OrderReturnModel.findOne({
    'shipping.trackingNumber': parsed.trackingNumber,
    ...(parsed.providerShipmentId
      ? { 'shipping.integration.providerShipmentId': parsed.providerShipmentId }
      : {}),
    status: { $in: ['authorized', 'in_transit'] },
  });
  if (!returnCase) return null;
  const order = await OrderModel.findById(returnCase.order);
  if (!order) return null;

  const shipping = returnShippingValue(returnCase);
  if (parsed.providerShipmentId && !shipping.integration?.providerShipmentId) {
    shipping.integration = shipping.integration || {};
    shipping.integration.providerShipmentId = parsed.providerShipmentId;
  }
  if (parsed.carrier && !shipping.carrierName) {
    shipping.carrierName = parsed.carrier;
  }
  const state = applyReturnTrackingUpdate(
    { status: returnCase.status, inTransitAt: returnCase.inTransitAt, shipping },
    parsed.event,
    {
      provider: eventRecord.provider || 'envia',
      source: 'webhook',
      eventId: eventRecord.eventId,
      occurredAt: parsed.event.occurredAt,
      receivedAt: now,
    }
  );
  const updated = await persistReturnShipping(
    { order, returnCase, ...state, now },
    { OrderReturnModel }
  );
  return {
    order,
    returnCase: updated,
    stage: state.stage,
    statusFrom: clean(returnCase.status, 40).toLowerCase(),
    statusTo: clean(updated.status, 40).toLowerCase(),
  };
}

module.exports = { applyOrderReturnShippingWebhook };
