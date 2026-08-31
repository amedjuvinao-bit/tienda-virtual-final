'use strict';

// El detalle de órdenes solo necesita un resumen fiscal para presentar el
// estado. Los documentos y artefactos del proveedor se consultan en endpoints
// dedicados protegidos por billing:download.
const ADMIN_ORDER_INVOICE_SUMMARY_PROJECTION = Object.freeze({
  _id: 1,
  orderId: 1,
  orderNumber: 1,
  required: 1,
  status: 1,
  invoiceNumber: 1,
  cufe: 1,
  'provider.name': 1,
  'provider.status': 1,
  'provider.referenceCode': 1,
  'provider.number': 1,
  'provider.cufe': 1,
  'provider.isValidated': 1,
  'provider.validatedAt': 1,
  'emission.state': 1,
  'emission.source': 1,
  'emission.attempts': 1,
  'officialDocuments.pdf.available': 1,
  'officialDocuments.xml.available': 1,
  generatedAt: 1,
  sentAt: 1,
  acceptedAt: 1,
  rejectedAt: 1,
  failedAt: 1,
  createdAt: 1,
  updatedAt: 1,
});

const ADMIN_ORDER_INVOICE_DOWNLOAD_LINK_PROJECTION = Object.freeze({
  ...ADMIN_ORDER_INVOICE_SUMMARY_PROJECTION,
  'provider.links.public_url': 1,
  'provider.links.qr': 1,
});

const ADMIN_ORDER_DETAIL_FORBIDDEN_KEYS = new Set([
  'accessToken',
  'accessTokenHash',
  'assetUrl',
  'bookingUrl',
  'cartAccess',
  'claimId',
  'customsSnapshot',
  'fulfillmentSnapshot',
  'integrityKey',
  'internalInstructions',
  'lockToken',
  'paymentAccess',
  'paymentProcessing',
  'privateKey',
  'providerPayload',
  'raw',
  'rawMethod',
  'rawPayload',
  'refreshToken',
  'requestFingerprint',
  'reservation',
  'reservationId',
  'reservationItem',
  'sessionId',
  'signature',
  'technicalKey',
  'token',
  'webhookPayload',
]);

const ADMIN_ORDER_DETAIL_FORBIDDEN_TOP_LEVEL_KEYS = new Set([
  'paymentDetails',
  'payu',
  'transaction',
  'wompi',
]);

function isScalarObject(value) {
  return Boolean(
    value instanceof Date ||
      (value && typeof value.toHexString === 'function') ||
      Buffer.isBuffer(value)
  );
}

function isSensitiveDetailKey(key) {
  if (ADMIN_ORDER_DETAIL_FORBIDDEN_KEYS.has(key)) return true;
  return /(?:secret|token|fingerprint|signature|password|privatekey|integritykey|payloadhash|requesthash)/i.test(
    String(key || '')
  );
}

function sanitizeAdminOrderDetailValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeAdminOrderDetailValue);
  }
  if (!value || typeof value !== 'object' || isScalarObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isSensitiveDetailKey(key))
      .map(([key, nestedValue]) => [
        key,
        sanitizeAdminOrderDetailValue(nestedValue),
      ])
  );
}

function sanitizeAdminOrderDetail(order = {}) {
  const safeOrder = sanitizeAdminOrderDetailValue(order);

  for (const key of ADMIN_ORDER_DETAIL_FORBIDDEN_TOP_LEVEL_KEYS) {
    delete safeOrder[key];
  }

  return safeOrder;
}

function idText(value) {
  return value == null ? '' : String(value);
}

function serializeOrderAdminInvoiceSummary(invoice) {
  if (!invoice) return null;

  return {
    id: idText(invoice._id),
    orderId: idText(invoice.orderId),
    orderNumber: String(invoice.orderNumber || ''),
    required: invoice.required === true,
    status: String(invoice.status || 'pending'),
    invoiceNumber: String(
      invoice.invoiceNumber || invoice?.provider?.number || ''
    ),
    cufe: String(invoice.cufe || invoice?.provider?.cufe || ''),
    provider: {
      name: String(invoice?.provider?.name || ''),
      status: String(invoice?.provider?.status || ''),
      referenceCode: String(invoice?.provider?.referenceCode || ''),
      number: String(invoice?.provider?.number || ''),
      cufe: String(invoice?.provider?.cufe || ''),
      isValidated: invoice?.provider?.isValidated === true,
      validatedAt: invoice?.provider?.validatedAt || null,
    },
    emission: invoice.emission
      ? {
          state: String(invoice.emission.state || ''),
          source: String(invoice.emission.source || ''),
          attempts: Number(invoice.emission.attempts || 0),
        }
      : null,
    documents: {
      hasPdf: invoice?.officialDocuments?.pdf?.available === true,
      hasXml: invoice?.officialDocuments?.xml?.available === true,
    },
    generatedAt: invoice.generatedAt || null,
    sentAt: invoice.sentAt || null,
    acceptedAt: invoice.acceptedAt || null,
    rejectedAt: invoice.rejectedAt || null,
    failedAt: invoice.failedAt || null,
    createdAt: invoice.createdAt || null,
    updatedAt: invoice.updatedAt || null,
  };
}

function serializeOrderAdminInvoiceDownloadLinks(invoice) {
  if (!invoice) return null;

  return {
    pdfUrl: String(invoice?.provider?.links?.public_url || ''),
    qrUrl: String(invoice?.provider?.links?.qr || ''),
    cufe: String(invoice?.provider?.cufe || invoice.cufe || ''),
    invoiceNumber: String(
      invoice.invoiceNumber || invoice?.provider?.number || ''
    ),
  };
}

function presentAdminOrderDetail(
  order,
  invoice,
  { includeDownloadLinks = false } = {}
) {
  const {
    electronicInvoice: _embeddedElectronicInvoice,
    factusInvoice: _embeddedFactusInvoice,
    factusLinks: _embeddedFactusLinks,
    invoice: _embeddedInvoice,
    dian: _embeddedDian,
    factus: _embeddedFactus,
    ...safeOrder
  } = order || {};

  const presentedOrder = sanitizeAdminOrderDetail(safeOrder);

  const detail = {
    ...presentedOrder,
    electronicInvoice: serializeOrderAdminInvoiceSummary(invoice),
  };

  if (includeDownloadLinks) {
    detail.factusLinks = serializeOrderAdminInvoiceDownloadLinks(invoice);
  }

  return detail;
}

module.exports = {
  ADMIN_ORDER_DETAIL_FORBIDDEN_KEYS,
  ADMIN_ORDER_DETAIL_FORBIDDEN_TOP_LEVEL_KEYS,
  ADMIN_ORDER_INVOICE_DOWNLOAD_LINK_PROJECTION,
  ADMIN_ORDER_INVOICE_SUMMARY_PROJECTION,
  presentAdminOrderDetail,
  sanitizeAdminOrderDetail,
  sanitizeAdminOrderDetailValue,
  serializeOrderAdminInvoiceDownloadLinks,
  serializeOrderAdminInvoiceSummary,
};
