'use strict';

const { buildEnviaShipmentPayload, normalizeRate } = require('../shippingPayloadService');
const { resolveShippingAddresses } = require('./addressResolution');
const { integrationResponse, loadContext } = require('./integrationState');
const { resolveCarrierActions, resolveProvider } = require('./providerAdapter');
const { clean } = require('./shared');

async function quoteOrderShipment(input = {}, dependencies = {}) {
  const provider = await resolveProvider(input, dependencies);
  const { order, shipment, branch, scope } = await loadContext(
    input,
    dependencies
  );
  const payload = await resolveShippingAddresses(
    provider,
    buildEnviaShipmentPayload({
      order,
      shipment,
      branch,
      customsPolicy: provider.customsPolicy,
    })
  );
  const data = await provider.quote(payload);
  const normalizedRates = data.map((item) => normalizeRate(item));
  const actionsByCarrier = new Map();
  await Promise.all(
    [...new Set(normalizedRates.map((rate) => clean(rate.carrier, 80).toLowerCase()).filter(Boolean))]
      .map(async (carrier) => {
        const rate = normalizedRates.find(
          (candidate) => clean(candidate.carrier, 80).toLowerCase() === carrier
        ) || {};
        try {
          const actions = await resolveCarrierActions(provider, carrier, {
            ...rate,
            countryCode: payload.origin?.country,
          });
          actionsByCarrier.set(carrier, {
            actions: [...new Set((Array.isArray(actions) ? actions : [])
              .map((action) => clean(action, 80).toLowerCase())
              .filter(Boolean))],
            resolved: true,
          });
        } catch {
          actionsByCarrier.set(carrier, { actions: [], resolved: false });
        }
      })
  );
  const rates = normalizedRates.map((rate) => {
    const capability = actionsByCarrier.get(clean(rate.carrier, 80).toLowerCase()) || {
      actions: [],
      resolved: false,
    };
    return {
      ...rate,
      carrierActions: capability.actions,
      carrierActionsResolved: capability.resolved,
    };
  });
  return integrationResponse(order, shipment, { rates }, scope);
}

module.exports = {
  quoteOrderShipment,
};
