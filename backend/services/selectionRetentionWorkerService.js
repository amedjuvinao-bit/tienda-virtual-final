'use strict';

const { randomUUID } = require('node:crypto');
const { cleanupEligibleCarts } = require('../scripts/cleanupAbandonedCarts');
const { cleanupEligibleFavoriteLists } = require('../scripts/cleanupInactiveFavorites');
const { RETENTION_DAYS } = require('../scripts/previewAbandonedCartRetention');

const JOB_ID = 'saved-selections-30d-v1';
const COLLECTION_NAME = 'selection_retention_jobs';
const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const LEASE_MS = 15 * 60 * 1000;
const WRITE_OPTIONS = { writeConcern: { w: 'majority' }, maxTimeMS: 10_000 };

function createSelectionRetentionWorker({
  getResources,
  enabled = true,
  isReady = () => true,
  now = () => new Date(),
  logger = console,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  cleanCarts = cleanupEligibleCarts,
  cleanFavorites = cleanupEligibleFavoriteLists,
} = {}) {
  if (typeof getResources !== 'function') throw new TypeError('RETENTION_RESOURCES_REQUIRED');
  let timer = null;
  let running = false;
  let stopping = false;

  async function runOnce() {
    if (!enabled) return { skipped: true, reason: 'disabled' };
    if (running) return { skipped: true, reason: 'cycle_in_progress' };
    if (stopping || !isReady()) return { skipped: true, reason: 'storage_or_maintenance' };
    running = true;
    let resources;
    let owner;
    let claimed = false;
    const report = {
      status: 'interrupted', retentionDays: RETENTION_DAYS,
      checkedCarts: 0, deletedCarts: 0,
      checkedFavoriteLists: 0, deletedFavoriteLists: 0,
    };

    try {
      resources = getResources();
      owner = randomUUID();
      const at = now();
      try {
        const claim = await resources.jobs.findOneAndUpdate({
          _id: JOB_ID,
          $and: [
            { $or: [{ nextRunAt: null }, { nextRunAt: { $lte: at } }] },
            { $or: [{ leaseUntil: null }, { leaseUntil: { $lte: at } }] },
          ],
        }, {
          $set: { owner, leaseUntil: new Date(at.getTime() + LEASE_MS), startedAt: at, status: 'running' },
          $setOnInsert: { nextRunAt: at },
        }, { ...WRITE_OPTIONS, upsert: true, returnDocument: 'after', includeResultMetadata: false });
        claimed = claim?.owner === owner;
      } catch (error) {
        // El índice único de _id resuelve también el primer arranque concurrente.
        if (error.code !== 11000) throw error;
      }
      if (!claimed) return { skipped: true, reason: 'not_due_or_claimed' };

      const shouldContinue = async () => {
        if (stopping || !isReady()) return false;
        const checkAt = now();
        const renewed = await resources.jobs.updateOne({
          _id: JOB_ID, owner, leaseUntil: { $gt: checkAt },
        }, { $set: { leaseUntil: new Date(checkAt.getTime() + LEASE_MS) } }, WRITE_OPTIONS);
        if (renewed.matchedCount !== 1) {
          const error = new Error('RETENTION_LEASE_LOST');
          error.code = 'RETENTION_LEASE_LOST';
          throw error;
        }
        return true;
      };

      if (!await shouldContinue()) return report;
      const cartsCompleted = await cleanCarts({
        client: resources.client, carts: resources.carts, orders: resources.orders,
        report, shouldContinue,
      });
      if (cartsCompleted === false || !await shouldContinue()) return report;
      const favoritesCompleted = await cleanFavorites({
        favorites: resources.favorites, report, now: now(), shouldContinue,
      });
      if (favoritesCompleted !== false && await shouldContinue()) report.status = 'completed';
    } catch (error) {
      report.status = 'failed';
      report.errorCode = String(error.code || 'RETENTION_CYCLE_FAILED').slice(0, 80);
    } finally {
      if (claimed) {
        try {
          const finishedAt = now();
          const completed = report.status === 'completed';
          const released = await resources.jobs.updateOne({ _id: JOB_ID, owner }, {
            $set: {
              owner: null, leaseUntil: new Date(0), finishedAt,
              nextRunAt: new Date(finishedAt.getTime() + (completed ? DAY_MS : CHECK_INTERVAL_MS)),
              status: report.status, lastReport: { ...report },
              ...(completed ? { lastSucceededAt: finishedAt } : {}),
            },
          }, WRITE_OPTIONS);
          if (released.matchedCount !== 1) {
            report.status = 'failed';
            report.errorCode = 'RETENTION_LEASE_LOST';
          }
        } catch {
          report.status = 'failed';
          report.errorCode = 'RETENTION_RESULT_NOT_SAVED';
        }
      }
      running = false;
      if (claimed || report.status === 'failed') {
        logger[report.status === 'completed' ? 'info' : 'error']?.('selection_retention_cycle', { ...report });
      }
    }
    return report;
  }

  function start() {
    if (!enabled || timer !== null) return false;
    stopping = false;
    timer = setIntervalFn(() => { void runOnce(); }, CHECK_INTERVAL_MS);
    timer?.unref?.();
    void runOnce();
    return true;
  }

  function stop() {
    stopping = true;
    if (timer === null) return false;
    clearIntervalFn(timer);
    timer = null;
    return true;
  }

  return Object.freeze({ start, stop, runOnce,
    metrics: () => ({ running, started: timer !== null }),
  });
}

module.exports = { createSelectionRetentionWorker, JOB_ID, COLLECTION_NAME, DAY_MS, CHECK_INTERVAL_MS, LEASE_MS };
