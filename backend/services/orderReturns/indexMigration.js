'use strict';

const {
  orderReturnCreationIdempotencyIndexDefinition,
} = require('../../models/orderReturnIndexDefinitions');

const ORDER_RETURN_COLLECTION = 'orderreturns';

class OrderReturnIndexMigrationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'OrderReturnIndexMigrationError';
    this.code = code;
    this.details = details;
  }
}

function normalizeEnvironment(value) {
  return String(value || '').trim().toLowerCase();
}

function assertOrderReturnIndexMigrationSafety({
  apply = false,
  allowProduction = false,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  if (!apply) return;
  if (normalizeEnvironment(nodeEnv) === 'production' && !allowProduction) {
    throw new OrderReturnIndexMigrationError(
      'PRODUCTION_ORDER_RETURN_INDEX_CONFIRMATION_REQUIRED',
      'La migración de índices de devoluciones en producción exige confirmación adicional.',
      { requiredFlag: '--allow-production-order-index-migration' }
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

function objectEquals(left, right) {
  return (
    JSON.stringify(canonicalObject(left)) ===
    JSON.stringify(canonicalObject(right))
  );
}

function exactIndexMatches(existing = {}, definition = {}) {
  return (
    existing.name === definition.options.name &&
    orderedKeyEquals(existing.key, definition.key) &&
    existing.unique === true &&
    objectEquals(
      existing.partialFilterExpression,
      definition.options.partialFilterExpression
    )
  );
}

function migrationPlan({
  apply = false,
  allowProduction = false,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  const definition = orderReturnCreationIdempotencyIndexDefinition();
  const production = normalizeEnvironment(nodeEnv) === 'production';
  return {
    ok: true,
    mode: apply ? 'apply' : 'plan',
    appliesChanges: apply === true,
    collection: ORDER_RETURN_COLLECTION,
    index: definition,
    confirmations: {
      apply: apply === true,
      productionRequired: production,
      production: allowProduction === true,
    },
    destructiveOperations: [],
  };
}

function createMongoOrderReturnIndexRepository(collection) {
  if (
    !collection ||
    typeof collection.listIndexes !== 'function' ||
    typeof collection.createIndex !== 'function'
  ) {
    throw new TypeError('ORDER_RETURN_INDEX_COLLECTION_REQUIRED');
  }
  return Object.freeze({
    async listIndexes() {
      const cursor = collection.listIndexes();
      return typeof cursor?.toArray === 'function'
        ? cursor.toArray()
        : cursor;
    },
    async createIndex(key, options) {
      return collection.createIndex(key, options);
    },
  });
}

async function runOrderReturnIndexMigration({
  repository = null,
  apply = false,
  allowProduction = false,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  const plan = migrationPlan({ apply, allowProduction, nodeEnv });
  if (!apply) {
    return { ...plan, status: 'planned', mutations: 0 };
  }

  assertOrderReturnIndexMigrationSafety({
    apply,
    allowProduction,
    nodeEnv,
  });
  if (!repository || typeof repository.listIndexes !== 'function') {
    throw new TypeError('ORDER_RETURN_INDEX_REPOSITORY_REQUIRED');
  }

  const definition = orderReturnCreationIdempotencyIndexDefinition();
  const indexes = await repository.listIndexes();
  const sameName = (indexes || []).find(
    (index) => index.name === definition.options.name
  );
  const sameKey = (indexes || []).find((index) =>
    orderedKeyEquals(index.key, definition.key)
  );
  const existing = sameName || sameKey;

  if (existing) {
    if (!exactIndexMatches(existing, definition)) {
      throw new OrderReturnIndexMigrationError(
        'ORDER_RETURN_INDEX_CONFLICT',
        'Existe un índice incompatible. La migración se detuvo sin modificarlo.',
        {
          expectedName: definition.options.name,
          existingName: existing.name || '',
        }
      );
    }
    return { ...plan, status: 'already_present', mutations: 0 };
  }

  const createdName = await repository.createIndex(
    definition.key,
    definition.options
  );
  if (createdName !== definition.options.name) {
    throw new OrderReturnIndexMigrationError(
      'ORDER_RETURN_INDEX_NAME_MISMATCH',
      'MongoDB no confirmó el nombre esperado para el índice.',
      {
        expectedName: definition.options.name,
        createdName: String(createdName || ''),
      }
    );
  }
  return {
    ...plan,
    status: 'created',
    mutations: 1,
    createdIndex: createdName,
  };
}

module.exports = {
  ORDER_RETURN_COLLECTION,
  OrderReturnIndexMigrationError,
  assertOrderReturnIndexMigrationSafety,
  createMongoOrderReturnIndexRepository,
  exactIndexMatches,
  migrationPlan,
  orderedKeyEquals,
  runOrderReturnIndexMigration,
};
