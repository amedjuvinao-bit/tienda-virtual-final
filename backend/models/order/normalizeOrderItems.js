const mongoose = require('mongoose');

const {
  applyCanonicalVariantIdentity,
  cleanLower,
  cleanMoney,
  cleanText,
  normalizeAttributes,
  toNum,
} = require('./normalizers');

function createMissingItemsError(order) {
  const error = new mongoose.Error.ValidationError(order);
  error.addError(
    'items',
    new mongoose.Error.ValidatorError({
      path: 'items',
      message: 'La orden debe contener al menos un ítem.',
    })
  );
  return error;
}

function populateItemsFromCart(order) {
  if (order.items.length > 0 || order.cart.length === 0) return;

  order.items = order.cart
    .map((item) => {
      const quantity = Math.max(1, Math.floor(Number(item?.quantity || 0)));
      const price = Math.max(0, Number(item?.price || 0));
      if (!item?.title || quantity <= 0) return null;
      return {
        productId: item?.productId,
        title: String(item.title),
        image: item?.image,
        color: item?.color,
        colorLabel: item?.colorLabel || item?.color || '',
        size: item?.size,
        variantId: item?.variantId || item?.variantKey || '',
        variantKey: item?.variantKey || item?.variantId || '',
        variantLabel: item?.variantLabel || '',
        variantAttributes: normalizeAttributes(item?.variantAttributes || []),
        quantity,
        qty: quantity,
        price,
        unitPrice: price,
        priceNumber: price,
      };
    })
    .filter(Boolean);
}

function normalizeDiscount(order) {
  if (!order.discount || typeof order.discount !== 'object') {
    order.discount = {
      type: 'none',
      value: 0,
      amount: 0,
      reason: '',
      authorizedBy: null,
      authorizedBySnapshot: {
        username: '',
        displayName: '',
        role: '',
        adminRole: '',
      },
    };
    return;
  }

  const safeDiscountType = cleanLower(order.discount.type || 'none');
  order.discount.type = ['none', 'percent', 'amount'].includes(safeDiscountType)
    ? safeDiscountType
    : 'none';
  order.discount.value = cleanMoney(order.discount.value);
  order.discount.amount = cleanMoney(order.discount.amount);
  order.discount.reason = cleanText(order.discount.reason);

  if (
    !order.discount.authorizedBySnapshot ||
    typeof order.discount.authorizedBySnapshot !== 'object'
  ) {
    order.discount.authorizedBySnapshot = {
      username: '',
      displayName: '',
      role: '',
      adminRole: '',
    };
    return;
  }

  order.discount.authorizedBySnapshot.username = cleanLower(
    order.discount.authorizedBySnapshot.username
  );
  order.discount.authorizedBySnapshot.displayName = cleanText(
    order.discount.authorizedBySnapshot.displayName
  );
  order.discount.authorizedBySnapshot.role = cleanLower(
    order.discount.authorizedBySnapshot.role
  );
  order.discount.authorizedBySnapshot.adminRole = cleanLower(
    order.discount.authorizedBySnapshot.adminRole
  );
}

function normalizeOrderItems(order) {
  populateItemsFromCart(order);

  order.cart.forEach(applyCanonicalVariantIdentity);
  order.items.forEach(applyCanonicalVariantIdentity);
  if (Array.isArray(order.inventoryAllocations)) {
    order.inventoryAllocations.forEach(applyCanonicalVariantIdentity);
  }

  if (!Array.isArray(order.items) || order.items.length === 0) {
    return createMissingItemsError(order);
  }

  const totalItems = order.items.reduce(
    (total, item) => total + toNum(item.quantity ?? item.qty, 0),
    0
  );
  const subtotalCalculated = order.items.reduce(
    (total, item) =>
      total +
      toNum(item.price ?? item.unitPrice ?? item.priceNumber, 0) *
        toNum(item.quantity ?? item.qty, 0),
    0
  );

  if (!order.summary || typeof order.summary !== 'object') {
    order.summary = {
      itemsCount: order.items.length,
      totalItems,
      subtotal: subtotalCalculated,
    };
  } else {
    if (typeof order.summary.itemsCount !== 'number') {
      order.summary.itemsCount = order.items.length;
    }
    if (typeof order.summary.totalItems !== 'number') {
      order.summary.totalItems = totalItems;
    }
    if (typeof order.summary.subtotal !== 'number') {
      order.summary.subtotal = subtotalCalculated;
    }
  }

  normalizeDiscount(order);

  if (typeof order.subtotal !== 'number') {
    order.subtotal = subtotalCalculated;
  }
  if (typeof order.shipping !== 'number') {
    order.shipping = toNum(order.shipping, 0);
  }
  if (typeof order.total !== 'number') {
    order.total = Math.max(
      0,
      subtotalCalculated - toNum(order.discount?.amount, 0) + order.shipping
    );
  }

  return null;
}

module.exports = { normalizeOrderItems };
