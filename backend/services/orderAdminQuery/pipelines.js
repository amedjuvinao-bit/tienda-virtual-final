'use strict';

const ElectronicInvoice = require('../../models/ElectronicInvoice');
const {
  CANCELLED_STATUSES,
  PAID_STATUSES,
  PENDING_STATUSES,
} = require('./constants');
const {
  buildInvoiceFilterStage,
  buildInvoiceLookupStage,
  combineFilters,
  hasInvoiceExpression,
  hasValidatedInvoiceExpression,
  isNoChargeExchangeExpression,
} = require('./invoiceExpressions');
const {
  buildOperationalSummaryPipeline,
  buildOperationalViewCriteria,
} = require('./operationalExpressions');
const {
  buildAdminOrderListProjectionStage,
} = require('./listProjection');

function buildPagePipeline({
  filter,
  invoiceFilter,
  operationalView = 'all',
  now = new Date(),
  sort,
  skip,
  limit,
  cursorCriteria = null,
  cursorMode = false,
  ElectronicInvoiceModel = ElectronicInvoice,
}) {
  const operationalCriteria = buildOperationalViewCriteria(
    operationalView,
    now
  );
  const scopedFilter = combineFilters(filter, operationalCriteria);
  const pipeline = [
    { $match: combineFilters(scopedFilter, cursorCriteria) },
  ];
  const invoiceStage = buildInvoiceFilterStage(invoiceFilter);

  if (invoiceStage) {
    pipeline.push(buildInvoiceLookupStage(ElectronicInvoiceModel), invoiceStage);
  }

  pipeline.push({ $sort: sort });
  if (!cursorMode) pipeline.push({ $skip: skip });
  pipeline.push(
    { $limit: limit },
    buildAdminOrderListProjectionStage()
  );

  return pipeline;
}

function buildSummaryPipeline({
  filter,
  invoiceFilter,
  operationalView = 'all',
  now = new Date(),
  ElectronicInvoiceModel = ElectronicInvoice,
}) {
  const pipeline = [
    { $match: filter },
    buildInvoiceLookupStage(ElectronicInvoiceModel),
  ];
  const invoiceStage = buildInvoiceFilterStage(invoiceFilter);
  if (invoiceStage) pipeline.push(invoiceStage);

  const operationalCriteria = buildOperationalViewCriteria(
    operationalView,
    now
  );
  const financialPipeline = [];
  const countsAsCommercialSale = { $not: [isNoChargeExchangeExpression()] };
  if (operationalCriteria) financialPipeline.push({ $match: operationalCriteria });

  financialPipeline.push(
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSales: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', PAID_STATUSES] },
                  countsAsCommercialSale,
                ],
              },
              { $ifNull: ['$total', 0] },
              0,
            ],
          },
        },
        pendingAmount: {
          $sum: {
            $cond: [
              { $in: ['$status', PENDING_STATUSES] },
              { $ifNull: ['$total', 0] },
              0,
            ],
          },
        },
        paidOrders: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', PAID_STATUSES] },
                  countsAsCommercialSale,
                ],
              },
              1,
              0,
            ],
          },
        },
        pendingOrders: {
          $sum: { $cond: [{ $in: ['$status', PENDING_STATUSES] }, 1, 0] },
        },
        cancelledOrders: {
          $sum: { $cond: [{ $in: ['$status', CANCELLED_STATUSES] }, 1, 0] },
        },
        invoiceRequiredOrders: {
          $sum: { $cond: [countsAsCommercialSale, 1, 0] },
        },
        withInvoiceOrders: {
          $sum: {
            $cond: [
              { $and: [countsAsCommercialSale, hasInvoiceExpression()] },
              1,
              0,
            ],
          },
        },
        validatedInvoiceOrders: {
          $sum: {
            $cond: [
              {
                $and: [
                  countsAsCommercialSale,
                  hasValidatedInvoiceExpression(),
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalOrders: 1,
        totalSales: 1,
        pendingAmount: 1,
        paidOrders: 1,
        pendingOrders: 1,
        cancelledOrders: 1,
        invoiceRequiredOrders: 1,
        withInvoiceOrders: 1,
        validatedInvoiceOrders: 1,
        averageTicket: {
          $cond: [
            { $gt: ['$paidOrders', 0] },
            { $divide: ['$totalSales', '$paidOrders'] },
            0,
          ],
        },
      },
    }
  );

  pipeline.push(
    {
      $facet: {
        financial: financialPipeline,
        operational: buildOperationalSummaryPipeline(now),
      },
    },
    {
      $project: {
        financial: { $arrayElemAt: ['$financial', 0] },
        operational: { $arrayElemAt: ['$operational', 0] },
      },
    }
  );

  return pipeline;
}

module.exports = {
  buildPagePipeline,
  buildSummaryPipeline,
};
