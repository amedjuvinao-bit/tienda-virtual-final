'use strict';

const { performance } = require('perf_hooks');

const Order = require('../models/Order');
const {
  buildOperationalSummaryPipeline,
} = require('./orderAdminQueryService');

const DAY_MS = 24 * 60 * 60 * 1000;
const PREPARATION_STALE_MS = 2 * 60 * 60 * 1000;
const TRANSIT_STALE_MS = 48 * 60 * 60 * 1000;
const SLA_RISK_MS = 24 * 60 * 60 * 1000;

const ACTIVE_SLA_STATUSES = [
  'ready_to_pick',
  'picking',
  'picked',
  'packing',
  'packed',
  'dispatched',
  'in_transit',
];
const TRANSIT_STATUSES = ['dispatched', 'in_transit'];
const TERMINAL_ORDER_STATUSES = [
  'failed',
  'cancelled',
  'canceled',
  'delivered',
  'refunded',
];

const DEFAULT_THRESHOLDS = Object.freeze({
  recentPaymentFailuresCritical: 10,
  stuckPreparationCritical: 20,
  queryLatencyWarningMs: 750,
  queryLatencyCriticalMs: 2500,
});

const SEVERITY_WEIGHT = Object.freeze({
  ok: 0,
  warning: 1,
  critical: 2,
});

function numberValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function lower(value) {
  return { $toLower: { $ifNull: [value, ''] } };
}

function hasConfirmedPaymentExpression() {
  return {
    $or: [
      { $eq: [lower('$payment.status'), 'paid'] },
      { $in: ['$status', ['paid', 'shipped', 'delivered', 'refunded']] },
    ],
  };
}

function hasActivePhysicalAllocationExpression() {
  return {
    $anyElementTrue: {
      $map: {
        input: { $ifNull: ['$inventoryAllocations', []] },
        as: 'allocation',
        in: {
          $gt: [
            {
              $subtract: [
                { $ifNull: ['$$allocation.soldQuantity', 0] },
                { $ifNull: ['$$allocation.returnedQuantity', 0] },
              ],
            },
            0,
          ],
        },
      },
    },
  };
}

function anyShipmentExpression(condition) {
  return {
    $anyElementTrue: {
      $map: {
        input: { $ifNull: ['$fulfillment.shipments', []] },
        as: 'shipment',
        in: condition,
      },
    },
  };
}

function anyOpenIncidentExpression({ criticalOnly = false } = {}) {
  return anyShipmentExpression({
    $anyElementTrue: {
      $map: {
        input: { $ifNull: ['$$shipment.incidents', []] },
        as: 'incident',
        in: {
          $and: [
            { $eq: [lower('$$incident.status'), 'open'] },
            ...(criticalOnly
              ? [
                  {
                    $in: [
                      lower('$$incident.severity'),
                      ['high', 'critical'],
                    ],
                  },
                ]
              : []),
          ],
        },
      },
    },
  });
}

function relevantShipmentDueAtExpression() {
  return {
    $switch: {
      branches: [
        {
          case: {
            $in: [
              lower('$$shipment.status'),
              ['ready_to_pick', 'picking'],
            ],
          },
          then: '$$shipment.sla.pickingDueAt',
        },
        {
          case: {
            $in: [
              lower('$$shipment.status'),
              ['picked', 'packing', 'packed'],
            ],
          },
          then: '$$shipment.sla.dispatchDueAt',
        },
        {
          case: {
            $in: [lower('$$shipment.status'), TRANSIT_STATUSES],
          },
          then: '$$shipment.sla.deliveryDueAt',
        },
      ],
      default: null,
    },
  };
}

