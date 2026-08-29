'use strict';

const { env } = require('../config/env');
const OrderReturn = require('../models/OrderReturn');
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

const ENVIA_SANDBOX_WEBHOOK_TEST_STATUS = 'Shipped';
const ENVIA_SANDBOX_RETURN_WEBHOOK_TEST_STATUS = 'Picked Up';
const ENVIA_RECENT_SHIPMENT_MONTHS = 3;

function recentShipmentPeriods(now = new Date(), count = ENVIA_RECENT_SHIPMENT_MONTHS) {
  const anchor = new Date(now);
  if (Number.isNaN(anchor.getTime())) return [];
  return Array.from({ length: count }, (_, index) => {
    const period = new Date(Date.UTC(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth() - index,
      1
    ));
    return {
      month: String(period.getUTCMonth() + 1).padStart(2, '0'),
      year: String(period.getUTCFullYear()),
    };
  });
}

function shipmentIdentity(shipment = {}) {
  const carrierValue =
    shipment.carrier ||
    shipment.carrier_name ||
    shipment.carrierName ||
    shipment.service?.carrier ||
    shipment.shipment?.carrier;
  const carrier = clean(
    typeof carrierValue === 'object'
      ? carrierValue?.code || carrierValue?.slug || carrierValue?.name
      : carrierValue,
    80
  ).toLowerCase();
  const trackingNumber = clean(
    shipment.tracking_number ||
    shipment.trackingNumber ||
    shipment.tracking ||
    shipment.guide_number ||
    shipment.guideNumber ||
    shipment.shipment?.tracking_number ||
    shipment.shipment?.trackingNumber,
    180
  );
  const createdAt = new Date(
    shipment.created_at || shipment.createdAt || shipment.date || 0
  );
  return {
    carrier,
    trackingNumber,
    createdAt: Number.isNaN(createdAt.getTime()) ? 0 : createdAt.getTime(),
  };
}

async function findRecentSandboxReturnShipment(
  { OrderReturnModel = OrderReturn } = {}
) {
  const returnCase = await OrderReturnModel.findOne({
    status: { $in: ['authorized', 'in_transit'] },
    'shipping.integration.provider': 'envia',
    'shipping.integration.mode': 'sandbox',
    'shipping.integration.status': { $ne: 'cancelled' },
    'shipping.integration.pickup.status': 'scheduled',
    'shipping.carrierName': { $type: 'string', $gt: '' },
    'shipping.trackingNumber': { $type: 'string', $gt: '' },
  })
    .sort({ 'shipping.integration.pickup.requestedAt': -1, updatedAt: -1 })
    .select({
      'shipping.carrierName': 1,
      'shipping.trackingNumber': 1,
      'shipping.integration.pickup.requestedAt': 1,
      updatedAt: 1,
    })
    .lean();

  if (!returnCase?.shipping) return null;
  const identity = shipmentIdentity({
    carrier: returnCase.shipping.carrierName,
    trackingNumber: returnCase.shipping.trackingNumber,
    createdAt:
      returnCase.shipping.integration?.pickup?.requestedAt ||
      returnCase.updatedAt,
  });
  if (!identity.carrier || !identity.trackingNumber) return null;
  return {
    ...identity,
    webhookTestStatus: ENVIA_SANDBOX_RETURN_WEBHOOK_TEST_STATUS,
    source: 'order_return',
  };
}

