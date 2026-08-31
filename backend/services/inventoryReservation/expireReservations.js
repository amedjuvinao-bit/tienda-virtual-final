const InventoryReservation = require('../../models/InventoryReservation');
const {
  syncOrderInventoryAllocationsFromReservation,
} = require('../orderInventoryAllocationService');
const { releaseReservedItems } = require('./stockReservation');
const { withTransaction } = require('./support');

async function expireInventoryReservations({ limit = 50 } = {}, options = {}) {
  return withTransaction(async (session) => {
    const now = new Date();

    const reservations = await InventoryReservation.find({
      status: 'pending',
      expiresAt: {
        $lte: now,
      },
    })
      .sort({ expiresAt: 1 })
      .limit(Number(limit || 50))
      .session(session);

    const expiredReservations = [];

    for (const reservation of reservations) {
      await releaseReservedItems({
        items: reservation.items,
        session,
      });

      reservation.status = 'expired';
      reservation.expiredAt = now;
      reservation.releaseReason = 'Reserva vencida automáticamente';

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

      expiredReservations.push(reservation);
    }

    return {
      count: expiredReservations.length,
      reservations: expiredReservations,
    };
  }, options.session || null);
}

module.exports = {
  expireInventoryReservations,
};
