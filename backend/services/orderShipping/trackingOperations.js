'use strict';

const { createLogisticsError } = require('../orderLogisticsService');
const {
  applyProviderTrackingUpdate,
  mergeTrackingEvents,
} = require('../shippingTrackingStateService');
const {
  appendIntegrationHistory,
  integrationResponse,
  loadContext,
  persistIntegration,
  providerIntegration,
} = require('./integrationState');
const { resolveProvider } = require('./providerAdapter');
const { clean } = require('./shared');

const MAX_TRACKING_EVENTS = 80;

function trackingEventsFrom(data = [], now = new Date()) {
  const validDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const source = Array.isArray(data) ? data : [];
  return source.flatMap((item) => {
    const events = Array.isArray(item?.events)
      ? item.events
      : Array.isArray(item?.data)
        ? item.data
        : [item];
    return events.map((event) => ({
      code: clean(event.code || event.statusCode, 100),
      status: clean(event.status || event.event, 160),
      description: clean(event.description || event.detail, 500),
      location: clean(event.location || event.city, 240),
      occurredAt: validDate(event.date || event.occurredAt || event.timestamp),
      receivedAt: now,
      source: 'provider',
    }));
  }).slice(-MAX_TRACKING_EVENTS);
}

async function syncOrderShipmentTracking(input = {}, dependencies = {}) {
  const provider = await resolveProvider(input, dependencies);
  const { order, shipment, scope } = await loadContext(input, dependencies);
  const trackingNumber = clean(shipment?.carrier?.trackingNumber, 180);
  if (!trackingNumber) {
    throw createLogisticsError(
      'El envío todavía no tiene número de guía.',
      'SHIPPING_TRACKING_NUMBER_REQUIRED',
      422
    );
  }
  const now = new Date();
  const events = trackingEventsFrom(await provider.track(trackingNumber), now);
  const integration = providerIntegration(shipment);
  integration.provider = provider.key;
  integration.mode = provider.mode;
  integration.trackingEvents = mergeTrackingEvents(integration.trackingEvents, events);
  integration.lastSyncedAt = now;
  integration.lastError = {};
  const orderedEvents = [...events].sort((left, right) => {
    const leftAt = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
    const rightAt = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
    return leftAt - rightAt;
  });
  orderedEvents.forEach((event) => {
    applyProviderTrackingUpdate(order, shipment, event, {
      provider: provider.key,
      source: 'provider',
      receivedAt: now,
    });
  });
  appendIntegrationHistory(shipment, 'shipping_tracking_sync', 'Seguimiento sincronizado con la transportadora.', now);
  return persistIntegration(order, shipment, now, scope);
}

async function testOrderShipmentWebhook(input = {}, dependencies = {}) {
  const provider = await resolveProvider(input, dependencies);
  const { order, shipment, scope } = await loadContext(input, dependencies);
  if (provider.mode !== 'sandbox') {
    throw createLogisticsError(
      'Los eventos simulados solo están disponibles en Envia Sandbox.',
      'SHIPPING_WEBHOOK_TEST_SANDBOX_ONLY',
      409
    );
  }
  const carrier = clean(shipment?.carrier?.code || shipment?.carrier?.name, 80).toLowerCase();
  const trackingNumber = clean(shipment?.carrier?.trackingNumber, 180);
  if (!carrier || !trackingNumber) {
    throw createLogisticsError(
      'Primero genera una guía Sandbox para probar el seguimiento automático.',
      'SHIPPING_LABEL_REQUIRED',
      422
    );
  }
  const allowed = new Map([
    ['picked up', 'Picked Up'],
    ['shipped', 'Shipped'],
    ['delivered', 'Delivered'],
    ['canceled', 'Canceled'],
    ['cancelled', 'Canceled'],
  ]);
  const requestedStatus = clean(input.testStatus || 'Shipped', 40).toLowerCase();
  const status = allowed.get(requestedStatus);
  if (!status) {
    throw createLogisticsError(
      'El estado de prueba debe ser Picked Up, Shipped, Delivered o Canceled.',
      'SHIPPING_WEBHOOK_TEST_STATUS_INVALID',
      422
    );
  }
  const result = await provider.testWebhook({ carrier, trackingNumber, status });
  return integrationResponse(
    order,
    shipment,
    {
      testWebhook: {
        accepted: true,
        carrier,
        trackingNumber,
        status,
        result,
      },
    },
    scope
  );
}

module.exports = {
  syncOrderShipmentTracking,
  testOrderShipmentWebhook,
  trackingEventsFrom,
};
