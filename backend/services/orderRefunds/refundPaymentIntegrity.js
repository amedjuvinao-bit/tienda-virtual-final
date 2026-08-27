'use strict';

const {
  cleanLower,
  createRefundError,
  getOrderLines,
  idValue,
  toMoney,
  toQuantity,
} = require('./refundNormalization');

function splitPaymentAmount(order = {}, predicate = () => true) {
  const splits = Array.isArray(order?.payment?.splitPayments)
    ? order.payment.splitPayments
    : [];
  return toMoney(
    splits.reduce(
      (sum, split) =>
        predicate(cleanLower(split?.method), split)
          ? sum + toMoney(split?.amount)
          : sum,
      0
    )
  );
}

function paymentSourceBreakdown(order = {}) {
  const snapshotAmount =
    order?.storeCredit?.applied === true &&
    cleanLower(order?.storeCredit?.status) !== 'released'
      ? toMoney(order?.storeCredit?.amount)
      : 0;
  const splitStoreCreditAmount = splitPaymentAmount(
    order,
    (method) => method === 'store_credit'
  );
  const splitExternalAmount = splitPaymentAmount(
    order,
    (method) => method && method !== 'store_credit'
  );
  const storeCreditAmount = Math.max(
    snapshotAmount,
    splitStoreCreditAmount
  );
  const externalAmount =
    splitExternalAmount > 0
      ? splitExternalAmount
      : toMoney(order?.payment?.amount);

  return {
    storeCreditAmount,
    externalAmount,
    mixed: storeCreditAmount > 0 && externalAmount > 0,
  };
}

function resolveRefundableOrderTotal(order = {}) {
  const commercialTotal = toMoney(
    order?.total || order?.pricing?.total
  );
  if (commercialTotal > 0) return commercialTotal;

  const sources = paymentSourceBreakdown(order);
  if (sources.storeCreditAmount > 0) {
    throw createRefundError(
      'La orden con saldo a favor no conserva un total comercial verificable.',
      'REFUND_COMMERCIAL_TOTAL_MISSING',
      409,
      {
        handling: 'manual_review',
        ...sources,
      }
    );
  }

  return toMoney(order?.payment?.amount);
}

function assertSupportedRefundPaymentSources(order = {}) {
  const sources = paymentSourceBreakdown(order);
  if (sources.storeCreditAmount <= 0) return sources;

  const mixed = sources.mixed;
  throw createRefundError(
    mixed
      ? 'La orden combina saldo a favor y pasarela. Debe revisarse manualmente para distribuir el reembolso sin devolver dinero dos veces.'
      : 'La orden fue pagada con saldo a favor. Debe revisarse manualmente para restaurar el saldo en su fuente original.',
    mixed
      ? 'MIXED_PAYMENT_REFUND_MANUAL_REVIEW_REQUIRED'
      : 'STORE_CREDIT_REFUND_MANUAL_REVIEW_REQUIRED',
    409,
    {
      handling: 'manual_review',
      reason: 'store_credit_restoration_not_supported',
      ...sources,
    }
  );
}

function lineAmount(line = {}, quantity = 0) {
  const purchasedQuantity = Math.max(
    1,
    toQuantity(line?.quantity ?? line?.qty ?? line?.cantidad)
  );
  const safeQuantity = toQuantity(quantity);
  const lineTotal = toMoney(line?.lineTotal);
  if (lineTotal > 0) {
    return toMoney((lineTotal / purchasedQuantity) * safeQuantity);
  }

  const taxableTotal = toMoney(line?.taxableBase) + toMoney(line?.taxAmount);
  if (taxableTotal > 0) {
    return toMoney((taxableTotal / purchasedQuantity) * safeQuantity);
  }

  return toMoney(
    toMoney(line?.unitPrice ?? line?.priceNumber ?? line?.price) * safeQuantity
  );
}

function requestedLine(orderLines, requested = {}) {
  if (requested?.line) return requested.line;
  const requestedLineId = idValue(requested?.orderItemId);
  if (requestedLineId) {
    const exact = orderLines.find(
      (line) => idValue(line?._id || line?.orderItemId) === requestedLineId
    );
    if (exact) return exact;
  }
  const requestedProductId = idValue(requested?.product);
  const byProduct = orderLines.filter(
    (line) => idValue(line?.product || line?.productId) === requestedProductId
  );
  return byProduct.length === 1 ? byProduct[0] : null;
}

function refundItemsAuthority(order = {}, items = []) {
  const orderLines = getOrderLines(order);
  const selectedByLine = new Map();
  let calculatedAmount = 0;

  for (const item of Array.isArray(items) ? items : []) {
    const line = requestedLine(orderLines, item);
    const quantity = toQuantity(
      item?.returnedQuantity ?? item?.quantity ?? item?.qty
    );
    if (!line || quantity <= 0) {
      return {
        authoritative: false,
        calculatedAmount: 0,
        fullSelection: false,
      };
    }
    const lineId = idValue(line?._id || line?.orderItemId);
    selectedByLine.set(
      lineId,
      (selectedByLine.get(lineId) || 0) + quantity
    );
    calculatedAmount = toMoney(
      calculatedAmount + lineAmount(line, quantity)
    );
  }

  const fullSelection =
    orderLines.length > 0 &&
    orderLines.every((line) => {
      const lineId = idValue(line?._id || line?.orderItemId);
      return (
        selectedByLine.get(lineId) ===
        toQuantity(line?.quantity ?? line?.qty ?? line?.cantidad)
      );
    });

  return {
    authoritative: calculatedAmount > 0,
    calculatedAmount,
    fullSelection,
  };
}

function assertRefundAmountMatchesItems({ order = {}, amount = 0, items = [] } = {}) {
  const refundAmount = toMoney(amount);
  const itemAuthority = refundItemsAuthority(order, items);
  const commercialTotal = resolveRefundableOrderTotal(order);
  const matchesLineAmount =
    itemAuthority.authoritative &&
    itemAuthority.calculatedAmount === refundAmount;
  const matchesFullCommercialTotal =
    itemAuthority.fullSelection && commercialTotal === refundAmount;

  if (matchesLineAmount || matchesFullCommercialTotal) {
    return {
      ...itemAuthority,
      commercialTotal,
      refundAmount,
    };
  }

  throw createRefundError(
    'El monto solicitado no coincide con el valor fiscal de las unidades devueltas.',
    'REFUND_AMOUNT_ITEMS_MANUAL_REVIEW_REQUIRED',
    409,
    {
      handling: 'manual_review',
      refundAmount,
      calculatedItemsAmount: itemAuthority.calculatedAmount,
      commercialTotal,
      fullSelection: itemAuthority.fullSelection,
    }
  );
}

function assertRefundCreditNoteAmount(refund = {}, creditNote = {}) {
  const refundAmount = toMoney(refund?.amount);
  const creditNoteAmount = toMoney(
    creditNote?.totalAmount ?? creditNote?.totals?.total
  );
  if (refundAmount > 0 && creditNoteAmount === refundAmount) {
    return { refundAmount, creditNoteAmount };
  }

  throw createRefundError(
    'El total oficial de la nota crédito no coincide con el reembolso.',
    'REFUND_CREDIT_NOTE_AMOUNT_MISMATCH',
    409,
    {
      handling: 'manual_review',
      refundAmount,
      creditNoteAmount,
    }
  );
}

module.exports = {
  assertRefundAmountMatchesItems,
  assertRefundCreditNoteAmount,
  assertSupportedRefundPaymentSources,
  lineAmount,
  paymentSourceBreakdown,
  refundItemsAuthority,
  resolveRefundableOrderTotal,
};
