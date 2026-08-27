'use strict';

const Order = require('../../models/Order');
const ElectronicInvoice = require('../../models/ElectronicInvoice');
const Product = require('../../models/Product');
const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('./constants');
const {
  buildAdminOrderFilter,
  normalizeInvoiceFilter,
  normalizeOperationalView,
  parsePositiveInteger,
  parseSort,
} = require('./filters');
const { buildPagePipeline, buildSummaryPipeline } = require('./pipelines');
const {
  encodeOrderAdminCursor,
  resolveOrderAdminCursorPagination,
} = require('./cursor');
const {
  enrichOrders,
} = require('./enrichment');
const {
  normalizeFinancialSummary,
  normalizeOperationalSummary,
} = require('./summaryPresentation');
const { ordersToCsv } = require('./csv');
const {
  createOrderBranchPresentationScope,
} = require('../orderBranchPresentationScopeService');

function executeAggregate(Model, pipeline) {
  const aggregate = Model.aggregate(pipeline);
  if (aggregate && typeof aggregate.allowDiskUse === 'function') {
    return aggregate.allowDiskUse(true);
  }
  return aggregate;
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
  const includeSummary =
    format !== 'csv' && String(query.includeSummary || '1') !== '0';
  const filterResult = buildAdminOrderFilter(req);

  if (!filterResult.ok) {
    return { accessError: filterResult.access };
  }

  const cursorPagination = resolveOrderAdminCursorPagination(query);
  const sort = parseSort(query.sort);

  const pagePipeline = buildPagePipeline({
    filter: filterResult.filter,
    invoiceFilter,
    operationalView,
    now,
    sort,
    skip,
    limit: cursorPagination.enabled ? limit + 1 : limit,
    cursorCriteria: cursorPagination.criteria,
    cursorMode: cursorPagination.enabled,
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

  const [rawPageRows, summaryRows] = await Promise.all([pagePromise, summaryPromise]);
  const allPageRows = rawPageRows || [];
  const hasMore = cursorPagination.enabled && allPageRows.length > limit;
  const pageRows = cursorPagination.enabled
    ? allPageRows.slice(0, limit)
    : allPageRows;
  const data = await enrichOrders(pageRows, {
    branchPresentationScope: createOrderBranchPresentationScope(
      filterResult.access
    ),
    populate,
    ProductModel,
  });
  const response = {
    page,
    limit,
    summaryIncluded: includeSummary,
    data,
  };

  if (cursorPagination.enabled) {
    response.paginationMode = 'cursor';
    response.hasMore = hasMore;
    response.nextCursor =
      hasMore && pageRows.length
        ? encodeOrderAdminCursor(pageRows[pageRows.length - 1])
        : null;
  }

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
  executeAggregate,
  queryAdminOrders,
};
