'use strict';

const {
  idValue,
  lineIdentity,
  resolveOrderLine,
  toMoney,
  toQuantity,
} = require('./refundNormalization');

function getPreviousRefundState(refunds = []) {
  const amount = refunds.reduce(
    (sum, refund) => sum + toMoney(refund.amount),
    0
  );
  const returnedByLine = new Map();
  const restoredByStock = new Map();

  for (const refund of refunds) {
    for (const item of refund.items || []) {
      const lineId = idValue(item.orderItemId);
      returnedByLine.set(
        lineId,
        (returnedByLine.get(lineId) || 0) +
          toQuantity(item.returnedQuantity)
      );
    }
    for (const restoration of refund.inventoryRestorations || []) {
      const stockId = idValue(restoration.inventoryStock);
      restoredByStock.set(
        stockId,
        (restoredByStock.get(stockId) || 0) +
          toQuantity(restoration.quantity)
      );
    }
  }

  return {
    amount,
    returnedByLine,
    restoredByStock,
  };
}

async function loadLegacyRefundState({
  order,
  orderLines,
  OrderEventModel,
  session,
}) {
  const empty = {
    amount: 0,
    returnedByLine: new Map(),
  };
  if (!OrderEventModel) return empty;

  const events = await OrderEventModel.find({
    orderId: order._id,
    type: 'refund_created',
    'meta.refundId': { $exists: false },
  })
    .session(session)
    .lean();

  for (const event of events) {
    empty.amount += toMoney(event.meta?.amount);
    for (const [index, rawItem] of (
      Array.isArray(event.meta?.items) ? event.meta.items : []
    ).entries()) {
      try {
        const line = resolveOrderLine(
          orderLines,
          rawItem || {},
          index
        );
        const lineId = lineIdentity(
          line,
          orderLines.indexOf(line)
        );
        empty.returnedByLine.set(
          lineId,
          (empty.returnedByLine.get(lineId) || 0) +
            toQuantity(
              rawItem?.quantity ??
                rawItem?.qty ??
                rawItem?.cantidad
            )
        );
      } catch {
        // Los eventos antiguos sin una línea inequívoca sí cuentan
        // monetariamente, pero no se usan para inventar cantidades.
      }
    }
  }

  return empty;
}

function mergeQuantityMaps(first, second) {
  const merged = new Map(first);
  for (const [key, value] of second) {
    merged.set(key, (merged.get(key) || 0) + toQuantity(value));
  }
  return merged;
}

module.exports = {
  getPreviousRefundState,
  loadLegacyRefundState,
  mergeQuantityMaps,
};
