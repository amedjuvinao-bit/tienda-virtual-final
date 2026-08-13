'use strict';

const mongoose = require('mongoose');

const Order = require('../models/Order');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const Product = require('../models/Product');
const {
  applyOrderBranchAccessFilter,
} = require('./orderAdminScopeService');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'total', 'orderNumber']);
const PAID_STATUSES = ['paid', 'shipped', 'delivered'];
const PENDING_STATUSES = ['pending', 'processing'];
const CANCELLED_STATUSES = ['cancelled', 'canceled'];
const VALIDATED_INVOICE_STATUSES = ['validated', 'validada', 'validado'];
const OPERATIONAL_VIEWS = new Set([
  'all',
  'attention',
  'awaiting_payment',
  'prepare',
  'dispatch',
  'transit',
  'incidents',
  'sla_risk',
  'completed',
]);
const PREPARATION_SHIPMENT_STATUSES = [
  'ready_to_pick',
  'picking',
  'picked',
  'packing',
];
const TRANSIT_SHIPMENT_STATUSES = ['dispatched', 'in_transit'];
const ACTIVE_SLA_SHIPMENT_STATUSES = [
  ...PREPARATION_SHIPMENT_STATUSES,
  'packed',
  ...TRANSIT_SHIPMENT_STATUSES,
];

const STATUS_CANON = new Map([
  ['pendiente', 'pending'],
  ['pending', 'pending'],
  ['procesando', 'processing'],
  ['processing', 'processing'],
  ['pagado', 'paid'],
  ['pagada', 'paid'],
  ['paid', 'paid'],
  ['fallido', 'failed'],
  ['rechazado', 'failed'],
  ['failed', 'failed'],
  ['enviado', 'shipped'],
  ['enviada', 'shipped'],
  ['shipped', 'shipped'],
  ['entregado', 'delivered'],
  ['entregada', 'delivered'],
  ['delivered', 'delivered'],
  ['cancelado', 'cancelled'],
  ['cancelada', 'cancelled'],
  ['cancelled', 'cancelled'],
  ['canceled', 'cancelled'],
  ['reembolsado', 'refunded'],
  ['reembolsada', 'refunded'],
  ['refunded', 'refunded'],
]);

const ALLOWED_STATUSES = new Set([
  'pending',
  'processing',
  'paid',
  'failed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

const DIAN_VALIDATED_INVOICE_CRITERIA = [
  { cufe: { $exists: true, $nin: ['', null] } },
  { invoiceNumber: { $exists: true, $nin: ['', null] } },
  { validatedAt: { $exists: true, $nin: ['', null] } },
  { 'provider.cufe': { $exists: true, $nin: ['', null] } },
  { 'provider.number': { $exists: true, $nin: ['', null] } },
  { 'provider.isValidated': true },
  { 'provider.validatedAt': { $exists: true, $nin: ['', null] } },
  { 'provider.raw.cufe': { $exists: true, $nin: ['', null] } },
  { 'provider.raw.number': { $exists: true, $nin: ['', null] } },
  { 'provider.raw.is_validated': true },
  { 'provider.raw.validated_at': { $exists: true, $nin: ['', null] } },
  { 'dianResponse.raw.data.data.cufe': { $exists: true, $nin: ['', null] } },
  { 'dianResponse.raw.data.data.number': { $exists: true, $nin: ['', null] } },
  { 'dianResponse.raw.data.data.is_validated': true },
  { 'dianResponse.raw.data.data.validated_at': { $exists: true, $nin: ['', null] } },
];

const INVOICE_FILTER_CRITERIA = {
  validated: DIAN_VALIDATED_INVOICE_CRITERIA,
  pending: [
    { status: { $in: ['pending', 'sent', 'processing'] } },
    { 'provider.status': { $in: ['pending', 'sent', 'processing'] } },
  ],
  rejected: [
    { status: { $in: ['rejected', 'failed', 'error'] } },
    { 'provider.status': { $in: ['rejected', 'failed', 'error'] } },
    { errors: { $exists: true, $ne: [] } },
    { providerErrors: { $exists: true, $ne: [] } },
  ],
  credit_note: [
    { creditNotes: { $exists: true, $ne: [] } },
    { 'creditNotes.0': { $exists: true } },
  ],
};

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTags(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return Array.from(
    new Set(
      values
        .map((tag) =>
          String(tag || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .slice(0, 24)
        )
        .filter(Boolean)
    )
  ).slice(0, 20);
}

function parsePositiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(parsed)));
}

