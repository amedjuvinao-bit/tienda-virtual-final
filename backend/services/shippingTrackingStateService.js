'use strict';

const {
  reconcileOrderFromLogistics,
} = require('./orderLogisticsService');
const {
  advanceOrderInventoryAllocationsForShipment,
} = require('./orderInventoryAllocationService');

const MAX_TRACKING_EVENTS = 80;
const MAX_SHIPMENT_HISTORY = 100;
const MAX_SHIPMENT_INCIDENTS = 50;

function clean(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function asDate(value, fallback = null) {
  if (!value) return fallback;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function statusToken(value) {
  return clean(value, 180)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function providerStage(value) {
  const status = statusToken(value);
  if (!status) return 'unknown';
  if (/cancel|canceled|cancelled/.test(status)) return 'cancelled';
  if (/exception|failed|failure|undeliver|return|devol|rechaz|incidenc/.test(status)) {
    return 'exception';
  }
  if (/(^| )delivered($| )|entregad/.test(status)) return 'delivered';
  if (/in transit|transit|shipped|out for delivery|en ruta|despach/.test(status)) {
    return 'in_transit';
  }
  if (/picked up|pickup|collected|recolect|recogid/.test(status)) return 'picked_up';
  if (/created|pending|ready|label|manifest|pre transit|registrad/.test(status)) {
    return 'created';
  }
  return 'unknown';
}

function normalizeTrackingEvent(event = {}, defaults = {}) {
  const status = clean(
    event.status || event.status_description || event.statusDescription || event.event,
    180
  );
  const description = clean(
    event.description || event.detail || event.status_description || event.statusDescription,
    500
  );
  const rawLocation = event.location;
  const location = clean(
    typeof rawLocation === 'object'
      ? [rawLocation.city, rawLocation.state, rawLocation.country].filter(Boolean).join(', ')
      : rawLocation || event.city,
    240
  );
  return {
    code: clean(event.code || event.statusCode || event.status_code, 100),
    status,
    description,
    location,
    occurredAt: asDate(
      event.date || event.occurredAt || event.timestamp || event.created_at || defaults.occurredAt,
      null
    ),
    receivedAt: asDate(defaults.receivedAt, new Date()),
    source: clean(defaults.source || event.source || 'provider', 40).toLowerCase(),
  };
}

function trackingEventKey(event = {}) {
  return [
    statusToken(event.code),
    statusToken(event.status),
    statusToken(event.description),
    statusToken(event.location),
    asDate(event.occurredAt)?.toISOString() || '',
  ].join('|');
}

function mergeTrackingEvents(existing = [], incoming = []) {
  const result = [];
  const seen = new Set();
  [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]
    .forEach((raw) => {
      const event = normalizeTrackingEvent(raw, {
        source: raw?.source,
        receivedAt: raw?.receivedAt,
      });
      const key = trackingEventKey(event);
      if (!event.status && !event.code && !event.description) return;
      if (seen.has(key)) return;
      seen.add(key);
      result.push(event);
    });
  return result.slice(-MAX_TRACKING_EVENTS);
}

function appendHistory(shipment, action, statusFrom, statusTo, note, reference, now) {
  shipment.history = Array.isArray(shipment.history) ? shipment.history : [];
  shipment.history.push({
    action,
    statusFrom,
    statusTo,
    note: clean(note, 1000),
    evidenceReference: clean(reference, 240),
    actor: {
      source: 'shipping_provider',
      displayName: 'Envia.com',
    },
    at: now,
  });
  shipment.history = shipment.history.slice(-MAX_SHIPMENT_HISTORY);
}

function providerEvidence(shipment, event, defaults = {}) {
  return clean(
    [
      defaults.eventId,
      shipment?.carrier?.trackingNumber,
      event.status || event.code,
    ].filter(Boolean).join(' · '),
    240
  );
}

function setDispatched(order, shipment, event, now, defaults) {
  const statusFrom = clean(shipment.status, 40).toLowerCase();
  const reference = providerEvidence(shipment, event, defaults);
  shipment.status = 'dispatched';
  shipment.dispatchedAt = shipment.dispatchedAt || now;
  shipment.dispatchEvidence = {
    reference: reference || `Envia ${clean(shipment?.carrier?.trackingNumber, 180)}`,
    recordedAt: now,
  };
  advanceOrderInventoryAllocationsForShipment(order, shipment.allocationIds, 'shipped', now);
  appendHistory(
    shipment,
    'shipping_provider_dispatched',
    statusFrom,
    'dispatched',
    'La transportadora confirmó que recibió o movilizó el paquete.',
    reference,
    now
  );
}

function setInTransit(shipment, event, now, defaults) {
  const statusFrom = clean(shipment.status, 40).toLowerCase();
  const reference = providerEvidence(shipment, event, defaults);
  shipment.status = 'in_transit';
  shipment.inTransitAt = shipment.inTransitAt || now;
  appendHistory(
    shipment,
    'shipping_provider_in_transit',
    statusFrom,
    'in_transit',
    'La transportadora reportó el paquete en tránsito.',
    reference,
    now
  );
}

function setDelivered(order, shipment, event, now, defaults) {
  const statusFrom = clean(shipment.status, 40).toLowerCase();
  const reference = providerEvidence(shipment, event, defaults);
  shipment.status = 'delivered';
  shipment.deliveredAt = shipment.deliveredAt || now;
  shipment.deliveryEvidence = {
    reference: reference || `Envia ${clean(shipment?.carrier?.trackingNumber, 180)}`,
    recipient: '',
    recordedAt: now,
  };
  advanceOrderInventoryAllocationsForShipment(order, shipment.allocationIds, 'shipped', now);
  advanceOrderInventoryAllocationsForShipment(order, shipment.allocationIds, 'delivered', now);
  appendHistory(
    shipment,
    'shipping_provider_delivered',
    statusFrom,
    'delivered',
    'La transportadora confirmó la entrega del paquete.',
    reference,
    now
  );
}

function setCarrierException(shipment, event, now, defaults) {
  const currentStatus = clean(shipment.status, 40).toLowerCase();
  if (['delivered', 'cancelled', 'exception'].includes(currentStatus)) return;
  const reference = providerEvidence(shipment, event, defaults);
  shipment.resumeStatus = currentStatus || 'ready_to_pick';
  shipment.status = 'exception';
  shipment.incidents = Array.isArray(shipment.incidents) ? shipment.incidents : [];
  const description = clean(
    event.description || event.status || 'La transportadora reportó una novedad.',
    1000
  );
  const alreadyOpen = shipment.incidents.some(
    (incident) => incident.status === 'open' && incident.type === 'carrier' &&
      clean(incident.description, 1000) === description
  );
  if (!alreadyOpen) {
    shipment.incidents.push({
      status: 'open',
      type: 'carrier',
      severity: 'high',
      description,
      openedAt: now,
      openedBy: { source: 'shipping_provider', displayName: 'Envia.com' },
    });
    shipment.incidents = shipment.incidents.slice(-MAX_SHIPMENT_INCIDENTS);
  }
  appendHistory(
    shipment,
    'shipping_provider_exception',
    currentStatus,
    'exception',
    description,
    reference,
    now
  );
}

function applyProviderTrackingUpdate(order, shipment, rawEvent = {}, defaults = {}) {
  if (!order || !shipment) return { changed: false, stage: 'unknown' };
  const now = asDate(defaults.receivedAt, new Date());
  const event = normalizeTrackingEvent(rawEvent, {
    source: defaults.source,
    occurredAt: defaults.occurredAt,
    receivedAt: now,
  });
  const stage = providerStage(event.status || event.code || event.description);
  const integration = shipment.shippingIntegration || (shipment.shippingIntegration = {});
  const statusBefore = clean(shipment.status, 40).toLowerCase();

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

  if (stage === 'picked_up' && statusBefore === 'packed') {
    setDispatched(order, shipment, event, now, defaults);
  } else if (stage === 'in_transit') {
    if (statusBefore === 'packed') setDispatched(order, shipment, event, now, defaults);
    if (['packed', 'dispatched'].includes(statusBefore) || shipment.status === 'dispatched') {
      setInTransit(shipment, event, now, defaults);
    }
  } else if (stage === 'delivered') {
    if (statusBefore === 'packed') setDispatched(order, shipment, event, now, defaults);
    if (['packed', 'dispatched', 'in_transit'].includes(statusBefore) ||
        ['dispatched', 'in_transit'].includes(shipment.status)) {
      setDelivered(order, shipment, event, now, defaults);
    }
  } else if (stage === 'exception') {
    setCarrierException(shipment, event, now, defaults);
  } else if (stage === 'cancelled') {
    integration.status = 'cancelled';
    integration.cancelledAt = integration.cancelledAt || now;
    const cancellation = integration.cancellation || (integration.cancellation = {});
    cancellation.status = cancellation.balanceReturned ? 'refunded' : 'confirmed';
    cancellation.confirmedAt = cancellation.confirmedAt || now;
  }

  shipment.updatedAt = now;
  reconcileOrderFromLogistics(order, now);
  return {
    changed: true,
    event,
    stage,
    statusFrom: statusBefore,
    statusTo: clean(shipment.status, 40).toLowerCase(),
  };
}

module.exports = {
  providerStage,
  normalizeTrackingEvent,
  mergeTrackingEvents,
  applyProviderTrackingUpdate,
};
