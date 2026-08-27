'use strict';

const { createLogisticsError } = require('../orderLogisticsService');
const { buildEnviaShipmentPayload } = require('../shippingPayloadService');
const { resolveShippingAddresses } = require('./addressResolution');
const { recordOperationFailure, reserveOperation } = require('./idempotencyState');
const {
  appendIntegrationHistory,
  integrationResponse,
  loadContext,
  persistIntegration,
  providerIntegration,
} = require('./integrationState');
const {
  buildStandalonePickupPayload,
  pickupConfirmation,
  pickupDate,
  pickupDisplayTime,
  pickupTime,
} = require('./pickupPayloads');
const { resolveCarrierActions, resolveProvider } = require('./providerAdapter');
const { clean, idValue } = require('./shared');

const AMBIGUOUS_PICKUP_FAILURES = new Set([
  'SHIPPING_PROVIDER_TIMEOUT',
  'SHIPPING_PROVIDER_UNAVAILABLE',
  'SHIPPING_PROVIDER_HTTP_ERROR',
  'SHIPPING_PICKUP_CONFIRMATION_MISSING',
]);

async function scheduleOrderShipmentPickup(input = {}, dependencies = {}) {
  const provider = await resolveProvider(input, dependencies);
  const { order, shipment, branch, scope } = await loadContext(
    input,
    dependencies
  );
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
    return integrationResponse(
      order,
      shipment,
      {
        operationId: idValue(operation._id),
        replayed: true,
        result: operation.result,
      },
      scope
    );
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
    const response = await persistIntegration(order, shipment, now, scope);
    operation.status = 'succeeded';
    await operation.save();
    return { ...response, operationId: idValue(operation._id), result };
  } catch (error) {
    await recordOperationFailure(operation, error, AMBIGUOUS_PICKUP_FAILURES);
    throw error;
  }
}

async function confirmOrderShipmentDropoff(input = {}, dependencies = {}) {
  const { order, shipment, scope } = await loadContext(input, dependencies);
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
  return persistIntegration(order, shipment, now, scope);
}

module.exports = {
  confirmOrderShipmentDropoff,
  scheduleOrderShipmentPickup,
};
