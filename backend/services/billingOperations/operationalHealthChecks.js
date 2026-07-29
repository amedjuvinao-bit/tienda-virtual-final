'use strict';

const { redactText } = require('../billingOperationalLogger');

const DEFAULT_WORKER_INTERVAL_MS = 60 * 1000;
const SEVERITY_WEIGHT = {
  ok: 0,
  warning: 1,
  critical: 2,
};

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function cleanText(value, max = 300) {
  return redactText(value, max).replace(/\s+/g, ' ');
}

function buildCheck({
  code,
  label,
  count = 0,
  warning = false,
  critical = false,
  okMessage,
  warningMessage,
  criticalMessage,
}) {
  const severity = critical ? 'critical' : warning ? 'warning' : 'ok';
  const message =
    severity === 'critical'
      ? criticalMessage
      : severity === 'warning'
        ? warningMessage
        : okMessage;

  return {
    code,
    label,
    severity,
    count: Math.max(0, Number(count || 0)),
    message: cleanText(message, 360),
  };
}

function summarizeStatus(checks) {
  const highest = checks.reduce(
    (current, check) =>
      SEVERITY_WEIGHT[check.severity] > SEVERITY_WEIGHT[current]
        ? check.severity
        : current,
    'ok'
  );

  return {
    severity: highest,
    status:
      highest === 'critical'
        ? 'critical'
        : highest === 'warning'
          ? 'degraded'
          : 'healthy',
  };
}

function buildWorkerCheck(runtime, now) {
  const intervalMs = Math.max(
    1000,
    Number(runtime?.intervalMs || DEFAULT_WORKER_INTERVAL_MS)
  );
  const startedAt = toDate(runtime?.workerStartedAt);
  const lastSuccessAt = toDate(runtime?.lastSuccessAt);
  const currentCycleStartedAt = toDate(runtime?.currentCycleStartedAt);
  const lastFailureAt = toDate(runtime?.lastFailureAt);
  const staleAfterMs = intervalMs * 3;
  const workerNeverStarted = runtime?.workerStarted !== true;
  const startupExpired =
    startedAt &&
    !lastSuccessAt &&
    now.getTime() - startedAt.getTime() > staleAfterMs;
  const successExpired =
    lastSuccessAt &&
    now.getTime() - lastSuccessAt.getTime() > staleAfterMs;
  const cycleStuck =
    runtime?.running === true &&
    currentCycleStartedAt &&
    now.getTime() - currentCycleStartedAt.getTime() > staleAfterMs;
  const failedAfterSuccess =
    lastFailureAt &&
    (!lastSuccessAt || lastFailureAt.getTime() > lastSuccessAt.getTime());
  const critical =
    workerNeverStarted || startupExpired || successExpired || cycleStuck;

  return buildCheck({
    code: 'BILLING_RECOVERY_WORKER',
    label: 'Worker de recuperación fiscal',
    count: Number(runtime?.failures || 0),
    critical,
    warning: !critical && Boolean(failedAfterSuccess),
    okMessage: lastSuccessAt
      ? 'El worker de recuperación fiscal está ejecutando ciclos normalmente.'
      : 'El worker de recuperación fiscal está iniciando.',
    warningMessage:
      runtime?.lastErrorMessage ||
      'El último ciclo del worker falló y todavía no registra una recuperación posterior.',
    criticalMessage: workerNeverStarted
      ? 'El worker de recuperación fiscal no está iniciado.'
      : cycleStuck
        ? 'El worker de recuperación fiscal tiene un ciclo bloqueado.'
        : 'El worker de recuperación fiscal dejó de completar ciclos dentro del tiempo esperado.',
  });
}

function buildOperationalChecks({ data, runtimeSnapshot, now }) {
  const activationAttemptAt = toDate(
    data.activation?.lastAttemptAt || data.activation?.updatedAt
  );
  const activationStuck =
    data.activation?.status === 'activating' &&
    (
      !activationAttemptAt ||
      activationAttemptAt.getTime() <= data.activationStaleBefore.getTime()
    );
  const recentFailures =
    data.recentInvoiceFailures + data.recentCreditNoteFailures;

  const checks = [
    buildWorkerCheck(runtimeSnapshot, now),
    buildCheck({
      code: 'BILLING_STALE_INVOICES',
      label: 'Emisiones pendientes',
      count: data.staleInvoices,
      critical: data.staleInvoices > 0,
      okMessage: 'No hay emisiones fiscales trabadas.',
      criticalMessage: `${data.staleInvoices} emisión(es) superaron el tiempo de recuperación esperado.`,
    }),
    buildCheck({
      code: 'BILLING_RECOVERY_BACKLOG',
      label: 'Cola de conciliación',
      count: data.activeRecoveries,
      critical: data.stuckRecoveries > 0,
      warning: data.overdueRecoveries > 0 || data.failedRecoveries > 0,
      okMessage:
        data.activeRecoveries > 0
          ? 'La cola de conciliación está programada y dentro de su tiempo.'
          : 'No hay conciliaciones fiscales pendientes.',
      warningMessage: `${data.overdueRecoveries} conciliación(es) están vencidas y ${data.failedRecoveries} registran fallo.`,
      criticalMessage: `${data.stuckRecoveries} conciliación(es) conservan un bloqueo vencido.`,
    }),
    buildCheck({
      code: 'BILLING_RECENT_FAILURES',
      label: 'Errores fiscales recientes',
      count: recentFailures,
      warning: recentFailures > 0,
      okMessage: 'No hay facturas o notas crédito fallidas en las últimas 24 horas.',
      warningMessage: `${data.recentInvoiceFailures} factura(s) y ${data.recentCreditNoteFailures} nota(s) crédito fallaron o fueron rechazadas en las últimas 24 horas.`,
    }),
    buildCheck({
      code: 'BILLING_EMAIL_DELIVERY',
      label: 'Entrega por correo',
      count: data.emailErrors + data.stuckEmails,
      critical: data.stuckEmails > 0,
      warning: data.emailErrors > 0,
      okMessage: 'No hay entregas de correo fallidas o bloqueadas.',
      warningMessage: `${data.emailErrors} correo(s) fallaron en las últimas 24 horas.`,
      criticalMessage: `${data.stuckEmails} correo(s) permanecen bloqueados en envío.`,
    }),
    buildCheck({
      code: 'BILLING_CREDIT_NOTE_PROCESSING',
      label: 'Procesamiento de notas crédito',
      count: data.staleCreditNotes,
      critical: data.staleCreditNotes > 0,
      okMessage: 'No hay notas crédito trabadas en procesamiento.',
      criticalMessage: `${data.staleCreditNotes} nota(s) crédito superaron el tiempo de procesamiento esperado.`,
    }),
    buildCheck({
      code: 'BILLING_PRODUCTION_ACTIVATION',
      label: 'Activación productiva',
      count:
        data.activation?.status === 'error' || activationStuck ? 1 : 0,
      critical: Boolean(activationStuck),
      warning: data.activation?.status === 'error',
      okMessage:
        data.activation?.status === 'active'
          ? 'La activación productiva está confirmada.'
          : 'No existe una activación productiva con error.',
      warningMessage:
        data.activation?.lastErrorMessage ||
        'El último intento de activación productiva terminó con error.',
      criticalMessage:
        'La activación productiva conserva un bloqueo vencido.',
    }),
  ];

  return {
    checks,
    overall: summarizeStatus(checks),
  };
}

module.exports = {
  buildOperationalChecks,
  buildWorkerCheck,
  cleanText,
  summarizeStatus,
  toDate,
};
