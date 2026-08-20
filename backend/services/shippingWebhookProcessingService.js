'use strict';

const Order = require('../models/Order');
const ShippingWebhookEvent = require('../models/ShippingWebhookEvent');
const {
  applyProviderTrackingUpdate,
} = require('./shippingTrackingStateService');

function clean(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function webhookTrackingEvent(payload = {}, event = {}) {
  const data = payload?.data && typeof payload.data === 'object'
    ? payload.data
    : payload;
  const trackingNumber = clean(
    data?.tracking_number ||
    data?.trackingNumber ||
    data?.tracking ||
    data?.label ||
    payload?.tracking_number ||
    payload?.trackingNumber,
    180
  );
  const status = clean(
    data?.status ||
    data?.shipment_status ||
    data?.status_name ||
    payload?.status,
    180
  );
  const description = clean(
    data?.status_description ||
    data?.statusDescription ||
    data?.description ||
    data?.message,
    500
  );
  return {
    trackingNumber,
    providerShipmentId: clean(
      data?.shipment_id || data?.shipmentId || payload?.shipment_id,
      180
    ),
    carrier: clean(
      data?.carrier_name || data?.carrier || payload?.carrier,
      100
    ),
    event: {
      code: clean(data?.status_code || data?.statusCode, 100),
      status,
      description,
      location: data?.location || data?.city || '',
      occurredAt:
        data?.occurred_at ||
        data?.updated_at ||
        data?.date ||
        payload?.created_at ||
        event?.providerTimestamp ||
        null,
      source: 'webhook',
    },
  };
}

async function markEvent(event, status, fields = {}) {
  event.status = status;
  Object.assign(event, fields);
  await event.save();
  return event;
}

async function claimWebhookEvent(
  eventId,
  EventModel,
  { now = new Date(), staleBefore = new Date(Date.now() - 5 * 60_000), maxAttempts = 5 } = {}
) {
  if (typeof EventModel.findOneAndUpdate === 'function') {
    return EventModel.findOneAndUpdate(
      {
        _id: eventId,
        attempts: { $lt: maxAttempts },
        $or: [
          { status: { $in: ['received', 'failed'] } },
          { status: 'processing', updatedAt: { $lt: staleBefore } },
        ],
      },
      {
        $set: { status: 'processing', error: '', lastAttemptAt: now },
        $inc: { attempts: 1 },
      },
      { new: true }
    );
  }
  const event = await EventModel.findById(eventId);
  const staleProcessing = event?.status === 'processing' &&
    (!event.updatedAt || new Date(event.updatedAt) < staleBefore);
  if (
    !event ||
    Number(event.attempts || 0) >= maxAttempts ||
    (!['received', 'failed'].includes(event.status) && !staleProcessing)
  ) return null;
  event.status = 'processing';
  event.error = '';
  event.attempts = Number(event.attempts || 0) + 1;
  event.lastAttemptAt = now;
  await event.save();
  return event;
}

async function processShippingWebhookEvent(
  eventId,
  { OrderModel = Order, EventModel = ShippingWebhookEvent, now = new Date() } = {}
) {
  const eventRecord = await claimWebhookEvent(eventId, EventModel, { now });
  if (!eventRecord) return { ok: true, skipped: true };

  try {
    const parsed = webhookTrackingEvent(eventRecord.payload, eventRecord);
    if (!parsed.trackingNumber || !parsed.event.status) {
      await markEvent(eventRecord, 'ignored', {
        processedAt: now,
        error: 'El evento no contiene número de guía y estado utilizables.',
      });
      return { ok: true, ignored: true, reason: 'missing_tracking_or_status' };
    }

    const order = await OrderModel.findOne({
      'fulfillment.shipments.carrier.trackingNumber': parsed.trackingNumber,
    });
    if (!order) {
      await markEvent(eventRecord, 'ignored', {
        processedAt: now,
        error: `No existe un envío local con la guía ${parsed.trackingNumber}.`,
      });
      return { ok: true, ignored: true, reason: 'shipment_not_found' };
    }

    const shipments = Array.isArray(order?.fulfillment?.shipments)
      ? order.fulfillment.shipments
      : [];
    const shipment = shipments.find(
      (candidate) => clean(candidate?.carrier?.trackingNumber, 180) === parsed.trackingNumber
    );
    if (!shipment) {
      await markEvent(eventRecord, 'ignored', {
        processedAt: now,
        order: order._id,
        error: `La orden no contiene la guía ${parsed.trackingNumber}.`,
      });
      return { ok: true, ignored: true, reason: 'shipment_not_found_in_order' };
    }

    if (!shipment.shippingIntegration) shipment.shippingIntegration = {};
    if (parsed.providerShipmentId && !shipment.shippingIntegration.providerShipmentId) {
      shipment.shippingIntegration.providerShipmentId = parsed.providerShipmentId;
    }
    if (parsed.carrier && !shipment?.carrier?.name) shipment.carrier.name = parsed.carrier;
    const applied = applyProviderTrackingUpdate(order, shipment, parsed.event, {
      provider: eventRecord.provider || 'envia',
      source: 'webhook',
      eventId: eventRecord.eventId,
      occurredAt: parsed.event.occurredAt,
      receivedAt: now,
    });
    shipment.revision = Number(shipment.revision || 0) + 1;
    shipment.updatedAt = now;
    await order.save();

    await markEvent(eventRecord, 'processed', {
      order: order._id,
      shipmentId: shipment._id,
      processedAt: now,
      error: '',
    });
    return {
      ok: true,
      processed: true,
      orderId: String(order._id),
      shipmentId: String(shipment._id),
      trackingNumber: parsed.trackingNumber,
      stage: applied.stage,
      statusFrom: applied.statusFrom,
      statusTo: applied.statusTo,
    };
  } catch (error) {
    await markEvent(eventRecord, 'failed', {
      processedAt: now,
      error: clean(error?.message || 'No fue posible procesar el webhook.', 500),
    }).catch(() => {});
    throw error;
  }
}

async function recoverShippingWebhookEvents(
  { limit = 25, staleMs = 5 * 60_000, maxAttempts = 5 } = {},
  { EventModel = ShippingWebhookEvent, OrderModel = Order, now = new Date() } = {}
) {
  const staleBefore = new Date(now.getTime() - staleMs);
  const query = EventModel.find({
    attempts: { $lt: maxAttempts },
    $or: [
      { status: { $in: ['received', 'failed'] } },
      { status: 'processing', updatedAt: { $lt: staleBefore } },
    ],
  }).sort({ createdAt: 1 }).limit(Math.max(1, Math.min(100, Number(limit || 25))));
  const events = typeof query?.lean === 'function' ? await query.lean() : await query;
  const summary = { scanned: events.length, processed: 0, ignored: 0, failed: 0, skipped: 0 };
  for (const event of events) {
    try {
      const result = await processShippingWebhookEvent(event._id, {
        EventModel,
        OrderModel,
        now: new Date(),
      });
      if (result?.processed) summary.processed += 1;
      else if (result?.ignored) summary.ignored += 1;
      else summary.skipped += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}

module.exports = {
  webhookTrackingEvent,
  processShippingWebhookEvent,
  recoverShippingWebhookEvents,
};
