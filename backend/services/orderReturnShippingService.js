'use strict';

const {
  cancelOrderReturnLabel,
  confirmOrderReturnDropoff,
  scheduleOrderReturnPickup,
  syncOrderReturnTracking,
  testOrderReturnShippingWebhook,
} = require('./orderReturnShipping/handoffAndTracking');
const {
  generateOrderReturnLabel,
  quoteOrderReturnShipping,
} = require('./orderReturnShipping/ratesAndLabel');

module.exports = {
  cancelOrderReturnLabel,
  confirmOrderReturnDropoff,
  generateOrderReturnLabel,
  quoteOrderReturnShipping,
  scheduleOrderReturnPickup,
  syncOrderReturnTracking,
  testOrderReturnShippingWebhook,
};
