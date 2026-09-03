'use strict';

const mongoose = require('mongoose');

const Order = require('../models/Order');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const PosHeldSale = require('../models/PosHeldSale');
const {
  getCurrentCashSession,
  serializeCashSession,
} = require('./cashSessionService');

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
const REPORT_RANGES = new Set(['current_shift', 'today', 'last_7_days']);
const SALE_STATUSES = ['paid', 'processing', 'shipped', 'delivered', 'refunded'];
const CANCELLED_STATUSES = ['cancelled', 'canceled'];
const PAYMENT_METHODS = ['cash', 'transfer', 'card', 'mixed', 'other'];

function cleanText(value, max = 200) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

function normalizeRange(value) {
  const range = cleanText(value, 40).toLowerCase();
  return REPORT_RANGES.has(range) ? range : 'current_shift';
}

function bogotaDayStart(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const shifted = new Date(date.getTime() + BOGOTA_OFFSET_MS);
  const localMidnightAsUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  );

  return new Date(localMidnightAsUtc - BOGOTA_OFFSET_MS);
}

function buildReportPeriod({ range, now = new Date(), currentSession = null } = {}) {
  const requestedRange = normalizeRange(range);
  const end = now instanceof Date ? now : new Date(now);
  let effectiveRange = requestedRange;
  let start;
  let fallback = false;

  if (requestedRange === 'current_shift' && currentSession?.openedAt) {
    start = new Date(currentSession.openedAt);
  } else if (requestedRange === 'last_7_days') {
    start = new Date(bogotaDayStart(end).getTime() - 6 * 24 * 60 * 60 * 1000);
  } else {
    start = bogotaDayStart(end);
    if (requestedRange === 'current_shift') {
      effectiveRange = 'today';
      fallback = true;
    }
  }

  return {
    requestedRange,
    effectiveRange,
    start,
    end,
    fallback,
    timezone: 'America/Bogota',
  };
}

function zeroMetrics() {
  return {
    ordersCount: 0,
    cancelledOrdersCount: 0,
    refundedOrdersCount: 0,
    itemsCount: 0,
    grossSales: 0,
    discounts: 0,
    refunds: 0,
    netSales: 0,
    averageTicket: 0,
    missingCashSessionCount: 0,
    invoicePendingCount: 0,
    invoiceFailedCount: 0,
    refundReconciliationIssueCount: 0,
  };
}

function normalizeMetrics(row = {}) {
  const metrics = zeroMetrics();

  Object.keys(metrics).forEach((key) => {
    metrics[key] = cleanMoney(row[key]);
  });

  metrics.averageTicket = metrics.ordersCount > 0
    ? Math.round(metrics.netSales / metrics.ordersCount)
    : 0;

  return metrics;
}

function normalizePaymentBreakdown(rows = []) {
  const values = Object.fromEntries(PAYMENT_METHODS.map((method) => [method, 0]));

  rows.forEach((row) => {
    const method = PAYMENT_METHODS.includes(cleanText(row?._id, 40).toLowerCase())
      ? cleanText(row._id, 40).toLowerCase()
      : 'other';
    values[method] += cleanMoney(row?.amount);
  });

  return {
    ...values,
    total: PAYMENT_METHODS.reduce((sum, method) => sum + values[method], 0),
  };
}

