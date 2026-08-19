'use strict';

const crypto = require('crypto');

const Order = require('../models/Order');
const Branch = require('../models/Branch');
const ShippingOperation = require('../models/ShippingOperation');
const { logisticsView, createLogisticsError } = require('./orderLogisticsService');
const {
  getShippingProviderStatus,
  resolveShippingProvider,
} = require('./shippingProviderService');
const {
  buildEnviaShipmentPayload,
  normalizeGeneratedLabel,
  normalizeRate,
} = require('./shippingPayloadService');

const MAX_TRACKING_EVENTS = 80;

function clean(value, maxLength = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function idValue(value) {
  return String(value?._id || value || '').trim();
}

function ensureShipmentAccess(shipment, { authorizedBranchIds = [], allowAllBranches = false } = {}) {
  if (allowAllBranches) return;
  const allowed = new Set((authorizedBranchIds || []).map(idValue).filter(Boolean));
  if (!allowed.has(idValue(shipment?.branch))) {
    throw createLogisticsError(
      'No tienes permiso para operar el envío de esa sede.',
      'SHIPMENT_BRANCH_FORBIDDEN',
      403
    );
  }
}

function ensureExpectedRevision(shipment, expectedRevision) {
  const received = Number(expectedRevision);
  if (!Number.isInteger(received) || received < 0) {
    throw createLogisticsError(
      'Debes enviar la revisión logística visible.',
      'LOGISTICS_REVISION_REQUIRED',
      428
    );
  }
  if (received !== Number(shipment?.revision || 0)) {
    throw createLogisticsError(
      'El envío cambió mientras lo estabas revisando. Recarga el detalle.',
      'LOGISTICS_REVISION_CONFLICT',
      409,
      { expected: received, current: Number(shipment?.revision || 0) }
    );
  }
}

async function loadContext(
  { orderFilter, shipmentId, expectedRevision, authorizedBranchIds, allowAllBranches },
  { OrderModel = Order, BranchModel = Branch } = {}
) {
  const order = await OrderModel.findOne(orderFilter);
  if (!order) {
    throw createLogisticsError(
      'Orden no encontrada dentro de tus sedes autorizadas.',
      'ORDER_NOT_FOUND',
      404
    );
  }
  const shipment = order.fulfillment?.shipments?.id(shipmentId);
  if (!shipment) {
    throw createLogisticsError('Envío logístico no encontrado.', 'SHIPMENT_NOT_FOUND', 404);
  }
  ensureShipmentAccess(shipment, { authorizedBranchIds, allowAllBranches });
  ensureExpectedRevision(shipment, expectedRevision);
  const branchQuery = BranchModel.findById(shipment.branch);
  const branch = typeof branchQuery?.lean === 'function'
    ? await branchQuery.lean()
    : await branchQuery;
  if (!branch) {
    throw createLogisticsError(
      'La sede de origen ya no está disponible.',
      'SHIPPING_ORIGIN_BRANCH_NOT_FOUND',
      409
    );
  }
  return { order, shipment, branch };
}

function providerIntegration(shipment) {
  if (!shipment.shippingIntegration) shipment.shippingIntegration = {};
  return shipment.shippingIntegration;
}

function appendIntegrationHistory(shipment, action, note, now) {
  shipment.history = Array.isArray(shipment.history) ? shipment.history : [];
  shipment.history.push({
    action,
    statusFrom: shipment.status,
    statusTo: shipment.status,
    note: clean(note, 1000),
    actor: { source: 'shipping_provider', displayName: 'Envia.com' },
    at: now,
  });
  shipment.history = shipment.history.slice(-100);
}

async function persistIntegration(order, shipment, now = new Date()) {
  shipment.revision = Number(shipment.revision || 0) + 1;
  shipment.updatedAt = now;
  await order.save();
  return {
    ...logisticsView(order, now),
    shippingProviders: await getShippingProviderStatus(),
    shipment,
  };
}

async function integrationResponse(order, shipment, extra = {}) {
  return {
    ...logisticsView(order, new Date()),
    shippingProviders: await getShippingProviderStatus(),
    shipment,
    ...extra,
  };
}

async function resolveColombiaAddresses(provider, payload) {
  if (typeof provider?.resolveColombiaCity !== 'function') return payload;
  const prepared = {
    ...payload,
    origin: { ...payload.origin },
    destination: { ...payload.destination },
  };
  for (const key of ['origin', 'destination']) {
    const address = prepared[key];
    if (address.country !== 'CO' || /^\d{8}$/.test(clean(address.city, 20))) {
      continue;
    }
    let located;
    try {
      located = await provider.resolveColombiaCity({
        city: address.city,
        state: address.state,
        country: 'CO',
      });
    } catch (error) {
      const rejectedLocation =
        error?.code === 'SHIPPING_PROVIDER_REJECTED' &&
        error?.details?.operation === 'resolve_colombia_city';
      if (!rejectedLocation) throw error;
      const origin = key === 'origin';
      const place = origin
        ? `la sede ${clean(address.name, 120) || 'de origen'}`
        : 'la dirección de entrega';
      throw createLogisticsError(
        `Envia no pudo validar la ciudad y el departamento de ${place}: ${clean(address.city, 120)} (${clean(address.state, 20)}). ${origin ? 'Corrige la ubicación en Configuración → Sedes.' : 'Corrige la dirección del cliente en la orden.'}`,
        'SHIPPING_CITY_NOT_RESOLVED',
        422,
        {
          address: key,
          city: clean(address.city, 120),
          state: clean(address.state, 20),
        }
      );
    }
    const daneCity = clean(located?.city, 20);
    if (!/^\d{8}$/.test(daneCity)) {
      throw createLogisticsError(
        `Envia no pudo validar la ciudad de ${key === 'origin' ? 'la sede' : 'entrega'} con un código DANE de 8 dígitos.`,
        'SHIPPING_CITY_NOT_RESOLVED',
        422,
        { address: key }
      );
    }
    address.city = daneCity;
    address.state = clean(located?.state || address.state, 20);
    address.postalCode = clean(
      located?.postalCode || located?.zipCode || address.postalCode,
      30
    );
  }
  return prepared;
}

async function quoteOrderShipment(input = {}, dependencies = {}) {
  const provider = await resolveShippingProvider(input.provider || 'envia', dependencies);
  const { order, shipment, branch } = await loadContext(input, dependencies);
  const payload = await resolveColombiaAddresses(
    provider,
    buildEnviaShipmentPayload({ order, shipment, branch })
  );
  const data = await provider.quote(payload);
  const rates = data.map((item) => normalizeRate(item));
  return integrationResponse(order, shipment, { rates });
}

function stableHash(value) {
  const canonicalize = (item) => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.keys(item).sort().map((key) => [key, canonicalize(item[key])])
      );
    }
    return item;
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

