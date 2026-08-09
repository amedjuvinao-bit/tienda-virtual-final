// backend/routes/adminInventory.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryReservation = require('../models/InventoryReservation');
const { createInventoryMovement, getBranchStockSummary } = require('../services/inventoryService');

const router = express.Router();

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function cleanText(value, fallback = '') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text || fallback;
}

function cleanLower(value, fallback = '') {
  return cleanText(value, fallback).toLowerCase();
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function toObjectId(value) {
  if (!isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function sendError(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    message,
    ...extra,
  });
}

function parsePagination(query = {}) {
  const page = Math.max(Number(query.page || DEFAULT_PAGE), 1);
  const rawLimit = Math.max(Number(query.limit || DEFAULT_LIMIT), 1);
  const limit = Math.min(rawLimit, MAX_LIMIT);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

function parseSort(query = {}) {
  const sort = cleanText(query.sort || '-createdAt');

  const allowedFields = new Set([
    'createdAt',
    'updatedAt',
    'movementNumber',
    'type',
    'status',
    'direction',
    'quantity',
    'postedAt',
  ]);

  let field = sort;
  let direction = -1;

  if (sort.startsWith('-')) {
    field = sort.slice(1);
    direction = -1;
  }

  if (sort.startsWith('+')) {
    field = sort.slice(1);
    direction = 1;
  }

  if (!allowedFields.has(field)) {
    return {
      createdAt: -1,
    };
  }

  return {
    [field]: direction,
    createdAt: -1,
  };
}

function parseReservationSort(query = {}) {
  const sort = cleanText(query.sort || '-createdAt');

  const allowedFields = new Set([
    'createdAt',
    'updatedAt',
    'reservationCode',
    'orderNumber',
    'status',
    'expiresAt',
    'confirmedAt',
    'releasedAt',
    'expiredAt',
    'failedAt',
    'totalQuantity',
    'subtotal',
    'total',
  ]);

  let field = sort;
  let direction = -1;

  if (sort.startsWith('-')) {
    field = sort.slice(1);
    direction = -1;
  }

  if (sort.startsWith('+')) {
    field = sort.slice(1);
    direction = 1;
  }

  if (!allowedFields.has(field)) {
    return {
      createdAt: -1,
    };
  }

  return {
    [field]: direction,
    createdAt: -1,
  };
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCurrentAdminId(req) {
  return req.adminUserId && isValidObjectId(req.adminUserId)
    ? toObjectId(req.adminUserId)
    : null;
}

function buildStockFilter(query = {}) {
  const filter = {
    deletedAt: null,
  };

  const branchId = cleanText(query.branchId || query.branch || '');
  const productId = cleanText(query.productId || query.product || '');
  const q = cleanText(query.q || query.search || '');

  if (branchId) {
    if (!isValidObjectId(branchId)) {
      return {
        ok: false,
        status: 400,
        message: 'La sede enviada no es válida.',
      };
    }

    filter.branch = toObjectId(branchId);
  }

  if (productId) {
    if (!isValidObjectId(productId)) {
      return {
        ok: false,
        status: 400,
        message: 'El producto enviado no es válido.',
      };
    }

    filter.product = toObjectId(productId);
  }

  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');

    filter.$or = [
      { 'productSnapshot.title': regex },
      { 'productSnapshot.sku': regex },
      { 'productSnapshot.category': regex },
      { variantKey: regex },
      { 'variant.label': regex },
      { 'variant.attributes.label': regex },
      { 'variant.attributes.value': regex },
      { 'variant.size': regex },
      { 'variant.color': regex },
      { 'variant.sku': regex },
      { 'branchSnapshot.name': regex },
      { 'branchSnapshot.code': regex },
      { warehouseLocation: regex },
    ];
  }

  const active = cleanLower(query.active || '');

  if (active === 'true' || active === '1') {
    filter.active = true;
  }

  if (active === 'false' || active === '0') {
    filter.active = false;
  }

  return {
    ok: true,
    filter,
  };
}

function buildMovementFilter(query = {}) {
  const filter = {
    deletedAt: null,
  };

  const branchId = cleanText(query.branchId || query.branch || '');
  const productId = cleanText(query.productId || query.product || '');
  const orderId = cleanText(query.orderId || query.order || '');
  const type = cleanLower(query.type || '');
  const status = cleanLower(query.status || '');
  const direction = cleanLower(query.direction || '');
  const q = cleanText(query.q || query.search || '');

  if (branchId) {
    if (!isValidObjectId(branchId)) {
      return {
        ok: false,
        status: 400,
        message: 'La sede enviada no es válida.',
      };
    }

    const branchObjectId = toObjectId(branchId);

    filter.$or = [
      { branchFrom: branchObjectId },
      { branchTo: branchObjectId },
    ];
  }

  if (productId) {
    if (!isValidObjectId(productId)) {
      return {
        ok: false,
        status: 400,
        message: 'El producto enviado no es válido.',
      };
    }

    filter.product = toObjectId(productId);
  }

  if (orderId) {
    if (!isValidObjectId(orderId)) {
      return {
        ok: false,
        status: 400,
        message: 'La orden enviada no es válida.',
      };
    }

    filter.order = toObjectId(orderId);
  }

  if (type && type !== 'all') {
    filter.type = type;
  }

  if (status && status !== 'all') {
    filter.status = status;
  }

  if (direction && direction !== 'all') {
    filter.direction = direction;
  }

  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');

    const searchFilter = {
      $or: [
        { movementNumber: regex },
        { reference: regex },
        { orderNumber: regex },
        { reason: regex },
        { notes: regex },
        { 'productSnapshot.title': regex },
        { 'productSnapshot.sku': regex },
        { variantKey: regex },
        { 'variant.label': regex },
        { 'variant.attributes.label': regex },
        { 'variant.attributes.value': regex },
        { 'variant.size': regex },
        { 'variant.color': regex },
        { 'branchFromSnapshot.name': regex },
        { 'branchFromSnapshot.code': regex },
        { 'branchToSnapshot.name': regex },
        { 'branchToSnapshot.code': regex },
      ],
    };

    if (filter.$or) {
      filter.$and = [
        {
          $or: filter.$or,
        },
        searchFilter,
      ];

      delete filter.$or;
    } else {
      Object.assign(filter, searchFilter);
    }
  }

  return {
    ok: true,
    filter,
  };
}

function buildReservationFilter(query = {}) {
  const filter = {};

  const branchId = cleanText(query.branchId || query.branch || '');
  const productId = cleanText(query.productId || query.product || '');
  const orderId = cleanText(query.orderId || query.order || '');
  const orderNumber = cleanText(query.orderNumber || '');
  const status = cleanLower(query.status || '');
  const q = cleanText(query.q || query.search || '');
  const expired = cleanLower(query.expired || '');

  if (branchId) {
    if (!isValidObjectId(branchId)) {
      return {
        ok: false,
        status: 400,
        message: 'La sede enviada no es válida.',
      };
    }

    filter['items.branch'] = toObjectId(branchId);
  }

  if (productId) {
    if (!isValidObjectId(productId)) {
      return {
        ok: false,
        status: 400,
        message: 'El producto enviado no es válido.',
      };
    }

    filter['items.product'] = toObjectId(productId);
  }

  if (orderId) {
    if (!isValidObjectId(orderId)) {
      return {
        ok: false,
        status: 400,
        message: 'La orden enviada no es válida.',
      };
    }

    filter.order = toObjectId(orderId);
  }

  if (orderNumber) {
    filter.orderNumber = new RegExp(`^${escapeRegex(orderNumber)}$`, 'i');
  }

  if (status && status !== 'all') {
    filter.status = status;
  }

  if (expired === 'true' || expired === '1') {
    filter.status = 'pending';
    filter.expiresAt = {
      $lte: new Date(),
    };
  }

  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');

    const searchFilter = {
      $or: [
        { reservationCode: regex },
        { orderNumber: regex },
        { paymentReference: regex },
        { paymentTransactionId: regex },
        { releaseReason: regex },
        { notes: regex },
        { 'items.productSnapshot.title': regex },
        { 'items.productSnapshot.sku': regex },
        { 'items.branchSnapshot.name': regex },
        { 'items.branchSnapshot.code': regex },
        { 'items.size': regex },
        { 'items.color': regex },
      ],
    };

    if (filter.$or) {
      filter.$and = [
        {
          $or: filter.$or,
        },
        searchFilter,
      ];

      delete filter.$or;
    } else {
      Object.assign(filter, searchFilter);
    }
  }

  return {
    ok: true,
    filter,
  };
}

