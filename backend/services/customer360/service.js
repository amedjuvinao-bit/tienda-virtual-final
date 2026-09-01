'use strict';

const requirePermission = require('../../middleware/requirePermission');
const { buildCustomerOrdersFilter } = require('../customerOrderIdentityFilter');
const {
  buildScopedOrderFilter,
  canAdminSeeAllBranches,
} = require('../orderAdminScopeService');
const { createCustomer360MongoRepository } = require('./repository');
const {
  buildActivity,
  buildSummary,
  serializeAttempt,
  serializeCart,
  serializeInvoice,
  serializeOrder,
  serializePayment,
  serializeRefund,
  serializeReturn,
  serializeShipments,
  serializeStoreCredit,
  serializeStoreCreditUsage,
} = require('./presentation');

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function escapeRegex(value) {
  return cleanText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function boundedLimit(value, fallback = DEFAULT_LIMIT) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(Math.floor(number), MAX_LIMIT);
}

function createCustomer360Error(message, code, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

async function resolveCustomer360Access(
  req,
  permissionChecker = requirePermission.hasEffectivePermission
) {
  const [orders, payments, billing, carts] = await Promise.all([
    permissionChecker(req, 'orders:view'),
    permissionChecker(req, 'payments:view'),
    permissionChecker(req, 'billing:view'),
    permissionChecker(req, 'carts:view'),
  ]);

  return {
    orders,
    payments: orders && payments,
    billing: orders && billing,
    returns: orders,
    shipping: orders,
    carts,
    storeCredit: orders,
    activity: orders || payments || billing || carts,
  };
}

function buildCartFilter({ req, customer = {}, orderIds = [], sessionIds = [] }) {
  const raw = typeof customer?.toObject === 'function'
    ? customer.toObject()
    : customer;
  const clauses = [];

  if (orderIds.length) {
    clauses.push({ convertedOrderId: { $in: orderIds } });
  }
  if (sessionIds.length) {
    clauses.push({ sessionId: { $in: sessionIds } });
  }

  if (canAdminSeeAllBranches(req)) {
    const customerId = cleanText(raw._id || raw.id);
    const customerCode = cleanText(raw.customerCode);
    const email = cleanText(raw.normalizedEmail || raw.email).toLowerCase();

    if (customerId) clauses.push({ userId: customerId });
    if (customerCode) clauses.push({ userId: customerCode });
    if (email) {
      clauses.push({
        userEmail: new RegExp(`^${escapeRegex(email)}$`, 'i'),
      });
    }
  }

  return clauses.length ? { $or: clauses } : { _id: null };
}

function emptyResult(access = {}) {
  return {
    access,
    coverage: {
      orderLimit: DEFAULT_LIMIT,
      totalOrders: 0,
      loadedOrders: 0,
      truncated: false,
    },
    summary: buildSummary(),
    orders: [],
    payments: [],
    paymentAttempts: [],
    invoices: [],
    returns: [],
    refunds: [],
    shipments: [],
    carts: [],
    storeCredits: [],
    storeCreditUsages: [],
    activity: [],
  };
}

function redactOrderForAccess(order = {}, access = {}) {
  const visible = { ...order };
  if (!access.payments) delete visible.payment;
  if (!access.storeCredit) delete visible.storeCredit;
  if (!access.returns) {
    delete visible.refund;
    delete visible.returns;
  }
  if (!access.shipping) delete visible.logistics;
  return visible;
}

async function loadCustomer360({
  req,
  customer,
  repository = createCustomer360MongoRepository(),
  permissionChecker = requirePermission.hasEffectivePermission,
  orderLimit = DEFAULT_LIMIT,
} = {}) {
  if (!req || !customer) {
    throw createCustomer360Error(
      'No fue posible determinar el cliente y el alcance administrativo.',
      'CUSTOMER_360_CONTEXT_REQUIRED',
      500
    );
  }

  const access = await resolveCustomer360Access(req, permissionChecker);
  const result = emptyResult(access);
  const limit = boundedLimit(orderLimit);
  result.coverage.orderLimit = limit;

  let rawOrders = [];
  let totalOrders = 0;

  if (access.orders) {
    const orderAccess = buildScopedOrderFilter(
      req,
      buildCustomerOrdersFilter(customer),
      {
        requestedBranchId: req.query?.branchId || '',
        requireWholeOrder: true,
      }
    );

    if (!orderAccess.ok) {
      throw createCustomer360Error(
        orderAccess.message || 'No tienes acceso a las órdenes de este cliente.',
        orderAccess.error || 'CUSTOMER_360_ORDER_SCOPE_FORBIDDEN',
        orderAccess.status || 403,
        { branchIds: orderAccess.branchIds || [] }
      );
    }

    [rawOrders, totalOrders] = await Promise.all([
      repository.findOrders(orderAccess.filter, limit),
      repository.countOrders(orderAccess.filter),
    ]);
  }

  const orderIds = rawOrders
    .map((order) => order?._id || order?.id)
    .filter(Boolean);
  const sessionIds = [...new Set(
    rawOrders.map((order) => cleanText(order?.sessionId)).filter(Boolean)
  )];
  const customerId = customer?._id || customer?.id;
  const orderFilter = orderIds.length
    ? { order: { $in: orderIds } }
    : { _id: null };

  const [
    rawAttempts,
    rawInvoices,
    rawReturns,
    rawRefunds,
    rawShippingOperations,
    rawCarts,
    rawStoreCredits,
    rawStoreCreditUsages,
  ] = await Promise.all([
    access.payments
      ? repository.findPaymentAttempts(orderFilter, limit)
      : [],
    access.billing
      ? repository.findInvoices(
          orderIds.length ? { orderId: { $in: orderIds } } : { _id: null },
          limit
        )
      : [],
    access.returns
      ? repository.findReturns(orderFilter, limit)
      : [],
    access.returns
      ? repository.findRefunds(orderFilter, limit)
      : [],
    access.shipping
      ? repository.findShippingOperations(orderFilter, limit)
      : [],
    access.carts
      ? repository.findCarts(
          buildCartFilter({ req, customer, orderIds, sessionIds }),
          limit
        )
      : [],
    access.storeCredit && customerId && orderIds.length
      ? repository.findStoreCredits(
          {
            customer: customerId,
            sourceOrder: { $in: orderIds },
          },
          limit
        )
      : [],
    access.storeCredit && customerId && orderIds.length
      ? repository.findStoreCreditUsages(
          {
            customer: customerId,
            order: { $in: orderIds },
          },
          limit
        )
      : [],
  ]);

  const completeOrders = rawOrders.map(serializeOrder);
  const orders = completeOrders.map((order) =>
    redactOrderForAccess(order, access)
  );
  const attempts = rawAttempts.map(serializeAttempt);
  const attemptsByOrder = attempts.reduce((map, attempt) => {
    const current = map.get(attempt.orderId) || [];
    current.push(attempt);
    map.set(attempt.orderId, current);
    return map;
  }, new Map());
  const payments = access.payments
    ? rawOrders.map((order) => {
        const orderId = cleanText(order?._id || order?.id);
        return serializePayment(order, attemptsByOrder.get(orderId) || []);
      })
    : [];
  const invoices = rawInvoices.map(serializeInvoice);
  const returns = rawReturns.map(serializeReturn);
  const refunds = rawRefunds.map(serializeRefund);
  const shipments = serializeShipments(rawOrders, rawShippingOperations);
  const carts = rawCarts.map(serializeCart);
  if (!access.orders) {
    carts.forEach((cart) => {
      delete cart.convertedOrderId;
    });
  }
  const storeCredits = rawStoreCredits.map(serializeStoreCredit);
  const storeCreditUsages = rawStoreCreditUsages.map(
    serializeStoreCreditUsage
  );

  const summary = buildSummary({
    orders: completeOrders,
    attempts,
    invoices,
    returns,
    refunds,
    shipments,
    carts,
    storeCredits,
    storeCreditUsages,
    totalOrders,
  });
  if (!access.orders) summary.commercial = null;
  if (!access.payments) summary.payments = null;
  if (!access.billing) summary.billing = null;
  if (!access.returns) summary.returns = null;
  if (!access.shipping) summary.shipping = null;
  if (!access.carts) summary.carts = null;
  if (!access.storeCredit) summary.storeCredit = null;
  const activity = buildActivity({
    orders,
    attempts,
    invoices,
    returns,
    refunds,
    shipments,
    carts,
    storeCredits,
    storeCreditUsages,
  });

  return {
    access,
    coverage: {
      orderLimit: limit,
      totalOrders,
      loadedOrders: orders.length,
      truncated: totalOrders > orders.length,
    },
    summary,
    orders,
    payments,
    paymentAttempts: attempts,
    invoices,
    returns,
    refunds,
    shipments,
    carts,
    storeCredits,
    storeCreditUsages,
    activity,
  };
}

module.exports = {
  MAX_LIMIT,
  buildCartFilter,
  boundedLimit,
  loadCustomer360,
  resolveCustomer360Access,
};
