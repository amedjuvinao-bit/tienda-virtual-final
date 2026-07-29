'use strict';

const {
  ERROR_STATUSES,
  firstPresentExpression,
  hasValueExpression,
} = require('./billingReports/reportAggregationExpressions');
const {
  buildCommonReportStages,
} = require('./billingReports/reportAggregationStages');

function metricGroupStage() {
  const isInvoice = { $eq: ['$_billingDocumentType', 'invoice'] };
  const isCreditNote = { $eq: ['$_billingDocumentType', 'credit_note'] };
  const validInvoice = { $and: [isInvoice, '$_billingValidated'] };
  const validCreditNote = { $and: [isCreditNote, '$_billingValidated'] };

  return {
    $group: {
      _id: null,
      documents: { $sum: 1 },
      invoices: { $sum: { $cond: [isInvoice, 1, 0] } },
      validatedInvoices: { $sum: { $cond: [validInvoice, 1, 0] } },
      creditNotes: { $sum: { $cond: [isCreditNote, 1, 0] } },
      validatedCreditNotes: { $sum: { $cond: [validCreditNote, 1, 0] } },
      errors: {
        $sum: {
          $cond: [{ $in: ['$_billingStatus', ERROR_STATUSES] }, 1, 0],
        },
      },
      invoiced: {
        $sum: { $cond: [validInvoice, '$_billingTotal', 0] },
      },
      credited: {
        $sum: { $cond: [validCreditNote, '$_billingTotal', 0] },
      },
      discounts: {
        $sum: { $cond: [validInvoice, '$_billingTotalDiscount', 0] },
      },
      shipping: {
        $sum: { $cond: [validInvoice, '$_billingShipping', 0] },
      },
      invoiceTaxableBase: {
        $sum: { $cond: [validInvoice, '$_billingTaxableBase', 0] },
      },
      creditedTaxableBase: {
        $sum: { $cond: [validCreditNote, '$_billingTaxableBase', 0] },
      },
      invoiceTax: {
        $sum: { $cond: [validInvoice, '$_billingTaxAmount', 0] },
      },
      creditedTax: {
        $sum: { $cond: [validCreditNote, '$_billingTaxAmount', 0] },
      },
    },
  };
}

function metricProjectStage() {
  return {
    $project: {
      _id: 0,
      documents: 1,
      invoices: 1,
      validatedInvoices: 1,
      creditNotes: 1,
      validatedCreditNotes: 1,
      errors: 1,
      invoiced: { $round: ['$invoiced', 2] },
      credited: { $round: ['$credited', 2] },
      net: { $round: [{ $subtract: ['$invoiced', '$credited'] }, 2] },
      discounts: { $round: ['$discounts', 2] },
      shipping: { $round: ['$shipping', 2] },
      taxableBase: {
        $round: [
          { $subtract: ['$invoiceTaxableBase', '$creditedTaxableBase'] },
          2,
        ],
      },
      invoiceTax: { $round: ['$invoiceTax', 2] },
      creditedTax: { $round: ['$creditedTax', 2] },
      netTax: {
        $round: [{ $subtract: ['$invoiceTax', '$creditedTax'] }, 2],
      },
    },
  };
}

