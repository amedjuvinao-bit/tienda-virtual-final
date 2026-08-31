'use strict';

const { createFailureError } = require('./errorClassification');
const {
  hasLegacyDiscountEvidence,
  resolveFailureInventoryMode,
} = require('./inventoryMode');
const {
  compensateLegacyDiscountedInventory,
} = require('./legacyCompensation');
const {
  reconcileLegacyFailureCompensation,
} = require('./legacyReconciliation');
const { cleanText, idValue } = require('./support');

function getPaymentFailureReleaseReason(payload) {
  return require('../inventoryReservationService').buildPaymentFailureReleaseReason(
    payload
  );
}

function createPaymentInventoryFailureService({
  releaseReservation,
  applyReservation,
  compensateLegacyInventory = compensateLegacyDiscountedInventory,
  reconcileReservation = null,
  reconcileLegacyInventory = reconcileLegacyFailureCompensation,
  isApprovedPayment = () => false,
  buildReleaseReason = getPaymentFailureReleaseReason,
  now = () => new Date(),
} = {}) {
  if (typeof releaseReservation !== 'function') {
    throw new TypeError('releaseReservation es obligatorio.');
  }
  if (typeof applyReservation !== 'function') {
    throw new TypeError('applyReservation es obligatorio.');
  }

  return {
    async process({
      order,
      paymentStatus,
      provider = '',
      paymentReference = '',
      paymentTransactionId = '',
      session = null,
      approvalContext = {},
    } = {}) {
      const safeStatus = cleanText(paymentStatus, 40).toLowerCase();
      if (!['failed', 'cancelled'].includes(safeStatus)) {
        return { completed: false, ignored: true, action: 'ignored' };
      }

      if (isApprovedPayment(order, approvalContext)) {
        return {
          completed: false,
          ignored: true,
          canonicalApproval: true,
          action: 'approved_is_terminal',
        };
      }

      const mode = resolveFailureInventoryMode(order);
      if (mode === 'completed') {
        return { completed: true, duplicate: true, action: 'already_completed' };
      }
      if (mode === 'incomplete') {
        throw createFailureError(
          'La recuperacion no conserva evidencia suficiente para completarse.',
          'INVENTORY_RECOVERY_INCOMPLETE',
          {
            reason: 'RESERVATION_OR_DISCOUNT_EVIDENCE_REQUIRED',
            orderNumber: cleanText(order?.orderNumber, 40),
          }
        );
      }

      let reservation = null;
      let compensation = null;

      if (mode === 'release_reservation') {
        const releasePaymentReference = cleanText(
          paymentReference || order?.payment?.reference,
          180
        );
        const releasePaymentTransactionId = cleanText(
          paymentTransactionId || order?.payment?.transactionId,
          120
        );
        const releaseReason = buildReleaseReason({
          provider: provider || 'pasarela',
          paymentStatus: safeStatus,
          orderNumber: order.orderNumber,
          paymentReference: releasePaymentReference,
          paymentTransactionId: releasePaymentTransactionId,
        });
        reservation = await releaseReservation(
          order.inventoryControl.reservationId || order.orderNumber,
          {
            status: safeStatus === 'cancelled' ? 'cancelled' : 'failed',
            releaseReason,
            paymentReference: releasePaymentReference,
            paymentTransactionId: releasePaymentTransactionId,
          },
          { session, syncOrderAllocations: false }
        );

        if (reservation?.status === 'confirmed') {
          throw createFailureError(
            'Una reserva confirmada no puede liberarse por un pago tardio fallido.',
            'CONFIRMED_RESERVATION_CANNOT_BE_RELEASED',
            { reservationId: idValue(reservation?._id) }
          );
        }
        const expectedReservationStatus =
          safeStatus === 'cancelled' ? 'cancelled' : 'failed';
        if (
          cleanText(reservation?.status, 40).toLowerCase() !==
            expectedReservationStatus ||
          cleanText(reservation?.releaseReason, 1000) !==
            cleanText(releaseReason, 1000)
        ) {
          throw createFailureError(
            'La reserva no quedo liberada por esta operacion de pago fallido.',
            'RESERVATION_RELEASE_EVIDENCE_MISMATCH',
            {
              reservationId: idValue(reservation?._id),
              status: reservation?.status,
            }
          );
        }
        applyReservation(order, reservation);
      } else if (mode === 'legacy_compensation') {
        compensation = await compensateLegacyInventory({ order, session });
        if (compensation?.completed !== true) {
          throw createFailureError(
            'La compensacion heredada no termino correctamente.',
            'LEGACY_COMPENSATION_INCOMPLETE'
          );
        }
      }

      const completedAt = now();
      order.inventoryControl = order.inventoryControl || {};
      order.inventoryControl.discountedAtCheckout = false;
      order.inventoryControl.restockedOnFailure = true;
      order.inventoryControl.restockedAt = completedAt;

      return {
        completed: true,
        duplicate: false,
        action: mode,
        reservation,
        compensation,
        completedAt,
      };
    },

    async reconcileApproved({
      order,
      provider = 'wompi',
      paymentReference = '',
      paymentTransactionId = '',
      session = null,
    } = {}) {
      const control = order?.inventoryControl || {};
      if (control.restockedOnFailure !== true) {
        return { completed: true, needed: false, action: 'not_needed' };
      }

      if (control.reservationId) {
        if (typeof reconcileReservation !== 'function') {
          throw createFailureError(
            'No existe una autoridad para reconciliar la reserva liberada.',
            'PAYMENT_FAILURE_RESERVATION_RECONCILER_REQUIRED'
          );
        }
        const reservation = await reconcileReservation(
          control.reservationId,
          {
            order: order._id,
            orderNumber: order.orderNumber,
            provider,
            paymentReference,
            paymentTransactionId,
          },
          { session, syncOrderAllocations: false }
        );
        return {
          completed: true,
          needed: true,
          action: 'reconcile_reservation',
          reservation,
        };
      }

      if (hasLegacyDiscountEvidence(order)) {
        const reconciliation = await reconcileLegacyInventory({
          order,
          session,
          now: now(),
        });
        if (reconciliation?.completed !== true) {
          throw createFailureError(
            'La compensacion heredada no pudo reconciliarse con la aprobacion.',
            'PAYMENT_FAILURE_LEGACY_RECONCILIATION_INCOMPLETE'
          );
        }
        order.inventoryControl.discountedAtCheckout = true;
        order.inventoryControl.restockedOnFailure = false;
        order.inventoryControl.restockedAt = null;
        return {
          completed: true,
          needed: true,
          action: 'reconcile_legacy_compensation',
          reconciliation,
        };
      }

      if (control.reservationRequired === false) {
        control.restockedOnFailure = false;
        control.restockedAt = null;
        return {
          completed: true,
          needed: true,
          action: 'reconcile_not_required',
        };
      }

      throw createFailureError(
        'La recuperacion previa no conserva una ruta segura de reconciliacion.',
        'PAYMENT_FAILURE_APPROVAL_RECONCILIATION_INCOMPLETE',
        { orderNumber: cleanText(order?.orderNumber, 40) }
      );
    },
  };
}

module.exports = {
  createPaymentInventoryFailureService,
};
