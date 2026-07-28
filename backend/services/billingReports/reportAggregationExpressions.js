'use strict';

const REPORT_STATUSES = [
  'pending',
  'processing',
  'generated',
  'created',
  'sent',
  'validated',
  'rejected',
  'failed',
  'error',
  'deleted',
];
const VALIDATED_STATUSES = ['accepted', 'validated', 'validada', 'validado'];
const ERROR_STATUSES = ['rejected', 'failed', 'error'];
const DEFAULT_ORDER_COLLECTION = 'orders';

function safeCollectionName(value) {
  const name = String(value || '').trim();
  return /^[a-zA-Z0-9_.-]+$/.test(name)
    ? name
    : DEFAULT_ORDER_COLLECTION;
}

function coalesceExpressions(values = [], fallback = null) {
  return values.reduceRight(
    (next, value) => ({ $ifNull: [value, next] }),
    fallback
  );
}

function hasValueExpression(value) {
  return {
    $and: [
      { $ne: [value, null] },
      { $ne: [value, ''] },
    ],
  };
}

function firstPresentExpression(values = [], fallback = null) {
  return values.reduceRight(
    (next, value) => ({
      $cond: [
        hasValueExpression(value),
        value,
        next,
      ],
    }),
    fallback
  );
}

function normalizedStringExpression(values = [], fallback = '') {
  return {
    $toLower: {
      $trim: {
        input: {
          $toString: firstPresentExpression(values, fallback),
        },
      },
    },
  };
}

function dateExpression(values = []) {
  return {
    $convert: {
      input: firstPresentExpression(values, null),
      to: 'date',
      onError: null,
      onNull: null,
    },
  };
}

function moneyExpression(value) {
  return {
    $round: [
      {
        $convert: {
          input: value,
          to: 'double',
          onError: 0,
          onNull: 0,
        },
      },
      2,
    ],
  };
}

function candidateDateFilter(filters) {
  const range = { $gte: filters.fromDate, $lt: filters.toExclusive };
  const clauses = [];

  if (filters.type !== 'credit_note') {
    clauses.push(
      { createdAt: range },
      { generatedAt: range },
      { acceptedAt: range },
      {
        'provider.validatedAt': {
          $gte: filters.from,
          $lte: `${filters.to}T23:59:59`,
        },
      },
      {
        'dianResponse.issueDate': {
          $gte: filters.from,
          $lte: filters.to,
        },
      }
    );
  }

  if (filters.type !== 'invoice') {
    clauses.push(
      { 'creditNotes.createdAt': range },
      { 'creditNotes.validatedAt': range },
      {
        'creditNotes.provider.validatedAt': {
          $gte: filters.from,
          $lte: `${filters.to}T23:59:59`,
        },
      }
    );
  }

  return { $or: clauses };
}

function invoiceValidationExpression() {
  return {
    $or: [
      {
        $in: [
          normalizedStringExpression(['$status']),
          VALIDATED_STATUSES,
        ],
      },
      {
        $in: [
          normalizedStringExpression([
            '$provider.status',
            '$dianResponse.code',
          ]),
          VALIDATED_STATUSES,
        ],
      },
      { $eq: ['$provider.isValidated', true] },
      hasValueExpression('$provider.validatedAt'),
      hasValueExpression('$acceptedAt'),
    ],
  };
}

function creditNoteValidationExpression() {
  return {
    $or: [
      {
        $in: [
          normalizedStringExpression(['$_billingNote.status']),
          VALIDATED_STATUSES,
        ],
      },
      {
        $in: [
          normalizedStringExpression(['$_billingNote.provider.status']),
          VALIDATED_STATUSES,
        ],
      },
      { $eq: ['$_billingNote.provider.isValidated', true] },
      hasValueExpression('$_billingNote.provider.validatedAt'),
      hasValueExpression('$_billingNote.validatedAt'),
    ],
  };
}

function invoiceAmountExpression(field, fallbackValues = []) {
  const hasInvoiceTotals = {
    $eq: [{ $type: '$totals' }, 'object'],
  };
  const invoiceValues = [`$totals.${field}`, ...fallbackValues];
  const orderValues = [`$_billingOrder.pricing.${field}`, ...fallbackValues];

  return moneyExpression({
    $cond: [
      hasInvoiceTotals,
      coalesceExpressions(invoiceValues, 0),
      coalesceExpressions(orderValues, 0),
    ],
  });
}

