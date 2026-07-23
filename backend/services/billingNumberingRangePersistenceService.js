'use strict';

const SiteSettings = require('../models/SiteSettings');
const {
  BillingConfigurationError,
  PRODUCTION_MODE,
  buildFactusCredentialFingerprint,
  buildRuntimeFactusConfig,
  normalizeMode,
} = require('../lib/billing/billingConfigurationSecurity');
const {
  mergeCandidateBilling,
} = require('./billingNumberingRangeService');

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function cleanText(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function selectedRangeIds(billing = {}) {
  const provider = billing?.electronicProvider || {};
  const resolution = billing?.dianResolution || {};
  return {
    invoiceRangeId: positiveInteger(
      provider.numberingRangeId || resolution.numberingRangeId
    ),
    creditNoteRangeId: positiveInteger(
      provider.creditNoteNumberingRangeId ||
        resolution.creditNoteNumberingRangeId
    ),
  };
}

async function readNumberingRangeSnapshot() {
  const settings = await SiteSettings.findOne().lean();
  const provider = settings?.billing?.electronicProvider || {};
  const ids = selectedRangeIds(settings?.billing || {});

  return {
    ...ids,
    environment: cleanText(provider.numberingRangesEnvironment, 40),
    fingerprint: cleanText(provider.numberingRangesFingerprint, 128),
    syncedAt: provider.numberingRangesSyncedAt || null,
  };
}

async function assertProductionNumberingRangesReady(incomingBilling = {}) {
  const mode = normalizeMode(incomingBilling?.dian?.mode);
  if (mode !== PRODUCTION_MODE) return true;

  const settings = await SiteSettings.findOne().lean();
  if (!settings?._id) {
    throw new BillingConfigurationError(
      'No existe configuración persistida para verificar los rangos de Producción.',
      'BILLING_PRODUCTION_NUMBERING_SETTINGS_MISSING',
      409
    );
  }

  const storedBilling = settings?.billing || {};
  const provider = storedBilling?.electronicProvider || {};
  const candidate = mergeCandidateBilling(storedBilling, incomingBilling);
  const runtime = buildRuntimeFactusConfig(candidate);
  const fingerprint = buildFactusCredentialFingerprint(runtime);
  const storedIds = selectedRangeIds(storedBilling);
  const candidateIds = selectedRangeIds(candidate);
  const blockers = [];

  if (!(storedIds.invoiceRangeId > 0)) {
    blockers.push('rango oficial de facturas no sincronizado');
  }
  if (!(storedIds.creditNoteRangeId > 0)) {
    blockers.push('rango oficial de notas crédito no sincronizado');
  }
  if (candidateIds.invoiceRangeId !== storedIds.invoiceRangeId) {
    blockers.push('rango de facturas no coincide con la selección validada');
  }
  if (candidateIds.creditNoteRangeId !== storedIds.creditNoteRangeId) {
    blockers.push('rango de notas crédito no coincide con la selección validada');
  }
  if (provider.numberingRangesEnvironment !== 'production') {
    blockers.push('rangos no consultados en Producción');
  }
  if (provider.numberingRangesFingerprint !== fingerprint) {
    blockers.push('rangos no pertenecen a las credenciales actuales');
  }
  if (!provider.numberingRangesSyncedAt) {
    blockers.push('fecha de sincronización de rangos ausente');
  }
  if (provider.lastConnectionStatus !== 'success') {
    blockers.push('conexión Factus no verificada');
  }
  if (provider.lastConnectionEnvironment !== 'production') {
    blockers.push('conexión no verificada en Producción');
  }
  if (provider.lastConnectionFingerprint !== fingerprint) {
    blockers.push('credenciales cambiaron después de la verificación');
  }

  if (blockers.length) {
    throw new BillingConfigurationError(
      `No se puede activar Producción. Falta: ${blockers.join(', ')}.`,
      'BILLING_PRODUCTION_NUMBERING_RANGES_NOT_READY',
      409,
      blockers
    );
  }

  return true;
}

async function reconcileNumberingRangeSnapshot(snapshot = {}) {
  const settings = await SiteSettings.findOne();
  if (!settings?._id) return false;

  const billing = settings?.billing?.toObject
    ? settings.billing.toObject({ depopulate: true })
    : settings.billing || {};
  const provider = billing.electronicProvider || {};
  let runtime;

  try {
    runtime = buildRuntimeFactusConfig(billing);
  } catch {
    runtime = null;
  }

  const fingerprint = runtime
    ? buildFactusCredentialFingerprint(runtime)
    : '';
  const valid = Boolean(
    runtime &&
      snapshot.invoiceRangeId > 0 &&
      snapshot.creditNoteRangeId > 0 &&
      snapshot.environment === runtime.environment &&
      snapshot.fingerprint === fingerprint &&
      provider.lastConnectionStatus === 'success' &&
      provider.lastConnectionEnvironment === runtime.environment &&
      provider.lastConnectionFingerprint === fingerprint
  );

  const $set = valid
    ? {
        'billing.electronicProvider.numberingRangeId': snapshot.invoiceRangeId,
        'billing.electronicProvider.creditNoteNumberingRangeId':
          snapshot.creditNoteRangeId,
        'billing.electronicProvider.numberingRangesEnvironment':
          snapshot.environment,
        'billing.electronicProvider.numberingRangesFingerprint':
          snapshot.fingerprint,
        'billing.electronicProvider.numberingRangesSyncedAt':
          snapshot.syncedAt,
        'billing.dianResolution.numberingRangeId': snapshot.invoiceRangeId,
        'billing.dianResolution.creditNoteNumberingRangeId':
          snapshot.creditNoteRangeId,
      }
    : {
        'billing.electronicProvider.numberingRangeId': 0,
        'billing.electronicProvider.creditNoteNumberingRangeId': 0,
        'billing.electronicProvider.numberingRangesEnvironment': '',
        'billing.electronicProvider.numberingRangesFingerprint': '',
        'billing.electronicProvider.numberingRangesSyncedAt': null,
        'billing.dianResolution.numberingRangeId': 0,
        'billing.dianResolution.creditNoteNumberingRangeId': 0,
      };

  await SiteSettings.findByIdAndUpdate(
    settings._id,
    { $set },
    { runValidators: true, strict: false }
  );

  return valid;
}

module.exports = {
  assertProductionNumberingRangesReady,
  readNumberingRangeSnapshot,
  reconcileNumberingRangeSnapshot,
  selectedRangeIds,
};
