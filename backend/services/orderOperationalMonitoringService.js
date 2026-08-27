'use strict';

const {
  DAY_MS,
  DEFAULT_THRESHOLDS,
  PREPARATION_STALE_MS,
  SLA_RISK_MS,
  TRANSIT_STALE_MS,
} = require('./orderOperationalMonitoring/constants');
const {
  buildOrderHealthMetricsPipeline,
  buildOrderHealthPipeline,
} = require('./orderOperationalMonitoring/metricsPipeline');
const {
  buildOperationalChecks,
} = require('./orderOperationalMonitoring/operationalChecks');
const {
  createOrderOperationalMonitoringService,
} = require('./orderOperationalMonitoring/service');

const defaultService = createOrderOperationalMonitoringService();

module.exports = {
  DAY_MS,
  DEFAULT_THRESHOLDS,
  PREPARATION_STALE_MS,
  SLA_RISK_MS,
  TRANSIT_STALE_MS,
  buildOperationalChecks,
  buildOrderHealthMetricsPipeline,
  buildOrderHealthPipeline,
  createOrderOperationalMonitoringService,
  getOperationalHealth: defaultService.getOperationalHealth,
};
