// backend/services/adminFinanceService.js
const mongoose = require('mongoose');

const Order = require('../models/Order');
const CashSession = require('../models/CashSession');
const FinanceExpense = require('../models/FinanceExpense');
const Branch = require('../models/Branch');
const {
  createRevenueFacts,
} = require('./adminFinance/revenueFacts');
const {
  createProfitFacts,
} = require('./adminFinance/profitFacts');
const { formatLocalDate, resolveDateRange, safeDate } = require('../utils/dateRange');

const CANCELLED_ORDER_STATUSES = ['cancelled', 'canceled', 'failed'];

function clean(value) {
  return String(value || '').trim();
}

function cleanLower(value) {
  return clean(value).toLowerCase();
}

function money(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
}

function signedMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number);
}

function pct(part, total) {
  const p = Number(part || 0);
  const t = Number(total || 0);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return 0;
  return Math.round((p / t) * 10000) / 100;
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function toObjectId(value) {
  if (!isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function normalizeBranchIds(values) {
  if (!Array.isArray(values)) return null;
  const ids = [];
  const seen = new Set();

  for (const value of values) {
    const id = toObjectId(value);
    if (!id || seen.has(String(id))) continue;
    seen.add(String(id));
    ids.push(id);
  }

  return ids;
}

function escapeRegex(value) {
  return clean(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildBranchFilter(query = {}) {
  if (Object.prototype.hasOwnProperty.call(query, 'branchIds')) {
    const scopedIds = normalizeBranchIds(query.branchIds);
    if (scopedIds === null) return {};
    return { branch: { $in: scopedIds } };
  }

  const branchId = query.branchId || query.branch || '';
  const branch = toObjectId(branchId);
  return branch ? { branch } : {};
}

function buildExpenseResourceFilter(expenseId, scope = {}) {
  const filter = {
    _id: toObjectId(expenseId),
    deletedAt: null,
  };
  const branchIds = normalizeBranchIds(scope.branchIds);
  if (branchIds !== null) filter.branch = { $in: branchIds };
  return filter;
}

async function resolveExpenseBranch(branchId) {
  const objectId = toObjectId(branchId);
  if (!objectId) return { branch: null, snapshot: {} };

  const branch = await Branch.findOne({
    _id: objectId,
    deletedAt: null,
    active: true,
    status: 'active',
  })
    .select('name code type')
    .lean();

  if (!branch) {
    const error = new Error('La sede seleccionada no existe o no está activa.');
    error.code = 'FINANCE_BRANCH_NOT_AVAILABLE';
    error.status = 409;
    throw error;
  }

  return {
    branch: branch._id,
    snapshot: {
      name: branch.name || '',
      code: branch.code || '',
      type: branch.type || '',
    },
  };
}

function buildPaidOrdersFilter(query = {}) {
  const dateRange = resolveDateRange(query);
  const branchFilter = buildBranchFilter(query);

  return {
    ...branchFilter,
    status: { $nin: CANCELLED_ORDER_STATUSES },
    $and: [
      {
        $or: [
          { 'payment.status': 'paid' },
          { status: 'paid' },
        ],
      },
      {
        $or: [
          { 'payment.paidAt': { $gte: dateRange.from, $lte: dateRange.to } },
          {
            'payment.paidAt': null,
            'paymentProcessing.approvedAt': {
              $gte: dateRange.from,
              $lte: dateRange.to,
            },
          },
          {
            'payment.paidAt': null,
            'paymentProcessing.approvedAt': null,
            createdAt: { $gte: dateRange.from, $lte: dateRange.to },
          },
        ],
      },
    ],
  };
}

function getOrderFinancialDate(order = {}) {
  return (
    safeDate(order.payment?.paidAt) ||
    safeDate(order.paymentProcessing?.approvedAt) ||
    safeDate(order.createdAt) ||
    new Date(0)
  );
}

function getOrderAmount(order = {}) {
  const total = money(order.total);
  if (total > 0) return total;

  const paymentAmount = money(order.payment?.amount);
  if (paymentAmount > 0) return paymentAmount;

  return Math.max(
    0,
    money(order.subtotal) + money(order.shipping) - money(order.discount?.amount)
  );
}

function getOrderPaymentParts(order = {}, targetAmount = getOrderAmount(order)) {
  const total = Number(targetAmount || 0);
  const splits = Array.isArray(order.payment?.splitPayments)
    ? order.payment.splitPayments
        .map((item) => ({
          key: cleanLower(item?.method || 'otro') || 'otro',
          label: clean(item?.methodLabel || item?.method || 'Otro') || 'Otro',
          amount: money(item?.amount),
        }))
        .filter((item) => item.amount > 0)
    : [];
  const splitTotal = splits.reduce((sum, item) => sum + item.amount, 0);

  if (splits.length && splitTotal > 0) {
    let allocated = 0;
    return splits.map((item, index) => {
      const amount = index === splits.length - 1
        ? signedMoney(total - allocated)
        : signedMoney((item.amount / splitTotal) * total);
      allocated += amount;
      return { ...item, amount, share: item.amount / splitTotal };
    });
  }

  const key = cleanLower(
    order.payment?.method ||
      order.payment?.methodType ||
      order.payment?.provider ||
      'sin_metodo'
  );

  return [{
    key: key || 'sin_metodo',
    label: clean(order.payment?.methodLabel || key || 'Sin método'),
    amount: signedMoney(total),
    share: 1,
  }];
}

function getItemQty(item = {}) {
  const qty = Number(item.quantity ?? item.qty ?? 0);
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, Math.floor(qty));
}

function getItemUnitPrice(item = {}) {
  return money(item.price ?? item.unitPrice ?? item.priceNumber);
}

function getProductIdFromItem(item = {}) {
  const raw = item.product || item.productId || '';
  if (raw && typeof raw === 'object') return String(raw._id || raw.id || '');
  return String(raw || '');
}

function getOrderItems(order = {}) {
  if (Array.isArray(order.items) && order.items.length) return order.items;
  if (Array.isArray(order.cart) && order.cart.length) return order.cart;
  return [];
}

function bucketKey(date) {
  return formatLocalDate(date);
}

function addGroupedAmount(map, key, amount, extra = {}) {
  const safeKey = clean(key || 'sin_definir') || 'sin_definir';
  const current = map.get(safeKey) || {
    key: safeKey,
    label: extra.label || safeKey,
    orders: 0,
    amount: 0,
    items: 0,
  };

  current.orders += Number(extra.orders || 0);
  current.items += Number(extra.items || 0);
  current.amount += money(amount);
  map.set(safeKey, current);
}

function mapToBreakdown(map, totalAmount) {
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      amount: money(row.amount),
      percent: pct(row.amount, totalAmount),
    }))
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
}

async function getPaidOrders(query = {}) {
  const filter = buildPaidOrdersFilter(query);
  return Order.find(filter).sort({ createdAt: -1 }).lean();
}

const {
  applySalesCorrections,
  correctionTotal,
  loadFinancialCorrectionContext,
} = createRevenueFacts({
  bucketKey,
  buildBranchFilter,
  clean,
  cleanLower,
  getOrderAmount,
  getOrderPaymentParts,
  money,
  pct,
  resolveDateRange,
  safeDate,
  signedMoney,
  toObjectId,
});

function summarizeSalesFromOrders(orders = []) {
  const bySource = new Map();
  const byChannel = new Map();
  const bySaleType = new Map();
  const byPaymentMethod = new Map();
  const byDay = new Map();

  let revenue = 0;
  let subtotal = 0;
  let shipping = 0;
  let discounts = 0;
  let taxes = 0;
  let itemsCount = 0;

  for (const order of orders) {
    const amount = getOrderAmount(order);
    const orderSubtotal = money(order.subtotal || order.summary?.subtotal);
    const orderShipping = money(order.shipping);
    const orderDiscount = money(order.discount?.amount);
    const orderTaxes = money(order.taxes?.iva?.amount);
    const orderItems = getOrderItems(order);
    const orderItemsCount = orderItems.reduce((acc, item) => acc + getItemQty(item), 0);
    const dayKey = bucketKey(getOrderFinancialDate(order));

    revenue += amount;
    subtotal += orderSubtotal;
    shipping += orderShipping;
    discounts += orderDiscount;
    taxes += orderTaxes;
    itemsCount += orderItemsCount;

    addGroupedAmount(bySource, order.source || 'online', amount, {
      orders: 1,
      items: orderItemsCount,
    });
    addGroupedAmount(byChannel, order.channel || 'web', amount, {
      orders: 1,
      items: orderItemsCount,
    });
    addGroupedAmount(bySaleType, order.saleType || 'online_order', amount, {
      orders: 1,
      items: orderItemsCount,
    });
    for (const paymentPart of getOrderPaymentParts(order, amount)) {
      addGroupedAmount(byPaymentMethod, paymentPart.key, paymentPart.amount, {
        label: paymentPart.label,
        orders: 1,
        items: orderItemsCount,
      });
    }

    const current = byDay.get(dayKey) || {
      date: dayKey,
      orders: 0,
      revenue: 0,
      subtotal: 0,
      shipping: 0,
      discounts: 0,
      taxes: 0,
    };
    current.orders += 1;
    current.revenue += amount;
    current.subtotal += orderSubtotal;
    current.shipping += orderShipping;
    current.discounts += orderDiscount;
    current.taxes += orderTaxes;
    byDay.set(dayKey, current);
  }

  return {
    ordersCount: orders.length,
    itemsCount,
    revenue: money(revenue),
    subtotal: money(subtotal),
    shipping: money(shipping),
    discounts: money(discounts),
    taxes: money(taxes),
    averageTicket: orders.length ? money(revenue / orders.length) : 0,
    bySource: mapToBreakdown(bySource, revenue),
    byChannel: mapToBreakdown(byChannel, revenue),
    bySaleType: mapToBreakdown(bySaleType, revenue),
    byPaymentMethod: mapToBreakdown(byPaymentMethod, revenue),
    daily: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

const {
  financeCostKey,
  resolveItemCost,
  summarizeProfitFromOrders,
} = createProfitFacts({
  clean,
  cleanLower,
  correctionTotal,
  getItemQty,
  getItemUnitPrice,
  getOrderAmount,
  getOrderItems,
  getProductIdFromItem,
  isValidObjectId,
  money,
  pct,
  signedMoney,
  toObjectId,
});

function getCashMovementTotals(sessions = []) {
  const byType = new Map();
  let cashIn = 0;
  let cashOut = 0;
  let operatingExpenses = 0;
  let withdrawals = 0;

  for (const session of sessions) {
    const movements = Array.isArray(session.cashMovements) ? session.cashMovements : [];
    for (const movement of movements) {
      const amount = money(movement.amount);
      const type = cleanLower(movement.type || 'adjustment');
      const direction = cleanLower(movement.direction || 'neutral');

      if (direction === 'in') cashIn += amount;
      if (direction === 'out') cashOut += amount;
      if (type === 'expense') operatingExpenses += amount;
      if (type === 'withdrawal') withdrawals += amount;

      addGroupedAmount(byType, type, amount);
    }
  }

  return {
    cashIn: money(cashIn),
    cashOut: money(cashOut),
    operatingExpenses: money(operatingExpenses),
    withdrawals: money(withdrawals),
    byType: mapToBreakdown(byType, cashIn + cashOut),
  };
}

async function getCashSessions(query = {}) {
  const dateRange = resolveDateRange(query);
  const branchFilter = buildBranchFilter(query);

  return CashSession.find({
    ...branchFilter,
    openedAt: { $lte: dateRange.to },
    $or: [
      { closedAt: { $gte: dateRange.from } },
      { closedAt: null },
      { openedAt: { $gte: dateRange.from, $lte: dateRange.to } },
    ],
  })
    .sort({ openedAt: -1 })
    .lean();
}

function summarizeCashSessions(sessions = []) {
  let openingAmount = 0;
  let expectedCash = 0;
  let countedCash = 0;
  let differenceAmount = 0;
  let grossSales = 0;
  let netSales = 0;

  const statusMap = new Map();
  const paymentTotals = {
    cash: 0,
    transfer: 0,
    card: 0,
    mixed: 0,
    other: 0,
    total: 0,
  };

  for (const session of sessions) {
    openingAmount += money(session.openingAmount);
    expectedCash += money(session.expectedCash);
    countedCash += money(session.countedCash);
    differenceAmount += signedMoney(session.differenceAmount);
    grossSales += money(session.salesSummary?.grossSales);
    netSales += money(session.salesSummary?.netSales);

    const totals = session.salesSummary?.paymentTotals || {};
    for (const key of Object.keys(paymentTotals)) {
      paymentTotals[key] += money(totals[key]);
    }

    const status = cleanLower(session.status || 'unknown');
    statusMap.set(status, (statusMap.get(status) || 0) + 1);
  }

  return {
    sessionsCount: sessions.length,
    openSessions: statusMap.get('open') || 0,
    closedSessions: statusMap.get('closed') || 0,
    cancelledSessions: statusMap.get('cancelled') || 0,
    openingAmount: money(openingAmount),
    expectedCash: money(expectedCash),
    countedCash: money(countedCash),
    differenceAmount: signedMoney(differenceAmount),
    grossSales: money(grossSales),
    netSales: money(netSales),
    paymentTotals: Object.fromEntries(
      Object.entries(paymentTotals).map(([key, value]) => [key, money(value)])
    ),
    movements: getCashMovementTotals(sessions),
    sessions: sessions.slice(0, 30).map((session) => ({
      _id: String(session._id),
      sessionCode: session.sessionCode,
      status: session.status,
      branch: session.branch ? String(session.branch) : null,
      branchSnapshot: session.branchSnapshot || {},
      cashierSnapshot: session.cashierSnapshot || {},
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      expectedCash: money(session.expectedCash),
      countedCash: money(session.countedCash),
      differenceAmount: signedMoney(session.differenceAmount),
      netSales: money(session.salesSummary?.netSales),
    })),
  };
}

function buildExpenseFilter(query = {}) {
  const dateRange = resolveDateRange(query);
  const branchFilter = buildBranchFilter(query);
  const filter = {
    ...branchFilter,
    deletedAt: null,
    date: { $gte: dateRange.from, $lte: dateRange.to },
  };

  const status = cleanLower(query.status || '');
  if (status && status !== 'all') filter.status = status;
  else filter.status = { $ne: 'cancelled' };

  const type = cleanLower(query.type || '');
  if (type && type !== 'all') filter.type = type;

  const category = clean(query.category || '');
  if (category && category !== 'all') filter.category = new RegExp(escapeRegex(category), 'i');

  const q = clean(query.q || query.search || '');
  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    filter.$or = [
      { category: regex },
      { subcategory: regex },
      { description: regex },
      { vendor: regex },
      { invoiceNumber: regex },
      { reference: regex },
      { tags: regex },
    ];
  }

  return filter;
}

async function getManualExpensesTotal(query = {}) {
  const filter = buildExpenseFilter({ ...query, status: query.expenseStatus || 'all' });
  filter.status = { $nin: ['cancelled', 'draft'] };

  const rows = await FinanceExpense.aggregate([
    { $match: filter },
    { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  return {
    amount: money(rows[0]?.amount),
    count: Number(rows[0]?.count || 0),
  };
}

async function listExpenses(query = {}) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  const skip = (page - 1) * limit;
  const filter = buildExpenseFilter(query);

  const [total, data] = await Promise.all([
    FinanceExpense.countDocuments(filter),
    FinanceExpense.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const pageAmount = data.reduce((acc, item) => acc + money(item.amount), 0);

  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    pageAmount: money(pageAmount),
    data,
  };
}

async function createExpense(payload = {}, actor = {}) {
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error('El valor del gasto debe ser mayor a cero.');
    error.code = 'FINANCE_EXPENSE_AMOUNT_INVALID';
    error.status = 400;
    throw error;
  }

  const branchInfo = await resolveExpenseBranch(payload.branch || payload.branchId);
  const expense = new FinanceExpense({
    date: safeDate(payload.date) || new Date(),
    amount: payload.amount,
    type: payload.type,
    category: payload.category,
    subcategory: payload.subcategory,
    description: payload.description,
    vendor: payload.vendor,
    invoiceNumber: payload.invoiceNumber,
    reference: payload.reference,
    paymentMethod: payload.paymentMethod,
    status: payload.status || 'paid',
    source: 'manual',
    branch: branchInfo.branch,
    branchSnapshot: branchInfo.snapshot,
    tags: payload.tags,
    attachments: Array.isArray(payload.attachments) ? payload.attachments.slice(0, 8) : [],
    notes: payload.notes,
    createdBy: actor.adminUserId && isValidObjectId(actor.adminUserId) ? toObjectId(actor.adminUserId) : null,
    createdBySnapshot: actor.snapshot || {},
  });

  await expense.save();
  return expense.toSafeObject();
}

async function updateExpense(expenseId, payload = {}, actor = {}, scope = {}) {
  if (!isValidObjectId(expenseId)) {
    const error = new Error('ID de gasto inválido.');
    error.status = 400;
    throw error;
  }

  const expense = await FinanceExpense.findOne(
    buildExpenseResourceFilter(expenseId, scope)
  );
  if (!expense) {
    const error = new Error('Gasto no encontrado.');
    error.status = 404;
    throw error;
  }

  const editable = [
    'amount',
    'type',
    'category',
    'subcategory',
    'description',
    'vendor',
    'invoiceNumber',
    'reference',
    'paymentMethod',
    'status',
    'tags',
    'attachments',
    'notes',
  ];

  if (payload.amount !== undefined) {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      const error = new Error('El valor del gasto debe ser mayor a cero.');
      error.code = 'FINANCE_EXPENSE_AMOUNT_INVALID';
      error.status = 400;
      throw error;
    }
  }

  for (const field of editable) {
    if (payload[field] !== undefined) expense[field] = payload[field];
  }

  if (payload.date !== undefined) expense.date = safeDate(payload.date) || expense.date;
  if (payload.branch !== undefined || payload.branchId !== undefined) {
    const branchInfo = await resolveExpenseBranch(payload.branch || payload.branchId);
    expense.branch = branchInfo.branch;
    expense.branchSnapshot = branchInfo.snapshot;
  }

  expense.updatedBy = actor.adminUserId && isValidObjectId(actor.adminUserId) ? toObjectId(actor.adminUserId) : null;

  await expense.save();
  return expense.toSafeObject();
}

async function cancelExpense(expenseId, actor = {}, scope = {}) {
  if (!isValidObjectId(expenseId)) {
    const error = new Error('ID de gasto inválido.');
    error.status = 400;
    throw error;
  }

  const expense = await FinanceExpense.findOne(
    buildExpenseResourceFilter(expenseId, scope)
  );
  if (!expense) {
    const error = new Error('Gasto no encontrado.');
    error.status = 404;
    throw error;
  }

  expense.status = 'cancelled';
  expense.deletedAt = new Date();
  expense.deletedBy = actor.adminUserId && isValidObjectId(actor.adminUserId) ? toObjectId(actor.adminUserId) : null;
  await expense.save();

  return expense.toSafeObject();
}

async function getSalesReport(query = {}) {
  const dateRange = resolveDateRange(query);
  const orders = await getPaidOrders(query);
  const correctionContext = await loadFinancialCorrectionContext(query, orders);
  const summary = applySalesCorrections(
    summarizeSalesFromOrders(orders),
    correctionContext
  );

  return {
    dateRange,
    ...summary,
    recentOrders: orders.slice(0, 20).map((order) => ({
      _id: String(order._id),
      orderNumber: order.orderNumber,
      source: order.source,
      channel: order.channel,
      saleType: order.saleType,
      status: order.status,
      paymentStatus: order.payment?.status || '',
      grossTotal: getOrderAmount(order),
      refundedAmount: money(
        correctionContext.correctionsByOrder.get(String(order._id))?.amount
      ),
      total: signedMoney(
        getOrderAmount(order) -
          money(correctionContext.correctionsByOrder.get(String(order._id))?.amount)
      ),
      createdAt: getOrderFinancialDate(order),
      branchSnapshot: order.branchSnapshot || {},
    })),
  };
}

async function getProfitReport(query = {}) {
  const dateRange = resolveDateRange(query);
  const orders = await getPaidOrders(query);
  const correctionContext = await loadFinancialCorrectionContext(query, orders);
  const profit = await summarizeProfitFromOrders(orders, correctionContext);

  return {
    dateRange,
    ...profit,
  };
}

async function getCashReport(query = {}) {
  const dateRange = resolveDateRange(query);
  const sessions = await getCashSessions(query);
  const summary = summarizeCashSessions(sessions);

  return {
    dateRange,
    ...summary,
  };
}

async function getExpensesReport(query = {}) {
  const dateRange = resolveDateRange(query);
  const list = await listExpenses(query);
  const manualTotals = await getManualExpensesTotal(query);

  return {
    dateRange,
    manualTotal: manualTotals.amount,
    manualCount: manualTotals.count,
    ...list,
  };
}

async function getFinanceSummary(query = {}) {
  const dateRange = resolveDateRange(query);
  const [sales, profit, cash, expenses] = await Promise.all([
    getSalesReport(query),
    getProfitReport(query),
    getCashReport(query),
    getExpensesReport({ ...query, limit: 10 }),
  ]);

  const cashOperatingExpenses = money(cash.movements?.operatingExpenses);
  const manualExpenses = money(expenses.manualTotal);
  const operatingExpenses = manualExpenses + cashOperatingExpenses;
  const netProfit = signedMoney(profit.grossProfit - operatingExpenses);

  return {
    dateRange,
    kpis: {
      revenue: sales.revenue,
      grossRevenue: sales.grossRevenue,
      refunds: sales.refunds,
      refundedOrdersCount: sales.refundedOrdersCount,
      ordersCount: sales.ordersCount,
      averageTicket: sales.averageTicket,
      cogs: profit.cogs,
      grossCogs: profit.grossCogs,
      returnedCogs: profit.returnedCogs,
      grossProfit: profit.grossProfit,
      grossMarginPercent: profit.grossMarginPercent,
      operatingExpenses: money(operatingExpenses),
      manualExpenses,
      cashOperatingExpenses,
      netProfit,
      netMarginPercent: pct(netProfit, sales.revenue),
      cashDifference: cash.differenceAmount,
      costQuality: profit.costQuality,
    },
    sales: {
      bySource: sales.bySource,
      byChannel: sales.byChannel,
      byPaymentMethod: sales.byPaymentMethod,
      daily: sales.daily,
    },
    profit: {
      byProduct: profit.byProduct.slice(0, 10),
      bySource: profit.bySource,
    },
    cash: {
      sessionsCount: cash.sessionsCount,
      openSessions: cash.openSessions,
      closedSessions: cash.closedSessions,
      expectedCash: cash.expectedCash,
      countedCash: cash.countedCash,
      differenceAmount: cash.differenceAmount,
      paymentTotals: cash.paymentTotals,
      movements: cash.movements,
    },
    expenses: {
      manualTotal: expenses.manualTotal,
      manualCount: expenses.manualCount,
      latest: expenses.data,
    },
  };
}

function buildCsv(rows = [], headers = []) {
  const escape = (value) => JSON.stringify(value ?? '');
  return [
    headers.map((header) => escape(header.label)).join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header.key])).join(',')),
  ].join('\n');
}

