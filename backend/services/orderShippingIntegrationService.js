'use strict';

const {
  buildEnviaShipmentPayload,
  normalizeGeneratedLabel,
  normalizeRate,
} = require('./shippingPayloadService');
const { resolveShippingAddresses } = require('./orderShipping/addressResolution');
const {
  cancelOrderShipmentLabel,
  generateOrderShipmentLabel,
} = require('./orderShipping/labelOperations');
const {
  buildStandalonePickupPayload,
  pickupOnGeneratePayload,
} = require('./orderShipping/pickupPayloads');
const {
  confirmOrderShipmentDropoff,
  scheduleOrderShipmentPickup,
} = require('./orderShipping/pickupOperations');
const { quoteOrderShipment } = require('./orderShipping/rateOperations');
const {
  syncOrderShipmentTracking,
  testOrderShipmentWebhook,
} = require('./orderShipping/trackingOperations');

// Fachada estable: los consumidores conservan exactamente el mismo contrato público.
module.exports = {
  buildEnviaShipmentPayload,
  normalizeRate,
  normalizeGeneratedLabel,
  resolveColombiaAddresses: resolveShippingAddresses,
  resolveShippingAddresses,
  pickupOnGeneratePayload,
  buildStandalonePickupPayload,
  quoteOrderShipment,
  generateOrderShipmentLabel,
  syncOrderShipmentTracking,
  testOrderShipmentWebhook,
  scheduleOrderShipmentPickup,
  confirmOrderShipmentDropoff,
  cancelOrderShipmentLabel,
};