async function resolveSandboxWebhookTestShipment(
  input = {},
  provider,
  now = new Date(),
  { findReturnShipment = findRecentSandboxReturnShipment } = {}
) {
  if (typeof provider?.listShipmentsByMonth !== 'function') {
    throw new ShippingSettingsError(
      'La integración de Envia no puede consultar las guías de la cuenta.',
      'SHIPPING_SHIPMENT_LOOKUP_UNAVAILABLE',
      500
    );
  }
  const requestedTrackingNumber = clean(input.trackingNumber, 180);
  const requestedCarrier = clean(input.carrier, 80).toLowerCase();
  const candidates = [];
  for (const period of recentShipmentPeriods(now)) {
    const shipments = await provider.listShipmentsByMonth(period);
    (Array.isArray(shipments) ? shipments : []).forEach((shipment) => {
      const candidate = shipmentIdentity(shipment);
      if (!candidate.carrier || !candidate.trackingNumber) return;
      if (
        requestedTrackingNumber &&
        candidate.trackingNumber !== requestedTrackingNumber
      ) return;
      if (requestedCarrier && candidate.carrier !== requestedCarrier) return;
      candidates.push(candidate);
    });
    if (candidates.length) break;
  }
  candidates.sort((left, right) => right.createdAt - left.createdAt);
  if (candidates[0]) return candidates[0];

  if (!requestedTrackingNumber && typeof findReturnShipment === 'function') {
    const returnShipment = await findReturnShipment();
    if (returnShipment?.carrier && returnShipment?.trackingNumber) {
      return returnShipment;
    }
  }

  throw new ShippingSettingsError(
    requestedTrackingNumber
      ? 'La guía indicada no pertenece a las guías recientes de esta cuenta Envia Sandbox.'
      : 'La cuenta Envia Sandbox no tiene una guía reciente para realizar la prueba oficial. Primero debe existir una guía de prueba en esa misma cuenta.',
    'SHIPPING_WEBHOOK_TEST_SHIPMENT_REQUIRED',
    409,
    { provider: 'envia', mode: 'sandbox' }
  );
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

function temporaryTunnelUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.endsWith('.trycloudflare.com');
  } catch {
    return false;
  }
}

function permanentPublicHttpsUrl(value) {
  return publicHttpsUrl(value) && !temporaryTunnelUrl(value);
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
  const webhookUrlPermanent = permanentPublicHttpsUrl(webhookUrl);
  const eligibleWebhookUrl = production
    ? webhookUrlPermanent
    : webhookUrlReady;
  const webhookVerified = Boolean(
    webhookRegistered &&
    settings.webhookVerifiedAt &&
    settings.webhookVerificationMode === runtime.envia.mode &&
    settings.webhookVerificationUrl === webhookUrl
  );
  const webhookCredentialReady = production
    ? hasWebhookSecret
    : hasSandboxWebhookToken;
  return {
    hasToken,
    hasSandboxWebhookToken,
    hasWebhookSecret,
    tested,
    webhookRegistered,
    webhookVerified,
    webhookUrlReady,
    webhookUrlPermanent,
    temporaryWebhookUrl: webhookUrlReady && !webhookUrlPermanent,
    canTest: hasToken,
    canConfirmWebhook:
      hasToken && tested && eligibleWebhookUrl && webhookCredentialReady,
    // Alias temporal para clientes anteriores. Envia administra la URL desde su portal.
    canRegisterWebhook:
      hasToken && tested && eligibleWebhookUrl && webhookCredentialReady,
    canActivateSandbox:
      hasToken &&
      tested &&
      hasSandboxWebhookToken &&
      webhookRegistered &&
      webhookVerified &&
      webhookUrlReady,
    canActivateProduction:
      hasToken &&
      tested &&
      hasWebhookSecret &&
      webhookRegistered &&
      webhookVerified &&
      webhookUrlPermanent,
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
    settings.webhookVerifiedAt = null;
    settings.webhookVerificationEventId = '';
    settings.webhookVerificationMode = '';
    settings.webhookVerificationUrl = '';
  }
}

function resetWebhookConfirmation(settings) {
  settings.providerWebhookId = '';
  settings.providerWebhookMode = '';
  settings.providerWebhookUrl = '';
  settings.webhookRegisteredAt = null;
  settings.webhookVerifiedAt = null;
  settings.webhookVerificationEventId = '';
  settings.webhookVerificationMode = '';
  settings.webhookVerificationUrl = '';
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
        ? 'Antes de registrar el webhook de Producción se requiere conexión aprobada, secreto guardado y BACKEND_URL HTTPS permanente.'
        : 'Antes de confirmar el webhook de Sandbox se requiere conexión aprobada, credencial de autorización guardada y BACKEND_URL público con HTTPS.',
      'SHIPPING_WEBHOOK_NOT_READY',
      422,
      state
    );
  }
  if (state.webhookVerified) {
    return getShippingSettingsView({ SettingsModel });
  }
  runtime.settings.providerWebhookId = 'dashboard-confirmed';
  runtime.settings.providerWebhookMode = runtime.envia.mode;
  runtime.settings.providerWebhookUrl = webhookUrl;
  runtime.settings.webhookRegisteredAt = new Date();
  runtime.settings.webhookVerifiedAt = null;
  runtime.settings.webhookVerificationEventId = '';
  runtime.settings.webhookVerificationMode = '';
  runtime.settings.webhookVerificationUrl = '';
  runtime.settings.updatedBy = actorId(actor);
  await runtime.settings.save();
  return getShippingSettingsView({ SettingsModel });
}