async function buildFinanceCsv(type = 'sales', query = {}) {
  const cleanType = cleanLower(type || 'sales');

  if (cleanType === 'expenses') {
    const result = await listExpenses({ ...query, limit: 1000 });
    return buildCsv(result.data, [
      { key: 'date', label: 'Fecha' },
      { key: 'amount', label: 'Valor' },
      { key: 'type', label: 'Tipo' },
      { key: 'category', label: 'Categoria' },
      { key: 'paymentMethod', label: 'Metodo de pago' },
      { key: 'status', label: 'Estado' },
      { key: 'description', label: 'Descripcion' },
      { key: 'reference', label: 'Referencia' },
    ]);
  }

  const sales = await getSalesReport(query);
  return buildCsv(sales.recentOrders, [
    { key: 'createdAt', label: 'Fecha' },
    { key: 'orderNumber', label: 'Orden' },
    { key: 'source', label: 'Origen' },
    { key: 'channel', label: 'Canal' },
    { key: 'saleType', label: 'Tipo venta' },
    { key: 'paymentStatus', label: 'Pago' },
    { key: 'total', label: 'Total' },
  ]);
}

module.exports = {
  resolveDateRange,
  getFinanceSummary,
  getSalesReport,
  getProfitReport,
  getCashReport,
  getExpensesReport,
  listExpenses,
  createExpense,
  updateExpense,
  cancelExpense,
  buildFinanceCsv,
  __test: {
    applySalesCorrections,
    buildPaidOrdersFilter,
    financeCostKey,
    getOrderFinancialDate,
    getOrderPaymentParts,
    resolveItemCost,
    summarizeSalesFromOrders,
  },
};
