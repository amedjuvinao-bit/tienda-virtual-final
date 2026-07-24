'use strict';

const SiteSettings = require('../models/SiteSettings');
const MailSettings = require('../models/MailSettings');
const {
  BillingConfigurationError,
  normalizeMode,
  PRODUCTION_MODE,
} = require('../lib/billing/billingConfigurationSecurity');
const {
  getAdminSettingsWithEncryptedBilling,
  testFactusConnection,
  updateBillingConfiguration,
} = require('./billingConfigurationService');

function cleanText(value, max = 500) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function onlyDigits(value, max = 30) {
  return cleanText(value, max).replace(/\D/g, '');
}

function mergeFiscalInfo(current = {}, incoming = {}) {
  const currentFiscal = current && typeof current === 'object' ? current : {};
  const incomingFiscal = incoming && typeof incoming === 'object' ? incoming : {};

  return {
    ...currentFiscal,
    ...incomingFiscal,
  };
}

function normalizeCompanySnapshot(company = {}, fiscalInfo = {}) {
  const source = company && typeof company === 'object' ? company : {};
  const fiscalNit = onlyDigits(fiscalInfo?.nit, 20);
  const fiscalDv = onlyDigits(fiscalInfo?.dv, 2).slice(0, 1);
  const rawNit = cleanText(
    source.nit ||
      source.identification ||
      source.identification_number ||
      source.document ||
      source.document_number,
    40
  );
  let nit = onlyDigits(rawNit, 30);
  let dv = onlyDigits(source.dv || source.verification_digit, 2).slice(0, 1);

  const separatedNit = rawNit.match(/^(\d+)[\s-]+(\d)$/);
  if (separatedNit) {
    nit = separatedNit[1];
    dv = dv || separatedNit[2];
  }

  if (fiscalNit && fiscalDv && nit === `${fiscalNit}${fiscalDv}`) {
    nit = fiscalNit;
    dv = dv || fiscalDv;
  }

  return {
    id: source.id || source.company_id || null,
    nit,
    dv,
    name: cleanText(
      source.name || source.business_name || source.legal_name || source.company,
      180
    ),
    tradeName: cleanText(source.tradeName || source.trade_name, 180),
    email: cleanText(source.email, 180).toLowerCase(),
  };
}

function assertVerifiedCompanyMatchesFiscal(company = {}, fiscalInfo = {}) {
  const fiscalNit = onlyDigits(fiscalInfo?.nit, 20);
  const fiscalDv = onlyDigits(fiscalInfo?.dv, 2).slice(0, 1);
  const snapshot = normalizeCompanySnapshot(company, fiscalInfo);

  if (!snapshot.nit) {
    throw new BillingConfigurationError(
      'Factus autenticó las credenciales, pero no devolvió el NIT de la empresa vinculada.',
      'FACTUS_COMPANY_NIT_MISSING',
      422
    );
  }

  if (!fiscalNit) {
    throw new BillingConfigurationError(
      'Debes configurar el NIT fiscal antes de verificar la empresa en Factus.',
      'BILLING_FISCAL_NIT_REQUIRED',
      422
    );
  }

  if (snapshot.nit !== fiscalNit) {
    throw new BillingConfigurationError(
      `El NIT vinculado en Factus (${snapshot.nit}) no coincide con el NIT fiscal configurado (${fiscalNit}).`,
      'FACTUS_COMPANY_NIT_MISMATCH',
      409,
      ['NIT de Factus y NIT fiscal deben coincidir']
    );
  }

  if (snapshot.dv && fiscalDv && snapshot.dv !== fiscalDv) {
    throw new BillingConfigurationError(
      `El dígito de verificación vinculado en Factus (${snapshot.dv}) no coincide con el configurado (${fiscalDv}).`,
      'FACTUS_COMPANY_DV_MISMATCH',
      409,
      ['Dígito de verificación de Factus y configuración fiscal deben coincidir']
    );
  }

  return {
    ...snapshot,
    dv: snapshot.dv || fiscalDv,
  };
}

function companyMatchesFiscal(company = {}, fiscalInfo = {}) {
  try {
    assertVerifiedCompanyMatchesFiscal(company, fiscalInfo);
    return true;
  } catch {
    return false;
  }
}

function resolveCompanyIdentityForEnvironment(
  company = {},
  fiscalInfo = {},
  environment = 'internal'
) {
  const mode = normalizeMode(environment);

  if (mode === PRODUCTION_MODE) {
    return {
      company: assertVerifiedCompanyMatchesFiscal(company, fiscalInfo),
      matchesFiscal: true,
      warning: '',
    };
  }

  const normalized = normalizeCompanySnapshot(company, fiscalInfo);

  try {
    return {
      company: assertVerifiedCompanyMatchesFiscal(normalized, fiscalInfo),
      matchesFiscal: true,
      warning: '',
    };
  } catch (error) {
    return {
      company: normalized,
      matchesFiscal: false,
      warning:
        'La empresa de prueba de Factus no coincide con el NIT fiscal real. Esto es permitido únicamente en habilitación y no autoriza Producción.',
      mismatchCode: error?.code || 'FACTUS_COMPANY_IDENTITY_MISMATCH',
    };
  }
}

