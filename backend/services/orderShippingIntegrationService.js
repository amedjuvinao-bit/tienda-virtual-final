'use strict';

const crypto = require('crypto');

const Order = require('../models/Order');
const Branch = require('../models/Branch');
const ShippingOperation = require('../models/ShippingOperation');
const {
  logisticsView,
  createLogisticsError,
  reconcileOrderFromLogistics,
} = require('./orderLogisticsService');
const {
  getShippingProviderStatus,
  resolveShippingProvider,
} = require('./shippingProviderService');
const {
  buildEnviaShipmentPayload,
  daneColombiaDepartmentCode,
  normalizeGeneratedLabel,
  normalizeRate,
} = require('./shippingPayloadService');
const {
  resolveOrderBillingMunicipality,
} = require('./orderBillingMunicipalityService');
const {
  applyProviderTrackingUpdate,
  mergeTrackingEvents,
} = require('./shippingTrackingStateService');

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
  reconcileOrderFromLogistics(order, now);
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

function normalizedLocationText(value) {
  return clean(value, 180)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function locationValue(location, ...keys) {
  for (const key of keys) {
    const value = clean(location?.[key], 180);
    if (value) return value;
  }
  return '';
}

function chooseEnviaLocation(locations, address) {
  const candidates = Array.isArray(locations) ? locations.filter(Boolean) : [];
  if (candidates.length <= 1) return candidates[0] || null;
  const expected = {
    city: normalizedLocationText(address.city),
    state: normalizedLocationText(address.state),
    postalCode: normalizedLocationText(address.postalCode),
  };
  const ranked = candidates
    .map((location) => {
      const actual = {
        city: normalizedLocationText(locationValue(location, 'city', 'locality')),
        state: normalizedLocationText(locationValue(location, 'state', 'stateCode')),
        postalCode: normalizedLocationText(locationValue(location, 'zipcode', 'postalCode', 'zipCode')),
      };
      const score =
        (expected.postalCode && actual.postalCode === expected.postalCode ? 8 : 0) +
        (expected.state && actual.state === expected.state ? 4 : 0) +
        (expected.city && actual.city === expected.city ? 2 : 0);
      return { location, score };
    })
    .sort((left, right) => right.score - left.score);
  if (!ranked[0]?.score || ranked[0].score === ranked[1]?.score) return null;
  return ranked[0].location;
}

function unresolvedShippingAddress(key, address, message = '') {
  const origin = key === 'origin';
  const place = origin
    ? `la sede ${clean(address.name, 120) || 'de origen'}`
    : 'la dirección de entrega';
  return createLogisticsError(
    message ||
      `No fue posible validar ${place}: ${clean(address.city, 120)} (${clean(address.state, 80)}), ${clean(address.country, 10)}. ${origin ? 'Corrige la ubicación en Configuración → Sedes.' : 'Corrige la dirección del cliente en la orden.'}`,
    'SHIPPING_ADDRESS_NOT_RESOLVED',
    422,
    {
      address: key,
      country: clean(address.country, 10),
      city: clean(address.city, 120),
      state: clean(address.state, 80),
      postalCode: clean(address.postalCode, 30),
    }
  );
}

async function resolveShippingAddresses(provider, payload) {
  const prepared = {
    ...payload,
    origin: { ...payload.origin },
    destination: { ...payload.destination },
  };
  for (const key of ['origin', 'destination']) {
    const address = prepared[key];
    if (!/^[A-Z]{2}$/.test(clean(address.country, 10))) {
      throw unresolvedShippingAddress(
        key,
        address,
        `El país de ${key === 'origin' ? 'la sede' : 'la entrega'} no tiene un código ISO de dos letras válido.`
      );
    }

    if (address.country !== 'CO') {
      if (typeof provider?.resolveAddress !== 'function') continue;
      if (address.state && typeof provider?.resolveState === 'function') {
        try {
          const state = await provider.resolveState({
            country: address.country,
            state: address.state,
          });
          address.state = locationValue(state, 'code', 'state_code', 'stateCode') || address.state;
        } catch (error) {
          const unsupportedStateCatalog =
            error?.code === 'SHIPPING_PROVIDER_HTTP_ERROR' &&
            error?.details?.operation === 'list_states' &&
            [400, 404].includes(Number(error?.details?.providerStatus));
          if (
            !unsupportedStateCatalog &&
            !['SHIPPING_PROVIDER_EMPTY_RESPONSE', 'SHIPPING_PROVIDER_REJECTED'].includes(error?.code)
          ) {
            throw error;
          }
        }
      }
      let locations;
      try {
        locations = await provider.resolveAddress({
          country: address.country,
          city: address.city,
          postalCode: address.postalCode,
        });
      } catch (error) {
        const unresolved =
          ['SHIPPING_PROVIDER_EMPTY_RESPONSE', 'SHIPPING_PROVIDER_REJECTED']
            .includes(error?.code) &&
          error?.details?.operation === 'resolve_address';
        if (!unresolved) throw error;
        throw unresolvedShippingAddress(key, address);
      }
      const located = chooseEnviaLocation(locations, address);
      if (!located) throw unresolvedShippingAddress(key, address);
      address.city = locationValue(located, 'city', 'locality') || address.city;
      address.state = locationValue(located, 'state', 'stateCode') || address.state;
      address.postalCode =
        locationValue(located, 'zipcode', 'postalCode', 'zipCode') || address.postalCode;
      continue;
    }

    if (/^\d{8}$/.test(clean(address.city, 20))) continue;

    const cityValue = clean(address.city, 120);
    const fiveDigitMunicipality = /^\d{5}$/.test(cityValue) ? cityValue : '';
    const municipality = resolveOrderBillingMunicipality(
      {
        billing: {
          countryCode: 'CO',
          city: fiveDigitMunicipality ? '' : cityValue,
          municipalityCode: fiveDigitMunicipality,
          departmentCode: daneColombiaDepartmentCode(address.state),
        },
      },
      { required: false }
    );
    const localDaneCity = clean(municipality?.municipalityCode, 5);
    if (/^\d{5}$/.test(localDaneCity)) {
      address.city = `${localDaneCity}000`;
      continue;
    }

    const origin = key === 'origin';
    const place = origin
      ? `la sede ${clean(address.name, 120) || 'de origen'}`
      : 'la dirección de entrega';
    const unresolvedCity = () => createLogisticsError(
      `No fue posible identificar el municipio colombiano de ${place}: ${cityValue} (${clean(address.state, 20)}). ${origin ? 'Corrige la ubicación en Configuración → Sedes.' : 'Corrige la dirección del cliente en la orden.'}`,
      'SHIPPING_CITY_NOT_RESOLVED',
      422,
      {
        address: key,
        city: cityValue,
        state: clean(address.state, 20),
      }
    );

    if (typeof provider?.resolveColombiaCity !== 'function') {
      throw unresolvedCity();
    }
    let located;
    try {
      located = await provider.resolveColombiaCity({
        city: address.city,
        state: address.state,
        country: 'CO',
      });
    } catch (error) {
      const unresolvedLocation =
        ['SHIPPING_PROVIDER_REJECTED', 'SHIPPING_PROVIDER_EMPTY_RESPONSE']
          .includes(error?.code) &&
        error?.details?.operation === 'resolve_colombia_city';
      if (!unresolvedLocation) throw error;
      throw unresolvedCity();
    }
    const daneCity = clean(located?.city, 20);
    if (!/^\d{8}$/.test(daneCity)) {
      throw unresolvedCity();
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
  const payload = await resolveShippingAddresses(
    provider,
    buildEnviaShipmentPayload({
      order,
      shipment,
      branch,
      customsPolicy: provider.customsPolicy,
    })
  );
  const data = await provider.quote(payload);
  const normalizedRates = data.map((item) => normalizeRate(item));
  const actionsByCarrier = new Map();
  await Promise.all(
    [...new Set(normalizedRates.map((rate) => clean(rate.carrier, 80).toLowerCase()).filter(Boolean))]
      .map(async (carrier) => {
        if (typeof provider.getCarrierActions !== 'function') {
          actionsByCarrier.set(carrier, { actions: [], resolved: false });
          return;
        }
        try {
          const actions = await provider.getCarrierActions(carrier);
          actionsByCarrier.set(carrier, {
            actions: [...new Set((Array.isArray(actions) ? actions : [])
              .map((action) => clean(action, 80).toLowerCase())
              .filter(Boolean))],
            resolved: true,
          });
        } catch {
          actionsByCarrier.set(carrier, { actions: [], resolved: false });
        }
      })
  );
  const rates = normalizedRates.map((rate) => {
    const capability = actionsByCarrier.get(clean(rate.carrier, 80).toLowerCase()) || {
      actions: [],
      resolved: false,
    };
    return {
      ...rate,
      carrierActions: capability.actions,
      carrierActionsResolved: capability.resolved,
    };
  });
  return integrationResponse(order, shipment, { rates });
}

async function resolveCarrierActions(provider, carrier) {
  if (typeof provider?.getCarrierActions !== 'function') return [];
  const actions = await provider.getCarrierActions(clean(carrier, 80).toLowerCase());
  return [...new Set((Array.isArray(actions) ? actions : [])
    .map((action) => clean(action, 80).toLowerCase())
    .filter(Boolean))];
}

function pickupOnGeneratePayload(payload, requestedDate) {
  const packages = Array.isArray(payload?.packages) ? payload.packages : [];
  const totalPackages = packages.reduce(
    (total, item) => total + Math.max(1, Number(item?.amount || 1)),
    0
  );
  const totalWeight = packages.reduce(
    (total, item) => total + (Math.max(0, Number(item?.weight || 0)) * Math.max(1, Number(item?.amount || 1))),
    0
  );
  return {
    ...payload,
    shipment: {
      ...(payload.shipment || {}),
      pickup: {
        date: requestedDate,
        totalPackages: Math.max(1, totalPackages),
        totalWeight: Number(totalWeight.toFixed(3)),
      },
    },
  };
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
  const payload = await resolveShippingAddresses(
    provider,
    buildEnviaShipmentPayload({
      order,
      shipment,
      branch,
      rate,
      customsPolicy: provider.customsPolicy,
    })
  );
  const actions = await resolveCarrierActions(provider, rate.carrier);
  const pickupOnGenerate = actions.includes('pickup_on_generate');
  const requestedPickupDate = pickupOnGenerate
    ? pickupDate(input.pickupDate, input.now || new Date())
    : '';
  const requestPayload = pickupOnGenerate
    ? pickupOnGeneratePayload(payload, requestedPickupDate)
    : payload;
  const { operation, replay } = await reserveOperation(
    {
      order,
      shipment,
      provider,
      type: 'generate_label',
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
    const generatedItem = (await provider.generateLabel(requestPayload))[0] || {};
    const generated = normalizeGeneratedLabel(generatedItem);
    const generatedPickupConfirmation = pickupOnGenerate
      ? pickupConfirmation(generatedItem)
      : '';
    const operationResult = {
      ...generated,
      carrierActions: actions,
      ...(pickupOnGenerate
        ? {
            pickup: {
              requestedDate: requestedPickupDate,
              confirmation: generatedPickupConfirmation,
            },
          }
        : {}),
    };
    operation.status = 'action_required';
    operation.providerReference = generated.providerShipmentId;
    operation.trackingNumber = generated.trackingNumber;
    operation.result = operationResult;
    await operation.save();
    const integration = providerIntegration(shipment);
    integration.provider = provider.key;
    integration.mode = provider.mode;
    integration.status = 'label_generated';
    integration.providerShipmentId = generated.providerShipmentId;
    integration.labelUrl = generated.labelUrl;
    integration.labelFormat = 'PDF';
    integration.carrierActions = actions;
    integration.selectedRate = {
      ...rate,
      totalPrice: generated.totalPrice || rate.totalPrice,
      currency: generated.currency || rate.currency,
    };
    const now = new Date();
    integration.handoffMode = generatedPickupConfirmation ? 'pickup' : 'pending';
    integration.handoffConfirmedAt = generatedPickupConfirmation ? now : null;
    integration.pickup = pickupOnGenerate
      ? {
          status: generatedPickupConfirmation ? 'scheduled' : 'failed',
          confirmation: generatedPickupConfirmation,
          requestedDate: requestedPickupDate,
          timeFrom: '',
          timeTo: '',
          instructions: clean(input.pickupInstructions, 500),
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
    if (pickupOnGenerate) {
      appendIntegrationHistory(
        shipment,
        generatedPickupConfirmation
          ? 'shipping_pickup_scheduled_on_generate'
          : 'shipping_pickup_confirmation_missing',
        generatedPickupConfirmation
          ? `Recolección ${generatedPickupConfirmation} incluida al generar la guía para ${requestedPickupDate}.`
          : `La guía fue creada con recolección para ${requestedPickupDate}, pero Envia no devolvió confirmación; requiere revisión antes de preparar el paquete.`,
        now
      );
    }
    const result = await persistIntegration(order, shipment);
    operation.status = pickupOnGenerate && !generatedPickupConfirmation
      ? 'action_required'
      : 'succeeded';
    await operation.save();
    return {
      ...result,
      operationId: idValue(operation._id),
      result: operationResult,
      actionRequired: pickupOnGenerate && !generatedPickupConfirmation,
    };
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
  return persistIntegration(order, shipment, now);
}

async function testOrderShipmentWebhook(input = {}, dependencies = {}) {
  const provider = await resolveShippingProvider(input.provider || 'envia', dependencies);
  const { order, shipment } = await loadContext(input, dependencies);
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
  return integrationResponse(order, shipment, {
    testWebhook: {
      accepted: true,
      carrier,
      trackingNumber,
      status,
      result,
    },
  });
}

function pickupDate(value, now = new Date()) {
  const normalized = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw createLogisticsError(
      'Selecciona una fecha válida para la recolección.',
      'SHIPPING_PICKUP_DATE_INVALID',
      422
    );
  }
  const parsed = new Date(`${normalized}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw createLogisticsError(
      'Selecciona una fecha válida para la recolección.',
      'SHIPPING_PICKUP_DATE_INVALID',
      422
    );
  }
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
  if (normalized < today) {
    throw createLogisticsError(
      'La recolección no puede programarse en una fecha anterior a hoy.',
      'SHIPPING_PICKUP_DATE_PAST',
      422
    );
  }
  return normalized;
}

function pickupTime(value, field) {
  const normalized = clean(value, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
    throw createLogisticsError(
      `Selecciona una hora válida para ${field}.`,
      'SHIPPING_PICKUP_TIME_INVALID',
      422,
      { field }
    );
  }
  return normalized;
}

function pickupHour(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return Number((hours + (minutes / 60)).toFixed(2));
}

function pickupDisplayTime(value, fallback) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue >= 24) {
    return clean(value || fallback, 20);
  }
  const totalMinutes = Math.round(numericValue * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function pickupPackageTotals(packages = []) {
  return (Array.isArray(packages) ? packages : []).reduce(
    (totals, item) => {
      const amount = Math.max(1, Number(item?.amount || 1));
      totals.totalPackages += amount;
      totals.totalWeight += Math.max(0, Number(item?.weight || 0)) * amount;
      return totals;
    },
    { totalPackages: 0, totalWeight: 0 }
  );
}

function buildStandalonePickupPayload({
  shipmentPayload,
  carrier,
  trackingNumber,
  requestedDate,
  timeFrom,
  timeTo,
  instructions,
} = {}) {
  const packageTotals = pickupPackageTotals(shipmentPayload?.packages);
  return {
    origin: shipmentPayload?.origin || {},
    shipment: {
      type: 1,
      carrier,
      pickup: {
        weightUnit: 'KG',
        totalWeight: Number(packageTotals.totalWeight.toFixed(3)),
        totalPackages: Math.max(1, packageTotals.totalPackages),
        date: requestedDate,
        timeFrom: pickupHour(timeFrom),
        timeTo: pickupHour(timeTo),
        carrier,
        trackingNumbers: [trackingNumber],
        ...(clean(instructions, 500)
          ? { instructions: clean(instructions, 500) }
          : {}),
      },
    },
  };
}

function pickupConfirmation(result = {}) {
  const nested = result.pickup || result.pickupResponse || result.pickupData || {};
  return clean(
    result.confirmation ||
    result.confirmationNumber ||
    result.pickupConfirmation ||
    result.pickupNumber ||
    result.folio ||
    result.id ||
    nested.confirmation ||
    nested.confirmationNumber ||
    nested.pickupConfirmation ||
    nested.pickupNumber ||
    nested.folio ||
    nested.id,
    180
  );
}

async function scheduleOrderShipmentPickup(input = {}, dependencies = {}) {
  const provider = await resolveShippingProvider(input.provider || 'envia', dependencies);
  const { order, shipment, branch } = await loadContext(input, dependencies);
  const carrier = clean(shipment?.carrier?.code || shipment?.carrier?.name, 80).toLowerCase();
  const trackingNumber = clean(shipment?.carrier?.trackingNumber, 180);
  if (!carrier || !trackingNumber) {
    throw createLogisticsError(
      'Primero genera una guía para poder solicitar la recolección.',
      'SHIPPING_LABEL_REQUIRED',
      422
    );
  }

  const actions = await resolveCarrierActions(provider, carrier);
  const supportsStandalonePickup = actions.includes('pickup') || actions.includes('pickup_mandatory');
  if (!supportsStandalonePickup) {
    throw createLogisticsError(
      actions.includes('pickup_on_generate')
        ? 'Esta transportadora solo permite programar la recolección al generar la guía. Cancela esta guía y vuelve a crearla indicando la fecha de recolección.'
        : 'Esta transportadora no ofrece recolección independiente para esta guía. Entrega el paquete en un punto autorizado.',
      'SHIPPING_PICKUP_UNSUPPORTED',
      422,
      { carrier, actions, dropoffAvailable: !actions.includes('pickup_mandatory') }
    );
  }

  const requestedDate = pickupDate(input.pickupDate, input.now || new Date());
  const timeFrom = pickupTime(input.pickupTimeStart, 'el inicio de la ventana');
  const timeTo = pickupTime(input.pickupTimeEnd, 'el final de la ventana');
  if (timeFrom >= timeTo) {
    throw createLogisticsError(
      'La hora final de recolección debe ser posterior a la hora inicial.',
      'SHIPPING_PICKUP_WINDOW_INVALID',
      422
    );
  }

  const shipmentPayload = await resolveShippingAddresses(
    provider,
    buildEnviaShipmentPayload({
      order,
      shipment,
      branch,
      customsPolicy: provider.customsPolicy,
    })
  );
  const requestPayload = buildStandalonePickupPayload({
    shipmentPayload,
    carrier,
    trackingNumber,
    requestedDate,
    timeFrom,
    timeTo,
    instructions: input.pickupInstructions,
  });
  const { operation, replay } = await reserveOperation(
    {
      order,
      shipment,
      provider,
      type: 'schedule_pickup',
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
    const result = (await provider.schedulePickup(requestPayload))[0] || {};
    const confirmation = pickupConfirmation(result);
    if (!confirmation) {
      throw createLogisticsError(
        'Envia aceptó la solicitud, pero no devolvió una confirmación de recolección. Revisa la operación antes de reintentar.',
        'SHIPPING_PICKUP_CONFIRMATION_MISSING',
        502
      );
    }
    operation.status = 'action_required';
    operation.providerReference = confirmation;
    operation.trackingNumber = trackingNumber;
    operation.result = result;
    await operation.save();

    const now = new Date();
    const integration = providerIntegration(shipment);
    integration.provider = provider.key;
    integration.mode = provider.mode;
    integration.carrierActions = actions;
    integration.status = 'pickup_scheduled';
    integration.handoffMode = 'pickup';
    integration.handoffConfirmedAt = now;
    integration.pickup = {
      status: 'scheduled',
      confirmation,
      requestedDate: clean(result.date || result.pickupDate || requestedDate, 40),
      timeFrom: pickupDisplayTime(
        result.timeFrom ?? result.pickupTimeStart,
        timeFrom
      ),
      timeTo: pickupDisplayTime(
        result.timeTo ?? result.pickupTimeEnd,
        timeTo
      ),
      instructions: clean(input.pickupInstructions, 500),
      requestedAt: now,
      completedAt: null,
    };
    integration.lastError = {};
    appendIntegrationHistory(
      shipment,
      'shipping_pickup_scheduled',
      `Recolección ${confirmation} programada para ${integration.pickup.requestedDate}, ${integration.pickup.timeFrom}-${integration.pickup.timeTo}.`,
      now
    );
    const response = await persistIntegration(order, shipment, now);
    operation.status = 'succeeded';
    await operation.save();
    return { ...response, operationId: idValue(operation._id), result };
  } catch (error) {
    const ambiguous = new Set([
      'SHIPPING_PROVIDER_TIMEOUT',
      'SHIPPING_PROVIDER_UNAVAILABLE',
      'SHIPPING_PROVIDER_HTTP_ERROR',
      'SHIPPING_PICKUP_CONFIRMATION_MISSING',
    ]);
    operation.status = operation.result || ambiguous.has(error?.code)
      ? 'action_required'
      : 'failed';
    operation.error = { code: clean(error?.code, 100), message: clean(error?.message, 500) };
    await operation.save().catch(() => {});
    throw error;
  }
}

async function confirmOrderShipmentDropoff(input = {}, dependencies = {}) {
  const { order, shipment } = await loadContext(input, dependencies);
  const integration = providerIntegration(shipment);
  if (!integration.labelUrl || integration.status === 'cancelled') {
    throw createLogisticsError(
      'Primero genera una guía activa para elegir entrega en punto.',
      'SHIPPING_LABEL_REQUIRED',
      422
    );
  }
  const actions = (Array.isArray(integration.carrierActions) ? integration.carrierActions : [])
    .map((action) => clean(action, 80).toLowerCase());
  if (actions.includes('pickup_mandatory') || actions.includes('pickup_on_generate')) {
    throw createLogisticsError(
      actions.includes('pickup_on_generate')
        ? 'Esta guía debía incluir la recolección durante su generación. Cancélala y crea una nueva con fecha de recolección.'
        : 'Esta transportadora exige recolección; no permite seleccionar entrega en punto para esta guía.',
      'SHIPPING_DROPOFF_UNSUPPORTED',
      422,
      { actions }
    );
  }
  const now = new Date();
  integration.handoffMode = 'dropoff';
  integration.handoffConfirmedAt = now;
  appendIntegrationHistory(
    shipment,
    'shipping_dropoff_selected',
    'El administrador eligió entregar el paquete en un punto autorizado de la transportadora.',
    now
  );
  return persistIntegration(order, shipment, now);
}

function providerBoolean(value) {
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'si', 'sí', 'returned', 'refunded'].includes(
    clean(value, 40).toLowerCase()
  );
}

function optionalProviderDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
    const balanceReturned = providerBoolean(
      result?.balanceReturned ?? result?.balance_returned ?? result?.refund
    );
    const balanceReturnDate =
      result?.balanceReturnDate || result?.balance_return_date || result?.refundDate || null;
    integration.cancellation = {
      status: balanceReturned ? 'refunded' : 'refund_pending',
      balanceReturned,
      balanceReturnDate: optionalProviderDate(balanceReturnDate),
      requestedAt: now,
      confirmedAt: now,
      providerMessage: clean(result?.message || result?.status || 'Cancelación aceptada por Envia.', 500),
    };
    appendIntegrationHistory(
      shipment,
      'shipping_label_cancelled',
      balanceReturned
        ? `Guía ${trackingNumber} cancelada y saldo reintegrado.`
        : `Guía ${trackingNumber} cancelada; el reintegro de saldo queda pendiente de confirmación.`,
      now
    );
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
  resolveColombiaAddresses: resolveShippingAddresses,
  resolveShippingAddresses,
  pickupOnGeneratePayload,
  buildStandalonePickupPayload,
  quoteOrderShipment,
  generateOrderShipmentLabel,
  syncOrderShipmentTracking,
  testOrderShipmentWebhook,
  scheduleOrderShipmentPickup,
  confirmOrderShipmentDropoff,
  cancelOrderShipmentLabel,
};
