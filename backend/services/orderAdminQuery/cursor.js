'use strict';

const mongoose = require('mongoose');

const CURSOR_VERSION = 'v1';
const MAX_CURSOR_LENGTH = 180;
const DESCENDING_DIRECTIONS = new Set(['-1', 'desc', 'descending']);

class OrderAdminCursorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OrderAdminCursorError';
    this.code = code;
    this.statusCode = 400;
  }
}

function invalidCursor() {
  return new OrderAdminCursorError(
    'ORDER_ADMIN_CURSOR_INVALID',
    'El cursor de Órdenes no es válido o está dañado.'
  );
}

function canonicalObjectId(value) {
  const text = String(value?._id || value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(text) || !mongoose.Types.ObjectId.isValid(text)) {
    return '';
  }
  return String(new mongoose.Types.ObjectId(text)) === text ? text : '';
}

function canonicalDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function encodeOrderAdminCursor(row = {}) {
  const createdAt = canonicalDate(row.createdAt);
  const id = canonicalObjectId(row._id);
  if (!createdAt || !id) {
    const error = new Error('La fila no contiene la clave canónica del cursor.');
    error.code = 'ORDER_ADMIN_CURSOR_ROW_INVALID';
    throw error;
  }
  const payload = [CURSOR_VERSION, createdAt.getTime().toString(36), id].join('.');
  return Buffer.from(payload, 'utf8').toString('base64url');
}

function decodeOrderAdminCursor(value) {
  const token = String(value || '').trim();
  if (
    !token ||
    token.length > MAX_CURSOR_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    throw invalidCursor();
  }

  let payload;
  try {
    const buffer = Buffer.from(token, 'base64url');
    if (buffer.toString('base64url') !== token) throw invalidCursor();
    payload = buffer.toString('utf8');
  } catch {
    throw invalidCursor();
  }

  const parts = payload.split('.');
  if (
    parts.length !== 3 ||
    parts[0] !== CURSOR_VERSION ||
    !/^[0-9a-z]+$/.test(parts[1])
  ) {
    throw invalidCursor();
  }
  const timestamp = Number.parseInt(parts[1], 36);
  const createdAt = canonicalDate(timestamp);
  const id = canonicalObjectId(parts[2]);
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp < 0 ||
    !createdAt ||
    !id
  ) {
    throw invalidCursor();
  }

  const decoded = {
    createdAt,
    _id: new mongoose.Types.ObjectId(id),
  };
  if (encodeOrderAdminCursor(decoded) !== token) throw invalidCursor();
  return decoded;
}

function buildOrderAdminCursorCriteria(cursor) {
  if (!cursor) return null;
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
    ],
  };
}

function isCanonicalCursorSort(sortQuery) {
  const value = String(sortQuery || '').trim();
  if (!value) return true;
  const pairs = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (pairs.length < 1 || pairs.length > 2) return false;

  const parsed = pairs.map((pair) => {
    const parts = pair.split(':');
    return {
      field: String(parts[0] || '').trim(),
      direction: String(parts[1] || '').trim().toLowerCase(),
      validShape: parts.length === 2,
    };
  });
  if (
    !parsed[0].validShape ||
    parsed[0].field !== 'createdAt' ||
    !DESCENDING_DIRECTIONS.has(parsed[0].direction)
  ) {
    return false;
  }
  if (parsed.length === 1) return true;
  return Boolean(
    parsed[1].validShape &&
      parsed[1].field === '_id' &&
      DESCENDING_DIRECTIONS.has(parsed[1].direction)
  );
}

function resolveOrderAdminCursorPagination(query = {}) {
  const pagination = String(query.pagination || '').trim().toLowerCase();
  const cursorToken = String(query.cursor || '').trim();
  const enabled = pagination === 'cursor' || Boolean(cursorToken);
  if (!enabled) return { enabled: false, cursor: null, criteria: null };

  if (pagination && pagination !== 'cursor') {
    throw new OrderAdminCursorError(
      'ORDER_ADMIN_CURSOR_MODE_CONFLICT',
      'No combines un cursor con otro modo de paginación.'
    );
  }
  if (String(query.page || '').trim()) {
    throw new OrderAdminCursorError(
      'ORDER_ADMIN_CURSOR_PAGE_CONFLICT',
      'La paginación por cursor no admite el parámetro page.'
    );
  }
  if (String(query.format || '').trim().toLowerCase() === 'csv') {
    throw new OrderAdminCursorError(
      'ORDER_ADMIN_CURSOR_FORMAT_UNSUPPORTED',
      'La exportación CSV no admite paginación por cursor.'
    );
  }
  if (!isCanonicalCursorSort(query.sort)) {
    throw new OrderAdminCursorError(
      'ORDER_ADMIN_CURSOR_SORT_UNSUPPORTED',
      'El cursor solo admite el orden createdAt:-1,_id:-1.'
    );
  }

  const cursor = cursorToken ? decodeOrderAdminCursor(cursorToken) : null;
  return {
    enabled: true,
    cursor,
    criteria: buildOrderAdminCursorCriteria(cursor),
  };
}

module.exports = {
  OrderAdminCursorError,
  buildOrderAdminCursorCriteria,
  decodeOrderAdminCursor,
  encodeOrderAdminCursor,
  isCanonicalCursorSort,
  resolveOrderAdminCursorPagination,
};
