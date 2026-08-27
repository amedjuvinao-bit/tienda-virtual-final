'use strict';

const { resolveShippingProvider } = require('../shippingProviderService');
const { clean } = require('./shared');

async function resolveProvider(input = {}, dependencies = {}) {
  return resolveShippingProvider(input.provider || 'envia', dependencies);
}

async function resolveCarrierActions(provider, carrier) {
  if (typeof provider?.getCarrierActions !== 'function') return [];
  const actions = await provider.getCarrierActions(clean(carrier, 80).toLowerCase());
  return [...new Set((Array.isArray(actions) ? actions : [])
    .map((action) => clean(action, 80).toLowerCase())
    .filter(Boolean))];
}

module.exports = {
  resolveCarrierActions,
  resolveProvider,
};
