const {
  cleanLower,
  cleanMoney,
  cleanText,
  cleanUpper,
  toNum,
} = require('./normalizers');

function normalizeOrderPayment(order) {
  if (!order.payment || typeof order.payment !== 'object') {
    order.payment = {
      active: true,
      provider: order.source === 'pos' ? 'pos' : '',
      providerLabel: order.source === 'pos' ? 'Venta física' : '',
      mode: 'sandbox',
      currency: 'COP',
      checkoutLabel: '',
      enableWebhook: false,
      status: order.source === 'pos' ? 'paid' : 'pending_gateway',
      methodType: '',
      method: '',
      methodLabel: '',
      amount: toNum(order.total, 0),
      amountInCents: Math.round(toNum(order.total, 0) * 100),
      paidAt: order.source === 'pos' ? new Date() : null,
      splitPayments: [],
      rawMethod: {},
    };
    return;
  }

  order.payment.active =
    typeof order.payment.active === 'boolean' ? order.payment.active : true;
  order.payment.provider = cleanLower(order.payment.provider || '');

  if (order.source === 'pos' && !order.payment.provider) {
    order.payment.provider = 'pos';
  }

  order.payment.providerLabel = cleanText(
    order.payment.providerLabel ||
      (order.payment.provider === 'pos' ? 'Venta física' : '')
  );
  order.payment.mode =
    cleanLower(order.payment.mode || '') === 'production'
      ? 'production'
      : 'sandbox';
  order.payment.currency = cleanUpper(order.payment.currency || 'COP') || 'COP';
  order.payment.checkoutLabel = cleanText(order.payment.checkoutLabel);
  order.payment.enableWebhook = order.payment.enableWebhook === true;
  order.payment.methodType = cleanLower(order.payment.methodType);
  order.payment.method = cleanLower(order.payment.method);
  order.payment.methodLabel = cleanText(order.payment.methodLabel);
  order.payment.transactionId = cleanText(order.payment.transactionId);
  order.payment.reference = cleanText(order.payment.reference);
  const paymentAmount = Number(order.payment.amount);
  const hasCheckoutStoreCredit = order.storeCredit?.applied === true;
  order.payment.amount =
    hasCheckoutStoreCredit && Number.isFinite(paymentAmount)
      ? cleanMoney(paymentAmount)
      : cleanMoney(paymentAmount || order.total);
  const paymentAmountInCents = Number(order.payment.amountInCents);
  const useExplicitPaymentCents =
    hasCheckoutStoreCredit &&
    Number.isFinite(paymentAmountInCents) &&
    (paymentAmountInCents > 0 || order.payment.amount === 0);
  order.payment.amountInCents = Math.max(
    0,
    Math.round(
      useExplicitPaymentCents
        ? paymentAmountInCents
        : order.payment.amount * 100
    )
  );
  order.payment.receivedAmount = cleanMoney(order.payment.receivedAmount);
  order.payment.changeAmount = cleanMoney(order.payment.changeAmount);
  order.payment.splitPayments = Array.isArray(order.payment.splitPayments)
    ? order.payment.splitPayments
    : [];

  const safeStatus = cleanLower(order.payment.status || '');
  order.payment.status = [
    'pending_gateway',
    'pending_manual',
    'paid',
    'failed',
    'cancelled',
  ].includes(safeStatus)
    ? safeStatus
    : order.payment.provider === 'manual'
      ? 'pending_manual'
      : order.payment.provider === 'pos'
        ? 'paid'
        : 'pending_gateway';

  if (
    order.source === 'pos' &&
    order.payment.status === 'paid' &&
    !order.payment.paidAt
  ) {
    order.payment.paidAt = new Date();
  }
}

module.exports = { normalizeOrderPayment };
