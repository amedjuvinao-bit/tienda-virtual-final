'use strict';

// Consultas de lectura del panel de Facturación.
// La paginación, los conteos y la exclusión de órdenes facturadas se resuelven
// dentro de MongoDB para que Node no cargue colecciones completas en memoria.

const VALIDATED_INVOICE_STATUSES = [
  'accepted',
  'validated',
  'validada',
  'validado',
];
const ERROR_INVOICE_STATUSES = ['rejected', 'failed', 'error'];
const DEFAULT_INVOICE_COLLECTION = 'electronicinvoices';

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function safeCollectionName(value) {
  const name = String(value || '').trim();
  return /^[a-zA-Z0-9_.-]+$/.test(name)
    ? name
    : DEFAULT_INVOICE_COLLECTION;
}

function normalizedStringExpression(paths = [], fallback = '') {
  return paths.reduceRight(
    (fallbackExpression, path) => ({
      $let: {
        vars: {
          value: {
            $toString: {
              $ifNull: [path, ''],
            },
          },
        },
        in: {
          $cond: [
            {
              $gt: [
                {
                  $strLenCP: {
                    $trim: { input: '$$value' },
                  },
                },
                0,
              ],
            },
            {
              $toLower: {
                $trim: { input: '$$value' },
              },
            },
            fallbackExpression,
          ],
        },
      },
    }),
    fallback
  );
}

function buildCreditNoteElementPrefilter(status, type) {
  const conditions = [];

  if (status && status !== 'all') {
    const statusConditions = [
      { status },
      {
        $and: [
          { status: { $in: ['', null] } },
          { 'provider.status': status },
        ],
      },
    ];

    if (status === 'created') {
      statusConditions.push({
        $and: [
          { status: { $in: ['', null] } },
          { 'provider.status': { $in: ['', null] } },
        ],
      });
    }

    conditions.push({ $or: statusConditions });
  }

  if (type && type !== 'all') {
    conditions.push(
      type === 'total'
        ? { $or: [{ type: 'total' }, { type: { $in: ['', null] } }] }
        : { type }
    );
  }

  if (!conditions.length) return null;
  return {
    $elemMatch: conditions.length === 1
      ? conditions[0]
      : { $and: conditions },
  };
}

function buildCreditNotesPaginationPipeline({
  invoiceFilter = {},
  status = 'all',
  type = 'all',
  skip = 0,
  limit = 20,
} = {}) {
  const normalizedStatus = String(status || 'all').trim().toLowerCase();
  const normalizedType = String(type || 'all').trim().toLowerCase();
  const elementPrefilter = buildCreditNoteElementPrefilter(
    normalizedStatus,
    normalizedType
  );
  const initialFilter = elementPrefilter
    ? {
        $and: [
          invoiceFilter,
          { creditNotes: elementPrefilter },
        ],
      }
    : invoiceFilter;
  const noteMatch = {};

  if (normalizedStatus && normalizedStatus !== 'all') {
    noteMatch._billingCreditNoteStatus = normalizedStatus;
  }
  if (normalizedType && normalizedType !== 'all') {
    noteMatch._billingCreditNoteType = normalizedType;
  }

  const pipeline = [
    { $match: initialFilter },
    {
      $set: {
        _billingCreditNotesCount: {
          $size: { $ifNull: ['$creditNotes', []] },
        },
      },
    },
    {
      $unwind: {
        path: '$creditNotes',
        includeArrayIndex: '_billingCreditNoteIndex',
      },
    },
    {
      $set: {
        _billingCreditNoteStatus: normalizedStringExpression(
          ['$creditNotes.status', '$creditNotes.provider.status'],
          'created'
        ),
        _billingCreditNoteType: normalizedStringExpression(
          ['$creditNotes.type'],
          'total'
        ),
        _billingCreditNoteSortDate: {
          $ifNull: [
            '$creditNotes.createdAt',
            {
              $ifNull: [
                '$updatedAt',
                { $ifNull: ['$createdAt', new Date(0)] },
              ],
            },
          ],
        },
      },
    },
  ];

  if (Object.keys(noteMatch).length) {
    pipeline.push({ $match: noteMatch });
  }

  pipeline.push(
    {
      $sort: {
        _billingCreditNoteSortDate: -1,
        _id: -1,
        _billingCreditNoteIndex: -1,
      },
    },
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        rows: [
          { $skip: safeNumber(skip) },
          { $limit: Math.max(1, safeNumber(limit, 20)) },
          {
            $project: {
              _billingCreditNoteStatus: 0,
              _billingCreditNoteType: 0,
              _billingCreditNoteSortDate: 0,
            },
          },
        ],
      },
    },
    {
      $project: {
        rows: 1,
        total: {
          $ifNull: [{ $arrayElemAt: ['$metadata.total', 0] }, 0],
        },
      },
    }
  );

  return pipeline;
}

