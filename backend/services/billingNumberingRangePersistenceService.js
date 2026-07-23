'use strict';

const SiteSettings = require('../models/SiteSettings');
const {
  buildFactusCredentialFingerprint,
  buildRuntimeFactusConfig,
} = require('../lib/billing/billingConfigurationSecurity');

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function cleanText(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

async function readNumberingRangeSnapshot() {
  const settings = await SiteSettings.findOne().lean();
  const provider = settings?.billing?.electronicProvider || {};
  const resolution = settings?.billing?.dianResolution || {};

  return {
    invoiceRangeId: positiveInteger(
      provider.numberingRangeId || resolution.numberingRangeId
    ),
    creditNoteRangeId: positiveInteger(
      provider.creditNoteNumberingRangeId ||
        resolution.creditNoteNumberingRangeId
    ),
    environment: cleanText(provider.numberingRangesEnvironment, 40),
    fingerprint: cleanText(provider.numberingRangesFingerprint, 128),
    syncedAt: provider.numberingRangesSyncedAt || null,
  };
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
  readNumberingRangeSnapshot,
  reconcileNumberingRangeSnapshot,
};
