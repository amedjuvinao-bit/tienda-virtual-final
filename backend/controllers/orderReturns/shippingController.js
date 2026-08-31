'use strict';

const {
  cancelOrderReturnLabel,
  confirmOrderReturnDropoff,
  generateOrderReturnLabel,
  quoteOrderReturnShipping,
  scheduleOrderReturnPickup,
  syncOrderReturnTracking,
  testOrderReturnShippingWebhook,
} = require('../../services/orderReturnShippingService');
const {
  buildAccess,
  returnCreationIdempotencyKey,
  sendAccessError,
  sendServiceError,
  wholeOrderAccessOptions,
} = require('./shared');

function shippingInput(req) {
  return {
    returnId: req.params.returnId,
    expectedRevision: req.body?.expectedRevision,
    destinationBranchId: req.body?.destinationBranchId,
    packages: req.body?.packages,
    rate: req.body?.rate,
    provider: req.body?.provider || 'envia',
    pickupDate: req.body?.pickupDate,
    pickupTimeStart: req.body?.pickupTimeStart,
    pickupTimeEnd: req.body?.pickupTimeEnd,
    pickupInstructions: req.body?.pickupInstructions,
    webhookStatus: req.body?.status,
    confirmStorePaidShipping: req.body?.confirmStorePaidShipping === true,
    confirmProductionCharge: req.body?.confirmProductionCharge === true,
    idempotencyKey: returnCreationIdempotencyKey(req),
  };
}

function shippingHandler(service) {
  return async function handleReturnShipping(req, res) {
    try {
      const access = buildAccess(req, req.params.id, wholeOrderAccessOptions());
      if (!access.ok) return sendAccessError(res, access);
      const result = await service({
        ...shippingInput(req),
        orderFilter: access.filter,
      });
      return res.json(result);
    } catch (error) {
      return sendServiceError(res, error);
    }
  };
}

const postReturnShippingRates = shippingHandler(quoteOrderReturnShipping);
const postReturnShippingLabel = shippingHandler(generateOrderReturnLabel);
const postReturnShippingTrackingSync = shippingHandler(syncOrderReturnTracking);
const postReturnShippingWebhookTest = shippingHandler(testOrderReturnShippingWebhook);
const postReturnShippingPickup = shippingHandler(scheduleOrderReturnPickup);
const postReturnShippingDropoff = shippingHandler(confirmOrderReturnDropoff);
const postReturnShippingLabelCancel = shippingHandler(cancelOrderReturnLabel);

module.exports = {
  postReturnShippingDropoff,
  postReturnShippingLabel,
  postReturnShippingLabelCancel,
  postReturnShippingPickup,
  postReturnShippingRates,
  postReturnShippingTrackingSync,
  postReturnShippingWebhookTest,
};
