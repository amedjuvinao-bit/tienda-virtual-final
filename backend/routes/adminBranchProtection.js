// backend/routes/adminBranchProtection.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

const InventoryStock = require('../models/InventoryStock');
const InventoryReservation = require('../models/InventoryReservation');
const InventoryMovement = require('../models/InventoryMovement');

const router = express.Router();

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function toObjectId(value) {
  if (!isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function cleanLower(value) {
  return String(value || '').trim().toLowerCase();
}

function wantsDisableFromBody(body = {}) {
  return (
    body.active === false ||
    (body.status !== undefined && cleanLower(body.status) !== 'active')
  );
}

async function getBranchOperationSummary(branchId) {
  const objectId = toObjectId(branchId);

  if (!objectId) {
    return {
      activeStockCount: 0,
      reservedStockCount: 0,
      pendingReservationsCount: 0,
      movementsCount: 0,
    };
  }

  const [activeStockCount, reservedStockCount, pendingReservationsCount, movementsCount] =
    await Promise.all([
      InventoryStock.countDocuments({
        branch: objectId,
        deletedAt: null,
        active: true,
        stock: { $gt: 0 },
      }),
      InventoryStock.countDocuments({
        branch: objectId,
        deletedAt: null,
        active: true,
        reservedStock: { $gt: 0 },
      }),
      InventoryReservation.countDocuments({
        status: 'pending',
        'items.branch': objectId,
      }),
      InventoryMovement.countDocuments({
        deletedAt: null,
        $or: [{ branchFrom: objectId }, { branchTo: objectId }],
      }),
    ]);

  return {
    activeStockCount,
    reservedStockCount,
    pendingReservationsCount,
    movementsCount,
  };
}

function hasBranchOperation(summary = {}) {
  return (
    Number(summary.activeStockCount || 0) > 0 ||
    Number(summary.reservedStockCount || 0) > 0 ||
    Number(summary.pendingReservationsCount || 0) > 0 ||
    Number(summary.movementsCount || 0) > 0
  );
}

function buildBlockedMessage(action = 'desactivar') {
  const verb = action === 'delete' ? 'eliminar' : 'desactivar';

  return `No puedes ${verb} esta sede porque tiene inventario, reservas o movimientos asociados.`;
}

async function protectBranchWithoutOperations(req, res, next, action = 'disable') {
  try {
    const branchId = req.params.id;

    if (!isValidObjectId(branchId)) {
      return next();
    }

    const summary = await getBranchOperationSummary(branchId);

    if (!hasBranchOperation(summary)) {
      return next();
    }

    return res.status(409).json({
      ok: false,
      message: buildBlockedMessage(action),
      code: 'BRANCH_HAS_OPERATION',
      operationSummary: summary,
    });
  } catch (error) {
    console.error('❌ Error validando operación asociada a sede:', error.message);

    return res.status(500).json({
      ok: false,
      message: 'No se pudo validar si la sede tiene operación asociada.',
      code: 'BRANCH_OPERATION_CHECK_ERROR',
    });
  }
}

router.put(
  '/:id',
  requireAdmin,
  requirePermission('branches:update'),
  async (req, res, next) => {
    if (!wantsDisableFromBody(req.body || {})) {
      return next();
    }

    return protectBranchWithoutOperations(req, res, next, 'disable');
  }
);

router.patch(
  '/:id/status',
  requireAdmin,
  requirePermission('branches:disable'),
  async (req, res, next) => {
    if (!wantsDisableFromBody(req.body || {})) {
      return next();
    }

    return protectBranchWithoutOperations(req, res, next, 'disable');
  }
);

router.delete(
  '/:id',
  requireAdmin,
  requirePermission('branches:disable'),
  async (req, res, next) => {
    return protectBranchWithoutOperations(req, res, next, 'delete');
  }
);

module.exports = router;
