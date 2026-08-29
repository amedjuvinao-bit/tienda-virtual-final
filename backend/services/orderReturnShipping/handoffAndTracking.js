'use strict';

const { createLogisticsError } = require('../orderLogisticsService');
const { publicWebhookUrl } = require('../shippingConfigurationService');
const { resolveShippingAddresses } = require('../orderShipping/addressResolution');
const {
  recordOperationFailure,
  reserveOperation,
} = require('../orderShipping/idempotencyState');
const {
  buildStandalonePickupPayload,
  pickupConfirmation,
  pickupDate,
  pickupDisplayTime,
  pickupTime,
} = require('../orderShipping/pickupPayloads');
const {
  resolveCarrierActions,
  resolveProvider,
} = require('../orderShipping/providerAdapter');
const { trackingEventsFrom } = require('../orderShipping/trackingOperations');
const { idValue } = require('../orderShipping/shared');
const { loadReturnShippingContext } = require('./context');
const {
  RETURN_ADDRESS_ROLES,
  buildReturnShipmentPayload,
} = require('./payload');
const {
  applyReturnTrackingUpdate,
  persistReturnShipping,
  returnShippingResponse,
  returnShippingValue,
} = require('./state');

const AMBIGUOUS_PROVIDER_FAILURES = new Set([
  'SHIPPING_PROVIDER_TIMEOUT',
  'SHIPPING_PROVIDER_UNAVAILABLE',
  'SHIPPING_PROVIDER_HTTP_ERROR',
  'SHIPPING_PICKUP_CONFIRMATION_MISSING',
]);
const SANDBOX_RETURN_WEBHOOK_TEST_STATUSES = new Set(['Picked Up', 'Delivered']);

