// backend/routes/adminFinance.js
const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const financeService = require('../services/adminFinanceService');

const router = express.Router();

function sendError(res, error, fallback = 'Error procesando finanzas.') {
  const status = Number(error?.status || error?.statusCode || 500);
  return res.status(status).json({
    ok: false,
    message: error?.message || fallback,
  });
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
  '/summary',
  requirePermission.any(['finance:view', 'reports:view']),
  async (req, res) => {
    try {
      const data = await financeService.getFinanceSummary(req.query || {});
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo resumen financiero.');
    }
  }
);

router.get(
  '/sales',
  requirePermission.any(['finance:view', 'reports:view']),
  async (req, res) => {
    try {
      const data = await financeService.getSalesReport(req.query || {});
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo ventas financieras.');
    }
  }
);

router.get(
  '/profit',
  requirePermission.any(['finance:view', 'reports:view']),
  async (req, res) => {
    try {
      const data = await financeService.getProfitReport(req.query || {});
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error calculando utilidad.');
    }
  }
);

router.get(
  '/cash',
  requirePermission.any(['finance:view', 'reports:view']),
  async (req, res) => {
    try {
      const data = await financeService.getCashReport(req.query || {});
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo caja financiera.');
    }
  }
);

router.get(
  '/expenses',
  requirePermission.any(['finance:view', 'finance:expenses']),
  async (req, res) => {
    try {
      const data = await financeService.getExpensesReport(req.query || {});
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
      const data = await financeService.createExpense(req.body || {}, getActor(req));
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
      const data = await financeService.updateExpense(req.params.id, req.body || {}, getActor(req));
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
      const data = await financeService.cancelExpense(req.params.id, getActor(req));
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error anulando gasto.');
    }
  }
);

router.get(
  '/export',
  requirePermission.any(['finance:export', 'reports:export']),
  async (req, res) => {
    try {
      const type = req.query?.type || 'sales';
      const csv = await financeService.buildFinanceCsv(type, req.query || {});
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
