'use strict';

const {
  createPaymentConfigurationAuthority,
  normalizePaymentsConfig,
} = require('./paymentConfigurationAuthorityService');

function trimSafe(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

async function executeLean(query) {
  let current = query;
  if (current && typeof current.lean === 'function') current = current.lean();
  if (current && typeof current.exec === 'function') return current.exec();
  return current;
}

function createPaymentRouteConfigurationService({ SiteSettingsModel } = {}) {
  if (!SiteSettingsModel || typeof SiteSettingsModel.findOne !== 'function') {
    throw new TypeError('PAYMENT_SITE_SETTINGS_MODEL_REQUIRED');
  }

  async function getSiteSettingsDoc() {
    const doc = await executeLean(SiteSettingsModel.findOne());
    return doc || null;
  }

  const authority = createPaymentConfigurationAuthority({
    SiteSettingsModel,
  });

  return Object.freeze({
    getActivePaymentsConfig: authority.getActivePaymentsConfig,
    getSiteSettingsDoc,
  });
}

module.exports = {
  createPaymentRouteConfigurationService,
  normalizePaymentsConfig,
  trimSafe,
};
