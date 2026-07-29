'use strict';

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function cleanText(value, max = 240) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function createBillingOperationalRuntime({
  now = () => new Date(),
  processUptime = () => process.uptime(),
} = {}) {
  const state = {
    workerStartedAt: null,
    intervalMs: 0,
    running: false,
    currentCycleStartedAt: null,
    lastCycleAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastSkippedAt: null,
    lastSkipReason: '',
    lastErrorCode: '',
    lastErrorMessage: '',
    cycles: 0,
    failures: 0,
    skipped: 0,
    lastSummary: {},
  };

  function markWorkerStarted({ intervalMs } = {}) {
    state.workerStartedAt = validDate(now());
    state.intervalMs = Math.max(0, Number(intervalMs || 0));
    return getSnapshot();
  }

  function markWorkerCycleStarted() {
    state.running = true;
    state.currentCycleStartedAt = validDate(now());
    return getSnapshot();
  }

  function markWorkerCycleSucceeded(summary = {}) {
    const at = validDate(now());
    state.running = false;
    state.currentCycleStartedAt = null;
    state.lastCycleAt = at;
    state.lastSuccessAt = at;
    state.lastErrorCode = '';
    state.lastErrorMessage = '';
    state.cycles += 1;
    state.lastSummary = {
      scanned: Number(summary.scanned || 0),
      scheduled: Number(summary.scheduled || 0),
      processed: Number(summary.processed || 0),
      resolved: Number(summary.resolved || 0),
      pending: Number(summary.pending || 0),
      failed: Number(summary.failed || 0),
    };
    return getSnapshot();
  }

  function markWorkerCycleFailed(error) {
    const at = validDate(now());
    state.running = false;
    state.currentCycleStartedAt = null;
    state.lastCycleAt = at;
    state.lastFailureAt = at;
    state.lastErrorCode = cleanText(error?.code || 'BILLING_RECOVERY_CYCLE_ERROR', 120);
    state.lastErrorMessage = cleanText(
      error?.message || 'Falló el ciclo de recuperación fiscal.'
    );
    state.cycles += 1;
    state.failures += 1;
    return getSnapshot();
  }

  function markWorkerCycleSkipped(reason = '') {
    const at = validDate(now());
    state.lastCycleAt = at;
    state.lastSkippedAt = at;
    state.lastSkipReason = cleanText(reason, 160);
    state.skipped += 1;
    return getSnapshot();
  }

  function getSnapshot() {
    return {
      processUptimeSeconds: Math.max(0, Number(processUptime() || 0)),
      workerStarted: Boolean(state.workerStartedAt),
      workerStartedAt: state.workerStartedAt,
      intervalMs: state.intervalMs,
      running: state.running,
      currentCycleStartedAt: state.currentCycleStartedAt,
      lastCycleAt: state.lastCycleAt,
      lastSuccessAt: state.lastSuccessAt,
      lastFailureAt: state.lastFailureAt,
      lastSkippedAt: state.lastSkippedAt,
      lastSkipReason: state.lastSkipReason,
      lastErrorCode: state.lastErrorCode,
      lastErrorMessage: state.lastErrorMessage,
      cycles: state.cycles,
      failures: state.failures,
      skipped: state.skipped,
      lastSummary: { ...state.lastSummary },
    };
  }

  return {
    getSnapshot,
    markWorkerCycleFailed,
    markWorkerCycleSkipped,
    markWorkerCycleStarted,
    markWorkerCycleSucceeded,
    markWorkerStarted,
  };
}

const defaultRuntime = createBillingOperationalRuntime();

module.exports = {
  createBillingOperationalRuntime,
  getSnapshot: defaultRuntime.getSnapshot,
  markWorkerCycleFailed: defaultRuntime.markWorkerCycleFailed,
  markWorkerCycleSkipped: defaultRuntime.markWorkerCycleSkipped,
  markWorkerCycleStarted: defaultRuntime.markWorkerCycleStarted,
  markWorkerCycleSucceeded: defaultRuntime.markWorkerCycleSucceeded,
  markWorkerStarted: defaultRuntime.markWorkerStarted,
};
