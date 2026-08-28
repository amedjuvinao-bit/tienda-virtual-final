'use strict';

const { createLogisticsError } = require('../orderLogisticsService');
const {
  normalizeGeneratedLabel,
  normalizeRate,
} = require('../shippingPayloadService');
const { resolveShippingAddresses } = require('../orderShipping/addressResolution');
const {
  recordOperationFailure,
  reserveOperation,
} = require('../orderShipping/idempotencyState');
const {
  pickupConfirmation,
  pickupDate,
  pickupOnGeneratePayload,
} = require('../orderShipping/pickupPayloads');
const {
  resolveCarrierActions,
  resolveProvider,
} = require('../orderShipping/providerAdapter');
const { idValue } = require('../orderShipping/shared');
const { loadReturnShippingContext } = require('./context');
const {
  RETURN_ADDRESS_ROLES,
  buildReturnShipmentPayload,
} = require('./payload');
const {
  generatedAlreadyPersisted,
  persistReturnShipping,
  returnShippingResponse,
  shippingFromGeneratedLabel,
} = require('./state');

const AMBIGUOUS_PROVIDER_FAILURES = new Set([
  'SHIPPING_PROVIDER_TIMEOUT',
  'SHIPPING_PROVIDER_UNAVAILABLE',
  'SHIPPING_PROVIDER_HTTP_ERROR',
]);

async function quoteOrderReturnShipping(input = {}, dependencies = {}) {
  const provider = await resolveProvider(input, dependencies);
  const context = await loadReturnShippingContext(input, dependencies);
  const built = buildReturnShipmentPayload({
    ...context,
    packages: input.packages,
  });
  const payload = await resolveShippingAddresses(
    provider,
    built.payload,
    RETURN_ADDRESS_ROLES
  );
  const rates = (await provider.quote(payload)).map((item) => normalizeRate(item));
  const carriers = [...new Set(rates.map((rate) => rate.carrier.toLowerCase()).filter(Boolean))];
  const capabilities = new Map();
  await Promise.all(carriers.map(async (carrier) => {
    try {
      capabilities.set(carrier, {
        actions: await resolveCarrierActions(provider, carrier),
        resolved: true,
      });
    } catch {
      capabilities.set(carrier, { actions: [], resolved: false });
    }
  }));
  return returnShippingResponse(
    context.returnCase,
    {
      rates: rates.map((rate) => ({
        ...rate,
        carrierActions: capabilities.get(rate.carrier.toLowerCase())?.actions || [],
        carrierActionsResolved:
          capabilities.get(rate.carrier.toLowerCase())?.resolved === true,
      })),
    },
    dependencies
  );
}

function assertReturnShippingPayer(returnCase, input, provider) {
  const payer = returnCase.policySnapshot?.returnShippingPaidBy || 'case_by_case';
  if (payer === 'customer') {
    throw createLogisticsError(
      'La política asigna el costo de devolución al cliente. No se puede generar una guía pagada por la tienda.',
      'RETURN_SHIPPING_CUSTOMER_PAID',
      409
    );
  }
  if (payer === 'case_by_case' && input.confirmStorePaidShipping !== true) {
    throw createLogisticsError(
      'Confirma que la tienda asumirá el costo de esta guía RMA.',
      'RETURN_SHIPPING_PAYER_CONFIRMATION_REQUIRED',
      428
    );
  }
  if (provider.mode === 'production' && input.confirmProductionCharge !== true) {
    throw createLogisticsError(
      'La guía real puede consumir saldo. Confirma expresamente la operación de Producción.',
      'RETURN_SHIPPING_PRODUCTION_CONFIRMATION_REQUIRED',
      428
    );
  }
}

