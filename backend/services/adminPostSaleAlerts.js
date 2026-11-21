'use strict';

const Order = require('../models/Order');
const OrderReturn = require('../models/OrderReturn');
const OrderRefund = require('../models/OrderRefund');
const { buildScopedOrderFilter } = require('./orderAdminScopeService');
const { FINANCIAL_ORDER_ACCESS } = require('./orderRouteAccessService');

async function findScopedAlerts(model, filter, scope, numberField) {
  if (!scope.ok) return [];
  return model.aggregate([
    { $match: filter },
    { $sort: { createdAt: -1, _id: -1 } },
    { $project: { order: 1, [numberField]: 1, orderNumber: 1 } },
    {
      $lookup: {
        from: Order.collection.name,
        localField: 'order',
        foreignField: '_id',
        pipeline: [{ $match: scope.filter }, { $project: { _id: 1 } }],
        as: 'visibleOrder',
      },
    },
    { $match: { 'visibleOrder.0': { $exists: true } } },
    { $limit: 8 },
    { $project: { visibleOrder: 0 } },
  ]);
}

async function getPostSaleAlerts(req) {
  const [returns, refunds] = await Promise.all([
    findScopedAlerts(
      OrderReturn,
      { status: { $in: ['requested', 'received', 'resolution_required'] } },
      buildScopedOrderFilter(req, {}, { requireWholeOrder: true }),
      'returnNumber',
    ),
    findScopedAlerts(
      OrderRefund,
      { $or: [
        { status: 'failed' },
        { 'reconciliation.state': { $in: ['action_required', 'failed'] } },
      ] },
      buildScopedOrderFilter(req, {}, FINANCIAL_ORDER_ACCESS),
      'refundNumber',
    ),
  ]);
  return { returns, refunds };
}

module.exports = { getPostSaleAlerts };
