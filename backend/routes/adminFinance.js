// backend/routes/adminFinance.js
const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const Branch = require('../models/Branch');
const financeService = require('../services/adminFinanceService');
const {
  financeScopeQuery,
  resolveFinanceBranchAccess,
  resolveFinanceWriteBranch,
} = require('../services/adminFinanceAccessService');

const router = express.Router();

function sendError(res, error, fallback = 'Error procesando finanzas.') {
  const status = Number(error?.status || error?.statusCode || 500);

  if (status >= 500) {
    console.error('[adminFinance] Error:', error);
  }

  return res.status(status).json({
    ok: false,
    error: error?.code || 'FINANCE_ROUTE_ERROR',
    message: status >= 500 ? fallback : error?.message || fallback,
    ...(status < 500 && error?.details ? { details: error.details } : {}),
  });
}

function noStore(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
}

function scopedQuery(req) {
  return financeScopeQuery(req, req.query || {}).query;
}

function expenseResourceScope(req) {
  return resolveFinanceBranchAccess(req, { requestedBranchId: '' });
}

function getActor(req) {
  return {
    adminUserId: req.adminUserId || req.adminUserDoc?._id || null,
    snapshot: {
      username: req.adminUser || req.adminUserDoc?.username || '',
      displayName: req.adminUserDoc?.displayName || req.adminName || '',
      role: req.adminRole || '',
      adminRole: req.adminRole || '',
    },
  };
}

router.use(requireAdmin);

router.get(
  '/branches',
  requirePermission('finance:view'),
  async (req, res) => {
    try {
      noStore(res);
      const access = resolveFinanceBranchAccess(req, { requestedBranchId: '' });
      const filter = {
        deletedAt: null,
        active: true,
        status: 'active',
      };
      if (Array.isArray(access.branchIds)) {
        filter._id = {
          $in: access.branchIds.map(
            (branchId) => new mongoose.Types.ObjectId(branchId)
          ),
        };
      }

      const data = await Branch.find(filter)
        .select('name code type isMain isDefaultForOnlineOrders')
        .sort({ isMain: -1, name: 1 })
        .lean();
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo sedes financieras.');
    }
  }
);

router.get(
  '/summary',
  requirePermission('finance:view'),
  async (req, res) => {
    try {
      noStore(res);
      const data = await financeService.getFinanceSummary(scopedQuery(req));
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo resumen financiero.');
    }
  }
);

router.get(
  '/sales',
  requirePermission('finance:view'),
  async (req, res) => {
    try {
      noStore(res);
      const data = await financeService.getSalesReport(scopedQuery(req));
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo ventas financieras.');
    }
  }
);

router.get(
  '/profit',
  requirePermission('finance:view'),
  async (req, res) => {
    try {
      noStore(res);
      const data = await financeService.getProfitReport(scopedQuery(req));
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error calculando utilidad.');
    }
  }
);

router.get(
  '/cash',
  requirePermission('finance:view'),
  async (req, res) => {
    try {
      noStore(res);
      const data = await financeService.getCashReport(scopedQuery(req));
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo caja financiera.');
    }
  }
);

router.get(
  '/expenses',
  requirePermission('finance:view'),
  async (req, res) => {
    try {
      noStore(res);
      const data = await financeService.getExpensesReport(scopedQuery(req));
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo gastos.');
    }
  }
);

router.post(
  '/expenses',
  requirePermission('finance:expenses'),
  async (req, res) => {
    try {
      const writeAccess = resolveFinanceWriteBranch(
        req,
        req.body?.branchId ?? req.body?.branch ?? ''
      );
      const data = await financeService.createExpense(
        { ...req.body, branchId: writeAccess.branchId },
        getActor(req)
      );
      res.status(201).json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error creando gasto.');
    }
  }
);

router.put(
  '/expenses/:id',
  requirePermission('finance:expenses'),
  async (req, res) => {
    try {
      const resourceAccess = expenseResourceScope(req);
      let payload = req.body || {};
      if (payload.branchId !== undefined || payload.branch !== undefined) {
        const writeAccess = resolveFinanceWriteBranch(
          req,
          payload.branchId ?? payload.branch ?? ''
        );
        payload = { ...payload, branchId: writeAccess.branchId };
      }
      const data = await financeService.updateExpense(
        req.params.id,
        payload,
        getActor(req),
        { branchIds: resourceAccess.branchIds }
      );
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error actualizando gasto.');
    }
  }
);

router.delete(
  '/expenses/:id',
  requirePermission('finance:expenses'),
  async (req, res) => {
    try {
      const resourceAccess = expenseResourceScope(req);
      const data = await financeService.cancelExpense(
        req.params.id,
        getActor(req),
        { branchIds: resourceAccess.branchIds }
      );
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error anulando gasto.');
    }
  }
);

router.get(
  '/export',
  requirePermission('finance:export'),
  async (req, res) => {
    try {
      noStore(res);
      const type = req.query?.type || 'sales';
      const csv = await financeService.buildFinanceCsv(type, scopedQuery(req));
      const filename = type === 'expenses' ? 'finance-expenses.csv' : 'finance-sales.csv';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csv);
    } catch (error) {
      sendError(res, error, 'Error exportando finanzas.');
    }
  }
);

module.exports = router;
