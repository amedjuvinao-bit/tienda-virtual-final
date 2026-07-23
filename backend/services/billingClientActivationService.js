'use strict';

const crypto = require('crypto');
const SiteSettings = require('../models/SiteSettings');
const MailSettings = require('../models/MailSettings');
const {
  BillingConfigurationError,
  PRODUCTION_MODE,
  buildFactusCredentialFingerprint,
  buildRuntimeFactusConfig,
  normalizeMode,
} = require('../lib/billing/billingConfigurationSecurity');
const {
  getAdminSettingsWithBillingReadiness,
  testFactusConnectionWithIdentity,
  updateBillingConfigurationWithReadiness,
} = require('./billingConnectionOrchestrationService');
const {
  saveFactusNumberingRangeSelection,
} = require('./billingNumberingRangeService');
const {
  assertProductionNumberingRangesReady,
  readNumberingRangeSnapshot,
  reconcileNumberingRangeSnapshot,
} = require('./billingNumberingRangePersistenceService');

const ACTIVATION_LOCK_MS = 2 * 60 * 1000;

function cleanText(value, max = 500) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function activationError(message, code, status = 409, details = []) {
  return new BillingConfigurationError(message, code, status, details);
}

function requireProductionCandidate(billing = {}, input = {}) {
  const mode = normalizeMode(billing?.dian?.mode);
  const provider = cleanText(
    billing?.electronicProvider?.provider,
    40
  ).toLowerCase();
  const invoiceRangeId = positiveInteger(
    input.invoiceRangeId ||
      billing?.electronicProvider?.numberingRangeId ||
      billing?.dianResolution?.numberingRangeId
  );
  const creditNoteRangeId = positiveInteger(
    input.creditNoteRangeId ||
      billing?.electronicProvider?.creditNoteNumberingRangeId ||
      billing?.dianResolution?.creditNoteNumberingRangeId
  );
  const blockers = [];

  if (mode !== PRODUCTION_MODE) {
    blockers.push('seleccionar Producción como ambiente de emisión');
  }
  if (provider !== 'factus') {
    blockers.push('seleccionar Factus como proveedor');
  }
  if (!(invoiceRangeId > 0)) {
    blockers.push('seleccionar un rango oficial de facturas');
  }
  if (!(creditNoteRangeId > 0)) {
    blockers.push('seleccionar un rango oficial de notas crédito');
  }

  if (blockers.length) {
    throw activationError(
      `No se puede activar Producción. Falta: ${blockers.join(', ')}.`,
      'BILLING_CLIENT_ACTIVATION_INCOMPLETE',
      422,
      blockers
    );
  }

  return { mode, provider, invoiceRangeId, creditNoteRangeId };
}

async function assertMailReady() {
  const mail = await MailSettings.findOne({ key: 'main' })
    .select('+smtpPasswordEncrypted')
    .lean();
  const blockers = [];

  if (mail?.enabled !== true) blockers.push('activar el correo transaccional');
  if (!cleanText(mail?.fromEmail, 180)) blockers.push('configurar el correo remitente');
  if (!cleanText(mail?.smtpHost, 180)) blockers.push('configurar el servidor SMTP');
  if (!(Number(mail?.smtpPort) > 0)) blockers.push('configurar el puerto SMTP');
  if (!cleanText(mail?.smtpUser, 300)) blockers.push('configurar el usuario SMTP');
  if (!cleanText(mail?.smtpPasswordEncrypted, 5000)) {
    blockers.push('configurar la contraseña SMTP');
  }
  if (mail?.lastTestStatus !== 'success') {
    blockers.push('enviar correctamente un correo de prueba');
  }

  if (blockers.length) {
    throw activationError(
      `No se puede activar Producción. Falta: ${blockers.join(', ')}.`,
      'BILLING_CLIENT_ACTIVATION_MAIL_NOT_READY',
      409,
      blockers
    );
  }

  return {
    fromEmail: cleanText(mail.fromEmail, 180),
    testedAt: mail.lastTestAt || null,
  };
}