function buildOrderReportPipeline(match, options = {}) {
  const billingActive = options.billingActive === true;
  const invoiceCollectionName = cleanText(
    options.invoiceCollectionName || ElectronicInvoice.collection.name,
    120
  );
  const isSale = { $in: ['$status', SALE_STATUSES] };
  const isCancelled = { $in: ['$status', CANCELLED_STATUSES] };
  const orderTotal = { $max: [0, { $ifNull: ['$total', 0] }] };
  const refundAmount = {
    $min: [
      orderTotal,
      { $max: [0, { $ifNull: ['$refundControl.totalAmount', 0] }] },
    ],
  };

  return [
    { $match: match },
    {
      $facet: {
        metrics: [
          ...(billingActive
            ? [
                {
                  $lookup: {
                    from: invoiceCollectionName,
                    let: { orderId: '$_id' },
                    pipeline: [
                      { $match: { $expr: { $eq: ['$orderId', '$$orderId'] } } },
                      { $sort: { createdAt: -1 } },
                      { $project: { _id: 1, status: 1 } },
                      { $limit: 1 },
                    ],
                    as: '_posInvoice',
                  },
                },
                { $set: { _posInvoice: { $arrayElemAt: ['$_posInvoice', 0] } } },
              ]
            : []),
          {
            $group: {
              _id: null,
              ordersCount: { $sum: { $cond: [isSale, 1, 0] } },
              cancelledOrdersCount: { $sum: { $cond: [isCancelled, 1, 0] } },
              refundedOrdersCount: {
                $sum: {
                  $cond: [
                    { $and: [isSale, { $gt: [refundAmount, 0] }] },
                    1,
                    0,
                  ],
                },
              },
              itemsCount: {
                $sum: {
                  $cond: [
                    isSale,
                    {
                      $reduce: {
                        input: { $ifNull: ['$items', []] },
                        initialValue: 0,
                        in: {
                          $add: [
                            '$$value',
                            { $max: [0, { $ifNull: ['$$this.quantity', 0] }] },
                          ],
                        },
                      },
                    },
                    0,
                  ],
                },
              },
              grossSales: {
                $sum: {
                  $cond: [
                    isSale,
                    { $max: [0, { $ifNull: ['$subtotal', '$total'] }] },
                    0,
                  ],
                },
              },
              discounts: {
                $sum: {
                  $cond: [isSale, { $max: [0, { $ifNull: ['$discount.amount', 0] }] }, 0],
                },
              },
              refunds: { $sum: { $cond: [isSale, refundAmount, 0] } },
              netSales: {
                $sum: {
                  $cond: [isSale, { $max: [0, { $subtract: [orderTotal, refundAmount] }] }, 0],
                },
              },
              missingCashSessionCount: {
                $sum: {
                  $cond: [
                    { $and: [isSale, { $eq: [{ $ifNull: ['$cashSession', null] }, null] }] },
                    1,
                    0,
                  ],
                },
              },
              invoicePendingCount: {
                $sum: {
                  $cond: [
                    billingActive ? {
                      $and: [
                        isSale,
                        {
                          $or: [
                            { $eq: [{ $ifNull: ['$_posInvoice', null] }, null] },
                            {
                              $in: [
                                '$_posInvoice.status',
                                ['pending', 'processing', 'reconciliation_pending'],
                              ],
                            },
                          ],
                        },
                      ],
                    } : false,
                    1,
                    0,
                  ],
                },
              },
              invoiceFailedCount: {
                $sum: {
                  $cond: [
                    billingActive ? {
                      $and: [
                        isSale,
                        {
                          $or: [
                            { $in: ['$_posInvoice.status', ['rejected', 'failed', 'error']] },
                            { $eq: ['$paymentProcessing.invoice.status', 'failed'] },
                          ],
                        },
                      ],
                    } : false,
                    1,
                    0,
                  ],
                },
              },
              refundReconciliationIssueCount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: [refundAmount, 0] },
                        {
                          $in: [
                            '$refundControl.reconciliationState',
                            ['pending', 'action_required', 'failed'],
                          ],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        payments: [
          { $match: { status: { $in: SALE_STATUSES } } },
          {
            $project: {
              components: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$payment.method', 'mixed'] },
                      { $gt: [{ $size: { $ifNull: ['$payment.splitPayments', []] } }, 0] },
                    ],
                  },
                  '$payment.splitPayments',
                  [
                    {
                      method: { $ifNull: ['$payment.method', 'other'] },
                      amount: {
                        $cond: [
                          { $gt: [{ $ifNull: ['$payment.amount', 0] }, 0] },
                          '$payment.amount',
                          { $ifNull: ['$total', 0] },
                        ],
                      },
                    },
                  ],
                ],
              },
            },
          },
          { $unwind: '$components' },
          {
            $project: {
              method: {
                $cond: [
                  { $in: [{ $toLower: { $ifNull: ['$components.method', 'other'] } }, PAYMENT_METHODS] },
                  { $toLower: { $ifNull: ['$components.method', 'other'] } },
                  'other',
                ],
              },
              amount: { $max: [0, { $ifNull: ['$components.amount', 0] }] },
            },
          },
          { $group: { _id: '$method', amount: { $sum: '$amount' } } },
        ],
      },
    },
  ];
}

