'use strict';

// backend/routes/adminBilling.js
// API del módulo unificado Facturación usando ElectronicInvoice.

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const billingService = require('../services/adminBillingService');
const billingReportService = require('../services/adminBillingReportService');
const billingSyncService = require('../services/adminBillingSyncService');
const billingOperationalMonitoringService = require(
  '../services/billingOperationalMonitoringService'
);
const {
  sendValidatedInvoiceEmail,
} = require('../services/electronicInvoiceEmailService');
const {
  createOfficialCreditNote,
} = require('../services/electronicCreditNoteService');
const {
  downloadOfficialCreditNoteDocument,
} = require('../services/electronicCreditNoteDocumentService');

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

function sendOfficialFile(res, result) {
  const fileName = String(result?.fileName || 'documento')
    .replace(/[\r\n"\\/]+/g, '-')
    .slice(0, 220);
  res.setHeader('Content-Type', result?.contentType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', String(result?.buffer?.length || 0));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Invoice-Document-Source', 'factus-official');
  res.setHeader('X-Credit-Note-Number', result?.number || '');
  return res.send(result.buffer);
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
  '/operations/health',
  requirePermission('billing:view'),
  async (_req, res) => {
    try {
      const data =
        await billingOperationalMonitoringService.getOperationalHealth();
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ ok: true, data });
    } catch (error) {
      sendError(
        res,
        error,
        'Error obteniendo el estado operativo de facturación.'
      );
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

router.get(
  '/reports',
  requirePermission('billing:view'),
  async (req, res) => {
    try {
      const data = await billingReportService.buildBillingReport(req.query || {});
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error generando el reporte de facturación.');
    }
  }
);

router.get(
  '/reports/export',
  requirePermission('billing:download'),
  async (req, res) => {
    try {
      const result = await billingReportService.prepareBillingReportCsv(req.query || {});
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Billing-Report-Rows', String(result.totalRows));
      await result.streamTo(res);
      if (!res.writableEnded && !res.destroyed) res.end();
      return undefined;
    } catch (error) {
      if (res.headersSent) {
        if (!res.destroyed) res.destroy(error);
        return undefined;
      }
      return sendError(res, error, 'Error exportando el reporte de facturación.');
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

      if (
        data?.invoice?.provider?.isValidated === true ||
        ['accepted', 'validated'].includes(String(data?.invoice?.status || '').toLowerCase())
      ) {
        try {
          const emailResult = await sendValidatedInvoiceEmail(
            data.invoice.id || req.params.invoiceId,
            {
              automatic: true,
              initiatedBy: currentAdmin(req),
            }
          );
          data.invoice = billingService.serializeElectronicInvoice(
            emailResult.invoice?.toObject
              ? emailResult.invoice.toObject()
              : emailResult.invoice
          );
          data.emailDelivery = emailResult.delivery;
        } catch (emailError) {
          // La sincronización fiscal ya fue exitosa. Un error SMTP se informa
          // por separado y jamás revierte la factura validada.
          if (emailError?.invoice) {
            data.invoice = billingService.serializeElectronicInvoice(
              emailError.invoice?.toObject
                ? emailError.invoice.toObject()
                : emailError.invoice
            );
          }
          data.emailWarning = emailError?.message || 'No se pudo enviar la factura por correo.';
        }
      }

      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error sincronizando factura.');
    }
  }
);

router.post(
  '/documents/:invoiceId/email',
  requirePermission('billing:download'),
  async (req, res) => {
    try {
      const emailResult = await sendValidatedInvoiceEmail(
        req.params.invoiceId,
        {
          automatic: false,
          initiatedBy: currentAdmin(req),
        }
      );
      const invoice = billingService.serializeElectronicInvoice(
        emailResult.invoice?.toObject
          ? emailResult.invoice.toObject()
          : emailResult.invoice
      );

      res.json({
        ok: true,
        data: {
          invoice,
          delivery: emailResult.delivery,
          message: emailResult.message,
        },
      });
    } catch (error) {
      sendError(res, error, 'Error enviando la factura por correo.');
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
  '/credit-notes/:invoiceId',
  requirePermission('billing:credit_note'),
  async (req, res) => {
    try {
      const result = await createOfficialCreditNote(req.params.invoiceId, req.body || {}, {
        adminUser: currentAdmin(req),
      });
      const plainInvoice = result.invoice?.toObject
        ? result.invoice.toObject()
        : result.invoice || {};
      const invoice = {
        ...billingService.serializeElectronicInvoice(plainInvoice),
        creditNotes: Array.isArray(plainInvoice.creditNotes) ? plainInvoice.creditNotes : [],
      };
      res.status(result.created ? 201 : 200).json({
        ok: true,
        data: {
          created: result.created,
          reused: result.reused,
          invoice,
          message: result.message,
        },
      });
    } catch (error) {
      sendError(res, error, 'Error creando nota crédito.');
    }
  }
);

router.get(
  '/credit-notes/:invoiceId/:noteId/pdf',
  requirePermission('billing:download'),
  async (req, res) => {
    try {
      const result = await downloadOfficialCreditNoteDocument({
        invoiceId: req.params.invoiceId,
        noteId: req.params.noteId,
        type: 'pdf',
      });
      return sendOfficialFile(res, result);
    } catch (error) {
      return sendError(res, error, 'Error descargando PDF de la nota crédito.');
    }
  }
);

router.get(
  '/credit-notes/:invoiceId/:noteId/xml',
  requirePermission('billing:download'),
  async (req, res) => {
    try {
      const result = await downloadOfficialCreditNoteDocument({
        invoiceId: req.params.invoiceId,
        noteId: req.params.noteId,
        type: 'xml',
      });
      return sendOfficialFile(res, result);
    } catch (error) {
      return sendError(res, error, 'Error descargando XML de la nota crédito.');
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
