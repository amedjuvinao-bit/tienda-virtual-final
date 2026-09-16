'use strict';

const SiteSettings = require('../models/SiteSettings');

const PAYMENT_PROVIDERS = Object.freeze({
  wompi: Object.freeze({
    label: 'Wompi',
    required: Object.freeze(['publicKey', 'privateKey', 'integrityKey']),
    secret: Object.freeze(['privateKey', 'integrityKey', 'webhookSecret']),
  }),
  payu: Object.freeze({
    label: 'PayU',
    required: Object.freeze(['merchantId', 'accountId', 'apiLogin', 'apiKey']),
    secret: Object.freeze(['apiLogin', 'apiKey', 'signatureSecret']),
  }),
  manual: Object.freeze({
    label: 'Pago manual',
    required: Object.freeze(['accountHolder', 'bankName', 'accountNumber', 'paymentInstructions']),
    secret: Object.freeze(['accountNumber']),
  }),
});

const CREDENTIAL_FIELDS = Object.freeze({
  wompi: Object.freeze(['publicKey', 'privateKey', 'integrityKey', 'webhookSecret']),
  payu: Object.freeze([
    'merchantId',
    'accountId',
    'apiLogin',
    'apiKey',
    'signatureAlgorithm',
    'signatureSecret',
  ]),
  manual: Object.freeze([
    'accountHolder',
    'bankName',
    'accountType',
    'accountNumber',
    'paymentInstructions',
  ]),
});

