'use strict';

const mongoose = require('mongoose');
const Product = require('../../models/Product');
const {
  buildPaymentFailureReleaseReason,
  confirmInventoryReservation,
  reconcilePaymentFailureReservation,
  releaseInventoryReservation,
} = require('../inventoryReservationService');
const {
  applyReservationToOrderDocument,
} = require('../orderInventoryAllocationService');
const {
  createPaymentInventoryFailureService,
} = require('../paymentInventoryFailureService');

function resolveOrderItemProductId(item) {
  if (!item || typeof item !== 'object') return '';
  if (item.productId) return String(item.productId).trim();
  if (item.product && typeof item.product === 'object' && item.product._id) {
    return String(item.product._id).trim();
  }
  if (item.product && typeof item.product !== 'object') {
    return String(item.product).trim();
  }
  if (item._id) return String(item._id).trim();
  if (item.id) return String(item.id).trim();
  return '';
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createPayUInventoryService({
  mongooseLib = mongoose,
  ProductModel = Product,
  confirmReservation = confirmInventoryReservation,
  reconcileReservation = reconcilePaymentFailureReservation,
  releaseReservation = releaseInventoryReservation,
  applyReservation = applyReservationToOrderDocument,
  createFailureService = createPaymentInventoryFailureService,
  buildReleaseReason = buildPaymentFailureReleaseReason,
} = {}) {
  const paymentInventoryFailureService = createFailureService({
    releaseReservation,
    applyReservation,
    reconcileReservation,
    buildReleaseReason,
    isApprovedPayment(order) {
      return (
        String(order?.payment?.provider || '').trim().toLowerCase() === 'payu' &&
        String(order?.payment?.status || '').trim().toLowerCase() === 'paid' &&
        Boolean(String(order?.payment?.transactionId || '').trim())
      );
    },
  });

  async function incrementLegacyStock(item, session) {
    const productId = resolveOrderItemProductId(item);
    const quantity = Number(item?.quantity ?? item?.qty ?? 0) || 0;
    const color = String(item?.color || '');
    const size = String(item?.size || '');

    if (!productId || !quantity) return false;
    if (!mongooseLib.Types.ObjectId.isValid(productId)) return false;

    const product = await ProductModel.findById(productId).session(session).lean();
    if (!product) return false;

    if (Array.isArray(product.inventory) && product.inventory.length) {
      const result = await ProductModel.updateOne(
        {
          _id: productId,
          inventory: {
            $elemMatch: {
              color: { $regex: `^${escapeRegex(color)}$`, $options: 'i' },
              size: { $regex: `^${escapeRegex(size)}$`, $options: 'i' },
            },
          },
        },
        { $inc: { 'inventory.$.stock': quantity } },
        { session }
      );

      if (result.matchedCount || result.modifiedCount) {
        const updated = await ProductModel.findById(productId)
          .session(session)
          .lean();
        const total = Array.isArray(updated?.inventory)
          ? updated.inventory.reduce(
              (sum, row) => sum + Math.max(0, Number(row?.stock || 0)),
              0
            )
          : Number(updated?.stock || 0);

        await ProductModel.updateOne(
          { _id: productId },
          { $set: { stock: total } },
          { session }
        );
        return true;
      }

      return false;
    }

    const result = await ProductModel.updateOne(
      { _id: productId },
      { $inc: { stock: quantity } },
      { session }
    );

    return Boolean(result.matchedCount || result.modifiedCount);
  }

  async function restockLegacyOrderIfNeeded(order, session) {
    const inventoryControl = order.inventoryControl || {};

    if (
      inventoryControl.discountedAtCheckout !== true ||
      inventoryControl.restockedOnFailure === true
    ) {
      return false;
    }

    const items =
      Array.isArray(order.items) && order.items.length
        ? order.items
        : Array.isArray(order.cart)
          ? order.cart
          : [];

    for (const item of items) {
      await incrementLegacyStock(item, session);
    }

    order.inventoryControl = {
      ...inventoryControl,
      discountedAtCheckout: true,
      restockedOnFailure: true,
      restockedAt: new Date(),
    };

    return true;
  }

  async function syncReservationAfterPayU({
    order,
    mapped,
    reference,
    transactionId,
    session,
  }) {
    const paymentStatus = String(mapped.paymentStatus || '').trim().toLowerCase();

    if (order.inventoryControl?.reservationRequired === false) {
      order.inventoryControl = {
        ...(order.inventoryControl || {}),
        discountedAtCheckout: false,
        restockedOnFailure: false,
        restockedAt: null,
      };
      return null;
    }

    try {
      if (paymentStatus === 'paid') {
        const inventoryControl = order.inventoryControl || {};

        if (
          inventoryControl.discountedAtCheckout === true &&
          inventoryControl.restockedOnFailure !== true
        ) {
          return {
            duplicate: true,
            status: 'confirmed',
            _id: inventoryControl.reservationId || null,
          };
        }

        let reservation = null;
        let reconciliation = null;

        if (inventoryControl.restockedOnFailure === true) {
          reconciliation = await paymentInventoryFailureService.reconcileApproved({
            order,
            provider: 'payu',
            paymentReference: reference || order.payment?.reference || '',
            paymentTransactionId:
              transactionId || order.payment?.transactionId || '',
            session,
          });
          reservation = reconciliation?.reservation || null;
        }

        if (
          !reconciliation ||
          reconciliation.action === 'reconcile_reservation'
        ) {
          reservation = await confirmReservation(
            reservation?._id ||
              inventoryControl.reservationId ||
              order.orderNumber,
            {
              order: order._id,
              orderNumber: order.orderNumber,
              paymentReference: reference || order.payment?.reference || '',
              paymentTransactionId:
                transactionId || order.payment?.transactionId || '',
            },
            {
              session,
              syncOrderAllocations: false,
            }
          );
        }

        if (reservation) applyReservation(order, reservation);
        order.inventoryControl = {
          ...(order.inventoryControl && typeof order.inventoryControl === 'object'
            ? order.inventoryControl
            : {}),
          discountedAtCheckout:
            reconciliation?.action === 'reconcile_not_required' ? false : true,
          restockedOnFailure: false,
          restockedAt: null,
        };

        return reservation || reconciliation;
      }

      if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
        return paymentInventoryFailureService.process({
          order,
          paymentStatus,
          provider: 'payu',
          paymentReference: reference || order.payment?.reference || '',
          paymentTransactionId:
            transactionId || order.payment?.transactionId || '',
          session,
        });
      }
    } catch (error) {
      if (
        error.code === 'RESERVATION_NOT_FOUND' &&
        (paymentStatus === 'failed' || paymentStatus === 'cancelled')
      ) {
        await restockLegacyOrderIfNeeded(order, session);
        return null;
      }

      throw error;
    }

    return null;
  }

  return {
    incrementLegacyStock,
    paymentInventoryFailureService,
    restockLegacyOrderIfNeeded,
    syncReservationAfterPayU,
  };
}

const defaultPayUInventoryService = createPayUInventoryService();

module.exports = {
  ...defaultPayUInventoryService,
  createPayUInventoryService,
  escapeRegex,
  resolveOrderItemProductId,
};
