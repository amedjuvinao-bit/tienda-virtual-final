'use strict';

const { performance } = require('perf_hooks');

const Order = require('../../models/Order');
const {
  DAY_MS,
  DEFAULT_THRESHOLDS,
  PREPARATION_STALE_MS,
  SLA_RISK_MS,
  TRANSIT_STALE_MS,
} = require('./constants');
const { buildOrderHealthPipeline } = require('./metricsPipeline');
const {
  buildOperationalChecks,
  normalizeMetrics,
  normalizeOperational,
} = require('./operationalChecks');

function createOrderOperationalMonitoringService(overrides = {}) {
  const OrderModel = overrides.OrderModel || Order;
  const nowFactory = overrides.now || (() => new Date());
  const clock = overrides.clock || (() => performance.now());
  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(overrides.thresholds || {}),
  };

  async function getOperationalHealth({ filter = {} } = {}) {
    const now = new Date(nowFactory());
    const startedAt = clock();
    const aggregate = OrderModel.aggregate(
      buildOrderHealthPipeline(filter, now)
    );
    const rows =
      aggregate && typeof aggregate.allowDiskUse === 'function'
        ? await aggregate.allowDiskUse(true)
        : await aggregate;
    const queryDurationMs = Math.max(0, Number(clock() - startedAt));
    const row = rows?.[0] || {};
    const metrics = normalizeMetrics(row.metrics);
    const operational = normalizeOperational(row.operational);
    const state = buildOperationalChecks(
      metrics,
      queryDurationMs,
      thresholds
    );

    return {
      status: state.status,
      severity: state.severity,
      generatedAt: now,
      window: {
        startedAt: new Date(now.getTime() - DAY_MS),
        endedAt: now,
        hours: 24,
      },
      thresholds: {
        preparationStaleMinutes: PREPARATION_STALE_MS / 60_000,
        transitStaleHours: TRANSIT_STALE_MS / 3_600_000,
        slaRiskHours: SLA_RISK_MS / 3_600_000,
        ...thresholds,
      },
      performance: {
        queryDurationMs: Math.round(queryDurationMs * 100) / 100,
      },
      metrics,
      operational,
      checks: state.checks,
      alerts: state.alerts,
    };
  }

  return { getOperationalHealth };
}

module.exports = {
  createOrderOperationalMonitoringService,
};
