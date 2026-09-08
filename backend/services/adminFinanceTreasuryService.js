'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');

const FinanceExpense = require('../models/FinanceExpense');
const Order = require('../models/Order');

const OPEN_ORDER_PAYMENT_STATUSES = ['pending_gateway', 'pending_manual'];
const PAYMENT_METHODS = new Set(['cash', 'transfer', 'card', 'mixed', 'other']);
const REFERENCE_REQUIRED_METHODS = new Set(['transfer', 'card', 'mixed', 'other']);
const DAY_MS = 24 * 60 * 60 * 1000;

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 500) {
  return cleanText(value, max).toLowerCase();
}

function money(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

function signedMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function toObjectId(value) {
  const raw = cleanText(value, 80);
  return mongoose.Types.ObjectId.isValid(raw)
    ? new mongoose.Types.ObjectId(raw)
    : null;
}

function normalizeBranchIds(values) {
  if (!Array.isArray(values)) return null;
  const seen = new Set();
  const ids = [];
  for (const value of values) {
    const id = toObjectId(value);
    if (!id || seen.has(String(id))) continue;
    seen.add(String(id));
    ids.push(id);
  }
  return ids;
}

function branchFilter(query = {}) {
  if (Object.prototype.hasOwnProperty.call(query, 'branchIds')) {
    const ids = normalizeBranchIds(query.branchIds);
    return ids === null ? {} : { branch: { $in: ids } };
  }
  const id = toObjectId(query.branchId || query.branch);
  return id ? { branch: id } : {};
}

function createTreasuryError(message, code, status = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function startOfUtcDay(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createTreasuryError(
      'La fecha de corte no es válida.',
      'FINANCE_TREASURY_AS_OF_INVALID',
      400
    );
  }
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
}

function parseAsOf(value) {
  if (!value) return startOfUtcDay();
  return startOfUtcDay(value);
}

function agingMeta(dueDate, asOf) {
  const due = startOfUtcDay(dueDate);
  const daysOverdue = Math.max(
    0,
    Math.floor((asOf.getTime() - due.getTime()) / DAY_MS)
  );
  if (due >= asOf) {
    return { key: 'current', label: 'Al día', daysOverdue: 0, overdue: false };
  }
  if (daysOverdue <= 7) {
    return { key: 'days_1_7', label: '1 a 7 días', daysOverdue, overdue: true };
  }
  if (daysOverdue <= 30) {
    return { key: 'days_8_30', label: '8 a 30 días', daysOverdue, overdue: true };
  }
  if (daysOverdue <= 60) {
    return { key: 'days_31_60', label: '31 a 60 días', daysOverdue, overdue: true };
  }
  return { key: 'days_60_plus', label: 'Más de 60 días', daysOverdue, overdue: true };
}

function emptyAging() {
  return [
    ['current', 'Al día'],
    ['days_1_7', '1 a 7 días'],
    ['days_8_30', '8 a 30 días'],
    ['days_31_60', '31 a 60 días'],
    ['days_60_plus', 'Más de 60 días'],
  ].map(([key, label]) => ({ key, label, count: 0, amount: 0 }));
}

function summarizeRows(rows = [], asOf = startOfUtcDay()) {
  const aging = emptyAging();
  const bucketByKey = new Map(aging.map((bucket) => [bucket.key, bucket]));
  const next30 = new Date(asOf.getTime() + 30 * DAY_MS);
  let amount = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  let dueNext30Amount = 0;

  for (const row of rows) {
    const balance = money(row.balanceAmount ?? row.amount);
    const dueDate = row.dueDate || row.createdAt;
    const age = agingMeta(dueDate, asOf);
    const bucket = bucketByKey.get(age.key);
    amount += balance;
    bucket.amount += balance;
    bucket.count += 1;
    if (age.overdue) {
      overdueAmount += balance;
      overdueCount += 1;
    }
    const due = startOfUtcDay(dueDate);
    if (due >= asOf && due <= next30) dueNext30Amount += balance;
  }

  return {
    count: rows.length,
    amount: money(amount),
    overdueCount,
    overdueAmount: money(overdueAmount),
    dueNext30Amount: money(dueNext30Amount),
    aging: aging.map((bucket) => ({ ...bucket, amount: money(bucket.amount) })),
  };
}

function orderBalance(order = {}) {
  const paymentAmount = money(order.payment?.amount);
  return paymentAmount > 0 ? paymentAmount : money(order.total);
}

function orderCustomer(order = {}) {
  const first = cleanText(order.customer?.name, 100);
  const last = cleanText(order.customer?.lastname, 100);
  return {
    name: cleanText(`${first} ${last}`, 180) || 'Cliente sin nombre',
  };
}

function mapReceivable(order, asOf) {
  const dueDate = order.createdAt || new Date();
  return {
    _id: String(order._id),
    orderNumber: cleanText(order.orderNumber, 100),
    customer: orderCustomer(order),
    branch: order.branch ? String(order.branch) : null,
    branchSnapshot: order.branchSnapshot || {},
    paymentStatus: cleanLower(order.payment?.status, 40),
    paymentMethod: cleanLower(
      order.payment?.method || order.payment?.methodType || order.payment?.provider,
      40
    ),
    amount: orderBalance(order),
    balanceAmount: orderBalance(order),
    dueDate,
    createdAt: order.createdAt,
    aging: agingMeta(dueDate, asOf),
  };
}

function payableBalance(expense = {}) {
  const stored = Number(expense.settlement?.balanceAmount);
  if (Number.isFinite(stored) && stored >= 0) return money(stored);
  return Math.max(
    0,
    money(expense.amount) - money(expense.settlement?.paidAmount)
  );
}

function mapPayable(expense, asOf) {
  const dueDate = expense.dueDate || expense.date || expense.createdAt;
  return {
    _id: String(expense._id),
    category: cleanText(expense.category, 120) || 'General',
    description: cleanText(expense.description, 500),
    vendor: cleanText(expense.vendor, 160) || 'Proveedor sin registrar',
    invoiceNumber: cleanText(expense.invoiceNumber, 80),
    reference: cleanText(expense.reference, 120),
    branch: expense.branch ? String(expense.branch) : null,
    branchSnapshot: expense.branchSnapshot || {},
    amount: money(expense.amount),
    paidAmount: money(expense.settlement?.paidAmount),
    balanceAmount: payableBalance(expense),
    settlementStatus: cleanLower(expense.settlement?.status, 30) || 'pending',
    dueDate,
    revision: Math.max(0, Number(expense.revision || 0)),
    createdAt: expense.createdAt,
    aging: agingMeta(dueDate, asOf),
  };
}

async function aggregateSummary(
  Model,
  filter,
  amountExpression,
  dueDateExpression,
  asOf
) {
  const next30 = new Date(asOf.getTime() + 30 * DAY_MS);
  const sevenDaysAgo = new Date(asOf.getTime() - 7 * DAY_MS);
  const thirtyDaysAgo = new Date(asOf.getTime() - 30 * DAY_MS);
  const sixtyDaysAgo = new Date(asOf.getTime() - 60 * DAY_MS);
  const [result = {}] = await Model.aggregate([
    { $match: filter },
    {
      $project: {
        balanceAmount: { $max: [0, amountExpression] },
        dueDate: dueDateExpression,
      },
    },
    { $match: { balanceAmount: { $gt: 0 } } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              amount: { $sum: '$balanceAmount' },
              overdueCount: {
                $sum: { $cond: [{ $lt: ['$dueDate', asOf] }, 1, 0] },
              },
              overdueAmount: {
                $sum: {
                  $cond: [
                    { $lt: ['$dueDate', asOf] },
                    '$balanceAmount',
                    0,
                  ],
                },
              },
              dueNext30Amount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$dueDate', asOf] },
                        { $lte: ['$dueDate', next30] },
                      ],
                    },
                    '$balanceAmount',
                    0,
                  ],
                },
              },
            },
          },
        ],
        aging: [
          {
            $project: {
              balanceAmount: 1,
              bucket: {
                $switch: {
                  branches: [
                    { case: { $gte: ['$dueDate', asOf] }, then: 'current' },
                    { case: { $gte: ['$dueDate', sevenDaysAgo] }, then: 'days_1_7' },
                    { case: { $gte: ['$dueDate', thirtyDaysAgo] }, then: 'days_8_30' },
                    { case: { $gte: ['$dueDate', sixtyDaysAgo] }, then: 'days_31_60' },
                  ],
                  default: 'days_60_plus',
                },
              },
            },
          },
          {
            $group: {
              _id: '$bucket',
              count: { $sum: 1 },
              amount: { $sum: '$balanceAmount' },
            },
          },
        ],
      },
    },
  ]);

  const totals = result.totals?.[0] || {};
  const agingRows = new Map(
    (result.aging || []).map((row) => [row._id, row])
  );
  return {
    count: Number(totals.count || 0),
    amount: money(totals.amount),
    overdueCount: Number(totals.overdueCount || 0),
    overdueAmount: money(totals.overdueAmount),
    dueNext30Amount: money(totals.dueNext30Amount),
    aging: emptyAging().map((bucket) => ({
      ...bucket,
      count: Number(agingRows.get(bucket.key)?.count || 0),
      amount: money(agingRows.get(bucket.key)?.amount),
    })),
  };
}

