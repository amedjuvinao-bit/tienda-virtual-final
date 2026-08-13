/* eslint-disable no-console */
'use strict';

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const crypto = require('crypto');
const mongoose = require('mongoose');

const Favorite = require('../models/Favorite');
const Product = require('../models/Product');
const {
  normalizeProductVariants,
  resolveVariantCommercialSnapshot,
} = require('../lib/products/productVariantConfig');
const {
  canonicalizeFavoriteItems,
} = require('../services/favoriteOperationsService');

const PROFILES = Object.freeze([
  'recent',
  'high_intent',
  'high_value',
  'stale',
]);
const PROFILE_LABELS = Object.freeze({
  recent: 'reciente',
  high_intent: 'alta-intencion',
  high_value: 'valor-alto',
  stale: 'antigua',
});
const DEFAULT_OPTIONS = Object.freeze({
  sessions: 16,
  minItems: 1,
  maxItems: 7,
  catalogLimit: 250,
  label: '',
  confirmPersist: false,
});

function optionValue(argv, name) {
  const prefix = `--${name}=`;
  const entry = argv.find((value) => String(value).startsWith(prefix));
  return entry ? String(entry).slice(prefix.length) : undefined;
}

function boundedInteger(value, fallback, { name, min, max }) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max}.`);
  }
  return parsed;
}

function normalizeLabel(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  if (value && !normalized) {
    throw new Error('La etiqueta debe contener letras o números.');
  }
  return normalized;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sessions: boundedInteger(optionValue(argv, 'sessions'), DEFAULT_OPTIONS.sessions, {
      name: 'sessions',
      min: 4,
      max: 50,
    }),
    minItems: boundedInteger(optionValue(argv, 'min-items'), DEFAULT_OPTIONS.minItems, {
      name: 'min-items',
      min: 1,
      max: 20,
    }),
    maxItems: boundedInteger(optionValue(argv, 'max-items'), DEFAULT_OPTIONS.maxItems, {
      name: 'max-items',
      min: 3,
      max: 20,
    }),
    catalogLimit: boundedInteger(
      optionValue(argv, 'catalog-limit'),
      DEFAULT_OPTIONS.catalogLimit,
      { name: 'catalog-limit', min: 20, max: 1000 }
    ),
    label: normalizeLabel(optionValue(argv, 'label')),
    confirmPersist: argv.includes('--confirm-persist'),
  };
  if (options.minItems > options.maxItems) {
    throw new Error('min-items no puede superar max-items.');
  }
  return options;
}

function assertPersistentConfirmation(options) {
  if (options?.confirmPersist) return;
  const error = new Error(
    'Esta carga conserva los registros. Repite el comando con --confirm-persist.'
  );
  error.code = 'FAVORITES_TRACE_CONFIRMATION_REQUIRED';
  throw error;
}

function utcStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'z').toLowerCase();
}

function buildRunId({ now = new Date(), label = '', randomBytes = crypto.randomBytes } = {}) {
  const suffix = randomBytes(3).toString('hex');
  return ['fav_trace', normalizeLabel(label), utcStamp(now), suffix]
    .filter(Boolean)
    .join('_')
    .slice(0, 82);
}

function buildSessionId(runId, profile, index, randomBytes = crypto.randomBytes) {
  const safeProfile = PROFILE_LABELS[profile] || 'general';
  const sequence = String(index + 1).padStart(2, '0');
  return `${runId}_${safeProfile}_${sequence}_${randomBytes(3).toString('hex')}`.slice(0, 120);
}

function randomBetween(min, max, randomInt = crypto.randomInt) {
  if (max <= min) return min;
  return randomInt(min, max + 1);
}

function randomActivityDate(profile, now = new Date(), randomInt = crypto.randomInt) {
  const dayRanges = {
    recent: [0, 6],
    high_intent: [0, 20],
    high_value: [0, 45],
    stale: [31, 120],
  };
  const [minDays, maxDays] = dayRanges[profile] || [7, 30];
  const daysAgo = randomBetween(minDays, maxDays, randomInt);
  const hoursAgo = randomBetween(0, 22, randomInt);
  const minutesAgo = randomBetween(0, 59, randomInt);
  return new Date(
    now.getTime() -
      daysAgo * 24 * 60 * 60 * 1000 -
      hoursAgo * 60 * 60 * 1000 -
      minutesAgo * 60 * 1000
  );
}

function candidateKey(request = {}) {
  return `${request.productId || ''}|||${request.variantKey || ''}`;
}

function buildCandidatePool(products = []) {
  const pool = [];
  const seen = new Set();
  products.forEach((product) => {
    const productId = String(product?._id || '');
    if (!productId) return;
    const variants = normalizeProductVariants(product?.variants || [], product).filter(
      (variant) => variant.active !== false
    );
    const requests = variants.length
      ? variants.map((variant) => ({
          productId,
          variantKey: variant.variantKey,
          size: variant.size,
          color: variant.color,
          variantAttributes: variant.attributes,
        }))
      : [{ productId }];

    requests.forEach((request) => {
      const key = candidateKey(request);
      if (seen.has(key)) return;
      seen.add(key);
      const commercial = resolveVariantCommercialSnapshot(product, request);
      pool.push({
        request,
        estimatedPrice: Math.max(0, Number(commercial.price || product.price || 0)),
      });
    });
  });
  return pool;
}

function shuffle(values, randomInt = crypto.randomInt) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = randomInt(0, index + 1);
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

function selectCandidates(pool, count, profile, randomInt = crypto.randomInt) {
  if (profile === 'high_value') {
    return [...pool]
      .sort((left, right) => right.estimatedPrice - left.estimatedPrice)
      .slice(0, count)
      .map((candidate) => candidate.request);
  }
  return shuffle(pool, randomInt)
    .slice(0, count)
    .map((candidate) => candidate.request);
}

function itemCountForProfile(profile, options, poolSize, randomInt = crypto.randomInt) {
  const minimum = profile === 'high_intent'
    ? Math.max(3, options.minItems)
    : options.minItems;
  const maximum = Math.min(options.maxItems, poolSize);
  return randomBetween(Math.min(minimum, maximum), maximum, randomInt);
}

function buildTracePlan({
  runId,
  pool,
  options,
  now = new Date(),
  randomInt = crypto.randomInt,
  randomBytes = crypto.randomBytes,
}) {
  return Array.from({ length: options.sessions }, (_, index) => {
    const profile = PROFILES[index % PROFILES.length];
    const itemCount = itemCountForProfile(profile, options, pool.length, randomInt);
    return {
      sequence: index + 1,
      profile,
      sessionId: buildSessionId(runId, profile, index, randomBytes),
      activityAt: randomActivityDate(profile, now, randomInt),
      requests: selectCandidates(pool, itemCount, profile, randomInt),
    };
  });
}

async function loadCatalog(limit) {
  return Product.find({
    active: { $ne: false },
    visible: { $ne: false },
    archivedAt: null,
  })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit)
    .lean()
    .exec();
}

async function persistTraceEntry(entry) {
  const canonicalItems = await canonicalizeFavoriteItems(entry.requests);
  if (!canonicalItems.length) {
    throw new Error(`La sesión ${entry.sessionId} quedó sin productos canónicos.`);
  }
  const items = canonicalItems.map((item, index) => ({
    ...item,
    addedAt: new Date(entry.activityAt.getTime() - index * 17 * 60 * 1000),
  }));
  const createdAt = new Date(entry.activityAt.getTime() - 2 * 60 * 60 * 1000);
  const favorite = await Favorite.create({
    sessionId: entry.sessionId,
    items,
    lastCustomerActivityAt: entry.activityAt,
    createdAt,
    updatedAt: entry.activityAt,
  });

  // Los timestamps sintéticos permiten comprobar las vistas reciente/antigua.
  await Favorite.updateOne(
    { _id: favorite._id },
    {
      $set: {
        createdAt,
        updatedAt: entry.activityAt,
        lastCustomerActivityAt: entry.activityAt,
      },
    },
    { timestamps: false }
  ).exec();

  const persisted = await Favorite.findById(favorite._id).lean().exec();
  if (!persisted || persisted.sessionId !== entry.sessionId || !persisted.items?.length) {
    throw new Error(`No se pudo verificar la persistencia de ${entry.sessionId}.`);
  }
  return persisted;
}

function money(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function printEntry(entry, favorite) {
  const value = favorite.items.reduce((sum, item) => sum + Number(item.price || 0), 0);
  console.log(
    `OK ${String(entry.sequence).padStart(2, '0')} | ${PROFILE_LABELS[entry.profile]}` +
      ` | ${favorite.items.length} productos | ${money(value)} | ${entry.sessionId}`
  );
  return value;
}

async function run(options = parseArgs()) {
  assertPersistentConfirmation(options);
  const mongoUri =
    process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI || '';
  if (!mongoUri) {
    throw new Error('Falta MONGODB_URI, MONGO_URI o DB_URI en backend/.env.');
  }

  await mongoose.connect(mongoUri);
  const runId = buildRunId({ label: options.label });
  const beforeCount = await Favorite.countDocuments({}).exec();
  const products = await loadCatalog(options.catalogLimit);
  const pool = buildCandidatePool(products);
  if (pool.length < 3) {
    throw new Error(
      'Se necesitan al menos tres productos o variantes activos para una traza útil.'
    );
  }

  const plan = buildTracePlan({ runId, pool, options });
  const created = [];
  let totalItems = 0;
  let potentialValue = 0;

  console.log('\n=== Inyección persistente de Favoritos ===');
  console.log(`Base: ${mongoose.connection.name}`);
  console.log(`Host: ${mongoose.connection.host}`);
  console.log(`Ejecución trazable: ${runId}`);
  console.log(`Productos/variantes disponibles: ${pool.length}`);
  console.log('No se ejecutará limpieza automática.\n');

  for (const entry of plan) {
    const favorite = await persistTraceEntry(entry);
    created.push(favorite);
    totalItems += favorite.items.length;
    potentialValue += printEntry(entry, favorite);
  }

  const ids = created.map((favorite) => favorite._id);
  const verified = await Favorite.countDocuments({ _id: { $in: ids } }).exec();
  const afterCount = await Favorite.countDocuments({}).exec();
  if (verified !== created.length || afterCount < beforeCount + created.length) {
    throw new Error('La verificación final de persistencia no coincide con la carga.');
  }

  console.log('\n=== Resultado ===');
  console.log(`Sesiones creadas y verificadas: ${verified}`);
  console.log(`Productos favoritos acumulados: ${totalItems}`);
  console.log(`Valor potencial acumulado: ${money(potentialValue)}`);
  console.log(`Documentos antes/después: ${beforeCount} -> ${afterCount}`);
  console.log(`Buscar en el panel: ${runId}`);
  console.log('Persistencia: CONSERVADA (sin limpieza).');

  return { runId, created: verified, totalItems, potentialValue, beforeCount, afterCount };
}

async function main() {
  try {
    await run(parseArgs());
  } catch (error) {
    console.error(`\nERROR: ${error.message}`);
    console.error('Los registros que hayan alcanzado a guardarse se conservan para trazabilidad.');
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

if (require.main === module) main();

module.exports = {
  DEFAULT_OPTIONS,
  PROFILES,
  assertPersistentConfirmation,
  buildCandidatePool,
  buildRunId,
  buildSessionId,
  buildTracePlan,
  normalizeLabel,
  parseArgs,
  randomActivityDate,
  run,
  selectCandidates,
};
