'use strict';

const SHIPMENT_ACTIONS = Object.freeze({
  start_picking: { from: ['ready_to_pick'], to: 'picking' },
  complete_picking: { from: ['picking'], to: 'picked' },
  start_packing: { from: ['picked'], to: 'packing' },
  complete_packing: { from: ['packing'], to: 'packed' },
  dispatch: { from: ['packed'], to: 'dispatched' },
  mark_in_transit: { from: ['dispatched'], to: 'in_transit' },
  deliver: { from: ['dispatched', 'in_transit'], to: 'delivered' },
});

const ACTIVE_LOGISTICS_STATUSES = new Set([
  'picking',
  'picked',
  'packing',
  'packed',
  'dispatched',
  'in_transit',
]);

const DISPATCHED_LOGISTICS_STATUSES = new Set([
  'dispatched',
  'in_transit',
  'delivered',
]);

const TERMINAL_LOGISTICS_STATUSES = new Set(['delivered', 'cancelled']);

const MAX_SHIPMENT_HISTORY = 100;
const MAX_SHIPMENT_INCIDENTS = 30;
const MAX_PACKAGES = 20;

module.exports = {
  SHIPMENT_ACTIONS,
  ACTIVE_LOGISTICS_STATUSES,
  DISPATCHED_LOGISTICS_STATUSES,
  TERMINAL_LOGISTICS_STATUSES,
  MAX_SHIPMENT_HISTORY,
  MAX_SHIPMENT_INCIDENTS,
  MAX_PACKAGES,
};
