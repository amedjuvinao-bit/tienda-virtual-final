'use strict';

const { resolveShippingProvider } = require('../shippingProviderService');
const { clean } = require('./shared');

async function resolveProvider(input = {}, dependencies = {}) {
  return resolveShippingProvider(input.provider || 'envia', dependencies);
}

function normalizedActions(actions) {
  return [...new Set((Array.isArray(actions) ? actions : [])
    .map((action) => clean(action, 80).toLowerCase())
    .filter(Boolean))];
}

function persistedCarrierCapability(integration = {}, fallback = {}) {
  const carrierActions = normalizedActions(integration.carrierActions);
  return {
    carrierActions,
    ...(carrierActions.length ? { carrierActionsResolved: true } : {}),
    carrierId: clean(
      integration.selectedRate?.carrierId || fallback.carrierId,
      80
    ),
    countryCode: clean(fallback.countryCode, 10).toUpperCase(),
  };
}

async function resolveCarrierActions(provider, carrier, capability = {}) {
  const supplied = normalizedActions(capability.carrierActions);
  if (typeof capability.carrierActionsResolved === 'boolean') return supplied;
  if (typeof provider?.getCarrierActions !== 'function') return supplied;
  try {
    const actions = await provider.getCarrierActions(
      clean(carrier, 80).toLowerCase(),
      {
        carrierId: clean(capability.carrierId, 80),
        countryCode: clean(capability.countryCode, 10).toUpperCase(),
      }
    );
    return normalizedActions(actions);
  } catch (error) {
    if (capability.optional === true) return supplied;
    throw error;
  }
}

module.exports = {
  persistedCarrierCapability,
  resolveCarrierActions,
  resolveProvider,
};