function buildReconciliation(currentSession = null) {
  if (!currentSession) {
    return {
      status: 'no_session',
      openingAmount: 0,
      cashSales: 0,
      cashIn: 0,
      cashOut: 0,
      expectedCash: 0,
      countedCash: 0,
      differenceAmount: 0,
    };
  }

  const movements = Array.isArray(currentSession.cashMovements)
    ? currentSession.cashMovements
    : [];
  const cashIn = movements
    .filter((movement) => movement.direction === 'in')
    .reduce((sum, movement) => sum + cleanMoney(movement.amount), 0);
  const cashOut = movements
    .filter((movement) => movement.direction === 'out')
    .reduce((sum, movement) => sum + cleanMoney(movement.amount), 0);

  return {
    status: currentSession.status === 'closed' ? 'closed' : 'pending_count',
    openingAmount: cleanMoney(currentSession.openingAmount),
    cashSales: cleanMoney(currentSession.salesSummary?.paymentTotals?.cash),
    cashIn,
    cashOut,
    expectedCash: cleanMoney(currentSession.expectedCash),
    countedCash: cleanMoney(currentSession.countedCash),
    differenceAmount: Number(currentSession.differenceAmount || 0),
  };
}

function buildOperationalAlerts({ metrics, heldSales, currentSession, cashSessionRequired }) {
  const alerts = [];

  if (cashSessionRequired && !currentSession) {
    alerts.push({
      code: 'cash_session_required',
      severity: 'critical',
      title: 'Caja requerida sin sesión abierta',
      message: 'Abre la caja asignada antes de registrar nuevas ventas POS.',
      action: { label: 'Ir a Caja', href: '/admin/caja' },
    });
  }

  if (cashSessionRequired && metrics.missingCashSessionCount > 0) {
    alerts.push({
      code: 'sales_without_cash_session',
      severity: 'critical',
      title: `${metrics.missingCashSessionCount} venta(s) sin caja asociada`,
      message: 'Revisa estas órdenes porque no quedaron enlazadas a una sesión de caja.',
      action: { label: 'Revisar órdenes', href: '/admin/ordenes' },
    });
  }

  if (metrics.invoiceFailedCount > 0) {
    alerts.push({
      code: 'invoice_failed',
      severity: 'critical',
      title: `${metrics.invoiceFailedCount} factura(s) con fallo`,
      message: 'La venta existe, pero su proceso de facturación requiere intervención.',
      action: { label: 'Ir a Facturación', href: '/admin/facturacion' },
    });
  }

  if (metrics.refundReconciliationIssueCount > 0) {
    alerts.push({
      code: 'refund_reconciliation',
      severity: 'critical',
      title: `${metrics.refundReconciliationIssueCount} reembolso(s) por conciliar`,
      message: 'Completa la conciliación financiera, de inventario o facturación.',
      action: { label: 'Revisar órdenes', href: '/admin/ordenes' },
    });
  }

  if (metrics.invoicePendingCount > 0) {
    alerts.push({
      code: 'invoice_pending',
      severity: 'attention',
      title: `${metrics.invoicePendingCount} factura(s) pendiente(s)`,
      message: 'El cobro fue registrado y la emisión fiscal continúa pendiente o en proceso.',
      action: { label: 'Ver facturación', href: '/admin/facturacion' },
    });
  }

  if (heldSales.activeCount > 0) {
    alerts.push({
      code: 'held_sales',
      severity: 'attention',
      title: `${heldSales.activeCount} venta(s) todavía en espera`,
      message: 'Recupéralas o descártalas para mantener limpia la jornada.',
      action: null,
    });
  }

  return alerts;
}

