'use strict';

// backend/services/adminBillingSyncService.js
// Sincronizacion controlada del modulo unificado de Facturacion.
// No crea modelos paralelos; actualiza ElectronicInvoice y ElectronicInvoice.creditNotes.

const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const { serializeElectronicInvoice, serializeCreditNote } = require('./adminBillingService');

function cleanText(value, max = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function isRejectedOrFailed(status) {
  return ['rejected', 'failed', 'error'].includes(cleanText(status, 50).toLowerCase());
}

function normalizeInvoiceStatus(invoice = {}) {
  const status = cleanText(invoice.status, 50).toLowerCase();
  const providerStatus = cleanText(invoice?.provider?.status, 50).toLowerCase();

  if (isRejectedOrFailed(status)) return status;
  if (isRejectedOrFailed(providerStatus)) return providerStatus === 'error' ? 'error' : providerStatus;

  const hasFiscalKey = Boolean(invoice.cufe || invoice?.provider?.cufe || invoice?.provider?.raw?.cufe);
  const providerValidated = invoice?.provider?.isValidated === true;

  if (providerValidated || hasFiscalKey || ['accepted', 'validated', 'validada', 'validado'].includes(providerStatus)) {
    return 'accepted';
  }

  if (['sent'].includes(status) || ['sent'].includes(providerStatus)) return 'sent';
  return 'generated';
}

function normalizeCreditNoteStatus(note = {}) {
  const status = cleanText(note.status, 50).toLowerCase();
  const providerStatus = cleanText(note?.provider?.status, 50).toLowerCase();

  if (['rejected', 'failed'].includes(status)) return status;
  if (['rejected', 'failed'].includes(providerStatus)) return providerStatus;

  const hasFiscalKey = Boolean(
    note?.provider?.cufe ||
      note?.provider?.cude ||
      note?.provider?.number ||
      note?.provider?.raw?.cufe ||
      note?.provider?.raw?.cude
  );
  const providerValidated = note?.provider?.isValidated === true;

  if (providerValidated || hasFiscalKey || ['validated', 'accepted', 'validada', 'validado'].includes(providerStatus)) {
    return 'validated';
  }

  if (['sent'].includes(status) || ['sent'].includes(providerStatus)) return 'sent';
  return 'pending';
}

async function findInvoice(identifier) {
  const text = cleanText(identifier, 120);
  if (!text) return null;

  if (isObjectId(text)) {
    const byId = await ElectronicInvoice.findById(text);
    if (byId) return byId;
  }

  return ElectronicInvoice.findOne({
    $or: [
      { invoiceNumber: text },
      { orderNumber: text.replace(/^#/, '') },
      { cufe: text },
      { 'provider.number': text },
      { 'provider.referenceCode': text },
      { 'provider.cufe': text },
    ],
  });
}

function findCreditNoteIndex(invoice, noteIdentifier) {
  const notes = Array.isArray(invoice?.creditNotes) ? invoice.creditNotes : [];
  const text = cleanText(noteIdentifier, 160);

  if (!text) return -1;

  return notes.findIndex((note, index) => {
    const candidates = [
      String(note?._id || ''),
      `${invoice._id || 'invoice'}-${index}`,
      note?.referenceCode,
      note?.billNumber,
      note?.provider?.number,
      note?.provider?.referenceCode,
      note?.provider?.cufe,
      note?.provider?.cude,
    ].filter(Boolean).map((item) => cleanText(item, 160));

    return candidates.includes(text);
  });
}

async function syncInvoice(identifier, options = {}) {
  const invoice = await findInvoice(identifier);
  if (!invoice) {
    const error = new Error('Factura no encontrada para sincronizar.');
    error.status = 404;
    error.code = 'BILLING_INVOICE_NOT_FOUND';
    throw error;
  }

  const previousStatus = invoice.status || invoice?.provider?.status || 'pending';
  const nextStatus = normalizeInvoiceStatus(invoice);
  const now = new Date();
  const nowIso = now.toISOString();
  const providerName = invoice?.provider?.name || 'internal';
  const isAccepted = nextStatus === 'accepted';
  const isFailed = ['rejected', 'failed', 'error'].includes(nextStatus);

  invoice.status = nextStatus;
  invoice.provider = {
    ...(invoice.provider?.toObject ? invoice.provider.toObject() : invoice.provider || {}),
    status: isAccepted ? 'validated' : nextStatus,
    isValidated: isAccepted,
    validatedAt: isAccepted ? (invoice?.provider?.validatedAt || nowIso) : invoice?.provider?.validatedAt || '',
    raw: {
      ...(invoice?.provider?.raw || {}),
      billingSync: {
        source: 'admin-billing',
        target: 'invoice',
        provider: providerName,
        previousStatus,
        status: nextStatus,
        syncedAt: nowIso,
        adminUser: options.adminUser || 'admin',
      },
    },
  };

  invoice.dianResponse = {
    ...(invoice.dianResponse?.toObject ? invoice.dianResponse.toObject() : invoice.dianResponse || {}),
    code: isAccepted ? 'SYNC_VALIDATED' : isFailed ? 'SYNC_ERROR' : 'SYNC_PENDING',
    stage: isAccepted ? 'provider_validated' : isFailed ? 'provider_error' : 'provider_pending',
    message: isAccepted
      ? 'Estado sincronizado: documento validado.'
      : isFailed
        ? 'Estado sincronizado: documento con error o rechazo.'
        : 'Estado sincronizado: documento pendiente de validacion del proveedor.',
    raw: {
      ...(invoice.dianResponse?.raw || {}),
      billingSync: {
        syncedAt: nowIso,
        previousStatus,
        status: nextStatus,
      },
    },
  };

  if (isAccepted && !invoice.acceptedAt) invoice.acceptedAt = now;
  if (isFailed && nextStatus === 'rejected' && !invoice.rejectedAt) invoice.rejectedAt = now;
  if (isFailed && ['failed', 'error'].includes(nextStatus) && !invoice.failedAt) invoice.failedAt = now;

  await invoice.save();

  return {
    invoice: serializeElectronicInvoice(invoice.toObject()),
    message: 'Factura sincronizada correctamente.',
  };
}

async function syncCreditNote(invoiceIdentifier, noteIdentifier, options = {}) {
  const invoice = await findInvoice(invoiceIdentifier);
  if (!invoice) {
    const error = new Error('Factura relacionada no encontrada para sincronizar la nota crédito.');
    error.status = 404;
    error.code = 'BILLING_INVOICE_NOT_FOUND';
    throw error;
  }

  const index = findCreditNoteIndex(invoice, noteIdentifier);
  if (index < 0) {
    const error = new Error('Nota crédito no encontrada para sincronizar.');
    error.status = 404;
    error.code = 'BILLING_CREDIT_NOTE_NOT_FOUND';
    throw error;
  }

  const note = invoice.creditNotes[index];
  const previousStatus = note.status || note?.provider?.status || 'pending';
  const nextStatus = normalizeCreditNoteStatus(note);
  const now = new Date();
  const nowIso = now.toISOString();
  const isValidated = nextStatus === 'validated';
  const isRejected = nextStatus === 'rejected';
  const isFailed = nextStatus === 'failed';

  note.status = nextStatus;
  note.provider = {
    ...(note.provider?.toObject ? note.provider.toObject() : note.provider || {}),
    status: nextStatus,
    isValidated,
    validatedAt: isValidated ? (note?.provider?.validatedAt || nowIso) : note?.provider?.validatedAt || '',
    raw: {
      ...(note?.provider?.raw || {}),
      billingSync: {
        source: 'admin-billing',
        target: 'credit-note',
        invoiceId: String(invoice._id || ''),
        previousStatus,
        status: nextStatus,
        syncedAt: nowIso,
        adminUser: options.adminUser || 'admin',
      },
    },
  };

  if (isValidated && !note.validatedAt) note.validatedAt = now;
  if (isRejected && !note.rejectedAt) note.rejectedAt = now;
  if (isFailed && !note.failedAt) note.failedAt = now;

  invoice.markModified('creditNotes');
  await invoice.save();

  const updated = invoice.toObject();
  const updatedNote = Array.isArray(updated.creditNotes) ? updated.creditNotes[index] : null;

  return {
    creditNote: serializeCreditNote(updated, updatedNote, index),
    invoice: serializeElectronicInvoice(updated),
    message: 'Nota crédito sincronizada correctamente.',
  };
}

module.exports = {
  syncCreditNote,
  syncInvoice,
};
