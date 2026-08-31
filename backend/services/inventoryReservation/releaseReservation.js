const InventoryStock = require('../../models/InventoryStock');
const { resolveVariantIdentity } = require('../../lib/products/productVariantConfig');
const {
  syncOrderInventoryAllocationsFromReservation,
} = require('../orderInventoryAllocationService');
const { findReservation } = require('./repository');
const { releaseReservedItems } = require('./stockReservation');
const { buildReservationStockUpdate } = require('./stockUpdates');
const {
  cleanText,
  createServiceError,
  getObjectIdValue,
  normalizePaymentReferenceIdentity,
  parsePaymentFailureReleaseReason,
  toNumber,
  withTransaction,
} = require('./support');

async function releaseInventoryReservation(
  identifier,
  {
    status = 'released',
    releaseReason = 'Reserva liberada',
    paymentReference = '',
    paymentTransactionId = '',
  } = {},
  options = {}
) {
  return withTransaction(async (session) => {
    const reservation = await findReservation(identifier, session);

    if (reservation.status !== 'pending') {
      if (options.syncOrderAllocations !== false) {
        await syncOrderInventoryAllocationsFromReservation(
          reservation,
          {
            session,
            orderId: reservation.order,
          }
        );
      }
      return reservation;
    }

    await releaseReservedItems({
      items: reservation.items,
      session,
    });

    const now = new Date();

    reservation.status = status;
    reservation.releaseReason = cleanText(releaseReason);
    if (paymentReference) {
      reservation.paymentReference = cleanText(paymentReference);
    }
    if (paymentTransactionId) {
      reservation.paymentTransactionId = cleanText(paymentTransactionId);
    }

    if (status === 'expired') {
      reservation.expiredAt = now;
    } else if (status === 'cancelled') {
      reservation.cancelledAt = now;
    } else if (status === 'failed') {
      reservation.failedAt = now;
    } else {
      reservation.releasedAt = now;
    }

    reservation.items.forEach((item) => {
      item.releasedAt = now;
    });

    await reservation.save({ session });

    if (options.syncOrderAllocations !== false) {
      await syncOrderInventoryAllocationsFromReservation(
        reservation,
        {
          session,
          orderId: reservation.order,
        }
      );
    }

    return reservation;
  }, options.session || null);
}

