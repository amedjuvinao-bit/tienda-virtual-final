'use strict';

const SiteSettings = require('../models/SiteSettings');
const {
  BillingConfigurationError,
  buildFactusCredentialFingerprint,
  buildRuntimeFactusConfig,
  encryptBillingSecret,
} = require('../lib/billing/billingConfigurationSecurity');

const FACTUS_RANGE_DOCUMENTS = Object.freeze({
  invoice: '21',
  creditNote: '22',
});

const SECRET_FIELDS = Object.freeze([
  'clientSecret',
  'password',
  'softwarePin',
  'technicalKey',
]);
const creditNoteRangeCreationLocks = new Set();

function cleanText(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function toInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function positiveInteger(value) {
  const parsed = toInteger(value, 0);
  return parsed > 0 ? parsed : 0;
}

function normalizeCreditNoteRangeInput(input = {}) {
  const prefix = cleanText(input?.prefix, 20).toUpperCase();
  const rawCurrent = cleanText(input?.current, 30);

  if (!/^[A-Z0-9]{1,4}$/.test(prefix)) {
    throw new BillingConfigurationError(
      'El prefijo del rango debe tener entre 1 y 4 caracteres alfanuméricos.',
      'FACTUS_CREDIT_NOTE_RANGE_PREFIX_INVALID',
      422,
      ['prefix']
    );
  }

  if (!/^\d+$/.test(rawCurrent)) {
    throw new BillingConfigurationError(
      'El consecutivo del rango debe ser un número entero positivo.',
      'FACTUS_CREDIT_NOTE_RANGE_CURRENT_INVALID',
      422,
      ['current']
    );
  }

  const current = positiveInteger(rawCurrent);
  if (!(current > 0) || !Number.isSafeInteger(current)) {
    throw new BillingConfigurationError(
      'El consecutivo del rango debe ser un número entero positivo válido.',
      'FACTUS_CREDIT_NOTE_RANGE_CURRENT_INVALID',
      422,
      ['current']
    );
  }

  return {
    document: FACTUS_RANGE_DOCUMENTS.creditNote,
    prefix,
    current,
  };
}

function toBoolean(value, fallback = false) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  return fallback;
}

