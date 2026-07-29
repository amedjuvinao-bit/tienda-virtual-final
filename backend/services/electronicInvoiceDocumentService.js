'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const SiteSettings = require('../models/SiteSettings');
const {
  downloadInvoiceDocumentFromFactus,
} = require('../lib/dian/providers/factusProvider');
const {
  resolveFactusInvoiceNumber,
} = require('./adminBillingSyncService');

function cleanText(value, max = 220) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function createDocumentError(message, status, code, details = {}) {
  return Object.assign(new Error(message), { status, code, ...details });
}

function normalizeType(type) {
  const value = cleanText(type, 20).toLowerCase();
  return value === 'pdf' || value === 'xml' ? value : '';
}

function providerName(invoice = {}, settings = {}) {
  return cleanText(
    invoice?.provider?.name || settings?.billing?.electronicProvider?.provider || 'internal',
    60
  ).toLowerCase();
}

function mapProviderDownloadError(result = {}, type = 'documento') {
  const providerStatus = Number(result?.status);
  let status = 502;

  if (providerStatus === 404) status = 404;
  else if (providerStatus === 400 || providerStatus === 422) status = 422;
  else if (providerStatus === 503) status = 503;

  return createDocumentError(
    cleanText(result?.error, 500) || `No fue posible descargar el ${type.toUpperCase()} oficial.`,
    status,
    result?.stage === 'config_incomplete'
      ? 'BILLING_PROVIDER_CONFIG_INCOMPLETE'
      : 'BILLING_OFFICIAL_DOCUMENT_DOWNLOAD_ERROR',
    { providerStatus: result?.status ?? null, stage: result?.stage || '' }
  );
}

async function findInvoiceByOrderId(orderId) {
  const id = cleanText(orderId, 120);
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return ElectronicInvoice.findOne({ orderId: id });
}

async function downloadOfficialInvoiceDocument({ orderId, type } = {}) {
  const documentType = normalizeType(type);
  if (!documentType) {
    throw createDocumentError(
      'Solo se pueden descargar documentos PDF o XML.',
      422,
      'BILLING_DOCUMENT_TYPE_INVALID'
    );
  }

  const invoice = await findInvoiceByOrderId(orderId);
  if (!invoice) {
    throw createDocumentError(
      'No se encontró factura electrónica para esta orden.',
      404,
      'BILLING_INVOICE_NOT_FOUND'
    );
  }

  const settings = await SiteSettings.findOne()
    .select('billing.electronicProvider')
    .lean();
  const provider = providerName(invoice, settings);

  if (provider !== 'factus') {
    return {
      official: false,
      provider,
      invoice,
    };
  }

  const invoiceNumber = resolveFactusInvoiceNumber(invoice);
  if (!invoiceNumber) {
    throw createDocumentError(
      'La factura todavía no tiene un número oficial de Factus para descargar sus documentos.',
      422,
      'BILLING_PROVIDER_NUMBER_MISSING'
    );
  }

  const result = await downloadInvoiceDocumentFromFactus({
    providerConfig: settings?.billing?.electronicProvider || {},
    invoiceNumber,
    type: documentType,
  });

  if (!result?.success || !Buffer.isBuffer(result.buffer)) {
    throw mapProviderDownloadError(result, documentType);
  }

  const now = new Date();
  const cufe = cleanText(invoice?.provider?.cufe || invoice.cufe, 220);
  const metadata = {
    available: true,
    provider: 'factus',
    invoiceNumber,
    cufe,
    fileName: cleanText(result.fileName, 220),
    contentType: cleanText(result.contentType, 100),
    byteLength: result.buffer.length,
    sha256: crypto.createHash('sha256').update(result.buffer).digest('hex'),
    lastDownloadedAt: now,
  };

  await ElectronicInvoice.updateOne(
    { _id: invoice._id },
    {
      $set: {
        [`officialDocuments.${documentType}`]: metadata,
      },
    }
  );

  return {
    official: true,
    provider: 'factus',
    invoice,
    invoiceNumber,
    cufe,
    type: documentType,
    buffer: result.buffer,
    fileName: metadata.fileName,
    contentType: metadata.contentType,
    byteLength: metadata.byteLength,
    sha256: metadata.sha256,
  };
}

module.exports = {
  downloadOfficialInvoiceDocument,
  normalizeType,
  providerName,
};
