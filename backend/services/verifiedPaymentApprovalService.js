'use strict';

function cleanStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function toValidDate(value) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  if (typeof value !== 'string') return null;
  const text = value.trim();
  const dateParts = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].+)?$/);
  if (!dateParts) return null;

  const year = Number(dateParts[1]);
  const month = Number(dateParts[2]);
  const day = Number(dateParts[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return null;

  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function isVerifiedPaymentApproval({
  verified = false,
  providerStatus = '',
  normalizedPaymentStatus = '',
} = {}) {
  return (
    verified === true &&
    cleanStatus(providerStatus) === 'APPROVED' &&
    String(normalizedPaymentStatus || '').trim().toLowerCase() === 'paid'
  );
}

function applyVerifiedPaidAt(
  order,
  {
    verified = false,
    providerStatus = '',
    normalizedPaymentStatus = '',
    providerPaidAt = null,
    now = new Date(),
  } = {}
) {
  const approved = isVerifiedPaymentApproval({
    verified,
    providerStatus,
    normalizedPaymentStatus,
  });
  const paymentStatus = String(order?.payment?.status || '').trim().toLowerCase();

  if (!approved || paymentStatus !== 'paid') {
    return {
      approved: false,
      assigned: false,
      preserved: Boolean(order?.payment?.paidAt),
      paidAt: order?.payment?.paidAt || null,
    };
  }

  if (order.payment.paidAt) {
    return {
      approved: true,
      assigned: false,
      preserved: true,
      paidAt: order.payment.paidAt,
    };
  }

  const trustedProviderDate = toValidDate(providerPaidAt);
  const trustedServerDate = toValidDate(now) || new Date();
  order.payment.paidAt = trustedProviderDate || trustedServerDate;

  return {
    approved: true,
    assigned: true,
    preserved: false,
    source: trustedProviderDate ? 'provider' : 'server',
    paidAt: order.payment.paidAt,
  };
}

module.exports = {
  applyVerifiedPaidAt,
  isVerifiedPaymentApproval,
  toValidDate,
};
