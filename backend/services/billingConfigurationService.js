'use strict';

const SiteSettings = require('../models/SiteSettings');
const MailSettings = require('../models/MailSettings');
const { buildAdminSiteSettings } = require('../lib/siteSettingsSecurity');
const {
  BillingConfigurationError,
  buildFactusCredentialFingerprint,
  buildRuntimeFactusConfig,
  encryptBillingSecret,
  isEncryptedBillingSecret,
  prepareBillingConfigurationForStorage,
} = require('../lib/billing/billingConfigurationSecurity');

const LEGACY_SECRET_PATHS = Object.freeze([
  'billing.electronicProvider.clientSecret',
  'billing.electronicProvider.password',
  'billing.electronicProvider.softwarePin',
  'billing.electronicProvider.technicalKey',
  'billing.dian.softwarePin',
  'billing.dian.softwareSecurityCode',
  'billing.dian.certificatePath',
  'billing.dian.certificatePassword',
  'billing.dianResolution.technicalKey',
]);

function cleanText(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function createServiceError(message, code, status = 500, details = []) {
  return new BillingConfigurationError(message, code, status, details);
}

function getNested(object, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => value?.[key], object);
}

async function getOrCreateSettingsDocument() {
  let settings = await SiteSettings.findOne();
  if (!settings) {
    settings = await SiteSettings.create({ billing: {}, updatedBy: 'system' });
  }
  return settings;
}

async function migrateLegacyBillingSecrets(settings) {
  const source = settings?.toObject
    ? settings.toObject({ depopulate: true })
    : settings || {};
  const $set = {};

  LEGACY_SECRET_PATHS.forEach((path) => {
    const value = String(getNested(source, path) ?? '');
    if (value.trim() && !isEncryptedBillingSecret(value)) {
      $set[path] = encryptBillingSecret(value);
    }
  });

  if (!Object.keys($set).length) return settings;

  const migrated = await SiteSettings.findByIdAndUpdate(
    settings._id,
    { $set },
    { new: true, runValidators: true, strict: false }
  );

  return migrated || settings;
}

async function getAdminSettingsWithEncryptedBilling() {
  const settings = await getOrCreateSettingsDocument();
  const migrated = await migrateLegacyBillingSecrets(settings);
  return buildAdminSiteSettings(migrated.toObject());
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

  try {
    const updated = await SiteSettings.findByIdAndUpdate(
      settings._id,
      {
        $set: {
          billing: preparedBilling,
          updatedBy: cleanText(options.adminUser || 'admin', 180) || 'admin',
        },
      },
      { new: true, runValidators: true, strict: false }
    );

    if (!updated) {
      throw createServiceError(
        'No se encontró la configuración que debía actualizarse.',
        'BILLING_CONFIGURATION_NOT_FOUND',
        404
      );
    }

    return buildAdminSiteSettings(updated.toObject());
  } catch (error) {
    if (error instanceof BillingConfigurationError) throw error;
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
}

function mergeConnectionCandidate(currentBilling = {}, body = {}) {
  const bodyBilling = body?.billing && typeof body.billing === 'object'
    ? body.billing
    : {};
  const providerConfig = body?.providerConfig && typeof body.providerConfig === 'object'
    ? body.providerConfig
    : {};

  return {
    ...currentBilling,
    ...bodyBilling,
    dian: {
      ...(currentBilling.dian || {}),
      ...(bodyBilling.dian || {}),
      mode: body?.mode || bodyBilling?.dian?.mode || currentBilling?.dian?.mode,
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
  const source = [data?.data?.data, data?.data, data?.company, data].find(
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

async function authenticateFactus(runtimeConfig) {
  const body = new URLSearchParams();
  body.append('grant_type', 'password');
  body.append('client_id', runtimeConfig.clientId);
  body.append('client_secret', runtimeConfig.clientSecret);
  body.append('username', runtimeConfig.username);
  body.append('password', runtimeConfig.password);

  try {
    const { response, data } = await fetchJsonWithTimeout(
      `${runtimeConfig.apiUrl}/oauth/token`,
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
      throw createServiceError(
        'Factus rechazó las credenciales configuradas.',
        'FACTUS_AUTH_REJECTED',
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
}

async function fetchFactusCompany(runtimeConfig, token) {
  try {
    const { response, data } = await fetchJsonWithTimeout(
      `${runtimeConfig.apiUrl}/v2/companies`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `${token.tokenType} ${token.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

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
  }
}

async function recordConnectionResult(settingsId, data = {}, adminUser = 'admin') {
  await SiteSettings.findByIdAndUpdate(
    settingsId,
    {
      $set: {
        'billing.electronicProvider.lastConnectionStatus': data.status || 'error',
        'billing.electronicProvider.lastConnectionMessage': cleanText(data.message, 500),
        'billing.electronicProvider.lastConnectionAt': new Date(),
        'billing.electronicProvider.lastConnectionEnvironment': cleanText(
          data.environment,
          40
        ),
        'billing.electronicProvider.lastConnectionFingerprint': cleanText(
          data.fingerprint,
          128
        ),
        updatedBy: cleanText(adminUser, 180) || 'admin',
      },
    },
    { runValidators: true, strict: false }
  );
}

async function testFactusConnection(body = {}, options = {}) {
  const settings = await getOrCreateSettingsDocument();
  const currentBilling = settings?.billing?.toObject
    ? settings.billing.toObject({ depopulate: true })
    : settings?.billing || {};
  const candidate = prepareBillingConfigurationForStorage(
    mergeConnectionCandidate(currentBilling, body),
    currentBilling,
    { skipProductionReadiness: true }
  );
  const runtimeConfig = buildRuntimeFactusConfig(candidate);
  const fingerprint = buildFactusCredentialFingerprint(runtimeConfig);

  try {
    const token = await authenticateFactus(runtimeConfig);
    const company = await fetchFactusCompany(runtimeConfig, token);
    const message = company.name
      ? `Conexión verificada con Factus para ${company.name}.`
      : 'Conexión y empresa verificadas correctamente con Factus.';

    await recordConnectionResult(
      settings._id,
      {
        status: 'success',
        message,
        environment: runtimeConfig.environment,
        fingerprint,
      },
      options.adminUser
    );

    return {
      provider: 'factus',
      environment: runtimeConfig.environment,
      status: 'success',
      message,
      company,
      verifiedAt: new Date().toISOString(),
    };
  } catch (error) {
    await recordConnectionResult(
      settings._id,
      {
        status: 'error',
        message:
          error instanceof BillingConfigurationError
            ? error.message
            : 'No fue posible conectar con Factus.',
        environment: runtimeConfig.environment,
        fingerprint: '',
      },
      options.adminUser
    ).catch(() => null);
    throw error;
  }
}

module.exports = {
  getAdminSettingsWithEncryptedBilling,
  testFactusConnection,
  updateBillingConfiguration,
};