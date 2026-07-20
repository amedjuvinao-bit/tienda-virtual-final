'use strict';

// backend/routes/adminInvoices.js
const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const invoiceService = require('../services/invoiceService');

const router = express.Router();

function sendError(res, error, fallback = 'Error procesando facturación.') {
  const status = Number(error?.status || error?.statusCode || 500);
  return res.status(status).json({
    ok: false,
    error: error?.code || 'INVOICE_ADMIN_ERROR',
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
  requirePermission.any(['billing:view', 'finance:view', 'orders:view']),
  async (req, res) => {
    try {
      const data = await invoiceService.getInvoiceSummary();
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo resumen de facturación.');
    }
  }
);

router.get(
  '/documents',
  requirePermission.any(['billing:view', 'finance:view', 'orders:view']),
  async (req, res) => {
    try {
      const data = await invoiceService.listInvoices(req.query || {});
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error listando comprobantes.');
    }
  }
);

router.get(
  '/orders-pending',
  requirePermission.any(['billing:view', 'billing:create', 'orders:view']),
  async (req, res) => {
    try {
      const data = await invoiceService.getPendingBillableOrders(req.query || {});
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error listando órdenes por facturar.');
    }
  }
);

router.post(
  '/from-order/:orderId',
  requirePermission.any(['billing:create', 'orders:update']),
  async (req, res) => {
    try {
      const data = await invoiceService.createInvoiceFromOrder(req.params.orderId, getActor(req));
      res.status(data.created ? 201 : 200).json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error generando comprobante desde orden.');
    }
  }
);

router.get(
  '/:id',
  requirePermission.any(['billing:view', 'finance:view', 'orders:view']),
  async (req, res) => {
    try {
      const data = await invoiceService.getInvoiceById(req.params.id);
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo comprobante.');
    }
  }
);

router.patch(
  '/:id/status',
  requirePermission('billing:create'),
  async (req, res) => {
    try {
      const data = await invoiceService.setInvoiceStatus(
        req.params.id,
        req.body?.status,
        getActor(req),
        { message: req.body?.message || req.body?.reason || '' }
      );
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error cambiando estado del comprobante.');
    }
  }
);

router.delete(
  '/:id',
  requirePermission('billing:create'),
  async (req, res) => {
    try {
      const data = await invoiceService.cancelInvoice(req.params.id, getActor(req), req.body?.reason || '');
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error anulando comprobante.');
    }
  }
);

module.exports = router;
