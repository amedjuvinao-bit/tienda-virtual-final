// backend/routes/adminFinance.js
const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const Branch = require('../models/Branch');
const financeService = require('../services/adminFinanceService');
const financeExpenseWorkflow = require('../services/adminFinanceExpenseWorkflowService');
const financeBudgetService = require('../services/adminFinanceBudgetService');
const financeTreasuryService = require('../services/adminFinanceTreasuryService');
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

async function getBudgetAwareActor(req) {
  return {
    ...getActor(req),
    canOverrideBudget: await requirePermission.hasEffectivePermission(
      req,
      'finance:budgets:override'
    ),
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
  '/cost-centers',
  requirePermission('finance:view'),
  async (req, res) => {
    try {
      noStore(res);
      const data = await financeBudgetService.listCostCenters(req.query || {});
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo centros de costo.');
    }
  }
);

router.post(
  '/cost-centers',
  requirePermission('finance:budgets:manage'),
  async (req, res) => {
    try {
      const data = await financeBudgetService.createCostCenter(
        req.body || {},
        getActor(req)
      );
      res.status(201).json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error creando centro de costo.');
    }
  }
);

router.put(
  '/cost-centers/:id',
  requirePermission('finance:budgets:manage'),
  async (req, res) => {
    try {
      const data = await financeBudgetService.updateCostCenter(
        req.params.id,
        req.body || {},
        getActor(req)
      );
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error actualizando centro de costo.');
    }
  }
);

router.get(
  '/budgets',
  requirePermission('finance:view'),
  async (req, res) => {
    try {
      noStore(res);
      const scoped = financeScopeQuery(req, req.query || {});
      const data = await financeBudgetService.listBudgets(
        scoped.query,
        { branchIds: scoped.access.branchIds }
      );
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo presupuestos.');
    }
  }
);

router.post(
  '/budgets',
  requirePermission('finance:budgets:manage'),
  async (req, res) => {
    try {
      const writeAccess = resolveFinanceWriteBranch(
        req,
        req.body?.branchId ?? req.body?.branch ?? ''
      );
      const data = await financeBudgetService.createBudget(
        { ...req.body, branchId: writeAccess.branchId },
        getActor(req)
      );
      res.status(201).json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error creando presupuesto.');
    }
  }
);

router.put(
  '/budgets/:id',
  requirePermission('finance:budgets:manage'),
  async (req, res) => {
    try {
      const access = resolveFinanceBranchAccess(req, {
        requestedBranchId: '',
      });
      const data = await financeBudgetService.updateBudget(
        req.params.id,
        req.body || {},
        getActor(req),
        { branchIds: access.branchIds }
      );
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error actualizando presupuesto.');
    }
  }
);

router.get(
  '/budget-control',
  requirePermission('finance:view'),
  async (req, res) => {
    try {
      noStore(res);
      const scoped = financeScopeQuery(req, req.query || {});
      const data = await financeBudgetService.getBudgetControl(
        scoped.query,
        { branchIds: scoped.access.branchIds }
      );
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error calculando control presupuestal.');
    }
  }
);

router.get(
  '/treasury',
  requirePermission('finance:view'),
  async (req, res) => {
    try {
      noStore(res);
      const data = await financeTreasuryService.getTreasury(scopedQuery(req));
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo cartera y vencimientos.');
    }
  }
);

router.post(
  '/payables/:id/payments',
  requirePermission('finance:treasury:manage'),
  async (req, res) => {
    try {
      const resourceAccess = expenseResourceScope(req);
      const data = await financeTreasuryService.registerPayablePayment(
        req.params.id,
        req.body || {},
        getActor(req),
        { branchIds: resourceAccess.branchIds }
      );
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error registrando el abono.');
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
      const data = await financeExpenseWorkflow.requestExpense(
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
      const data = await financeExpenseWorkflow.updateExpenseRequest(
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
  requirePermission('finance:expenses:cancel'),
  async (req, res) => {
    try {
      const resourceAccess = expenseResourceScope(req);
      const data = await financeExpenseWorkflow.cancelExpenseRequest(
        req.params.id,
        req.body || {},
        getActor(req),
        { branchIds: resourceAccess.branchIds }
      );
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error anulando gasto.');
    }
  }
);

router.post(
  '/expenses/:id/review',
  requirePermission('finance:expenses:approve'),
  async (req, res) => {
    try {
      const resourceAccess = expenseResourceScope(req);
      const data = await financeExpenseWorkflow.reviewExpenseRequest(
        req.params.id,
        req.body || {},
        await getBudgetAwareActor(req),
        { branchIds: resourceAccess.branchIds }
      );
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error revisando gasto.');
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