function shipmentSlaExpression({ now, riskUntil, breached }) {
  return anyShipmentExpression({
    $let: {
      vars: {
        status: lower('$$shipment.status'),
        dueAt: relevantShipmentDueAtExpression(),
      },
      in: breached
        ? {
            $and: [
              { $in: ['$$status', ACTIVE_SLA_STATUSES] },
              {
                $or: [
                  {
                    $ne: [
                      { $ifNull: ['$$shipment.sla.breachedAt', null] },
                      null,
                    ],
                  },
                  {
                    $and: [
                      { $ne: [{ $ifNull: ['$$dueAt', null] }, null] },
                      { $lte: ['$$dueAt', now] },
                    ],
                  },
                ],
              },
            ],
          }
        : {
            $and: [
              { $in: ['$$status', ACTIVE_SLA_STATUSES] },
              {
                $eq: [
                  { $ifNull: ['$$shipment.sla.breachedAt', null] },
                  null,
                ],
              },
              { $ne: [{ $ifNull: ['$$dueAt', null] }, null] },
              { $gt: ['$$dueAt', now] },
              { $lte: ['$$dueAt', riskUntil] },
            ],
          },
    },
  });
}

function buildOrderHealthMetricsPipeline(now = new Date()) {
  const windowStartedAt = new Date(now.getTime() - DAY_MS);
  const preparationStaleBefore = new Date(
    now.getTime() - PREPARATION_STALE_MS
  );
  const transitStaleBefore = new Date(now.getTime() - TRANSIT_STALE_MS);
  const riskUntil = new Date(now.getTime() + SLA_RISK_MS);
  const shipmentCount = {
    $size: { $ifNull: ['$fulfillment.shipments', []] },
  };

  return [
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        recentPaymentFailures: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$updatedAt', windowStartedAt] },
                  {
                    $or: [
                      { $eq: ['$status', 'failed'] },
                      {
                        $in: [
                          lower('$payment.status'),
                          ['failed', 'cancelled'],
                        ],
                      },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        stuckPreparation: {
          $sum: {
            $cond: [
              {
                $and: [
                  hasConfirmedPaymentExpression(),
                  { $not: [{ $in: ['$status', TERMINAL_ORDER_STATUSES] }] },
                  hasActivePhysicalAllocationExpression(),
                  { $eq: [shipmentCount, 0] },
                  { $lte: ['$createdAt', preparationStaleBefore] },
                ],
              },
              1,
              0,
            ],
          },
        },
        openIncidentOrders: {
          $sum: {
            $cond: [anyOpenIncidentExpression(), 1, 0],
          },
        },
        criticalIncidentOrders: {
          $sum: {
            $cond: [
              anyOpenIncidentExpression({ criticalOnly: true }),
              1,
              0,
            ],
          },
        },
        slaBreachedOrders: {
          $sum: {
            $cond: [
              shipmentSlaExpression({ now, riskUntil, breached: true }),
              1,
              0,
            ],
          },
        },
        slaRiskOrders: {
          $sum: {
            $cond: [
              shipmentSlaExpression({ now, riskUntil, breached: false }),
              1,
              0,
            ],
          },
        },
        staleTransitOrders: {
          $sum: {
            $cond: [
              anyShipmentExpression({
                $and: [
                  {
                    $in: [lower('$$shipment.status'), TRANSIT_STATUSES],
                  },
                  {
                    $lte: [
                      { $ifNull: ['$$shipment.updatedAt', '$updatedAt'] },
                      transitStaleBefore,
                    ],
                  },
                ],
              }),
              1,
              0,
            ],
          },
        },
      },
    },
    { $project: { _id: 0 } },
  ];
}

function buildOrderHealthPipeline(filter = {}, now = new Date()) {
  return [
    { $match: filter },
    {
      $facet: {
        operational: buildOperationalSummaryPipeline(now),
        metrics: buildOrderHealthMetricsPipeline(now),
      },
    },
    {
      $project: {
        operational: { $arrayElemAt: ['$operational', 0] },
        metrics: { $arrayElemAt: ['$metrics', 0] },
      },
    },
  ];
}