async function reserveOperation(
  { order, shipment, provider, type, idempotencyKey, requestPayload },
  { OperationModel = ShippingOperation } = {}
) {
  const key = clean(idempotencyKey, 180);
  if (key.length < 12) {
    throw createLogisticsError(
      'La operación externa requiere una clave de idempotencia de al menos 12 caracteres.',
      'SHIPPING_IDEMPOTENCY_KEY_REQUIRED',
      400
    );
  }
  const requestHash = stableHash(requestPayload);
  let existing = await OperationModel.findOne({ idempotencyKey: key });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw createLogisticsError(
        'La clave de idempotencia ya fue usada con otros datos.',
        'SHIPPING_IDEMPOTENCY_CONFLICT',
        409
      );
    }
    if (existing.status === 'succeeded') return { operation: existing, replay: true };
    if (existing.status === 'failed') {
      existing.status = 'processing';
      existing.attempts = Number(existing.attempts || 1) + 1;
      existing.error = {};
      await existing.save();
      return { operation: existing, replay: false };
    }
    throw createLogisticsError(
      'La operación externa ya existe y requiere revisión antes de reintentar.',
      'SHIPPING_OPERATION_ALREADY_EXISTS',
      409,
      { operationId: idValue(existing._id), status: existing.status }
    );
  }
  try {
    existing = await OperationModel.create({
      order: order._id,
      shipmentId: shipment._id,
      provider: provider.key,
      mode: provider.mode,
      type,
      idempotencyKey: key,
      requestHash,
      status: 'processing',
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw createLogisticsError(
        'La operación externa ya está siendo procesada.',
        'SHIPPING_OPERATION_IN_PROGRESS',
        409
      );
    }
    throw error;
  }
  return { operation: existing, replay: false };
}

