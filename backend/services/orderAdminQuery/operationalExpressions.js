'use strict';

const {
  ACTIVE_SLA_SHIPMENT_STATUSES,
  PREPARATION_SHIPMENT_STATUSES,
  TRANSIT_SHIPMENT_STATUSES,
} = require('./constants');
const { normalizeOperationalView } = require('./filters');

function buildSlaRiskCriteria(now = new Date()) {
  const riskUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    $or: [
      {
        'fulfillment.shipments': {
          $elemMatch: {
            'sla.breachedAt': { $exists: true, $ne: null },
          },
        },
      },
      {
        'fulfillment.shipments': {
          $elemMatch: {
            status: { $in: ['ready_to_pick', 'picking'] },
            'sla.pickingDueAt': { $lte: riskUntil },
          },
        },
      },
      {
        'fulfillment.shipments': {
          $elemMatch: {
            status: { $in: ['picked', 'packing', 'packed'] },
            'sla.dispatchDueAt': { $lte: riskUntil },
          },
        },
      },
      {
        'fulfillment.shipments': {
          $elemMatch: {
            status: { $in: TRANSIT_SHIPMENT_STATUSES },
            'sla.deliveryDueAt': { $lte: riskUntil },
          },
        },
      },
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

function hasConfirmedPaymentExpression() {
  return {
    $or: [
      {
        $eq: [
          { $toLower: { $ifNull: ['$payment.status', ''] } },
          'paid',
        ],
      },
      { $in: ['$status', ['paid', 'shipped', 'delivered', 'refunded']] },
    ],
  };
}

function buildOperationalViewCriteria(value, now = new Date()) {
  const view = normalizeOperationalView(value);
  const incidentCriteria = {
    $or: [
      { 'fulfillment.shipments.status': 'exception' },
      { 'fulfillment.shipments.incidents.status': 'open' },
    ],
  };
  const slaRiskCriteria = buildSlaRiskCriteria(now);

  if (view === 'all') return null;
  if (view === 'attention') {
    return {
      $or: [{ status: 'failed' }, incidentCriteria, slaRiskCriteria],
    };
  }
  if (view === 'awaiting_payment') {
    return {
      $and: [
        { status: { $in: ['pending', 'processing'] } },
        { 'payment.status': { $ne: 'paid' } },
      ],
    };
  }
  if (view === 'prepare') {
    return {
      $and: [
        {
          $or: [
            { status: { $in: ['paid', 'shipped'] } },
            { 'payment.status': 'paid' },
          ],
        },
        {
          status: {
            $nin: ['failed', 'cancelled', 'canceled', 'delivered', 'refunded'],
          },
        },
        {
          $or: [
            {
              $and: [
                { 'fulfillment.shipments.0': { $exists: false } },
                { $expr: hasActivePhysicalAllocationExpression() },
              ],
            },
            {
              'fulfillment.shipments': {
                $elemMatch: { status: { $in: PREPARATION_SHIPMENT_STATUSES } },
              },
            },
          ],
        },
      ],
    };
  }
  if (view === 'dispatch') {
    return { 'fulfillment.shipments.status': 'packed' };
  }
  if (view === 'transit') {
    return { 'fulfillment.shipments.status': { $in: TRANSIT_SHIPMENT_STATUSES } };
  }
  if (view === 'incidents') return incidentCriteria;
  if (view === 'sla_risk') return slaRiskCriteria;
  if (view === 'completed') return { status: 'delivered' };
  return null;
}

function shipmentStatusExpression(statuses) {
  return {
    $anyElementTrue: {
      $map: {
        input: { $ifNull: ['$fulfillment.shipments', []] },
        as: 'shipment',
        in: {
          $in: [
            { $toLower: { $ifNull: ['$$shipment.status', ''] } },
            statuses,
          ],
        },
      },
    },
  };
}

function openIncidentExpression() {
  return {
    $anyElementTrue: {
      $map: {
        input: { $ifNull: ['$fulfillment.shipments', []] },
        as: 'shipment',
        in: {
          $anyElementTrue: {
            $map: {
              input: { $ifNull: ['$$shipment.incidents', []] },
              as: 'incident',
              in: { $eq: ['$$incident.status', 'open'] },
            },
          },
        },
      },
    },
  };
}

function slaRiskExpression(now = new Date()) {
  const riskUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    $anyElementTrue: {
      $map: {
        input: { $ifNull: ['$fulfillment.shipments', []] },
        as: 'shipment',
        in: {
          $let: {
            vars: {
              status: { $toLower: { $ifNull: ['$$shipment.status', ''] } },
              dueAt: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $in: [
                          { $toLower: { $ifNull: ['$$shipment.status', ''] } },
                          ['ready_to_pick', 'picking'],
                        ],
                      },
                      then: '$$shipment.sla.pickingDueAt',
                    },
                    {
                      case: {
                        $in: [
                          { $toLower: { $ifNull: ['$$shipment.status', ''] } },
                          ['picked', 'packing', 'packed'],
                        ],
                      },
                      then: '$$shipment.sla.dispatchDueAt',
                    },
                    {
                      case: {
                        $in: [
                          { $toLower: { $ifNull: ['$$shipment.status', ''] } },
                          TRANSIT_SHIPMENT_STATUSES,
                        ],
                      },
                      then: '$$shipment.sla.deliveryDueAt',
                    },
                  ],
                  default: null,
                },
              },
            },
            in: {
              $or: [
                {
                  $ne: [
                    { $ifNull: ['$$shipment.sla.breachedAt', null] },
                    null,
                  ],
                },
                {
                  $and: [
                    { $in: ['$$status', ACTIVE_SLA_SHIPMENT_STATUSES] },
                    { $ne: [{ $ifNull: ['$$dueAt', null] }, null] },
                    { $lte: ['$$dueAt', riskUntil] },
                  ],
                },
              ],
            },
          },
        },
      },
    },
  };
}

