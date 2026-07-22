'use strict';

const SiteSettings = require('../models/SiteSettings');
const MailSettings = require('../models/MailSettings');
const { buildAdminSiteSettings } = require('../lib/siteSettingsSecurity');
const {
  BillingConfigurationError,
  buildFactusCredentialFingerprint,
  buildRuntimeFactusConfig,
  hasLegacyPlaintextBillingSecrets,
  prepareBillingConfigurationForStorage,
} = require('../lib/billing/billingConfigurationSecurity');
const {
  getFactusAccessToken,
} = require('../lib/dian/providers/factusProvider');

function cleanText(value, max = 500) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function createServiceError(message, code, status = 500, details = []) {
  return new BillingConfigurationError(message, code, status, details);
}

async function getOrCreateSettingsDocument() {
  let settings = await SiteSettings.findOne();

  if (!settings) {
    settings = await SiteSettings.create({
      billing: {},
      updatedBy: 'system',
    });
  }

  return settings;
}

async function assertProductionMailReady() {
  const mail = await MailSettings.findOne({ key: 'main' })
    .select('+smtpPasswordEncrypted')
    .lean();

  const ready = Boolean(
    mail?.enabled === true &&
      mail?.fromEmail &&
      mail?.smtpHost &&
      mail?.smtpPort &&
      mail?.smtpUser &&
      mail?.smtpPasswordEncrypted &&
      mail?.lastTestStatus === 'success'
  );

  if (!ready) {
    throw createServiceError(
      'No se puede activar Producción hasta que el correo esté configurado y probado correctamente.',
      'BILLING_PRODUCTION_MAIL_NOT_READY',
      409,
      ['correo activo y probado']
    );
  }
}

async function migrateLegacyBillingSecrets(settings) {
  const rawBilling = settings?.billing?.toObject
    ? settings.billing.toObject({ depopulate: true })
    : settings?.billing || {};

  if (!hasLegacyPlaintextBillingSecrets(rawBilling)) return settings;

  const migratedBilling = prepareBillingConfigurationForStorage(
    rawBilling,
    rawBilling,
    { skipProductionReadiness: true }
  );

  settings.billing = migratedBilling;
  settings.markModified('billing');
  await settings.save();

  return settings;
}

async function getAdminSettingsWithEncryptedBilling() {
  const settings = await getOrCreateSettingsDocument();
  await migrateLegacyBillingSecrets(settings);
  return buildAdminSiteSettings(settings.toObject());
}

async function updateBillingConfiguration(incomingBilling, options = {}) {
  const settings = await getOrCreateSettingsDocument();
  const currentBilling = settings?.billing?.toObject
    ? settings.billing.toObject({ depopulate: true })
    : settings?.billing || {};
  const preparedBilling = prepareBillingConfigurationForStorage(
    incomingBilling,
    currentBilling
  );

  if (preparedBilling?.dian?.mode === 'production') {
    await assertProductionMailReady();
  }

  settings.billing = preparedBilling;
  settings.updatedBy = cleanText(options.adminUser || 'admin', 180) || 'admin';
  settings.markModified('billing');

  try {
    await settings.save();
  } catch (error) {
    if (error?.name === 'ValidationError') {
      const details = Object.values(error.errors || {})
        .map((item) => cleanText(item?.message, 300))
        .filter(Boolean);
      throw createServiceError(
        details[0] || 'La configuración de facturación no cumple las validaciones.',
        'BILLING_SCHEMA_VALIDATION_ERROR',
        422,
        details
      );
    }

    throw error;
  }

  return buildAdminSiteSettings(settings.toObject());
}

function mergeConnectionCandidate(currentBilling = {}, body = {}) {
  const bodyBilling = body?.billing && typeof body.billing === 'object'
    ? body.billing
    : {};
  const providerConfig = body?.providerConfig && typeof body.providerConfig === 'object'
    ? body.providerConfig
    : {};
  const mode = body?.mode || bodyBilling?.dian?.mode || currentBilling?.dian?.mode;

  return {
    ...currentBilling,
    ...bodyBilling,
    dian: {
      ...(currentBilling.dian || {}),
      ...(bodyBilling.dian || {}),
      mode,
    },
    electronicProvider: {
      ...(currentBilling.electronicProvider || {}),
      ...(bodyBilling.electronicProvider || {}),
      ...providerConfig,
      provider:
        providerConfig.provider ||
        bodyBilling?.electronicProvider?.provider ||
        currentBilling?.electronicProvider?.provider ||
        'factus',
    },
  };
}

