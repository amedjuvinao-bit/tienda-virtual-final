const InventoryReservation = require('../../models/InventoryReservation');
const { DEFAULT_RESERVATION_MINUTES } = require('./constants');
const { expandReservableItems } = require('./catalog');
const { allocateReservationItems } = require('./stockReservation');
const { cleanText, toNumber, toObjectId, withTransaction } = require('./support');

async function createInventoryReservation({
  sessionId = '',
  order = null,
  orderNumber = '',
  paymentReference = '',
  paymentTransactionId = '',
  source = 'checkout',
  items = [],
  branchPriorityIds = [],
  allowedBranchIds = null,
  expiresInMinutes = DEFAULT_RESERVATION_MINUTES,
  currency = 'COP',
  metadata = {},
  notes = '',
} = {}, options = {}) {
  return withTransaction(async (session) => {
    const safeExpiresInMinutes =
      Number.isFinite(Number(expiresInMinutes)) && Number(expiresInMinutes) > 0
        ? Number(expiresInMinutes)
        : DEFAULT_RESERVATION_MINUTES;

    const expiresAt = new Date(Date.now() + safeExpiresInMinutes * 60 * 1000);

    const reservableItems = await expandReservableItems(items, {
      session,
    });

    if (!reservableItems.length) {
      return null;
    }

    const { reservationItems, usedBranchIds } = await allocateReservationItems({
      items: reservableItems,
      branchPriorityIds,
      allowedBranchIds,
      session,
    });

    const subtotal = reservationItems.reduce((sum, item) => {
      return sum + toNumber(item.lineTotal, 0);
    }, 0);

    const totalQuantity = reservationItems.reduce((sum, item) => {
      return sum + toNumber(item.quantity, 0);
    }, 0);

    const [reservation] = await InventoryReservation.create(
      [
        {
          sessionId: cleanText(sessionId),
          order: order ? toObjectId(order, 'order') : null,
          orderNumber: cleanText(orderNumber),
          paymentReference: cleanText(paymentReference),
          paymentTransactionId: cleanText(paymentTransactionId),
          source,
          status: 'pending',
          items: reservationItems,
          totalQuantity,
          subtotal,
          total: subtotal,
          currency,
          expiresAt,
          notes: cleanText(notes),
          metadata: {
            ...metadata,
            usedBranchIds,
          },
        },
      ],
      {
        session,
      }
    );

    return reservation;
  }, options.session || null);
}

module.exports = {
  createInventoryReservation,
};
