'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const SiteSettings = require('../models/SiteSettings');
const {
  downloadCreditNoteDocumentFromFactus,
} = require('../lib/dian/providers/factusProvider');

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

async function findInvoice(identifier) {
  const text = cleanText(identifier, 160);
  if (!text) return null;
  if (mongoose.Types.ObjectId.isValid(text)) {
    const byId = await ElectronicInvoice.findById(text);
    if (byId) return byId;
  }
  return ElectronicInvoice.findOne({
    $or: [
      { invoiceNumber: text },
      { orderNumber: text.replace(/^#/, '') },
      { 'provider.number': text },
    ],
  });
}

function findCreditNote(invoice = {}, identifier = '') {
  const text = cleanText(identifier, 180);
  const notes = Array.isArray(invoice.creditNotes) ? invoice.creditNotes : [];
  return notes.find((note) => [
    String(note?._id || ''),
    cleanText(note?.provider?.number, 180),
    cleanText(note?.referenceCode, 180),
    cleanText(note?.idempotencyKey, 180),
  ].includes(text));
}

function mapProviderError(result = {}, type = 'documento') {
  const providerStatus = Number(result?.status);
  const status = providerStatus === 404
    ? 404
    : [400, 422].includes(providerStatus)
      ? 422
      : providerStatus === 503
        ? 503
        : 502;
  return createDocumentError(
    cleanText(result?.error, 500) || `No fue posible descargar el ${type.toUpperCase()} oficial de la nota crédito.`,
    status,
    result?.stage === 'config_incomplete'
      ? 'BILLING_PROVIDER_CONFIG_INCOMPLETE'
      : 'BILLING_CREDIT_NOTE_DOCUMENT_DOWNLOAD_ERROR',
    { providerStatus: result?.status ?? null, stage: result?.stage || '' }
  );
}

async function downloadOfficialCreditNoteDocument({ invoiceId, noteId, type } = {}) {
  const documentType = normalizeType(type);
  if (!documentType) {
    throw createDocumentError(
      'Solo se pueden descargar documentos PDF o XML.',
      422,
      'BILLING_DOCUMENT_TYPE_INVALID'
    );
  }

  const invoice = await findInvoice(invoiceId);
  if (!invoice) {
    throw createDocumentError('Factura relacionada no encontrada.', 404, 'BILLING_INVOICE_NOT_FOUND');
  }

  const note = findCreditNote(invoice, noteId);
  if (!note) {
    throw createDocumentError('Nota crédito no encontrada.', 404, 'BILLING_CREDIT_NOTE_NOT_FOUND');
  }

  const provider = cleanText(note?.provider?.name || invoice?.provider?.name, 60).toLowerCase();
  if (provider !== 'factus') {
    throw createDocumentError(
      'Solo las notas crédito oficiales de Factus tienen PDF y XML descargables.',
      422,
      'BILLING_CREDIT_NOTE_PROVIDER_UNSUPPORTED'
    );
  }

  const validated = note?.provider?.isValidated === true || note.status === 'validated';
  if (!validated) {
    throw createDocumentError(
      'La nota crédito todavía no está validada por Factus.',
      422,
      'BILLING_CREDIT_NOTE_NOT_VALIDATED'
    );
  }

  const number = cleanText(note?.provider?.number, 160);
  if (!number) {
    throw createDocumentError(
      'La nota crédito no tiene número oficial de Factus.',
      422,
      'BILLING_CREDIT_NOTE_NUMBER_MISSING'
    );
  }

  const settings = await SiteSettings.findOne()
    .select('billing.electronicProvider')
    .lean();
  const result = await downloadCreditNoteDocumentFromFactus({
    providerConfig: settings?.billing?.electronicProvider || {},
    creditNoteNumber: number,
    type: documentType,
  });

  if (!result?.success || !Buffer.isBuffer(result.buffer)) {
    throw mapProviderError(result, documentType);
  }

  const cude = cleanText(note?.provider?.cude || note?.provider?.cufe, 220);
  const metadata = {
    available: true,
    provider: 'factus',
    invoiceNumber: number,
    cufe: cude,
    cude,
    fileName: cleanText(result.fileName, 220),
    contentType: cleanText(result.contentType, 100),
    byteLength: result.buffer.length,
    sha256: crypto.createHash('sha256').update(result.buffer).digest('hex'),
    lastDownloadedAt: new Date(),
  };

  await ElectronicInvoice.updateOne(
    { _id: invoice._id, 'creditNotes._id': note._id },
    { $set: { [`creditNotes.$.officialDocuments.${documentType}`]: metadata } }
  );

  return {
    official: true,
    provider: 'factus',
    invoice,
    creditNote: note,
    number,
    fiscalKey: metadata.cude,
    type: documentType,
    buffer: result.buffer,
    fileName: metadata.fileName,
    contentType: metadata.contentType,
    byteLength: metadata.byteLength,
    sha256: metadata.sha256,
  };
}

module.exports = {
  downloadOfficialCreditNoteDocument,
  findCreditNote,
  normalizeType,
};