function extractCompany(data = {}) {
  const candidates = [
    data?.data?.data,
    data?.data,
    data?.company,
    data,
  ];
  const source = candidates.find(
    (value) => value && typeof value === 'object' && !Array.isArray(value)
  ) || {};

  return {
    id: source.id || source.company_id || null,
    nit: cleanText(source.nit || source.identification || source.document, 30),
    dv: cleanText(source.dv, 2),
    name: cleanText(
      source.name || source.business_name || source.legal_name || source.company,
      180
    ),
    tradeName: cleanText(source.trade_name || source.tradeName, 180),
    email: cleanText(source.email, 180),
  };
}

async function fetchFactusCompany(runtimeConfig, tokenResult) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${runtimeConfig.apiUrl}/v2/companies`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `${tokenResult.tokenType || 'Bearer'} ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw createServiceError(
        'Factus autenticó las credenciales, pero no permitió consultar la empresa vinculada.',
        'FACTUS_COMPANY_LOOKUP_FAILED',
        502
      );
    }

    return extractCompany(data);
  } catch (error) {
    if (error instanceof BillingConfigurationError) throw error;
    if (error?.name === 'AbortError') {
      throw createServiceError(
        'La consulta de la empresa en Factus superó el tiempo de espera.',
        'FACTUS_COMPANY_TIMEOUT',
        504
      );
    }

    throw createServiceError(
      'No fue posible consultar la empresa vinculada en Factus.',
      'FACTUS_COMPANY_CONNECTION_ERROR',
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function recordConnectionResult(settings, data = {}) {
  settings.set('billing.electronicProvider.lastConnectionStatus', data.status || 'error');
  settings.set(
    'billing.electronicProvider.lastConnectionMessage',
    cleanText(data.message, 500)
  );
  settings.set('billing.electronicProvider.lastConnectionAt', new Date());
  settings.set(
    'billing.electronicProvider.lastConnectionEnvironment',
    cleanText(data.environment, 40)
  );
  settings.set(
    'billing.electronicProvider.lastConnectionFingerprint',
    cleanText(data.fingerprint, 128)
  );
  settings.markModified('billing.electronicProvider');
  await settings.save();
}

async function testFactusConnection(body = {}, options = {}) {
  const settings = await getOrCreateSettingsDocument();
  const currentBilling = settings?.billing?.toObject
    ? settings.billing.toObject({ depopulate: true })
    : settings?.billing || {};
  const candidateInput = mergeConnectionCandidate(currentBilling, body);
  const candidateBilling = prepareBillingConfigurationForStorage(
    candidateInput,
    currentBilling,
    { skipProductionReadiness: true }
  );
  const runtimeConfig = buildRuntimeFactusConfig(candidateBilling);
  const fingerprint = buildFactusCredentialFingerprint(runtimeConfig);

  let tokenResult;
  try {
    tokenResult = await getFactusAccessToken(runtimeConfig);
  } catch (error) {
    await recordConnectionResult(settings, {
      status: 'error',
      message: 'No fue posible conectar con Factus.',
      environment: runtimeConfig.environment,
      fingerprint: '',
    }).catch(() => null);

    if (error?.name === 'AbortError') {
      throw createServiceError(
        'La autenticación con Factus superó el tiempo de espera.',
        'FACTUS_AUTH_TIMEOUT',
        504
      );
    }

    throw createServiceError(
      'No fue posible autenticar con Factus.',
      'FACTUS_AUTH_CONNECTION_ERROR',
      502
    );
  }

  if (!tokenResult?.success || !tokenResult?.accessToken) {
    await recordConnectionResult(settings, {
      status: 'error',
      message: 'Factus rechazó las credenciales configuradas.',
      environment: runtimeConfig.environment,
      fingerprint: '',
    }).catch(() => null);

    throw createServiceError(
      'Factus rechazó las credenciales configuradas.',
      'FACTUS_AUTH_REJECTED',
      422
    );
  }

  const company = await fetchFactusCompany(runtimeConfig, tokenResult);
  const message = company.name
    ? `Conexión verificada con Factus para ${company.name}.`
    : 'Conexión y empresa verificadas correctamente con Factus.';

  await recordConnectionResult(settings, {
    status: 'success',
    message,
    environment: runtimeConfig.environment,
    fingerprint,
  });
  settings.updatedBy = cleanText(options.adminUser || 'admin', 180) || 'admin';
  await settings.save();

  return {
    provider: 'factus',
    environment: runtimeConfig.environment,
    status: 'success',
    message,
    company,
    verifiedAt: new Date().toISOString(),
  };
}

module.exports = {
  getAdminSettingsWithEncryptedBilling,
  testFactusConnection,
  updateBillingConfiguration,
};