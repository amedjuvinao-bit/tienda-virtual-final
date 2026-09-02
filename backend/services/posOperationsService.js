'use strict';

const mongoose = require('mongoose');

const Counter = require('../models/Counter');
const Order = require('../models/Order');
const PosHeldSale = require('../models/PosHeldSale');
const {
  POS_PAYMENT_METHODS,
  calculateTotalsFromNormalizedItems,
  createPosError,
  loadAndValidatePosItems,
  validatePosBranch,
} = require('./adminPosService');

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 300) {
  return cleanText(value, max).toLowerCase();
}

function cleanUpper(value, max = 300) {
  return cleanText(value, max).toUpperCase();
}

function toMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function buildBranchSnapshot(branch = {}) {
  return {
    name: cleanText(branch.name, 160),
    code: cleanUpper(branch.code, 40),
    type: cleanLower(branch.type, 40),
  };
}

function buildAdminSnapshot(admin = {}) {
  return {
    username: cleanLower(admin.username || admin.adminUsername || admin.email, 120),
    displayName: cleanText(
      admin.displayName || admin.fullName || admin.name || admin.username || admin.adminUsername,
      160
    ),
    role: cleanLower(admin.role, 80),
    adminRole: cleanLower(admin.adminRole || admin.role, 80),
  };
}

function sanitizeCustomer(customer = {}) {
  if (!customer || typeof customer !== 'object') return null;

  const id = cleanText(customer.id || customer._id, 40);
  const fullName = cleanText(customer.fullName || customer.displayName || customer.name, 180);
  const phone = cleanText(customer.phone, 40);
  const email = cleanLower(customer.email, 180);
  const documentType = cleanUpper(customer.documentType, 20);
  const documentNumber = cleanText(customer.documentNumber, 60);

  if (!id && !fullName && !phone && !email && !documentNumber) return null;

  return {
    id,
    fullName,
    displayName: fullName,
    phone,
    email,
    documentType,
    documentNumber,
    address: cleanText(customer.address, 220),
    city: cleanText(customer.city, 100),
    department: cleanText(customer.department, 100),
    country: cleanUpper(customer.country || 'CO', 3),
  };
}

function sanitizeCustomerSelection(selection = {}) {
  const requestedMode = cleanLower(selection.mode, 20);
  const mode = ['guest', 'existing', 'quick'].includes(requestedMode)
    ? requestedMode
    : 'guest';
  const selectedCustomer = mode === 'existing'
    ? sanitizeCustomer(selection.selectedCustomer)
    : null;
  const quickCustomer = mode === 'quick'
    ? sanitizeCustomer(selection.quickCustomer)
    : null;

  if (mode === 'existing' && !selectedCustomer?.id) {
    throw createPosError(
      'La venta en espera indica cliente existente, pero no contiene un cliente válido.',
      'POS_HELD_CUSTOMER_REQUIRED'
    );
  }

  if (mode === 'quick' && !quickCustomer?.fullName) {
    throw createPosError(
      'La venta en espera indica cliente rápido, pero no contiene su nombre.',
      'POS_HELD_QUICK_CUSTOMER_REQUIRED'
    );
  }

  return { mode, selectedCustomer, quickCustomer };
}

function sanitizePaymentDetails(details = {}) {
  const splitPayments = Array.isArray(details.splitPayments)
    ? details.splitPayments.slice(0, 5).map((split) => ({
        id: cleanText(split?.id, 80),
        method: cleanLower(split?.method, 40),
        amount: toMoney(split?.amount),
        receivedAmount: toMoney(split?.receivedAmount),
        reference: cleanText(split?.reference, 120),
      }))
    : [];

  return {
    amount: toMoney(details.amount),
    receivedAmount: toMoney(details.receivedAmount),
    reference: cleanText(details.reference, 120),
    terminalId: cleanText(details.terminalId, 80),
    splitPayments,
  };
}

function sanitizeDiscount(discount = {}) {
  const type = ['none', 'percent', 'amount'].includes(cleanLower(discount.type, 20))
    ? cleanLower(discount.type, 20)
    : 'none';

  return {
    type,
    value: toMoney(discount.value),
    reason: cleanText(discount.reason, 240),
  };
}

