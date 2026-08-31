const InventoryMovement = require('../../models/InventoryMovement');
const InventoryStock = require('../../models/InventoryStock');
const Product = require('../../models/Product');
const { resolveReservationStockVariant } = require('./stockUpdates');
const { cleanUpper, toNumber, toObjectId } = require('./support');

async function syncProductTotalStock(productId, { session = null } = {}) {
  const rows = await InventoryStock.find({
    product: toObjectId(productId, 'productId'),
    deletedAt: null,
    active: true,
  })
    .select('stock')
    .session(session)
    .lean();

  const totalStock = rows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.stock || 0)),
    0
  );

  await Product.updateOne(
    {
      _id: toObjectId(productId, 'productId'),
    },
    {
      $set: {
        stock: totalStock,
      },
    },
    {
      session,
    }
  );

  return totalStock;
}

async function createSaleOutMovementFromReservationItem({
  reservation,
  reservationItem,
  inventoryStock,
  stockBefore,
  stockAfter,
  order = null,
  orderNumber = '',
  paymentReference = '',
  paymentTransactionId = '',
  session,
}) {
  const quantity = toNumber(reservationItem.quantity, 0);

  if (!quantity) return null;

  const reference =
    cleanUpper(paymentReference) ||
    cleanUpper(paymentTransactionId) ||
    cleanUpper(orderNumber) ||
    cleanUpper(reservation.reservationCode);
  const stockIdentity = resolveReservationStockVariant(
    inventoryStock,
    reservationItem.variantKey
  );

  const movement = new InventoryMovement({
    type: 'sale_out',
    direction: 'out',
    status: 'posted',

    product: reservationItem.product,
    productSnapshot: reservationItem.productSnapshot || {},
    variant: {
      size: stockIdentity.size,
      color: stockIdentity.color,
      label: reservationItem.variantLabel || '',
      attributes: stockIdentity.attributes,
      sku: reservationItem.productSnapshot?.sku || '',
      barcode: '',
    },
    variantKey: stockIdentity.variantKey,

    branchFrom: reservationItem.branch,
    branchFromSnapshot: reservationItem.branchSnapshot || {},

    branchTo: null,
    branchToSnapshot: {},

    quantity,

    stockFrom: {
      before: stockBefore,
      quantity,
      after: stockAfter,
    },

    stockTo: {
      before: 0,
      quantity: 0,
      after: 0,
    },

    unitCost: 0,
    totalCost: 0,

    reason: 'Salida automática por venta confirmada',
    notes: `Reserva ${reservation.reservationCode || reservation._id} confirmada.`,
    reference,

    order: order || reservation.order || null,
    orderNumber: cleanUpper(orderNumber || reservation.orderNumber || ''),

    sourceModel: 'InventoryReservation',
    sourceId: reservation._id,

    createdBy: null,
    updatedBy: null,
    postedBy: null,
    postedAt: new Date(),
  });

  await movement.save({ session });

  return movement;
}

module.exports = {
  createSaleOutMovementFromReservationItem,
  syncProductTotalStock,
};