function buildCheck({
  code,
  label,
  count,
  warning = false,
  critical = false,
  okMessage,
  warningMessage,
  criticalMessage,
}) {
  const severity = critical ? 'critical' : warning ? 'warning' : 'ok';
  return {
    code,
    label,
    severity,
    count: numberValue(count),
    message:
      severity === 'critical'
        ? criticalMessage
        : severity === 'warning'
          ? warningMessage
          : okMessage,
  };
}

function summarizeStatus(checks) {
  const severity = checks.reduce(
    (current, check) =>
      SEVERITY_WEIGHT[check.severity] > SEVERITY_WEIGHT[current]
        ? check.severity
        : current,
    'ok'
  );

  return {
    severity,
    status:
      severity === 'critical'
        ? 'critical'
        : severity === 'warning'
          ? 'degraded'
          : 'healthy',
  };
}

function buildOperationalChecks(
  metrics,
  queryDurationMs,
  thresholds = DEFAULT_THRESHOLDS
) {
  const checks = [
    buildCheck({
      code: 'ORDER_PAYMENT_FAILURES',
      label: 'Fallos de pago recientes',
      count: metrics.recentPaymentFailures,
      critical:
        metrics.recentPaymentFailures >=
        thresholds.recentPaymentFailuresCritical,
      warning: metrics.recentPaymentFailures > 0,
      okMessage: 'No hay pagos fallidos en las últimas 24 horas.',
      warningMessage: `${metrics.recentPaymentFailures} orden(es) registran un fallo de pago reciente.`,
      criticalMessage: `${metrics.recentPaymentFailures} órdenes superan el umbral crítico de fallos de pago.`,
    }),
    buildCheck({
      code: 'ORDER_PREPARATION_BACKLOG',
      label: 'Preparación logística pendiente',
      count: metrics.stuckPreparation,
      critical:
        metrics.stuckPreparation >= thresholds.stuckPreparationCritical,
      warning: metrics.stuckPreparation > 0,
      okMessage: 'No hay órdenes pagadas retenidas antes de preparar.',
      warningMessage: `${metrics.stuckPreparation} orden(es) pagadas llevan más de dos horas sin preparar.`,
      criticalMessage: `${metrics.stuckPreparation} órdenes pagadas superan el umbral crítico de preparación.`,
    }),
    buildCheck({
      code: 'ORDER_LOGISTICS_INCIDENTS',
      label: 'Incidencias logísticas abiertas',
      count: metrics.openIncidentOrders,
      critical: metrics.criticalIncidentOrders > 0,
      warning: metrics.openIncidentOrders > 0,
      okMessage: 'No hay incidencias logísticas abiertas.',
      warningMessage: `${metrics.openIncidentOrders} orden(es) tienen incidencias logísticas abiertas.`,
      criticalMessage: `${metrics.criticalIncidentOrders} orden(es) tienen incidencias logísticas de severidad alta o crítica.`,
    }),
    buildCheck({
      code: 'ORDER_LOGISTICS_SLA',
      label: 'Compromisos logísticos SLA',
      count: metrics.slaBreachedOrders + metrics.slaRiskOrders,
      critical: metrics.slaBreachedOrders > 0,
      warning: metrics.slaRiskOrders > 0,
      okMessage: 'No hay compromisos SLA vencidos o en riesgo.',
      warningMessage: `${metrics.slaRiskOrders} orden(es) tienen un SLA que vence dentro de 24 horas.`,
      criticalMessage: `${metrics.slaBreachedOrders} orden(es) tienen un SLA vencido.`,
    }),
    buildCheck({
      code: 'ORDER_STALE_TRANSIT',
      label: 'Envíos sin actualización',
      count: metrics.staleTransitOrders,
      warning: metrics.staleTransitOrders > 0,
      okMessage: 'No hay envíos en tránsito sin actualización prolongada.',
      warningMessage: `${metrics.staleTransitOrders} orden(es) llevan más de 48 horas en tránsito sin actualización.`,
      criticalMessage: '',
    }),
    buildCheck({
      code: 'ORDER_MONITORING_LATENCY',
      label: 'Latencia del diagnóstico',
      count: Math.round(queryDurationMs),
      critical: queryDurationMs >= thresholds.queryLatencyCriticalMs,
      warning: queryDurationMs >= thresholds.queryLatencyWarningMs,
      okMessage: 'El diagnóstico operativo responde dentro del umbral esperado.',
      warningMessage: `El diagnóstico tardó ${Math.round(queryDurationMs)} ms.`,
      criticalMessage: `El diagnóstico tardó ${Math.round(queryDurationMs)} ms y superó el umbral crítico.`,
    }),
  ];

  return {
    checks,
    alerts: checks.filter((check) => check.severity !== 'ok'),
    ...summarizeStatus(checks),
  };
}

