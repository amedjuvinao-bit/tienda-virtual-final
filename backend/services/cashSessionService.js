// backend/services/cashSessionService.js

const mongoose = require('mongoose');

const CashSession = require('../models/CashSession');
const Branch = require('../models/Branch');
const AdminUser = require('../models/AdminUser');
const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');

const CASH_SALE_STATUSES = new Set([
  'paid',
  'processing',
  'shipped',
  'delivered',
  'refunded',
]);
const PAYMENT_TOTAL_KEYS = new Set(['cash', 'transfer', 'card', 'mixed', 'other']);

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 500) {
  return cleanText(value, max).toLowerCase();
}

function cleanUpper(value, max = 500) {
  return cleanText(value, max).toUpperCase();
}

function cleanMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
}

function toObjectId(value) {
  const id = cleanText(value, 80);
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

function createCashError(message, code = 'CASH_SESSION_ERROR', statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function normalizePaymentMethod(value) {
  const method = cleanLower(value || 'other', 40);
  return PAYMENT_TOTAL_KEYS.has(method) ? method : 'other';
}

function orderPaymentComponents(order = {}) {
  const splits = Array.isArray(order.payment?.splitPayments)
    ? order.payment.splitPayments.filter((split) => cleanMoney(split?.amount) > 0)
    : [];

  if (cleanLower(order.payment?.method, 40) === 'mixed' && splits.length) {
    return splits.map((split) => ({
      method: normalizePaymentMethod(split.method),
      amount: cleanMoney(split.amount),
    }));
  }

  return [{
    method: normalizePaymentMethod(order.payment?.method),
    amount: cleanMoney(order.payment?.amount || order.total || 0),
  }];
}

function allocateRefundAcrossPayments(components = [], refundAmount = 0) {
  const total = components.reduce((sum, component) => sum + cleanMoney(component.amount), 0);
  let remaining = Math.min(cleanMoney(refundAmount), total);
  const reductions = components.map(() => 0);

  components.forEach((component, index) => {
    if (!remaining) return;
    const amount = cleanMoney(component.amount);
    const isLast = index === components.length - 1;
    const proportional = total > 0 ? Math.round((refundAmount * amount) / total) : 0;
    const reduction = Math.min(amount, remaining, isLast ? remaining : proportional);
    reductions[index] = reduction;
    remaining -= reduction;
  });

  if (remaining > 0) {
    for (let index = 0; index < components.length && remaining > 0; index += 1) {
      const capacity = cleanMoney(components[index].amount) - reductions[index];
      const extra = Math.min(capacity, remaining);
      reductions[index] += extra;
      remaining -= extra;
    }
  }

  return reductions;
}

function buildCashSessionSalesSummary(orders = [], refunds = []) {
  const refundsByOrder = new Map();
  for (const refund of refunds) {
    const orderId = cleanText(refund.order, 80);
    const entry = refundsByOrder.get(orderId) || { registered: 0, paymentConfirmed: 0 };
    const amount = cleanMoney(refund.amount);
    entry.registered += amount;
    if (cleanLower(refund.reconciliation?.payment?.state, 40) === 'completed') {
      entry.paymentConfirmed += amount;
    }
    refundsByOrder.set(orderId, entry);
  }

  const paymentTotals = {
    cash: 0,
    transfer: 0,
    card: 0,
    mixed: 0,
    other: 0,
    total: 0,
  };
  const refundedOrders = new Set();
  let ordersCount = 0;
  let cancelledOrdersCount = 0;
  let itemsCount = 0;
  let grossSales = 0;
  let discounts = 0;
  let refundsTotal = 0;
  let netSales = 0;

  for (const order of orders) {
    const status = cleanLower(order.status, 40);
    if (status === 'cancelled') {
      cancelledOrdersCount += 1;
      continue;
    }
    if (!CASH_SALE_STATUSES.has(status)) continue;

    const orderId = cleanText(order._id, 80);
    const orderTotal = cleanMoney(order.total || order.payment?.amount || 0);
    const refund = refundsByOrder.get(orderId) || { registered: 0, paymentConfirmed: 0 };
    const registeredRefund = Math.min(orderTotal, cleanMoney(refund.registered));
    const confirmedRefund = Math.min(orderTotal, cleanMoney(refund.paymentConfirmed));
    if (registeredRefund > 0) refundedOrders.add(orderId);

    ordersCount += 1;
    grossSales += cleanMoney(order.subtotal || order.total || 0);
    discounts += cleanMoney(order.discount?.amount || 0);
    refundsTotal += registeredRefund;
    netSales += Math.max(0, orderTotal - registeredRefund);

    const orderItems = Array.isArray(order.items) ? order.items : [];
    itemsCount += orderItems.reduce(
      (total, item) => total + Number(item.quantity || item.qty || 0),
      0
    );

    const components = orderPaymentComponents(order);
    const reductions = allocateRefundAcrossPayments(components, confirmedRefund);
    components.forEach((component, index) => {
      paymentTotals[component.method] += Math.max(
        0,
        cleanMoney(component.amount) - cleanMoney(reductions[index])
      );
    });
  }

  paymentTotals.total =
    paymentTotals.cash +
    paymentTotals.transfer +
    paymentTotals.card +
    paymentTotals.mixed +
    paymentTotals.other;

  return {
    ordersCount,
    cancelledOrdersCount,
    refundedOrdersCount: refundedOrders.size,
    itemsCount,
    grossSales,
    discounts,
    refunds: refundsTotal,
    netSales,
    paymentTotals,
  };
}

function buildBranchSnapshot(branch = {}) {
  return {
    name: cleanText(branch.name, 140),
    code: cleanUpper(branch.code, 40),
    type: cleanLower(branch.type, 40),
  };
}

function buildAdminSnapshot(admin = {}) {
  return {
    username: cleanLower(admin.username || admin.adminUsername || 'admin', 80),
    displayName: cleanText(admin.displayName || admin.fullName || admin.adminDisplayName || admin.username || 'Administrador', 160),
    role: cleanLower(admin.role || admin.adminRole || 'admin', 40),
    adminRole: cleanLower(admin.adminRole || admin.role || 'admin', 40),
  };
}

function serializeCashSession(session = {}) {
  const doc = typeof session.toSafeObject === 'function'
    ? session.toSafeObject()
    : session.toObject
      ? session.toObject({ virtuals: true })
      : { ...session };

  return {
    id: String(doc._id || doc.id || ''),
    sessionCode: doc.sessionCode || '',
    status: doc.status || '',
    branch: doc.branch ? String(doc.branch) : '',
    branchSnapshot: doc.branchSnapshot || {},
    cashRegisterCode: doc.cashRegisterCode || '',
    cashRegisterName: doc.cashRegisterName || '',
    cashier: doc.cashier ? String(doc.cashier) : '',
    cashierSnapshot: doc.cashierSnapshot || {},
    openedAt: doc.openedAt || null,
    closedAt: doc.closedAt || null,
    openingAmount: Number(doc.openingAmount || 0),
    expectedCash: Number(doc.expectedCash || 0),
    countedCash: Number(doc.countedCash || 0),
    differenceAmount: Number(doc.differenceAmount || 0),
    salesSummary: doc.salesSummary || {},
    cashMovements: Array.isArray(doc.cashMovements) ? doc.cashMovements : [],
    openedBy: doc.openedBy ? String(doc.openedBy) : '',
    openedBySnapshot: doc.openedBySnapshot || {},
    closedBy: doc.closedBy ? String(doc.closedBy) : '',
    closedBySnapshot: doc.closedBySnapshot || {},
    openingNotes: doc.openingNotes || '',
    closingNotes: doc.closingNotes || '',
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

async function resolveBranch(branchId) {
  const objectId = toObjectId(branchId);

  if (!objectId) {
    throw createCashError('Debes seleccionar una sede válida.', 'CASH_BRANCH_REQUIRED', 400);
  }

  const branch = await Branch.findOne({
    _id: objectId,
    deletedAt: null,
    active: true,
    status: 'active',
  });

  if (!branch) {
    throw createCashError('La sede no existe o no está activa.', 'CASH_BRANCH_NOT_FOUND', 404);
  }

  return branch;
}

async function resolveAdminContext(admin = {}) {
  const snapshot = buildAdminSnapshot({
    username: admin.username || admin.adminUsername,
    displayName: admin.displayName || admin.adminDisplayName,
    role: admin.role || admin.adminRole,
    adminRole: admin.adminRole || admin.role,
  });

  const adminObjectId = toObjectId(admin.id || admin._id || admin.adminUserId);
  if (adminObjectId) {
    return { id: adminObjectId, snapshot };
  }

  const foundAdmin = await AdminUser.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
    $or: [
      { username: snapshot.username },
      { role: 'owner' },
      { role: 'admin' },
    ],
  })
    .sort({ role: 1, createdAt: 1 })
    .lean();

  if (foundAdmin?._id) {
    return {
      id: foundAdmin._id,
      snapshot: buildAdminSnapshot(foundAdmin),
    };
  }

  return {
    id: new mongoose.Types.ObjectId('000000000000000000000001'),
    snapshot,
  };
}

async function recalculateCashSession(sessionOrId, options = {}) {
  const dbSession = options.session || null;
  const session = typeof sessionOrId === 'string' || sessionOrId instanceof mongoose.Types.ObjectId
    ? await CashSession.findById(sessionOrId).session(dbSession)
    : sessionOrId;

  if (!session) {
    throw createCashError('Caja no encontrada.', 'CASH_SESSION_NOT_FOUND', 404);
  }

  const ordersQuery = Order.find({
    source: 'pos',
    cashSession: session._id,
    status: { $in: [...CASH_SALE_STATUSES, 'cancelled'] },
  }).lean();

  if (dbSession) ordersQuery.session(dbSession);

  const orders = await ordersQuery;
  const refundsQuery = OrderRefund.find({
    order: { $in: orders.map((order) => order._id) },
    status: 'processed',
  }).lean();
  if (dbSession) refundsQuery.session(dbSession);
  const refunds = await refundsQuery;

  session.salesSummary = buildCashSessionSalesSummary(orders, refunds);

  if (dbSession) await session.save({ session: dbSession });
  else await session.save();

  return session;
}

async function getCurrentCashSession({ branchId, cashRegisterCode = 'CAJA PRINCIPAL' } = {}) {
  const branchObjectId = toObjectId(branchId);

  if (!branchObjectId) {
    throw createCashError('Debes indicar una sede válida.', 'CASH_BRANCH_REQUIRED', 400);
  }

  const filter = {
    branch: branchObjectId,
    status: 'open',
  };

  const registerCode = cleanUpper(cashRegisterCode || 'CAJA PRINCIPAL', 40);
  if (registerCode) filter.cashRegisterCode = registerCode;

  const session = await CashSession.findOne(filter).sort({ openedAt: -1 });

  if (!session) return null;

  await recalculateCashSession(session);
  return session;
}

async function openCashSession(payload = {}, { admin = {} } = {}) {
  const branch = await resolveBranch(payload.branchId || payload.branch);
  const adminContext = await resolveAdminContext(admin);
  const cashRegisterCode = cleanUpper(payload.cashRegisterCode || 'CAJA PRINCIPAL', 40);

  const existingOpen = await CashSession.findOne({
    branch: branch._id,
    cashRegisterCode,
    status: 'open',
  }).lean();

  if (existingOpen) {
    throw createCashError(
      'Ya existe una caja abierta para esta sede y caja.',
      'CASH_SESSION_ALREADY_OPEN',
      409,
      { sessionId: String(existingOpen._id), sessionCode: existingOpen.sessionCode }
    );
  }

  const openingAmount = cleanMoney(payload.openingAmount);

  const session = new CashSession({
    branch: branch._id,
    branchSnapshot: buildBranchSnapshot(branch),
    cashRegisterCode,
    cashRegisterName: cleanText(payload.cashRegisterName || 'Caja principal', 120),
    cashier: adminContext.id,
    cashierSnapshot: adminContext.snapshot,
    openedBy: adminContext.id,
    openedBySnapshot: adminContext.snapshot,
    openingAmount,
    openingNotes: cleanText(payload.openingNotes || '', 1000),
    cashMovements: openingAmount > 0
      ? [{
          type: 'opening',
          amount: openingAmount,
          direction: 'neutral',
          reason: 'Apertura de caja',
          createdBy: adminContext.id,
          createdBySnapshot: adminContext.snapshot,
        }]
      : [],
  });

  await session.save();
  return session;
}

async function closeCashSession(sessionId, payload = {}, { admin = {} } = {}) {
  const objectId = toObjectId(sessionId);

  if (!objectId) {
    throw createCashError('Debes indicar una caja válida.', 'CASH_SESSION_ID_REQUIRED', 400);
  }

  const session = await CashSession.findById(objectId);

  if (!session) {
    throw createCashError('Caja no encontrada.', 'CASH_SESSION_NOT_FOUND', 404);
  }

  if (session.status !== 'open') {
    throw createCashError('Solo se puede cerrar una caja abierta.', 'CASH_SESSION_NOT_OPEN', 409);
  }

  await recalculateCashSession(session);

  const adminContext = await resolveAdminContext(admin);

  session.closeSession({
    countedCash: cleanMoney(payload.countedCash),
    closedBy: adminContext.id,
    closedBySnapshot: adminContext.snapshot,
    closingNotes: cleanText(payload.closingNotes || '', 1000),
  });

  session.cashMovements.push({
    type: 'closing',
    amount: cleanMoney(payload.countedCash),
    direction: 'neutral',
    reason: 'Cierre de caja',
    createdBy: adminContext.id,
    createdBySnapshot: adminContext.snapshot,
  });

  await session.save();
  return session;
}

async function listCashSessions(filters = {}) {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
  const query = {};

  const status = cleanLower(filters.status || '', 20);
  if (status && status !== 'all') query.status = status;

  const branchObjectId = toObjectId(filters.branchId || filters.branch);
  if (branchObjectId) query.branch = branchObjectId;

  const [sessions, total] = await Promise.all([
    CashSession.find(query)
      .sort({ openedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    CashSession.countDocuments(query),
  ]);

  return {
    sessions,
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function getCashSessionById(sessionId) {
  const objectId = toObjectId(sessionId);

  if (!objectId) {
    throw createCashError('Debes indicar una caja válida.', 'CASH_SESSION_ID_REQUIRED', 400);
  }

  const session = await CashSession.findById(objectId);

  if (!session) {
    throw createCashError('Caja no encontrada.', 'CASH_SESSION_NOT_FOUND', 404);
  }

  await recalculateCashSession(session);
  return session;
}

module.exports = {
  createCashError,
  serializeCashSession,
  openCashSession,
  closeCashSession,
  getCurrentCashSession,
  listCashSessions,
  getCashSessionById,
  recalculateCashSession,
  allocateRefundAcrossPayments,
  buildCashSessionSalesSummary,
  orderPaymentComponents,
};
