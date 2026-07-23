'use strict';

const crypto = require('crypto');
const MailSettings = require('../models/MailSettings');
const BillingActivationState = require('../models/BillingActivationState');
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

function fail(message, code, status = 409, details = []) {
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
  if (provider !== 'factus') blockers.push('seleccionar Factus como proveedor');
  if (!(invoiceRangeId > 0)) {
    blockers.push('seleccionar un rango oficial de facturas');
  }
  if (!(creditNoteRangeId > 0)) {
    blockers.push('seleccionar un rango oficial de notas crédito');
  }

  if (blockers.length) {
    throw fail(
      `No se puede activar Producción. Falta: ${blockers.join(', ')}.`,
      'BILLING_CLIENT_ACTIVATION_INCOMPLETE',
      422,
      blockers
    );
  }

  return { invoiceRangeId, creditNoteRangeId };
}

async function assertMailReady() {
  const mail = await MailSettings.findOne({ key: 'main' })
    .select('+smtpPasswordEncrypted')
    .lean();
  const blockers = [];

  if (mail?.enabled !== true) blockers.push('activar el correo transaccional');
  if (!cleanText(mail?.fromEmail, 180)) blockers.push('configurar el remitente');
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
    throw fail(
      `No se puede activar Producción. Falta: ${blockers.join(', ')}.`,
      'BILLING_CLIENT_ACTIVATION_MAIL_NOT_READY',
      409,
      blockers
    );
  }

  return {
    fromEmail: cleanText(mail.fromEmail, 180).toLowerCase(),
    testedAt: mail.lastTestAt || null,
  };
}

async function acquireLock(adminUser) {
  await BillingActivationState.getSingleton();
  const now = new Date();
  const token = crypto.randomUUID();
  const lockExpiresAt = new Date(now.getTime() + ACTIVATION_LOCK_MS);
  const state = await BillingActivationState.findOneAndUpdate(
    {
      key: 'main',
      $or: [
        { lockExpiresAt: { $exists: false } },
        { lockExpiresAt: null },
        { lockExpiresAt: { $lt: now } },
      ],
    },
    {
      $set: {
        status: 'activating',
        lockToken: token,
        lockExpiresAt,
        lastAttemptAt: now,
        lastAttemptBy: adminUser,
        lastErrorCode: '',
        lastErrorMessage: '',
      },
    },
    { new: true }
  ).select('+lockToken');

  if (!state) {
    throw fail(
      'Ya existe una activación de Factus en curso. Espera a que termine antes de volver a intentarlo.',
      'BILLING_CLIENT_ACTIVATION_IN_PROGRESS',
      409
    );
  }

  return token;
}

async function markFailure(token, error, adminUser) {
  await BillingActivationState.findOneAndUpdate(
    { key: 'main', lockToken: token },
    {
      $set: {
        status: 'error',
        lastAttemptAt: new Date(),
        lastAttemptBy: adminUser,
        lastErrorCode: cleanText(
          error?.code || 'BILLING_CLIENT_ACTIVATION_ERROR',
          120
        ),
        lastErrorMessage: cleanText(
          error?.message || 'No fue posible activar Factus en Producción.',
          500
        ),
        lockExpiresAt: null,
      },
      $unset: { lockToken: '' },
    },
    { new: true }
  ).catch(() => null);
}

async function markSuccess(token, metadata, adminUser) {
  const now = new Date();
  const state = await BillingActivationState.findOneAndUpdate(
    { key: 'main', lockToken: token },
    {
      $set: {
        status: 'active',
        provider: 'factus',
        environment: 'production',
        activatedAt: now,
        activatedBy: adminUser,
        lastAttemptAt: now,
        lastAttemptBy: adminUser,
        activationFingerprint: metadata.activationFingerprint,
        companyNit: cleanText(metadata.companyNit, 30),
        invoiceRangeId: metadata.invoiceRangeId,
        creditNoteRangeId: metadata.creditNoteRangeId,
        mailFrom: cleanText(metadata.mailFrom, 180).toLowerCase(),
        lastErrorCode: '',
        lastErrorMessage: '',
        lockExpiresAt: null,
      },
      $unset: { lockToken: '' },
    },
    { new: true }
  );

  if (!state) {
    throw fail(
      'La validación terminó, pero no fue posible confirmar el estado final de activación.',
      'BILLING_CLIENT_ACTIVATION_CONFIRMATION_FAILED',
      500
    );
  }

  return state;
}

function buildActivationFingerprint({
  runtime,
  companyNit,
  invoiceRangeId,
  creditNoteRangeId,
  mailFrom,
}) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        credentialFingerprint: buildFactusCredentialFingerprint(runtime),
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
  const lockToken = await acquireLock(adminUser);

  try {
    const mail = await assertMailReady();
    const connection = await testFactusConnectionWithIdentity(
      { billing },
      { adminUser }
    );

    if (connection.environment !== 'production') {
      throw fail(
        'La conexión verificada no corresponde al ambiente de Producción.',
        'BILLING_CLIENT_ACTIVATION_WRONG_ENVIRONMENT',
        409
      );
    }

    const ranges = await saveFactusNumberingRangeSelection(
      required,
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

    const settings = await getAdminSettingsWithBillingReadiness();
    const readiness = settings?._billingReadiness || {};
    if (
      readiness.readyForProduction !== true ||
      normalizeMode(settings?.billing?.dian?.mode) !== PRODUCTION_MODE
    ) {
      throw fail(
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
    const state = await markSuccess(
      lockToken,
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
      status: state.status,
      message:
        'Facturación electrónica activada en Producción. Facturas y notas crédito quedaron vinculadas a los rangos oficiales del cliente.',
      activatedAt: state.activatedAt,
      company: connection.company,
      invoiceRange: ranges.invoiceRange,
      creditNoteRange: ranges.creditNoteRange,
      settings: await getAdminSettingsWithBillingReadiness(),
    };
  } catch (error) {
    await markFailure(lockToken, error, adminUser);
    throw error;
  }
}

async function getClientActivationState() {
  const state = await BillingActivationState.getSingleton();
  return {
    status: state.status,
    provider: state.provider,
    environment: state.environment,
    activatedAt: state.activatedAt,
    activatedBy: state.activatedBy,
    lastAttemptAt: state.lastAttemptAt,
    lastAttemptBy: state.lastAttemptBy,
    companyNit: state.companyNit,
    invoiceRangeId: state.invoiceRangeId,
    creditNoteRangeId: state.creditNoteRangeId,
    mailFrom: state.mailFrom,
    lastErrorCode: state.lastErrorCode,
    lastErrorMessage: state.lastErrorMessage,
  };
}

module.exports = {
  activateClientFactusProduction,
  buildActivationFingerprint,
  getClientActivationState,
  requireProductionCandidate,
};