async function reconcilePaymentFailureReservation(
  identifier,
  {
    order = null,
    orderNumber = '',
    provider = 'wompi',
    paymentReference = '',
    paymentTransactionId = '',
  } = {},
  options = {}
) {
  return withTransaction(async (session) => {
    const reservation =
      typeof options.findReservation === 'function'
        ? await options.findReservation(identifier, session)
        : await findReservation(identifier, session);
    const InventoryStockModel = options.InventoryStockModel || InventoryStock;
    const expectedOrderId = getObjectIdValue(order);
    const reservationOrderId = getObjectIdValue(reservation.order);
    const expectedOrderNumber = cleanText(orderNumber);
    const reservationOrderNumber = cleanText(reservation.orderNumber);
    const expectedProvider = cleanText(provider).toLowerCase();
    const expectedReference = cleanText(paymentReference);
    const expectedTransactionId = cleanText(paymentTransactionId);
    const expectedCanonicalReference = normalizePaymentReferenceIdentity(
      expectedReference
    );
    const orderCanonicalReference = normalizePaymentReferenceIdentity(
      `ORDER-${expectedOrderNumber}`
    );
    const reservationReference = cleanText(reservation.paymentReference);
    const reservationTransactionId = cleanText(
      reservation.paymentTransactionId
    );

    if (
      (expectedOrderId && reservationOrderId !== expectedOrderId) ||
      (expectedOrderNumber && reservationOrderNumber !== expectedOrderNumber) ||
      !expectedProvider ||
      !expectedReference ||
      !expectedTransactionId ||
      !expectedCanonicalReference ||
      expectedCanonicalReference !== orderCanonicalReference
    ) {
      throw createServiceError(
        'La reserva liberada no pertenece a la misma orden y operacion de pago.',
        'PAYMENT_FAILURE_RESERVATION_OWNERSHIP_MISMATCH',
        {
          reservationId: reservation._id,
          expectedOrderId,
          reservationOrderId,
          expectedOrderNumber,
          reservationOrderNumber,
        },
        409
      );
    }

    if (reservation.status === 'confirmed') return reservation;

    const releaseEvidence = parsePaymentFailureReleaseReason(
      reservation.releaseReason
    );
    if (
      !['failed', 'cancelled'].includes(reservation.status) ||
      !releaseEvidence ||
      releaseEvidence.provider !== expectedProvider ||
      releaseEvidence.order !== expectedOrderNumber ||
      releaseEvidence.status !== reservation.status ||
      releaseEvidence.canonicalReference !== expectedCanonicalReference ||
      normalizePaymentReferenceIdentity(releaseEvidence.reference) !==
        expectedCanonicalReference ||
      reservationReference !== releaseEvidence.reference ||
      reservationTransactionId !== releaseEvidence.transaction
    ) {
      throw createServiceError(
        'La reserva no fue liberada por este flujo de pago fallido.',
        'PAYMENT_FAILURE_RESERVATION_NOT_RECONCILABLE',
        {
          reservationId: reservation._id,
          status: reservation.status,
        },
        409
      );
    }

    if (reservation.confirmedAt || reservation.expiredAt || reservation.releasedAt) {
      throw createServiceError(
        'La reserva conserva evidencia terminal ajena a una liberacion reconciliable.',
        'PAYMENT_FAILURE_RESERVATION_TERMINAL_EVIDENCE',
        {
          reservationId: reservation._id,
          status: reservation.status,
        },
        409
      );
    }

    for (const item of reservation.items || []) {
      const quantity = toNumber(item.quantity, 0);
      if (
        !item.inventoryStock ||
        !item.branch ||
        !item.product ||
        quantity <= 0 ||
        !item.releasedAt ||
        item.confirmedAt ||
        item.saleMovement
      ) {
        throw createServiceError(
          'Una linea de la reserva liberada no conserva evidencia reconciliable.',
          'PAYMENT_FAILURE_RESERVATION_ITEM_INVALID',
          {
            reservationId: reservation._id,
            reservationItem: item?._id || null,
          },
          409
        );
      }

      const identity = resolveVariantIdentity({
        variantKey: item.variantKey,
        size: item.size,
        color: item.color,
        attributes: item.variantAttributes || [],
      });
      const updatedStock = await InventoryStockModel.findOneAndUpdate(
        {
          _id: item.inventoryStock,
          branch: item.branch,
          product: item.product,
          variantKey: identity.variantKey,
          active: true,
          deletedAt: null,
          $expr: {
            $gte: [
              {
                $subtract: [
                  '$stock',
                  { $ifNull: ['$reservedStock', 0] },
                ],
              },
              quantity,
            ],
          },
        },
        buildReservationStockUpdate(quantity),
        { new: true, session, runValidators: false }
      );

      if (!updatedStock) {
        throw createServiceError(
          'El stock liberado ya no esta disponible para reconciliar la aprobacion.',
          'PAYMENT_FAILURE_RESERVATION_RECONCILIATION_UNAVAILABLE',
          {
            reservationId: reservation._id,
            reservationItem: item._id,
            inventoryStock: item.inventoryStock,
            quantity,
          },
          503
        );
      }
      item.releasedAt = null;
    }

    reservation.status = 'pending';
    reservation.failedAt = null;
    reservation.cancelledAt = null;
    reservation.releaseReason = '';
    await reservation.save({ session });
    return reservation;
  }, options.session || null);
}

module.exports = {
  reconcilePaymentFailureReservation,
  releaseInventoryReservation,
};
