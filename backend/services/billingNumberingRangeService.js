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

function cleanText(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function toInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  return fallback;
}

function isoDate(value) {
  const normalized = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
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

function rangeDocumentCode(range = {}, fallback = '') {
  const document = range?.document;
  return cleanText(
    document?.code ||
      document?.id ||
      range?.document_code ||
      range?.document_id ||
      (typeof document === 'string' || typeof document === 'number' ? document : '') ||
      fallback,
    20
  );
}

function rangeDocumentName(range = {}, fallback = '') {
  const document = range?.document;
  return cleanText(
    document?.name || range?.document_name || range?.documentName || fallback,
    160
  );
}

function normalizeFactusRange(range = {}, expectedDocument = '') {
  const id = toInteger(range?.id || range?.numbering_range_id, 0);
  const from = toInteger(range?.from ?? range?.range_from, 0);
  const to = toInteger(range?.to ?? range?.range_to, 0);
  const current = toInteger(range?.current ?? range?.current_number, from);
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
    resolutionNumber: cleanText(range?.resolution_number, 120),
    startDate,
    endDate,
    active,
    expired: expiredByFlag || expiredByDate,
    exhausted,
    eligible,
    technicalKey: cleanText(range?.technical_key, 1000),
  };
}

function publicRange(range = {}) {
  const { technicalKey, ...safe } = range;
  void technicalKey;
  return safe;
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

async function getCurrentContext() {
  const settings = await SiteSettings.findOne();
  if (!settings) {
    throw new BillingConfigurationError(
      'No existe una configuración de facturación para consultar rangos.',
      'BILLING_SETTINGS_NOT_FOUND',
      404
    );
  }

  const billing = settings?.billing?.toObject
    ? settings.billing.toObject({ depopulate: true })
    : settings.billing || {};
  const runtime = buildRuntimeFactusConfig(billing);
  const fingerprint = buildFactusCredentialFingerprint(runtime);
  const provider = billing?.electronicProvider || {};

  if (
    provider.lastConnectionStatus !== 'success' ||
    provider.lastConnectionEnvironment !== runtime.environment ||
    provider.lastConnectionFingerprint !== fingerprint
  ) {
    throw new BillingConfigurationError(
      'Debes verificar nuevamente la conexión real con Factus antes de consultar rangos.',
      'FACTUS_CONNECTION_REQUIRED_FOR_NUMBERING_RANGES',
      409
    );
  }

  return { settings, billing, provider, runtime, fingerprint };
}

async function invalidateNumberingRangesIfContextChanged(billingPayload = {}) {
  const settings = await SiteSettings.findOne();
  if (!settings?._id) return false;

  const storedBilling = settings?.billing?.toObject
    ? settings.billing.toObject({ depopulate: true })
    : settings.billing || {};
  let runtime;

  try {
    const candidate = {
      ...storedBilling,
      ...(billingPayload?.billing || {}),
      dian: {
        ...(storedBilling.dian || {}),
        ...(billingPayload?.billing?.dian || {}),
      },
      electronicProvider: {
        ...(storedBilling.electronicProvider || {}),
        ...(billingPayload?.billing?.electronicProvider || {}),
      },
    };
    runtime = buildRuntimeFactusConfig(candidate);
  } catch {
    return false;
  }

  const provider = storedBilling.electronicProvider || {};
  const fingerprint = buildFactusCredentialFingerprint(runtime);
  const hasRanges =
    toInteger(provider.numberingRangeId, 0) > 0 ||
    toInteger(provider.creditNoteNumberingRangeId, 0) > 0;
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

async function listFactusNumberingRanges() {
  const context = await getCurrentContext();
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
      invoiceRangeId: toInteger(context.provider.numberingRangeId, 0) || null,
      creditNoteRangeId:
        toInteger(context.provider.creditNoteNumberingRangeId, 0) || null,
    },
    invoiceRanges: invoiceRanges.map(publicRange),
    creditNoteRanges: creditNoteRanges.map(publicRange),
    eligibleInvoiceRanges: invoiceRanges.filter((range) => range.eligible).map(publicRange),
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

function requireEligibleRange(ranges, id, label) {
  const selectedId = toInteger(id, 0);
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

async function saveFactusNumberingRangeSelection(input = {}, adminUser = 'admin') {
  const listed = await listFactusNumberingRanges();
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
  extractRangeList,
  invalidateNumberingRangesIfContextChanged,
  listFactusNumberingRanges,
  normalizeFactusRange,
  publicRange,
  saveFactusNumberingRangeSelection,
};
