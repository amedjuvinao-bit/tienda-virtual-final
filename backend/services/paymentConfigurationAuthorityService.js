'use strict';

const SiteSettings = require('../models/SiteSettings');

const SUPPORTED_ORDER_PAYMENT_PROVIDERS = Object.freeze([
  'wompi',
  'payu',
  'manual',
]);

const PROVIDER_LABELS = Object.freeze({
  wompi: 'Wompi',
  payu: 'PayU',
  manual: 'Pago manual',
});

function cleanText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function normalizePaymentProvider(value) {
  return cleanText(value, 40).toLowerCase();
}

function normalizePaymentsConfig(raw, env = process.env) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  const credentials =
    cfg.credentials && typeof cfg.credentials === 'object'
      ? cfg.credentials
      : {};
  const wompi =
    credentials.wompi && typeof credentials.wompi === 'object'
      ? credentials.wompi
      : {};
  const payu =
    credentials.payu && typeof credentials.payu === 'object'
      ? credentials.payu
      : {};

  return {
    active: cfg.active === true,
    provider: normalizePaymentProvider(cfg.provider),
    mode:
      cleanText(cfg.mode, 20).toLowerCase() === 'production'
        ? 'production'
        : 'sandbox',
    currency: cleanText(cfg.currency || 'COP', 12).toUpperCase() || 'COP',
    checkoutLabel: cleanText(cfg.checkoutLabel, 180),
    successMessage: cleanText(cfg.successMessage, 300),
    enableWebhook: cfg.enableWebhook === true,
    credentials: {
      wompi: {
        publicKey: cleanText(wompi.publicKey, 200),
        privateKey: cleanText(wompi.privateKey, 200),
        integrityKey: cleanText(wompi.integrityKey, 200),
        webhookSecret: cleanText(wompi.webhookSecret, 200),
      },
      payu: {
        merchantId: cleanText(payu.merchantId, 100),
        accountId: cleanText(payu.accountId, 100),
        apiLogin: cleanText(payu.apiLogin, 150),
        apiKey: cleanText(payu.apiKey, 150),
        signatureAlgorithm:
          cleanText(payu.signatureAlgorithm || 'MD5', 40).toUpperCase() || 'MD5',
        signatureSecret: cleanText(
          payu.signatureSecret ||
            payu.webhookSecret ||
            env.PAYU_SIGNATURE_SECRET ||
            '',
          200
        ),
      },
    },
  };
}

function createPaymentConfigurationError(code, message, statusCode = 409) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.publicMessage = message;
  return error;
}

function missingProviderConfiguration(config, provider) {
  if (provider === 'wompi') {
    const wompi = config.credentials.wompi;
    const missing = ['publicKey', 'privateKey', 'integrityKey'].filter(
      (field) => !wompi[field]
    );
    if (config.enableWebhook && !wompi.webhookSecret) missing.push('webhookSecret');
    return missing;
  }

  if (provider === 'payu') {
    const payu = config.credentials.payu;
    return ['merchantId', 'accountId', 'apiLogin', 'apiKey'].filter(
      (field) => !payu[field]
    );
  }

  return [];
}

function buildOrderPaymentSnapshot(config, provider = config?.provider) {
  const safeProvider = normalizePaymentProvider(provider);
  const providerLabel = PROVIDER_LABELS[safeProvider] || '';

  return Object.freeze({
    active: true,
    provider: safeProvider,
    providerLabel,
    mode: config.mode,
    currency: config.currency,
    checkoutLabel: config.checkoutLabel || providerLabel,
    enableWebhook: config.enableWebhook === true,
    status: safeProvider === 'manual' ? 'pending_manual' : 'pending_gateway',
  });
}

function assertPaymentSelection(config, requestedProvider) {
  const provider = normalizePaymentProvider(requestedProvider);

  if (!SUPPORTED_ORDER_PAYMENT_PROVIDERS.includes(provider)) {
    throw createPaymentConfigurationError(
      'PAYMENT_PROVIDER_UNSUPPORTED',
      'El método de pago seleccionado no está disponible.',
      422
    );
  }
  if (config.active !== true) {
    throw createPaymentConfigurationError(
      'PAYMENTS_DISABLED',
      'Los pagos están desactivados temporalmente.'
    );
  }
  if (config.provider !== provider) {
    throw createPaymentConfigurationError(
      'PAYMENT_PROVIDER_NOT_ACTIVE',
      'El método de pago seleccionado no está activo.'
    );
  }

  const missing = missingProviderConfiguration(config, provider);
  if (missing.length > 0) {
    throw createPaymentConfigurationError(
      'PAYMENT_CONFIGURATION_INVALID',
      'El método de pago seleccionado no tiene una configuración válida.',
      422
    );
  }

  return provider;
}

async function executeLean(query) {
  let current = query;
  if (current && typeof current.lean === 'function') current = current.lean();
  if (current && typeof current.exec === 'function') return current.exec();
  return current;
}

function createPaymentConfigurationAuthority({
  SiteSettingsModel = SiteSettings,
  env = process.env,
} = {}) {
  async function getActivePaymentsConfig({ session = null } = {}) {
    let query = SiteSettingsModel.findOne();
    if (session && query && typeof query.session === 'function') {
      query = query.session(session);
    }
    const settings = await executeLean(query);
    return normalizePaymentsConfig(
      settings?.theme?.global?.payments || {},
      env
    );
  }

  async function resolveOrderPaymentSelection(requestedProvider, options = {}) {
    const config = await getActivePaymentsConfig(options);
    const provider = assertPaymentSelection(config, requestedProvider);
    return {
      config,
      snapshot: buildOrderPaymentSnapshot(config, provider),
    };
  }

  return {
    getActivePaymentsConfig,
    resolveOrderPaymentSelection,
  };
}

const defaultAuthority = createPaymentConfigurationAuthority();

module.exports = {
  PROVIDER_LABELS,
  SUPPORTED_ORDER_PAYMENT_PROVIDERS,
  assertPaymentSelection,
  buildOrderPaymentSnapshot,
  createPaymentConfigurationAuthority,
  getActivePaymentsConfig: defaultAuthority.getActivePaymentsConfig,
  normalizePaymentProvider,
  normalizePaymentsConfig,
  resolveOrderPaymentSelection: defaultAuthority.resolveOrderPaymentSelection,
};
