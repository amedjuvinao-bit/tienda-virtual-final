// Stable public facade for the inventory-reservation domain.

const {
  DEFAULT_RESERVATION_MINUTES,
  PAYMENT_FAILURE_RELEASE_PREFIX,
} = require('./inventoryReservation/constants');
const {
  buildPaymentFailureReleaseReason,
  createServiceError,
  normalizePaymentReferenceIdentity,
  parsePaymentFailureReleaseReason,
} = require('./inventoryReservation/support');
const {
  buildStockVariantFilter,
  getAvailableFromStock,
} = require('./inventoryReservation/itemNormalization');
const {
  buildReleaseStockUpdate,
  resolveReservationStockVariant,
} = require('./inventoryReservation/stockUpdates');
const {
  allocateReservationItems,
  releaseReservedItems,
} = require('./inventoryReservation/stockReservation');
const { expandReservableItems } = require('./inventoryReservation/catalog');
const {
  createInventoryReservation,
} = require('./inventoryReservation/createReservation');
const {
  confirmInventoryReservation,
} = require('./inventoryReservation/confirmReservation');
const {
  reconcilePaymentFailureReservation,
  releaseInventoryReservation,
} = require('./inventoryReservation/releaseReservation');
const {
  expireInventoryReservations,
} = require('./inventoryReservation/expireReservations');

module.exports = {
  DEFAULT_RESERVATION_MINUTES,
  PAYMENT_FAILURE_RELEASE_PREFIX,
  buildPaymentFailureReleaseReason,
  buildStockVariantFilter,
  createInventoryReservation,
  confirmInventoryReservation,
  reconcilePaymentFailureReservation,
  releaseInventoryReservation,
  expireInventoryReservations,
  allocateReservationItems,
  expandReservableItems,
  releaseReservedItems,
  resolveReservationStockVariant,
  buildReleaseStockUpdate,
  parsePaymentFailureReleaseReason,
  createServiceError,
  getAvailableFromStock,
  normalizePaymentReferenceIdentity,
};
