'use strict';

const Order = require('../models/Order');
const {
  DEFAULT_CLAIM_TIMEOUT_MS,
  processPaidOrderEffects,
} = require('./orderCreationPostCommitService');

const DEFAULT_INTERVAL_MS = 30 * 1000;
const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 200;

function boundedInteger(value, fallback, { min, max }) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function clean(value, maximum = 120) {
  return String(value || '').trim().slice(0, maximum);
}

function recoverableLaneFilter(lane, staleBefore) {
  return {
    $or: [
      { [`paymentProcessing.${lane}.status`]: { $exists: false } },
      {
        [`paymentProcessing.${lane}.status`]: {
          $in: ['pending', 'failed'],
        },
      },
      {
        [`paymentProcessing.${lane}.status`]:
          lane === 'invoice' ? 'scheduling' : 'processing',
        [`paymentProcessing.${lane}.claimedAt`]: { $lt: staleBefore },
      },
    ],
  };
}

function buildOutboxCandidateFilter({ staleBefore } = {}) {
  const threshold = staleBefore instanceof Date ? staleBefore : new Date(0);
  return {
    'payment.status': 'paid',
    'paymentProcessing.provider': { $nin: ['', null] },
    'paymentProcessing.approvedTransactionId': { $nin: ['', null] },
    $expr: {
      $and: [
        {
          $eq: ['$paymentProcessing.provider', '$payment.provider'],
        },
        {
          $eq: [
            '$paymentProcessing.approvedTransactionId',
            '$payment.transactionId',
          ],
        },
      ],
    },
    'paymentProcessing.inventory.status': {
      $in: ['confirmed', 'not_required'],
    },
    $or: [
      recoverableLaneFilter('fulfillment', threshold),
      recoverableLaneFilter('invoice', threshold),
    ],
  };
}

async function resolveQuery(query) {
  return typeof query?.exec === 'function' ? query.exec() : query;
}