function requireMovementPermission(req, res, next) {
  const type = cleanLower(req.body?.type || '');

  const direction = InventoryMovement.resolveDirectionFromType(type);

  const permission =
    direction === 'transfer'
      ? 'inventory:transfer'
      : 'inventory:adjust';

  return requirePermission(permission)(req, res, next);
}

function canReverseMovement(movement) {
  if (!movement) return false;

  if (movement.status !== 'posted') return false;
  if (movement.reversedByMovement) return false;
  if (movement.reversalOfMovement) return false;

  return ['in', 'out', 'transfer'].includes(movement.direction);
}

function buildReversalPayload(movement, reason = '') {
  const cleanReason = cleanText(reason);
  const baseReason = cleanReason || `Reverso del movimiento ${movement.movementNumber || movement._id}`;
  const reference = `REV-${movement.movementNumber || String(movement._id).slice(-8)}`;
  const productId = getObjectIdFromDocumentField(movement.product);
  const quantity = Number(movement.quantity || 0);
  const variant = movement.variant || {};

  if (!productId) {
    throw new Error('El movimiento original no tiene producto válido para reversar.');
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('El movimiento original no tiene una cantidad válida para reversar.');
  }

  const basePayload = {
    product: productId,
    productId,
    size: variant.size || '',
    color: variant.color || '',
    variantKey: movement.variantKey || '',
    variantLabel: variant.label || '',
    variantAttributes: Array.isArray(variant.attributes)
      ? variant.attributes
      : [],
    variant: {
      variantKey: movement.variantKey || '',
      label: variant.label || '',
      size: variant.size || '',
      color: variant.color || '',
      attributes: Array.isArray(variant.attributes)
        ? variant.attributes
        : [],
      sku: variant.sku || '',
      barcode: variant.barcode || '',
    },
    quantity,
    reason: baseReason,
    reference,
    notes: `Movimiento generado automáticamente para reversar ${movement.movementNumber || movement._id}.`,
    order: movement.order || null,
    orderNumber: movement.orderNumber || '',
    sourceModel: 'InventoryMovement',
    sourceId: movement._id,
  };

  if (movement.direction === 'in') {
    const branchId = getObjectIdFromDocumentField(movement.branchTo || movement.branchFrom);

    if (!branchId) {
      throw new Error('El movimiento original no tiene sede para reversar la entrada.');
    }

    return {
      ...basePayload,
      type: 'adjustment_out',
      branch: branchId,
      branchFrom: branchId,
      branchId,
    };
  }

  if (movement.direction === 'out') {
    const branchId = getObjectIdFromDocumentField(movement.branchFrom || movement.branchTo);

    if (!branchId) {
      throw new Error('El movimiento original no tiene sede para reversar la salida.');
    }

    return {
      ...basePayload,
      type: 'adjustment_in',
      branch: branchId,
      branchTo: branchId,
      branchId,
    };
  }

  if (movement.direction === 'transfer') {
    const originalFromId = getObjectIdFromDocumentField(movement.branchFrom);
    const originalToId = getObjectIdFromDocumentField(movement.branchTo);

    if (!originalFromId || !originalToId) {
      throw new Error('El traslado original no tiene sede origen o sede destino válida.');
    }

    return {
      ...basePayload,
      type: 'transfer',
      branchFrom: originalToId,
      branchTo: originalFromId,
    };
  }

  throw new Error('Este tipo de movimiento no se puede reversar.');
}