function clean(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function carrierIdentity(returnCase) {
  return {
    carrier: clean(returnCase.shipping?.carrierName, 80).toLowerCase(),
    trackingNumber: clean(returnCase.shipping?.trackingNumber, 180),
  };
}

function sandboxReturnWebhookTestStatus(value = 'Picked Up') {
  const status = clean(value || 'Picked Up', 40);
  if (!SANDBOX_RETURN_WEBHOOK_TEST_STATUSES.has(status)) {
    throw createLogisticsError(
      'La prueba de esta devolución solo permite simular la recogida o la entrega desde Envia Sandbox.',
      'RETURN_SHIPPING_WEBHOOK_TEST_STATUS_INVALID',
      422,
      { allowedStatuses: [...SANDBOX_RETURN_WEBHOOK_TEST_STATUSES] }
    );
  }
  return status;
}

function assertLabel(returnCase, { allowCancelled = false } = {}) {
  const identity = carrierIdentity(returnCase);
  if (!identity.carrier || !identity.trackingNumber || !returnCase.shipping?.labelUrl) {
    throw createLogisticsError(
      'Primero genera una guía RMA activa.',
      'SHIPPING_LABEL_REQUIRED',
      422
    );
  }
  if (!allowCancelled && returnCase.shipping?.integration?.status === 'cancelled') {
    throw createLogisticsError(
      'La guía RMA está cancelada. Genera una nueva guía para continuar.',
      'RETURN_SHIPPING_LABEL_CANCELLED',
      409
    );
  }
  return identity;
}

function assertJourneyNotDelivered(returnCase, action) {
  if (
    returnCase.shipping?.carrierDeliveredAt ||
    returnCase.shipping?.awaitingWarehouseReceipt
  ) {
    throw createLogisticsError(
      `La transportadora ya reportó la devolución en sede. No se puede ${action}; confirma la recepción física.`,
      'RETURN_SHIPPING_ALREADY_DELIVERED',
      409
    );
  }
}

function assertHandoffCompatible(returnCase, nextMode) {
  const integration = returnCase.shipping?.integration || {};
  const currentMode = clean(integration.handoffMode, 40).toLowerCase();
  const pickupStatus = clean(integration.pickup?.status, 40).toLowerCase();
  if (
    nextMode === 'dropoff' &&
    currentMode === 'pickup' &&
    ['scheduled', 'completed'].includes(pickupStatus)
  ) {
    throw createLogisticsError(
      'La guía ya tiene una recolección confirmada; no puede cambiarse a entrega en punto.',
      'RETURN_SHIPPING_HANDOFF_CONFLICT',
      409
    );
  }
  if (nextMode === 'pickup' && currentMode === 'dropoff') {
    throw createLogisticsError(
      'La entrega en punto ya fue confirmada; no puede programarse una recolección.',
      'RETURN_SHIPPING_HANDOFF_CONFLICT',
      409
    );
  }
}

async function syncOrderReturnTracking(input = {}, dependencies = {}) {
  const provider = await resolveProvider(input, dependencies);
  const context = await loadReturnShippingContext(
    { ...input, requireDestination: false },
    dependencies
  );
  const { trackingNumber } = assertLabel(context.returnCase);
  const now = new Date();
  const events = trackingEventsFrom(await provider.track(trackingNumber), now);
  let state = {
    shipping: returnShippingValue(context.returnCase),
    status: context.returnCase.status,
    inTransitAt: context.returnCase.inTransitAt,
    stage: 'unknown',
  };
  events
    .sort((left, right) => new Date(left.occurredAt || 0) - new Date(right.occurredAt || 0))
    .forEach((event) => {
      state = applyReturnTrackingUpdate(
        {
          status: state.status,
          inTransitAt: state.inTransitAt,
          shipping: state.shipping,
        },
        event,
        { provider: provider.key, source: 'provider', receivedAt: now }
      );
    });
  const updated = await persistReturnShipping(
    { ...context, ...state, now },
    dependencies
  );
  return returnShippingResponse(updated, { trackingStage: state.stage }, dependencies);
}

async function testOrderReturnShippingWebhook(input = {}, dependencies = {}) {
  const provider = await resolveProvider(input, dependencies);
  if (provider.mode !== 'sandbox') {
    throw createLogisticsError(
      'La prueba oficial automática de devoluciones solo está disponible en Envia Sandbox.',
      'RETURN_SHIPPING_WEBHOOK_TEST_SANDBOX_ONLY',
      409
    );
  }
  const status = sandboxReturnWebhookTestStatus(input.webhookStatus);
  const context = await loadReturnShippingContext(
    { ...input, requireDestination: false },
    dependencies
  );
  const { carrier, trackingNumber } = assertLabel(context.returnCase);
  const shipping = returnShippingValue(context.returnCase);
  const integration = shipping.integration || {};
  const guideMode = clean(integration.mode, 40).toLowerCase();
  if (guideMode && guideMode !== 'sandbox') {
    throw createLogisticsError(
      'Esta guía RMA no fue creada en Sandbox y no admite eventos de prueba.',
      'RETURN_SHIPPING_WEBHOOK_TEST_GUIDE_MODE_INVALID',
      409,
      { guideMode }
    );
  }
  if (shipping.carrierDeliveredAt || shipping.awaitingWarehouseReceipt) {
    throw createLogisticsError(
      'Envia ya reportó la devolución en la sede. Ahora corresponde confirmar la recepción física.',
      'RETURN_SHIPPING_ALREADY_DELIVERED',
      409
    );
  }
  const pickupCompleted = integration.pickup?.status === 'completed';
  const alreadyInTransit = context.returnCase.status === 'in_transit' || pickupCompleted;
  if (status === 'Picked Up' && alreadyInTransit) {
    throw createLogisticsError(
      'Envia ya reportó la recogida. Ahora puedes solicitar la prueba oficial de entrega.',
      'RETURN_SHIPPING_WEBHOOK_TEST_PICKUP_ALREADY_CONFIRMED',
      409
    );
  }
  if (status === 'Picked Up' && !['pickup', 'dropoff'].includes(integration.handoffMode)) {
    throw createLogisticsError(
      'Primero programa la recolección o confirma la entrega en un punto autorizado.',
      'RETURN_SHIPPING_HANDOFF_REQUIRED',
      409
    );
  }
  if (status === 'Delivered' && !alreadyInTransit) {
    throw createLogisticsError(
      'Primero solicita la prueba oficial de recogida; después podrás simular la entrega en sede.',
      'RETURN_SHIPPING_WEBHOOK_TEST_DELIVERY_NOT_READY',
      409
    );
  }
  const webhookUrl = clean(dependencies.webhookUrl || publicWebhookUrl(), 500);
  if (!webhookUrl) {
    throw createLogisticsError(
      'Configura la URL pública del webhook antes de solicitar la prueba oficial.',
      'SHIPPING_WEBHOOK_URL_REQUIRED',
      422
    );
  }
  const result = await provider.testWebhook({ carrier, trackingNumber, status });
  return returnShippingResponse(
    context.returnCase,
    {
      testWebhook: {
        accepted: true,
        carrier,
        trackingNumber,
        status,
        webhookUrl,
        result,
      },
    },
    dependencies
  );
}

async function confirmOrderReturnDropoff(input = {}, dependencies = {}) {
  const context = await loadReturnShippingContext(
    { ...input, requireDestination: false },
    dependencies
  );
  assertLabel(context.returnCase);
  assertJourneyNotDelivered(context.returnCase, 'cambiar la forma de entrega');
  assertHandoffCompatible(context.returnCase, 'dropoff');
  const shipping = returnShippingValue(context.returnCase);
  const actions = (shipping.integration?.carrierActions || []).map((item) => clean(item, 80).toLowerCase());
  if (actions.includes('pickup_mandatory') || actions.includes('pickup_on_generate')) {
    throw createLogisticsError(
      'Esta transportadora exige recolección para la guía seleccionada.',
      'SHIPPING_DROPOFF_UNSUPPORTED',
      422,
      { actions }
    );
  }
  const now = new Date();
  if (shipping.integration.handoffMode === 'dropoff') {
    return returnShippingResponse(context.returnCase, { replayed: true }, dependencies);
  }
  shipping.method = 'drop_off';
  shipping.integration.handoffMode = 'dropoff';
  shipping.integration.handoffConfirmedAt = now;
  const updated = await persistReturnShipping({ ...context, shipping, now }, dependencies);
  return returnShippingResponse(updated, {}, dependencies);
}

async function scheduleOrderReturnPickup(input = {}, dependencies = {}) {
  const provider = await resolveProvider(input, dependencies);
  const context = await loadReturnShippingContext(
    { ...input, allowRevisionMismatch: true },
    dependencies
  );
  if (provider.mode === 'production' && input.confirmProductionCharge !== true) {
    throw createLogisticsError(
      'Confirma expresamente la recolección real antes de solicitarla.',
      'RETURN_SHIPPING_PRODUCTION_CONFIRMATION_REQUIRED',
      428
    );
  }
  const { carrier, trackingNumber } = assertLabel(context.returnCase);
  assertJourneyNotDelivered(context.returnCase, 'programar una recolección');
  assertHandoffCompatible(context.returnCase, 'pickup');
  const actions = await resolveCarrierActions(provider, carrier);
  if (!actions.includes('pickup') && !actions.includes('pickup_mandatory')) {
    throw createLogisticsError(
      actions.includes('pickup_on_generate')
        ? 'Esta transportadora solo permite solicitar la recolección al generar la guía.'
        : 'Esta guía no admite una recolección independiente; usa un punto autorizado.',
      'SHIPPING_PICKUP_UNSUPPORTED',
      422,
      { carrier, actions }
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
  const built = buildReturnShipmentPayload({
    ...context,
    packages: context.returnCase.shipping?.packages,
  });
  const shipmentPayload = await resolveShippingAddresses(
    provider,
    built.payload,
    RETURN_ADDRESS_ROLES
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
  const reserved = await reserveOperation({
    order: context.order,
    shipment: context.returnCase,
    returnCase: context.returnCase,
    scope: 'return',
    provider,
    type: 'schedule_pickup',
    idempotencyKey: input.idempotencyKey,
    requestPayload,
    reconcileActionRequired: true,
  }, dependencies);
  const { operation } = reserved;
  if (reserved.replay && !reserved.reconcile) {
    return returnShippingResponse(
      context.returnCase,
      { operationId: idValue(operation._id), replayed: true, result: operation.result },
      dependencies
    );
  }
  try {
    if (
      context.returnCase.shipping?.integration?.pickup?.status === 'scheduled' &&
      !reserved.replay
    ) {
      throw createLogisticsError(
        'Esta guía ya tiene una recolección programada.',
        'RETURN_SHIPPING_PICKUP_ALREADY_SCHEDULED',
        409
      );
    }
    if (!context.revisionMatches && !reserved.reconcile) {
      throw createLogisticsError(
        'Otro usuario modificó este RMA. Recarga la información antes de continuar.',
        'RETURN_REVISION_CONFLICT',
        409,
        {
          expectedRevision: Number(input.expectedRevision),
          currentRevision: Number(context.returnCase.revision || 0),
        }
      );
    }
    let result = operation.result;
    if (!reserved.reconcile) {
      const providerResult = (await provider.schedulePickup(requestPayload))[0] || {};
      const confirmation = pickupConfirmation(providerResult);
      if (!confirmation) {
        throw createLogisticsError(
          'Envia aceptó la solicitud, pero no devolvió confirmación. Revisa antes de reintentar.',
          'SHIPPING_PICKUP_CONFIRMATION_MISSING',
          502
        );
      }
      result = { providerResult, confirmation, requestedDate, timeFrom, timeTo };
      operation.status = 'action_required';
      operation.providerReference = confirmation;
      operation.trackingNumber = trackingNumber;
      operation.result = result;
      await operation.save();
    }
    const shipping = returnShippingValue(context.returnCase);
    const currentConfirmation = clean(shipping.integration?.pickup?.confirmation, 180);
    let updated = context.returnCase;
    if (currentConfirmation !== clean(result.confirmation, 180)) {
      const now = new Date();
      shipping.method = 'carrier';
      shipping.integration.carrierActions = actions;
      shipping.integration.status = 'pickup_scheduled';
      shipping.integration.handoffMode = 'pickup';
      shipping.integration.handoffConfirmedAt = now;
      shipping.integration.pickup = {
        status: 'scheduled',
        confirmation: result.confirmation,
        requestedDate: clean(result.providerResult?.date || result.requestedDate, 40),
        timeFrom: pickupDisplayTime(result.providerResult?.timeFrom, result.timeFrom),
        timeTo: pickupDisplayTime(result.providerResult?.timeTo, result.timeTo),
        instructions: clean(input.pickupInstructions, 500),
        requestedAt: now,
        completedAt: null,
      };
      updated = await persistReturnShipping({ ...context, shipping, now }, dependencies);
    }
    operation.status = 'succeeded';
    operation.activeLock = false;
    operation.error = {};
    await operation.save();
    return returnShippingResponse(
      updated,
      { operationId: idValue(operation._id), replayed: reserved.reconcile === true, result },
      dependencies
    );
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

async function cancelOrderReturnLabel(input = {}, dependencies = {}) {
  const provider = await resolveProvider(input, dependencies);
  const context = await loadReturnShippingContext(
    { ...input, requireDestination: false, allowRevisionMismatch: true },
    dependencies
  );
  if (provider.mode === 'production' && input.confirmProductionCharge !== true) {
    throw createLogisticsError(
      'Confirma expresamente la cancelación de la guía real.',
      'RETURN_SHIPPING_PRODUCTION_CONFIRMATION_REQUIRED',
      428
    );
  }
  const identity = assertLabel(context.returnCase, { allowCancelled: true });
  assertJourneyNotDelivered(context.returnCase, 'cancelar la guía');
  const reserved = await reserveOperation({
    order: context.order,
    shipment: context.returnCase,
    returnCase: context.returnCase,
    scope: 'return',
    provider,
    type: 'cancel_label',
    idempotencyKey: input.idempotencyKey,
    requestPayload: identity,
    reconcileActionRequired: true,
  }, dependencies);
  const { operation } = reserved;
  if (reserved.replay && !reserved.reconcile) {
    return returnShippingResponse(
      context.returnCase,
      { operationId: idValue(operation._id), replayed: true, result: operation.result },
      dependencies
    );
  }
  try {
    if (context.returnCase.shipping?.integration?.status === 'cancelled' && !reserved.reconcile) {
      throw createLogisticsError(
        'La guía RMA ya está cancelada.',
        'RETURN_SHIPPING_LABEL_CANCELLED',
        409
      );
    }
    if (!context.revisionMatches && !reserved.reconcile) {
      throw createLogisticsError(
        'Otro usuario modificó este RMA. Recarga la información antes de continuar.',
        'RETURN_REVISION_CONFLICT',
        409,
        {
          expectedRevision: Number(input.expectedRevision),
          currentRevision: Number(context.returnCase.revision || 0),
        }
      );
    }
    let result = operation.result;
    if (!reserved.reconcile) {
      const providerResult = (await provider.cancel(identity))[0] || {};
      result = {
        providerResult,
        balanceReturned: providerBoolean(
          providerResult.balanceReturned ?? providerResult.balance_returned ?? providerResult.refund
        ),
      };
      operation.status = 'action_required';
      operation.trackingNumber = identity.trackingNumber;
      operation.result = result;
      await operation.save();
    }
    const shipping = returnShippingValue(context.returnCase);
    let updated = context.returnCase;
    if (shipping.integration?.status !== 'cancelled') {
      const now = new Date();
      shipping.integration.status = 'cancelled';
      shipping.integration.cancelledAt = now;
      shipping.integration.cancellation = {
        status: result.balanceReturned ? 'refunded' : 'refund_pending',
        balanceReturned: result.balanceReturned,
        balanceReturnDate: null,
        requestedAt: now,
        confirmedAt: now,
        providerMessage: clean(
          result.providerResult?.message || result.providerResult?.status || 'Cancelación aceptada por Envia.',
          500
        ),
      };
      updated = await persistReturnShipping({ ...context, shipping, now }, dependencies);
    }
    operation.status = 'succeeded';
    operation.activeLock = false;
    operation.error = {};
    await operation.save();
    return returnShippingResponse(
      updated,
      { operationId: idValue(operation._id), replayed: reserved.reconcile === true, result },
      dependencies
    );
  } catch (error) {
    await recordOperationFailure(operation, error, AMBIGUOUS_PROVIDER_FAILURES);
    throw error;
  }
}

module.exports = {
  assertHandoffCompatible,
  assertJourneyNotDelivered,
  cancelOrderReturnLabel,
  confirmOrderReturnDropoff,
  scheduleOrderReturnPickup,
  sandboxReturnWebhookTestStatus,
  syncOrderReturnTracking,
  testOrderReturnShippingWebhook,
};