function createOrderPostCommitOutboxWorker({
  OrderModel = Order,
  effectProcessor = processPaidOrderEffects,
  intervalMs = DEFAULT_INTERVAL_MS,
  batchSize = DEFAULT_BATCH_SIZE,
  claimTimeoutMs = DEFAULT_CLAIM_TIMEOUT_MS,
  now = () => new Date(),
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  isReady = () => true,
  logger = console,
} = {}) {
  if (!OrderModel || typeof OrderModel.find !== 'function') {
    throw new TypeError('ORDER_POST_COMMIT_OUTBOX_MODEL_REQUIRED');
  }
  if (typeof effectProcessor !== 'function') {
    throw new TypeError('ORDER_POST_COMMIT_OUTBOX_PROCESSOR_REQUIRED');
  }

  const safeIntervalMs = boundedInteger(intervalMs, DEFAULT_INTERVAL_MS, {
    min: 1_000,
    max: 60 * 60 * 1000,
  });
  const safeBatchSize = boundedInteger(batchSize, DEFAULT_BATCH_SIZE, {
    min: 1,
    max: MAX_BATCH_SIZE,
  });
  const safeClaimTimeoutMs = boundedInteger(
    claimTimeoutMs,
    DEFAULT_CLAIM_TIMEOUT_MS,
    { min: 1_000, max: 24 * 60 * 60 * 1000 }
  );
  let timer = null;
  let cycleRunning = false;
  const totals = {
    cycles: 0,
    scanned: 0,
    attempted: 0,
    completed: 0,
    retryable: 0,
    deferred: 0,
    invalid: 0,
    failed: 0,
  };

  async function loadCandidates(cycleNow) {
    const staleBefore = new Date(cycleNow.getTime() - safeClaimTimeoutMs);
    let query = OrderModel.find(buildOutboxCandidateFilter({ staleBefore }));
    if (typeof query?.sort === 'function') {
      query = query.sort({ updatedAt: 1, _id: 1 });
    }
    if (typeof query?.limit === 'function') query = query.limit(safeBatchSize);
    if (typeof query?.select === 'function') {
      query = query.select(
        '_id payment.provider payment.transactionId paymentProcessing.provider paymentProcessing.approvedTransactionId paymentProcessing.inventory.status paymentProcessing.fulfillment.status paymentProcessing.fulfillment.claimedAt paymentProcessing.invoice.status paymentProcessing.invoice.claimedAt'
      );
    }
    if (typeof query?.lean === 'function') query = query.lean();
    const candidates = await resolveQuery(query);
    return Array.isArray(candidates) ? candidates : [];
  }

  async function processCandidate(order) {
    const provider = clean(order?.paymentProcessing?.provider, 40).toLowerCase();
    const transactionId = clean(
      order?.paymentProcessing?.approvedTransactionId,
      120
    );
    const paymentProvider = clean(order?.payment?.provider, 40).toLowerCase();
    const paymentTransactionId = clean(order?.payment?.transactionId, 120);
    if (
      !order?._id ||
      !provider ||
      !transactionId ||
      provider !== paymentProvider ||
      transactionId !== paymentTransactionId
    ) {
      return { invalid: true };
    }

    const result = await effectProcessor({
      orderId: order._id,
      paymentProvider: provider,
      transaction: {
        id: transactionId,
        provider,
        status: 'APPROVED',
      },
      payments: {},
    });
    const deferred = Boolean(
      result?.fulfillment?.duplicate === true ||
      result?.invoice?.duplicate === true
    );
    return {
      completed: result?.retryable !== true && !deferred,
      retryable: result?.retryable === true,
      deferred,
      result,
    };
  }

  async function runOnce() {
    if (cycleRunning) return { skipped: true, reason: 'cycle_in_progress' };
    if (!isReady()) return { skipped: true, reason: 'storage_not_ready' };

    cycleRunning = true;
    const summary = {
      scanned: 0,
      attempted: 0,
      completed: 0,
      retryable: 0,
      deferred: 0,
      invalid: 0,
      failed: 0,
      sampledErrorCodes: [],
    };
    try {
      const candidates = await loadCandidates(now());
      summary.scanned = candidates.length;
      for (const candidate of candidates) {
        summary.attempted += 1;
        try {
          const outcome = await processCandidate(candidate);
          if (outcome.invalid) summary.invalid += 1;
          else if (outcome.retryable) summary.retryable += 1;
          else if (outcome.deferred) summary.deferred += 1;
          else if (outcome.completed) summary.completed += 1;
        } catch (error) {
          summary.failed += 1;
          if (summary.sampledErrorCodes.length < 5) {
            summary.sampledErrorCodes.push(
              clean(error?.code || 'POST_COMMIT_OUTBOX_ITEM_FAILED', 100)
            );
          }
        }
      }

      totals.cycles += 1;
      Object.keys(totals)
        .filter((key) => key !== 'cycles')
        .forEach((key) => {
          totals[key] += summary[key];
        });
      if (summary.scanned > 0 || summary.failed > 0) {
        logger.info?.('order_post_commit_outbox_cycle', summary);
      }
      return summary;
    } finally {
      cycleRunning = false;
    }
  }

  function start({ runImmediately = true } = {}) {
    if (timer) return false;
    timer = setIntervalFn(() => {
      runOnce().catch((error) => {
        logger.error?.('order_post_commit_outbox_cycle_failed', {
          code: clean(error?.code || 'POST_COMMIT_OUTBOX_CYCLE_FAILED', 100),
        });
      });
    }, safeIntervalMs);
    timer?.unref?.();
    if (runImmediately) {
      runOnce().catch((error) => {
        logger.error?.('order_post_commit_outbox_initial_cycle_failed', {
          code: clean(error?.code || 'POST_COMMIT_OUTBOX_CYCLE_FAILED', 100),
        });
      });
    }
    return true;
  }

  function stop() {
    if (!timer) return false;
    clearIntervalFn(timer);
    timer = null;
    return true;
  }

  function metrics() {
    return Object.freeze({ ...totals, running: cycleRunning, started: Boolean(timer) });
  }

  return Object.freeze({
    batchSize: safeBatchSize,
    claimTimeoutMs: safeClaimTimeoutMs,
    intervalMs: safeIntervalMs,
    loadCandidates,
    metrics,
    processCandidate,
    runOnce,
    start,
    stop,
  });
}

module.exports = {
  DEFAULT_BATCH_SIZE,
  DEFAULT_INTERVAL_MS,
  MAX_BATCH_SIZE,
  buildOutboxCandidateFilter,
  createOrderPostCommitOutboxWorker,
  recoverableLaneFilter,
};