function channelKeyExpression() {
  const source = normalizedStringExpression([
    '$_billingOrder.source',
    '$_billingOrder.channel',
  ], 'unknown');

  return {
    $switch: {
      branches: [
        { case: { $in: [source, ['pos', 'physical_store']] }, then: 'pos' },
        { case: { $in: [source, ['online', 'web', 'storefront']] }, then: 'online' },
        { case: { $in: [source, ['manual', 'admin']] }, then: 'manual' },
      ],
      default: source,
    },
  };
}

function channelLabelExpression() {
  return {
    $switch: {
      branches: [
        { case: { $eq: ['$_billingChannelKey', 'pos'] }, then: 'POS' },
        { case: { $eq: ['$_billingChannelKey', 'online'] }, then: 'Tienda web' },
        { case: { $eq: ['$_billingChannelKey', 'manual'] }, then: 'Manual' },
        { case: { $eq: ['$_billingChannelKey', 'unknown'] }, then: 'Sin canal' },
      ],
      default: '$_billingChannelKey',
    },
  };
}

function paymentKeyExpression() {
  const splitCount = {
    $cond: [
      { $isArray: '$_billingOrder.payment.splitPayments' },
      { $size: '$_billingOrder.payment.splitPayments' },
      0,
    ],
  };

  return {
    $cond: [
      { $gt: [splitCount, 1] },
      'split',
      normalizedStringExpression([
        '$_billingOrder.payment.method',
        '$_billingOrder.payment.provider',
      ], 'unknown'),
    ],
  };
}

function paymentLabelExpression() {
  const explicitLabel = firstPresentExpression([
    '$_billingOrder.payment.methodLabel',
    '$_billingOrder.payment.providerLabel',
  ], '');
  const defaultLabel = {
    $switch: {
      branches: [
        { case: { $eq: ['$_billingPaymentKey', 'split'] }, then: 'Pago dividido' },
        { case: { $in: ['$_billingPaymentKey', ['cash', 'efectivo']] }, then: 'Efectivo' },
        { case: { $in: ['$_billingPaymentKey', ['card', 'tarjeta']] }, then: 'Tarjeta' },
        { case: { $in: ['$_billingPaymentKey', ['transfer', 'transferencia']] }, then: 'Transferencia' },
        { case: { $eq: ['$_billingPaymentKey', 'wompi'] }, then: 'Wompi' },
        { case: { $eq: ['$_billingPaymentKey', 'payu'] }, then: 'PayU' },
        { case: { $eq: ['$_billingPaymentKey', 'pos'] }, then: 'POS' },
        { case: { $eq: ['$_billingPaymentKey', 'manual'] }, then: 'Manual' },
        { case: { $eq: ['$_billingPaymentKey', 'unknown'] }, then: 'Sin medio de pago' },
      ],
      default: '$_billingPaymentKey',
    },
  };

  return {
    $cond: [
      hasValueExpression(explicitLabel),
      explicitLabel,
      defaultLabel,
    ],
  };
}

function buildDocumentCandidatesExpression(filters) {
  const parts = [];

  if (filters.type !== 'credit_note') {
    parts.push([
      {
        kind: 'invoice',
        note: null,
        index: -1,
      },
    ]);
  }

  if (filters.type !== 'invoice') {
    parts.push({
      $map: {
        input: {
          $range: [
            0,
            { $size: { $ifNull: ['$creditNotes', []] } },
          ],
        },
        as: 'noteIndex',
        in: {
          kind: 'credit_note',
          note: {
            $arrayElemAt: [
              { $ifNull: ['$creditNotes', []] },
              '$$noteIndex',
            ],
          },
          index: '$$noteIndex',
        },
      },
    });
  }

  if (parts.length === 1) return parts[0];
  return { $concatArrays: parts };
}

module.exports = {
  DEFAULT_ORDER_COLLECTION,
  ERROR_STATUSES,
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
  hasValueExpression,
  invoiceAmountExpression,
  invoiceValidationExpression,
  moneyExpression,
  normalizedStringExpression,
  paymentKeyExpression,
  paymentLabelExpression,
  safeCollectionName,
};