function getObjectIdFromDocumentField(value) {
  if (!value) return null;

  const candidate = value?._id || value?.id || value;

  return isValidObjectId(candidate) ? toObjectId(candidate) : null;
}

function populateMovementForResponse(query) {
  return query
    .populate('product', 'title sku image price stock')
    .populate('branchFrom', 'name code type status active')
    .populate('branchTo', 'name code type status active')
    .populate('createdBy', 'username displayName firstName lastName role')
    .populate('reversedByMovement', 'movementNumber type status createdAt')
    .populate('reversalOfMovement', 'movementNumber type status createdAt');
}
function buildKardexFilter(query = {}) {
  const productId = cleanText(query.productId || query.product || '');
  const branchId = cleanText(query.branchId || query.branch || '');
  const size = cleanText(query.size || query.talla || '');
  const color = cleanText(query.color || '');
  const variantKey = cleanText(
    query.variantKey || query.variantId || ''
  ).toLowerCase();

  if (!productId || !isValidObjectId(productId)) {
    return {
      ok: false,
      status: 400,
      message: 'El producto enviado no es válido.',
    };
  }

  if (!branchId || !isValidObjectId(branchId)) {
    return {
      ok: false,
      status: 400,
      message: 'La sede enviada no es válida.',
    };
  }

  if (!variantKey && !size) {
    return {
      ok: false,
      status: 400,
      message: 'Debes enviar la talla para consultar el Kardex.',
    };
  }

  if (!variantKey && !color) {
    return {
      ok: false,
      status: 400,
      message: 'Debes enviar el color para consultar el Kardex.',
    };
  }

  const productObjectId = toObjectId(productId);
  const branchObjectId = toObjectId(branchId);

  return {
    ok: true,
    productId,
    branchId,
    productObjectId,
    branchObjectId,
    size,
    color,
    variantKey,
    filter: {
      deletedAt: null,
      product: productObjectId,
      status: {
        $in: ['posted', 'reversed'],
      },
      $and: [
        variantKey
          ? variantKey.startsWith('v2__')
            ? { variantKey }
            : {
                $or: [
                  { variantKey },
                  {
                    'variant.size': size,
                    'variant.color': color,
                  },
                ],
              }
          : {
              'variant.size': size,
              'variant.color': color,
            },
        {
          $or: [
            { branchFrom: branchObjectId },
            { branchTo: branchObjectId },
          ],
        },
      ],
    },
  };
}

function buildKardexStockFilter({
  productObjectId,
  branchObjectId,
  size,
  color,
  variantKey,
}) {
  const base = {
    deletedAt: null,
    product: productObjectId,
    branch: branchObjectId,
  };

  if (variantKey) return { ...base, variantKey };

  return {
    ...base,
    $or: [
      {
        size,
        color,
      },
      {
        'variant.size': size,
        'variant.color': color,
      },
    ],
  };
}

function getDocumentIdValue(value) {
  if (!value) return '';

  if (typeof value === 'object') {
    return String(value._id || value.id || '');
  }

  return String(value || '');
}

function getKardexBranchSnapshot(branchValue = {}, fallbackSnapshot = {}) {
  const branch = typeof branchValue === 'object' && branchValue ? branchValue : {};

  return {
    id: getDocumentIdValue(branchValue),
    name: cleanText(branch.name || fallbackSnapshot.name || ''),
    code: cleanText(branch.code || fallbackSnapshot.code || ''),
    type: cleanText(branch.type || fallbackSnapshot.type || ''),
  };
}

function getKardexProductSnapshot(productValue = {}, fallbackSnapshot = {}) {
  const product = typeof productValue === 'object' && productValue ? productValue : {};

  return {
    id: getDocumentIdValue(productValue),
    title: cleanText(product.title || fallbackSnapshot.title || ''),
    sku: cleanText(product.sku || fallbackSnapshot.sku || ''),
    image: cleanText(product.image || fallbackSnapshot.image || ''),
    price: Number(product.price || fallbackSnapshot.price || 0),
    stock: Number(product.stock || fallbackSnapshot.stock || 0),
  };
}

function getKardexEffect(movement, branchObjectId) {
  const quantity = Math.max(0, Number(movement?.quantity || 0));
  const direction = cleanLower(movement?.direction || '');
  const branchId = getDocumentIdValue(branchObjectId);
  const branchFromId = getDocumentIdValue(movement?.branchFrom);
  const branchToId = getDocumentIdValue(movement?.branchTo);

  if (!quantity) {
    return {
      entry: 0,
      exit: 0,
      effect: 'none',
    };
  }

  if (direction === 'transfer') {
    if (branchToId === branchId) {
      return {
        entry: quantity,
        exit: 0,
        effect: 'in',
      };
    }

    if (branchFromId === branchId) {
      return {
        entry: 0,
        exit: quantity,
        effect: 'out',
      };
    }

    return {
      entry: 0,
      exit: 0,
      effect: 'none',
    };
  }

  if (direction === 'in') {
    return {
      entry: quantity,
      exit: 0,
      effect: 'in',
    };
  }

  if (direction === 'out') {
    return {
      entry: 0,
      exit: quantity,
      effect: 'out',
    };
  }

  return {
    entry: 0,
    exit: 0,
    effect: 'none',
  };
}