async function readMailReadiness() {
  const mail = await MailSettings.findOne({ key: 'main' })
    .select('+smtpPasswordEncrypted')
    .lean();

  const configured = Boolean(
    mail?.enabled === true &&
      mail?.fromEmail &&
      mail?.smtpHost &&
      mail?.smtpPort &&
      mail?.smtpUser &&
      mail?.smtpPasswordEncrypted
  );
  const tested = mail?.lastTestStatus === 'success';

  return {
    enabled: mail?.enabled === true,
    configured,
    tested,
    ready: configured && tested,
    fromEmail: cleanText(mail?.fromEmail, 180),
    lastTestAt: mail?.lastTestAt || null,
  };
}

function buildBillingReadinessSnapshot(safeSettings = {}, mailReadiness = {}) {
  const billing = safeSettings?.billing || {};
  const fiscalInfo = billing?.fiscalInfo || {};
  const resolution = billing?.dianResolution || {};
  const provider = billing?.electronicProvider || {};
  const credentialStatus = safeSettings?._credentialStatus || {};
  const mode = (() => {
    try {
      return normalizeMode(billing?.dian?.mode);
    } catch {
      return 'internal';
    }
  })();
  const company = normalizeCompanySnapshot(provider.lastConnectionCompany, fiscalInfo);
  const credentials = {
    clientId: Boolean(cleanText(provider.clientId, 300)),
    clientSecret:
      credentialStatus['billing.electronicProvider.clientSecret'] === true,
    username: Boolean(cleanText(provider.username, 300)),
    password: credentialStatus['billing.electronicProvider.password'] === true,
  };
  const invoiceRangeId = Number(
    provider.numberingRangeId || resolution.numberingRangeId || 0
  );
  const creditNoteRangeId = Number(
    provider.creditNoteNumberingRangeId ||
      resolution.creditNoteNumberingRangeId ||
      0
  );
  const blockers = [];
  const missingCredentials = Object.entries(credentials)
    .filter(([, configured]) => !configured)
    .map(([field]) => field);

  if (cleanText(provider.provider, 40).toLowerCase() !== 'factus') {
    blockers.push('Factus debe ser el proveedor electrónico seleccionado');
  }
  if (missingCredentials.length) {
    blockers.push(`Credenciales Factus pendientes: ${missingCredentials.join(', ')}`);
  }
  if (provider.lastConnectionStatus !== 'success') {
    blockers.push('Conexión real con Factus pendiente');
  }
  if (provider.lastConnectionEnvironment !== 'production') {
    blockers.push('La conexión debe verificarse contra Producción');
  }
  if (!company.nit) {
    blockers.push('Empresa de Factus sin identificar');
  } else if (!companyMatchesFiscal(company, fiscalInfo)) {
    blockers.push('El NIT de Factus no coincide con la configuración fiscal');
  }
  if (!(invoiceRangeId > 0)) {
    blockers.push('Rango activo de facturas pendiente');
  }
  if (!(creditNoteRangeId > 0)) {
    blockers.push('Rango activo de notas crédito pendiente');
  }
  if (mailReadiness.ready !== true) {
    blockers.push('Correo transaccional activo y probado pendiente');
  }

  return {
    readyForProduction: blockers.length === 0,
    mode,
    provider: cleanText(provider.provider, 40).toLowerCase() || 'mock',
    blockers,
    credentials,
    connection: {
      status: cleanText(provider.lastConnectionStatus, 40) || 'none',
      message: cleanText(provider.lastConnectionMessage, 500),
      environment: cleanText(provider.lastConnectionEnvironment, 40),
      verifiedAt: provider.lastConnectionAt || null,
      company,
      companyMatchesFiscal: companyMatchesFiscal(company, fiscalInfo),
    },
    numberingRanges: {
      invoiceRangeId: invoiceRangeId > 0 ? invoiceRangeId : null,
      creditNoteRangeId: creditNoteRangeId > 0 ? creditNoteRangeId : null,
    },
    mail: {
      enabled: mailReadiness.enabled === true,
      configured: mailReadiness.configured === true,
      tested: mailReadiness.tested === true,
      ready: mailReadiness.ready === true,
      fromEmail: cleanText(mailReadiness.fromEmail, 180),
      lastTestAt: mailReadiness.lastTestAt || null,
    },
  };
}

async function getAdminSettingsWithBillingReadiness() {
  const [safeSettings, mailReadiness] = await Promise.all([
    getAdminSettingsWithEncryptedBilling(),
    readMailReadiness(),
  ]);

  return {
    ...safeSettings,
    _billingReadiness: buildBillingReadinessSnapshot(
      safeSettings,
      mailReadiness
    ),
  };
}

