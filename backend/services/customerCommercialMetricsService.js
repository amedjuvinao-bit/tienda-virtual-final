'use strict';

const mongoose = require('mongoose');

const Order = require('../models/Order');
const { buildScopedOrderFilter } = require('./orderAdminScopeService');

const CONFIRMED_ORDER_STATUSES = Object.freeze([
  'paid',
  'shipped',
  'delivered',
  'refunded',
]);

function money(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

function emptyCustomerCommercialMetrics() {
  return {
    ordersCount: 0,
    posOrdersCount: 0,
    webOrdersCount: 0,
    grossSales: 0,
    refundedAmount: 0,
    netSpent: 0,
    totalSpent: 0,
    averageTicket: 0,
    purchaseFrequencyDays: null,
    purchasesPerYear: 0,
    lifetimeValue: 0,
    returnOrdersCount: 0,
    returnRate: 0,
    firstPurchaseAt: null,
    lastPurchaseAt: null,
    lastOrder: null,
    lastOrderNumber: '',
  };
}

function buildConfirmedCustomerOrderFilter(customerIds = []) {
  const ids = (Array.isArray(customerIds) ? customerIds : [])
    .map(String)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  return {
    'customer.customerId': ids.length ? { $in: ids } : { $ne: null },
    $or: [
      { 'payment.status': 'paid' },
      { status: { $in: [...CONFIRMED_ORDER_STATUSES] } },
    ],
  };
}

function deriveMetrics(row = {}) {
  const ordersCount = Math.max(0, Number(row.ordersCount || 0));
  const grossSales = money(row.grossSales);
  const refundedAmount = Math.min(grossSales, money(row.refundedAmount));
  const netSpent = money(grossSales - refundedAmount);
  const first = row.firstPurchaseAt ? new Date(row.firstPurchaseAt) : null;
  const last = row.lastPurchaseAt ? new Date(row.lastPurchaseAt) : null;
  const activeDays = first && last
    ? Math.max(0, (last.getTime() - first.getTime()) / 86400000)
    : 0;
  const purchaseFrequencyDays = ordersCount > 1
    ? Math.round((activeDays / (ordersCount - 1)) * 10) / 10
    : null;
  const purchasesPerYear = purchaseFrequencyDays && purchaseFrequencyDays > 0
    ? Math.round((365 / purchaseFrequencyDays) * 10) / 10
    : ordersCount === 1
      ? 1
      : 0;
  const returnOrdersCount = Math.max(0, Number(row.returnOrdersCount || 0));

  return {
    ordersCount,
    posOrdersCount: Math.max(0, Number(row.posOrdersCount || 0)),
    webOrdersCount: Math.max(0, Number(row.webOrdersCount || 0)),
    grossSales,
    refundedAmount,
    netSpent,
    totalSpent: netSpent,
    averageTicket: ordersCount ? money(netSpent / ordersCount) : 0,
    purchaseFrequencyDays,
    purchasesPerYear,
    lifetimeValue: netSpent,
    returnOrdersCount,
    returnRate: ordersCount
      ? Math.round((returnOrdersCount / ordersCount) * 1000) / 10
      : 0,
    firstPurchaseAt: row.firstPurchaseAt || null,
    lastPurchaseAt: row.lastPurchaseAt || null,
    lastOrder: row.lastOrder || null,
    lastOrderNumber: row.lastOrderNumber || '',
  };
}

async function loadCustomerCommercialMetrics(req, customerIds = []) {
  const ids = (Array.isArray(customerIds) ? customerIds : [])
    .map(String)
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return new Map();

  const access = buildScopedOrderFilter(
    req,
    buildConfirmedCustomerOrderFilter(ids),
    {
      requestedBranchId: req.query?.branchId || '',
      requireWholeOrder: true,
    }
  );
  if (!access.ok) {
    const error = new Error(
      access.message || 'No tienes acceso a las métricas comerciales de esa sede.'
    );
    error.code = access.error || 'CUSTOMER_METRICS_BRANCH_FORBIDDEN';
    error.statusCode = access.status || 403;
    throw error;
  }

  const rows = await Order.aggregate([
    { $match: access.filter },
    { $sort: { createdAt: 1, _id: 1 } },
    {
      $group: {
        _id: '$customer.customerId',
        ordersCount: { $sum: 1 },
        posOrdersCount: {
          $sum: { $cond: [{ $eq: ['$source', 'pos'] }, 1, 0] },
        },
        webOrdersCount: {
          $sum: { $cond: [{ $eq: ['$source', 'pos'] }, 0, 1] },
        },
        grossSales: { $sum: { $ifNull: ['$total', 0] } },
        refundedAmount: {
          $sum: { $ifNull: ['$refundControl.totalAmount', 0] },
        },
        returnOrdersCount: {
          $sum: {
            $cond: [
              { $gt: [{ $ifNull: ['$returnControl.requestCount', 0] }, 0] },
              1,
              0,
            ],
          },
        },
        firstPurchaseAt: {
          $first: { $ifNull: ['$payment.paidAt', '$createdAt'] },
        },
        lastPurchaseAt: {
          $last: { $ifNull: ['$payment.paidAt', '$createdAt'] },
        },
        lastOrder: { $last: '$_id' },
        lastOrderNumber: { $last: '$orderNumber' },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [String(row._id), deriveMetrics(row)])
  );
}

module.exports = {
  CONFIRMED_ORDER_STATUSES,
  buildConfirmedCustomerOrderFilter,
  deriveMetrics,
  emptyCustomerCommercialMetrics,
  loadCustomerCommercialMetrics,
};
