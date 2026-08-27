'use strict';

const {
  buildAdminOrderFilter,
  normalizeInvoiceFilter,
  normalizeOperationalView,
  parseSort,
} = require('./orderAdminQuery/filters');
const { buildInvoiceFilterStage } = require('./orderAdminQuery/invoiceExpressions');
const {
  buildOperationalSummaryPipeline,
  buildOperationalViewCriteria,
} = require('./orderAdminQuery/operationalExpressions');
const {
  buildPagePipeline,
  buildSummaryPipeline,
} = require('./orderAdminQuery/pipelines');
const {
  ADMIN_ORDER_CSV_DB_PROJECTION,
  ADMIN_ORDER_LIST_DB_PROJECTION,
  buildAdminOrderListProjectionStage,
} = require('./orderAdminQuery/listProjection');
const {
  presentAdminOrderListItem,
} = require('./orderAdminQuery/listPresentation');
const {
  deriveOrderOperationalView,
} = require('./orderAdminQuery/operationalPresentation');
const { queryAdminOrders } = require('./orderAdminQuery/queryExecutor');
const {
  buildOrderAdminCursorCriteria,
  decodeOrderAdminCursor,
  encodeOrderAdminCursor,
  isCanonicalCursorSort,
  resolveOrderAdminCursorPagination,
} = require('./orderAdminQuery/cursor');

module.exports = {
  buildAdminOrderFilter,
  buildOperationalViewCriteria,
  buildOperationalSummaryPipeline,
  buildInvoiceFilterStage,
  buildPagePipeline,
  buildSummaryPipeline,
  ADMIN_ORDER_CSV_DB_PROJECTION,
  ADMIN_ORDER_LIST_DB_PROJECTION,
  buildAdminOrderListProjectionStage,
  presentAdminOrderListItem,
  normalizeOperationalView,
  normalizeInvoiceFilter,
  parseSort,
  queryAdminOrders,
  deriveOrderOperationalView,
  buildOrderAdminCursorCriteria,
  decodeOrderAdminCursor,
  encodeOrderAdminCursor,
  isCanonicalCursorSort,
  resolveOrderAdminCursorPagination,
};
