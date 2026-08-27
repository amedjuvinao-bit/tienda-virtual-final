'use strict';

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_HITS = 40;
const RATE_LIMIT_MAX_TRACKED_CLIENTS = 10_000;
const RATE_LIMIT_CLEANUP_INTERVAL_HITS = 250;

function pruneExpiredBuckets(bucket, currentTime) {
  for (const [key, entry] of bucket.entries()) {
    if (!entry || currentTime > entry.resetAt) bucket.delete(key);
  }
}

function createOrderRateLimit({
  windowMs = RATE_LIMIT_WINDOW_MS,
  maxHits = RATE_LIMIT_MAX_HITS,
  maxTrackedClients = RATE_LIMIT_MAX_TRACKED_CLIENTS,
  cleanupIntervalHits = RATE_LIMIT_CLEANUP_INTERVAL_HITS,
  bucket = new Map(),
  now = () => Date.now(),
} = {}) {
  let hitsSinceCleanup = 0;

  return function orderCreationRateLimit(req, res, next) {
    const ip =
      req.ip ||
      req.headers['x-forwarded-for'] ||
      req.connection?.remoteAddress ||
      'unknown';

    const currentTime = now();
    hitsSinceCleanup += 1;
    if (
      hitsSinceCleanup >= cleanupIntervalHits ||
      bucket.size >= maxTrackedClients
    ) {
      pruneExpiredBuckets(bucket, currentTime);
      hitsSinceCleanup = 0;
    }

    let entry = bucket.get(ip);

    if (!entry || currentTime > entry.resetAt) {
      if (bucket.size >= maxTrackedClients && !bucket.has(ip)) {
        const oldestKey = bucket.keys().next().value;
        if (oldestKey !== undefined) bucket.delete(oldestKey);
      }
      entry = { count: 0, resetAt: currentTime + windowMs };
      bucket.set(ip, entry);
    }

    entry.count += 1;

    if (entry.count > maxHits) {
      return res.status(429).json({
        message: 'Rate limit excedido, intenta de nuevo en unos segundos.',
      });
    }

    return next();
  };
}

const rateLimit = createOrderRateLimit();

module.exports = {
  RATE_LIMIT_CLEANUP_INTERVAL_HITS,
  RATE_LIMIT_MAX_HITS,
  RATE_LIMIT_MAX_TRACKED_CLIENTS,
  RATE_LIMIT_WINDOW_MS,
  createOrderRateLimit,
  pruneExpiredBuckets,
  rateLimit,
};
