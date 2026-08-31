'use strict';

const {
  buildCustomerIdentity,
  cleanUpper,
} = require('../lib/customers/customerIdentity');
const {
  CUSTOMER_FOLLOW_UP_INDEX_DEFINITIONS,
  CUSTOMER_INDEX_DEFINITIONS,
  cloneDefinitions,
} = require('../models/customerIndexDefinitions');
const {
  orderedKeyEquals,
  semanticOptionsEqual,
} = require('./indexMigrations/canonicalIndexMigration');

const APPLY_FLAG = '--apply-customer-integrity-migration';
const PRODUCTION_CONFIRMATION_FLAG =
  '--confirm-production-customer-integrity-migration';

class CustomerIntegrityMigrationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CustomerIntegrityMigrationError';
    this.code = code;
    this.details = details;
  }
}

function parseArguments(argv = []) {
  const allowed = new Set([APPLY_FLAG, PRODUCTION_CONFIRMATION_FLAG]);
  const unknown = argv.find((argument) => !allowed.has(argument));
  if (unknown) {
    throw new CustomerIntegrityMigrationError(
      'CUSTOMER_INTEGRITY_MIGRATION_UNKNOWN_ARGUMENT',
      'Se recibió un argumento no permitido para la migración de Clientes.'
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
    throw new CustomerIntegrityMigrationError(
      'CUSTOMER_INTEGRITY_PRODUCTION_CONFIRMATION_REQUIRED',
      `En producción también se requiere ${PRODUCTION_CONFIRMATION_FLAG}.`
    );
  }
}

function buildIndexPlan() {
  return [
    ...cloneDefinitions(CUSTOMER_INDEX_DEFINITIONS).map((definition) => ({
      collection: 'customers',
      ...definition,
    })),
    ...cloneDefinitions(CUSTOMER_FOLLOW_UP_INDEX_DEFINITIONS).map(
      (definition) => ({ collection: 'customerfollowups', ...definition })
    ),
  ];
}

function normalizeBranchIds(customer = {}, linkedBranches = []) {
  return [
    ...(Array.isArray(customer.branchIds) ? customer.branchIds : []),
    customer.defaultBranch,
    ...(Array.isArray(linkedBranches) ? linkedBranches : []),
  ]
    .filter(Boolean)
    .map(String)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function addIdentity(map, key, customer, type) {
  if (!key || customer.deletedAt) return;
  const entries = map.get(key) || [];
  entries.push({
    id: String(customer._id || customer.id || ''),
    customerCode: customer.customerCode || '',
    fullName: customer.fullName || '',
    type,
  });
  map.set(key, entries);
}

function analyzeCustomers(customers = [], orderBranchesByCustomer = new Map()) {
  const identityMaps = {
    customerCode: new Map(),
    email: new Map(),
    phone: new Map(),
    document: new Map(),
  };
  const updates = [];

  for (const customer of customers) {
    const identity = buildCustomerIdentity(customer);
    const branchIds = normalizeBranchIds(
      customer,
      orderBranchesByCustomer.get(String(customer._id || customer.id || '')) || []
    );
    const customerCode = cleanUpper(customer.customerCode, 80);
    const documentKey = identity.normalizedDocument
      ? `${identity.documentType}:${identity.normalizedDocument}`
      : '';

    addIdentity(
      identityMaps.customerCode,
      customerCode,
      customer,
      'customerCode'
    );
    addIdentity(identityMaps.email, identity.normalizedEmail, customer, 'email');
    addIdentity(identityMaps.phone, identity.normalizedPhone, customer, 'phone');
    addIdentity(identityMaps.document, documentKey, customer, 'document');

    const currentBranchIds = (Array.isArray(customer.branchIds)
      ? customer.branchIds
      : [])
      .map(String)
      .filter((value, index, values) => values.indexOf(value) === index);
    const changed =
      String(customer.normalizedEmail || '') !== identity.normalizedEmail ||
      String(customer.normalizedPhone || '') !== identity.normalizedPhone ||
      String(customer.normalizedDocument || '') !== identity.normalizedDocument ||
      String(customer.documentType || '') !== identity.documentType ||
      JSON.stringify(currentBranchIds.sort()) !== JSON.stringify([...branchIds].sort());

    if (changed) {
      updates.push({
        updateOne: {
          filter: { _id: customer._id },
          update: {
            $set: {
              normalizedEmail: identity.normalizedEmail,
              normalizedPhone: identity.normalizedPhone,
              normalizedDocument: identity.normalizedDocument,
              documentType: identity.documentType,
              branchIds,
            },
          },
        },
      });
    }
  }

  const duplicateGroups = Object.entries(identityMaps).flatMap(
    ([identityType, map]) =>
      [...map.entries()]
        .filter(([, matches]) => matches.length > 1)
        .map(([value, matches]) => ({ identityType, value, matches }))
  );

  return {
    scanned: customers.length,
    updates,
    updateCount: updates.length,
    duplicateGroups,
  };
}

function analyzeFollowUps(
  followUps = [],
  customers = [],
  orderBranchesByCustomer = new Map()
) {
  const customerBranches = new Map(
    customers.map((customer) => {
      const customerId = String(customer._id || customer.id || '');
      const branchIds = normalizeBranchIds(
        customer,
        orderBranchesByCustomer.get(customerId) || []
      );
      const defaultBranch = customer.defaultBranch
        ? String(customer.defaultBranch)
        : '';
      return [customerId, { branchIds, defaultBranch }];
    })
  );
  const updates = [];
  let ambiguous = 0;

  for (const followUp of followUps) {
    if (followUp.branch) continue;

    const customerId = String(followUp.customer || '');
    const scope = customerBranches.get(customerId);
    const branchId = scope?.defaultBranch ||
      (scope?.branchIds?.length === 1 ? scope.branchIds[0] : '');

    if (!branchId) {
      ambiguous += 1;
      continue;
    }

    updates.push({
      updateOne: {
        filter: { _id: followUp._id, branch: null },
        update: { $set: { branch: branchId } },
      },
    });
  }

  return {
    scanned: followUps.length,
    updates,
    updateCount: updates.length,
    ambiguous,
  };
}

function analyzeIndexes(existingByCollection = {}, definitions = buildIndexPlan()) {
  const results = [];
  const conflicts = [];

  for (const definition of definitions) {
    const existing = existingByCollection[definition.collection] || [];
    const sameName = existing.find(
      (index) => index.name === definition.options.name
    );
    const sameKey = existing.find((index) =>
      orderedKeyEquals(index.key, definition.key)
    );
    const current = sameName || sameKey;

    if (current) {
      const exact =
        orderedKeyEquals(current.key, definition.key) &&
        semanticOptionsEqual(current, definition.options);
      if (!exact) {
        conflicts.push({
          collection: definition.collection,
          expectedName: definition.options.name,
          existingName: current.name || '',
        });
      } else {
        results.push({
          definition,
          status:
            current.name === definition.options.name
              ? 'already_present'
              : 'already_present_equivalent',
        });
      }
      continue;
    }

    results.push({ definition, status: 'missing' });
  }

  if (conflicts.length) {
    throw new CustomerIntegrityMigrationError(
      'CUSTOMER_INDEX_CONFLICT',
      'Existe al menos un índice de Clientes con el nombre canónico y una definición incompatible.',
      { conflicts }
    );
  }

  return results;
}

async function runCustomerIntegrityMigration({
  repository,
  apply = false,
  confirmProduction = false,
  nodeEnv = '',
} = {}) {
  assertWriteAuthorization({ apply, confirmProduction, nodeEnv });

  if (
    !repository ||
    typeof repository.listCustomers !== 'function' ||
    typeof repository.listCustomerOrderBranches !== 'function' ||
    typeof repository.listCustomerFollowUps !== 'function' ||
    typeof repository.listIndexes !== 'function'
  ) {
    throw new TypeError('CUSTOMER_INTEGRITY_REPOSITORY_REQUIRED');
  }

  const indexPlan = buildIndexPlan();
  const collections = [...new Set(indexPlan.map((item) => item.collection))];
  const existingByCollection = {};
  for (const collection of collections) {
    existingByCollection[collection] =
      (await repository.listIndexes(collection)) || [];
  }
  const indexAnalysis = analyzeIndexes(existingByCollection, indexPlan);
  const customers = await repository.listCustomers();
  const orderBranchesByCustomer = await repository.listCustomerOrderBranches();
  const customerAnalysis = analyzeCustomers(
    customers,
    orderBranchesByCustomer instanceof Map
      ? orderBranchesByCustomer
      : new Map(Object.entries(orderBranchesByCustomer || {}))
  );
  const followUps = await repository.listCustomerFollowUps();
  const followUpAnalysis = analyzeFollowUps(
    followUps,
    customers,
    orderBranchesByCustomer instanceof Map
      ? orderBranchesByCustomer
      : new Map(Object.entries(orderBranchesByCustomer || {}))
  );

  if (customerAnalysis.duplicateGroups.length) {
    throw new CustomerIntegrityMigrationError(
      'CUSTOMER_IDENTITY_DUPLICATES_FOUND',
      'Se encontraron identidades duplicadas. Deben fusionarse antes de crear los índices únicos.',
      { duplicateGroups: customerAnalysis.duplicateGroups.slice(0, 50) }
    );
  }

  const base = {
    ok: true,
    mode: apply ? 'apply' : 'dry-run',
    customersScanned: customerAnalysis.scanned,
    customersToNormalize: customerAnalysis.updateCount,
    followUpsScanned: followUpAnalysis.scanned,
    followUpsToBackfill: followUpAnalysis.updateCount,
    ambiguousFollowUps: followUpAnalysis.ambiguous,
    indexCount: indexPlan.length,
    missingIndexes: indexAnalysis.filter((item) => item.status === 'missing').length,
    destructiveOperations: [],
  };

  if (!apply) return { ...base, mutations: 0 };
  if (
    typeof repository.bulkWriteCustomers !== 'function' ||
    typeof repository.bulkWriteCustomerFollowUps !== 'function' ||
    typeof repository.createIndex !== 'function'
  ) {
    throw new TypeError('CUSTOMER_INTEGRITY_WRITE_REPOSITORY_REQUIRED');
  }

  let normalizedCustomers = 0;
  if (customerAnalysis.updates.length) {
    const outcome = await repository.bulkWriteCustomers(
      customerAnalysis.updates
    );
    normalizedCustomers = Number(
      outcome?.modifiedCount ?? outcome?.nModified ?? customerAnalysis.updateCount
    );
  }

  let backfilledFollowUps = 0;
  if (followUpAnalysis.updates.length) {
    const outcome = await repository.bulkWriteCustomerFollowUps(
      followUpAnalysis.updates
    );
    backfilledFollowUps = Number(
      outcome?.modifiedCount ??
        outcome?.nModified ??
        followUpAnalysis.updateCount
    );
  }

  const createdIndexes = [];
  for (const item of indexAnalysis) {
    if (item.status !== 'missing') continue;
    const name = await repository.createIndex(
      item.definition.collection,
      item.definition.key,
      item.definition.options
    );
    createdIndexes.push({
      collection: item.definition.collection,
      name: name || item.definition.options.name,
    });
  }

  return {
    ...base,
    normalizedCustomers,
    backfilledFollowUps,
    createdIndexes,
    mutations:
      normalizedCustomers + backfilledFollowUps + createdIndexes.length,
  };
}

function safeError(error) {
  if (error instanceof CustomerIntegrityMigrationError) {
    return {
      code: error.code,
      message: error.message,
      ...(Object.keys(error.details || {}).length
        ? { details: error.details }
        : {}),
    };
  }
  return {
    code: 'CUSTOMER_INTEGRITY_MIGRATION_FAILED',
    message: 'No fue posible completar la migración de integridad de Clientes.',
  };
}

module.exports = {
  APPLY_FLAG,
  PRODUCTION_CONFIRMATION_FLAG,
  CustomerIntegrityMigrationError,
  analyzeCustomers,
  analyzeFollowUps,
  analyzeIndexes,
  assertWriteAuthorization,
  buildIndexPlan,
  parseArguments,
  runCustomerIntegrityMigration,
  safeError,
};
