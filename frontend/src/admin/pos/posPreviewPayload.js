// frontend/src/admin/pos/posPreviewPayload.js

import {
  buildPosCommercialPayload,
  calculateCheckoutSummary,
  createInitialDiscount,
  createInitialPaymentDetails,
} from './posCheckoutModel';

function checkoutTotal(cartItems, discount) {
  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
    0
  );
  return calculateCheckoutSummary(subtotal, discount).total;
}

export function buildPosPreviewPayload({
  branchId,
  cartItems = [],
  paymentMethod = 'cash',
  paymentDetails,
  discount = createInitialDiscount(),
  total,
} = {}) {
  const resolvedTotal = Number.isFinite(Number(total)) ? Number(total) : checkoutTotal(cartItems, discount);
  return buildPosCommercialPayload({
    branchId,
    cartItems,
    paymentMethod,
    paymentDetails: paymentDetails || createInitialPaymentDetails(resolvedTotal),
    discount,
    total: resolvedTotal,
  });
}

export function buildPosSalePayload(options = {}) {
  return buildPosPreviewPayload(options);
}