function isoDate(value) {
  const normalized = cleanText(value, 20);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const dmy = normalized.match(/^(\d{2})[-/]([0-1]\d)[-/](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  return '';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function extractRangeList(payload = {}) {
  const candidates = [
    payload?.data?.data,
    payload?.data,
    payload?.numbering_ranges,
    payload?.numberingRanges,
    payload?.ranges,
    payload,
  ];

  return candidates.find(Array.isArray) || [];
}

function normalizeDocumentCode(value, expectedDocument = '') {
  const raw = cleanText(value, 160);
  const normalized = raw.toLowerCase();

  if (raw === FACTUS_RANGE_DOCUMENTS.invoice) {
    return FACTUS_RANGE_DOCUMENTS.invoice;
  }
  if (raw === FACTUS_RANGE_DOCUMENTS.creditNote) {
    return FACTUS_RANGE_DOCUMENTS.creditNote;
  }
  if (normalized.includes('nota') && normalized.includes('cr')) {
    return FACTUS_RANGE_DOCUMENTS.creditNote;
  }
  if (normalized.includes('factura')) {
    return FACTUS_RANGE_DOCUMENTS.invoice;
  }

  return cleanText(expectedDocument, 20);
}

function rangeDocumentCode(range = {}, expectedDocument = '') {
  const document = range?.document;
  const raw =
    document?.code ||
    document?.id ||
    range?.document_code ||
    range?.document_id ||
    range?.documentCode ||
    (typeof document === 'string' || typeof document === 'number'
      ? document
      : '');

  return normalizeDocumentCode(raw, expectedDocument);
}

function rangeDocumentName(range = {}, fallback = '') {
  const document = range?.document;
  return cleanText(
    document?.name ||
      range?.document_name ||
      range?.documentName ||
      (typeof document === 'string' && !/^\d+$/.test(document)
        ? document
        : '') ||
      fallback,
    160
  );
}

function normalizeFactusRange(range = {}, expectedDocument = '') {
  const id = positiveInteger(range?.id || range?.numbering_range_id);
  const from = positiveInteger(range?.from ?? range?.range_from);
  const to = positiveInteger(range?.to ?? range?.range_to);
  const rawCurrent = toInteger(range?.current ?? range?.current_number, 0);
  const current = rawCurrent > 0 ? rawCurrent : from;
  const startDate = isoDate(range?.start_date || range?.resolution_date);
  const endDate = isoDate(range?.end_date || range?.expiration_date);
  const document = rangeDocumentCode(range, expectedDocument);
  const active = toBoolean(range?.is_active, true);
  const expiredByFlag = toBoolean(range?.is_expired, false);
  const expiredByDate = Boolean(endDate && endDate < todayIso());
  const exhausted = Boolean(to > 0 && current > to);
  const validBounds = from > 0 && to >= from && current >= from;
  const correctDocument = !expectedDocument || document === expectedDocument;
  const eligible = Boolean(
    id > 0 &&
      active &&
      !expiredByFlag &&
      !expiredByDate &&
      !exhausted &&
      validBounds &&
      correctDocument
  );

  return {
    id,
    document,
    documentName: rangeDocumentName(
      range,
      document === FACTUS_RANGE_DOCUMENTS.invoice
        ? 'Factura de venta'
        : document === FACTUS_RANGE_DOCUMENTS.creditNote
          ? 'Nota crédito'
          : 'Documento fiscal'
    ),
    prefix: cleanText(range?.prefix, 40),
    from,
    to,
    current,
    resolutionNumber: cleanText(
      range?.resolution_number || range?.resolutionNumber,
      120
    ),
    startDate,
    endDate,
    active,
    expired: expiredByFlag || expiredByDate,
    exhausted,
    eligible,
    technicalKey: cleanText(
      range?.technical_key || range?.technicalKey,
      1000
    ),
  };
}

function publicRange(range = {}) {
  const { technicalKey, ...safe } = range;
  void technicalKey;
  return safe;
}

function candidateBillingFromPayload(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  if (payload.billing && typeof payload.billing === 'object') return payload.billing;
  return payload;
}

function preserveSecret(incomingValue, storedValue) {
  return cleanText(incomingValue, 2000) ? incomingValue : storedValue;
}

function mergeCandidateBilling(storedBilling = {}, payload = {}) {
  const incoming = candidateBillingFromPayload(payload);
  const storedProvider = storedBilling?.electronicProvider || {};
  const incomingProvider = incoming?.electronicProvider || {};
  const provider = {
    ...storedProvider,
    ...incomingProvider,
  };

  SECRET_FIELDS.forEach((field) => {
    provider[field] = preserveSecret(
      incomingProvider?.[field],
      storedProvider?.[field]
    );
  });

  // El navegador nunca decide el estado de verificación ni la vinculación de
  // rangos. Estos metadatos siempre salen del documento persistido.
  [
    'lastConnectionStatus',
    'lastConnectionMessage',
    'lastConnectionAt',
    'lastConnectionEnvironment',
    'lastConnectionFingerprint',
    'lastConnectionCompany',
    'numberingRangesEnvironment',
    'numberingRangesFingerprint',
    'numberingRangesSyncedAt',
  ].forEach((field) => {
    provider[field] = storedProvider?.[field];
  });

  return {
    ...storedBilling,
    ...incoming,
    dian: {
      ...(storedBilling?.dian || {}),
      ...(incoming?.dian || {}),
    },
    dianResolution: {
      ...(storedBilling?.dianResolution || {}),
      ...(incoming?.dianResolution || {}),
    },
    electronicProvider: provider,
  };
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function authenticateFactus(runtime) {
  const body = new URLSearchParams();
  body.append('grant_type', 'password');
  body.append('client_id', runtime.clientId);
  body.append('client_secret', runtime.clientSecret);
  body.append('username', runtime.username);
  body.append('password', runtime.password);

  try {
    const { response, data } = await fetchJsonWithTimeout(
      `${runtime.apiUrl}/oauth/token`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      }
    );

    if (!response.ok || !data?.access_token) {
      throw new BillingConfigurationError(
        'Factus rechazó las credenciales al consultar los rangos de numeración.',
        'FACTUS_NUMBERING_RANGE_AUTH_REJECTED',
        422
      );
    }

    return {
      accessToken: data.access_token,
      tokenType: data.token_type || 'Bearer',
    };
  } catch (error) {
    if (error instanceof BillingConfigurationError) throw error;
    if (error?.name === 'AbortError') {
      throw new BillingConfigurationError(
        'La autenticación para consultar los rangos superó el tiempo de espera.',
        'FACTUS_NUMBERING_RANGE_AUTH_TIMEOUT',
        504
      );
    }
    throw new BillingConfigurationError(
      'No fue posible autenticar con Factus para consultar los rangos.',
      'FACTUS_NUMBERING_RANGE_AUTH_ERROR',
      502
    );
  }
}

async function fetchRangesByDocument(runtime, token, documentCode) {
  const url =
    `${runtime.apiUrl}/v2/numbering-ranges` +
    `?filter[document]=${encodeURIComponent(documentCode)}&filter[is_active]=1`;

  try {
    const { response, data } = await fetchJsonWithTimeout(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `${token.tokenType} ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new BillingConfigurationError(
        `Factus no permitió consultar los rangos del documento ${documentCode}.`,
        'FACTUS_NUMBERING_RANGE_LOOKUP_FAILED',
        502
      );
    }

    return extractRangeList(data)
      .map((range) => normalizeFactusRange(range, documentCode))
      .filter((range) => range.id > 0 && range.document === documentCode);
  } catch (error) {
    if (error instanceof BillingConfigurationError) throw error;
    if (error?.name === 'AbortError') {
      throw new BillingConfigurationError(
        'La consulta de rangos en Factus superó el tiempo de espera.',
        'FACTUS_NUMBERING_RANGE_TIMEOUT',
        504
      );
    }
    throw new BillingConfigurationError(
      'No fue posible consultar los rangos de numeración en Factus.',
      'FACTUS_NUMBERING_RANGE_CONNECTION_ERROR',
      502
    );
  }
}

function extractCreatedRange(payload = {}) {
  const candidates = [
    payload?.data?.data,
    payload?.data?.numbering_range,
    payload?.data?.numberingRange,
    payload?.data,
    payload?.numbering_range,
    payload?.numberingRange,
    payload,
  ];

  return (
    candidates.find(
      (candidate) =>
        candidate &&
        typeof candidate === 'object' &&
        !Array.isArray(candidate) &&
        positiveInteger(candidate?.id || candidate?.numbering_range_id) > 0
    ) || {}
  );
}

async function postCreditNoteRange(runtime, token, input) {
  try {
    const { response, data } = await fetchJsonWithTimeout(
      `${runtime.apiUrl}/v2/numbering-ranges`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `${token.tokenType} ${token.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      }
    );

    if (!response.ok) {
      throw new BillingConfigurationError(
        'Factus rechazó la creación del rango de nota crédito. Revisa el prefijo, el consecutivo y el estado de la cuenta.',
        'FACTUS_CREDIT_NOTE_RANGE_CREATE_REJECTED',
        response.status >= 400 && response.status < 500 ? 422 : 502
      );
    }

    const created = normalizeFactusRange(
      extractCreatedRange(data),
      FACTUS_RANGE_DOCUMENTS.creditNote
    );

    if (
      !(created.id > 0) ||
      created.document !== FACTUS_RANGE_DOCUMENTS.creditNote
    ) {
      throw new BillingConfigurationError(
        'Factus creó el rango, pero no devolvió una identificación verificable. Consulta nuevamente los rangos antes de repetir la acción.',
        'FACTUS_CREDIT_NOTE_RANGE_CREATE_UNCONFIRMED',
        502
      );
    }

    return created;
  } catch (error) {
    if (error instanceof BillingConfigurationError) throw error;
    if (error?.name === 'AbortError') {
      throw new BillingConfigurationError(
        'La creación del rango de nota crédito superó el tiempo de espera. Consulta los rangos antes de intentarlo nuevamente.',
        'FACTUS_CREDIT_NOTE_RANGE_CREATE_TIMEOUT',
        504
      );
    }
    throw new BillingConfigurationError(
      'No fue posible crear el rango de nota crédito en Factus.',
      'FACTUS_CREDIT_NOTE_RANGE_CREATE_ERROR',
      502
    );
  }
}

async function getCurrentContext(candidatePayload = {}) {
  const settings = await SiteSettings.findOne();
  if (!settings) {
    throw new BillingConfigurationError(
      'No existe una configuración de facturación para consultar rangos.',
      'BILLING_SETTINGS_NOT_FOUND',
      404
    );
  }

  const storedBilling = settings?.billing?.toObject
    ? settings.billing.toObject({ depopulate: true })
    : settings.billing || {};
  const billing = mergeCandidateBilling(storedBilling, candidatePayload);
  const runtime = buildRuntimeFactusConfig(billing);
  const fingerprint = buildFactusCredentialFingerprint(runtime);
  const provider = storedBilling?.electronicProvider || {};

  if (
    provider.lastConnectionStatus !== 'success' ||
    provider.lastConnectionEnvironment !== runtime.environment ||
    provider.lastConnectionFingerprint !== fingerprint
  ) {
    throw new BillingConfigurationError(
      'Debes verificar nuevamente la conexión real con Factus para este ambiente y estas credenciales antes de consultar rangos.',
      'FACTUS_CONNECTION_REQUIRED_FOR_NUMBERING_RANGES',
      409
    );
  }

  return {
    settings,
    storedBilling,
    billing,
    provider,
    runtime,
    fingerprint,
  };
}

async function invalidateNumberingRangesIfContextChanged(billingPayload = {}) {
  const settings = await SiteSettings.findOne();
  if (!settings?._id) return false;

  const storedBilling = settings?.billing?.toObject
    ? settings.billing.toObject({ depopulate: true })
    : settings.billing || {};
  let runtime;

  try {
    runtime = buildRuntimeFactusConfig(
      mergeCandidateBilling(storedBilling, billingPayload)
    );
  } catch {
    return false;
  }

  const provider = storedBilling.electronicProvider || {};
  const fingerprint = buildFactusCredentialFingerprint(runtime);
  const hasRanges =
    positiveInteger(provider.numberingRangeId) > 0 ||
    positiveInteger(provider.creditNoteNumberingRangeId) > 0;
  const sameContext =
    provider.numberingRangesEnvironment === runtime.environment &&
    provider.numberingRangesFingerprint === fingerprint;

  if (!hasRanges || sameContext) return false;

  await SiteSettings.findByIdAndUpdate(
    settings._id,
    {
      $set: {
        'billing.electronicProvider.numberingRangeId': 0,
        'billing.electronicProvider.creditNoteNumberingRangeId': 0,
        'billing.electronicProvider.numberingRangesEnvironment': '',
        'billing.electronicProvider.numberingRangesFingerprint': '',
        'billing.electronicProvider.numberingRangesSyncedAt': null,
        'billing.dianResolution.numberingRangeId': 0,
        'billing.dianResolution.creditNoteNumberingRangeId': 0,
      },
    },
    { runValidators: true, strict: false }
  );

  return true;
}

async function listFactusNumberingRanges(candidatePayload = {}) {
  const context = await getCurrentContext(candidatePayload);
  const token = await authenticateFactus(context.runtime);
  const [invoiceRanges, creditNoteRanges] = await Promise.all([
    fetchRangesByDocument(
      context.runtime,
      token,
      FACTUS_RANGE_DOCUMENTS.invoice
    ),
    fetchRangesByDocument(
      context.runtime,
      token,
      FACTUS_RANGE_DOCUMENTS.creditNote
    ),
  ]);

  return {
    environment: context.runtime.environment,
    syncedAt: new Date().toISOString(),
    selected: {
      invoiceRangeId: positiveInteger(context.provider.numberingRangeId) || null,
      creditNoteRangeId:
        positiveInteger(context.provider.creditNoteNumberingRangeId) || null,
    },
    invoiceRanges: invoiceRanges.map(publicRange),
    creditNoteRanges: creditNoteRanges.map(publicRange),
    eligibleInvoiceRanges: invoiceRanges
      .filter((range) => range.eligible)
      .map(publicRange),
    eligibleCreditNoteRanges: creditNoteRanges
      .filter((range) => range.eligible)
      .map(publicRange),
    _private: {
      context,
      invoiceRanges,
      creditNoteRanges,
    },
  };
}

async function createFactusCreditNoteNumberingRange(
  input = {},
  candidatePayload = {}
) {
  const context = await getCurrentContext(candidatePayload);
  const rangeInput = normalizeCreditNoteRangeInput(input);
  const lockKey = `${context.runtime.environment}:${context.fingerprint}`;

  if (
    context.runtime.environment === 'production' &&
    input?.confirmProduction !== true
  ) {
    throw new BillingConfigurationError(
      'Debes confirmar expresamente la creación del rango en Producción.',
      'FACTUS_CREDIT_NOTE_RANGE_PRODUCTION_CONFIRMATION_REQUIRED',
      409,
      ['confirmProduction']
    );
  }

  if (creditNoteRangeCreationLocks.has(lockKey)) {
    throw new BillingConfigurationError(
      'Ya se está creando un rango de nota crédito para esta cuenta. Espera la respuesta antes de intentarlo nuevamente.',
      'FACTUS_CREDIT_NOTE_RANGE_CREATE_IN_PROGRESS',
      409
    );
  }

  creditNoteRangeCreationLocks.add(lockKey);

  try {
    const token = await authenticateFactus(context.runtime);
    const currentCreditNoteRanges = await fetchRangesByDocument(
      context.runtime,
      token,
      FACTUS_RANGE_DOCUMENTS.creditNote
    );
    const existingEligible = currentCreditNoteRanges.find(
      (range) => range.eligible === true
    );

    if (existingEligible) {
      throw new BillingConfigurationError(
        'La cuenta ya tiene un rango de nota crédito vigente y disponible. Selecciónalo en lugar de crear otro.',
        'FACTUS_CREDIT_NOTE_RANGE_ALREADY_AVAILABLE',
        409,
        [String(existingEligible.id)]
      );
    }

    const created = await postCreditNoteRange(
      context.runtime,
      token,
      rangeInput
    );
    const [invoiceRanges, creditNoteRanges] = await Promise.all([
      fetchRangesByDocument(
        context.runtime,
        token,
        FACTUS_RANGE_DOCUMENTS.invoice
      ),
      fetchRangesByDocument(
        context.runtime,
        token,
        FACTUS_RANGE_DOCUMENTS.creditNote
      ),
    ]);
    const verifiedCreated =
      creditNoteRanges.find(
        (range) => range.id === created.id && range.eligible === true
      ) ||
      creditNoteRanges.find(
        (range) =>
          range.prefix === rangeInput.prefix &&
          range.eligible === true
      );

    if (!verifiedCreated) {
      throw new BillingConfigurationError(
        'Factus recibió la creación, pero el nuevo rango todavía no aparece activo. Consulta nuevamente los rangos antes de repetir la acción.',
        'FACTUS_CREDIT_NOTE_RANGE_NOT_ACTIVE_AFTER_CREATE',
        409
      );
    }

    return {
      environment: context.runtime.environment,
      syncedAt: new Date().toISOString(),
      selected: {
        invoiceRangeId:
          positiveInteger(context.provider.numberingRangeId) || null,
        creditNoteRangeId:
          positiveInteger(context.provider.creditNoteNumberingRangeId) || null,
      },
      invoiceRanges: invoiceRanges.map(publicRange),
      creditNoteRanges: creditNoteRanges.map(publicRange),
      eligibleInvoiceRanges: invoiceRanges
        .filter((range) => range.eligible)
        .map(publicRange),
      eligibleCreditNoteRanges: creditNoteRanges
        .filter((range) => range.eligible)
        .map(publicRange),
      createdCreditNoteRange: publicRange(verifiedCreated),
    };
  } finally {
    creditNoteRangeCreationLocks.delete(lockKey);
  }
}

function requireEligibleRange(ranges, id, label) {
  const selectedId = positiveInteger(id);
  const selected = ranges.find(
    (range) => range.id === selectedId && range.eligible === true
  );

  if (!selected) {
    throw new BillingConfigurationError(
      `El rango seleccionado para ${label} no existe, no está activo, está vencido o agotado.`,
      'FACTUS_NUMBERING_RANGE_SELECTION_INVALID',
      422,
      [label]
    );
  }

  return selected;
}

async function saveFactusNumberingRangeSelection(
  input = {},
  adminUser = 'admin',
  candidatePayload = {}
) {
  const listed = await listFactusNumberingRanges(candidatePayload);
  const invoice = requireEligibleRange(
    listed._private.invoiceRanges,
    input.invoiceRangeId,
    'facturas'
  );
  const creditNote = requireEligibleRange(
    listed._private.creditNoteRanges,
    input.creditNoteRangeId,
    'notas crédito'
  );
  const { settings, runtime, fingerprint } = listed._private.context;
  const now = new Date();
  const invoiceTechnicalKey = invoice.technicalKey
    ? encryptBillingSecret(invoice.technicalKey)
    : '';

  const updated = await SiteSettings.findByIdAndUpdate(
    settings._id,
    {
      $set: {
        'billing.electronicProvider.numberingRangeId': invoice.id,
        'billing.electronicProvider.creditNoteNumberingRangeId': creditNote.id,
        'billing.electronicProvider.numberingRangesEnvironment': runtime.environment,
        'billing.electronicProvider.numberingRangesFingerprint': fingerprint,
        'billing.electronicProvider.numberingRangesSyncedAt': now,
        'billing.dianResolution.numberingRangeId': invoice.id,
        'billing.dianResolution.creditNoteNumberingRangeId': creditNote.id,
        'billing.dianResolution.resolutionNumber': invoice.resolutionNumber,
        'billing.dianResolution.prefix': invoice.prefix,
        'billing.dianResolution.rangeFrom': invoice.from,
        'billing.dianResolution.rangeTo': invoice.to,
        'billing.dianResolution.currentNumber': invoice.current,
        'billing.dianResolution.resolutionDate': invoice.startDate,
        'billing.dianResolution.expirationDate': invoice.endDate,
        'billing.dianResolution.documentType': 'factura_electronica',
        'billing.dianResolution.environment':
          runtime.environment === 'production' ? '1' : '2',
        ...(invoiceTechnicalKey
          ? { 'billing.dianResolution.technicalKey': invoiceTechnicalKey }
          : {}),
        'billing.dian.lastSyncStatus': 'success',
        'billing.dian.lastSyncMessage':
          `Rangos oficiales sincronizados: factura ${invoice.id}, nota crédito ${creditNote.id}.`,
        'billing.dian.lastSyncAt': now,
        updatedBy: cleanText(adminUser || 'admin', 180) || 'admin',
      },
    },
    { new: true, runValidators: true, strict: false }
  );

  if (!updated) {
    throw new BillingConfigurationError(
      'No fue posible guardar los rangos seleccionados.',
      'FACTUS_NUMBERING_RANGE_SAVE_FAILED',
      500
    );
  }

  return {
    environment: runtime.environment,
    syncedAt: now.toISOString(),
    invoiceRange: publicRange(invoice),
    creditNoteRange: publicRange(creditNote),
    dianResolution: updated.billing?.dianResolution?.toObject
      ? updated.billing.dianResolution.toObject({ depopulate: true })
      : updated.billing?.dianResolution || {},
  };
}

module.exports = {
  FACTUS_RANGE_DOCUMENTS,
  createFactusCreditNoteNumberingRange,
  extractRangeList,
  invalidateNumberingRangesIfContextChanged,
  isoDate,
  listFactusNumberingRanges,
  mergeCandidateBilling,
  normalizeCreditNoteRangeInput,
  normalizeFactusRange,
  publicRange,
  saveFactusNumberingRangeSelection,
};
