'use strict';

const mongoose = require('mongoose');
const Order = require('../models/Order');
const validateOrderPayload = require('../validators/orderPayload');
const {
  expireInventoryReservations,
} = require('../services/inventoryReservationService');
const {
  releaseExpiredStoreCreditReservations,
} = require('../services/storeCreditCheckoutService');
const { markCartConverted } = require('../services/cartAdminOperationsService');
const {
  getPaymentAccessSecret,
  issueGuestOrderAccess,
} = require('../services/publicPaymentAccessService');
const { SAFE_CART_ACCESS_ERROR } = require('../services/cartAccessService');
const {
  buildOrderCreationResult,
  deriveIdempotencyKey,
} = require('../lib/orders/orderCreationPayload');
const { sendOrderCreationError } = require('../lib/orders/orderCreationHttp');
const {
  canReuseMutableOrderData,
  findCompletedOrder,
  inspectExistingIdempotency,
  markIdempotencyFailed,
  syncExistingOrderForRetry,
} = require('../services/orderCreationIdempotencyService');
const {
  createOrderInTransaction,
} = require('../services/orderCreationTransactionService');
const {
  processFullyPaidStoreCreditOrder,
} = require('../services/orderCreationPostCommitService');
const {
  persistNewsletterSubscription,
} = require('../services/orderCreationNewsletterService');

function withOrderPaymentAccess(payload, { order, sessionId, secret } = {}) {
  return {
    ...(payload || {}),
    paymentAccess: issueGuestOrderAccess({
      orderId: order?._id,
      sessionId,
      secret,
    }),
  };
}

async function sendExistingOrder(
  res,
  order,
  { sessionId, secret, paymentConfig = {} }
) {
  await processFullyPaidStoreCreditOrder({ order, paymentConfig });
  return res.status(200).json(
    withOrderPaymentAccess(
      buildOrderCreationResult(order, {
        idempotent: true,
        reused: true,
      }),
      { order, sessionId, secret }
    )
  );
}

async function markConvertedAndSendExistingOrder(
  res,
  order,
  {
    sessionId,
    secret,
    paymentConfig = {},
    cartConversionAuthority,
  }
) {
  const conversion = await markCartConverted({
    sessionId,
    orderId: order._id,
    convertedAt: order.createdAt || new Date(),
    authority: cartConversionAuthority,
  });
  if (Number(conversion?.matchedCount || 0) !== 1) {
    return sendOrderCreationError(res, {
      code: 'CART_VERSION_CONFLICT',
      statusCode: 409,
    });
  }
  return sendExistingOrder(res, order, {
    sessionId,
    secret,
    paymentConfig,
  });
}

function buildRequestContext(req) {
  return {
    ip: req.ip,
    adminUserId: req.adminUserId,
    adminUsername: req.adminUsername,
    adminDisplayName: req.adminDisplayName,
    adminRole: req.adminRole,
    user: req.user,
  };
}

