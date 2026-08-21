'use strict';

const { env } = require('../config/env');
const ShippingSettings = require('../models/ShippingSettings');
const {
  decryptShippingSecret,
  encryptShippingSecret,
  encryptionConfigured,
  secretHint,
} = require('../lib/shipping/shippingConfigurationSecurity');
const { createEnviaProvider } = require('./enviaShippingProvider');

class ShippingSettingsError extends Error {
  constructor(message, code, statusCode = 422, details = {}) {
    super(message);
    this.name = 'ShippingSettingsError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function clean(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function actorId(actor) {
  const value = String(actor?._id || actor?.id || actor || '').trim();
  return value || null;
}

function normalizeMode(value) {
  const mode = clean(value, 30).toLowerCase();
  if (mode === 'production') return 'production';
  if (!mode || mode === 'sandbox') return 'sandbox';
  throw new ShippingSettingsError(
    'El ambiente de Envia debe ser Sandbox o Producción.',
    'SHIPPING_MODE_INVALID',
    400
  );
}

function normalizeDutiesPaymentEntity(value) {
  const normalized = clean(value || 'recipient', 40).toLowerCase();
  if (['recipient', 'sender', 'envia_guaranteed'].includes(normalized)) {
    return normalized;
  }
  throw new ShippingSettingsError(
    'La política de impuestos internacionales no es válida.',
    'SHIPPING_DUTIES_POLICY_INVALID',
    400
  );
}

function publicWebhookUrl() {
  const base = clean(env.backendUrl, 500).replace(/\/+$/, '');
  return base ? `${base}/api/shipping/webhooks/envia` : '';
}

function webhookDashboardUrl(mode = 'sandbox') {
  return mode === 'production'
    ? 'https://shipping.envia.com/settings/developers'
    : 'https://shipping-test.envia.com/settings/developers';
}

function publicHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    const privateIpv4 = ipv4 && (
      Number(ipv4[1]) === 0 ||
      Number(ipv4[1]) === 10 ||
      Number(ipv4[1]) === 127 ||
      (Number(ipv4[1]) === 169 && Number(ipv4[2]) === 254) ||
      (Number(ipv4[1]) === 172 && Number(ipv4[2]) >= 16 && Number(ipv4[2]) <= 31) ||
      (Number(ipv4[1]) === 192 && Number(ipv4[2]) === 168)
    );
    const privateIpv6 =
      host === '::1' ||
      /^f[cd]/i.test(host) ||
      /^fe[89ab]/i.test(host);
    return (
      parsed.protocol === 'https:' &&
      !privateIpv4 &&
      !privateIpv6 &&
      !['localhost', '0.0.0.0'].includes(host) &&
      !host.endsWith('.localhost') &&
      !host.endsWith('.local') &&
      !host.endsWith('.internal')
    );
  } catch {
    return false;
  }
}

async function getSettings(SettingsModel = ShippingSettings) {
  return SettingsModel.getSingleton();
}

function decryptOptional(value) {
  return value ? decryptShippingSecret(value) : '';
}

async function getRuntimeShippingConfiguration(
  { SettingsModel = ShippingSettings } = {}
) {
  const settings = await getSettings(SettingsModel);
  const databaseToken = decryptOptional(settings.enviaTokenEncrypted);
  const databaseSandboxWebhookToken = decryptOptional(
    settings.sandboxWebhookTokenEncrypted
  );
  const databaseWebhookSecret = decryptOptional(
    settings.webhookSecretEncrypted
  );
  const token = databaseToken || env.shipping.envia.token;
  const sandboxWebhookToken =
    databaseSandboxWebhookToken || env.shipping.envia.sandboxWebhookToken;
  const webhookSecret =
    databaseWebhookSecret || env.shipping.envia.webhookSecret;
  const managedFromPanel = settings.managedFromPanel === true;
  return {
    settings,
    defaultProvider: managedFromPanel
      ? settings.defaultProvider || 'manual'
      : env.shipping.defaultProvider || 'manual',
    credentialSource: databaseToken
      ? 'database'
      : env.shipping.envia.token
        ? 'environment'
        : 'none',
    sandboxWebhookTokenSource: databaseSandboxWebhookToken
      ? 'database'
      : env.shipping.envia.sandboxWebhookToken
        ? 'environment'
        : 'none',
    webhookSecretSource: databaseWebhookSecret
      ? 'database'
      : env.shipping.envia.webhookSecret
        ? 'environment'
        : 'none',
    envia: {
      mode: managedFromPanel
        ? settings.enviaMode || 'sandbox'
        : env.shipping.envia.mode || 'sandbox',
      token,
      sandboxWebhookToken,
      webhookSecret,
      timeoutMs: env.shipping.envia.timeoutMs,
      internationalDutiesPaymentEntity:
        settings.internationalDutiesPaymentEntity || 'recipient',
    },
  };
}

