const {
  ORDER_CHANNELS,
  ORDER_FULFILLMENT_STATUSES,
  ORDER_SALE_TYPES,
  ORDER_SOURCES,
} = require('./constants');
const { cleanLower, cleanText, cleanUpper } = require('./normalizers');

function normalizeAdminSnapshot(snapshot) {
  snapshot.username = cleanLower(snapshot.username);
  snapshot.displayName = cleanText(snapshot.displayName);
  snapshot.role = cleanLower(snapshot.role);
  snapshot.adminRole = cleanLower(snapshot.adminRole);
}

function normalizeOrderIdentity(order) {
  if (!Array.isArray(order.items)) order.items = [];
  if (!Array.isArray(order.cart)) order.cart = [];

  order.source = cleanLower(order.source || 'online');
  if (!ORDER_SOURCES.includes(order.source)) {
    order.source = 'online';
  }

  order.channel = cleanLower(order.channel || '');
  if (!ORDER_CHANNELS.includes(order.channel)) {
    order.channel = order.source === 'pos' ? 'physical_store' : 'web';
  }

  order.saleType = cleanLower(order.saleType || '');
  if (!ORDER_SALE_TYPES.includes(order.saleType)) {
    if (order.source === 'pos') order.saleType = 'pos_sale';
    else if (order.source === 'manual' || order.source === 'admin') {
      order.saleType = 'manual_order';
    } else if (order.source === 'import') order.saleType = 'imported_order';
    else if (order.source === 'system') order.saleType = 'system_order';
    else order.saleType = 'online_order';
  }

  if (order.source === 'pos') {
    order.channel = 'physical_store';
    order.saleType = 'pos_sale';
    if (!order.fulfillmentStatus || order.fulfillmentStatus === 'pending') {
      order.fulfillmentStatus = 'delivered';
    }
    if (typeof order.shipping !== 'number') {
      order.shipping = 0;
    }
  }

  order.fulfillmentStatus = cleanLower(order.fulfillmentStatus || 'pending');
  if (!ORDER_FULFILLMENT_STATUSES.includes(order.fulfillmentStatus)) {
    order.fulfillmentStatus = order.source === 'pos' ? 'delivered' : 'pending';
  }

  if (!order.branchSnapshot || typeof order.branchSnapshot !== 'object') {
    order.branchSnapshot = {
      name: '',
      code: '',
      type: '',
    };
  } else {
    order.branchSnapshot.name = cleanText(order.branchSnapshot.name);
    order.branchSnapshot.code = cleanUpper(order.branchSnapshot.code);
    order.branchSnapshot.type = cleanLower(order.branchSnapshot.type);
  }

  if (
    !order.createdByAdminSnapshot ||
    typeof order.createdByAdminSnapshot !== 'object'
  ) {
    order.createdByAdminSnapshot = {
      username: '',
      displayName: '',
      role: '',
      adminRole: '',
    };
  } else {
    normalizeAdminSnapshot(order.createdByAdminSnapshot);
  }

  if (!order.cashierSnapshot || typeof order.cashierSnapshot !== 'object') {
    order.cashierSnapshot = {
      username: '',
      displayName: '',
      role: '',
      adminRole: '',
    };
  } else {
    normalizeAdminSnapshot(order.cashierSnapshot);
  }
}

module.exports = { normalizeOrderIdentity };
