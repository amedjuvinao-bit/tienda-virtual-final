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