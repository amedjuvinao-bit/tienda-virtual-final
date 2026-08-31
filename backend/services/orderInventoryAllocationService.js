'use strict';

// Stable public facade for the order-inventory-allocation domain.

const {
  allocationIdentity,
  getAllocationStatus,
  normalizeAllocation,
} = require('./orderInventoryAllocation/normalization');
const {
  summarizeInventoryAllocations,
} = require('./orderInventoryAllocation/summary');
const {
  applyReservationToOrderDocument,
} = require('./orderInventoryAllocation/reservationMapping');
const {
  syncOrderInventoryAllocationsFromReservation,
  hydrateOrderInventoryAllocations,
} = require('./orderInventoryAllocation/repository');
const {
  advanceOrderInventoryAllocations,
  advanceOrderInventoryAllocationsForShipment,
} = require('./orderInventoryAllocation/fulfillment');
const {
  applyReturnsToOrderInventoryAllocations,
} = require('./orderInventoryAllocation/returns');

module.exports = {
  allocationIdentity,
  getAllocationStatus,
  normalizeAllocation,
  summarizeInventoryAllocations,
  applyReservationToOrderDocument,
  syncOrderInventoryAllocationsFromReservation,
  hydrateOrderInventoryAllocations,
  advanceOrderInventoryAllocations,
  advanceOrderInventoryAllocationsForShipment,
  applyReturnsToOrderInventoryAllocations,
};
