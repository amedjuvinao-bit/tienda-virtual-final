'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const {
  canonicalizeVariantKey,
  resolveVariantIdentity,
} = require('../../lib/products/productVariantConfig');

function createRefundError(message, code, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function toMoney(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

function toQuantity(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function idValue(value) {
  if (!value) return '';
  if (
    value instanceof mongoose.Types.ObjectId ||
    typeof value?.toHexString === 'function'
  ) {
    return String(value.toHexString());
  }
  if (typeof value === 'object') {
    return cleanText(value._id || value.id || value.product || value);
  }
  return cleanText(value);
}

function toObjectId(value, fieldName = 'id') {
  const id = idValue(value);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createRefundError(
      `${fieldName} no tiene un identificador válido.`,
      'INVALID_OBJECT_ID',
      400,
      { field: fieldName, value: id }
    );
  }
  return new mongoose.Types.ObjectId(id);
}

function normalizeVariantKey(source = {}) {
  return resolveVariantIdentity({
    variantKey: source.variantKey || source.variantId,
    size: source.size || source.talla || source.variant?.size || '',
    color: source.color || source.variant?.color || '',
    attributes:
      source.variantAttributes ||
      source.attributes ||
      source.variant?.attributes ||
      [],
  }).variantKey;
}

function orderItemQuantity(item = {}) {
  return toQuantity(item.quantity ?? item.qty ?? item.cantidad);
}

function orderItemProductId(item = {}) {
  return idValue(item.productId || item.product);
}

function getOrderLines(order = {}) {
  if (Array.isArray(order.items) && order.items.length) {
    return order.items;
  }
  return Array.isArray(order.cart) ? order.cart : [];
}

function lineIdentity(line = {}, index = 0) {
  const existingId = idValue(line._id || line.orderItemId);
  if (mongoose.Types.ObjectId.isValid(existingId)) return existingId;

  throw createRefundError(
    `La línea ${index + 1} de la orden no tiene identificador histórico.`,
    'ORDER_ITEM_ID_MISSING',
    409,
    { index }
  );
}

function productMatchesLine(line = {}, requested = {}) {
  const requestedProduct = idValue(
    requested.productId ||
      requested.product ||
      requested.product_id ||
      requested._id ||
      requested.id
  );
  if (!requestedProduct) return true;
  return orderItemProductId(line) === requestedProduct;
}

function variantMatchesLine(line = {}, requested = {}) {
  const rawRequestedVariant = cleanText(
    requested.variantKey || requested.variantId || ''
  );
  const requestedVariant = canonicalizeVariantKey(rawRequestedVariant);
  const requestedSize = cleanLower(
    requested.size || requested.talla || requested.variant?.size || ''
  );
  const requestedColor = cleanLower(
    requested.color || requested.variant?.color || ''
  );

  if (
    rawRequestedVariant &&
    (!requestedVariant || normalizeVariantKey(line) !== requestedVariant)
  ) {
    return false;
  }
  if (
    requestedSize &&
    cleanLower(line.size || line.talla) !== requestedSize
  ) {
    return false;
  }
  if (
    requestedColor &&
    cleanLower(line.color) !== requestedColor
  ) {
    return false;
  }
  return true;
}

function resolveOrderLine(orderLines, requested, index) {
  const explicitLineId = idValue(
    requested.orderItemId || requested.lineId || requested.orderLineId
  );
  const genericId = idValue(requested._id || requested.id);
  const lineIdCandidate = explicitLineId || genericId;

  if (lineIdCandidate) {
    const exact = orderLines.find(
      (line) => idValue(line._id || line.orderItemId) === lineIdCandidate
    );
    if (exact) return exact;
    if (explicitLineId) {
      throw createRefundError(
        `La línea ${index + 1} no pertenece a la orden.`,
        'REFUND_ITEM_NOT_IN_ORDER',
        400,
        { index, orderItemId: explicitLineId }
      );
    }
  }

  const candidates = orderLines.filter(
    (line) =>
      productMatchesLine(line, requested) &&
      variantMatchesLine(line, requested)
  );

  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    throw createRefundError(
      `La línea ${index + 1} es ambigua. Envía orderItemId.`,
      'REFUND_ITEM_AMBIGUOUS',
      400,
      { index }
    );
  }

  throw createRefundError(
    `La línea ${index + 1} no corresponde a ningún producto vendido.`,
    'REFUND_ITEM_NOT_IN_ORDER',
    400,
    { index }
  );
}

function normalizeRequestedItems(
  order,
  requestedItems,
  previouslyReturnedByLine = new Map()
) {
  const orderLines = getOrderLines(order);
  const source = Array.isArray(requestedItems) ? requestedItems : [];
  const consolidated = new Map();

  source.forEach((requested, index) => {
    const line = resolveOrderLine(orderLines, requested || {}, index);
    const orderItemId = lineIdentity(
      line,
      orderLines.indexOf(line)
    );
    const quantity = toQuantity(
      requested?.quantity ?? requested?.qty ?? requested?.cantidad
    );
    const hasExplicitRestockQuantity = Object.prototype.hasOwnProperty.call(
      requested || {},
      'restockQuantity'
    );
    const requestedRestockQuantity = hasExplicitRestockQuantity
      ? toQuantity(requested?.restockQuantity)
      : quantity;

    if (quantity <= 0) {
      throw createRefundError(
        `La cantidad de la línea ${index + 1} debe ser mayor a cero.`,
        'REFUND_QUANTITY_INVALID',
        400,
        { index, quantity }
      );
    }
    if (requestedRestockQuantity > quantity) {
      throw createRefundError(
        `La cantidad a reponer de la línea ${index + 1} supera la cantidad devuelta.`,
        'REFUND_RESTOCK_QUANTITY_INVALID',
        400,
        { index, quantity, restockQuantity: requestedRestockQuantity }
      );
    }

    const current = consolidated.get(orderItemId);
    if (current) {
      current.returnedQuantity += quantity;
      current.requestedRestockQuantity += requestedRestockQuantity;
      return;
    }

    const purchasedQuantity = orderItemQuantity(line);
    if (purchasedQuantity <= 0) {
      throw createRefundError(
        `La línea ${index + 1} no tiene una cantidad vendida válida.`,
        'ORDER_ITEM_QUANTITY_INVALID',
        409,
        { index, orderItemId }
      );
    }

    consolidated.set(orderItemId, {
      orderItemId,
      product: orderItemProductId(line),
      title: cleanText(line.title || line.name),
      productType: cleanLower(line.productType || 'physical') || 'physical',
      variantKey: normalizeVariantKey(line),
      size: cleanText(line.size || line.talla),
      color: cleanText(line.color),
      purchasedQuantity,
      returnedQuantity: quantity,
      requestedRestockQuantity,
      restockedQuantity: 0,
      line,
    });
  });

  const normalized = Array.from(consolidated.values());

  normalized.forEach((item) => {
    if (!mongoose.Types.ObjectId.isValid(item.product)) {
      throw createRefundError(
        `La línea ${item.title || item.orderItemId} no conserva el producto vendido.`,
        'ORDER_ITEM_PRODUCT_MISSING',
        409,
        { orderItemId: item.orderItemId }
      );
    }

    const previous = toQuantity(
      previouslyReturnedByLine.get(item.orderItemId) || 0
    );
    if (
      previous + item.returnedQuantity >
      item.purchasedQuantity
    ) {
      throw createRefundError(
        `La devolución de ${item.title || 'un producto'} supera la cantidad comprada.`,
        'REFUND_QUANTITY_EXCEEDS_PURCHASED',
        409,
        {
          orderItemId: item.orderItemId,
          purchasedQuantity: item.purchasedQuantity,
          previouslyReturned: previous,
          requestedQuantity: item.returnedQuantity,
        }
      );
    }
  });

  return normalized;
}

function canonicalRefundPayload({ amount, reason, items, returnCaseId = '' }) {
  const payload = {
    amount: toMoney(amount),
    reason: cleanText(reason),
    items: [...items]
      .map((item) => {
        const normalized = {
          orderItemId: item.orderItemId,
          quantity: item.returnedQuantity,
        };
        const hasRestockQuantity = Number.isFinite(
          Number(item.requestedRestockQuantity)
        );
        if (
          hasRestockQuantity &&
          toQuantity(item.requestedRestockQuantity) !==
            toQuantity(item.returnedQuantity)
        ) {
          normalized.restockQuantity = toQuantity(
            item.requestedRestockQuantity
          );
        }
        return normalized;
      })
      .sort((a, b) =>
        a.orderItemId.localeCompare(b.orderItemId)
      ),
  };
  const cleanReturnCaseId = idValue(returnCaseId);
  if (cleanReturnCaseId) payload.returnCaseId = cleanReturnCaseId;
  return payload;
}

function hashPayload(payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function buildRefundNumber(orderNumber = '') {
  const orderPart =
    cleanUpper(orderNumber).replace(/[^A-Z0-9-]/g, '').slice(-30) ||
    'ORDER';
  return `RF-${orderPart}-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
}

function isPaidOrder(order = {}) {
  const paymentStatus = cleanLower(order.payment?.status);
  // El avance logístico no constituye evidencia monetaria. Una orden puede
  // quedar en processing/shipped por una incidencia operativa aunque la
  // pasarela haya rechazado o siga esperando el pago.
  return paymentStatus === 'paid';
}

module.exports = {
  buildRefundNumber,
  canonicalRefundPayload,
  cleanLower,
  cleanText,
  cleanUpper,
  createRefundError,
  getOrderLines,
  hashPayload,
  idValue,
  isPaidOrder,
  lineIdentity,
  normalizeRequestedItems,
  normalizeVariantKey,
  orderItemProductId,
  orderItemQuantity,
  resolveOrderLine,
  toMoney,
  toObjectId,
  toQuantity,
};