function getCurrentStockValues(stockRow = {}) {
  const physicalStock = Number(stockRow?.stock || 0);
  const reservedStock = Number(stockRow?.reservedStock || 0);
  const availableStockFromRow = Number(stockRow?.availableStock);
  const availableStock = Number.isFinite(availableStockFromRow)
    ? availableStockFromRow
    : Math.max(0, physicalStock - reservedStock);

  return {
    physicalStock,
    reservedStock,
    availableStock,
  };
}

function getAvailableStockForAlert(row = {}) {
  const stock = Number(row?.stock || 0);
  const reservedStock = Number(row?.reservedStock || 0);
  const availableStockFromRow = Number(row?.availableStock);

  if (Number.isFinite(availableStockFromRow)) {
    return Math.max(0, availableStockFromRow);
  }

  return Math.max(0, stock - reservedStock);
}

function getLowStockLimitForAlert(row = {}, defaultLimit = 5) {
  const candidates = [
    row?.reorderPoint,
    row?.product?.reorderPoint,
    row?.productSnapshot?.reorderPoint,
    row?.product?.stockMin,
    row?.productSnapshot?.stockMin,
    defaultLimit,
  ];

  const value = candidates
    .map((item) => Number(item))
    .find((item) => Number.isFinite(item) && item > 0);

  return value || defaultLimit;
}

function mapStockAlertItem(row = {}, type = 'lowStock') {
  const physicalStock = Number(row?.stock || 0);
  const reservedStock = Number(row?.reservedStock || 0);
  const availableStock = getAvailableStockForAlert(row);
  const lowStockLimit = getLowStockLimitForAlert(row);

  return {
    id: String(row?._id || ''),
    type,
    severity: type === 'outOfStock' ? 'critical' : 'warning',
    product: {
      id: getDocumentIdValue(row?.product),
      title: cleanText(row?.product?.title || row?.productSnapshot?.title || ''),
      sku: cleanText(row?.product?.sku || row?.productSnapshot?.sku || ''),
      image: cleanText(row?.product?.image || row?.productSnapshot?.image || ''),
    },
    branch: {
      id: getDocumentIdValue(row?.branch),
      name: cleanText(row?.branch?.name || row?.branchSnapshot?.name || ''),
      code: cleanText(row?.branch?.code || row?.branchSnapshot?.code || ''),
      type: cleanText(row?.branch?.type || row?.branchSnapshot?.type || ''),
    },
    variant: {
      variantKey: cleanText(row?.variantKey || ''),
      label: cleanText(row?.variant?.label || ''),
      size: cleanText(row?.variant?.size || row?.size || ''),
      color: cleanText(row?.variant?.color || row?.color || ''),
      attributes: Array.isArray(row?.variant?.attributes)
        ? row.variant.attributes
        : [],
      sku: cleanText(row?.variant?.sku || ''),
      barcode: cleanText(row?.variant?.barcode || ''),
    },
    stock: {
      physicalStock,
      reservedStock,
      availableStock,
      lowStockLimit,
    },
    message:
      type === 'outOfStock'
        ? 'Producto agotado en esta sede y variante.'
        : 'Producto con inventario bajo para esta sede y variante.',
    updatedAt: row?.updatedAt || null,
  };
}

function mapReservationAlertItem(reservation = {}, type = 'pendingReservation') {
  const now = new Date();
  const expiresAt = reservation?.expiresAt ? new Date(reservation.expiresAt) : null;
  const isExpired =
    expiresAt instanceof Date &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() <= now.getTime();

  const firstItem = Array.isArray(reservation?.items) ? reservation.items[0] : null;

  return {
    id: String(reservation?._id || ''),
    type,
    severity: isExpired ? 'critical' : 'info',
    reservationCode: reservation?.reservationCode || '',
    orderNumber: reservation?.orderNumber || '',
    status: reservation?.status || '',
    totalQuantity: Number(reservation?.totalQuantity || 0),
    total: Number(reservation?.total || reservation?.subtotal || 0),
    expiresAt: reservation?.expiresAt || null,
    expiredAt: reservation?.expiredAt || null,
    createdAt: reservation?.createdAt || null,
    minutesToExpire:
      expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime())
        ? Math.ceil((expiresAt.getTime() - now.getTime()) / 60000)
        : null,
    product: {
      id: getDocumentIdValue(firstItem?.product),
      title: cleanText(firstItem?.product?.title || firstItem?.productSnapshot?.title || ''),
      sku: cleanText(firstItem?.product?.sku || firstItem?.productSnapshot?.sku || ''),
      image: cleanText(firstItem?.product?.image || firstItem?.productSnapshot?.image || ''),
    },
    branch: {
      id: getDocumentIdValue(firstItem?.branch),
      name: cleanText(firstItem?.branch?.name || firstItem?.branchSnapshot?.name || ''),
      code: cleanText(firstItem?.branch?.code || firstItem?.branchSnapshot?.code || ''),
      type: cleanText(firstItem?.branch?.type || firstItem?.branchSnapshot?.type || ''),
    },
    variant: {
      variantKey: cleanText(firstItem?.variantKey || ''),
      label: cleanText(firstItem?.variantLabel || ''),
      size: cleanText(firstItem?.size || ''),
      color: cleanText(firstItem?.color || ''),
      attributes: Array.isArray(firstItem?.variantAttributes)
        ? firstItem.variantAttributes
        : [],
    },
    message: isExpired
      ? 'Reserva pendiente vencida. Debe ser liberada por el job automático.'
      : 'Reserva pendiente activa que mantiene unidades apartadas.',
  };
}