async function getTreasury(query = {}) {
  const asOf = parseAsOf(query.asOf);
  const scope = branchFilter(query);
  const receivableFilter = {
    ...scope,
    status: { $nin: ['cancelled', 'canceled', 'failed', 'refunded'] },
    'payment.status': { $in: OPEN_ORDER_PAYMENT_STATUSES },
  };
  const payableFilter = {
    ...scope,
    deletedAt: null,
    status: 'paid',
    paymentTerms: 'credit',
    'settlement.status': { $in: ['pending', 'partial'] },
    'settlement.balanceAmount': { $gt: 0 },
  };

  const receivableAmountExpression = {
    $cond: [
      { $gt: [{ $ifNull: ['$payment.amount', 0] }, 0] },
      { $ifNull: ['$payment.amount', 0] },
      { $ifNull: ['$total', 0] },
    ],
  };
  const payableAmountExpression = {
    $ifNull: ['$settlement.balanceAmount', 0],
  };

  const [orders, expenses, receivableSummary, payableSummary] = await Promise.all([
    Order.find(receivableFilter)
      .select('orderNumber total customer.name customer.lastname branch branchSnapshot payment.status payment.method payment.methodType payment.provider payment.amount createdAt')
      .sort({ createdAt: 1 })
      .limit(40)
      .lean(),
    FinanceExpense.find(payableFilter)
      .select('category description vendor invoiceNumber reference branch branchSnapshot amount settlement dueDate date revision createdAt')
      .sort({ dueDate: 1, createdAt: 1 })
      .limit(40)
      .lean(),
    aggregateSummary(
      Order,
      receivableFilter,
      receivableAmountExpression,
      { $ifNull: ['$createdAt', asOf] },
      asOf
    ),
    aggregateSummary(
      FinanceExpense,
      payableFilter,
      payableAmountExpression,
      { $ifNull: ['$dueDate', { $ifNull: ['$date', '$createdAt'] }] },
      asOf
    ),
  ]);

  const receivables = orders
    .map((order) => mapReceivable(order, asOf))
    .filter((row) => row.balanceAmount > 0);
  const payables = expenses
    .map((expense) => mapPayable(expense, asOf))
    .filter((row) => row.balanceAmount > 0);

  return {
    asOf,
    horizonDays: 30,
    summary: {
      accountsReceivable: receivableSummary.amount,
      accountsPayable: payableSummary.amount,
      overdueReceivable: receivableSummary.overdueAmount,
      overduePayable: payableSummary.overdueAmount,
      dueNext30Receivable: receivableSummary.dueNext30Amount,
      dueNext30Payable: payableSummary.dueNext30Amount,
      projectedNet30: signedMoney(
        receivableSummary.dueNext30Amount - payableSummary.dueNext30Amount
      ),
    },
    receivables: {
      ...receivableSummary,
      data: receivables,
    },
    payables: {
      ...payableSummary,
      data: payables,
    },
  };
}

