'use strict';

const OrderReturn = require('../../models/OrderReturn');
const {
  testOrderReturnShippingWebhook,
} = require('../../services/orderReturnShippingService');
const { poll, wait } = require('./polling');

const RETRY_DELAYS_MS = Object.freeze([5_000, 10_000, 20_000, 30_000]);

async function retryOfficialWebhook(input = {}) {
  const delays = input.retryDelaysMs || RETRY_DELAYS_MS;
  const waitFn = input.waitFn || wait;
  let lastError;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    if (await input.confirmed()) return { alreadyConfirmed: true };
    try {
      return await input.request();
    } catch (error) {
      lastError = error;
      if (
        error?.code !== 'SHIPPING_WEBHOOK_TEST_PROVIDER_ERROR' ||
        attempt >= delays.length
      ) throw error;
      await waitFn(delays[attempt]);
    }
  }
  throw lastError;
}

async function freshReturn(returnId) {
  return OrderReturn.findById(returnId);
}

async function requestEvent(order, returnCase, status, matches) {
  await retryOfficialWebhook({
    confirmed: async () => matches(await freshReturn(returnCase._id)),
    request: () => testOrderReturnShippingWebhook({
      orderFilter: { _id: order._id },
      returnId: returnCase._id,
      expectedRevision: returnCase.revision,
      provider: 'envia',
      webhookStatus: status,
    }),
  });
}

async function ensureCarrierJourney(order, sourceReturn) {
  let returnCase = sourceReturn;
  if (returnCase.status === 'authorized') {
    const pickedUp = (value) => value?.status === 'in_transit';
    await requestEvent(order, returnCase, 'Picked Up', pickedUp);
    returnCase = await poll(
      'La recogida RMA',
      () => freshReturn(returnCase._id),
      pickedUp
    );
  }
  if (!returnCase.shipping?.carrierDeliveredAt) {
    const delivered = (value) => Boolean(value?.shipping?.carrierDeliveredAt);
    await requestEvent(order, returnCase, 'Delivered', delivered);
    returnCase = await poll(
      'La llegada RMA a la sede',
      () => freshReturn(returnCase._id),
      delivered
    );
  }
  return returnCase;
}

module.exports = { ensureCarrierJourney, retryOfficialWebhook };
