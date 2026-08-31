'use strict';

const { createLogisticsError } = require('../orderLogisticsService');
const {
  buildEnviaShipmentPayload,
  normalizeGeneratedLabel,
  normalizeRate,
} = require('../shippingPayloadService');
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
  pickupConfirmation,
  pickupDate,
  pickupOnGeneratePayload,
} = require('./pickupPayloads');
const { resolveCarrierActions, resolveProvider } = require('./providerAdapter');
const { clean, idValue } = require('./shared');

const AMBIGUOUS_PROVIDER_FAILURES = new Set([
  'SHIPPING_PROVIDER_TIMEOUT',
  'SHIPPING_PROVIDER_UNAVAILABLE',
  'SHIPPING_PROVIDER_HTTP_ERROR',
]);

async function generateOrderShipmentLabel(input = {}, dependencies = {}) {
  const provider = await resolveProvider(input, dependencies);
  const { order, shipment, branch, scope } = await loadContext(
    input,
    dependencies
  );
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
  const actions = await resolveCarrierActions(provider, rate.carrier, {
    ...rate,
    countryCode: payload.origin?.country,
    optional: true,
  });
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
    const result = await persistIntegration(
      order,
      shipment,
      new Date(),
      scope
    );
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
    await recordOperationFailure(operation, error, AMBIGUOUS_PROVIDER_FAILURES);
    throw error;
  }
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
  const provider = await resolveProvider(input, dependencies);
  const { order, shipment, scope } = await loadContext(input, dependencies);
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
    const response = await persistIntegration(order, shipment, now, scope);
    operation.status = 'succeeded';
    operation.providerReference = clean(integration.providerShipmentId, 180);
    await operation.save();
    return { ...response, operationId: idValue(operation._id), result };
  } catch (error) {
    await recordOperationFailure(operation, error, AMBIGUOUS_PROVIDER_FAILURES);
    throw error;
  }
}

module.exports = {
  cancelOrderShipmentLabel,
  generateOrderShipmentLabel,
};