function buildOperationalSummaryPipeline(now = new Date()) {
  const hasIncidents = {
    $or: [shipmentStatusExpression(['exception']), openIncidentExpression()],
  };
  const hasSlaRisk = slaRiskExpression(now);
  const shipmentCount = { $size: { $ifNull: ['$fulfillment.shipments', []] } };
  const isPreparation = shipmentStatusExpression(PREPARATION_SHIPMENT_STATUSES);
  const hasPhysicalAllocation = hasActivePhysicalAllocationExpression();
  const hasConfirmedPayment = hasConfirmedPaymentExpression();

  return [
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        attention: {
          $sum: {
            $cond: [
              { $or: [{ $eq: ['$status', 'failed'] }, hasIncidents, hasSlaRisk] },
              1,
              0,
            ],
          },
        },
        awaitingPayment: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', ['pending', 'processing']] },
                  { $not: [hasConfirmedPayment] },
                ],
              },
              1,
              0,
            ],
          },
        },
        prepare: {
          $sum: {
            $cond: [
              {
                $and: [
                  hasConfirmedPayment,
                  {
                    $not: [
                      {
                        $in: [
                          '$status',
                          ['failed', 'cancelled', 'canceled', 'delivered', 'refunded'],
                        ],
                      },
                    ],
                  },
                  {
                    $or: [
                      {
                        $and: [
                          { $eq: [shipmentCount, 0] },
                          hasPhysicalAllocation,
                        ],
                      },
                      isPreparation,
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        dispatch: {
          $sum: { $cond: [shipmentStatusExpression(['packed']), 1, 0] },
        },
        transit: {
          $sum: {
            $cond: [shipmentStatusExpression(TRANSIT_SHIPMENT_STATUSES), 1, 0],
          },
        },
        incidents: { $sum: { $cond: [hasIncidents, 1, 0] } },
        slaRisk: { $sum: { $cond: [hasSlaRisk, 1, 0] } },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
        },
      },
    },
    { $project: { _id: 0 } },
  ];
}

module.exports = {
  buildOperationalSummaryPipeline,
  buildOperationalViewCriteria,
  buildSlaRiskCriteria,
  hasActivePhysicalAllocationExpression,
  hasConfirmedPaymentExpression,
  openIncidentExpression,
  shipmentStatusExpression,
  slaRiskExpression,
};
