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

function parseCashAmount(
  value,
  {
    required = false,
    allowZero = true,
    field = 'monto',
    code = 'CASH_AMOUNT_INVALID',
  } = {}
) {
  const isEmpty = value === undefined || value === null || String(value).trim() === '';

  if (isEmpty) {
    if (!required) return 0;
    throw createCashError(`Debes indicar el ${field}.`, code, 400, { field });
  }

  const number = Number(value);
  const rounded = Math.round(number);
  if (!Number.isFinite(number) || !Number.isSafeInteger(rounded) || number < 0) {
    throw createCashError(
      `El ${field} debe ser un valor válido mayor o igual a cero.`,
      code,
      400,
      { field }
    );
  }

  if (!allowZero && rounded <= 0) {
    throw createCashError(`El ${field} debe ser mayor que cero.`, code, 400, { field });
  }

  return rounded;
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

function isCashConcurrencyError(error) {
  return (
    error?.name === 'VersionError' ||
    String(error?.code || '') === '112' ||
    String(error?.codeName || '').toLowerCase() === 'writeconflict'
  );
}

function cashConcurrencyError() {
  return createCashError(
    'La caja cambió mientras realizabas la operación. Actualiza y vuelve a intentarlo.',
    'CASH_SESSION_CONFLICT',
    409
  );
}

async function saveCashSession(session, options = {}) {
  try {
    return options.session
      ? await session.save({ session: options.session })
      : await session.save();
  } catch (error) {
    if (isCashConcurrencyError(error)) {
      if (
        options.session &&
        typeof error?.hasErrorLabel === 'function' &&
        error.hasErrorLabel('TransientTransactionError')
      ) {
        throw error;
      }
      throw cashConcurrencyError();
    }
    throw error;
  }
}

function normalizeBranchScope(branchIds) {
  if (!Array.isArray(branchIds)) return null;
  return [...new Set(branchIds.map(toObjectId).filter(Boolean).map(String))]
    .map((branchId) => new mongoose.Types.ObjectId(branchId));
}

function buildScopedCashSessionFilter(sessionId, options = {}) {
  const objectId = toObjectId(sessionId);
  if (!objectId) {
    throw createCashError('Debes indicar una caja válida.', 'CASH_SESSION_ID_REQUIRED', 400);
  }

  const filter = { _id: objectId };
  const branchScope = normalizeBranchScope(options.branchIds);
  if (branchScope) filter.branch = { $in: branchScope };
  return filter;
}

function assertCashSessionOperator(session, adminContext, options = {}) {
  if (options.canSupervise === true) return true;

  if (
    adminContext?.id &&
    String(session?.cashier || '') === String(adminContext.id)
  ) {
    return true;
  }

  throw createCashError(
    'Solo el cajero responsable o un supervisor puede operar esta caja.',
    'CASH_SESSION_OPERATOR_FORBIDDEN',
    403,
    { sessionId: String(session?._id || '') }
  );
}

function normalizePaymentMethod(value) {
  const method = cleanLower(value || 'other', 40);
  return PAYMENT_TOTAL_KEYS.has(method) ? method : 'other';
}

function isFinalCashSession(session = {}) {
  return ['closed', 'cancelled'].includes(cleanLower(session?.status, 20));
}

function comparableSalesSummary(summary = {}) {
  const payments = summary?.paymentTotals || {};
  return {
    ordersCount: Number(summary?.ordersCount || 0),
    cancelledOrdersCount: Number(summary?.cancelledOrdersCount || 0),
    refundedOrdersCount: Number(summary?.refundedOrdersCount || 0),
    itemsCount: Number(summary?.itemsCount || 0),
    grossSales: cleanMoney(summary?.grossSales),
    discounts: cleanMoney(summary?.discounts),
    refunds: cleanMoney(summary?.refunds),
    netSales: cleanMoney(summary?.netSales),
    paymentTotals: {
      cash: cleanMoney(payments?.cash),
      transfer: cleanMoney(payments?.transfer),
      card: cleanMoney(payments?.card),
      mixed: cleanMoney(payments?.mixed),
      other: cleanMoney(payments?.other),
      total: cleanMoney(payments?.total),
    },
  };
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
    cancelledAt: doc.cancelledAt || null,
    cancelledBy: doc.cancelledBy ? String(doc.cancelledBy) : '',
    cancelledReason: doc.cancelledReason || '',
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

  if (isFinalCashSession(session)) {
    if (options.requireOpen === true) {
      throw createCashError(
        'La caja ya está cerrada. El ajuste debe registrarse en una caja abierta.',
        'CASH_SESSION_FINAL_ADJUSTMENT_REQUIRED',
        409,
        { sessionId: String(session._id || ''), status: session.status }
      );
    }
    return session;
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

  const previousSummary = comparableSalesSummary(session.salesSummary);
  const previousExpectedCash = cleanMoney(session.expectedCash);
  session.salesSummary = buildCashSessionSalesSummary(orders, refunds);
  await session.validate();

  const nextSummary = comparableSalesSummary(session.salesSummary);
  if (
    JSON.stringify(previousSummary) === JSON.stringify(nextSummary) &&
    previousExpectedCash === cleanMoney(session.expectedCash)
  ) {
    return session;
  }

  const currentVersion = Number(session.__v || 0);
  const salesSummary = session.salesSummary?.toObject
    ? session.salesSummary.toObject({ depopulate: true })
    : session.salesSummary;
  let updatedSession;

  try {
    updatedSession = await CashSession.findOneAndUpdate(
      { _id: session._id, __v: currentVersion },
      {
        $set: {
          salesSummary,
          expectedCash: session.expectedCash,
        },
        $inc: { __v: 1 },
      },
      {
        new: true,
        runValidators: true,
        session: dbSession,
      }
    );
  } catch (error) {
    if (
      dbSession &&
      isCashConcurrencyError(error) &&
      typeof error?.hasErrorLabel === 'function' &&
      error.hasErrorLabel('TransientTransactionError')
    ) {
      throw error;
    }
    if (isCashConcurrencyError(error)) throw cashConcurrencyError();
    throw error;
  }

  if (!updatedSession) throw cashConcurrencyError();

  return updatedSession;
}

async function getCurrentCashSession({
  branchId,
  cashRegisterCode = 'CAJA PRINCIPAL',
  branchIds,
} = {}) {
  const branchObjectId = toObjectId(branchId);

  if (!branchObjectId) {
    throw createCashError('Debes indicar una sede válida.', 'CASH_BRANCH_REQUIRED', 400);
  }

  const filter = {
    branch: branchObjectId,
    status: 'open',
  };

  const branchScope = normalizeBranchScope(branchIds);
  if (branchScope && !branchScope.some((id) => String(id) === String(branchObjectId))) {
    throw createCashError(
      'No tienes acceso a la caja de esa sede.',
      'CASH_BRANCH_FORBIDDEN',
      403
    );
  }

  const registerCode = cleanUpper(cashRegisterCode || 'CAJA PRINCIPAL', 40);
  if (registerCode) filter.cashRegisterCode = registerCode;

  const session = await CashSession.findOne(filter).sort({ openedAt: -1 });

  if (!session) return null;

  return recalculateCashSession(session);
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

  const openingAmount = parseCashAmount(payload.openingAmount, {
    field: 'monto inicial',
    code: 'CASH_OPENING_AMOUNT_INVALID',
  });

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

  try {
    await saveCashSession(session);
    return session;
  } catch (error) {
    if (String(error?.code || '') === '11000') {
      throw createCashError(
        'Ya existe una caja abierta para esta sede y caja.',
        'CASH_SESSION_ALREADY_OPEN',
        409
      );
    }
    throw error;
  }
}

async function closeCashSession(sessionId, payload = {}, options = {}) {
  const admin = options.admin || {};
  const adminContext = await resolveAdminContext(admin);
  const session = await CashSession.findOne(
    buildScopedCashSessionFilter(sessionId, options)
  );

  if (!session) {
    throw createCashError(
      'Caja no encontrada dentro de tus sedes autorizadas.',
      'CASH_SESSION_NOT_FOUND',
      404
    );
  }

  if (session.status !== 'open') {
    throw createCashError('Solo se puede cerrar una caja abierta.', 'CASH_SESSION_NOT_OPEN', 409);
  }

  assertCashSessionOperator(session, adminContext, options);
  const recalculatedSession = await recalculateCashSession(session);

  recalculatedSession.closeSession({
    countedCash: parseCashAmount(payload.countedCash, {
      required: true,
      field: 'efectivo contado',
      code: 'CASH_COUNTED_AMOUNT_REQUIRED',
    }),
    closedBy: adminContext.id,
    closedBySnapshot: adminContext.snapshot,
    closingNotes: cleanText(payload.closingNotes || '', 1000),
  });

  recalculatedSession.cashMovements.push({
    type: 'closing',
    amount: recalculatedSession.countedCash,
    direction: 'neutral',
    reason: 'Cierre de caja',
    createdBy: adminContext.id,
    createdBySnapshot: adminContext.snapshot,
  });

  await saveCashSession(recalculatedSession);
  return recalculatedSession;
}

async function listCashSessions(filters = {}) {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
  const query = {};
  const branchScope = normalizeBranchScope(filters.branchIds);
  if (branchScope) query.branch = { $in: branchScope };

  const status = cleanLower(filters.status || '', 20);
  if (status && status !== 'all') query.status = status;

  const branchObjectId = toObjectId(filters.branchId || filters.branch);
  if (branchObjectId) {
    if (
      branchScope &&
      !branchScope.some((branchId) => String(branchId) === String(branchObjectId))
    ) {
      throw createCashError(
        'No tienes acceso a las cajas de esa sede.',
        'CASH_BRANCH_FORBIDDEN',
        403
      );
    }
    query.branch = branchObjectId;
  }

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

async function getCashSessionById(sessionId, options = {}) {
  const session = await CashSession.findOne(
    buildScopedCashSessionFilter(sessionId, options)
  );

  if (!session) {
    throw createCashError(
      'Caja no encontrada dentro de tus sedes autorizadas.',
      'CASH_SESSION_NOT_FOUND',
      404
    );
  }

  return recalculateCashSession(session);
}

module.exports = {
  assertCashSessionOperator,
  buildScopedCashSessionFilter,
  cashConcurrencyError,
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
  isCashConcurrencyError,
  isFinalCashSession,
  normalizeBranchScope,
  parseCashAmount,
  saveCashSession,
};