function readiness(settings, runtime) {
  const webhookUrl = publicWebhookUrl();
  const production = runtime.envia.mode === 'production';
  const tested = Boolean(
    settings.lastTestStatus === 'success' &&
    settings.lastTestMode === runtime.envia.mode &&
    Number(settings.lastTestCredentialRevision || 0) ===
      Number(settings.credentialRevision || 0)
  );
  const webhookRegistered = Boolean(
    settings.providerWebhookId &&
    settings.providerWebhookMode === runtime.envia.mode &&
    settings.providerWebhookUrl === webhookUrl
  );
  const hasToken = Boolean(runtime.envia.token);
  const hasSandboxWebhookToken = Boolean(runtime.envia.sandboxWebhookToken);
  const hasWebhookSecret = Boolean(runtime.envia.webhookSecret);
  const webhookUrlReady = publicHttpsUrl(webhookUrl);
  const webhookCredentialReady = production
    ? hasWebhookSecret
    : hasSandboxWebhookToken;
  return {
    hasToken,
    hasSandboxWebhookToken,
    hasWebhookSecret,
    tested,
    webhookRegistered,
    webhookUrlReady,
    canTest: hasToken,
    canConfirmWebhook:
      hasToken && tested && webhookUrlReady && webhookCredentialReady,
    // Alias temporal para clientes anteriores. Envia administra la URL desde su portal.
    canRegisterWebhook:
      hasToken && tested && webhookUrlReady && webhookCredentialReady,
    canActivateSandbox:
      hasToken &&
      tested &&
      hasSandboxWebhookToken &&
      webhookRegistered &&
      webhookUrlReady,
    canActivateProduction:
      hasToken &&
      tested &&
      hasWebhookSecret &&
      webhookRegistered &&
      webhookUrlReady,
  };
}

async function getShippingSettingsView(dependencies = {}) {
  const runtime = await getRuntimeShippingConfiguration(dependencies);
  const safe = runtime.settings.toSafeObject();
  safe.defaultProvider = runtime.defaultProvider;
  safe.enviaMode = runtime.envia.mode;
  const hasDatabaseToken = Boolean(runtime.settings.enviaTokenEncrypted);
  const hasDatabaseSandboxWebhookToken = Boolean(
    runtime.settings.sandboxWebhookTokenEncrypted
  );
  const hasDatabaseWebhookSecret = Boolean(
    runtime.settings.webhookSecretEncrypted
  );
  safe.hasEnviaToken = Boolean(runtime.envia.token);
  safe.hasSandboxWebhookToken = Boolean(runtime.envia.sandboxWebhookToken);
  safe.hasWebhookSecret = Boolean(runtime.envia.webhookSecret);
  safe.enviaTokenHint = hasDatabaseToken
    ? runtime.settings.enviaTokenHint
    : runtime.envia.token
      ? 'Configurado en el despliegue'
      : '';
  safe.sandboxWebhookTokenHint = hasDatabaseSandboxWebhookToken
    ? runtime.settings.sandboxWebhookTokenHint
    : runtime.envia.sandboxWebhookToken
      ? 'Configurado en el despliegue'
      : '';
  safe.webhookSecretHint = hasDatabaseWebhookSecret
    ? runtime.settings.webhookSecretHint
    : runtime.envia.webhookSecret
      ? 'Configurado en el despliegue'
      : '';
  return {
    settings: safe,
    meta: {
      encryptionConfigured: encryptionConfigured(),
      encryptionKeySource: env.integrationsEncryptionKeySource || '',
      credentialSource: runtime.credentialSource,
      sandboxWebhookTokenSource: runtime.sandboxWebhookTokenSource,
      webhookSecretSource: runtime.webhookSecretSource,
      webhookUrl: publicWebhookUrl(),
      webhookDashboardUrl: webhookDashboardUrl(runtime.envia.mode),
      webhookManagement: 'dashboard',
      readiness: readiness(runtime.settings, runtime),
      providers: [
        {
          key: 'manual',
          name: 'Operación manual',
          description: 'Transportadora, guía y evidencias registradas por el operador.',
        },
        {
          key: 'envia',
          name: 'Envia.com',
          description: 'Cotización, etiqueta, seguimiento y cancelación mediante API.',
        },
      ],
    },
  };
}

