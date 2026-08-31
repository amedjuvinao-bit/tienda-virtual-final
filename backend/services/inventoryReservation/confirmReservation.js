const InventoryStock = require('../../models/InventoryStock');
const {
  syncOrderInventoryAllocationsFromReservation,
} = require('../orderInventoryAllocationService');
const {
  createSaleOutMovementFromReservationItem,
  syncProductTotalStock,
} = require('./inventoryMovement');
const { findReservation } = require('./repository');
const { releaseInventoryReservation } = require('./releaseReservation');
const { buildConfirmStockUpdate } = require('./stockUpdates');
const {
  cleanText,
  createServiceError,
  toNumber,
  toObjectId,
  withTransaction,
} = require('./support');

async function confirmInventoryReservation(
  identifier,
  {
    order = null,
    orderNumber = '',
    paymentReference = '',
    paymentTransactionId = '',
  } = {},
  options = {}
) {
  return withTransaction(async (session) => {
    const reservation = await findReservation(identifier, session);

    if (reservation.status === 'confirmed') {
      if (options.syncOrderAllocations !== false) {
        await syncOrderInventoryAllocationsFromReservation(
          reservation,
          {
            session,
            orderId: order || reservation.order,
          }
        );
      }
      return reservation;
    }

    if (reservation.status !== 'pending') {
      throw createServiceError(
        `La reserva no se puede confirmar porque está en estado ${reservation.status}.`,
        'RESERVATION_NOT_CONFIRMABLE',
        {
          reservationId: reservation._id,
          status: reservation.status,
        },
        409
      );
    }

    if (reservation.isExpired()) {
      await releaseInventoryReservation(
        reservation._id,
        {
          status: 'expired',
          releaseReason: 'Reserva vencida antes de confirmar el pago',
        },
        {
          session,
        }
      );

      throw createServiceError(
        'La reserva está vencida y no puede confirmarse.',
        'RESERVATION_EXPIRED',
        {
          reservationId: reservation._id,
        },
        409
      );
    }

    const now = new Date();
    const affectedProducts = new Set();

    for (const item of reservation.items) {
      const quantity = toNumber(item.quantity, 0);

      if (!item.inventoryStock || quantity <= 0) continue;

      const stockBeforeDoc = await InventoryStock.findOne({
        _id: item.inventoryStock,
        branch: item.branch,
        stock: {
          $gte: quantity,
        },
        reservedStock: {
          $gte: quantity,
        },
      })
        .session(session)
        .lean();

      if (!stockBeforeDoc) {
        throw createServiceError(
          'No se pudo confirmar la reserva porque el stock reservado ya no está disponible.',
          'RESERVED_STOCK_NOT_AVAILABLE',
          {
            reservationId: reservation._id,
            inventoryStock: item.inventoryStock,
            quantity,
          },
          409
        );
      }

      const stockBefore = toNumber(stockBeforeDoc.stock, 0);
      const stockAfter = Math.max(0, stockBefore - quantity);

      const updatedStock = await InventoryStock.findOneAndUpdate(
        {
          _id: item.inventoryStock,
          branch: item.branch,
          stock: {
            $gte: quantity,
          },
          reservedStock: {
            $gte: quantity,
          },
        },
        buildConfirmStockUpdate(quantity),
        {
          new: true,
          session,
          runValidators: false,
        }
      );

      if (!updatedStock) {
        throw createServiceError(
          'El inventario cambió mientras se confirmaba la reserva.',
          'CONCURRENT_CONFIRMATION_CHANGE',
          {
            reservationId: reservation._id,
            inventoryStock: item.inventoryStock,
            quantity,
          },
          409
        );
      }

      const movement = await createSaleOutMovementFromReservationItem({
        reservation,
        reservationItem: item,
        inventoryStock: updatedStock,
        stockBefore,
        stockAfter,
        order: order || reservation.order || null,
        orderNumber: orderNumber || reservation.orderNumber || '',
        paymentReference: paymentReference || reservation.paymentReference || '',
        paymentTransactionId: paymentTransactionId || reservation.paymentTransactionId || '',
        session,
      });

      await InventoryStock.updateOne(
        {
          _id: item.inventoryStock,
        },
        {
          $set: {
            lastMovement: movement?._id || null,
            lastMovementAt: now,
          },
        },
        {
          session,
        }
      );

      item.saleMovement = movement?._id || null;
      item.confirmedAt = now;
      affectedProducts.add(String(item.product || ''));
    }

    reservation.status = 'confirmed';
    reservation.confirmedAt = now;

    if (order) {
      reservation.order = toObjectId(order, 'order');
    }

    if (orderNumber) {
      reservation.orderNumber = cleanText(orderNumber);
    }

    if (paymentReference) {
      reservation.paymentReference = cleanText(paymentReference);
    }

    if (paymentTransactionId) {
      reservation.paymentTransactionId = cleanText(paymentTransactionId);
    }

    await reservation.save({ session });

    for (const productId of affectedProducts) {
      if (productId) {
        await syncProductTotalStock(productId, { session });
      }
    }

    if (options.syncOrderAllocations !== false) {
      await syncOrderInventoryAllocationsFromReservation(
        reservation,
        {
          session,
          orderId: order || reservation.order,
        }
      );
    }

    return reservation;
  }, options.session || null);
}

module.exports = {
  confirmInventoryReservation,
};
