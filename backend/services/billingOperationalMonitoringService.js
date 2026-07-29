'use strict';

const ElectronicInvoice = require('../models/ElectronicInvoice');
const BillingInvoiceRecoveryTask = require('../models/BillingInvoiceRecoveryTask');
const BillingActivationState = require('../models/BillingActivationState');
const billingOperationalRuntime = require('./billingOperationalRuntime');
const {
  buildOperationalChecks,
  cleanText,
  toDate,
} = require('./billingOperations/operationalHealthChecks');
const {
  ACTIVATION_STALE_MS,
  CREDIT_NOTE_STALE_MS,
  DAY_MS,
  EMAIL_STALE_MS,
  INVOICE_STALE_MS,
  RECOVERY_STALE_MS,
  queryOperationalHealthData,
} = require('./billingOperations/operationalHealthQueries');

function serializeWorker(runtime = {}) {
  return {
    processUptimeSeconds: Math.max(
      0,
      Number(runtime.processUptimeSeconds || 0)
    ),
    workerStarted: runtime.workerStarted === true,
    workerStartedAt: runtime.workerStartedAt || null,
    intervalMs: Math.max(0, Number(runtime.intervalMs || 0)),
    running: runtime.running === true,
    currentCycleStartedAt: runtime.currentCycleStartedAt || null,
    lastCycleAt: runtime.lastCycleAt || null,
    lastSuccessAt: runtime.lastSuccessAt || null,
    lastFailureAt: runtime.lastFailureAt || null,
    lastSkippedAt: runtime.lastSkippedAt || null,
    lastSkipReason: cleanText(runtime.lastSkipReason, 160),
    lastErrorCode: cleanText(runtime.lastErrorCode, 120),
    lastErrorMessage: cleanText(runtime.lastErrorMessage, 300),
    cycles: Math.max(0, Number(runtime.cycles || 0)),
    failures: Math.max(0, Number(runtime.failures || 0)),
    skipped: Math.max(0, Number(runtime.skipped || 0)),
    lastSummary: {
      scanned: Math.max(0, Number(runtime.lastSummary?.scanned || 0)),
      scheduled: Math.max(0, Number(runtime.lastSummary?.scheduled || 0)),
      processed: Math.max(0, Number(runtime.lastSummary?.processed || 0)),
      resolved: Math.max(0, Number(runtime.lastSummary?.resolved || 0)),
      pending: Math.max(0, Number(runtime.lastSummary?.pending || 0)),
      failed: Math.max(0, Number(runtime.lastSummary?.failed || 0)),
    },
  };
}

function serializeActivation(activation = {}) {
  return {
    status: activation.status || 'idle',
    provider: activation.provider || 'factus',
    environment: activation.environment || '',
    activatedAt: activation.activatedAt || null,
    lastAttemptAt: activation.lastAttemptAt || null,
    lastErrorCode: cleanText(activation.lastErrorCode, 120),
    lastErrorMessage: cleanText(activation.lastErrorMessage, 300),
  };
}

function serializeOldestRecovery(task) {
  if (!task) return null;
  return {
    invoiceId: String(task.invoiceId || ''),
    orderId: String(task.orderId || ''),
    referenceCode: cleanText(task.referenceCode, 180),
    status: cleanText(task.status, 40),
    reason: cleanText(task.reason, 180),
    attempts: Number(task.attempts || 0),
    nextAttemptAt: task.nextAttemptAt || null,
    lastAttemptAt: task.lastAttemptAt || null,
    lastError: cleanText(task.lastError, 300),
  };
}

function createBillingOperationalMonitoringService(overrides = {}) {
  const InvoiceModel = overrides.ElectronicInvoice || ElectronicInvoice;
  const RecoveryTaskModel =
    overrides.BillingInvoiceRecoveryTask || BillingInvoiceRecoveryTask;
  const ActivationModel =
    overrides.BillingActivationState || BillingActivationState;
  const runtime =
    overrides.billingOperationalRuntime || billingOperationalRuntime;
  const nowFactory = overrides.now || (() => new Date());

  async function getOperationalHealth() {
    const now = toDate(nowFactory()) || new Date();
    const data = await queryOperationalHealthData({
      InvoiceModel,
      RecoveryTaskModel,
      ActivationModel,
      now,
    });
    const runtimeSnapshot =
      typeof runtime?.getSnapshot === 'function'
        ? runtime.getSnapshot()
        : { workerStarted: false };
    const { checks, overall } = buildOperationalChecks({
      data,
      runtimeSnapshot,
      now,
    });

    return {
      ...overall,
      generatedAt: now,
      window: {
        startedAt: data.windowStartedAt,
        endedAt: now,
        hours: 24,
      },
      worker: serializeWorker(runtimeSnapshot),
      metrics: {
        staleInvoices: data.staleInvoices,
        recentInvoiceFailures: data.recentInvoiceFailures,
        staleCreditNotes: data.staleCreditNotes,
        recentCreditNoteFailures: data.recentCreditNoteFailures,
        emailErrors: data.emailErrors,
        stuckEmails: data.stuckEmails,
        recovery: {
          active: data.activeRecoveries,
          overdue: data.overdueRecoveries,
          stuck: data.stuckRecoveries,
          failed: data.failedRecoveries,
        },
      },
      activation: serializeActivation(data.activation),
      oldestRecovery: serializeOldestRecovery(data.oldestRecovery),
      checks,
    };
  }

  return { getOperationalHealth };
}

const defaultService = createBillingOperationalMonitoringService();

module.exports = {
  ACTIVATION_STALE_MS,
  CREDIT_NOTE_STALE_MS,
  DAY_MS,
  EMAIL_STALE_MS,
  INVOICE_STALE_MS,
  RECOVERY_STALE_MS,
  createBillingOperationalMonitoringService,
  getOperationalHealth: defaultService.getOperationalHealth,
};
