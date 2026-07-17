// backend/services/adminFinanceService.js
const mongoose = require('mongoose');

const Order = require('../models/Order');
const Product = require('../models/Product');
const CashSession = require('../models/CashSession');
const FinanceExpense = require('../models/FinanceExpense');
const { resolveVariantCommercialSnapshot } = require('../lib/products/productVariantConfig');

const CANCELLED_ORDER_STATUSES = ['cancelled', 'canceled', 'failed', 'refunded'];
const CASH_OUT_TYPES = ['expense', 'withdrawal', 'cash_out'];

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

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveDateRange(query = {}) {
  const now = new Date();
  const range = cleanLower(query.range || 'this_month');

  let from;
  let to;

  if (range === 'today') {
    from = startOfDay(now);
    to = endOfDay(now);
  } else if (range === 'yesterday') {
    const y = addDays(now, -1);
    from = startOfDay(y);
    to = endOfDay(y);
  } else if (range === 'last_7_days') {
    from = startOfDay(addDays(now, -6));
    to = endOfDay(now);
  } else if (range === 'this_week') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    from = startOfDay(addDays(now, -diff));
    to = endOfDay(now);
  } else if (range === 'previous_month') {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    from = startOfMonth(prev);
    to = endOfMonth(prev);
  } else if (range === 'this_year') {
    from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    to = endOfDay(now);
  } else {
    from = startOfMonth(now);
    to = endOfDay(now);
  }

  const customFrom = safeDate(query.dateFrom || query.from || query.startDate);
  const customTo = safeDate(query.dateTo || query.to || query.endDate);

  if (customFrom) from = startOfDay(customFrom);
  if (customTo) to = endOfDay(customTo);

  return {
    range,
    from,
    to,
    fromISO: from.toISOString(),
    toISO: to.toISOString(),
  };
}

function buildBranchFilter(query = {}) {
  const branchId = query.branchId || query.branch || '';
  const branch = toObjectId(branchId);
  return branch ? { branch } : {};
}

function buildPaidOrdersFilter(query = {}) {
  const dateRange = resolveDateRange(query);
  const branchFilter = buildBranchFilter(query);

  return {
    ...branchFilter,
    createdAt: { $gte: dateRange.from, $lte: dateRange.to },
    status: { $nin: CANCELLED_ORDER_STATUSES },
    $or: [
      { 'payment.status': 'paid' },
      { status: 'paid' },
      { source: 'pos', saleType: 'pos_sale' },
    ],
  };
}

function getOrderAmount(order = {}) {
  const total = money(order.total);
  if (total > 0) return total;
  const paymentAmount = money(order.payment?.amount);
  if (paymentAmount > 0) return paymentAmount;
  return Math.max(0, money(order.subtotal) + money(order.shipping) - money(order.discount?.amount));
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
  const raw = item.product || item.productId || item._id || '';
  if (raw && typeof raw === 'object') return String(raw._id || raw.id || '');
  return String(raw || '');
}

function getOrderItems(order = {}) {
  if (Array.isArray(order.items) && order.items.length) return order.items;
  if (Array.isArray(order.cart) && order.cart.length) return order.cart;
  return [];
}