function mapHeldItem(item = {}) {
  return {
    product: item.product?._id || item.productObjectId,
    productId: String(item.product?._id || item.productObjectId || item.productId || ''),
    title: cleanText(item.productSnapshot?.title || item.product?.title || item.title, 220),
    sku: cleanUpper(item.productSnapshot?.sku || item.product?.sku || item.sku, 100),
    barcode: cleanText(
      item.variantSnapshot?.barcode || item.product?.barcode || item.barcode,
      120
    ),
    image: cleanText(item.productSnapshot?.image || item.image, 1000),
    category: cleanText(item.productSnapshot?.category || item.product?.category || item.category, 120),
    variantKey: cleanText(item.variantKey || 'default__default', 240),
    variantLabel: cleanText(item.variantSnapshot?.label || item.variantLabel, 160),
    variantAttributes: Array.isArray(item.variantSnapshot?.attributes)
      ? item.variantSnapshot.attributes
      : [],
    size: cleanText(item.variantSnapshot?.size || item.size, 80),
    color: cleanText(item.variantSnapshot?.color || item.color, 120),
    quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
    unitPrice: toMoney(item.unitPrice),
    availableStockSnapshot: Number.isFinite(Number(item.availableStock))
      ? Math.max(0, Number(item.availableStock))
      : 999999,
  };
}

async function nextHeldSaleCode() {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'posHeldSaleNumber' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return `ESPERA-${String(counter.seq).padStart(6, '0')}`;
}

function serializeHeldSale(sale = {}) {
  const value = typeof sale.toObject === 'function' ? sale.toObject() : sale;

  return {
    id: String(value._id || value.id || ''),
    code: value.code || '',
    status: value.status || '',
    branch: {
      id: String(value.branch?._id || value.branch || ''),
      ...(value.branchSnapshot || {}),
    },
    cashier: {
      id: String(value.cashier?._id || value.cashier || ''),
      ...(value.cashierSnapshot || {}),
    },
    customerSelection: value.customerSelection || { mode: 'guest' },
    items: (value.items || []).map((item) => ({
      productId: String(item.product?._id || item.product || item.productId || ''),
      title: item.title || '',
      sku: item.sku || '',
      barcode: item.barcode || '',
      image: item.image || '',
      category: item.category || '',
      variantKey: item.variantKey || 'default__default',
      variantLabel: item.variantLabel || '',
      variantAttributes: item.variantAttributes || [],
      size: item.size || '',
      color: item.color || '',
      quantity: Number(item.quantity || 1),
      price: Number(item.unitPrice || 0),
      unitPrice: Number(item.unitPrice || 0),
      availableStock: Number(item.availableStockSnapshot || 0),
    })),
    paymentMethod: value.paymentMethod || 'cash',
    paymentDetails: value.paymentDetails || {},
    discount: value.discount || { type: 'none', value: 0 },
    subtotal: Number(value.subtotalSnapshot || 0),
    totalItems: Number(value.totalItems || 0),
    note: value.note || '',
    lastOpenedAt: value.lastOpenedAt || null,
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
  };
}

async function createHeldSale(payload = {}, { admin = {} } = {}) {
  const branch = await validatePosBranch(payload.branchId);
  const validatedItems = await loadAndValidatePosItems(payload.items || [], branch);
  const totals = calculateTotalsFromNormalizedItems({
    items: validatedItems,
    discount: payload.discount || {},
  });
  const paymentMethod = POS_PAYMENT_METHODS.includes(cleanLower(payload.paymentMethod, 40))
    ? cleanLower(payload.paymentMethod, 40)
    : 'cash';
  const adminId = admin._id || admin.id || null;
  const code = await nextHeldSaleCode();
  const sale = await PosHeldSale.create({
    code,
    branch: branch._id,
    branchSnapshot: buildBranchSnapshot(branch),
    cashier: mongoose.Types.ObjectId.isValid(String(adminId || '')) ? adminId : null,
    cashierSnapshot: buildAdminSnapshot(admin),
    customerSelection: sanitizeCustomerSelection(payload.customerSelection || {}),
    items: validatedItems.map(mapHeldItem),
    paymentMethod,
    paymentDetails: sanitizePaymentDetails(payload.paymentDetails || {}),
    discount: sanitizeDiscount(payload.discount || {}),
    subtotalSnapshot: totals.subtotal,
    totalItems: totals.summary.totalItems,
    note: cleanText(payload.note, 240),
  });

  return serializeHeldSale(sale);
}

