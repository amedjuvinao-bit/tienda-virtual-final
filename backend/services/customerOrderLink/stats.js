'use strict';

const Customer = require('../../models/Customer');
const {
  cleanLower,
  cleanText,
  isConfirmedOrder,
  isDemoOrder,
} = require('./normalization');
const { withSession } = require('./matching');

async function applyCustomerStatsForOrder(
  order,
  { session = null, CustomerModel = Customer } = {}
) {
  if (
    !order?._id ||
    !order?.customer?.customerId ||
    order?.customerRelationship?.statsAppliedAt ||
    isDemoOrder(order) ||
    !isConfirmedOrder(order)
  ) {
    return { applied: false };
  }

  const customerId = order.customer.customerId;
  const now = new Date();
  const source = cleanLower(order.source, 40) === 'pos' ? 'pos' : 'web';
  const customer = await withSession(
    CustomerModel.findOne({ _id: customerId, deletedAt: null }),
    session
  );
  if (!customer) return { applied: false, reason: 'customer_not_found' };

  const update = {
    $inc: {
      'stats.ordersCount': 1,
      [`stats.${source}OrdersCount`]: 1,
      'stats.totalSpent': Math.max(0, Number(order.total || 0)),
    },
    $set: {
      'stats.lastOrder': order._id,
      'stats.lastOrderNumber': cleanText(order.orderNumber, 80),
      'stats.lastPurchaseAt': order.payment?.paidAt || order.createdAt || now,
      'stats.firstPurchaseAt':
        customer.stats?.firstPurchaseAt ||
        order.payment?.paidAt ||
        order.createdAt ||
        now,
    },
  };

  await CustomerModel.updateOne({ _id: customerId }, update, { session });
  order.customerRelationship = {
    ...(order.customerRelationship?.toObject
      ? order.customerRelationship.toObject()
      : order.customerRelationship || {}),
    linkedAt: order.customerRelationship?.linkedAt || now,
    source,
    matchedBy: order.customerRelationship?.matchedBy || 'customer_id',
    statsAppliedAt: now,
  };
  await order.save({ session });

  return { applied: true, customerId: String(customerId) };
}

module.exports = {
  applyCustomerStatsForOrder,
};