async function generateOrderShipmentLabel(input = {}, dependencies = {}) {
  const provider = await resolveShippingProvider(input.provider || 'envia', dependencies);
  const { order, shipment, branch } = await loadContext(input, dependencies);
  const rate = normalizeRate(input.rate || {});
  if (!rate.carrier || !rate.service) {
    throw createLogisticsError(
      'Selecciona una tarifa válida antes de generar la guía.',
      'SHIPPING_RATE_REQUIRED',
      422
    );
  }
  const payload = await resolveColombiaAddresses(
    provider,
    buildEnviaShipmentPayload({ order, shipment, branch, rate })
  );
  const { operation, replay } = await reserveOperation(
    {
      order,
      shipment,
      provider,
      type: 'generate_label',
      idempotencyKey: input.idempotencyKey,
      requestPayload: payload,
    },
    dependencies
  );
  if (replay) {
    return integrationResponse(order, shipment, {
      operationId: idValue(operation._id),
      replayed: true,
      result: operation.result,
    });
  }

  try {
    const generated = normalizeGeneratedLabel((await provider.generateLabel(payload))[0]);
    operation.status = 'action_required';
    operation.providerReference = generated.providerShipmentId;
    operation.trackingNumber = generated.trackingNumber;
    operation.result = generated;
    await operation.save();
    const integration = providerIntegration(shipment);
    integration.provider = provider.key;
    integration.mode = provider.mode;
    integration.status = 'label_generated';
    integration.providerShipmentId = generated.providerShipmentId;
    integration.labelUrl = generated.labelUrl;
    integration.labelFormat = 'PDF';
    integration.selectedRate = {
      ...rate,
      totalPrice: generated.totalPrice || rate.totalPrice,
      currency: generated.currency || rate.currency,
    };
    integration.lastError = {};
    shipment.carrier = shipment.carrier || {};
    shipment.carrier.code = generated.carrier.toUpperCase();
    shipment.carrier.name = generated.carrier || rate.carrier;
    shipment.carrier.serviceLevel = generated.service || rate.service;
    shipment.carrier.trackingNumber = generated.trackingNumber;
    shipment.carrier.trackingUrl = generated.trackingUrl;
    appendIntegrationHistory(
      shipment,
      'shipping_label_generated',
      `Guía ${generated.trackingNumber || generated.providerShipmentId} generada en ${provider.mode}.`,
      new Date()
    );
    const result = await persistIntegration(order, shipment);
    operation.status = 'succeeded';
    await operation.save();
    return { ...result, operationId: idValue(operation._id), result: generated };
  } catch (error) {
    const ambiguous = new Set([
      'SHIPPING_PROVIDER_TIMEOUT',
      'SHIPPING_PROVIDER_UNAVAILABLE',
      'SHIPPING_PROVIDER_HTTP_ERROR',
    ]);
    operation.status = operation.result || ambiguous.has(error?.code)
      ? 'action_required'
      : 'failed';
    operation.error = {
      code: clean(error?.code, 100),
      message: clean(error?.message, 500),
    };
    await operation.save().catch(() => {});
    throw error;
  }
}

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
  const provider = await resolveShippingProvider(input.provider || 'envia', dependencies);
  const { order, shipment } = await loadContext(input, dependencies);
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
  integration.status = 'tracking';
  integration.trackingEvents = events;
  integration.lastSyncedAt = now;
  integration.lastError = {};
  appendIntegrationHistory(shipment, 'shipping_tracking_sync', 'Seguimiento sincronizado con la transportadora.', now);
  return persistIntegration(order, shipment, now);
}

async function cancelOrderShipmentLabel(input = {}, dependencies = {}) {
  const provider = await resolveShippingProvider(input.provider || 'envia', dependencies);
  const { order, shipment } = await loadContext(input, dependencies);
  const carrier = clean(shipment?.carrier?.code || shipment?.carrier?.name, 80);
  const trackingNumber = clean(shipment?.carrier?.trackingNumber, 180);
  if (!carrier || !trackingNumber) {
    throw createLogisticsError(
      'La cancelación exige transportadora y número de guía.',
      'SHIPPING_LABEL_REQUIRED',
      422
    );
  }
  const requestPayload = { carrier, trackingNumber };
  const { operation, replay } = await reserveOperation(
    {
      order,
      shipment,
      provider,
      type: 'cancel_label',
      idempotencyKey: input.idempotencyKey,
      requestPayload,
    },
    dependencies
  );
  if (replay) {
    return integrationResponse(order, shipment, {
      operationId: idValue(operation._id),
      replayed: true,
      result: operation.result,
    });
  }
  try {
    const result = (await provider.cancel(requestPayload))[0];
    operation.status = 'action_required';
    operation.trackingNumber = trackingNumber;
    operation.result = result;
    await operation.save();
    const now = new Date();
    const integration = providerIntegration(shipment);
    integration.status = 'cancelled';
    integration.cancelledAt = now;
    appendIntegrationHistory(shipment, 'shipping_label_cancelled', `Guía ${trackingNumber} cancelada.`, now);
    const response = await persistIntegration(order, shipment, now);
    operation.status = 'succeeded';
    operation.providerReference = clean(integration.providerShipmentId, 180);
    await operation.save();
    return { ...response, operationId: idValue(operation._id), result };
  } catch (error) {
    const ambiguous = new Set([
      'SHIPPING_PROVIDER_TIMEOUT',
      'SHIPPING_PROVIDER_UNAVAILABLE',
      'SHIPPING_PROVIDER_HTTP_ERROR',
    ]);
    operation.status = operation.result || ambiguous.has(error?.code)
      ? 'action_required'
      : 'failed';
    operation.error = { code: clean(error?.code, 100), message: clean(error?.message, 500) };
    await operation.save().catch(() => {});
    throw error;
  }
}

module.exports = {
  buildEnviaShipmentPayload,
  normalizeRate,
  normalizeGeneratedLabel,
  resolveColombiaAddresses,
  quoteOrderShipment,
  generateOrderShipmentLabel,
  syncOrderShipmentTracking,
  cancelOrderShipmentLabel,
};