async function acquireActivationLock(adminUser = 'admin') {
  const settings = await SiteSettings.findOne().select('_id').lean();
  if (!settings?._id) {
    throw activationError(
      'No existe una configuración de facturación para activar.',
      'BILLING_SETTINGS_NOT_FOUND',
      404
    );
  }

  const now = new Date();
  const token = crypto.randomUUID();
  const lockExpiresAt = new Date(now.getTime() + ACTIVATION_LOCK_MS);
  const locked = await SiteSettings.findOneAndUpdate(
    {
      _id: settings._id,
      $or: [
        { 'billing.activation.lockExpiresAt': { $exists: false } },
        { 'billing.activation.lockExpiresAt': null },
        { 'billing.activation.lockExpiresAt': { $lt: now } },
      ],
    },
    {
      $set: {
        'billing.activation.status': 'activating',
        'billing.activation.lockToken': token,
        'billing.activation.lockExpiresAt': lockExpiresAt,
        'billing.activation.lastAttemptAt': now,
        'billing.activation.lastAttemptBy': cleanText(adminUser, 180) || 'admin',
        'billing.activation.lastErrorCode': '',
        'billing.activation.lastErrorMessage': '',
      },
    },
    { new: true, runValidators: true, strict: false }
  ).lean();

  if (!locked) {
    throw activationError(
      'Ya existe una activación de Factus en curso. Espera a que termine antes de volver a intentarlo.',
      'BILLING_CLIENT_ACTIVATION_IN_PROGRESS',
      409
    );
  }

  return { settingsId: locked._id, token };
}

async function markActivationFailure(lock, error, adminUser = 'admin') {
  if (!lock?.settingsId || !lock?.token) return;

  await SiteSettings.findOneAndUpdate(
    {
      _id: lock.settingsId,
      'billing.activation.lockToken': lock.token,
    },
    {
      $set: {
        'billing.activation.status': 'error',
        'billing.activation.lastAttemptAt': new Date(),
        'billing.activation.lastAttemptBy': cleanText(adminUser, 180) || 'admin',
        'billing.activation.lastErrorCode': cleanText(
          error?.code || 'BILLING_CLIENT_ACTIVATION_ERROR',
          120
        ),
        'billing.activation.lastErrorMessage': cleanText(
          error?.message || 'No fue posible activar Factus en Producción.',
          500
        ),
      },
      $unset: {
        'billing.activation.lockToken': '',
        'billing.activation.lockExpiresAt': '',
      },
    },
    { runValidators: true, strict: false }
  ).catch(() => null);
}

async function markActivationSuccess(lock, metadata = {}, adminUser = 'admin') {
  const now = new Date();
  const updated = await SiteSettings.findOneAndUpdate(
    {
      _id: lock.settingsId,
      'billing.activation.lockToken': lock.token,
    },
    {
      $set: {
        'billing.activation.status': 'active',
        'billing.activation.provider': 'factus',
        'billing.activation.environment': 'production',
        'billing.activation.activatedAt': now,
        'billing.activation.activatedBy': cleanText(adminUser, 180) || 'admin',
        'billing.activation.lastAttemptAt': now,
        'billing.activation.lastAttemptBy': cleanText(adminUser, 180) || 'admin',
        'billing.activation.activationFingerprint': cleanText(
          metadata.activationFingerprint,
          128
        ),
        'billing.activation.companyNit': cleanText(metadata.companyNit, 30),
        'billing.activation.invoiceRangeId': positiveInteger(
          metadata.invoiceRangeId
        ),
        'billing.activation.creditNoteRangeId': positiveInteger(
          metadata.creditNoteRangeId
        ),
        'billing.activation.mailFrom': cleanText(metadata.mailFrom, 180),
        'billing.activation.lastErrorCode': '',
        'billing.activation.lastErrorMessage': '',
      },
      $unset: {
        'billing.activation.lockToken': '',
        'billing.activation.lockExpiresAt': '',
      },
    },
    { new: true, runValidators: true, strict: false }
  ).lean();

  if (!updated) {
    throw activationError(
      'La validación terminó, pero no fue posible confirmar el estado final de activación.',
      'BILLING_CLIENT_ACTIVATION_CONFIRMATION_FAILED',
      500
    );
  }
}

