'use strict';

const mongoose = require('mongoose');

const DEFAULT_ACTIVITY_PAGE_SIZE = 100;
const MAX_ACTIVITY_PAGE_SIZE = 200;

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(parsed)));
}

function parseActivityPage(query = {}) {
  const limit = positiveInteger(
    query.limit,
    DEFAULT_ACTIVITY_PAGE_SIZE,
    MAX_ACTIVITY_PAGE_SIZE
  );
  const page = positiveInteger(query.page, 1);
  return { limit, page, skip: (page - 1) * limit };
}

function parseTimelineCursor(value) {
  const cursor = String(value || '').trim();
  return mongoose.Types.ObjectId.isValid(cursor)
    ? new mongoose.Types.ObjectId(cursor)
    : null;
}

async function listOrderNotesPage(
  { orderId, query },
  { OrderNoteModel }
) {
  const { limit, page, skip } = parseActivityPage(query);
  const docs = await OrderNoteModel.find({ orderId })
    .sort({ pinned: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit + 1)
    .lean();
  const hasMore = docs.length > limit;

  return {
    items: hasMore ? docs.slice(0, limit) : docs,
    pagination: { page, limit, hasMore },
  };
}

async function listOrderTimelinePage(
  { orderId, query },
  { OrderEventModel }
) {
  const { limit } = parseActivityPage(query);
  const cursor = parseTimelineCursor(query?.cursor);
  const filter = { orderId };
  if (cursor) filter._id = { $lt: cursor };

  const docs = await OrderEventModel.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;

  return {
    items,
    pagination: {
      limit,
      hasMore,
      nextCursor:
        hasMore && items.length > 0
          ? String(items[items.length - 1]._id || '')
          : null,
    },
  };
}

module.exports = {
  DEFAULT_ACTIVITY_PAGE_SIZE,
  MAX_ACTIVITY_PAGE_SIZE,
  listOrderNotesPage,
  listOrderTimelinePage,
  parseActivityPage,
  parseTimelineCursor,
};
