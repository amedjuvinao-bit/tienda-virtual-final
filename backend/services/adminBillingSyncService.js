'use strict';

// Sincronizacion real del modulo unificado de Facturacion.
// Consulta el proveedor configurado y actualiza ElectronicInvoice sin crear modelos paralelos.

const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const SiteSettings = require('../models/SiteSettings');
const {
  getCreditNoteFromFactus,
  getInvoiceFromFactus,
} = require('../lib/dian/providers/factusProvider');
const { serializeElectronicInvoice, serializeCreditNote } = require('./adminBillingService');

function cleanText(value, max = 180) {
  if (value === undefined || value === null) return '';
  return String(value).trim().replace(/\s+/g, ' ').slice(0, max);
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function toPlain(value) {
  return value?.toObject ? value.toObject() : value || {};
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function hasDocumentShape(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  return Boolean(
    firstValue(
      value.number,
      value.invoiceNumber,
      value.reference_code,
      value.referenceCode,
      value.cufe,
      value.cude,
      value.is_validated,
      value.validated_at,
      value.status
    ) !== undefined
  );
}

function extractFactusNumber(value = {}, type = 'invoice') {
  const remote = extractRemoteDocument(value, type);
  return cleanText(firstValue(remote?.number, remote?.invoiceNumber), 160);
}

function resolveFactusInvoiceNumber(invoice = {}) {
  const rawCandidates = [
    invoice?.provider?.raw,
    invoice?.provider?.raw?.response,
    invoice?.dianResponse?.raw,
    invoice?.dianResponse?.raw?.providerResponse,
    invoice?.dianResponse?.raw?.billingSync?.response,
  ];

  for (const candidate of rawCandidates) {
    const remoteNumber = extractFactusNumber(candidate, 'invoice');
    if (remoteNumber) return remoteNumber;
  }

  const providerNumber = cleanText(invoice?.provider?.number, 160);
  const localNumber = cleanText(invoice?.invoiceNumber, 160);
  const source = cleanText(invoice?.provider?.raw?.source, 80).toLowerCase();
  const isLocalPlaceholder =
    source === 'admin-billing' &&
    (!providerNumber || providerNumber === localNumber);

  if (isLocalPlaceholder) return '';
  return providerNumber || localNumber;
}

function extractRemoteDocument(payload = {}, type = 'invoice') {
  const data = payload?.data;
  const nested = data?.data;
  const typeKeys = type === 'credit-note'
    ? ['credit_note', 'creditNote', 'note']
    : ['bill', 'invoice'];

  const candidates = [];
  [nested, data, payload].forEach((container) => {
    if (!container || typeof container !== 'object') return;
    typeKeys.forEach((key) => candidates.push(container?.[key]));
    candidates.push(container);
  });

  return candidates.find(hasDocumentShape) || {};
}

function providerStatusText(remote = {}) {
  return cleanText(
    firstValue(
      remote.validation_status,
      remote.validationStatus,
      remote.document_status,
      remote.documentStatus,
      remote.dian_status,
      remote.dianStatus,
      remote.status
    ),
    80
  ).toLowerCase();
}

function includesAny(text, values = []) {
  return values.some((value) => text.includes(value));
}

function normalizeRemoteStatus(remote = {}, type = 'invoice') {
  const statusText = providerStatusText(remote);
  const statusNumber = Number(remote.status);
  const hasValidatedFlag = remote.is_validated === true || remote.validated === true;
  const hasPendingFlag = remote.is_validated === false || remote.validated === false;
  const hasFiscalKey = Boolean(firstValue(remote.cufe, remote.cude));
  const hasValidationDate = Boolean(firstValue(remote.validated_at, remote.validatedAt));
  const isValidated =
    !hasPendingFlag && (
      hasValidatedFlag ||
      statusNumber === 1 ||
      hasFiscalKey ||
      hasValidationDate ||
      includesAny(statusText, ['validated', 'accepted', 'validada', 'validado', 'aprobada', 'aprobado'])
    );

  if (includesAny(statusText, ['rejected', 'rechazada', 'rechazado'])) {
    return { localStatus: 'rejected', providerStatus: 'rejected', isValidated: false };
  }

  if (includesAny(statusText, ['failed', 'error', 'fallida', 'fallido'])) {
    return { localStatus: 'failed', providerStatus: 'failed', isValidated: false };
  }

  if (isValidated) {
    return {
      localStatus: type === 'credit-note' ? 'validated' : 'accepted',
      providerStatus: 'validated',
      isValidated: true,
    };
  }

  if (includesAny(statusText, ['sent', 'enviada', 'enviado'])) {
    return { localStatus: 'sent', providerStatus: 'sent', isValidated: false };
  }

  return {
    localStatus: type === 'credit-note' ? 'pending' : 'generated',
    providerStatus: 'pending',
    isValidated: false,
  };
}

function normalizedIdentity(value) {
  return cleanText(value, 220).replace(/\s+/g, '').toUpperCase();
}

function assertRemoteIdentity({
  requestedNumber,
  remoteNumber,
  storedProviderCufe = '',
  remoteCufe = '',
} = {}) {
  const expectedNumber = normalizedIdentity(requestedNumber);
  const receivedNumber = normalizedIdentity(remoteNumber);
  const expectedCufe = normalizedIdentity(storedProviderCufe);
  const receivedCufe = normalizedIdentity(remoteCufe);

  if (!receivedNumber) {
    const error = new Error('Factus respondió, pero no devolvió el número oficial de la factura consultada.');
    error.code = 'BILLING_PROVIDER_IDENTITY_MISSING';
    return error;
  }

  if (expectedNumber && expectedNumber !== receivedNumber) {
    const error = new Error(
      'Factus devolvió una factura diferente a la solicitada. No se modificaron el número ni el CUFE guardados.'
    );
    error.code = 'BILLING_PROVIDER_IDENTITY_MISMATCH';
    return error;
  }

  if (expectedCufe && receivedCufe && expectedCufe !== receivedCufe) {
    const error = new Error(
      'El CUFE devuelto por Factus no coincide con el CUFE oficial guardado. La sincronización fue bloqueada.'
    );
    error.code = 'BILLING_PROVIDER_CUFE_MISMATCH';
    return error;
  }

  return null;
}

function extractLinks(remote = {}) {
  const links = remote.links || remote.urls || {};

  return {
    ...links,
    public_url: firstValue(
      links.public_url,
      links.publicUrl,
      remote.public_url,
      remote.publicUrl
    ) || '',
    pdf_url: firstValue(links.pdf_url, links.pdfUrl, remote.pdf_url, remote.pdfUrl) || '',
    xml_url: firstValue(links.xml_url, links.xmlUrl, remote.xml_url, remote.xmlUrl) || '',
    qr: firstValue(links.qr, links.qr_url, links.qrUrl, remote.qr, remote.qr_url) || '',
  };
}

function extractProviderErrors(payload = {}, remote = {}) {
  return firstValue(
    remote.errors,
    remote.error_messages,
    payload?.errors,
    payload?.data?.errors,
    payload?.data?.data?.errors,
    {}
  );
}

function providerMessage(result = {}, remote = {}, fallback = '') {
  const message = firstValue(
    remote.message,
    result?.data?.message,
    result?.data?.data?.message,
    result?.message,
    result?.error,
    fallback
  );

  if (typeof message === 'string') return cleanText(message, 500);

  try {
    return cleanText(JSON.stringify(message), 500);
  } catch {
    return cleanText(fallback, 500);
  }
}

function currentProvider(invoice = {}, settings = {}) {
  return cleanText(
    invoice?.provider?.name || settings?.billing?.electronicProvider?.provider || 'mock',
    60
  ).toLowerCase();
}

function normalizeHttpStatus(value) {
  if (value === undefined || value === null || value === '') return null;
  const status = Number(value);
  return Number.isFinite(status) ? status : null;
}

function validDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function buildSyncSnapshot({
  status,
  provider,
  providerStatus = '',
  message,
  httpStatus,
  adminUser,
  now,
  previous = {},
}) {
  return {
    ...toPlain(previous),
    status,
    provider,
    providerStatus,
    message: cleanText(message, 500),
    httpStatus: normalizeHttpStatus(httpStatus),
    adminUser: cleanText(adminUser || 'admin', 160),
    lastAttemptAt: now,
    lastSuccessAt: status === 'success' ? now : previous?.lastSuccessAt || null,
  };
}

function buildSyncRaw({ target, provider, previousStatus, nextStatus, result, adminUser, now }) {
  return {
    source: 'admin-billing',
    target,
    provider,
    previousStatus: cleanText(previousStatus, 80),
    status: cleanText(nextStatus, 80),
    httpStatus: normalizeHttpStatus(result?.status),
    syncedAt: now.toISOString(),
    adminUser: cleanText(adminUser || 'admin', 160),
    response: result?.data || null,
  };
}

function createServiceError(result = {}, fallback = 'No fue posible sincronizar el documento.') {
  const providerStatus = Number(result?.status);
  const error = new Error(providerMessage(result, {}, fallback));

  if (providerStatus === 404) error.status = 404;
  else if (providerStatus === 400 || providerStatus === 422) error.status = 422;
  else if (providerStatus === 401 || providerStatus === 403) error.status = 502;
  else if (providerStatus === 501) error.status = 501;
  else error.status = 502;

  error.code = result?.code || (
    result?.stage === 'config_incomplete'
      ? 'BILLING_PROVIDER_CONFIG_INCOMPLETE'
      : 'BILLING_PROVIDER_SYNC_ERROR'
  );
  return error;
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

async function loadProviderSettings() {
  return SiteSettings.findOne().select('billing.electronicProvider').lean();
}

function unsupportedProviderResult(provider) {
  if (!provider || provider === 'mock' || provider === 'internal') {
    return {
      success: false,
      provider: provider || 'mock',
      status: 422,
      stage: 'internal_provider',
      error: 'El documento es interno y no tiene un proveedor externo para sincronizar.',
    };
  }

  return {
    success: false,
    provider,
    status: 501,
    stage: 'unsupported_provider',
    error: `La consulta de estados todavía no está implementada para el proveedor ${provider}.`,
  };
}

async function saveInvoiceSyncFailure(invoice, provider, result, options = {}) {
  const now = new Date();
  const message = providerMessage(result, {}, 'No fue posible consultar el estado del proveedor.');

  invoice.sync = buildSyncSnapshot({
    status: 'failed',
    provider,
    providerStatus: cleanText(result?.stage, 80),
    message,
    httpStatus: result?.status,
    adminUser: options.adminUser,
    now,
    previous: invoice.sync,
  });
  invoice.providerErrors = {
    ...toPlain(invoice.providerErrors),
    billingSync: {
      provider,
      status: result?.status || null,
      stage: result?.stage || '',
      message,
      syncedAt: now.toISOString(),
    },
  };
  await invoice.save();
}

async function syncInvoice(identifier, options = {}) {
  const invoice = await findInvoice(identifier);
  if (!invoice) {
    const error = new Error('Factura no encontrada para sincronizar.');
    error.status = 404;
    error.code = 'BILLING_INVOICE_NOT_FOUND';
    throw error;
  }

  const settings = await loadProviderSettings();
  const provider = currentProvider(invoice, settings);
  const providerConfig = settings?.billing?.electronicProvider || {};

  if (provider !== 'factus') {
    const result = unsupportedProviderResult(provider);
    await saveInvoiceSyncFailure(invoice, provider, result, options);
    throw createServiceError(result);
  }

  const invoiceNumber = resolveFactusInvoiceNumber(invoice);
  if (!invoiceNumber) {
    const result = {
      success: false,
      provider,
      status: 422,
      stage: 'provider_number_missing',
      error:
        'Esta factura todavía no tiene un número asignado por Factus. ' +
        'El número mostrado es un consecutivo interno y no se puede sincronizar hasta enviarla al proveedor.',
    };
    await saveInvoiceSyncFailure(invoice, provider, result, options);
    throw createServiceError(result);
  }
  const result = await getInvoiceFromFactus({ providerConfig, invoiceNumber });

  if (!result.success) {
    await saveInvoiceSyncFailure(invoice, provider, result, options);
    throw createServiceError(result, 'Factus no pudo devolver el estado de la factura.');
  }

  const remote = extractRemoteDocument(result.data, 'invoice');
  if (!hasDocumentShape(remote)) {
    const malformedResult = {
      ...result,
      success: false,
      status: 502,
      stage: 'invalid_provider_response',
      error: 'Factus respondió, pero no devolvió los datos de la factura.',
    };
    await saveInvoiceSyncFailure(invoice, provider, malformedResult, options);
    throw createServiceError(malformedResult);
  }
  const remoteNumber = cleanText(firstValue(remote.number, remote.invoiceNumber), 160);
  const remoteCufe = cleanText(firstValue(remote.cufe, invoice?.provider?.cufe, invoice.cufe), 220);
  const identityError = assertRemoteIdentity({
    requestedNumber: invoiceNumber,
    remoteNumber,
    storedProviderCufe: invoice?.provider?.cufe,
    remoteCufe: cleanText(remote.cufe, 220),
  });

  if (identityError) {
    const mismatchResult = {
      ...result,
      success: false,
      status: 502,
      stage: 'provider_identity_mismatch',
      error: identityError.message,
      code: identityError.code,
    };
    await saveInvoiceSyncFailure(invoice, provider, mismatchResult, options);
    throw createServiceError(mismatchResult);
  }

  const normalized = normalizeRemoteStatus(remote, 'invoice');
  const previousStatus = invoice.status || invoice?.provider?.status || 'pending';
  const now = new Date();
  const links = extractLinks(remote);
  const validatedAt = firstValue(remote.validated_at, remote.validatedAt, invoice?.provider?.validatedAt, '');
  const message = providerMessage(
    result,
    remote,
    normalized.isValidated
      ? 'Estado consultado en Factus: factura validada.'
      : 'Estado consultado en Factus: factura pendiente de validación.'
  );
  const syncRaw = buildSyncRaw({
    target: 'invoice',
    provider,
    previousStatus,
    nextStatus: normalized.localStatus,
    result,
    adminUser: options.adminUser,
    now,
  });

  invoice.status = normalized.localStatus;
  invoice.invoiceNumber = remoteNumber || invoice.invoiceNumber;
  invoice.cufe = remoteCufe || invoice.cufe;
  invoice.pdfUrl = links.pdf_url || links.public_url || invoice.pdfUrl;
  invoice.xmlUrl = links.xml_url || invoice.xmlUrl;
  invoice.qrUrl = links.qr || invoice.qrUrl;
  invoice.provider = {
    ...toPlain(invoice.provider),
    name: 'factus',
    status: normalized.providerStatus,
    referenceCode: cleanText(firstValue(remote.reference_code, remote.referenceCode, invoice?.provider?.referenceCode), 180),
    number: remoteNumber,
    cufe: remoteCufe,
    isValidated: normalized.isValidated,
    validatedAt,
    links: {
      ...toPlain(invoice?.provider?.links),
      ...links,
    },
    raw: {
      ...toPlain(invoice?.provider?.raw),
      billingSync: syncRaw,
    },
  };
  invoice.dianResponse = {
    ...toPlain(invoice.dianResponse),
    code: `FACTUS_${normalized.providerStatus.toUpperCase()}`,
    stage: normalized.isValidated ? 'provider_validated' : 'provider_status_checked',
    message,
    raw: {
      ...toPlain(invoice?.dianResponse?.raw),
      billingSync: syncRaw,
    },
  };
  invoice.providerErrors = extractProviderErrors(result.data, remote);
  invoice.errorMessage = ['rejected', 'failed'].includes(normalized.localStatus) ? message : '';
  invoice.sync = buildSyncSnapshot({
    status: 'success',
    provider,
    providerStatus: normalized.providerStatus,
    message,
    httpStatus: result.status,
    adminUser: options.adminUser,
    now,
    previous: invoice.sync,
  });

  if (normalized.localStatus === 'sent' && !invoice.sentAt) invoice.sentAt = now;
  if (normalized.isValidated && !invoice.acceptedAt) invoice.acceptedAt = validDate(validatedAt, now);
  if (normalized.localStatus === 'rejected' && !invoice.rejectedAt) invoice.rejectedAt = now;
  if (normalized.localStatus === 'failed' && !invoice.failedAt) invoice.failedAt = now;

  await invoice.save();

  return {
    invoice: serializeElectronicInvoice(invoice.toObject()),
    message: 'Estado de la factura consultado y actualizado desde Factus.',
  };
}

async function saveCreditNoteSyncFailure(invoice, noteIndex, provider, result, options = {}) {
  const note = invoice.creditNotes[noteIndex];
  const now = new Date();
  const message = providerMessage(result, {}, 'No fue posible consultar el estado de la nota crédito.');

  note.sync = buildSyncSnapshot({
    status: 'failed',
    provider,
    providerStatus: cleanText(result?.stage, 80),
    message,
    httpStatus: result?.status,
    adminUser: options.adminUser,
    now,
    previous: note.sync,
  });
  note.providerErrors = {
    ...toPlain(note.providerErrors),
    billingSync: {
      provider,
      status: result?.status || null,
      stage: result?.stage || '',
      message,
      syncedAt: now.toISOString(),
    },
  };
  invoice.markModified('creditNotes');
  await invoice.save();
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
  const settings = await loadProviderSettings();
  const provider = cleanText(
    note?.provider?.name || currentProvider(invoice, settings),
    60
  ).toLowerCase();
  const providerConfig = settings?.billing?.electronicProvider || {};

  if (provider !== 'factus') {
    const result = unsupportedProviderResult(provider);
    await saveCreditNoteSyncFailure(invoice, index, provider, result, options);
    throw createServiceError(result);
  }

  const creditNoteNumber = cleanText(note?.provider?.number || note.referenceCode, 160);
  const result = await getCreditNoteFromFactus({ providerConfig, creditNoteNumber });

  if (!result.success) {
    await saveCreditNoteSyncFailure(invoice, index, provider, result, options);
    throw createServiceError(result, 'Factus no pudo devolver el estado de la nota crédito.');
  }

  const remote = extractRemoteDocument(result.data, 'credit-note');
  if (!hasDocumentShape(remote)) {
    const malformedResult = {
      ...result,
      success: false,
      status: 502,
      stage: 'invalid_provider_response',
      error: 'Factus respondió, pero no devolvió los datos de la nota crédito.',
    };
    await saveCreditNoteSyncFailure(invoice, index, provider, malformedResult, options);
    throw createServiceError(malformedResult);
  }
  const normalized = normalizeRemoteStatus(remote, 'credit-note');
  const previousStatus = note.status || note?.provider?.status || 'pending';
  const now = new Date();
  const links = extractLinks(remote);
  const remoteNumber = cleanText(firstValue(remote.number, note?.provider?.number, note.referenceCode), 160);
  const remoteFiscalKey = cleanText(firstValue(remote.cude, remote.cufe, note?.provider?.cufe), 220);
  const validatedAt = firstValue(remote.validated_at, remote.validatedAt, note?.provider?.validatedAt, '');
  const message = providerMessage(
    result,
    remote,
    normalized.isValidated
      ? 'Estado consultado en Factus: nota crédito validada.'
      : 'Estado consultado en Factus: nota crédito pendiente de validación.'
  );
  const syncRaw = buildSyncRaw({
    target: 'credit-note',
    provider,
    previousStatus,
    nextStatus: normalized.localStatus,
    result,
    adminUser: options.adminUser,
    now,
  });

  note.status = normalized.localStatus;
  note.referenceCode = cleanText(firstValue(remote.reference_code, remote.referenceCode, note.referenceCode), 180);
  note.provider = {
    ...toPlain(note.provider),
    name: 'factus',
    status: normalized.providerStatus,
    number: remoteNumber,
    cufe: remoteFiscalKey,
    isValidated: normalized.isValidated,
    validatedAt,
    links: {
      ...toPlain(note?.provider?.links),
      ...links,
    },
    raw: {
      ...toPlain(note?.provider?.raw),
      billingSync: syncRaw,
    },
  };
  note.providerErrors = extractProviderErrors(result.data, remote);
  note.errorMessage = ['rejected', 'failed'].includes(normalized.localStatus) ? message : '';
  note.sync = buildSyncSnapshot({
    status: 'success',
    provider,
    providerStatus: normalized.providerStatus,
    message,
    httpStatus: result.status,
    adminUser: options.adminUser,
    now,
    previous: note.sync,
  });

  if (normalized.localStatus === 'sent' && !note.sentAt) note.sentAt = now;
  if (normalized.isValidated && !note.validatedAt) note.validatedAt = validDate(validatedAt, now);
  if (normalized.localStatus === 'rejected' && !note.rejectedAt) note.rejectedAt = now;
  if (normalized.localStatus === 'failed' && !note.failedAt) note.failedAt = now;

  invoice.markModified('creditNotes');
  await invoice.save();

  const updated = invoice.toObject();
  const updatedNote = Array.isArray(updated.creditNotes) ? updated.creditNotes[index] : null;

  return {
    creditNote: serializeCreditNote(updated, updatedNote, index),
    invoice: serializeElectronicInvoice(updated),
    message: 'Estado de la nota crédito consultado y actualizado desde Factus.',
  };
}

module.exports = {
  extractRemoteDocument,
  assertRemoteIdentity,
  normalizeRemoteStatus,
  resolveFactusInvoiceNumber,
  syncCreditNote,
  syncInvoice,
};