async function listHeldSales({ branchIds = null, branchId = '', q = '', limit = 30 } = {}) {
  const filter = { status: 'active' };
  const cleanBranchId = cleanText(branchId, 40);

  if (cleanBranchId) filter.branch = cleanBranchId;
  else if (Array.isArray(branchIds)) filter.branch = { $in: branchIds };

  const search = cleanText(q, 120);
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { code: regex },
      { note: regex },
      { 'customerSelection.selectedCustomer.fullName': regex },
      { 'customerSelection.quickCustomer.fullName': regex },
    ];
  }

  const sales = await PosHeldSale.find(filter)
    .sort({ updatedAt: -1 })
    .limit(Math.min(Math.max(Number(limit || 30), 1), 60))
    .lean();

  return sales.map(serializeHeldSale);
}

function scopedHeldFilter(id, branchIds) {
  if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
    throw createPosError(
      'La venta en espera no tiene un identificador válido.',
      'POS_HELD_SALE_ID_INVALID',
      {},
      400
    );
  }
  const filter = { _id: id, status: 'active' };
  if (Array.isArray(branchIds)) filter.branch = { $in: branchIds };
  return filter;
}

async function touchHeldSale(id, { branchIds = null } = {}) {
  const sale = await PosHeldSale.findOneAndUpdate(
    scopedHeldFilter(id, branchIds),
    { $set: { lastOpenedAt: new Date() } },
    { new: true }
  );

  if (!sale) {
    throw createPosError(
      'La venta en espera ya no está disponible.',
      'POS_HELD_SALE_NOT_FOUND',
      {},
      404
    );
  }

  return serializeHeldSale(sale);
}

async function closeHeldSale(
  id,
  { reason = 'discarded', orderId = null, branchIds = null } = {}
) {
  const sold = reason === 'sold';
  const update = {
    status: sold ? 'completed' : 'discarded',
    closeReason: sold ? 'sold' : 'discarded',
    closedAt: new Date(),
  };

  if (sold && mongoose.Types.ObjectId.isValid(String(orderId || ''))) {
    update.completedOrder = orderId;
  }

  const sale = await PosHeldSale.findOneAndUpdate(
    scopedHeldFilter(id, branchIds),
    { $set: update },
    { new: true }
  );

  if (!sale) {
    throw createPosError(
      'La venta en espera ya fue cerrada o no existe.',
      'POS_HELD_SALE_NOT_FOUND',
      {},
      404
    );
  }

  return serializeHeldSale(sale);
}

function serializePosHistoryOrder(order = {}) {
  const totalItems = (order.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || item.qty || 0),
    0
  );

  return {
    id: String(order._id || order.id || ''),
    _id: String(order._id || order.id || ''),
    orderNumber: order.orderNumber || '',
    status: order.status || '',
    fulfillmentStatus: order.fulfillmentStatus || '',
    createdAt: order.createdAt || null,
    branch: {
      id: String(order.branch?._id || order.branch || ''),
      ...(order.branchSnapshot || {}),
    },
    cashier: order.cashierSnapshot || order.createdByAdminSnapshot || {},
    customer: order.customer || {},
    payment: order.payment || {},
    subtotal: Number(order.subtotal || 0),
    total: Number(order.total || 0),
    totalItems,
    itemsCount: Array.isArray(order.items) ? order.items.length : 0,
    pos: order.pos || {},
    refundControl: order.refundControl || {},
    returnControl: order.returnControl || {},
  };
}

async function listPosSalesHistory({ branchIds = null, branchId = '', q = '', limit = 30 } = {}) {
  const filter = { source: 'pos' };
  const cleanBranchId = cleanText(branchId, 40);

  if (cleanBranchId) filter.branch = cleanBranchId;
  else if (Array.isArray(branchIds)) filter.branch = { $in: branchIds };

  const search = cleanText(q, 120);
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { orderNumber: regex },
      { 'pos.receiptNumber': regex },
      { 'customer.name': regex },
      { 'customer.phone': regex },
      { 'customer.email': regex },
      { 'payment.reference': regex },
    ];
  }

  const safeLimit = Math.min(Math.max(Number(limit || 30), 1), 60);
  const orders = await Order.find(filter)
    .select('orderNumber status fulfillmentStatus createdAt branch branchSnapshot cashierSnapshot createdByAdminSnapshot customer payment subtotal total items pos refundControl returnControl')
    .sort({ createdAt: -1, _id: -1 })
    .limit(safeLimit)
    .lean();

  return orders.map(serializePosHistoryOrder);
}

module.exports = {
  closeHeldSale,
  createHeldSale,
  listHeldSales,
  listPosSalesHistory,
  sanitizeCustomerSelection,
  serializeHeldSale,
  serializePosHistoryOrder,
  touchHeldSale,
};