function actorContext(actor = {}) {
  const source = actor.snapshot || actor;
  const id = toObjectId(actor.adminUserId || actor.id || actor._id);
  if (!id) {
    throw createTreasuryError(
      'El registro de pagos requiere un usuario administrativo identificado.',
      'FINANCE_TREASURY_ACTOR_REQUIRED',
      403
    );
  }
  return {
    id,
    idString: String(id),
    snapshot: {
      username: cleanLower(source.username || actor.username, 80),
      displayName: cleanText(
        source.displayName || source.fullName || actor.displayName || source.username || 'Administrador',
        160
      ),
      role: cleanLower(source.role || actor.role || actor.adminRole, 40),
      adminRole: cleanLower(
        source.adminRole || actor.adminRole || source.role || actor.role,
        40
      ),
    },
  };
}

function expectedRevision(value) {
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 0) {
    throw createTreasuryError(
      'Debes enviar la versión vigente de la cuenta por pagar.',
      'FINANCE_PAYABLE_REVISION_REQUIRED',
      428
    );
  }
  return revision;
}

function paymentRequestKey(value, actorId, expenseId) {
  const raw = cleanText(value, 160);
  if (raw.length < 8) {
    throw createTreasuryError(
      'No fue posible identificar de forma segura el abono.',
      'FINANCE_PAYABLE_PAYMENT_REQUEST_KEY_REQUIRED',
      400
    );
  }
  return crypto
    .createHash('sha256')
    .update(`${actorId}:${expenseId}:${raw}`)
    .digest('hex');
}