function invoiceLookupStages(invoiceCollectionName) {
  return [
    {
      $lookup: {
        from: safeCollectionName(invoiceCollectionName),
        let: { pendingOrderId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$orderId', '$$pendingOrderId'],
              },
            },
          },
          { $sort: { createdAt: -1, _id: -1 } },
          { $limit: 1 },
          {
            $project: {
              _id: 1,
              status: 1,
              errorMessage: 1,
              providerErrors: 1,
              emission: 1,
              failedAt: 1,
              updatedAt: 1,
            },
          },
        ],
        as: '_billingInvoiceMatch',
      },
    },
    {
      $set: {
        _billingInvoice: {
          $arrayElemAt: ['$_billingInvoiceMatch', 0],
        },
      },
    },
    {
      $match: {
        $or: [
          { '_billingInvoice._id': { $exists: false } },
          { '_billingInvoice.status': { $in: ERROR_INVOICE_STATUSES } },
        ],
      },
    },
  ];
}

function buildPendingOrdersPaginationPipeline({
  orderFilter = {},
  invoiceCollectionName = DEFAULT_INVOICE_COLLECTION,
  skip = 0,
  limit = 20,
} = {}) {
  return [
    { $match: orderFilter },
    { $sort: { createdAt: -1, _id: -1 } },
    ...invoiceLookupStages(invoiceCollectionName),
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        rows: [
          { $skip: safeNumber(skip) },
          { $limit: Math.max(1, safeNumber(limit, 20)) },
          { $project: { _billingInvoiceMatch: 0 } },
        ],
      },
    },
    {
      $project: {
        rows: 1,
        total: {
          $ifNull: [{ $arrayElemAt: ['$metadata.total', 0] }, 0],
        },
      },
    },
  ];
}

function buildPendingOrdersCountPipeline({
  orderFilter = {},
  invoiceCollectionName = DEFAULT_INVOICE_COLLECTION,
} = {}) {
  return [
    { $match: orderFilter },
    ...invoiceLookupStages(invoiceCollectionName),
    { $count: 'pending' },
  ];
}

function lowerStringExpression(path) {
  return {
    $toLower: {
      $toString: {
        $ifNull: [path, ''],
      },
    },
  };
}

function hasValueExpression(path) {
  return {
    $and: [
      { $ne: [path, null] },
      { $ne: [path, ''] },
    ],
  };
}

function buildInvoiceSummaryPipeline() {
  const providerStatusExpression = normalizedStringExpression(
    ['$provider.status', '$dianResponse.code', '$status'],
    ''
  );
  const validatedExpression = {
    $or: [
      {
        $in: [
          lowerStringExpression('$status'),
          VALIDATED_INVOICE_STATUSES,
        ],
      },
      {
        $in: [providerStatusExpression, VALIDATED_INVOICE_STATUSES],
      },
      { $eq: ['$provider.isValidated', true] },
      hasValueExpression('$provider.validatedAt'),
      hasValueExpression('$acceptedAt'),
    ],
  };
  const errorExpression = {
    $or: [
      {
        $in: [
          lowerStringExpression('$status'),
          ERROR_INVOICE_STATUSES,
        ],
      },
      {
        $in: [providerStatusExpression, ERROR_INVOICE_STATUSES],
      },
    ],
  };

  return [
    {
      $group: {
        _id: null,
        emitted: { $sum: 1 },
        validated: {
          $sum: { $cond: [validatedExpression, 1, 0] },
        },
        errors: {
          $sum: { $cond: [errorExpression, 1, 0] },
        },
        creditNotes: {
          $sum: {
            $size: { $ifNull: ['$creditNotes', []] },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        emitted: 1,
        validated: 1,
        errors: 1,
        creditNotes: 1,
      },
    },
  ];
}

function unpackPaginationFacet(result = []) {
  const facet = Array.isArray(result) ? result[0] || {} : {};
  return {
    rows: Array.isArray(facet.rows) ? facet.rows : [],
    total: safeNumber(facet.total),
  };
}

async function runBillingAggregation(Model, pipeline, options = {}) {
  const aggregation = Model.aggregate(pipeline);

  if (aggregation && typeof aggregation.option === 'function') {
    aggregation.option({
      allowDiskUse: true,
      maxTimeMS: Math.max(1000, safeNumber(options.maxTimeMS, 15000)),
    });
  }

  return aggregation;
}

module.exports = {
  buildCreditNotesPaginationPipeline,
  buildInvoiceSummaryPipeline,
  buildPendingOrdersCountPipeline,
  buildPendingOrdersPaginationPipeline,
  runBillingAggregation,
  unpackPaginationFacet,
};