function parseSort(sortQuery) {
  const sort = {};

  String(sortQuery || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [rawField, rawDirection] = pair.split(':');
      const field = String(rawField || '').trim();
      if (!ALLOWED_SORT_FIELDS.has(field)) return;

      const direction = String(rawDirection || '').trim().toLowerCase();
      sort[field] = ['-1', 'desc', 'descending'].includes(direction) ? -1 : 1;
    });

  if (Object.keys(sort).length === 0) sort.createdAt = -1;

  // Evita saltos o duplicados entre páginas cuando dos órdenes comparten el valor ordenado.
  if (!Object.prototype.hasOwnProperty.call(sort, '_id')) {
    sort._id = Object.values(sort)[0] === 1 ? 1 : -1;
  }

  return sort;
}

function buildColombiaDate(dateValue, endOfDay = false) {
  const date = String(dateValue || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return new Date(
    `${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}-05:00`
  );
}

function buildAdminOrderFilter(req) {
  const query = req?.query || {};
  const filter = {};
  const branchAccess = applyOrderBranchAccessFilter(req, filter);

  if (!branchAccess.ok) {
    return { ok: false, access: branchAccess, filter };
  }

  const q = String(query.q || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const search = [
      { orderNumber: rx },
      { 'customer.name': rx },
      { 'customer.lastname': rx },
      { 'customer.emailOrPhone': rx },
      { 'customer.email': rx },
      { 'customer.phone': rx },
      { 'customer.id': rx },
      { 'billing.name': rx },
      { 'billing.lastname': rx },
      { 'billing.id': rx },
      { 'branchSnapshot.name': rx },
      { 'branchSnapshot.code': rx },
      { 'inventoryAllocations.branchSnapshot.name': rx },
      { 'inventoryAllocations.branchSnapshot.code': rx },
    ];

    if (mongoose.Types.ObjectId.isValid(q)) {
      search.push({ _id: new mongoose.Types.ObjectId(q) });
    }
    filter.$or = search;
  }

  const fromDate = buildColombiaDate(query.dateFrom);
  const toDate = buildColombiaDate(query.dateTo, true);
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = fromDate;
    if (toDate) filter.createdAt.$lte = toDate;
  }

  const selectedStatuses = Array.from(
    new Set(
      String(query.status || '')
        .split(',')
        .map((status) => STATUS_CANON.get(status.trim().toLowerCase()) || '')
        .filter((status) => ALLOWED_STATUSES.has(status))
    )
  );
  if (selectedStatuses.length) {
    if (selectedStatuses.includes('cancelled')) selectedStatuses.push('canceled');
    const uniqueStatuses = Array.from(new Set(selectedStatuses));
    filter.status =
      uniqueStatuses.length === 1 ? uniqueStatuses[0] : { $in: uniqueStatuses };
  }

  const tags = normalizeTags(query.tags);
  if (tags.length) {
    filter.tags =
      String(query.tagsMode || '').toLowerCase() === 'all'
        ? { $all: tags }
        : { $in: tags };
  }

  const printed = String(query.printed || '').trim().toLowerCase();
  if (['1', 'true'].includes(printed)) filter.printed = true;
  if (['0', 'false'].includes(printed)) {
    filter.$and = [
      ...(Array.isArray(filter.$and) ? filter.$and : []),
      { $or: [{ printed: false }, { printed: { $exists: false } }] },
    ];
  }

  const archived = String(query.archived || '').trim().toLowerCase();
  if (['1', 'true'].includes(archived)) filter.archived = true;
  if (['0', 'false'].includes(archived)) filter.archived = { $ne: true };

  return { ok: true, access: branchAccess, filter };
}

function normalizeInvoiceFilter(value) {
  const filter = String(value || '').trim().toLowerCase();
  if (filter === 'error') return 'rejected';
  if (
    ['validated', 'pending', 'rejected', 'credit_note', 'without_invoice'].includes(
      filter
    )
  ) {
    return filter;
  }
  return 'all';
}

