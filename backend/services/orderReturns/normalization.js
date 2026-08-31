'use strict';

const mongoose = require('mongoose');

const OrderReturn = require('../../models/OrderReturn');
const {
  canonicalizeVariantKey,
} = require('../../lib/products/productVariantConfig');

const ACTIVE_RETURN_STATUSES = [
  'requested',
  'authorized',
  'in_transit',
  'received',
  'inspected',
  'resolution_required',
  'resolved',
];
const MUTABLE_RETURN_STATUSES = new Set([
  'requested',
  'authorized',
  'in_transit',
  'received',
]);
const RETURN_REASON_CODES = new Set(OrderReturn.RETURN_REASON_CODES || []);
const RETURN_RESOLUTION_TYPES = new Set(OrderReturn.RETURN_RESOLUTION_TYPES || []);

function createReturnError(message, code, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function cleanText(value, maximum = 2000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function cleanLower(value, maximum = 2000) {
  return cleanText(value, maximum).toLowerCase();
}

function cleanUpper(value, maximum = 2000) {
  return cleanText(value, maximum).toUpperCase();
}

function toQuantity(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function toMoney(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

function idValue(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString());
    return idValue(value._id || value.id || value.orderItemId || value.product);
  }
  return cleanText(value, 100);
}

function objectId(value, field = 'identificador') {
  const id = idValue(value);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createReturnError(`${field} no es válido.`, 'INVALID_OBJECT_ID', 400, {
      field,
      value: id,
    });
  }
  return new mongoose.Types.ObjectId(id);
}

function actorSnapshot(actor = {}) {
  const id = idValue(actor.id);
  return {
    id: mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null,
    label: cleanText(actor.label || actor.displayName || 'admin', 160),
    role: cleanLower(actor.role, 80),
  };
}

function returnWindowDays(policy = {}) {
  const configured = Math.floor(
    Number(policy.windowDays || process.env.ORDER_RETURN_WINDOW_DAYS || 30)
  );
  return Number.isFinite(configured) ? Math.min(365, Math.max(1, configured)) : 30;
}

function orderLines(order = {}) {
  return Array.isArray(order.items) && order.items.length
    ? order.items
    : Array.isArray(order.cart)
      ? order.cart
      : [];
}

function lineQuantity(line = {}) {
  return toQuantity(line.quantity ?? line.qty ?? line.cantidad);
}

function lineUnitAmount(line = {}) {
  const quantity = Math.max(1, lineQuantity(line));
  const lineTotal = toMoney(line.lineTotal);
  if (lineTotal > 0) return toMoney(lineTotal / quantity);
  const taxableBase = toMoney(line.taxableBase);
  const taxAmount = toMoney(line.taxAmount);
  if (taxableBase + taxAmount > 0) {
    return toMoney((taxableBase + taxAmount) / quantity);
  }
  return toMoney(line.unitPrice ?? line.priceNumber ?? line.price);
}

function isPhysicalLine(line = {}) {
  const type = cleanLower(line.productType || 'physical');
  return !['digital', 'service'].includes(type) && line.requiresShipping !== false;
}

function latestDate(values = []) {
  const dates = values
    .map((value) => (value ? new Date(value) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()));
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function earliestDate(values = []) {
  const dates = values
    .map((value) => (value ? new Date(value) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()));
  if (!dates.length) return null;
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function deliveredState(order = {}) {
  const source = cleanLower(order.source);
  if (source === 'pos') return true;
  return ['delivered', 'refunded'].includes(cleanLower(order.status)) ||
    cleanLower(order.fulfillmentStatus) === 'delivered' ||
    cleanLower(order.fulfillment?.status) === 'delivered';
}

function deliveryForLine(order = {}, line = {}) {
  const lineId = idValue(line._id || line.orderItemId);
  const allocations = (order.inventoryAllocations || []).filter(
    (allocation) => idValue(allocation.orderItem) === lineId
  );
  const deliveredQuantity = allocations.reduce(
    (sum, allocation) => sum + toQuantity(allocation.deliveredQuantity),
    0
  );
  const deliveredAt = latestDate(allocations.map((allocation) => allocation.deliveredAt));
  if (deliveredQuantity > 0) return { deliveredQuantity, deliveredAt };

  if (!deliveredState(order)) return { deliveredQuantity: 0, deliveredAt: null };

  const shipmentDate = latestDate(
    (order.fulfillment?.shipments || []).map((shipment) => shipment.deliveredAt)
  );
  return {
    deliveredQuantity: lineQuantity(line),
    deliveredAt:
      shipmentDate ||
      (order.createdAt ? new Date(order.createdAt) : null) ||
      (order.updatedAt ? new Date(order.updatedAt) : null) ||
      new Date(),
  };
}

module.exports = {
  ACTIVE_RETURN_STATUSES,
  MUTABLE_RETURN_STATUSES,
  RETURN_REASON_CODES,
  RETURN_RESOLUTION_TYPES,
  actorSnapshot,
  cleanLower,
  cleanText,
  cleanUpper,
  createReturnError,
  deliveryForLine,
  earliestDate,
  idValue,
  isPhysicalLine,
  latestDate,
  lineQuantity,
  lineUnitAmount,
  objectId,
  orderLines,
  returnWindowDays,
  toMoney,
  toQuantity,
};
