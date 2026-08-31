'use strict';

const OrderReturn = require('../../models/OrderReturn');
const { getShippingProviderStatus } = require('../shippingProviderService');
const {
  mergeTrackingEvents,
  normalizeTrackingEvent,
  providerStage,
} = require('../shippingTrackingStateService');
const { createReturnError } = require('../orderReturns/normalization');
const { safeReturnView } = require('../orderReturns/presentation');
const { destinationSnapshot } = require('./context');

function clean(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function plain(value) {
  return typeof value?.toObject === 'function' ? value.toObject() : value || {};
}

function returnShippingValue(returnCase) {
  const shipping = plain(returnCase?.shipping);
  return {
    ...shipping,
    destinationSnapshot: plain(shipping.destinationSnapshot),
    originSnapshot: plain(shipping.originSnapshot),
    packages: (shipping.packages || []).map(plain),
    integration: plain(shipping.integration),
  };
}

async function returnShippingResponse(returnCase, extra = {}, dependencies = {}) {
  const providerStatus = dependencies.getShippingProviderStatus || getShippingProviderStatus;
  return {
    ok: true,
    returnCase: safeReturnView(returnCase),
    shippingProviders: await providerStatus(dependencies),
    ...extra,
  };
}

async function persistReturnShipping(
  {
    order,
    returnCase,
    shipping,
    status = returnCase.status,
    inTransitAt = returnCase.inTransitAt || null,
    now = new Date(),
  },
  { OrderReturnModel = OrderReturn } = {}
) {
  const updated = await OrderReturnModel.findOneAndUpdate(
    {
      _id: returnCase._id,
      order: order._id,
      revision: Number(returnCase.revision || 0),
      status: { $in: ['authorized', 'in_transit'] },
    },
    {
      $set: { shipping, status, inTransitAt, updatedAt: now },
      $inc: { revision: 1 },
    },
    { new: true, runValidators: true }
  );
  if (!updated) {
    const current = await OrderReturnModel.findOne({
      _id: returnCase._id,
      order: order._id,
    });
    throw createReturnError(
      'Otro usuario modificó este RMA. Recarga la información antes de continuar.',
      'RETURN_REVISION_CONFLICT',
      409,
      {
        expectedRevision: Number(returnCase.revision || 0),
        currentRevision: Number(current?.revision || 0),
      }
    );
  }
  return updated;
}

function shippingFromGeneratedLabel({
  returnCase,
  destination,
  originSnapshot,
  packages,
  provider,
  rate,
  generated,
  actions,
  pickup,
  now,
}) {
  const shipping = returnShippingValue(returnCase);
  shipping.method = 'carrier';
  shipping.carrierName = generated.carrier || rate.carrier;
  shipping.trackingNumber = generated.trackingNumber;
  shipping.trackingUrl = generated.trackingUrl;
  shipping.labelUrl = generated.labelUrl;
  shipping.labelType = 'carrier';
  shipping.destinationBranch = destination._id;
  shipping.destinationSnapshot = destinationSnapshot(destination);
  shipping.originSnapshot = originSnapshot;
  shipping.packages = packages;
  shipping.carrierDeliveredAt = null;
  shipping.awaitingWarehouseReceipt = false;
  shipping.integration = {
    ...shipping.integration,
    provider: provider.key,
    mode: provider.mode,
    status: pickup?.confirmation ? 'pickup_scheduled' : 'label_generated',
    providerShipmentId: generated.providerShipmentId,
    labelUrl: generated.labelUrl,
    labelFormat: 'PDF',
    carrierActions: actions,
    selectedRate: {
      ...rate,
      totalPrice: generated.totalPrice || rate.totalPrice,
      currency: generated.currency || rate.currency,
    },
    handoffMode: pickup?.confirmation ? 'pickup' : 'pending',
    handoffConfirmedAt: pickup?.confirmation ? now : null,
    pickup: pickup?.requestedDate
      ? {
          status: pickup.confirmation ? 'scheduled' : 'failed',
          confirmation: pickup.confirmation || '',
          requestedDate: pickup.requestedDate,
          timeFrom: '',
          timeTo: '',
          instructions: pickup.instructions || '',
          requestedAt: now,
          completedAt: null,
        }
      : {
          status: 'not_requested',
          confirmation: '',
          requestedDate: '',
          timeFrom: '',
          timeTo: '',
          instructions: '',
          requestedAt: null,
          completedAt: null,
        },
    cancellation: {
      status: 'not_requested',
      balanceReturned: false,
      balanceReturnDate: null,
      requestedAt: null,
      confirmedAt: null,
      providerMessage: '',
    },
    cancelledAt: null,
    lastError: {},
  };
  return shipping;
}

function generatedAlreadyPersisted(returnCase, generated = {}) {
  const shipping = returnCase?.shipping || {};
  return Boolean(
    generated.trackingNumber &&
    clean(shipping.trackingNumber, 180) === clean(generated.trackingNumber, 180) &&
    clean(shipping.integration?.providerShipmentId, 180) ===
      clean(generated.providerShipmentId, 180)
  );
}

function applyReturnTrackingUpdate(returnCase, rawEvent, defaults = {}) {
  const now = defaults.receivedAt || new Date();
  const event = normalizeTrackingEvent(rawEvent, {
    source: defaults.source || 'provider',
    occurredAt: defaults.occurredAt,
    receivedAt: now,
  });
  const stage = providerStage(event.status || event.code || event.description);
  const shipping = returnShippingValue(returnCase);
  const integration = shipping.integration || (shipping.integration = {});
  integration.provider = clean(defaults.provider || integration.provider || 'envia', 40).toLowerCase();
  integration.providerStatus = event.status || event.code;
  integration.providerStatusDescription = event.description;
  integration.lastSyncedAt = now;
  if (defaults.source === 'webhook') integration.lastWebhookAt = now;
  integration.trackingEvents = mergeTrackingEvents(integration.trackingEvents, [event]);
  integration.lastError = {};
  if (integration.status !== 'cancelled') integration.status = 'tracking';

  const pickup = integration.pickup || (integration.pickup = {});
  if (['picked_up', 'in_transit', 'delivered'].includes(stage)) {
    pickup.status = 'completed';
    pickup.completedAt = pickup.completedAt || now;
  }
  let status = returnCase.status;
  let inTransitAt = returnCase.inTransitAt || null;
  if (['picked_up', 'in_transit', 'delivered'].includes(stage)) {
    status = status === 'authorized' ? 'in_transit' : status;
    inTransitAt = inTransitAt || now;
  }
  if (stage === 'delivered') {
    shipping.carrierDeliveredAt = shipping.carrierDeliveredAt || now;
    shipping.awaitingWarehouseReceipt = true;
  } else if (stage === 'cancelled') {
    integration.status = 'cancelled';
    integration.cancelledAt = integration.cancelledAt || now;
    const cancellation = integration.cancellation || (integration.cancellation = {});
    cancellation.status = cancellation.balanceReturned ? 'refunded' : 'confirmed';
    cancellation.confirmedAt = cancellation.confirmedAt || now;
  } else if (stage === 'exception') {
    integration.lastError = {
      code: event.code || 'CARRIER_EXCEPTION',
      message: event.description || event.status || 'La transportadora reportó una novedad.',
      at: now,
    };
  }
  return { shipping, status, inTransitAt, stage, event };
}

module.exports = {
  applyReturnTrackingUpdate,
  generatedAlreadyPersisted,
  persistReturnShipping,
  returnShippingResponse,
  returnShippingValue,
  shippingFromGeneratedLabel,
};
