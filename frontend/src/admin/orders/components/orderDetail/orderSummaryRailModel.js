import { getOrderStatusMeta } from './orderDetailTheme';
import {
  getAdminSnapshot,
  getInvoiceInfo,
  getOrderBranchInfo,
  getOrderExchangeInfo,
  getOrderSourceLabel,
  getOrderSummary,
  getPaymentInfo,
} from './orderDetailUtils';

export const FLOW_STEPS = ['pending', 'processing', 'shipped', 'delivered'];

export const FLOW_LABELS = {
  pending: 'Recibida',
  processing: 'Preparando',
  shipped: 'Enviada',
  delivered: 'Entregada',
};

const TERMINAL_PROGRESS = {
  refunded: {
    summary: 'Ciclo cerrado por reembolso',
    title: 'Reembolso conciliado',
    description:
      'La orden cerró antes de completar la entrega; no se marca como enviada ni entregada.',
  },
  cancelled: {
    summary: 'Ciclo cerrado por cancelación',
    title: 'Orden cancelada',
    description:
      'La orden fue cancelada; no se marca como enviada ni entregada.',
  },
};

function normalizeProgressStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'reembolsada') return 'refunded';
  if (normalized === 'canceled' || normalized === 'cancelada') return 'cancelled';
  return normalized;
}

export function getProgressPercent(status) {
  const normalized = normalizeProgressStatus(status);

  if (normalized === 'paid') return 40;
  if (normalized === 'failed') return 0;
  if (TERMINAL_PROGRESS[normalized]) return null;

  const index = FLOW_STEPS.indexOf(normalized);

  if (index < 0) return 20;

  return Math.max(20, Math.round(((index + 1) / FLOW_STEPS.length) * 100));
}

export function getProgressPresentation(status) {
  const normalized = normalizeProgressStatus(status);
  const terminal = TERMINAL_PROGRESS[normalized];
  if (terminal) return { kind: 'terminal', percent: null, ...terminal };

  const percent = getProgressPercent(normalized);
  return {
    kind: 'delivery',
    percent,
    summary: `${percent}% completado`,
    title: '',
    description: '',
  };
}

function wasDeliveredBeforeClosure(order = {}) {
  if (String(order.fulfillmentStatus || '').toLowerCase() === 'delivered') return true;
  if (String(order.fulfillment?.logisticsSummary?.status || '').toLowerCase() === 'delivered') {
    return true;
  }
  return (order.fulfillment?.shipments || []).some((shipment) =>
    String(shipment?.status || '').toLowerCase() === 'delivered' ||
    Boolean(shipment?.deliveredAt)
  );
}

export function getOrderProgressPresentation(order = {}) {
  const progress = getProgressPresentation(order?.status);
  if (
    normalizeProgressStatus(order?.status) === 'refunded' &&
    wasDeliveredBeforeClosure(order)
  ) {
    return {
      ...progress,
      description:
        'La venta fue entregada y después se reembolsó; el ciclo comercial quedó conciliado.',
    };
  }
  return progress;
}

function toNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function firstValidNumber(...values) {
  const found = values.find((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0;
  });

  return found === undefined ? 0 : Number(found);
}

function firstConfiguredNumber(...values) {
  const found = values.find((value) => {
    if (value === undefined || value === null || value === '') return false;
    return Number.isFinite(Number(value));
  });

  return found === undefined ? 0 : Number(found);
}

function getProviderTotals(order) {
  const invoice =
    order?.electronicInvoice ||
    order?.invoice ||
    order?.factusInvoice ||
    {};

  const providerRaw = invoice?.provider?.raw || {};
  const totals = providerRaw?.totals || {};

  return {
    grossAmount: toNumber(totals.gross_amount),
    taxableAmount: toNumber(totals.taxable_amount),
    taxAmount: toNumber(totals.tax_amount),
    surchargeAmount: toNumber(totals.surcharge_amount),
    prepaymentAmount: toNumber(totals.prepayment_amount),
    total: toNumber(totals.total),
  };
}

function getOrderTaxes(order) {
  const ivaAmount = firstValidNumber(
    order?.taxes?.iva?.amount,
    order?.taxes?.ivaAmount,
    order?.taxes?.taxAmount,
    order?.taxAmount,
    order?.iva,
    order?.ivaAmount
  );

  const ivaRate = firstConfiguredNumber(
    order?.taxes?.iva?.percent,
    order?.taxes?.iva?.rate,
    order?.taxes?.ivaRate,
    order?.taxRate,
    19
  );

  return {
    ivaAmount,
    ivaRate,
  };
}

function getOrderDiscount(order) {
  return firstValidNumber(
    order?.pricing?.productDiscount,
    order?.discount?.amount,
    order?.coupon?.discountAmount,
    order?.discount,
    order?.discountAmount,
    order?.couponDiscount,
    order?.summary?.discount,
    order?.totals?.discount
  );
}

export function getMoneyBreakdown(order, summary) {
  const providerTotals = getProviderTotals(order);
  const orderTaxes = getOrderTaxes(order);

  const subtotal = firstValidNumber(
    summary?.subtotal,
    order?.subtotal,
    order?.itemsSubtotal,
    order?.totals?.subtotal,
    providerTotals.grossAmount,
    providerTotals.taxableAmount
  );

  const shipping = toNumber(
    order?.shipping ??
      order?.shippingCost ??
      order?.shippingAmount ??
      order?.deliveryFee ??
      order?.totals?.shipping ??
      summary?.shipping ??
      0
  );

  const discount = getOrderDiscount(order);
  const shippingDiscount = firstValidNumber(
    order?.pricing?.shippingDiscount,
    order?.coupon?.shippingDiscountAmount
  );
  const originalShipping = firstConfiguredNumber(
    order?.pricing?.originalShipping,
    order?.coupon?.originalShippingAmount,
    shipping
  );

  const total = firstValidNumber(
    summary?.total,
    order?.total,
    order?.grandTotal,
    order?.totals?.total,
    providerTotals.total,
    subtotal + shipping + orderTaxes.ivaAmount - discount
  );

  const inferredTax = Math.max(0, total - subtotal - shipping + discount);

  const ivaAmount = firstValidNumber(
    orderTaxes.ivaAmount,
    providerTotals.taxAmount,
    inferredTax
  );

  const ivaRate = orderTaxes.ivaRate || 19;

  const surcharge = firstValidNumber(
    order?.surcharge,
    order?.surchargeAmount,
    providerTotals.surchargeAmount
  );

  const prepayment = firstValidNumber(
    order?.prepayment,
    order?.prepaymentAmount,
    providerTotals.prepaymentAmount
  );

  return {
    subtotal,
    discount,
    shippingDiscount,
    couponCode: order?.coupon?.code || '',
    ivaAmount,
    ivaRate,
    shipping,
    originalShipping,
    surcharge,
    prepayment,
    total,
  };
}

export function buildOrderSummaryRailModel(order) {
  const exchange = getOrderExchangeInfo(order);
  const status = getOrderStatusMeta(
    exchange.noCharge ? 'processing' : order?.status
  );
  const summary = getOrderSummary(order);
  const progress = getOrderProgressPresentation(order);

  return {
    order,
    exchange,
    status,
    statusLabel: exchange.noCharge ? 'Cambio sin cobro' : status.label,
    summary,
    payment: getPaymentInfo(order),
    invoice: getInvoiceInfo(order),
    branchInfo: getOrderBranchInfo(order),
    admin: getAdminSnapshot(order),
    sourceLabel: getOrderSourceLabel(order?.source),
    progress,
    breakdown: getMoneyBreakdown(order, summary),
  };
}
