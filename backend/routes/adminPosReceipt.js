// backend/routes/adminPosReceipt.js

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  buildPosReceipt,
  buildReceiptPdfBuffer,
  sendPosReceiptEmail,
} = require('../services/posReceiptService');
const {
  buildPosResourceAccess,
} = require('../services/adminPosAccessService');

const router = express.Router();

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function sendError(res, error) {
  const status = Number(error?.statusCode || error?.status || 500);

  if (status >= 500) {
    console.error('[adminPosReceiptRoutes] Error:', error);
  }

  return res.status(status).json({
    ok: false,
    error: error?.code || 'POS_RECEIPT_ROUTE_ERROR',
    message: error?.message || 'No se pudo procesar el comprobante POS.',
    details: error?.details || {},
  });
}

router.use(requireAdmin);

router.get('/sales/:id/receipt', requirePermission('pos:receipt'), async (req, res) => {
  try {
    const access = buildPosResourceAccess(req);
    const receipt = await buildPosReceipt(req.params.id, access);

    return res.json({
      ok: true,
      receipt,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/sales/:id/receipt/pdf', requirePermission('pos:receipt'), async (req, res) => {
  try {
    const access = buildPosResourceAccess(req);
    const receipt = await buildPosReceipt(req.params.id, access);
    const pdfBuffer = await buildReceiptPdfBuffer(receipt);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="comprobante-pos-${receipt.order.orderNumber}.pdf"`
    );

    return res.send(pdfBuffer);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/sales/:id/send-email', requirePermission('pos:receipt'), async (req, res) => {
  try {
    const access = buildPosResourceAccess(req);
    const result = await sendPosReceiptEmail(req.params.id, {
      to: cleanText(req.body?.to || ''),
      branchIds: access.branchIds,
    });

    return res.json({
      ok: true,
      message: result.message,
      to: result.to,
      subject: result.subject,
      receipt: result.receipt,
      invoice: result.invoice,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