function buildActivationFingerprint({
  runtime,
  companyNit,
  invoiceRangeId,
  creditNoteRangeId,
  mailFrom,
}) {
  const credentialFingerprint = buildFactusCredentialFingerprint(runtime);
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        credentialFingerprint,
        companyNit: cleanText(companyNit, 30),
        invoiceRangeId: positiveInteger(invoiceRangeId),
        creditNoteRangeId: positiveInteger(creditNoteRangeId),
        mailFrom: cleanText(mailFrom, 180).toLowerCase(),
      })
    )
    .digest('hex');
}

async function activateClientFactusProduction(
  billing = {},
  input = {},
  options = {}
) {
  const adminUser = cleanText(options.adminUser, 180) || 'admin';
  const required = requireProductionCandidate(billing, input);
  const lock = await acquireActivationLock(adminUser);

  try {
    const mail = await assertMailReady();
    const connection = await testFactusConnectionWithIdentity(
      { billing },
      { adminUser }
    );

    if (connection.environment !== 'production') {
      throw activationError(
        'La conexión verificada no corresponde al ambiente de Producción.',
        'BILLING_CLIENT_ACTIVATION_WRONG_ENVIRONMENT',
        409
      );
    }

    const ranges = await saveFactusNumberingRangeSelection(
      {
        invoiceRangeId: required.invoiceRangeId,
        creditNoteRangeId: required.creditNoteRangeId,
      },
      adminUser,
      { billing }
    );
    const rangeSnapshot = await readNumberingRangeSnapshot();
    const candidate = {
      ...billing,
      dian: {
        ...(billing.dian || {}),
        enabled: true,
        mode: 'production',
        environment: '1',
      },
      dianResolution: {
        ...(billing.dianResolution || {}),
        ...(ranges.dianResolution || {}),
        numberingRangeId: required.invoiceRangeId,
        creditNoteNumberingRangeId: required.creditNoteRangeId,
        environment: '1',
      },
      electronicProvider: {
        ...(billing.electronicProvider || {}),
        provider: 'factus',
        numberingRangeId: required.invoiceRangeId,
        creditNoteNumberingRangeId: required.creditNoteRangeId,
      },
    };

    await assertProductionNumberingRangesReady(candidate);
    await updateBillingConfigurationWithReadiness(candidate, { adminUser });
    await reconcileNumberingRangeSnapshot(rangeSnapshot);

    const safeSettings = await getAdminSettingsWithBillingReadiness();
    const readiness = safeSettings?._billingReadiness || {};
    if (
      readiness.readyForProduction !== true ||
      normalizeMode(safeSettings?.billing?.dian?.mode) !== PRODUCTION_MODE
    ) {
      throw activationError(
        'El backend no confirmó todos los requisitos después de guardar la configuración.',
        'BILLING_CLIENT_ACTIVATION_FINAL_CHECK_FAILED',
        409,
        Array.isArray(readiness.blockers) ? readiness.blockers : []
      );
    }

    const runtime = buildRuntimeFactusConfig(candidate);
    const activationFingerprint = buildActivationFingerprint({
      runtime,
      companyNit: connection?.company?.nit,
      invoiceRangeId: required.invoiceRangeId,
      creditNoteRangeId: required.creditNoteRangeId,
      mailFrom: mail.fromEmail,
    });

    await markActivationSuccess(
      lock,
      {
        activationFingerprint,
        companyNit: connection?.company?.nit,
        invoiceRangeId: required.invoiceRangeId,
        creditNoteRangeId: required.creditNoteRangeId,
        mailFrom: mail.fromEmail,
      },
      adminUser
    );

    return {
      ok: true,
      status: 'active',
      message:
        'Facturación electrónica activada en Producción. Facturas y notas crédito quedaron vinculadas a los rangos oficiales del cliente.',
      activatedAt: new Date().toISOString(),
      company: connection.company,
      invoiceRange: ranges.invoiceRange,
      creditNoteRange: ranges.creditNoteRange,
      settings: await getAdminSettingsWithBillingReadiness(),
    };
  } catch (error) {
    await markActivationFailure(lock, error, adminUser);
    throw error;
  }
}

module.exports = {
  activateClientFactusProduction,
  buildActivationFingerprint,
  requireProductionCandidate,
};
