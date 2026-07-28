'use strict';

const {
  DEFAULT_ORDER_COLLECTION,
  REPORT_STATUSES,
  VALIDATED_STATUSES,
  buildDocumentCandidatesExpression,
  candidateDateFilter,
  channelKeyExpression,
  channelLabelExpression,
  coalesceExpressions,
  creditNoteValidationExpression,
  dateExpression,
  firstPresentExpression,
  invoiceAmountExpression,
  invoiceValidationExpression,
  moneyExpression,
  normalizedStringExpression,
  paymentKeyExpression,
  paymentLabelExpression,
  safeCollectionName,
} = require('./reportAggregationExpressions');

function buildCommonReportStages({
  filters,
  orderCollectionName = DEFAULT_ORDER_COLLECTION,
} = {}) {
  const invoiceSubtotal = invoiceAmountExpression(
    'subtotal',
    ['$_billingOrder.subtotal']
  );
  const invoiceProductDiscount = invoiceAmountExpression(
    'productDiscount',
    ['$_billingOrder.discount.amount']
  );
  const invoiceShippingDiscount = invoiceAmountExpression(
    'shippingDiscount'
  );
  const invoiceShipping = invoiceAmountExpression(
    'shipping',
    ['$_billingOrder.shipping']
  );
  const invoiceTax = invoiceAmountExpression(
    'taxAmount',
    ['$_billingOrder.taxes.iva.amount']
  );
  const invoiceTotal = invoiceAmountExpression(
    'total',
    ['$_billingOrder.total']
  );
  const noteSubtotal = moneyExpression('$_billingNote.subtotal');
  const noteTotal = moneyExpression(
    firstPresentExpression([
      '$_billingNote.totalAmount',
      '$_billingNote.total',
      '$_billingNote.amount',
    ], 0)
  );

  const stages = [
    { $match: candidateDateFilter(filters) },
    {
      $lookup: {
        from: safeCollectionName(orderCollectionName),
        let: { reportOrderId: '$orderId' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$_id', '$$reportOrderId'] },
            },
          },
          {
            $project: {
              orderNumber: 1,
              source: 1,
              channel: 1,
              saleType: 1,
              payment: 1,
              subtotal: 1,
              shipping: 1,
              total: 1,
              taxes: 1,
              discount: 1,
              pricing: 1,
            },
          },
          { $limit: 1 },
        ],
        as: '_billingOrders',
      },
    },
    {
      $set: {
        _billingOrder: {
          $ifNull: [{ $arrayElemAt: ['$_billingOrders', 0] }, {}],
        },
        _billingDocuments: buildDocumentCandidatesExpression(filters),
      },
    },
    { $unwind: '$_billingDocuments' },
    {
      $set: {
        _billingDocumentType: '$_billingDocuments.kind',
        _billingNote: '$_billingDocuments.note',
        _billingNoteIndex: '$_billingDocuments.index',
        _billingDate: {
          $cond: [
            { $eq: ['$_billingDocuments.kind', 'invoice'] },
            dateExpression([
              '$generatedAt',
              '$acceptedAt',
              '$provider.validatedAt',
              '$dianResponse.issueDate',
              '$createdAt',
            ]),
            dateExpression([
              '$_billingDocuments.note.validatedAt',
              '$_billingDocuments.note.provider.validatedAt',
              '$_billingDocuments.note.createdAt',
            ]),
          ],
        },
      },
    },
    {
      $match: {
        _billingDate: {
          $gte: filters.fromDate,
          $lt: filters.toExclusive,
        },
      },
    },
    {
      $set: {
        _billingValidated: {
          $cond: [
            { $eq: ['$_billingDocumentType', 'invoice'] },
            invoiceValidationExpression(),
            creditNoteValidationExpression(),
          ],
        },
        _billingRawStatus: {
          $cond: [
            { $eq: ['$_billingDocumentType', 'invoice'] },
            normalizedStringExpression([
              '$status',
              '$provider.status',
            ], 'pending'),
            normalizedStringExpression([
              '$_billingNote.status',
              '$_billingNote.provider.status',
            ], 'pending'),
          ],
        },
        _billingSubtotal: {
          $cond: [
            { $eq: ['$_billingDocumentType', 'invoice'] },
            invoiceSubtotal,
            noteSubtotal,
          ],
        },
        _billingProductDiscount: {
          $cond: [
            { $eq: ['$_billingDocumentType', 'invoice'] },
            invoiceProductDiscount,
            0,
          ],
        },
        _billingShippingDiscount: {
          $cond: [
            { $eq: ['$_billingDocumentType', 'invoice'] },
            invoiceShippingDiscount,
            0,
          ],
        },
        _billingShipping: {
          $cond: [
            { $eq: ['$_billingDocumentType', 'invoice'] },
            invoiceShipping,
            0,
          ],
        },
        _billingTaxAmount: {
          $cond: [
            { $eq: ['$_billingDocumentType', 'invoice'] },
            invoiceTax,
            moneyExpression('$_billingNote.taxAmount'),
          ],
        },
        _billingTotal: {
          $cond: [
            { $eq: ['$_billingDocumentType', 'invoice'] },
            invoiceTotal,
            noteTotal,
          ],
        },
        _billingChannelKey: channelKeyExpression(),
        _billingPaymentKey: paymentKeyExpression(),
      },
    },
    {
      $set: {
        _billingStatus: {
          $switch: {
            branches: [
              {
                case: { $eq: ['$_billingValidated', true] },
                then: 'validated',
              },
              {
                case: {
                  $in: ['$_billingRawStatus', VALIDATED_STATUSES],
                },
                then: 'validated',
              },
              {
                case: {
                  $in: ['$_billingRawStatus', REPORT_STATUSES],
                },
                then: '$_billingRawStatus',
              },
            ],
            default: 'pending',
          },
        },
        _billingTotalDiscount: {
          $cond: [
            { $eq: ['$_billingDocumentType', 'invoice'] },
            moneyExpression({
              $cond: [
                { $eq: [{ $type: '$totals' }, 'object'] },
                coalesceExpressions([
                  '$totals.totalDiscount',
                  {
                    $add: [
                      '$_billingProductDiscount',
                      '$_billingShippingDiscount',
                    ],
                  },
                ], 0),
                coalesceExpressions([
                  '$_billingOrder.pricing.totalDiscount',
                  {
                    $add: [
                      '$_billingProductDiscount',
                      '$_billingShippingDiscount',
                    ],
                  },
                ], 0),
              ],
            }),
            0,
          ],
        },
        _billingTaxableBase: {
          $cond: [
            { $eq: ['$_billingDocumentType', 'invoice'] },
            moneyExpression({
              $cond: [
                { $eq: [{ $type: '$totals' }, 'object'] },
                coalesceExpressions([
                  '$totals.taxableBase',
                  '$_billingOrder.taxes.iva.taxableBase',
                  {
                    $subtract: [
                      '$_billingSubtotal',
                      '$_billingProductDiscount',
                    ],
                  },
                ], 0),
                coalesceExpressions([
                  '$_billingOrder.pricing.taxableBase',
                  '$_billingOrder.taxes.iva.taxableBase',
                  {
                    $subtract: [
                      '$_billingSubtotal',
                      '$_billingProductDiscount',
                    ],
                  },
                ], 0),
              ],
            }),
            noteSubtotal,
          ],
        },
        _billingChannelLabel: channelLabelExpression(),
        _billingPaymentLabel: paymentLabelExpression(),
        _billingDateKey: {
          $dateToString: {
            date: '$_billingDate',
            format: '%Y-%m-%d',
            timezone: 'America/Bogota',
          },
        },
      },
    },
  ];

  if (filters.status !== 'all') {
    stages.push({
      $match: { _billingStatus: filters.status },
    });
  }

  return stages;
}

module.exports = {
  buildCommonReportStages,
};
