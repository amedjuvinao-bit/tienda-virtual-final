'use strict';

// Adaptador de transición controlado: el motor histórico conserva toda su
// idempotencia, bloqueos, conciliación y persistencia, pero las llamadas
// fiscales usan únicamente configuración descifrada y rangos sincronizados.
const factusProvider = require('../lib/dian/providers/factusProvider');
const {
  sendCreditNoteToFactus,
} = require('../lib/dian/providers/factusRangeAwareProvider');
const {
  buildRuntimeFactusConfig,
} = require('../lib/billing/billingConfigurationSecurity');

const legacyGetInvoiceFromFactus = factusProvider.getInvoiceFromFactus;

function toPlain(value) {
  return value?.toObject
    ? value.toObject({ depopulate: true })
    : value && typeof value === 'object'
      ? value
      : {};
}

async function getInvoiceFromFactusSecure(data = {}) {
  const settings = toPlain(data.settings);
  const billing = toPlain(settings.billing);
  const providerConfig =
    billing?.dian?.mode && billing?.electronicProvider
      ? buildRuntimeFactusConfig(billing)
      : toPlain(data.providerConfig);

  return legacyGetInvoiceFromFactus({
    ...data,
    providerConfig,
  });
}

factusProvider.getInvoiceFromFactus = getInvoiceFromFactusSecure;
factusProvider.sendCreditNoteToFactus = sendCreditNoteToFactus;

module.exports = require('./electronicCreditNoteService');