function paymentData(payload = {}) {
  const amount = money(payload.amount);
  if (amount <= 0) {
    throw createTreasuryError(
      'El valor del abono debe ser mayor a cero.',
      'FINANCE_PAYABLE_PAYMENT_AMOUNT_INVALID',
      400
    );
  }
  const method = cleanLower(payload.paymentMethod || payload.method, 40);
  if (!PAYMENT_METHODS.has(method)) {
    throw createTreasuryError(
      'Debes seleccionar un método de pago válido.',
      'FINANCE_PAYABLE_PAYMENT_METHOD_INVALID',
      400
    );
  }
  const reference = cleanText(payload.reference, 160);
  if (REFERENCE_REQUIRED_METHODS.has(method) && !reference) {
    throw createTreasuryError(
      'Debes registrar la referencia del pago.',
      'FINANCE_PAYABLE_PAYMENT_REFERENCE_REQUIRED',
      400
    );
  }
  const paidAt = payload.paidAt ? new Date(payload.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw createTreasuryError(
      'La fecha del pago no es válida.',
      'FINANCE_PAYABLE_PAYMENT_DATE_INVALID',
      400
    );
  }
  return {
    amount,
    method,
    reference,
    notes: cleanText(payload.notes, 500),
    paidAt,
  };
}

function resourceFilter(expenseId, scope = {}) {
  const id = toObjectId(expenseId);
  if (!id) {
    throw createTreasuryError(
      'ID de cuenta por pagar inválido.',
      'FINANCE_PAYABLE_ID_INVALID',
      400
    );
  }
  const filter = { _id: id, deletedAt: null };
  const ids = normalizeBranchIds(scope.branchIds);
  if (ids !== null) filter.branch = { $in: ids };
  return filter;
}