class PaymentSettingsError extends Error {
  constructor(message, code, status = 400, details = []) {
    super(message);
    this.name = 'PaymentSettingsError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function cleanText(value, maxLength = 300) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function cleanMultiline(value, maxLength = 1000) {
  return String(value ?? '').trim().replace(/\r\n/g, '\n').slice(0, maxLength);
}

function revisionNumber(value) {
  const revision = Number(value);
  return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

function normalizeCredentials(raw = {}) {
  const credentials = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const normalized = {};

  for (const [provider, fields] of Object.entries(CREDENTIAL_FIELDS)) {
    const source = credentials[provider] && typeof credentials[provider] === 'object'
      ? credentials[provider]
      : {};
    normalized[provider] = Object.fromEntries(
      fields.map((field) => [
        field,
        field === 'paymentInstructions'
          ? cleanMultiline(source[field], 1000)
          : cleanText(source[field], 240),
      ])
    );
  }

  return normalized;
}

function normalizePaymentSettings(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const provider = cleanText(source.provider, 30).toLowerCase();
  const currency = cleanText(source.currency || 'COP', 3).toUpperCase();

  return {
    active: source.active === true,
    provider: Object.prototype.hasOwnProperty.call(PAYMENT_PROVIDERS, provider)
      ? provider
      : '',
    mode: cleanText(source.mode, 20).toLowerCase() === 'production'
      ? 'production'
      : 'sandbox',
    currency: ['COP', 'USD', 'EUR'].includes(currency) ? currency : 'COP',
    checkoutLabel: cleanText(source.checkoutLabel, 180),
    successMessage: cleanMultiline(source.successMessage, 500),
    enableWebhook: source.enableWebhook === true && provider !== 'manual',
    credentials: normalizeCredentials(source.credentials),
  };
}

function mergeCredentials(current, incoming) {
  const existing = normalizeCredentials(current);
  const next = normalizeCredentials(incoming);

  for (const [provider, meta] of Object.entries(PAYMENT_PROVIDERS)) {
    for (const field of meta.secret) {
      if (!next[provider][field]) next[provider][field] = existing[provider][field];
    }
  }
  next.payu.signatureAlgorithm = cleanText(
    incoming?.payu?.signatureAlgorithm || existing.payu.signatureAlgorithm || 'MD5',
    40
  ).toUpperCase();

  return next;
}

function missingFields(config, provider = config.provider) {
  const meta = PAYMENT_PROVIDERS[provider];
  if (!meta) return [];
  const required = [...meta.required];
  if (provider === 'wompi' && config.enableWebhook) required.push('webhookSecret');
  return required.filter((field) => !cleanText(config.credentials?.[provider]?.[field], 1000));
}

function buildReadiness(config) {
  return Object.fromEntries(
    Object.keys(PAYMENT_PROVIDERS).map((provider) => {
      const missing = missingFields({ ...config, provider }, provider);
      const required = [
        ...PAYMENT_PROVIDERS[provider].required,
        ...(provider === 'wompi' && config.enableWebhook ? ['webhookSecret'] : []),
      ];
      return [provider, {
        ready: missing.length === 0,
        missing,
        completed: required.length - missing.length,
        required: required.length,
      }];
    })
  );
}

function validatePaymentSettings(input = {}, current = {}) {
  const normalized = normalizePaymentSettings(input);
  normalized.credentials = mergeCredentials(current.credentials, input.credentials);
  const details = [];

  if (normalized.active && !normalized.provider) {
    details.push({ field: 'provider', message: 'Selecciona un proveedor compatible con el checkout.' });
  }
  if (normalized.active && normalized.provider) {
    for (const field of missingFields(normalized)) {
      details.push({
        field: `credentials.${normalized.provider}.${field}`,
        message: 'Completa este dato antes de activar el proveedor.',
      });
    }
  }
  if (normalized.provider === 'wompi' && normalized.currency !== 'COP') {
    details.push({
      field: 'currency',
      message: 'Wompi Colombia debe configurarse en pesos colombianos (COP).',
    });
  }
  if (normalized.active && normalized.mode === 'production' && input.confirmProduction !== true) {
    details.push({
      field: 'confirmProduction',
      message: 'Confirma expresamente que usarás credenciales y cobros reales.',
    });
  }

  if (details.length) {
    throw new PaymentSettingsError(
      'Revisa la configuración de pagos antes de guardarla.',
      'INVALID_PAYMENT_SETTINGS',
      422,
      details
    );
  }

  return normalized;
}

function credentialStatus(config) {
  return Object.fromEntries(
    Object.entries(PAYMENT_PROVIDERS).map(([provider, meta]) => [
      provider,
      Object.fromEntries(
        meta.secret.map((field) => [field, Boolean(config.credentials?.[provider]?.[field])])
      ),
    ])
  );
}

function redactPaymentSettings(config) {
  const safe = normalizePaymentSettings(config);
  for (const [provider, meta] of Object.entries(PAYMENT_PROVIDERS)) {
    for (const field of meta.secret) safe.credentials[provider][field] = '';
  }
  return safe;
}

function buildPaymentSettingsResponse(settings) {
  const config = normalizePaymentSettings(settings?.theme?.global?.payments || {});
  return {
    ok: true,
    settings: redactPaymentSettings(config),
    credentialStatus: credentialStatus(config),
    readiness: buildReadiness(config),
    revision: revisionNumber(settings?.paymentSettingsRevision),
    updatedAt: settings?.updatedAt || null,
    updatedBy: cleanText(settings?.updatedBy, 180),
  };
}

async function ensurePaymentSettingsDocument() {
  let settings = await SiteSettings.findOne()
    .select('theme.global.payments paymentSettingsRevision updatedAt updatedBy')
    .lean();

  if (!settings) {
    settings = await SiteSettings.create({
      theme: { global: { payments: normalizePaymentSettings({}) } },
      paymentSettingsRevision: 0,
      updatedBy: 'system',
    });
    return settings.toObject ? settings.toObject() : settings;
  }
  return settings;
}

async function getPaymentSettings() {
  return buildPaymentSettingsResponse(await ensurePaymentSettingsDocument());
}

async function updatePaymentSettings(input = {}, options = {}) {
  const rawRevision = input.revision;
  const expectedRevision = rawRevision === '' || rawRevision === null || rawRevision === undefined
    ? Number.NaN
    : Number(rawRevision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new PaymentSettingsError(
      'Recarga la configuración de pagos antes de guardar.',
      'PAYMENT_SETTINGS_REVISION_REQUIRED',
      409
    );
  }

  const current = await ensurePaymentSettingsDocument();
  const currentRevision = revisionNumber(current.paymentSettingsRevision);
  if (expectedRevision !== currentRevision) {
    throw new PaymentSettingsError(
      'Otra persona actualizó Pagos. Recarga la versión más reciente.',
      'PAYMENT_SETTINGS_CONFLICT',
      409,
      [{ currentRevision }]
    );
  }

  const existingConfig = normalizePaymentSettings(current?.theme?.global?.payments || {});
  const settings = validatePaymentSettings(input.settings, existingConfig);
  const revisionFilter = current.paymentSettingsRevision === undefined
    ? { $or: [{ paymentSettingsRevision: { $exists: false } }, { paymentSettingsRevision: 0 }] }
    : { paymentSettingsRevision: currentRevision };
  const updated = await SiteSettings.findOneAndUpdate(
    { _id: current._id, ...revisionFilter },
    {
      $set: {
        'theme.global.payments': settings,
        updatedBy: cleanText(options.actor, 180) || 'admin',
      },
      $inc: { paymentSettingsRevision: 1 },
    },
    { new: true, runValidators: false, strict: false }
  )
    .select('theme.global.payments paymentSettingsRevision updatedAt updatedBy')
    .lean();

  if (!updated) {
    const latest = await SiteSettings.findOne().select('paymentSettingsRevision').lean();
    throw new PaymentSettingsError(
      'Otra persona actualizó Pagos. Recarga para continuar.',
      'PAYMENT_SETTINGS_CONFLICT',
      409,
      [{ currentRevision: revisionNumber(latest?.paymentSettingsRevision) }]
    );
  }

  return buildPaymentSettingsResponse(updated);
}

module.exports = {
  CREDENTIAL_FIELDS,
  PAYMENT_PROVIDERS,
  PaymentSettingsError,
  buildPaymentSettingsResponse,
  buildReadiness,
  getPaymentSettings,
  mergeCredentials,
  missingFields,
  normalizePaymentSettings,
  updatePaymentSettings,
  validatePaymentSettings,
};
