'use strict';

const {
  COUPON_INDEX_DEFINITIONS,
  COUPON_REDEMPTION_INDEX_DEFINITIONS,
} = require('../models/couponIndexDefinitions');
const {
  CanonicalIndexMigrationError,
  analyzeExistingIndexes,
  applyCanonicalIndexes,
  listIndexes,
} = require('./indexMigrations/canonicalIndexMigration');

const APPLY_FLAG = '--apply-coupon-index-migration';
const PRODUCTION_CONFIRMATION_FLAG = '--confirm-production-coupon-index-migration';
const CODE_PREFIX = 'COUPON_INDEX_MIGRATION';
const COLLECTION_PLANS = Object.freeze([
  Object.freeze({
    collection: 'coupons',
    definitions: COUPON_INDEX_DEFINITIONS,
  }),
  Object.freeze({
    collection: 'couponredemptions',
    definitions: COUPON_REDEMPTION_INDEX_DEFINITIONS,
  }),
]);

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, clone(entry)])
  );
}

function parseArguments(argv = []) {
  const allowed = new Set([APPLY_FLAG, PRODUCTION_CONFIRMATION_FLAG]);
  const unknown = argv.find((argument) => !allowed.has(argument));
  if (unknown) {
    throw new CanonicalIndexMigrationError(
      `${CODE_PREFIX}_UNKNOWN_ARGUMENT`,
      'Se recibió un argumento no permitido para la migración de Cupones.'
    );
  }
  return {
    apply: argv.includes(APPLY_FLAG),
    confirmProduction: argv.includes(PRODUCTION_CONFIRMATION_FLAG),
  };
}

function assertWriteAuthorization({ apply, confirmProduction, nodeEnv } = {}) {
  if (!apply) return;
  if (
    String(nodeEnv || '').trim().toLowerCase() === 'production' &&
    !confirmProduction
  ) {
    throw new CanonicalIndexMigrationError(
      `${CODE_PREFIX}_PRODUCTION_CONFIRMATION_REQUIRED`,
      `En producción también se requiere ${PRODUCTION_CONFIRMATION_FLAG}.`
    );
  }
}

function buildMigrationPlan() {
  return COLLECTION_PLANS.map(({ collection, definitions }) => ({
    collection,
    indexCount: definitions.length,
    indexes: clone(definitions),
  }));
}

async function applyCouponIndexes(collections = {}) {
  const prepared = [];

  for (const plan of COLLECTION_PLANS) {
    const collection = collections[plan.collection];
    if (!collection) {
      throw new TypeError(`${CODE_PREFIX}_COLLECTION_REQUIRED:${plan.collection}`);
    }
    const existing = await listIndexes(collection);
    const preflight = analyzeExistingIndexes(
      existing,
      plan.definitions,
      `${CODE_PREFIX}_${plan.collection.toUpperCase()}`
    );
    prepared.push({ ...plan, collectionAdapter: collection, preflight });
  }

  const outcomes = [];
  for (const plan of prepared) {
    const outcome = await applyCanonicalIndexes({
      collection: plan.collectionAdapter,
      definitions: plan.definitions,
      codePrefix: `${CODE_PREFIX}_${plan.collection.toUpperCase()}`,
    });
    outcomes.push({ collection: plan.collection, ...outcome });
  }

  return {
    collections: outcomes,
    mutations: outcomes.reduce(
      (total, outcome) => total + Number(outcome.mutations || 0),
      0
    ),
  };
}

async function runMigration({
  argv = [],
  nodeEnv = '',
  mongoUri = '',
  mongooseAdapter,
} = {}) {
  const options = parseArguments(argv);
  assertWriteAuthorization({ ...options, nodeEnv });
  const plans = buildMigrationPlan();
  const base = {
    ok: true,
    mode: options.apply ? 'apply' : 'dry-run',
    collectionCount: plans.length,
    indexCount: plans.reduce((total, plan) => total + plan.indexCount, 0),
    collections: plans,
    destructiveOperations: [],
  };
  if (!options.apply) return { ...base, mutations: 0 };

  if (!/^mongodb(?:\+srv)?:\/\//i.test(String(mongoUri || '').trim())) {
    throw new CanonicalIndexMigrationError(
      `${CODE_PREFIX}_MONGODB_URI_REQUIRED`,
      'MONGO_URI debe estar configurada para aplicar la migración.'
    );
  }
  if (!mongooseAdapter || typeof mongooseAdapter.connect !== 'function') {
    throw new TypeError(`${CODE_PREFIX}_MONGOOSE_ADAPTER_REQUIRED`);
  }

  await mongooseAdapter.connect(mongoUri, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });
  try {
    const collections = Object.fromEntries(
      COLLECTION_PLANS.map(({ collection }) => [
        collection,
        mongooseAdapter.connection.collection(collection),
      ])
    );
    const outcome = await applyCouponIndexes(collections);
    return { ...base, ...outcome };
  } finally {
    await mongooseAdapter.disconnect();
  }
}

function safeError(error) {
  if (error instanceof CanonicalIndexMigrationError) {
    return {
      code: error.code,
      message: error.message,
      ...(Object.keys(error.details || {}).length
        ? { details: error.details }
        : {}),
    };
  }
  return {
    code: `${CODE_PREFIX}_FAILED`,
    message: 'No fue posible completar la migración de índices de Cupones.',
  };
}

module.exports = {
  APPLY_FLAG,
  PRODUCTION_CONFIRMATION_FLAG,
  COLLECTION_PLANS,
  applyCouponIndexes,
  assertWriteAuthorization,
  buildMigrationPlan,
  parseArguments,
  runMigration,
  safeError,
};