function normalizeMetrics(row = {}) {
  return {
    totalOrders: numberValue(row.totalOrders),
    recentPaymentFailures: numberValue(row.recentPaymentFailures),
    stuckPreparation: numberValue(row.stuckPreparation),
    openIncidentOrders: numberValue(row.openIncidentOrders),
    criticalIncidentOrders: numberValue(row.criticalIncidentOrders),
    slaBreachedOrders: numberValue(row.slaBreachedOrders),
    slaRiskOrders: numberValue(row.slaRiskOrders),
    staleTransitOrders: numberValue(row.staleTransitOrders),
  };
}

function normalizeOperational(row = {}) {
  return Object.fromEntries(
    [
      'total',
      'attention',
      'awaitingPayment',
      'prepare',
      'dispatch',
      'transit',
      'incidents',
      'slaRisk',
      'completed',
    ].map((key) => [key, numberValue(row[key])])
  );
}

function createOrderOperationalMonitoringService(overrides = {}) {
  const OrderModel = overrides.OrderModel || Order;
  const nowFactory = overrides.now || (() => new Date());
  const clock = overrides.clock || (() => performance.now());
  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(overrides.thresholds || {}),
  };

  async function getOperationalHealth({ filter = {} } = {}) {
    const now = new Date(nowFactory());
    const startedAt = clock();
    const aggregate = OrderModel.aggregate(
      buildOrderHealthPipeline(filter, now)
    );
    const rows =
      aggregate && typeof aggregate.allowDiskUse === 'function'
        ? await aggregate.allowDiskUse(true)
        : await aggregate;
    const queryDurationMs = Math.max(0, Number(clock() - startedAt));
    const row = rows?.[0] || {};
    const metrics = normalizeMetrics(row.metrics);
    const operational = normalizeOperational(row.operational);
    const state = buildOperationalChecks(
      metrics,
      queryDurationMs,
      thresholds
    );

    return {
      status: state.status,
      severity: state.severity,
      generatedAt: now,
      window: {
        startedAt: new Date(now.getTime() - DAY_MS),
        endedAt: now,
        hours: 24,
      },
      thresholds: {
        preparationStaleMinutes: PREPARATION_STALE_MS / 60_000,
        transitStaleHours: TRANSIT_STALE_MS / 3_600_000,
        slaRiskHours: SLA_RISK_MS / 3_600_000,
        ...thresholds,
      },
      performance: {
        queryDurationMs: Math.round(queryDurationMs * 100) / 100,
      },
      metrics,
      operational,
      checks: state.checks,
      alerts: state.alerts,
    };
  }

  return { getOperationalHealth };
}

const defaultService = createOrderOperationalMonitoringService();

module.exports = {
  DAY_MS,
  DEFAULT_THRESHOLDS,
  PREPARATION_STALE_MS,
  SLA_RISK_MS,
  TRANSIT_STALE_MS,
  buildOperationalChecks,
  buildOrderHealthMetricsPipeline,
  buildOrderHealthPipeline,
  createOrderOperationalMonitoringService,
  getOperationalHealth: defaultService.getOperationalHealth,
};
