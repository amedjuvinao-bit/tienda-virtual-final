'use strict';

const {
  DEFAULT_THRESHOLDS,
  SEVERITY_WEIGHT,
} = require('./constants');

function numberValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function buildCheck({
  code,
  label,
  count,
  warning = false,
  critical = false,
  okMessage,
  warningMessage,
  criticalMessage,
}) {
  const severity = critical ? 'critical' : warning ? 'warning' : 'ok';
  return {
    code,
    label,
    severity,
    count: numberValue(count),
    message:
      severity === 'critical'
        ? criticalMessage
        : severity === 'warning'
          ? warningMessage
          : okMessage,
  };
}

function summarizeStatus(checks) {
  const severity = checks.reduce(
    (current, check) =>
      SEVERITY_WEIGHT[check.severity] > SEVERITY_WEIGHT[current]
        ? check.severity
        : current,
    'ok'
  );

  return {
    severity,
    status:
      severity === 'critical'
        ? 'critical'
        : severity === 'warning'
          ? 'degraded'
          : 'healthy',
  };
}

function buildOperationalChecks(
  metrics,
  queryDurationMs,
  thresholds = DEFAULT_THRESHOLDS
) {
  const checks = [
    buildCheck({
      code: 'ORDER_PAYMENT_FAILURES',
      label: 'Fallos de pago recientes',
      count: metrics.recentPaymentFailures,
      critical:
        metrics.recentPaymentFailures >=
        thresholds.recentPaymentFailuresCritical,
      warning: metrics.recentPaymentFailures > 0,
      okMessage: 'No hay pagos fallidos en las últimas 24 horas.',
      warningMessage: `${metrics.recentPaymentFailures} orden(es) registran un fallo de pago reciente.`,
      criticalMessage: `${metrics.recentPaymentFailures} órdenes superan el umbral crítico de fallos de pago.`,
    }),
    buildCheck({
      code: 'ORDER_PREPARATION_BACKLOG',
      label: 'Preparación logística pendiente',
      count: metrics.stuckPreparation,
      critical:
        metrics.stuckPreparation >= thresholds.stuckPreparationCritical,
      warning: metrics.stuckPreparation > 0,
      okMessage: 'No hay órdenes pagadas retenidas antes de preparar.',
      warningMessage: `${metrics.stuckPreparation} orden(es) pagadas llevan más de dos horas sin preparar.`,
      criticalMessage: `${metrics.stuckPreparation} órdenes pagadas superan el umbral crítico de preparación.`,
    }),
    buildCheck({
      code: 'ORDER_LOGISTICS_INCIDENTS',
      label: 'Incidencias logísticas abiertas',
      count: metrics.openIncidentOrders,
      critical: metrics.criticalIncidentOrders > 0,
      warning: metrics.openIncidentOrders > 0,
      okMessage: 'No hay incidencias logísticas abiertas.',
      warningMessage: `${metrics.openIncidentOrders} orden(es) tienen incidencias logísticas abiertas.`,
      criticalMessage: `${metrics.criticalIncidentOrders} orden(es) tienen incidencias logísticas de severidad alta o crítica.`,
    }),
    buildCheck({
      code: 'ORDER_LOGISTICS_SLA',
      label: 'Compromisos logísticos SLA',
      count: metrics.slaBreachedOrders + metrics.slaRiskOrders,
      critical: metrics.slaBreachedOrders > 0,
      warning: metrics.slaRiskOrders > 0,
      okMessage: 'No hay compromisos SLA vencidos o en riesgo.',
      warningMessage: `${metrics.slaRiskOrders} orden(es) tienen un SLA que vence dentro de 24 horas.`,
      criticalMessage: `${metrics.slaBreachedOrders} orden(es) tienen un SLA vencido.`,
    }),
    buildCheck({
      code: 'ORDER_STALE_TRANSIT',
      label: 'Envíos sin actualización',
      count: metrics.staleTransitOrders,
      warning: metrics.staleTransitOrders > 0,
      okMessage: 'No hay envíos en tránsito sin actualización prolongada.',
      warningMessage: `${metrics.staleTransitOrders} orden(es) llevan más de 48 horas en tránsito sin actualización.`,
      criticalMessage: '',
    }),
    buildCheck({
      code: 'ORDER_MONITORING_LATENCY',
      label: 'Latencia del diagnóstico',
      count: Math.round(queryDurationMs),
      critical: queryDurationMs >= thresholds.queryLatencyCriticalMs,
      warning: queryDurationMs >= thresholds.queryLatencyWarningMs,
      okMessage:
        'El diagnóstico operativo responde dentro del umbral esperado.',
      warningMessage: `El diagnóstico tardó ${Math.round(queryDurationMs)} ms.`,
      criticalMessage: `El diagnóstico tardó ${Math.round(queryDurationMs)} ms y superó el umbral crítico.`,
    }),
  ];

  return {
    checks,
    alerts: checks.filter((check) => check.severity !== 'ok'),
    ...summarizeStatus(checks),
  };
}

function normalizeMetrics(row = {}) {
  return {
    totalOrders: numberValue(row.totalOrders),
    recentPaymentFailures: numberValue(row.recentPaymentFailures),
    stuckPreparation: numberValue(row.stuckPreparation),
    openIncidentOrders: numberValue(row.openIncidentOrders),
    criticalIncidentOrders: numberValue(row.criticalIncidentOrders),
    slaBreachedOrders: numberValue(row.slaBreachedOrders),
    slaRiskOrders: numberValue(row.slaRiskOrders),
    staleTransitOrders: numberValue(row.staleTransitOrders),
  };
}

function normalizeOperational(row = {}) {
  return Object.fromEntries(
    [
      'total',
      'attention',
      'awaitingPayment',
      'prepare',
      'dispatch',
      'transit',
      'incidents',
      'slaRisk',
      'completed',
    ].map((key) => [key, numberValue(row[key])])
  );
}

module.exports = {
  buildOperationalChecks,
  normalizeMetrics,
  normalizeOperational,
};
