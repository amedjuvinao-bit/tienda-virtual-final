// backend/routes/adminBranchProtection.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

const Branch = require('../models/Branch');
const {
  getBranchOperationSummary,
  hasBranchOperation,
} = require('../services/branchOperationProtectionService');

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

function buildBlockedMessage(action = 'desactivar') {
  const verb = action === 'delete' ? 'eliminar' : 'desactivar';

  return action === 'delete'
    ? `No puedes ${verb} esta sede porque tiene operaciones o historial asociados. Puedes desactivarla cuando cierre sus operaciones pendientes.`
    : `No puedes ${verb} esta sede porque tiene operaciones pendientes. Revisa el detalle para saber qué debes cerrar.`;
}

async function protectBranchWithoutOperations(req, res, next, action = 'disable') {
  try {
    const branchId = req.params.id;

    if (!isValidObjectId(branchId)) {
      return next();
    }

    const summary = await getBranchOperationSummary(branchId, { action });

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
    const body = req.body || {};
    if (!wantsDisableFromBody(body) || !isValidObjectId(req.params.id)) {
      return next();
    }

    try {
      const current = await Branch.findOne({
        _id: toObjectId(req.params.id),
        deletedAt: null,
      }).select('status active').lean();

      if (!current || (
        (body.status === undefined || cleanLower(body.status) === current.status) &&
        (body.active === undefined || body.active === current.active)
      )) {
        return next();
      }

      return protectBranchWithoutOperations(req, res, next, 'disable');
    } catch (error) {
      console.error('❌ Error consultando el estado actual de la sede:', error.message);
      return res.status(500).json({
        ok: false,
        message: 'No se pudo validar el estado actual de la sede.',
      });
    }
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
