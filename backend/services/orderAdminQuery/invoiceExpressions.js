'use strict';

const ElectronicInvoice = require('../../models/ElectronicInvoice');
const {
  INVOICE_FILTER_CRITERIA,
  VALIDATED_INVOICE_STATUSES,
} = require('./constants');

function combineFilters(filter, extraCriteria) {
  if (!extraCriteria) return filter;
  if (!filter || Object.keys(filter).length === 0) return extraCriteria;
  return { $and: [filter, extraCriteria] };
}

function buildInvoiceLookupStage(ElectronicInvoiceModel = ElectronicInvoice) {
  return {
    $lookup: {
      from: ElectronicInvoiceModel.collection.name,
      let: { scopedOrderId: '$_id' },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ['$orderId', '$$scopedOrderId'] },
          },
        },
        {
          $project: {
            orderId: 1,
            status: 1,
            validatedAt: 1,
            cufe: 1,
            invoiceNumber: 1,
            'provider.status': 1,
            'provider.cufe': 1,
            'provider.number': 1,
            'provider.isValidated': 1,
            'provider.validatedAt': 1,
            'provider.raw.status': 1,
            'provider.raw.cufe': 1,
            'provider.raw.number': 1,
            'provider.raw.is_validated': 1,
            'provider.raw.validated_at': 1,
            'provider.raw.data.status': 1,
            'provider.raw.data.cufe': 1,
            'dianResponse.raw.data.data.cufe': 1,
            'dianResponse.raw.data.data.number': 1,
            'dianResponse.raw.data.data.is_validated': 1,
            'dianResponse.raw.data.data.validated_at': 1,
            errors: 1,
            providerErrors: 1,
            creditNotes: 1,
          },
        },
      ],
      as: '_adminInvoices',
    },
  };
}

function buildNoChargeExchangeExclusion() {
  return {
    $nor: [
      { total: { $lte: 0 }, 'exchangeOrigin.type': 'rma_exchange' },
      { total: { $lte: 0 }, 'payment.method': /^exchange$/i },
      { total: { $lte: 0 }, sessionId: /^exchange:/i },
      {
        source: 'system',
        saleType: 'system_order',
        total: { $lte: 0 },
        tags: 'exchange',
      },
    ],
  };
}

function buildInvoiceFilterStage(invoiceFilter) {
  if (invoiceFilter === 'all') return null;
  if (invoiceFilter === 'without_invoice') {
    return {
      $match: {
        '_adminInvoices.0': { $exists: false },
        ...buildNoChargeExchangeExclusion(),
      },
    };
  }

  const criteria = INVOICE_FILTER_CRITERIA[invoiceFilter] || [];
  return {
    $match: {
      _adminInvoices: { $elemMatch: { $or: criteria } },
    },
  };
}

function hasInvoiceExpression() {
  return { $gt: [{ $size: { $ifNull: ['$_adminInvoices', []] } }, 0] };
}

function isNoChargeExchangeExpression() {
  const totalIsZero = { $lte: [{ $ifNull: ['$total', 0] }, 0] };

  return {
    $and: [
      totalIsZero,
      {
        $or: [
          {
            $eq: [
              { $toLower: { $ifNull: ['$exchangeOrigin.type', ''] } },
              'rma_exchange',
            ],
          },
          {
            $eq: [
              { $toLower: { $ifNull: ['$payment.method', ''] } },
              'exchange',
            ],
          },
          {
            $regexMatch: {
              input: { $ifNull: ['$sessionId', ''] },
              regex: /^exchange:/i,
            },
          },
          {
            $and: [
              {
                $eq: [
                  { $toLower: { $ifNull: ['$source', ''] } },
                  'system',
                ],
              },
              {
                $eq: [
                  { $toLower: { $ifNull: ['$saleType', ''] } },
                  'system_order',
                ],
              },
              { $in: ['exchange', { $ifNull: ['$tags', []] }] },
            ],
          },
        ],
      },
    ],
  };
}

function hasValidatedInvoiceExpression() {
  const nonEmpty = (path) => ({ $ne: [{ $ifNull: [path, ''] }, ''] });
  const present = (path) => ({ $ne: [{ $ifNull: [path, null] }, null] });
  const normalizedStatus = (path) => ({
    $toLower: { $ifNull: [path, ''] },
  });

  return {
    $anyElementTrue: {
      $map: {
        input: { $ifNull: ['$_adminInvoices', []] },
        as: 'invoice',
        in: {
          $or: [
            { $in: [normalizedStatus('$$invoice.status'), VALIDATED_INVOICE_STATUSES] },
            {
              $in: [
                normalizedStatus('$$invoice.provider.status'),
                VALIDATED_INVOICE_STATUSES,
              ],
            },
            present('$$invoice.validatedAt'),
            present('$$invoice.provider.validatedAt'),
            nonEmpty('$$invoice.cufe'),
            nonEmpty('$$invoice.invoiceNumber'),
            nonEmpty('$$invoice.provider.cufe'),
            nonEmpty('$$invoice.provider.number'),
            { $eq: ['$$invoice.provider.isValidated', true] },
            nonEmpty('$$invoice.provider.raw.cufe'),
            nonEmpty('$$invoice.provider.raw.number'),
            { $eq: ['$$invoice.provider.raw.is_validated', true] },
            nonEmpty('$$invoice.dianResponse.raw.data.data.cufe'),
            nonEmpty('$$invoice.dianResponse.raw.data.data.number'),
            { $eq: ['$$invoice.dianResponse.raw.data.data.is_validated', true] },
          ],
        },
      },
    },
  };
}

module.exports = {
  buildInvoiceFilterStage,
  buildInvoiceLookupStage,
  buildNoChargeExchangeExclusion,
  combineFilters,
  hasInvoiceExpression,
  hasValidatedInvoiceExpression,
  isNoChargeExchangeExpression,
};