async function requestShippingWebhookProof(
  input = {},
  actor = null,
  {
    SettingsModel = ShippingSettings,
    provider = null,
    fetchImpl,
    now = new Date(),
    findReturnShipment = findRecentSandboxReturnShipment,
  } = {}
) {
  const runtime = await getRuntimeShippingConfiguration({ SettingsModel });
  const state = readiness(runtime.settings, runtime);
  if (runtime.envia.mode !== 'sandbox') {
    throw new ShippingSettingsError(
      'La prueba automática solo está permitida en Envia Sandbox. Producción exige un evento firmado real.',
      'SHIPPING_WEBHOOK_TEST_SANDBOX_ONLY',
      409
    );
  }
  if (!state.webhookRegistered || !state.webhookUrlReady) {
    throw new ShippingSettingsError(
      'Registra primero la URL pública del webhook en Envia.',
      'SHIPPING_WEBHOOK_NOT_REGISTERED',
      409,
      state
    );
  }
  if (!state.hasToken || !state.tested || !state.hasSandboxWebhookToken) {
    throw new ShippingSettingsError(
      'La prueba exige token, conexión y credencial Sandbox aprobados.',
      'SHIPPING_WEBHOOK_TEST_NOT_READY',
      409,
      state
    );
  }
  if (state.webhookVerified) {
    return getShippingSettingsView({ SettingsModel });
  }

  const envia = provider || createEnviaProvider({
    config: runtime.envia,
    fetchImpl,
  });
  const shipment = await resolveSandboxWebhookTestShipment(input, envia, now, {
    findReturnShipment,
  });
  await envia.testWebhook({
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    status: shipment.webhookTestStatus || ENVIA_SANDBOX_WEBHOOK_TEST_STATUS,
  });
  runtime.settings.updatedBy = actorId(actor);
  await runtime.settings.save();
  return getShippingSettingsView({ SettingsModel });
}

async function markShippingWebhookVerified(
  verified = {},
  { SettingsModel = ShippingSettings, now = new Date() } = {}
) {
  const runtime = await getRuntimeShippingConfiguration({ SettingsModel });
  const webhookUrl = publicWebhookUrl();
  const production = runtime.envia.mode === 'production';

  if (!publicHttpsUrl(webhookUrl)) {
    return { verified: false, reason: 'webhook_url_not_public' };
  }
  if (production && !permanentPublicHttpsUrl(webhookUrl)) {
    return { verified: false, reason: 'temporary_production_url' };
  }
  if (production && verified.sandboxTest === true) {
    return { verified: false, reason: 'sandbox_event_in_production' };
  }
  if (!production && verified.sandboxTest !== true) {
    return { verified: false, reason: 'production_event_in_sandbox' };
  }

  const eventId = clean(verified.eventId, 300);
  runtime.settings.providerWebhookId = eventId || 'provider-verified';
  runtime.settings.providerWebhookMode = runtime.envia.mode;
  runtime.settings.providerWebhookUrl = webhookUrl;
  runtime.settings.webhookRegisteredAt =
    runtime.settings.webhookRegisteredAt || now;
  runtime.settings.webhookVerifiedAt = now;
  runtime.settings.webhookVerificationEventId = eventId;
  runtime.settings.webhookVerificationMode = runtime.envia.mode;
  runtime.settings.webhookVerificationUrl = webhookUrl;
  await runtime.settings.save();

  return {
    verified: true,
    mode: runtime.envia.mode,
    webhookUrl,
    verifiedAt: now,
  };
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
        ? 'Producción exige token probado, secreto, URL HTTPS permanente y una prueba real recibida desde Envia.'
        : 'Sandbox exige token probado, credencial del webhook y una prueba recibida desde Envia.',
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
  findRecentSandboxReturnShipment,
  getRuntimeShippingConfiguration,
  getShippingSettingsView,
  markShippingWebhookVerified,
  permanentPublicHttpsUrl,
  publicHttpsUrl,
  publicWebhookUrl,
  readiness,
  confirmShippingWebhook,
  requestShippingWebhookProof,
  testShippingConnection,
  updateShippingSettings,
};
