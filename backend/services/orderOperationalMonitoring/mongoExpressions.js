'use strict';

const {
  ACTIVE_SLA_STATUSES,
  TRANSIT_STATUSES,
} = require('./constants');

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
            $in: [lower('$$shipment.status'), ['ready_to_pick', 'picking']],
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

module.exports = {
  anyOpenIncidentExpression,
  anyShipmentExpression,
  hasActivePhysicalAllocationExpression,
  hasConfirmedPaymentExpression,
  lower,
  relevantShipmentDueAtExpression,
  shipmentSlaExpression,
};