async function createOrder(req, res) {
  let paymentAccessSecret;
  try {
    paymentAccessSecret = getPaymentAccessSecret();
  } catch (error) {
    console.error('No fue posible habilitar el acceso publico de la orden.');
    return res.status(500).json({
      ok: false,
      error: 'ORDER_ACCESS_UNAVAILABLE',
      message: 'No fue posible iniciar la compra de forma segura.',
    });
  }

  if (req.authorizedOrderReplay?.orderId) {
    const replayOrder = await Order.findById(req.authorizedOrderReplay.orderId);
    if (!replayOrder) return res.status(404).json(SAFE_CART_ACCESS_ERROR);
    return sendExistingOrder(res, replayOrder, {
      sessionId: req.authorizedCartSessionId,
      secret: paymentAccessSecret,
      paymentConfig: req.authorizedPaymentConfig || {},
    });
  }

  const { ok, errors, cleaned } = validateOrderPayload(req.body || {});
  if (!ok) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: errors,
    });
  }

  const headerKey = String(req.headers['idempotency-key'] || '').trim();
  const requestHash = deriveIdempotencyKey(cleaned, req.body || {});
  const idempotencyKey = headerKey || requestHash;

  try {
    const existing = await inspectExistingIdempotency({
      key: idempotencyKey,
      requestHash,
    });

    if (existing.action === 'conflict') {
      return res.status(409).json({
        error: 'IDEMPOTENCY_CONFLICT',
        message: existing.message,
      });
    }
    if (existing.action === 'in_progress') {
      return res.status(409).json({
        error: 'IDEMPOTENT_IN_PROGRESS',
        message:
          'Existe una solicitud idéntica en progreso. Reintenta en unos segundos.',
      });
    }
    if (existing.action === 'reuse') {
      const existingOrder = await Order.findById(existing.orderId);

      if (existingOrder && !canReuseMutableOrderData(existingOrder)) {
        return markConvertedAndSendExistingOrder(res, existingOrder, {
          sessionId: cleaned.sessionId,
          secret: paymentAccessSecret,
          paymentConfig: req.authorizedPaymentConfig || {},
          cartConversionAuthority:
            req.authorizedCartConversionAuthority,
        });
      }

      const syncedOrder = await syncExistingOrderForRetry(
        existing.orderId,
        cleaned
      );
      if (syncedOrder) {
        return markConvertedAndSendExistingOrder(res, syncedOrder, {
          sessionId: cleaned.sessionId,
          secret: paymentAccessSecret,
          paymentConfig: req.authorizedPaymentConfig || {},
          cartConversionAuthority:
            req.authorizedCartConversionAuthority,
        });
      }
    }
  } catch (error) {
    console.error('Idempotency lookup error:', error);
  }

  try {
    await expireInventoryReservations({ limit: 25 });
    await releaseExpiredStoreCreditReservations({ limit: 25 });
  } catch (error) {
    console.warn(
      '⚠️ No se pudieron liberar todas las reservas vencidas antes de crear la orden:',
      error.message
    );
  }

  const session = await mongoose.startSession();
  try {
    const {
      created,
      inventoryReservation,
      fullyPaidWithStoreCredit,
      newsletterIntent,
    } = await createOrderInTransaction({
      session,
      cleaned,
      rawBody: req.body || {},
      requestContext: buildRequestContext(req),
      idempotencyKey,
      requestHash,
      cartConversionAuthority:
        req.authorizedCartConversionAuthority,
    });

    await persistNewsletterSubscription(newsletterIntent);

    if (created && created._id) {
      if (fullyPaidWithStoreCredit) {
        await processFullyPaidStoreCreditOrder({
          order: created,
          paymentConfig: req.authorizedPaymentConfig || {},
        });
      }

      const statusCode = created.idempotent || created.reused ? 200 : 201;
      return res.status(statusCode).json(
        withOrderPaymentAccess(
          buildOrderCreationResult(created, {
            reservationId: inventoryReservation?._id || null,
            reservationCode: inventoryReservation?.reservationCode || '',
            reservationStatus: inventoryReservation?.status || '',
            reservationExpiresAt: inventoryReservation?.expiresAt || null,
            ...(created.idempotent || created.reused
              ? { idempotent: true, reused: true }
              : {}),
          }),
          {
            order: created,
            sessionId: cleaned.sessionId,
            secret: paymentAccessSecret,
          }
        )
      );
    }

    const completedRecord = await findCompletedOrder(idempotencyKey);
    if (completedRecord?.orderId) {
      const previousOrder = await syncExistingOrderForRetry(
        completedRecord.orderId,
        cleaned
      );
      if (previousOrder) {
        return markConvertedAndSendExistingOrder(res, previousOrder, {
          sessionId: cleaned.sessionId,
          secret: paymentAccessSecret,
          paymentConfig: req.authorizedPaymentConfig || {},
          cartConversionAuthority:
            req.authorizedCartConversionAuthority,
        });
      }
    }

    return res.status(500).json({
      error: 'No se pudo finalizar la creación de la orden',
    });
  } catch (error) {
    console.error('Error al guardar orden (tx):', error);

    try {
      await markIdempotencyFailed(idempotencyKey);
    } catch (cleanupError) {
      console.error(
        'Error marcando idempotency key como failed:',
        cleanupError
      );
    }

    return sendOrderCreationError(res, error);
  } finally {
    session.endSession();
  }
}

module.exports = {
  createOrder,
  withOrderPaymentAccess,
};
