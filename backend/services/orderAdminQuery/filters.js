'use strict';

const mongoose = require('mongoose');

const { applyOrderBranchAccessFilter } = require('../orderAdminScopeService');
const {
  ALLOWED_SORT_FIELDS,
  ALLOWED_STATUSES,
  OPERATIONAL_VIEWS,
  STATUS_CANON,
} = require('./constants');

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

module.exports = {
  buildAdminOrderFilter,
  buildColombiaDate,
  escapeRegex,
  normalizeInvoiceFilter,
  normalizeOperationalView,
  normalizeTags,
  parsePositiveInteger,
  parseSort,
};