function bucketKey(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function makeEmptyBucket(dateText) {
  return {
    date: dateText,
    orders: 0,
    revenue: 0,
    subtotal: 0,
    shipping: 0,
    discounts: 0,
    taxes: 0,
  };
}

function addToMapBucket(map, key, patch = {}) {
  if (!key) return;
  const current = map.get(key) || makeEmptyBucket(key);
  current.orders += Number(patch.orders || 0);
  current.revenue += money(patch.revenue);
  current.subtotal += money(patch.subtotal);
  current.shipping += money(patch.shipping);
  current.discounts += money(patch.discounts);
  current.taxes += money(patch.taxes);
  map.set(key, current);
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

async function loadProductMapFromOrders(orders = []) {
  const ids = [];
  const seen = new Set();

  for (const order of orders) {
    for (const item of getOrderItems(order)) {
      const id = getProductIdFromItem(item);
      if (!id || !isValidObjectId(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(toObjectId(id));
    }
  }

  if (!ids.length) return new Map();
  const products = await Product.find({ _id: { $in: ids } }).lean();
  return new Map(products.map((product) => [String(product._id), product]));
}

function resolveItemCost(product, item = {}) {
  if (!product) return 0;

  const snapshot = resolveVariantCommercialSnapshot(product, {
    variantKey: item.variantKey || item.variantId || '',
    size: item.size || '',
    color: item.color || '',
  });

  const resolvedCost = money(snapshot?.cost);
  if (resolvedCost > 0) return resolvedCost;

  return money(product.averageCost || product.cost || 0);
}

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
    const items = getOrderItems(order);
    const orderItemsCount = items.reduce((acc, item) => acc + getItemQty(item), 0);
    const paymentMethod = cleanLower(order.payment?.method || order.payment?.methodType || order.payment?.provider || 'sin_metodo');
    const dayKey = bucketKey(order.createdAt);

    revenue += amount;
    subtotal += orderSubtotal;
    shipping += orderShipping;
    discounts += orderDiscount;
    taxes += orderTaxes;
    itemsCount += orderItemsCount;

    addGroupedAmount(bySource, order.source || 'online', amount, { orders: 1, items: orderItemsCount });
    addGroupedAmount(byChannel, order.channel || 'web', amount, { orders: 1, items: orderItemsCount });
    addGroupedAmount(bySaleType, order.saleType || 'online_order', amount, { orders: 1, items: orderItemsCount });
    addGroupedAmount(byPaymentMethod, paymentMethod, amount, { orders: 1, items: orderItemsCount });
    addToMapBucket(byDay, dayKey, {
      orders: 1,
      revenue: amount,
      subtotal: orderSubtotal,
      shipping: orderShipping,
      discounts: orderDiscount,
      taxes: orderTaxes,
    });
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

async function summarizeProfitFromOrders(orders = []) {
  const productMap = await loadProductMapFromOrders(orders);
  const byProduct = new Map();
  const bySource = new Map();

  let revenue = 0;
  let cogs = 0;
  let itemsCount = 0;

  for (const order of orders) {
    const orderRevenue = getOrderAmount(order);
    revenue += orderRevenue;

    for (const item of getOrderItems(order)) {
      const qty = getItemQty(item);
      if (qty <= 0) continue;

      const productId = getProductIdFromItem(item);
      const product = productMap.get(String(productId));
      const unitCost = resolveItemCost(product, item);
      const unitPrice = getItemUnitPrice(item) || (qty ? orderRevenue / qty : 0);
      const itemRevenue = money(unitPrice * qty);
      const itemCost = money(unitCost * qty);
      const title = clean(item.title || product?.title || 'Producto sin nombre');

      cogs += itemCost;
      itemsCount += qty;

      const productKey = productId || title;
      const currentProduct = byProduct.get(productKey) || {
        productId: productId || '',
        title,
        qty: 0,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
      };
      currentProduct.qty += qty;
      currentProduct.revenue += itemRevenue;
      currentProduct.cogs += itemCost;
      currentProduct.grossProfit = currentProduct.revenue - currentProduct.cogs;
      byProduct.set(productKey, currentProduct);
    }

    addGroupedAmount(bySource, order.source || 'online', orderRevenue, { orders: 1 });
  }

  const grossProfit = revenue - cogs;

  return {
    ordersCount: orders.length,
    itemsCount,
    revenue: money(revenue),
    cogs: money(cogs),
    grossProfit: signedMoney(grossProfit),
    grossMarginPercent: pct(grossProfit, revenue),
    bySource: mapToBreakdown(bySource, revenue),
    byProduct: Array.from(byProduct.values())
      .map((row) => ({
        ...row,
        revenue: money(row.revenue),
        cogs: money(row.cogs),
        grossProfit: signedMoney(row.grossProfit),
        grossMarginPercent: pct(row.grossProfit, row.revenue),
      }))
      .sort((a, b) => Number(b.grossProfit || 0) - Number(a.grossProfit || 0))
      .slice(0, 30),
  };
}

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

      addGroupedAmount(byType, type, amount, { orders: 0, items: 0 });
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
    paymentTotals: Object.fromEntries(Object.entries(paymentTotals).map(([key, value]) => [key, money(value)])),
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
  if (category && category !== 'all') filter.category = new RegExp(category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const q = clean(query.q || query.search || '');
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
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
    {
      $group: {
        _id: null,
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
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

  const amount = data.reduce((acc, item) => acc + money(item.amount), 0);

  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    pageAmount: money(amount),
    data,
  };
}

async function createExpense(payload = {}, actor = {}) {
  const branchId = toObjectId(payload.branch || payload.branchId);
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
    branch: branchId,
    branchSnapshot: payload.branchSnapshot || {},
    tags: payload.tags,
    attachments: Array.isArray(payload.attachments) ? payload.attachments.slice(0, 8) : [],
    notes: payload.notes,
    createdBy: actor.adminUserId && isValidObjectId(actor.adminUserId) ? toObjectId(actor.adminUserId) : null,
    createdBySnapshot: actor.snapshot || {},
  });

  await expense.save();
  return expense.toSafeObject();
}

async function updateExpense(expenseId, payload = {}, actor = {}) {
  if (!isValidObjectId(expenseId)) {
    const error = new Error('ID de gasto inválido.');
    error.status = 400;
    throw error;
  }

  const expense = await FinanceExpense.findOne({ _id: toObjectId(expenseId), deletedAt: null });
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

  for (const field of editable) {
    if (payload[field] !== undefined) expense[field] = payload[field];
  }

  if (payload.date !== undefined) expense.date = safeDate(payload.date) || expense.date;
  if (payload.branch !== undefined || payload.branchId !== undefined) {
    expense.branch = toObjectId(payload.branch || payload.branchId);
  }
  if (payload.branchSnapshot !== undefined) expense.branchSnapshot = payload.branchSnapshot || {};

  expense.updatedBy = actor.adminUserId && isValidObjectId(actor.adminUserId) ? toObjectId(actor.adminUserId) : null;

  await expense.save();
  return expense.toSafeObject();
}

async function cancelExpense(expenseId, actor = {}) {
  if (!isValidObjectId(expenseId)) {
    const error = new Error('ID de gasto inválido.');
    error.status = 400;
    throw error;
  }

  const expense = await FinanceExpense.findOne({ _id: toObjectId(expenseId), deletedAt: null });
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
  const summary = summarizeSalesFromOrders(orders);

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
      total: getOrderAmount(order),
      createdAt: order.createdAt,
      branchSnapshot: order.branchSnapshot || {},
    })),
  };
}

async function getProfitReport(query = {}) {
  const dateRange = resolveDateRange(query);
  const orders = await getPaidOrders(query);
  const profit = await summarizeProfitFromOrders(orders);

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
      ordersCount: sales.ordersCount,
      averageTicket: sales.averageTicket,
      cogs: profit.cogs,
      grossProfit: profit.grossProfit,
      grossMarginPercent: profit.grossMarginPercent,
      operatingExpenses: money(operatingExpenses),
      manualExpenses,
      cashOperatingExpenses,
      netProfit,
      netMarginPercent: pct(netProfit, sales.revenue),
      cashDifference: cash.differenceAmount,
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
};
