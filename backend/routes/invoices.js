'use strict';

// backend/routes/invoices.js
const express = require('express');

const invoiceService = require('../services/invoiceService');

const router = express.Router();

function sendError(res, error, fallback = 'Error consultando comprobante.') {
  const status = Number(error?.status || error?.statusCode || 500);
  return res.status(status).json({
    ok: false,
    error: error?.code || 'INVOICE_PUBLIC_ERROR',
    message: error?.message || fallback,
  });
}

router.get('/:id/public', async (req, res) => {
  try {
    const data = await invoiceService.getInvoicePublic(req.params.id, req.query || {});
    res.json({ ok: true, data });
  } catch (error) {
    sendError(res, error, 'No se pudo consultar el comprobante.');
  }
});

module.exports = router;
