'use strict';

const { createLogisticsError } = require('../orderLogisticsService');
const { publicWebhookUrl } = require('../shippingConfigurationService');
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
      'La prueba oficial automática solo está disponible en Envia Sandbox.',
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
  const webhookUrl = clean(
    dependencies.webhookUrl || publicWebhookUrl(),
    500
  );
  if (!webhookUrl) {
    throw createLogisticsError(
      'Configura la URL pública del webhook antes de solicitar la prueba oficial.',
      'SHIPPING_WEBHOOK_URL_REQUIRED',
      422
    );
  }
  const result = await provider.testWebhook({ trackingNumber, webhookUrl });
  return integrationResponse(
    order,
    shipment,
    {
      testWebhook: {
        accepted: true,
        carrier,
        trackingNumber,
        webhookUrl,
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