function breakdownFacet(groupField, labelField, sort) {
  const isInvoice = { $eq: ['$_billingDocumentType', 'invoice'] };
  const isCreditNote = { $eq: ['$_billingDocumentType', 'credit_note'] };
  const validInvoice = { $and: [isInvoice, '$_billingValidated'] };
  const validCreditNote = { $and: [isCreditNote, '$_billingValidated'] };

  return [
    {
      $group: {
        _id: groupField,
        label: { $first: labelField },
        documents: { $sum: 1 },
        invoices: { $sum: { $cond: [isInvoice, 1, 0] } },
        creditNotes: { $sum: { $cond: [isCreditNote, 1, 0] } },
        invoiced: {
          $sum: { $cond: [validInvoice, '$_billingTotal', 0] },
        },
        credited: {
          $sum: { $cond: [validCreditNote, '$_billingTotal', 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        key: '$_id',
        label: 1,
        documents: 1,
        invoices: 1,
        creditNotes: 1,
        invoiced: { $round: ['$invoiced', 2] },
        credited: { $round: ['$credited', 2] },
        net: { $round: [{ $subtract: ['$invoiced', '$credited'] }, 2] },
      },
    },
    { $sort: sort },
  ];
}

function reportRowProjection() {
  const invoiceNumber = firstPresentExpression([
    '$invoiceNumber',
    '$provider.number',
  ], 'Sin número');
  const noteNumber = firstPresentExpression([
    '$_billingNote.provider.number',
    '$_billingNote.number',
    '$_billingNote.referenceCode',
  ], 'Sin número');
  const noteId = firstPresentExpression(['$_billingNote._id'], null);

  return {
    _id: 0,
    id: {
      $cond: [
        { $eq: ['$_billingDocumentType', 'invoice'] },
        { $toString: '$_id' },
        {
          $cond: [
            hasValueExpression(noteId),
            { $toString: noteId },
            {
              $concat: [
                { $toString: '$_id' },
                '-',
                { $toString: '$_billingNoteIndex' },
              ],
            },
          ],
        },
      ],
    },
    documentType: '$_billingDocumentType',
    date: '$_billingDate',
    dateKey: '$_billingDateKey',
    number: {
      $cond: [
        { $eq: ['$_billingDocumentType', 'invoice'] },
        invoiceNumber,
        noteNumber,
      ],
    },
    referenceNumber: {
      $cond: [
        { $eq: ['$_billingDocumentType', 'credit_note'] },
        firstPresentExpression([
          '$invoiceNumber',
          '$provider.number',
          '$_billingNote.billNumber',
        ], ''),
        '',
      ],
    },
    orderNumber: firstPresentExpression([
      '$orderNumber',
      '$_billingOrder.orderNumber',
    ], ''),
    status: '$_billingStatus',
    validated: '$_billingValidated',
    customer: '$customer',
    channelKey: '$_billingChannelKey',
    channel: '$_billingChannelLabel',
    paymentMethodKey: '$_billingPaymentKey',
    paymentMethod: '$_billingPaymentLabel',
    subtotal: '$_billingSubtotal',
    productDiscount: '$_billingProductDiscount',
    shippingDiscount: '$_billingShippingDiscount',
    totalDiscount: '$_billingTotalDiscount',
    shipping: '$_billingShipping',
    taxableBase: '$_billingTaxableBase',
    taxAmount: '$_billingTaxAmount',
    total: '$_billingTotal',
  };
}

function buildBillingReportPipeline({
  filters,
  orderCollectionName,
  rowLimit = 30,
} = {}) {
  return [
    ...buildCommonReportStages({ filters, orderCollectionName }),
    {
      $facet: {
        metrics: [
          metricGroupStage(),
          metricProjectStage(),
        ],
        statuses: breakdownFacet(
          '$_billingStatus',
          '$_billingStatus',
          { documents: -1, key: 1 }
        ),
        paymentMethods: breakdownFacet(
          '$_billingPaymentKey',
          '$_billingPaymentLabel',
          { net: -1, documents: -1, key: 1 }
        ),
        channels: breakdownFacet(
          '$_billingChannelKey',
          '$_billingChannelLabel',
          { net: -1, documents: -1, key: 1 }
        ),
        daily: breakdownFacet(
          '$_billingDateKey',
          '$_billingDateKey',
          { key: 1 }
        ),
        rows: [
          {
            $sort: {
              _billingDate: -1,
              _id: -1,
              _billingNoteIndex: -1,
            },
          },
          { $limit: Math.max(1, Number(rowLimit) || 30) },
          { $project: reportRowProjection() },
        ],
      },
    },
  ];
}

function buildBillingReportCountPipeline({
  filters,
  orderCollectionName,
} = {}) {
  return [
    ...buildCommonReportStages({ filters, orderCollectionName }),
    { $count: 'totalRows' },
  ];
}

function buildBillingReportRowsPipeline({
  filters,
  orderCollectionName,
} = {}) {
  return [
    ...buildCommonReportStages({ filters, orderCollectionName }),
    {
      $sort: {
        _billingDate: -1,
        _id: -1,
        _billingNoteIndex: -1,
      },
    },
    { $project: reportRowProjection() },
  ];
}

module.exports = {
  buildBillingReportCountPipeline,
  buildBillingReportPipeline,
  buildBillingReportRowsPipeline,
  buildCommonReportStages,
};