function normalizeOperationalView(value) {
  const view = String(value || '').trim().toLowerCase();
  return OPERATIONAL_VIEWS.has(view) ? view : 'all';
}

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
      $or: [
        { status: 'failed' },
        incidentCriteria,
        slaRiskCriteria,
      ],
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
        { status: { $nin: ['failed', 'cancelled', 'canceled', 'delivered', 'refunded'] } },
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

function buildInvoiceFilterStage(invoiceFilter) {
  if (invoiceFilter === 'all') return null;
  if (invoiceFilter === 'without_invoice') {
    return { $match: { '_adminInvoices.0': { $exists: false } } };
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

function buildPagePipeline({
  filter,
  invoiceFilter,
  operationalView = 'all',
  now = new Date(),
  sort,
  skip,
  limit,
  ElectronicInvoiceModel = ElectronicInvoice,
}) {
  const operationalCriteria = buildOperationalViewCriteria(
    operationalView,
    now
  );
  const pipeline = [{ $match: combineFilters(filter, operationalCriteria) }];
  const invoiceStage = buildInvoiceFilterStage(invoiceFilter);

  if (invoiceStage) {
    pipeline.push(buildInvoiceLookupStage(ElectronicInvoiceModel), invoiceStage);
  }

  pipeline.push(
    { $sort: sort },
    { $skip: skip },
    { $limit: limit },
    { $project: { _adminInvoices: 0 } }
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
  if (operationalCriteria) financialPipeline.push({ $match: operationalCriteria });

  financialPipeline.push(
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSales: {
          $sum: {
            $cond: [
              { $in: ['$status', PAID_STATUSES] },
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
          $sum: { $cond: [{ $in: ['$status', PAID_STATUSES] }, 1, 0] },
        },
        pendingOrders: {
          $sum: { $cond: [{ $in: ['$status', PENDING_STATUSES] }, 1, 0] },
        },
        cancelledOrders: {
          $sum: { $cond: [{ $in: ['$status', CANCELLED_STATUSES] }, 1, 0] },
        },
        withInvoiceOrders: {
          $sum: { $cond: [hasInvoiceExpression(), 1, 0] },
        },
        validatedInvoiceOrders: {
          $sum: { $cond: [hasValidatedInvoiceExpression(), 1, 0] },
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
                { $ne: [{ $ifNull: ['$$shipment.sla.breachedAt', null] }, null] },
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
          $sum: { $cond: [shipmentStatusExpression(TRANSIT_SHIPMENT_STATUSES), 1, 0] },
        },
        incidents: { $sum: { $cond: [hasIncidents, 1, 0] } },
        slaRisk: { $sum: { $cond: [hasSlaRisk, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
      },
    },
    { $project: { _id: 0 } },
  ];
}

function executeAggregate(Model, pipeline) {
  const aggregate = Model.aggregate(pipeline);
  if (aggregate && typeof aggregate.allowDiskUse === 'function') {
    return aggregate.allowDiskUse(true);
  }
  return aggregate;
}

function quantityOf(item) {
  return Number(item?.quantity ?? item?.qty ?? 0) || 0;
}

function productIdOf(item) {
  if (item?.product && typeof item.product === 'object' && item.product._id) {
    return item.product._id;
  }
  return item?.product || item?.productId || item?.id || item?._id || null;
}

function calculateItemSummary(items) {
  return (Array.isArray(items) ? items : []).reduce(
    (summary, item) => {
      const quantity = quantityOf(item);
      const price =
        Number(
          item?.price ??
            item?.unitPrice ??
            item?.priceNumber ??
            item?.product?.price ??
            0
        ) || 0;
      summary.totalItems += quantity;
      summary.subtotal += quantity * price;
      return summary;
    },
    { totalItems: 0, subtotal: 0 }
  );
}

function shipmentDueAt(shipment) {
  const status = String(shipment?.status || '').trim().toLowerCase();
  if (['ready_to_pick', 'picking'].includes(status)) {
    return shipment?.sla?.pickingDueAt || null;
  }
  if (['picked', 'packing', 'packed'].includes(status)) {
    return shipment?.sla?.dispatchDueAt || null;
  }
  if (TRANSIT_SHIPMENT_STATUSES.includes(status)) {
    return shipment?.sla?.deliveryDueAt || null;
  }
  return null;
}

function deriveOrderOperationalView(order, now = new Date()) {
  const status = String(order?.status || '').trim().toLowerCase();
  const paymentStatus = String(order?.payment?.status || '').trim().toLowerCase();
  const paymentConfirmed =
    paymentStatus === 'paid' ||
    ['paid', 'shipped', 'delivered', 'refunded'].includes(status);
  const shipments = Array.isArray(order?.fulfillment?.shipments)
    ? order.fulfillment.shipments.filter(
        (shipment) => String(shipment?.status || '').toLowerCase() !== 'cancelled'
      )
    : [];
  const statuses = shipments.map((shipment) =>
    String(shipment?.status || '').trim().toLowerCase()
  );
  const hasPhysicalAllocation = (Array.isArray(order?.inventoryAllocations)
    ? order.inventoryAllocations
    : []
  ).some(
    (allocation) =>
      Number(allocation?.soldQuantity || 0) -
        Number(allocation?.returnedQuantity || 0) >
      0
  );
  const openIncidentCount = shipments.reduce(
    (total, shipment) =>
      total +
      (Array.isArray(shipment?.incidents)
        ? shipment.incidents.filter((incident) => incident?.status === 'open').length
        : 0),
    0
  );
  const dueDates = shipments
    .map((shipment) => ({
      shipment,
      dueAt: shipmentDueAt(shipment),
    }))
    .filter((entry) => entry.dueAt)
    .map((entry) => ({ ...entry, dueDate: new Date(entry.dueAt) }))
    .filter((entry) => !Number.isNaN(entry.dueDate.getTime()))
    .sort((left, right) => left.dueDate - right.dueDate);
  const nextDue = dueDates[0] || null;
  const hasRecordedBreach = shipments.some((shipment) => shipment?.sla?.breachedAt);
  const dueDelta = nextDue ? nextDue.dueDate.getTime() - now.getTime() : null;
  const slaState = hasRecordedBreach || (dueDelta !== null && dueDelta < 0)
    ? 'breached'
    : dueDelta !== null && dueDelta <= 24 * 60 * 60 * 1000
      ? 'risk'
      : nextDue
        ? 'on_track'
        : 'none';
  const progressMap = {
    ready_to_pick: 8,
    picking: 20,
    picked: 35,
    packing: 48,
    packed: 60,
    dispatched: 72,
    in_transit: 86,
    delivered: 100,
    exception: 0,
  };
  const progress = shipments.length
    ? Math.round(
        statuses.reduce(
          (total, shipmentStatus) => total + (progressMap[shipmentStatus] || 0),
          0
        ) / shipments.length
      )
    : status === 'delivered'
      ? 100
      : 0;

  let queue = 'monitor';
  let urgency = 'normal';
  let nextAction = 'Revisar orden';

  if (status === 'failed') {
    queue = 'attention';
    urgency = 'critical';
    nextAction = 'Revisar pago fallido';
  } else if (openIncidentCount > 0 || statuses.includes('exception')) {
    queue = 'incidents';
    urgency = 'critical';
    nextAction = 'Resolver incidencia';
  } else if (slaState === 'breached') {
    queue = 'sla_risk';
    urgency = 'critical';
    nextAction = 'Atender SLA vencido';
  } else if (slaState === 'risk') {
    queue = 'sla_risk';
    urgency = 'high';
    nextAction = 'Priorizar cumplimiento';
  } else if (
    ['pending', 'processing'].includes(status) &&
    !paymentConfirmed &&
    shipments.length === 0
  ) {
    queue = 'awaiting_payment';
    urgency = 'normal';
    nextAction = 'Esperar confirmación de pago';
  } else if (
    paymentConfirmed &&
    !['delivered', 'refunded'].includes(status) &&
    shipments.length === 0 &&
    hasPhysicalAllocation
  ) {
    queue = 'prepare';
    urgency = 'high';
    nextAction = status === 'shipped'
      ? 'Reconstruir trazabilidad logística'
      : 'Preparar logística';
  } else if (statuses.includes('packed')) {
    queue = 'dispatch';
    urgency = 'high';
    nextAction = 'Registrar despacho';
  } else if (statuses.some((value) => TRANSIT_SHIPMENT_STATUSES.includes(value))) {
    queue = 'transit';
    urgency = 'normal';
    nextAction = statuses.includes('dispatched')
      ? 'Confirmar salida a tránsito'
      : 'Confirmar entrega';
  } else if (statuses.some((value) => PREPARATION_SHIPMENT_STATUSES.includes(value))) {
    queue = 'prepare';
    urgency = 'normal';
    nextAction = statuses.includes('packing') || statuses.includes('picked')
      ? 'Completar empaque'
      : statuses.includes('picking')
        ? 'Completar picking'
        : 'Iniciar picking';
  } else if (status === 'delivered' || (shipments.length && statuses.every((value) => value === 'delivered'))) {
    queue = 'completed';
    urgency = 'low';
    nextAction = 'Entrega completada';
  }

  return {
    queue,
    urgency,
    nextAction,
    shipmentCount: shipments.length,
    openIncidentCount,
    progress,
    sla: {
      state: slaState,
      dueAt: nextDue?.dueDate || null,
      remainingMs: dueDelta,
    },
  };
}

async function enrichOrders(docs, { populate, ProductModel = Product } = {}) {
  const getItems = (order) =>
    Array.isArray(order?.items)
      ? order.items
      : Array.isArray(order?.cart)
        ? order.cart
        : [];
  let productMap = new Map();

  if (populate) {
    const productIds = new Set();
    docs.forEach((order) => {
      getItems(order).forEach((item) => {
        const productId = productIdOf(item);
        if (productId) productIds.add(String(productId));
      });
    });

    if (productIds.size) {
      const products = await ProductModel.find({
        _id: { $in: Array.from(productIds) },
      })
        .select('title price image slug sku')
        .lean();
      productMap = new Map(products.map((product) => [String(product._id), product]));
    }
  }

  return docs.map((order) => {
    const sourceItems = getItems(order);
    const items = populate
      ? sourceItems.map((item) => {
          const productId = productIdOf(item);
          return {
            ...item,
            product: productId ? productMap.get(String(productId)) || null : null,
          };
        })
      : sourceItems;
    const summary = order.summary || calculateItemSummary(items);

    return {
      ...order,
      ...(populate ? { items } : {}),
      itemsCount: items.length,
      summary,
      totalItems: Number(summary.totalItems || 0),
      subtotal: Number(summary.subtotal || 0),
      operational: deriveOrderOperationalView(order),
    };
  });
}

function emptyFinancialSummary() {
  return {
    totalOrders: 0,
    totalSales: 0,
    pendingAmount: 0,
    paidOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    averageTicket: 0,
    withoutInvoiceOrders: 0,
    ordersWithoutInvoice: 0,
    validatedInvoiceOrders: 0,
    validatedInvoices: 0,
    validatedDianOrders: 0,
  };
}

function emptyOperationalSummary() {
  return {
    total: 0,
    attention: 0,
    awaitingPayment: 0,
    prepare: 0,
    dispatch: 0,
    transit: 0,
    incidents: 0,
    slaRisk: 0,
    completed: 0,
  };
}

function normalizeOperationalSummary(row) {
  const empty = emptyOperationalSummary();
  if (!row) return empty;
  return Object.fromEntries(
    Object.keys(empty).map((key) => [key, Number(row[key] || 0)])
  );
}

function normalizeFinancialSummary(row) {
  if (!row) return emptyFinancialSummary();
  const totalOrders = Number(row.totalOrders || 0);
  const withInvoiceOrders = Number(row.withInvoiceOrders || 0);
  const validatedInvoiceOrders = Number(row.validatedInvoiceOrders || 0);
  const withoutInvoiceOrders = Math.max(0, totalOrders - withInvoiceOrders);

  return {
    totalOrders,
    totalSales: Number(row.totalSales || 0),
    pendingAmount: Number(row.pendingAmount || 0),
    paidOrders: Number(row.paidOrders || 0),
    pendingOrders: Number(row.pendingOrders || 0),
    cancelledOrders: Number(row.cancelledOrders || 0),
    averageTicket: Number(row.averageTicket || 0),
    withoutInvoiceOrders,
    ordersWithoutInvoice: withoutInvoiceOrders,
    validatedInvoiceOrders,
    validatedInvoices: validatedInvoiceOrders,
    validatedDianOrders: validatedInvoiceOrders,
  };
}

function ordersToCsv(orders) {
  const rows = [
    [
      'orderNumber',
      '_id',
      'customerName',
      'customerEmailOrPhone',
      'itemsCount',
      'totalItems',
      'subtotal',
      'total',
      'status',
      'createdAt',
      'updatedAt',
    ].join(','),
  ];

  orders.forEach((order) => {
    const customer = order.customer || {};
    rows.push(
      [
        JSON.stringify(order.orderNumber || ''),
        JSON.stringify(order._id),
        JSON.stringify(
          [customer.name, customer.lastname].filter(Boolean).join(' ').trim()
        ),
        JSON.stringify(customer.emailOrPhone || customer.email || ''),
        String(order.itemsCount || 0),
        String(order.totalItems || 0),
        String(order.subtotal || 0),
        String(order.total || 0),
        JSON.stringify(order.status || ''),
        JSON.stringify(order.createdAt || ''),
        JSON.stringify(order.updatedAt || ''),
      ].join(',')
    );
  });

  return rows.join('\n');
}

async function queryAdminOrders(
  req,
  {
    OrderModel = Order,
    ElectronicInvoiceModel = ElectronicInvoice,
    ProductModel = Product,
  } = {}
) {
  const query = req?.query || {};
  const page = parsePositiveInteger(query.page, 1);
  const limit = parsePositiveInteger(query.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const skip = (page - 1) * limit;
  const populate = String(query.populate || '0') === '1';
  const format = String(query.format || '').trim().toLowerCase();
  const invoiceFilter = normalizeInvoiceFilter(query.invoiceFilter);
  const operationalView = normalizeOperationalView(query.operationalView);
  const now = new Date();
  const includeSummary = format !== 'csv' && String(query.includeSummary || '1') !== '0';
  const filterResult = buildAdminOrderFilter(req);

  if (!filterResult.ok) {
    return { accessError: filterResult.access };
  }

  const pagePipeline = buildPagePipeline({
    filter: filterResult.filter,
    invoiceFilter,
    operationalView,
    now,
    sort: parseSort(query.sort),
    skip,
    limit,
    ElectronicInvoiceModel,
  });
  const pagePromise = executeAggregate(OrderModel, pagePipeline);
  const summaryPromise = includeSummary
    ? executeAggregate(
        OrderModel,
        buildSummaryPipeline({
          filter: filterResult.filter,
          invoiceFilter,
          operationalView,
          now,
          ElectronicInvoiceModel,
        })
      )
    : Promise.resolve(null);

  const [pageRows, summaryRows] = await Promise.all([pagePromise, summaryPromise]);
  const data = await enrichOrders(pageRows || [], { populate, ProductModel });
  const response = {
    page,
    limit,
    summaryIncluded: includeSummary,
    data,
  };

  if (includeSummary) {
    const summaryRow = summaryRows?.[0] || {};
    const financialSummary = normalizeFinancialSummary(summaryRow.financial);
    const operationalSummary = normalizeOperationalSummary(
      summaryRow.operational
    );
    response.total = financialSummary.totalOrders;
    response.totalPages = Math.max(1, Math.ceil(response.total / limit));
    response.financialSummary = financialSummary;
    response.operationalSummary = operationalSummary;
  }

  if (format === 'csv') response.csv = ordersToCsv(data);
  return response;
}

module.exports = {
  buildAdminOrderFilter,
  buildOperationalViewCriteria,
  buildOperationalSummaryPipeline,
  buildInvoiceFilterStage,
  buildPagePipeline,
  buildSummaryPipeline,
  normalizeOperationalView,
  normalizeInvoiceFilter,
  parseSort,
  queryAdminOrders,
  deriveOrderOperationalView,
};