async function registerPayablePayment(
  expenseId,
  payload = {},
  actor = {},
  scope = {}
) {
  const operator = actorContext(actor);
  const filter = resourceFilter(expenseId, scope);
  const requestKey = paymentRequestKey(
    payload.requestKey,
    operator.idString,
    String(filter._id)
  );
  const expense = await FinanceExpense.findOne(filter);
  if (!expense) {
    throw createTreasuryError(
      'Cuenta por pagar no encontrada dentro de tus sedes autorizadas.',
      'FINANCE_PAYABLE_NOT_FOUND',
      404
    );
  }

  const replay = (expense.settlement?.payments || []).find(
    (payment) => payment.requestKey === requestKey
  );
  if (replay) {
    return { ...expense.toSafeObject(), idempotentReplay: true };
  }

  const revision = expectedRevision(payload.expectedRevision);
  if (Number(expense.revision || 0) !== revision) {
    throw createTreasuryError(
      'La cuenta por pagar cambió en otra sesión. Recarga antes de continuar.',
      'FINANCE_PAYABLE_VERSION_CONFLICT',
      409,
      { expectedRevision: revision, currentRevision: Number(expense.revision || 0) }
    );
  }
  if (expense.status !== 'paid' || expense.paymentTerms !== 'credit') {
    throw createTreasuryError(
      'El gasto no corresponde a una cuenta por pagar activa.',
      'FINANCE_PAYABLE_NOT_ACTIVE',
      409
    );
  }
  if (!['pending', 'partial'].includes(expense.settlement?.status)) {
    throw createTreasuryError(
      'La cuenta por pagar ya está saldada.',
      'FINANCE_PAYABLE_ALREADY_SETTLED',
      409
    );
  }
  if ((expense.settlement?.payments || []).length >= 80) {
    throw createTreasuryError(
      'La cuenta alcanzó el máximo de abonos permitidos.',
      'FINANCE_PAYABLE_PAYMENT_LIMIT_REACHED',
      409
    );
  }

  const payment = paymentData(payload);
  const currentBalance = payableBalance(expense);
  if (payment.amount > currentBalance) {
    throw createTreasuryError(
      'El abono no puede superar el saldo pendiente.',
      'FINANCE_PAYABLE_PAYMENT_EXCEEDS_BALANCE',
      409,
      { balanceAmount: currentBalance }
    );
  }

  const nextRevision = revision + 1;
  const nextPaidAmount = money(expense.settlement?.paidAmount) + payment.amount;
  const nextBalanceAmount = Math.max(0, currentBalance - payment.amount);
  const nextSettlementStatus = nextBalanceAmount === 0 ? 'paid' : 'partial';
  const paymentRecord = {
    requestKey,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    notes: payment.notes,
    paidAt: payment.paidAt,
    actor: operator.id,
    actorSnapshot: operator.snapshot,
    revision: nextRevision,
  };
  const event = {
    action: 'payable_payment_registered',
    fromStatus: 'paid',
    toStatus: 'paid',
    actor: operator.id,
    actorSnapshot: operator.snapshot,
    at: payment.paidAt,
    notes: cleanText(
      `Abono de ${payment.amount}. ${payment.reference ? `Referencia ${payment.reference}.` : ''} ${payment.notes}`,
      500
    ),
    revision: nextRevision,
  };

  const updated = await FinanceExpense.findOneAndUpdate(
    {
      ...filter,
      revision,
      status: 'paid',
      paymentTerms: 'credit',
      'settlement.status': { $in: ['pending', 'partial'] },
      'settlement.balanceAmount': currentBalance,
      'settlement.payments.requestKey': { $ne: requestKey },
    },
    {
      $set: {
        'settlement.status': nextSettlementStatus,
        'settlement.paidAmount': nextPaidAmount,
        'settlement.balanceAmount': nextBalanceAmount,
        'settlement.lastPaymentAt': payment.paidAt,
        updatedBy: operator.id,
      },
      $inc: { revision: 1 },
      $push: {
        'settlement.payments': paymentRecord,
        workflow: event,
      },
    },
    { new: true, runValidators: true }
  );

  if (!updated) {
    const latest = await FinanceExpense.findOne(filter);
    const latestReplay = (latest?.settlement?.payments || []).find(
      (item) => item.requestKey === requestKey
    );
    if (latest && latestReplay) {
      return { ...latest.toSafeObject(), idempotentReplay: true };
    }
    throw createTreasuryError(
      'La cuenta por pagar cambió antes de registrar el abono. Recarga e inténtalo de nuevo.',
      'FINANCE_PAYABLE_PAYMENT_CONFLICT',
      409,
      { currentRevision: Number(latest?.revision || 0) }
    );
  }

  return updated.toSafeObject();
}

module.exports = {
  createTreasuryError,
  getTreasury,
  registerPayablePayment,
  __test: {
    agingMeta,
    aggregateSummary,
    branchFilter,
    mapPayable,
    mapReceivable,
    orderBalance,
    parseAsOf,
    paymentData,
    paymentRequestKey,
    summarizeRows,
  },
};
