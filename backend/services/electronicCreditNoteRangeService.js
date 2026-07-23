'use strict';

// Adaptador de transición controlado: el motor histórico conserva toda su
// idempotencia, bloqueos, conciliación y persistencia, pero la llamada fiscal
// usa exclusivamente el rango de nota crédito previamente sincronizado.
const factusProvider = require('../lib/dian/providers/factusProvider');
const {
  sendCreditNoteToFactus,
} = require('../lib/dian/providers/factusRangeAwareProvider');

factusProvider.sendCreditNoteToFactus = sendCreditNoteToFactus;

module.exports = require('./electronicCreditNoteService');
