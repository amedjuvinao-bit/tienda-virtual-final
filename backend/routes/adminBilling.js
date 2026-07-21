'use strict';

// backend/routes/adminBilling.js
// API del módulo unificado Facturación usando ElectronicInvoice.

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const billingService = require('../services/adminBillingService');
const billingSyncService = require('../services/adminBillingSyncService');

const router = express.Router();

function sendError(res, error, fallback = 'Error procesando facturación.') {
  const status = Number(error?.status || error?.statusCode || 500);
  return res.status(status).json({
    ok: false,
    error: error?.code || 'BILLING_ADMIN_ERROR',
    message: error?.message || fallback,
  });
}

function currentAdmin(req) {
  return req.adminUsername || req.user?.username || req.user?.email || 'admin';
}

router.use(requireAdmin);

router.get(
  '/summary',
  requirePermission('billing:view'),
  async (_req, res) => {
    try {
      const data = await billingService.getBillingSummary();
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo resumen de facturación.');
    }
  }
);

router.get(
  '/documents',
  requirePermission('billing:view'),
  async (req, res) => {
    try {
      const data = await billingService.listElectronicInvoices(req.query || {});
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error listando documentos de facturación.');
    }
  }
);

router.post(
  '/documents/:invoiceId/sync',
  requirePermission('billing:retry'),
  async (req, res) => {
    try {
      const data = await billingSyncService.syncInvoice(req.params.invoiceId, {
        adminUser: currentAdmin(req),
      });
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error sincronizando factura.');
    }
  }
);

router.get(
  '/credit-notes',
  requirePermission('billing:view'),
  async (req, res) => {
    try {
      const data = await billingService.listCreditNotes(req.query || {});
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error listando notas crédito de facturación.');
    }
  }
);

router.post(
  '/credit-notes/:invoiceId/:noteId/sync',
  requirePermission('billing:retry'),
  async (req, res) => {
    try {
      const data = await billingSyncService.syncCreditNote(req.params.invoiceId, req.params.noteId, {
        adminUser: currentAdmin(req),
      });
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error sincronizando nota crédito.');
    }
  }
);

router.get(
  '/pending-orders',
  requirePermission('billing:view'),
  async (req, res) => {
    try {
      const data = await billingService.listPendingBillableOrders(req.query || {});
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error listando órdenes pendientes por facturar.');
    }
  }
);

router.post(
  '/orders/:orderId/generate',
  requirePermission('billing:create'),
  async (req, res) => {
    try {
      const data = await billingService.generateInvoiceForOrder(req.params.orderId, {
        adminUser: currentAdmin(req),
      });

      res.status(data.created ? 201 : 200).json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error generando factura desde la orden.');
    }
  }
);

router.get(
  '/settings',
  requirePermission('billing:settings'),
  async (_req, res) => {
    try {
      const data = await billingService.getBillingSettingsSnapshot();
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo configuración de facturación.');
    }
  }
);

module.exports = router;
