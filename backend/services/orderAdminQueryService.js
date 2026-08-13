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
  sort,
  skip,
  limit,
  ElectronicInvoiceModel = ElectronicInvoice,
}) {
  const pipeline = [{ $match: filter }];
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
  ElectronicInvoiceModel = ElectronicInvoice,
}) {
  const pipeline = [
    { $match: filter },
    buildInvoiceLookupStage(ElectronicInvoiceModel),
  ];
  const invoiceStage = buildInvoiceFilterStage(invoiceFilter);
  if (invoiceStage) pipeline.push(invoiceStage);

  pipeline.push(
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

  return pipeline;
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
  const includeSummary = format !== 'csv' && String(query.includeSummary || '1') !== '0';
  const filterResult = buildAdminOrderFilter(req);

  if (!filterResult.ok) {
    return { accessError: filterResult.access };
  }

  const pagePipeline = buildPagePipeline({
    filter: filterResult.filter,
    invoiceFilter,
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
    const financialSummary = normalizeFinancialSummary(summaryRows?.[0]);
    response.total = financialSummary.totalOrders;
    response.totalPages = Math.max(1, Math.ceil(response.total / limit));
    response.financialSummary = financialSummary;
  }

  if (format === 'csv') response.csv = ordersToCsv(data);
  return response;
}

module.exports = {
  buildAdminOrderFilter,
  buildInvoiceFilterStage,
  buildPagePipeline,
  buildSummaryPipeline,
  normalizeInvoiceFilter,
  parseSort,
  queryAdminOrders,
};