function validGeneratedLabel(generated) {
  if (
    !generated.trackingNumber ||
    !generated.labelUrl ||
    !generated.carrier ||
    !/^https:\/\//i.test(generated.labelUrl) ||
    (generated.trackingUrl && !/^https:\/\//i.test(generated.trackingUrl))
  ) {
    throw createLogisticsError(
      'Envia respondió con una guía incompleta o una URL no segura. La operación requiere revisión.',
      'RETURN_SHIPPING_LABEL_INCOMPLETE',
      502
    );
  }
  return generated;
}

async function persistGeneratedResult({ context, provider, operation, operationResult, dependencies }) {
  const {
    generated,
    packages,
    rate,
    actions,
    pickup,
    originSnapshot,
  } = operationResult;
  if (generatedAlreadyPersisted(context.returnCase, generated)) {
    const pickupUnconfirmed = pickup?.requestedDate && !pickup?.confirmation;
    operation.status = pickupUnconfirmed ? 'action_required' : 'succeeded';
    operation.activeLock = false;
    operation.error = pickupUnconfirmed
      ? {
          code: 'SHIPPING_PICKUP_CONFIRMATION_MISSING',
          message: 'La guía se generó, pero Envia no confirmó la recolección.',
        }
      : {};
    await operation.save();
    return context.returnCase;
  }
  const now = new Date();
  const shipping = shippingFromGeneratedLabel({
    returnCase: context.returnCase,
    destination: context.destination,
    originSnapshot,
    packages,
    provider,
    rate,
    generated,
    actions,
    pickup,
    now,
  });
  const updated = await persistReturnShipping(
    {
      ...context,
      shipping,
      now,
    },
    dependencies
  );
  operation.status = pickup?.requestedDate && !pickup?.confirmation
    ? 'action_required'
    : 'succeeded';
  operation.activeLock = false;
  operation.error = pickup?.requestedDate && !pickup?.confirmation
    ? {
        code: 'SHIPPING_PICKUP_CONFIRMATION_MISSING',
        message: 'La guía se generó, pero Envia no confirmó la recolección.',
      }
    : {};
  await operation.save();
  return updated;
}

async function generateOrderReturnLabel(input = {}, dependencies = {}) {
  const provider = await resolveProvider(input, dependencies);
  const context = await loadReturnShippingContext(
    { ...input, allowRevisionMismatch: true },
    dependencies
  );
  assertReturnShippingPayer(context.returnCase, input, provider);
  const rate = normalizeRate(input.rate || {});
  if (!rate.carrier || !rate.service) {
    throw createLogisticsError(
      'Selecciona una tarifa válida antes de generar la guía RMA.',
      'SHIPPING_RATE_REQUIRED',
      422
    );
  }
  const built = buildReturnShipmentPayload({
    ...context,
    packages: input.packages,
    rate,
  });
  const payload = await resolveShippingAddresses(
    provider,
    built.payload,
    RETURN_ADDRESS_ROLES
  );
  const actions = await resolveCarrierActions(provider, rate.carrier);
  const pickupOnGenerate = actions.includes('pickup_on_generate');
  const requestedPickupDate = pickupOnGenerate
    ? pickupDate(input.pickupDate, input.now || new Date())
    : '';
  const requestPayload = pickupOnGenerate
    ? pickupOnGeneratePayload(payload, requestedPickupDate)
    : payload;
  const reserved = await reserveOperation(
    {
      order: context.order,
      shipment: context.returnCase,
      returnCase: context.returnCase,
      scope: 'return',
      provider,
      type: 'generate_label',
      idempotencyKey: input.idempotencyKey,
      requestPayload,
      reconcileActionRequired: true,
    },
    dependencies
  );
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
      context.returnCase.shipping?.labelUrl &&
      context.returnCase.shipping?.integration?.status !== 'cancelled' &&
      !reserved.replay
    ) {
      throw createLogisticsError(
        'El RMA ya tiene una guía externa activa. Cancélala antes de generar otra.',
        'RETURN_SHIPPING_LABEL_ALREADY_ACTIVE',
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
    let operationResult = operation.result;
    if (!reserved.reconcile) {
      const generatedItem = (await provider.generateLabel(requestPayload))[0] || {};
      const generated = validGeneratedLabel(normalizeGeneratedLabel(generatedItem));
      const pickup = pickupOnGenerate
        ? {
            requestedDate: requestedPickupDate,
            confirmation: pickupConfirmation(generatedItem),
            instructions: String(input.pickupInstructions || '').trim().slice(0, 500),
          }
        : null;
      operationResult = {
        generated,
        packages: built.packages,
        rate,
        actions,
        pickup,
        originSnapshot: {
          name: payload.origin.name,
          email: payload.origin.email,
          phone: payload.origin.phone,
          addressLine: payload.origin.street,
          city: payload.origin.city,
          departmentCode: payload.origin.state,
          countryCode: payload.origin.country,
          postalCode: payload.origin.postalCode,
        },
      };
      operation.status = 'action_required';
      operation.providerReference = generated.providerShipmentId;
      operation.trackingNumber = generated.trackingNumber;
      operation.result = operationResult;
      await operation.save();
    }
    const updated = await persistGeneratedResult({
      context,
      provider,
      operation,
      operationResult,
      dependencies,
    });
    return returnShippingResponse(
      updated,
      {
        operationId: idValue(operation._id),
        replayed: reserved.reconcile === true,
        result: operationResult,
        actionRequired: operation.status === 'action_required',
      },
      dependencies
    );
  } catch (error) {
    await recordOperationFailure(operation, error, AMBIGUOUS_PROVIDER_FAILURES);
    throw error;
  }
}

module.exports = {
  generateOrderReturnLabel,
  quoteOrderReturnShipping,
};