async function persistCompanyVerification(
  settingsId,
  company,
  options = {}
) {
  const $set = {
    'billing.electronicProvider.lastConnectionCompany': company || null,
  };

  if (options.status) {
    $set['billing.electronicProvider.lastConnectionStatus'] = options.status;
  }
  if (options.message !== undefined) {
    $set['billing.electronicProvider.lastConnectionMessage'] = cleanText(
      options.message,
      500
    );
  }
  if (options.environment !== undefined) {
    $set['billing.electronicProvider.lastConnectionEnvironment'] = cleanText(
      options.environment,
      40
    );
  }
  if (options.clearFingerprint === true) {
    $set['billing.electronicProvider.lastConnectionFingerprint'] = '';
  }

  await SiteSettings.findByIdAndUpdate(
    settingsId,
    { $set },
    { runValidators: true, strict: false }
  );
}

async function testFactusConnectionWithIdentity(body = {}, options = {}) {
  const result = await testFactusConnection(body, options);
  const settings = await SiteSettings.findOne().lean();
  const fiscalInfo = mergeFiscalInfo(
    settings?.billing?.fiscalInfo,
    body?.billing?.fiscalInfo
  );
  let identity;

  try {
    identity = resolveCompanyIdentityForEnvironment(
      result.company,
      fiscalInfo,
      result.environment
    );
  } catch (error) {
    if (settings?._id) {
      await persistCompanyVerification(
        settings._id,
        normalizeCompanySnapshot(result.company, fiscalInfo),
        {
          status: 'error',
          message: error.message,
          environment: result.environment,
          clearFingerprint: true,
        }
      ).catch(() => null);
    }
    throw error;
  }

  if (settings?._id) {
    await persistCompanyVerification(settings._id, identity.company);
  }

  const safeSettings = await getAdminSettingsWithBillingReadiness();

  return {
    ...result,
    company: identity.company,
    identityMatchesFiscal: identity.matchesFiscal,
    identityWarning: identity.warning,
    readiness: safeSettings._billingReadiness,
  };
}

async function clearConnectionMetadata(settingsId) {
  await SiteSettings.findByIdAndUpdate(
    settingsId,
    {
      $set: {
        'billing.electronicProvider.lastConnectionStatus': 'none',
        'billing.electronicProvider.lastConnectionMessage': '',
        'billing.electronicProvider.lastConnectionAt': null,
        'billing.electronicProvider.lastConnectionEnvironment': '',
        'billing.electronicProvider.lastConnectionFingerprint': '',
        'billing.electronicProvider.lastConnectionCompany': null,
      },
    },
    { runValidators: true, strict: false }
  );
}

async function updateBillingConfigurationWithReadiness(
  incomingBilling,
  options = {}
) {
  const before = await SiteSettings.findOne().lean();
  const currentBilling = before?.billing || {};
  const incomingDian = incomingBilling?.dian || {};
  const mode = normalizeMode(incomingDian.mode ?? currentBilling?.dian?.mode);
  const fiscalInfo = mergeFiscalInfo(
    currentBilling?.fiscalInfo,
    incomingBilling?.fiscalInfo
  );
  const storedCompany = currentBilling?.electronicProvider?.lastConnectionCompany;

  if (mode === PRODUCTION_MODE) {
    assertVerifiedCompanyMatchesFiscal(storedCompany, fiscalInfo);
  }

  await updateBillingConfiguration(incomingBilling, options);
  const updatedSettings = await SiteSettings.findOne().lean();
  const updatedProvider = updatedSettings?.billing?.electronicProvider || {};

  if (!updatedSettings?._id) {
    throw new BillingConfigurationError(
      'No fue posible recuperar la configuración actualizada.',
      'BILLING_CONFIGURATION_RELOAD_FAILED',
      500
    );
  }

  if (mode === 'internal') {
    await clearConnectionMetadata(updatedSettings._id);
  } else if (
    updatedProvider.lastConnectionStatus === 'success' &&
    updatedProvider.lastConnectionFingerprint &&
    storedCompany
  ) {
    const identity = resolveCompanyIdentityForEnvironment(
      storedCompany,
      fiscalInfo,
      mode
    );
    await persistCompanyVerification(updatedSettings._id, identity.company);
  } else {
    await persistCompanyVerification(updatedSettings._id, null);
  }

  return getAdminSettingsWithBillingReadiness();
}

module.exports = {
  assertVerifiedCompanyMatchesFiscal,
  buildBillingReadinessSnapshot,
  getAdminSettingsWithBillingReadiness,
  normalizeCompanySnapshot,
  resolveCompanyIdentityForEnvironment,
  testFactusConnectionWithIdentity,
  updateBillingConfigurationWithReadiness,
};
