'use strict';

const { generateOrderPdf } = require('../lib/orderPdfGenerator');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const SiteSettings = require('../models/SiteSettings');
const {
  downloadOfficialInvoiceDocument,
} = require('../services/electronicInvoiceDocumentService');
const {
  INVOICE_DOCUMENT_ORDER_ACCESS,
  buildOrderOperationFilter,
  ensureOrderOperationAccess,
  sendOrderScopeError,
} = require('../services/orderRouteAccessService');

function buildInvoiceDocumentOrderAccess(req, orderId) {
  return buildOrderOperationFilter(
    req,
    orderId,
    INVOICE_DOCUMENT_ORDER_ACCESS
  );
}

function ensureInvoiceDocumentOrderAccess(req, res, orderId) {
  return ensureOrderOperationAccess(
    req,
    res,
    orderId,
    INVOICE_DOCUMENT_ORDER_ACCESS
  );
}

function safeInvoiceDownloadName(value, fallback, extension) {
  const name =
    String(value || fallback || 'factura')
      .replace(/[\\/]+/g, '-')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^[_\.]+|[_\.]+$/g, '') || 'factura';

  return name.toLowerCase().endsWith(extension) ? name : `${name}${extension}`;
}

function sendOfficialInvoiceDocument(res, documentResult) {
  const extension = documentResult.type === 'pdf' ? '.pdf' : '.xml';
  const fallback = `factura-${documentResult.invoiceNumber || 'factus'}`;
  const fileName = safeInvoiceDownloadName(
    documentResult.fileName,
    fallback,
    extension
  );

  res.setHeader('Content-Type', documentResult.contentType);
  res.setHeader('Content-Length', String(documentResult.buffer.length));
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Invoice-Document-Source', 'factus');
  res.setHeader('X-Invoice-Number', documentResult.invoiceNumber || '');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Disposition, X-Invoice-Document-Source, X-Invoice-Number'
  );
  return res.status(200).send(documentResult.buffer);
}

function sendInvoiceDocumentError(res, error, fallback) {
  const candidate = Number(error?.status || error?.statusCode || 500);
  const status =
    Number.isInteger(candidate) && candidate >= 400 && candidate <= 599
      ? candidate
      : 500;
  const exposeMessage = status < 500;

  return res.status(status).json({
    error:
      (exposeMessage && error?.code) || 'INVOICE_DOCUMENT_DOWNLOAD_ERROR',
    message: (exposeMessage && error?.message) || fallback,
  });
}

function setPrivateDocumentHeaders(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

async function downloadOrderInvoiceXml(req, res) {
  try {
    const orderId = req.params.id;

    if (!(await ensureInvoiceDocumentOrderAccess(req, res, orderId))) return;

    const documentResult = await downloadOfficialInvoiceDocument({
      orderId,
      type: 'xml',
    });

    if (documentResult.official) {
      return sendOfficialInvoiceDocument(res, documentResult);
    }

    const invoice = documentResult.invoice?.toObject
      ? documentResult.invoice.toObject()
      : documentResult.invoice;

    if (!invoice) {
      return res.status(404).json({
        error: 'INVOICE_NOT_FOUND',
        message: 'No se encontró factura electrónica para esta orden.',
      });
    }

    const xmlContent = String(invoice.xmlContent || '').trim();

    if (!xmlContent) {
      return res.status(404).json({
        error: 'XML_NOT_FOUND',
        message: 'La factura electrónica no tiene XML guardado.',
      });
    }

    const invoiceNumber =
      invoice.invoiceNumber ||
      invoice?.provider?.number ||
      invoice?.provider?.raw?.number ||
      orderId;

    const fileName = safeInvoiceDownloadName(
      `factura-${invoiceNumber || orderId}`,
      `factura-${orderId}`,
      '.xml'
    );

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    setPrivateDocumentHeaders(res);
    res.setHeader('X-Invoice-Document-Source', 'internal');
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Disposition, X-Invoice-Document-Source, X-Invoice-Number'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    return res.status(200).send(xmlContent);
  } catch (error) {
    console.error('GET /orders/:id/invoice-xml', error);
    return sendInvoiceDocumentError(
      res,
      error,
      'No se pudo descargar el XML de la factura.'
    );
  }
}

async function downloadOrderReceiptPdf(req, res) {
  try {
    const access = buildInvoiceDocumentOrderAccess(req, req.params.id);

    if (!access.ok) return sendOrderScopeError(res, access);

    const order = await Order.findOne(access.filter)
      .populate({ path: 'items.product', select: 'title sku price image slug' })
      .lean();

    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const [invoice, settings] = await Promise.all([
      ElectronicInvoice.findOne({ orderId: order._id }).lean(),
      SiteSettings.findOne().lean(),
    ]);

    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Disposition, X-Invoice-Document-Source, X-Invoice-Number'
    );
    res.setHeader('X-Invoice-Document-Source', 'order-receipt');
    setPrivateDocumentHeaders(res);

    await generateOrderPdf({ order, invoice, settings, res });
  } catch (error) {
    console.error('GET /orders/:id/receipt-pdf', error);
    return sendInvoiceDocumentError(
      res,
      error,
      'No se pudo descargar el comprobante PDF de la orden.'
    );
  }
}

async function downloadOrderInvoicePdf(req, res) {
  try {
    const access = buildInvoiceDocumentOrderAccess(req, req.params.id);

    if (!access.ok) return sendOrderScopeError(res, access);

    const order = await Order.findOne(access.filter)
      .populate({ path: 'items.product', select: 'title sku price image slug' })
      .lean();

    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const invoice = await ElectronicInvoice.findOne({ orderId: order._id }).lean();

    if (invoice) {
      const documentResult = await downloadOfficialInvoiceDocument({
        orderId: order._id,
        type: 'pdf',
      });

      if (documentResult.official) {
        return sendOfficialInvoiceDocument(res, documentResult);
      }
    }

    const settings = await SiteSettings.findOne().lean();

    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Disposition, X-Invoice-Document-Source, X-Invoice-Number'
    );
    setPrivateDocumentHeaders(res);

    await generateOrderPdf({ order, invoice, settings, res });
  } catch (error) {
    console.error('GET /orders/:id/pdf', error);
    return sendInvoiceDocumentError(
      res,
      error,
      'No se pudo descargar el PDF de la factura.'
    );
  }
}

module.exports = {
  INVOICE_DOCUMENT_ORDER_ACCESS,
  buildInvoiceDocumentOrderAccess,
  downloadOrderInvoicePdf,
  downloadOrderInvoiceXml,
  downloadOrderReceiptPdf,
  ensureInvoiceDocumentOrderAccess,
  safeInvoiceDownloadName,
  setPrivateDocumentHeaders,
  sendInvoiceDocumentError,
  sendOfficialInvoiceDocument,
};
