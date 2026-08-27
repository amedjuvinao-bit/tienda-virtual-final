'use strict';

const {
  orderActivityIndexDefinitions,
} = require('../models/orderActivityIndexDefinitions');

class OrderActivityIndexMigrationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'OrderActivityIndexMigrationError';
    this.code = code;
    this.details = details;
  }
}

function normalizeEnvironment(value) {
  return String(value || '').trim().toLowerCase();
}

function assertOrderActivityIndexMigrationSafety({
  apply = false,
  allowProduction = false,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  if (!apply) return;
  if (normalizeEnvironment(nodeEnv) === 'production' && !allowProduction) {
    throw new OrderActivityIndexMigrationError(
      'PRODUCTION_ORDER_ACTIVITY_INDEX_CONFIRMATION_REQUIRED',
      'La migración de índices de actividad en producción exige confirmación adicional.',
      { requiredFlag: '--allow-production-order-activity-index-migration' }
    );
  }
}

function orderedKeyEquals(left = {}, right = {}) {
  const leftEntries = Object.entries(left || {});
  const rightEntries = Object.entries(right || {});
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(
      ([key, value], index) =>
        rightEntries[index]?.[0] === key && rightEntries[index]?.[1] === value
    )
  );
}

function canonicalObject(value) {
  if (Array.isArray(value)) return value.map(canonicalObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalObject(value[key])])
  );
}

function semanticOption(value, fallback) {
  return value === undefined ? fallback : value;
}

function exactActivityIndexMatches(existing = {}, definition = {}) {
  const expected = definition.options || {};
  return (
    existing.name === expected.name &&
    orderedKeyEquals(existing.key, definition.key) &&
    Boolean(existing.unique) === Boolean(expected.unique) &&
    Boolean(existing.sparse) === Boolean(expected.sparse) &&
    Boolean(existing.hidden) === Boolean(expected.hidden) &&
    semanticOption(existing.expireAfterSeconds, null) ===
      semanticOption(expected.expireAfterSeconds, null) &&
    JSON.stringify(canonicalObject(existing.partialFilterExpression || null)) ===
      JSON.stringify(canonicalObject(expected.partialFilterExpression || null)) &&
    JSON.stringify(canonicalObject(existing.collation || null)) ===
      JSON.stringify(canonicalObject(expected.collation || null))
  );
}

function migrationPlan({
  apply = false,
  allowProduction = false,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  const production = normalizeEnvironment(nodeEnv) === 'production';
  return {
    ok: true,
    mode: apply ? 'apply' : 'plan',
    appliesChanges: apply === true,
    indexes: orderActivityIndexDefinitions(),
    confirmations: {
      apply: apply === true,
      productionRequired: production,
      production: allowProduction === true,
    },
    destructiveOperations: [],
  };
}

function isNamespaceNotFound(error) {
  return Number(error?.code) === 26 || error?.codeName === 'NamespaceNotFound';
}

function createMongoOrderActivityIndexRepository(connection) {
  if (!connection || typeof connection.collection !== 'function') {
    throw new TypeError('ORDER_ACTIVITY_INDEX_CONNECTION_REQUIRED');
  }
  return Object.freeze({
    async listIndexes(collectionName) {
      try {
        const cursor = connection.collection(collectionName).listIndexes();
        return typeof cursor?.toArray === 'function'
          ? await cursor.toArray()
          : await cursor;
      } catch (error) {
        if (isNamespaceNotFound(error)) return [];
        throw error;
      }
    },
    async createIndex(collectionName, key, options) {
      return connection.collection(collectionName).createIndex(key, options);
    },
  });
}

function findExistingIndex(indexes = [], definition = {}) {
  return (
    indexes.find((index) => index.name === definition.options.name) ||
    indexes.find((index) => orderedKeyEquals(index.key, definition.key)) ||
    null
  );
}

async function inspectDefinitions(repository, definitions) {
  const indexesByCollection = new Map();
  for (const collection of new Set(
    definitions.map((definition) => definition.collection)
  )) {
    indexesByCollection.set(
      collection,
      (await repository.listIndexes(collection)) || []
    );
  }
  return definitions.map((definition) => {
    const existing = findExistingIndex(
      indexesByCollection.get(definition.collection),
      definition
    );
    return {
      definition,
      existing,
      state: !existing
        ? 'missing'
        : exactActivityIndexMatches(existing, definition)
          ? 'exact'
          : 'incompatible',
    };
  });
}

async function runOrderActivityIndexMigration({
  repository = null,
  apply = false,
  allowProduction = false,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  const plan = migrationPlan({ apply, allowProduction, nodeEnv });
  if (!apply) {
    return { ...plan, status: 'planned', mutations: 0 };
  }

  assertOrderActivityIndexMigrationSafety({
    apply,
    allowProduction,
    nodeEnv,
  });
  if (
    !repository ||
    typeof repository.listIndexes !== 'function' ||
    typeof repository.createIndex !== 'function'
  ) {
    throw new TypeError('ORDER_ACTIVITY_INDEX_REPOSITORY_REQUIRED');
  }

  const inspected = await inspectDefinitions(repository, plan.indexes);
  const incompatible = inspected.filter((entry) => entry.state === 'incompatible');
  if (incompatible.length) {
    throw new OrderActivityIndexMigrationError(
      'ORDER_ACTIVITY_INDEX_CONFLICT',
      'Existe un índice de actividad incompatible. La migración se detuvo sin modificar índices.',
      {
        conflicts: incompatible.map(({ definition, existing }) => ({
          collection: definition.collection,
          expectedName: definition.options.name,
          existingName: existing?.name || '',
        })),
      }
    );
  }

  const createdIndexes = [];
  for (const { definition, state } of inspected) {
    if (state === 'exact') continue;
    const createdName = await repository.createIndex(
      definition.collection,
      definition.key,
      definition.options
    );
    if (createdName !== definition.options.name) {
      throw new OrderActivityIndexMigrationError(
        'ORDER_ACTIVITY_INDEX_NAME_MISMATCH',
        'MongoDB no confirmó el nombre esperado para el índice de actividad.',
        {
          collection: definition.collection,
          expectedName: definition.options.name,
          createdName: String(createdName || ''),
        }
      );
    }
    createdIndexes.push({
      collection: definition.collection,
      name: createdName,
    });
  }

  return {
    ...plan,
    status: createdIndexes.length ? 'created' : 'already_present',
    mutations: createdIndexes.length,
    createdIndexes,
  };
}

module.exports = {
  OrderActivityIndexMigrationError,
  assertOrderActivityIndexMigrationSafety,
  createMongoOrderActivityIndexRepository,
  exactActivityIndexMatches,
  findExistingIndex,
  isNamespaceNotFound,
  migrationPlan,
  orderedKeyEquals,
  runOrderActivityIndexMigration,
};