function resetVerification(settings, { resetWebhook = false } = {}) {
  settings.lastTestStatus = 'none';
  settings.lastTestMessage = '';
  settings.lastTestAt = null;
  settings.lastTestMode = '';
  settings.lastTestCredentialRevision = 0;
  settings.defaultProvider = 'manual';
  settings.productionActivatedAt = null;
  settings.productionActivatedBy = null;
  if (resetWebhook) {
    settings.providerWebhookId = '';
    settings.providerWebhookMode = '';
    settings.providerWebhookUrl = '';
    settings.webhookRegisteredAt = null;
  }
}

function resetWebhookConfirmation(settings) {
  settings.providerWebhookId = '';
  settings.providerWebhookMode = '';
  settings.providerWebhookUrl = '';
  settings.webhookRegisteredAt = null;
}

async function updateShippingSettings(
  input = {},
  actor = null,
  { SettingsModel = ShippingSettings } = {}
) {
  const settings = await getSettings(SettingsModel);
  const nextMode = normalizeMode(input.enviaMode ?? settings.enviaMode);
  const nextDutiesPaymentEntity = normalizeDutiesPaymentEntity(
    input.internationalDutiesPaymentEntity ??
      settings.internationalDutiesPaymentEntity
  );
  const modeChanged = nextMode !== settings.enviaMode;
  let tokenChanged = false;
  let sandboxWebhookTokenChanged = false;
  let webhookSecretChanged = false;

  const token = String(input.enviaToken || '').trim();
  if (token) {
    settings.enviaTokenEncrypted = encryptShippingSecret(token);
    settings.enviaTokenHint = secretHint(token);
    tokenChanged = true;
  } else if (input.clearEnviaToken === true) {
    settings.enviaTokenEncrypted = '';
    settings.enviaTokenHint = '';
    tokenChanged = true;
  }

  const sandboxWebhookToken = String(input.sandboxWebhookToken || '').trim();
  if (sandboxWebhookToken) {
    settings.sandboxWebhookTokenEncrypted = encryptShippingSecret(
      sandboxWebhookToken
    );
    settings.sandboxWebhookTokenHint = secretHint(sandboxWebhookToken);
    sandboxWebhookTokenChanged = true;
  } else if (input.clearSandboxWebhookToken === true) {
    settings.sandboxWebhookTokenEncrypted = '';
    settings.sandboxWebhookTokenHint = '';
    sandboxWebhookTokenChanged = true;
  }

  const webhookSecret = String(input.webhookSecret || '').trim();
  if (webhookSecret) {
    settings.webhookSecretEncrypted = encryptShippingSecret(webhookSecret);
    settings.webhookSecretHint = secretHint(webhookSecret);
    webhookSecretChanged = true;
  } else if (input.clearWebhookSecret === true) {
    settings.webhookSecretEncrypted = '';
    settings.webhookSecretHint = '';
    webhookSecretChanged = true;
  }

  settings.enviaMode = nextMode;
  settings.internationalDutiesPaymentEntity = nextDutiesPaymentEntity;
  settings.managedFromPanel = true;
  settings.updatedBy = actorId(actor);
  settings.createdBy = settings.createdBy || actorId(actor);
  if (modeChanged || tokenChanged) {
    settings.credentialRevision = Number(settings.credentialRevision || 0) + 1;
  }
  if (modeChanged || tokenChanged || webhookSecretChanged) {
    resetVerification(settings, {
      resetWebhook: modeChanged || tokenChanged || webhookSecretChanged,
    });
  } else if (sandboxWebhookTokenChanged) {
    resetWebhookConfirmation(settings);
  }
  await settings.save();
  return getShippingSettingsView({ SettingsModel });
}

