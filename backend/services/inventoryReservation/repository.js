const InventoryReservation = require('../../models/InventoryReservation');
const { createServiceError, isValidObjectId } = require('./support');

async function findReservation(identifier, session) {
  if (!identifier) {
    throw createServiceError(
      'Debes enviar el identificador de la reserva.',
      'MISSING_RESERVATION_IDENTIFIER',
      {},
      400
    );
  }

  const cleanIdentifier = String(identifier);

  const filter = isValidObjectId(cleanIdentifier)
    ? { _id: cleanIdentifier }
    : {
        $or: [
          { reservationCode: cleanIdentifier },
          { orderNumber: cleanIdentifier },
          { paymentReference: cleanIdentifier },
          { paymentTransactionId: cleanIdentifier },
        ],
      };

  const reservation = await InventoryReservation.findOne(filter).session(session);

  if (!reservation) {
    throw createServiceError(
      'No se encontró la reserva de inventario.',
      'RESERVATION_NOT_FOUND',
      {
        identifier: cleanIdentifier,
      },
      404
    );
  }

  return reservation;
}

module.exports = {
  findReservation,
};