function summarizeReportStatus(alerts = []) {
  if (alerts.some((alert) => alert.severity === 'critical')) return 'critical';
  if (alerts.some((alert) => alert.severity === 'attention')) return 'attention';
  return 'healthy';
}

async function buildPosShiftSummary({
  branch,
  branchIds = null,
  range = 'current_shift',
  cashRegisterCode = 'CAJA POS',
  billingActive = false,
  now = new Date(),
} = {}) {
  const branchId = String(branch?._id || branch?.id || '');
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    const error = new Error('Debes seleccionar una sede válida para consultar la jornada.');
    error.code = 'POS_SHIFT_BRANCH_REQUIRED';
    error.statusCode = 400;
    throw error;
  }

  const currentSession = await getCurrentCashSession({
    branchId,
    branchIds,
    cashRegisterCode,
  });
  const period = buildReportPeriod({ range, now, currentSession });
  const branchObjectId = new mongoose.Types.ObjectId(branchId);
  const orderMatch = {
    source: 'pos',
    branch: branchObjectId,
    createdAt: { $gte: period.start, $lte: period.end },
  };
  const heldMatch = {
    branch: branchObjectId,
    $or: [
      { status: 'active' },
      { closedAt: { $gte: period.start, $lte: period.end } },
    ],
  };

  const [orderRows, heldRows] = await Promise.all([
    Order.aggregate(buildOrderReportPipeline(orderMatch, {
      billingActive,
      invoiceCollectionName: ElectronicInvoice.collection.name,
    })),
    PosHeldSale.aggregate([
      { $match: heldMatch },
      {
        $group: {
          _id: null,
          activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          activeValue: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'active'] },
                { $max: [0, { $ifNull: ['$subtotalSnapshot', 0] }] },
                0,
              ],
            },
          },
          completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          discardedCount: { $sum: { $cond: [{ $eq: ['$status', 'discarded'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const metrics = normalizeMetrics(orderRows?.[0]?.metrics?.[0]);
  const paymentBreakdown = normalizePaymentBreakdown(orderRows?.[0]?.payments || []);
  const heldRow = heldRows?.[0] || {};
  const heldSales = {
    activeCount: cleanMoney(heldRow.activeCount),
    activeValue: cleanMoney(heldRow.activeValue),
    completedCount: cleanMoney(heldRow.completedCount),
    discardedCount: cleanMoney(heldRow.discardedCount),
  };
  const cashSessionRequired = branch?.settings?.requireCashSessionForPos === true;
  const alerts = buildOperationalAlerts({
    metrics,
    heldSales,
    currentSession,
    cashSessionRequired,
    billingActive: billingActive === true,
  });

  return {
    version: 'pos-shift-summary-v1',
    generatedAt: period.end,
    serverAuthoritative: true,
    branch: {
      id: branchId,
      name: cleanText(branch?.name, 160),
      code: cleanText(branch?.code, 40).toUpperCase(),
    },
    cashRegisterCode: cleanText(cashRegisterCode || 'CAJA POS', 40).toUpperCase(),
    cashSessionRequired,
    billingActive: billingActive === true,
    period,
    metrics,
    paymentBreakdown,
    heldSales,
    cashSession: currentSession ? serializeCashSession(currentSession) : null,
    reconciliation: buildReconciliation(currentSession),
    status: summarizeReportStatus(alerts),
    alerts,
  };
}

module.exports = {
  BOGOTA_OFFSET_MS,
  REPORT_RANGES,
  SALE_STATUSES,
  bogotaDayStart,
  buildOperationalAlerts,
  buildOrderReportPipeline,
  buildPosShiftSummary,
  buildReconciliation,
  buildReportPeriod,
  normalizePaymentBreakdown,
  normalizeRange,
  summarizeReportStatus,
};
