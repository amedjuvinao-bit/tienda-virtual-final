'use strict';

const {
  consumeDigitalDeliveryAccess,
} = require('./orderFulfillment/consumeDigitalAccess');
const {
  buildDeterministicDeliveryId,
  buildDigitalAccessToken,
  buildDigitalAccessUrl,
  hashAccessToken,
  safeTokenMatch,
} = require('./orderFulfillment/digitalAccess');
const {
  processOrderFulfillmentAfterPayment,
} = require('./orderFulfillment/processAfterPayment');

module.exports = {
  buildDigitalAccessToken,
  hashAccessToken,
  safeTokenMatch,
  buildDeterministicDeliveryId,
  buildDigitalAccessUrl,
  processOrderFulfillmentAfterPayment,
  consumeDigitalDeliveryAccess,
};
