'use strict';

const {
  DAY_MS,
  PREPARATION_STALE_MS,
  SLA_RISK_MS,
  TERMINAL_ORDER_STATUSES,
  TRANSIT_STALE_MS,
  TRANSIT_STATUSES,
} = require('./constants');
const {
  anyOpenIncidentExpression,
  anyShipmentExpression,
  hasActivePhysicalAllocationExpression,
  hasConfirmedPaymentExpression,
  lower,
  shipmentSlaExpression,
} = require('./mongoExpressions');
const {
  buildOperationalSummaryPipeline,
} = require('../orderAdminQueryService');

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

module.exports = {
  buildOrderHealthMetricsPipeline,
  buildOrderHealthPipeline,
};