async function testShippingConnection(
  actor = null,
  { SettingsModel = ShippingSettings, provider = null, fetchImpl } = {}
) {
  const runtime = await getRuntimeShippingConfiguration({ SettingsModel });
  const settings = runtime.settings;
  const envia = provider || createEnviaProvider({
    config: runtime.envia,
    fetchImpl,
  });
  if (!envia.configured) {
    throw new ShippingSettingsError(
      'Guarda primero un token de Envia para probar la conexión.',
      'SHIPPING_TOKEN_REQUIRED',
      422
    );
  }
  try {
    await envia.testConnection();
    settings.lastTestStatus = 'success';
    settings.lastTestMessage = `Conexión autenticada con Envia ${runtime.envia.mode === 'production' ? 'Producción' : 'Sandbox'}.`;
    settings.lastTestAt = new Date();
    settings.lastTestMode = runtime.envia.mode;
    settings.lastTestCredentialRevision = Number(
      settings.credentialRevision || 0
    );
    settings.updatedBy = actorId(actor);
    await settings.save();
    return getShippingSettingsView({ SettingsModel });
  } catch (error) {
    settings.lastTestStatus = 'error';
    settings.lastTestMessage = clean(
      error?.message || 'No fue posible autenticar el token de Envia.',
      500
    );
    settings.lastTestAt = new Date();
    settings.lastTestMode = runtime.envia.mode;
    settings.lastTestCredentialRevision = Number(
      settings.credentialRevision || 0
    );
    settings.defaultProvider = 'manual';
    settings.updatedBy = actorId(actor);
    await settings.save().catch(() => {});
    throw error;
  }
}

async function confirmShippingWebhook(
  actor = null,
  { SettingsModel = ShippingSettings } = {}
) {
  const runtime = await getRuntimeShippingConfiguration({ SettingsModel });
  const state = readiness(runtime.settings, runtime);
  const webhookUrl = publicWebhookUrl();
  if (!state.canConfirmWebhook) {
    throw new ShippingSettingsError(
      runtime.envia.mode === 'production'
        ? 'Antes de confirmar el webhook de Producción se requiere conexión aprobada, secreto guardado y BACKEND_URL público con HTTPS.'
        : 'Antes de confirmar el webhook de Sandbox se requiere conexión aprobada, credencial de autorización guardada y BACKEND_URL público con HTTPS.',
      'SHIPPING_WEBHOOK_NOT_READY',
      422,
      state
    );
  }
  runtime.settings.providerWebhookId = 'dashboard-confirmed';
  runtime.settings.providerWebhookMode = runtime.envia.mode;
  runtime.settings.providerWebhookUrl = webhookUrl;
  runtime.settings.webhookRegisteredAt = new Date();
  runtime.settings.updatedBy = actorId(actor);
  await runtime.settings.save();
  return getShippingSettingsView({ SettingsModel });
}

async function activateShippingProvider(
  input = {},
  actor = null,
  { SettingsModel = ShippingSettings } = {}
) {
  const runtime = await getRuntimeShippingConfiguration({ SettingsModel });
  const state = readiness(runtime.settings, runtime);
  const production = runtime.envia.mode === 'production';
  if (production && input.confirmProduction !== true) {
    throw new ShippingSettingsError(
      'Debes confirmar expresamente la activación de Envia en Producción.',
      'SHIPPING_PRODUCTION_CONFIRMATION_REQUIRED',
      409
    );
  }
  if (production ? !state.canActivateProduction : !state.canActivateSandbox) {
    throw new ShippingSettingsError(
      production
        ? 'Producción exige token probado, secreto, webhook confirmado y URL pública HTTPS.'
        : 'Sandbox exige token probado, credencial del webhook, webhook confirmado y URL pública HTTPS.',
      'SHIPPING_PROVIDER_NOT_READY',
      409,
      state
    );
  }
  runtime.settings.defaultProvider = 'envia';
  runtime.settings.managedFromPanel = true;
  runtime.settings.updatedBy = actorId(actor);
  if (production) {
    runtime.settings.productionActivatedAt = new Date();
    runtime.settings.productionActivatedBy = actorId(actor);
  }
  await runtime.settings.save();
  return getShippingSettingsView({ SettingsModel });
}

async function disableShippingProvider(
  actor = null,
  { SettingsModel = ShippingSettings } = {}
) {
  const settings = await getSettings(SettingsModel);
  settings.defaultProvider = 'manual';
  settings.managedFromPanel = true;
  settings.productionActivatedAt = null;
  settings.productionActivatedBy = null;
  settings.updatedBy = actorId(actor);
  await settings.save();
  return getShippingSettingsView({ SettingsModel });
}

module.exports = {
  ShippingSettingsError,
  activateShippingProvider,
  disableShippingProvider,
  getRuntimeShippingConfiguration,
  getShippingSettingsView,
  publicWebhookUrl,
  readiness,
  confirmShippingWebhook,
  testShippingConnection,
  updateShippingSettings,
};
