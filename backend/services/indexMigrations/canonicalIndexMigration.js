'use strict';

class CanonicalIndexMigrationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalIndexMigrationError';
    this.code = code;
    this.details = details;
  }
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, clone(entry)])
  );
}

function orderedKeyEquals(left = {}, right = {}) {
  const leftEntries = Object.entries(left || {});
  const rightEntries = Object.entries(right || {});
  return leftEntries.length === rightEntries.length && leftEntries.every(
    ([key, value], index) =>
      rightEntries[index]?.[0] === key && rightEntries[index]?.[1] === value
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

function normalizedSemanticOptions(options = {}) {
  return {
    unique: options.unique === true,
    sparse: options.sparse === true,
    expireAfterSeconds:
      options.expireAfterSeconds === undefined
        ? null
        : Number(options.expireAfterSeconds),
    partialFilterExpression: options.partialFilterExpression || null,
    collation: options.collation || null,
    hidden: options.hidden === true,
  };
}

function semanticOptionsEqual(existing = {}, expected = {}) {
  return JSON.stringify(canonicalObject(normalizedSemanticOptions(existing))) ===
    JSON.stringify(canonicalObject(normalizedSemanticOptions(expected)));
}

function cloneDefinitions(definitions = []) {
  return definitions.map((definition) => clone(definition));
}

function analyzeExistingIndexes(existingIndexes = [], definitions = [], codePrefix) {
  const analysis = [];
  const conflicts = [];

  for (const definition of definitions) {
    const sameName = existingIndexes.find(
      (index) => index.name === definition.options.name
    );
    const sameKey = existingIndexes.find((index) =>
      orderedKeyEquals(index.key, definition.key)
    );
    const existing = sameName || sameKey;

    if (!existing) {
      analysis.push({
        name: definition.options.name,
        status: 'missing',
        existingName: null,
      });
      continue;
    }

    const compatible =
      orderedKeyEquals(existing.key, definition.key) &&
      semanticOptionsEqual(existing, definition.options);
    if (!compatible) {
      conflicts.push({
        expectedName: definition.options.name,
        existingName: existing.name || '',
        expectedKey: clone(definition.key),
        existingKey: clone(existing.key || {}),
      });
      continue;
    }

    analysis.push({
      name: definition.options.name,
      status:
        existing.name === definition.options.name
          ? 'already_present'
          : 'already_present_equivalent',
      existingName: existing.name || null,
    });
  }

  if (conflicts.length) {
    throw new CanonicalIndexMigrationError(
      `${codePrefix}_CONFLICT`,
      'Existe al menos un índice incompatible. No se realizó ninguna escritura.',
      { conflicts }
    );
  }
  return analysis;
}

async function listIndexes(collection) {
  try {
    const cursor = collection.listIndexes();
    return typeof cursor?.toArray === 'function'
      ? await cursor.toArray()
      : await cursor;
  } catch (error) {
    if (Number(error?.code) === 26 || error?.codeName === 'NamespaceNotFound') {
      return [];
    }
    throw error;
  }
}

async function applyCanonicalIndexes({
  collection,
  definitions,
  codePrefix,
}) {
  if (
    !collection ||
    typeof collection.listIndexes !== 'function' ||
    typeof collection.createIndex !== 'function'
  ) {
    throw new TypeError(`${codePrefix}_COLLECTION_REQUIRED`);
  }

  const existing = await listIndexes(collection);
  const preflight = analyzeExistingIndexes(existing || [], definitions, codePrefix);
  const created = [];

  for (let index = 0; index < definitions.length; index += 1) {
    if (preflight[index].status !== 'missing') continue;
    const definition = definitions[index];
    const createdName = await collection.createIndex(
      clone(definition.key),
      clone(definition.options)
    );
    if (createdName && createdName !== definition.options.name) {
      throw new CanonicalIndexMigrationError(
        `${codePrefix}_NAME_MISMATCH`,
        'MongoDB no confirmó el nombre canónico del índice creado.',
        {
          expectedName: definition.options.name,
          createdName: String(createdName),
        }
      );
    }
    created.push(createdName || definition.options.name);
  }

  return {
    preflight,
    created,
    mutations: created.length,
    status:
      created.length === 0
        ? 'already_present'
        : created.length === definitions.length
          ? 'created'
          : 'partially_created',
  };
}

function createCanonicalIndexMigration(config = {}) {
  const definitions = cloneDefinitions(config.definitions);
  const allowedArguments = new Set([config.applyFlag, config.productionFlag]);

  function parseArguments(argv = []) {
    const unknown = argv.find((argument) => !allowedArguments.has(argument));
    if (unknown) {
      throw new CanonicalIndexMigrationError(
        `${config.codePrefix}_UNKNOWN_ARGUMENT`,
        'Se recibió un argumento no permitido para la migración.'
      );
    }
    return {
      apply: argv.includes(config.applyFlag),
      confirmProduction: argv.includes(config.productionFlag),
    };
  }

  function assertWriteAuthorization({ apply, confirmProduction, nodeEnv } = {}) {
    if (!apply) return;
    if (
      String(nodeEnv || '').trim().toLowerCase() === 'production' &&
      !confirmProduction
    ) {
      throw new CanonicalIndexMigrationError(
        `${config.codePrefix}_PRODUCTION_CONFIRMATION_REQUIRED`,
        `En producción también se requiere ${config.productionFlag}.`
      );
    }
  }

  function buildMigrationPlan() {
    return cloneDefinitions(definitions);
  }

  async function createIndexes(collection) {
    return applyCanonicalIndexes({
      collection,
      definitions: buildMigrationPlan(),
      codePrefix: config.codePrefix,
    });
  }

  async function runMigration({
    argv = [],
    nodeEnv = '',
    mongoUri = '',
    mongooseAdapter,
  } = {}) {
    const options = parseArguments(argv);
    const indexes = buildMigrationPlan();
    assertWriteAuthorization({ ...options, nodeEnv });
    const base = {
      ok: true,
      mode: options.apply ? 'apply' : 'dry-run',
      collection: config.collection,
      indexCount: indexes.length,
      indexes,
      destructiveOperations: [],
    };
    if (!options.apply) return { ...base, mutations: 0 };

    if (!/^mongodb(?:\+srv)?:\/\//i.test(String(mongoUri || '').trim())) {
      throw new CanonicalIndexMigrationError(
        `${config.codePrefix}_MONGODB_URI_REQUIRED`,
        'MONGODB_URI debe estar configurada para aplicar la migración.'
      );
    }
    if (!mongooseAdapter || typeof mongooseAdapter.connect !== 'function') {
      throw new TypeError(`${config.codePrefix}_MONGOOSE_ADAPTER_REQUIRED`);
    }

    await mongooseAdapter.connect(mongoUri, {
      autoIndex: false,
      serverSelectionTimeoutMS: 10_000,
    });
    try {
      const collection = mongooseAdapter.connection.collection(config.collection);
      const outcome = await createIndexes(collection);
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
      code: `${config.codePrefix}_FAILED`,
      message: 'No fue posible completar la migración de índices.',
    };
  }

  return Object.freeze({
    assertWriteAuthorization,
    buildMigrationPlan,
    createIndexes,
    parseArguments,
    runMigration,
    safeError,
  });
}

module.exports = {
  CanonicalIndexMigrationError,
  analyzeExistingIndexes,
  applyCanonicalIndexes,
  createCanonicalIndexMigration,
  listIndexes,
  orderedKeyEquals,
  semanticOptionsEqual,
};
