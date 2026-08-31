'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;
const PREPARATION_STALE_MS = 2 * 60 * 60 * 1000;
const TRANSIT_STALE_MS = 48 * 60 * 60 * 1000;
const SLA_RISK_MS = 24 * 60 * 60 * 1000;

const ACTIVE_SLA_STATUSES = Object.freeze([
  'ready_to_pick',
  'picking',
  'picked',
  'packing',
  'packed',
  'dispatched',
  'in_transit',
]);
const TRANSIT_STATUSES = Object.freeze(['dispatched', 'in_transit']);
const TERMINAL_ORDER_STATUSES = Object.freeze([
  'failed',
  'cancelled',
  'canceled',
  'delivered',
  'refunded',
]);

const DEFAULT_THRESHOLDS = Object.freeze({
  recentPaymentFailuresCritical: 10,
  stuckPreparationCritical: 20,
  queryLatencyWarningMs: 750,
  queryLatencyCriticalMs: 2500,
});

const SEVERITY_WEIGHT = Object.freeze({
  ok: 0,
  warning: 1,
  critical: 2,
});

module.exports = {
  ACTIVE_SLA_STATUSES,
  DAY_MS,
  DEFAULT_THRESHOLDS,
  PREPARATION_STALE_MS,
  SEVERITY_WEIGHT,
  SLA_RISK_MS,
  TERMINAL_ORDER_STATUSES,
  TRANSIT_STALE_MS,
  TRANSIT_STATUSES,
};