function parseAlertsLimit(query = {}) {
  const rawLimit = Number(query.limit || 20);

  if (!Number.isFinite(rawLimit) || rawLimit <= 0) return 20;

  return Math.min(Math.floor(rawLimit), 100);
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';

  const stringValue = String(value)
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes(';')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function getInventoryExportStatus(row = {}) {
  const availableStock = getAvailableStockForAlert(row);
  const lowStockLimit = getLowStockLimitForAlert(row);

  if (availableStock <= 0) return 'Agotado';
  if (availableStock <= lowStockLimit) return 'Bajo stock';

  return 'Disponible';
}

function getInventoryExportRows(rows = []) {
  return rows.map((row) => {
    const physicalStock = Number(row?.stock || 0);
    const reservedStock = Number(row?.reservedStock || 0);
    const availableStock = getAvailableStockForAlert(row);
    const lowStockLimit = getLowStockLimitForAlert(row);
    const updatedAt = row?.updatedAt
      ? new Date(row.updatedAt).toISOString()
      : '';

    return {
      producto: cleanText(row?.product?.title || row?.productSnapshot?.title || ''),
      sku: cleanText(row?.product?.sku || row?.productSnapshot?.sku || row?.variant?.sku || ''),
      sede: cleanText(row?.branch?.name || row?.branchSnapshot?.name || ''),
      codigoSede: cleanText(row?.branch?.code || row?.branchSnapshot?.code || ''),
      tipoSede: cleanText(row?.branch?.type || row?.branchSnapshot?.type || ''),
      variante: cleanText(
        row?.variant?.label ||
          (Array.isArray(row?.variant?.attributes)
            ? row.variant.attributes
                .map((attribute) => attribute?.value)
                .filter(Boolean)
                .join(' / ')
            : '') ||
          [row?.variant?.size, row?.variant?.color]
            .filter(Boolean)
            .join(' / ')
      ),
      atributos: Array.isArray(row?.variant?.attributes)
        ? row.variant.attributes
            .map(
              (attribute) =>
                `${cleanText(attribute?.label || attribute?.key)}: ${cleanText(attribute?.value)}`
            )
            .filter((value) => !value.endsWith(': '))
            .join(' | ')
        : '',
      variantKey: cleanText(row?.variantKey || ''),
      talla: cleanText(row?.variant?.size || row?.size || ''),
      color: cleanText(row?.variant?.color || row?.color || ''),
      codigoVariante: cleanText(row?.variant?.sku || ''),
      barcode: cleanText(row?.variant?.barcode || ''),
      stockFisico: physicalStock,
      reservado: reservedStock,
      disponible: availableStock,
      puntoMinimo: lowStockLimit,
      estado: getInventoryExportStatus(row),
      ubicacion: cleanText(row?.warehouseLocation || ''),
      actualizado: updatedAt,
    };
  });
}

function buildInventoryCsv(rows = []) {
  const headers = [
    'Producto',
    'SKU',
    'Sede',
    'Codigo sede',
    'Tipo sede',
    'Variante',
    'Atributos',
    'Variant key',
    'Talla',
    'Color',
    'Codigo variante',
    'Barcode',
    'Stock fisico',
    'Reservado',
    'Disponible',
    'Punto minimo',
    'Estado',
    'Ubicacion',
    'Ultima actualizacion',
  ];

  const lines = [
    headers.map(escapeCsvValue).join(','),
  ];

  rows.forEach((row) => {
    lines.push(
      [
        row.producto,
        row.sku,
        row.sede,
        row.codigoSede,
        row.tipoSede,
        row.variante,
        row.atributos,
        row.variantKey,
        row.talla,
        row.color,
        row.codigoVariante,
        row.barcode,
        row.stockFisico,
        row.reservado,
        row.disponible,
        row.puntoMinimo,
        row.estado,
        row.ubicacion,
        row.actualizado,
      ]
        .map(escapeCsvValue)
        .join(',')
    );
  });

  return `\uFEFF${lines.join('\n')}`;
}

function getExportFileName(prefix = 'inventario') {
  const now = new Date();

  const stamp = now
    .toISOString()
    .slice(0, 19)
    .replace(/[-:T]/g, '');

  return `${prefix}_${stamp}.csv`;
}


/* ============================
 * PROTECCIÓN GENERAL
 * ============================ */

router.use(requireAdmin);

/* ============================
 * META
 * GET /api/admin/inventory/meta
 * ============================ */

router.get('/meta', requirePermission('inventory:view'), async (_req, res) => {
  try {
    return res.json({
      ok: true,
      data: {
        movementTypes: InventoryMovement.getTypes(),
        movementDirections: InventoryMovement.getDirections(),
        movementStatuses: InventoryMovement.getStatuses(),
      },
    });
  } catch (error) {
    console.error('❌ Error obteniendo meta inventario:', error.message);

    return sendError(res, 500, 'Error obteniendo información base de inventario.');
  }
});

/* ============================
 * STOCK POR SEDE / PRODUCTO
 * GET /api/admin/inventory/stock
 * ============================ */

router.get('/stock', requirePermission('inventory:view'), async (req, res) => {
  try {
    const parsedFilter = buildStockFilter(req.query);

    if (!parsedFilter.ok) {
      return sendError(res, parsedFilter.status, parsedFilter.message);
    }

    const { page, limit, skip } = parsePagination(req.query);

    const [total, rows] = await Promise.all([
      InventoryStock.countDocuments(parsedFilter.filter),

      InventoryStock.find(parsedFilter.filter)
        .sort({
          'branchSnapshot.name': 1,
          'productSnapshot.title': 1,
          'variant.size': 1,
          'variant.color': 1,
        })
        .skip(skip)
        .limit(limit)
        .populate('branch', 'name code type status active')
        .populate('product', 'title sku image price stock')
        .lean({ virtuals: true }),
    ]);

    return res.json({
      ok: true,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      data: rows,
    });
  } catch (error) {
    console.error('❌ Error listando stock por sede:', error.message);

    return sendError(res, 500, 'Error listando stock por sede.');
  }
});


/* ============================
 * EXPORTAR INVENTARIO CSV
 * GET /api/admin/inventory/export
 * ============================ */

router.get('/export', requirePermission('inventory:view'), async (req, res) => {
  try {
    const parsedFilter = buildStockFilter(req.query);

    if (!parsedFilter.ok) {
      return sendError(res, parsedFilter.status, parsedFilter.message);
    }

    const rows = await InventoryStock.find(parsedFilter.filter)
      .sort({
        'branchSnapshot.name': 1,
        'productSnapshot.title': 1,
        'variant.size': 1,
        'variant.color': 1,
      })
      .populate('branch', 'name code type status active')
      .populate('product', 'title sku image price stock reorderPoint stockMin')
      .lean({ virtuals: true });

    const exportRows = getInventoryExportRows(rows);
    const csv = buildInventoryCsv(exportRows);
    const fileName = getExportFileName('inventario_por_sedes');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error('❌ Error exportando inventario:', error.message);

    return sendError(res, 500, 'Error exportando inventario.');
  }
});

/* ============================
 * RESUMEN DE STOCK DE UNA SEDE
 * GET /api/admin/inventory/branches/:branchId/stock
 * ============================ */

router.get(
  '/branches/:branchId/stock',
  requirePermission('inventory:view'),
  async (req, res) => {
    try {
      const { branchId } = req.params;

      if (!isValidObjectId(branchId)) {
        return sendError(res, 400, 'ID de sede inválido.');
      }

      const summary = await getBranchStockSummary(branchId);

      return res.json({
        ok: true,
        data: summary,
      });
    } catch (error) {
      console.error('❌ Error obteniendo resumen de stock de sede:', error.message);

      return sendError(
        res,
        500,
        error.message || 'Error obteniendo resumen de stock de sede.'
      );
    }
  }
);

/* ============================
 * RESERVAS DE INVENTARIO
 * GET /api/admin/inventory/reservations
 * ============================ */

router.get('/reservations', requirePermission('inventory:view'), async (req, res) => {
  try {
    const parsedFilter = buildReservationFilter(req.query);

    if (!parsedFilter.ok) {
      return sendError(res, parsedFilter.status, parsedFilter.message);
    }

    const { page, limit, skip } = parsePagination(req.query);
    const sort = parseReservationSort(req.query);

    const [total, reservations, statusSummary] = await Promise.all([
      InventoryReservation.countDocuments(parsedFilter.filter),

      InventoryReservation.find(parsedFilter.filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('order', 'orderNumber status total customer createdAt')
        .populate('items.product', 'title sku image price stock')
        .populate('items.branch', 'name code type status active')
        .lean({ virtuals: true }),

      InventoryReservation.aggregate([
        {
          $match: parsedFilter.filter,
        },
        {
          $group: {
            _id: '$status',
            count: {
              $sum: 1,
            },
            totalQuantity: {
              $sum: '$totalQuantity',
            },
          },
        },
      ]),
    ]);

    const byStatus = statusSummary.reduce((acc, row) => {
      const key = row?._id || 'unknown';

      acc[key] = {
        count: Number(row?.count || 0),
        totalQuantity: Number(row?.totalQuantity || 0),
      };

      return acc;
    }, {});

    return res.json({
      ok: true,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      summary: {
        byStatus,
        pending: byStatus.pending?.count || 0,
        confirmed: byStatus.confirmed?.count || 0,
        released: byStatus.released?.count || 0,
        expired: byStatus.expired?.count || 0,
        cancelled: byStatus.cancelled?.count || 0,
        failed: byStatus.failed?.count || 0,
      },
      data: reservations,
    });
  } catch (error) {
    console.error('❌ Error listando reservas de inventario:', error.message);

    return sendError(res, 500, 'Error listando reservas de inventario.');
  }
});

/* ============================
 * ALERTAS DE INVENTARIO
 * GET /api/admin/inventory/alerts
 * ============================ */

router.get('/alerts', requirePermission('inventory:view'), async (req, res) => {
  try {
    const limit = parseAlertsLimit(req.query);
    const now = new Date();

    const stockRows = await InventoryStock.find({
      deletedAt: null,
      active: true,
    })
      .populate('product', 'title sku image price stock reorderPoint stockMin')
      .populate('branch', 'name code type status active')
      .sort({
        'productSnapshot.title': 1,
        'branchSnapshot.name': 1,
        'variant.size': 1,
        'variant.color': 1,
      })
      .limit(1000)
      .lean({ virtuals: true });

    const outOfStockItems = [];
    const lowStockItems = [];

    stockRows.forEach((row) => {
      const availableStock = getAvailableStockForAlert(row);
      const lowStockLimit = getLowStockLimitForAlert(row);

      if (availableStock <= 0) {
        outOfStockItems.push(mapStockAlertItem(row, 'outOfStock'));
        return;
      }

      if (availableStock <= lowStockLimit) {
        lowStockItems.push(mapStockAlertItem(row, 'lowStock'));
      }
    });

    const [expiredReservationsRaw, pendingReservationsRaw] = await Promise.all([
      InventoryReservation.find({
        status: 'pending',
        expiresAt: {
          $lte: now,
        },
      })
        .sort({
          expiresAt: 1,
        })
        .limit(limit)
        .populate('order', 'orderNumber status total customer createdAt')
        .populate('items.product', 'title sku image price stock')
        .populate('items.branch', 'name code type status active')
        .lean({ virtuals: true }),

      InventoryReservation.find({
        status: 'pending',
        expiresAt: {
          $gt: now,
        },
      })
        .sort({
          expiresAt: 1,
        })
        .limit(limit)
        .populate('order', 'orderNumber status total customer createdAt')
        .populate('items.product', 'title sku image price stock')
        .populate('items.branch', 'name code type status active')
        .lean({ virtuals: true }),
    ]);

    const expiredReservations = expiredReservationsRaw.map((reservation) =>
      mapReservationAlertItem(reservation, 'expiredReservation')
    );

    const pendingReservations = pendingReservationsRaw.map((reservation) =>
      mapReservationAlertItem(reservation, 'pendingReservation')
    );

    const sortedOutOfStockItems = outOfStockItems
      .sort((a, b) => {
        const productA = a.product.title || '';
        const productB = b.product.title || '';

        return productA.localeCompare(productB, 'es');
      })
      .slice(0, limit);

    const sortedLowStockItems = lowStockItems
      .sort((a, b) => {
        const availableA = Number(a.stock.availableStock || 0);
        const availableB = Number(b.stock.availableStock || 0);

        if (availableA !== availableB) return availableA - availableB;

        const productA = a.product.title || '';
        const productB = b.product.title || '';

        return productA.localeCompare(productB, 'es');
      })
      .slice(0, limit);

    const criticalCount = outOfStockItems.length + expiredReservations.length;
    const warningCount = lowStockItems.length;
    const infoCount = pendingReservations.length;

    return res.json({
      ok: true,
      data: {
        generatedAt: now,
        summary: {
          critical: criticalCount,
          warning: warningCount,
          info: infoCount,
          lowStock: lowStockItems.length,
          outOfStock: outOfStockItems.length,
          expiredReservations: expiredReservations.length,
          pendingReservations: pendingReservations.length,
          total:
            criticalCount +
            warningCount +
            infoCount,
        },
        lowStockItems: sortedLowStockItems,
        outOfStockItems: sortedOutOfStockItems,
        expiredReservations,
        pendingReservations,
      },
    });
  } catch (error) {
    console.error('❌ Error obteniendo alertas de inventario:', error.message);

    return sendError(res, 500, 'Error obteniendo alertas de inventario.');
  }
});

/* ============================
 * KARDEX DE INVENTARIO
 * GET /api/admin/inventory/kardex
 * ============================ */

router.get('/kardex', requirePermission('inventory:view'), async (req, res) => {
  try {
    const parsedFilter = buildKardexFilter(req.query);

    if (!parsedFilter.ok) {
      return sendError(res, parsedFilter.status, parsedFilter.message);
    }

    const {
      productObjectId,
      branchObjectId,
      size,
      color,
      variantKey,
      filter,
    } = parsedFilter;

    const stockFilter = buildKardexStockFilter({
      productObjectId,
      branchObjectId,
      size,
      color,
      variantKey,
    });

    const [stockRow, movements] = await Promise.all([
      InventoryStock.findOne(stockFilter)
        .populate('product', 'title sku image price stock')
        .populate('branch', 'name code type status active')
        .lean({ virtuals: true }),

      InventoryMovement.find(filter)
        .sort({
          postedAt: 1,
          createdAt: 1,
          _id: 1,
        })
        .populate('product', 'title sku image price stock')
        .populate('branchFrom', 'name code type status active')
        .populate('branchTo', 'name code type status active')
        .populate('createdBy', 'username displayName firstName lastName role')
        .populate('reversedByMovement', 'movementNumber type status createdAt')
        .populate('reversalOfMovement', 'movementNumber type status createdAt')
        .lean({ virtuals: true }),
    ]);

    let runningBalance = 0;
    let totalIn = 0;
    let totalOut = 0;

    const kardexMovements = movements.map((movement) => {
      const effect = getKardexEffect(movement, branchObjectId);

      totalIn += effect.entry;
      totalOut += effect.exit;
      runningBalance += effect.entry - effect.exit;

      return {
        id: String(movement._id),
        movementNumber: movement.movementNumber || '',
        type: movement.type || '',
        direction: movement.direction || '',
        status: movement.status || '',
        date: movement.postedAt || movement.createdAt || null,
        quantity: Number(movement.quantity || 0),
        entry: effect.entry,
        exit: effect.exit,
        balance: runningBalance,
        effect: effect.effect,
        product: getKardexProductSnapshot(movement.product, movement.productSnapshot),
        variant: {
          variantKey: movement?.variantKey || variantKey || '',
          label: movement?.variant?.label || '',
          size: movement?.variant?.size || size,
          color: movement?.variant?.color || color,
          attributes: Array.isArray(movement?.variant?.attributes)
            ? movement.variant.attributes
            : [],
          sku: movement?.variant?.sku || '',
          barcode: movement?.variant?.barcode || '',
        },
        branchFrom: getKardexBranchSnapshot(
          movement.branchFrom,
          movement.branchFromSnapshot
        ),
        branchTo: getKardexBranchSnapshot(
          movement.branchTo,
          movement.branchToSnapshot
        ),
        reason: movement.reason || '',
        notes: movement.notes || '',
        reference: movement.reference || '',
        order: movement.order || null,
        orderNumber: movement.orderNumber || '',
        createdAt: movement.createdAt || null,
        postedAt: movement.postedAt || null,
        reversedByMovement: movement.reversedByMovement || null,
        reversalOfMovement: movement.reversalOfMovement || null,
      };
    });

    const currentStock = getCurrentStockValues(stockRow || {});
    const closingBalance = runningBalance;

    return res.json({
      ok: true,
      data: {
        product: stockRow
          ? getKardexProductSnapshot(stockRow.product, stockRow.productSnapshot)
          : getKardexProductSnapshot(movements[0]?.product, movements[0]?.productSnapshot),
        branch: stockRow
          ? getKardexBranchSnapshot(stockRow.branch, stockRow.branchSnapshot)
          : getKardexBranchSnapshot(branchObjectId, {}),
        variant: {
          variantKey: stockRow?.variantKey || variantKey || '',
          label: stockRow?.variant?.label || '',
          size,
          color,
          attributes: Array.isArray(stockRow?.variant?.attributes)
            ? stockRow.variant.attributes
            : [],
        },
        stock: currentStock,
        summary: {
          openingBalance: 0,
          totalIn,
          totalOut,
          closingBalance,
          currentPhysicalStock: currentStock.physicalStock,
          currentReservedStock: currentStock.reservedStock,
          currentAvailableStock: currentStock.availableStock,
          differenceWithCurrentStock: currentStock.physicalStock - closingBalance,
        },
        movements: kardexMovements,
      },
    });
  } catch (error) {
    console.error('❌ Error obteniendo Kardex de inventario:', error.message);

    return sendError(res, 500, 'Error obteniendo Kardex de inventario.');
  }
});

/* ============================
 * HISTORIAL DE MOVIMIENTOS
 * GET /api/admin/inventory/movements
 * ============================ */

router.get('/movements', requirePermission('inventory:view'), async (req, res) => {
  try {
    const parsedFilter = buildMovementFilter(req.query);

    if (!parsedFilter.ok) {
      return sendError(res, parsedFilter.status, parsedFilter.message);
    }

    const { page, limit, skip } = parsePagination(req.query);
    const sort = parseSort(req.query);

    const [total, movements] = await Promise.all([
      InventoryMovement.countDocuments(parsedFilter.filter),

      InventoryMovement.find(parsedFilter.filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('product', 'title sku image price stock')
        .populate('branchFrom', 'name code type status active')
        .populate('branchTo', 'name code type status active')
        .populate('createdBy', 'username displayName firstName lastName role')
        .populate('reversedByMovement', 'movementNumber type status createdAt')
        .populate('reversalOfMovement', 'movementNumber type status createdAt')
        .lean({ virtuals: true }),
    ]);

    return res.json({
      ok: true,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      data: movements,
    });
  } catch (error) {
    console.error('❌ Error listando movimientos de inventario:', error.message);

    return sendError(res, 500, 'Error listando movimientos de inventario.');
  }
});

/* ============================
 * CREAR MOVIMIENTO
 * POST /api/admin/inventory/movements
 * ============================ */

router.post('/movements', requireMovementPermission, async (req, res) => {
  try {
    const movement = await createInventoryMovement(req.body || {}, {
      adminId: getCurrentAdminId(req),
      postNow: req.body?.postNow !== false,
    });

    return res.status(201).json({
      ok: true,
      message: 'Movimiento de inventario creado correctamente.',
      data:
        typeof movement.toSafeObject === 'function'
          ? movement.toSafeObject()
          : movement,
    });
  } catch (error) {
    console.error('❌ Error creando movimiento de inventario:', error.message);

    return sendError(
      res,
      400,
      error.message || 'Error creando movimiento de inventario.'
    );
  }
});

/* ============================
 * REVERSAR MOVIMIENTO
 * POST /api/admin/inventory/movements/:id/reverse
 * ============================ */

router.post(
  '/movements/:id/reverse',
  requirePermission('inventory:adjust'),
  async (req, res) => {
    const session = await mongoose.startSession();

    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        await session.endSession();
        return sendError(res, 400, 'ID de movimiento inválido.');
      }

      const adminId = getCurrentAdminId(req);
      const reason = cleanText(req.body?.reason || '');
      let responsePayload = null;

      await session.withTransaction(async () => {
        const movement = await InventoryMovement.findOne({
          _id: toObjectId(id),
          deletedAt: null,
        }).session(session);

        if (!movement) {
          throw Object.assign(new Error('Movimiento de inventario no encontrado.'), {
            statusCode: 404,
          });
        }

        if (!canReverseMovement(movement)) {
          throw Object.assign(
            new Error('Este movimiento no se puede reversar. Solo se reversan movimientos aplicados que no hayan sido reversados.'),
            {
              statusCode: 409,
            }
          );
        }

        const reversalPayload = buildReversalPayload(movement, reason);

        const reversalMovement = await createInventoryMovement(reversalPayload, {
          adminId,
          postNow: true,
          session,
        });

        movement.status = 'reversed';
        movement.reversedByMovement = reversalMovement._id;
        movement.updatedBy = adminId;

        reversalMovement.reversalOfMovement = movement._id;
        reversalMovement.updatedBy = adminId;

        await movement.save({ session });
        await reversalMovement.save({ session });

        const [updatedOriginal, updatedReversal] = await Promise.all([
          populateMovementForResponse(
            InventoryMovement.findById(movement._id).session(session)
          ).lean({ virtuals: true }),

          populateMovementForResponse(
            InventoryMovement.findById(reversalMovement._id).session(session)
          ).lean({ virtuals: true }),
        ]);

        responsePayload = {
          original: updatedOriginal,
          reversal: updatedReversal,
        };
      });

      return res.json({
        ok: true,
        message: 'Movimiento reversado correctamente.',
        data: responsePayload,
      });
    } catch (error) {
      console.error('❌ Error reversando movimiento de inventario:', error.message);

      return sendError(
        res,
        error.statusCode || 400,
        error.message || 'Error reversando movimiento de inventario.'
      );
    } finally {
      await session.endSession();
    }
  }
);

/* ============================
 * DETALLE DE MOVIMIENTO
 * GET /api/admin/inventory/movements/:id
 * ============================ */

router.get(
  '/movements/:id',
  requirePermission('inventory:view'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de movimiento inválido.');
      }

      const movement = await InventoryMovement.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      })
        .populate('product', 'title sku image price stock')
        .populate('branchFrom', 'name code type status active')
        .populate('branchTo', 'name code type status active')
        .populate('createdBy', 'username displayName firstName lastName role')
        .populate('reversedByMovement', 'movementNumber type status createdAt')
        .populate('reversalOfMovement', 'movementNumber type status createdAt')
        .lean({ virtuals: true });

      if (!movement) {
        return sendError(res, 404, 'Movimiento de inventario no encontrado.');
      }

      return res.json({
        ok: true,
        data: movement,
      });
    } catch (error) {
      console.error('❌ Error obteniendo movimiento de inventario:', error.message);

      return sendError(res, 500, 'Error obteniendo movimiento de inventario.');
    }
  }
);

module.exports = router;
