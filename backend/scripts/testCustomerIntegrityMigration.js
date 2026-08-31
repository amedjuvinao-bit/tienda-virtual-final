'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  APPLY_FLAG,
  PRODUCTION_CONFIRMATION_FLAG,
  analyzeIndexes,
  buildIndexPlan,
  parseArguments,
  runCustomerIntegrityMigration,
} = require('../services/customerIntegrityMigrationService');

class FakeRepository {
  constructor(customers = [], existingIndexes = {}, followUps = []) {
    this.customers = customers;
    this.followUps = followUps;
    this.existingIndexes = existingIndexes;
    this.bulkWrites = [];
    this.followUpBulkWrites = [];
    this.createdIndexes = [];
  }

  async listCustomers() {
    return this.customers;
  }

  async listCustomerOrderBranches() {
    return new Map(
      this.customers.map((customer) => [
        String(customer._id),
        customer.linkedOrderBranchIds || [],
      ])
    );
  }

  async listCustomerFollowUps() {
    return this.followUps;
  }

  async listIndexes(collection) {
    return this.existingIndexes[collection] || [];
  }

  async bulkWriteCustomers(operations) {
    this.bulkWrites.push(...operations);
    for (const operation of operations) {
      const id = String(operation.updateOne.filter._id);
      const customer = this.customers.find((item) => String(item._id) === id);
      if (customer) Object.assign(customer, operation.updateOne.update.$set);
    }
    return { modifiedCount: operations.length };
  }

  async bulkWriteCustomerFollowUps(operations) {
    this.followUpBulkWrites.push(...operations);
    for (const operation of operations) {
      const id = String(operation.updateOne.filter._id);
      const followUp = this.followUps.find((item) => String(item._id) === id);
      if (followUp) Object.assign(followUp, operation.updateOne.update.$set);
    }
    return { modifiedCount: operations.length };
  }

  async createIndex(collection, key, options) {
    this.createdIndexes.push({ collection, key, options });
    this.existingIndexes[collection] = [
      ...(this.existingIndexes[collection] || []),
      { key, ...options },
    ];
    return options.name;
  }
}

let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

async function main() {
  const branchId = '64c000000000000000000001';
  const customers = [
    {
      _id: '64d000000000000000000001',
      customerCode: 'CLI-001',
      fullName: 'Cliente Uno',
      phone: '300 123 4567',
      normalizedPhone: '3001234567',
      email: 'UNO@EXAMPLE.COM',
      normalizedEmail: 'uno@example.com',
      documentType: 'PP',
      documentNumber: 'AB-123',
      normalizedDocument: '123',
      country: 'CO',
      defaultBranch: branchId,
      branchIds: [],
      linkedOrderBranchIds: ['64c000000000000000000002'],
      deletedAt: null,
    },
  ];
  const followUps = [
    {
      _id: '64e000000000000000000001',
      customer: customers[0]._id,
      branch: null,
    },
  ];

  const plan = buildIndexPlan();
  ok(
    'el plan cubre customers y customerfollowups',
    plan.some((item) => item.collection === 'customers') &&
      plan.some((item) => item.collection === 'customerfollowups')
  );
  ok(
    'el plan incluye tres identidades únicas y consultas por sede',
    plan.filter((item) => item.options.unique === true).length >= 4 &&
      plan.some((item) => item.options.name === 'customer_branch_status_recent')
  );
  ok(
    'los argumentos de aplicación y producción son explícitos',
    parseArguments([APPLY_FLAG, PRODUCTION_CONFIRMATION_FLAG]).apply === true
  );

  const legacyIndexes = {
    customers: [
      {
        name: 'customerCode_1',
        key: { customerCode: 1 },
        unique: true,
        sparse: true,
      },
      {
        name: 'normalizedPhone_1',
        key: { normalizedPhone: 1 },
        partialFilterExpression: {
          normalizedPhone: { $type: 'string', $ne: '' },
        },
      },
      {
        name: 'active_1_deletedAt_1_createdAt_-1',
        key: { active: 1, deletedAt: 1, createdAt: -1 },
      },
      {
        name: 'fullName_text_phone_text_email_text_documentNumber_text_customerCode_text',
        key: {
          fullName: 'text',
          phone: 'text',
          email: 'text',
          documentNumber: 'text',
          customerCode: 'text',
        },
      },
    ],
    customerfollowups: [
      {
        name: 'customer_1_deletedAt_1_createdAt_-1',
        key: { customer: 1, deletedAt: 1, createdAt: -1 },
      },
    ],
  };
  const legacyAnalysis = analyzeIndexes(legacyIndexes, plan);
  ok(
    'los índices nuevos conviven con los índices heredados sin eliminarlos',
    legacyAnalysis.some(
      (item) =>
        item.definition.options.name === 'customer_phone_identity_unique' &&
        item.status === 'missing'
    ) &&
      legacyAnalysis.some(
        (item) =>
          item.definition.options.name === 'customerCode_1' &&
          item.status === 'already_present'
      )
  );

  const dryRepository = new FakeRepository(
    structuredClone(customers),
    {},
    structuredClone(followUps)
  );
  const dryRun = await runCustomerIntegrityMigration({
    repository: dryRepository,
  });
  ok(
    'dry-run audita datos reales sin escribir ni crear índices',
    dryRun.mode === 'dry-run' &&
      dryRun.customersScanned === 1 &&
      dryRun.customersToNormalize === 1 &&
      dryRun.followUpsToBackfill === 1 &&
      dryRepository.bulkWrites.length === 0 &&
      dryRepository.followUpBulkWrites.length === 0 &&
      dryRepository.createdIndexes.length === 0
  );

  await assert.rejects(
    () =>
      runCustomerIntegrityMigration({
        repository: new FakeRepository(structuredClone(customers)),
        apply: true,
        nodeEnv: 'production',
      }),
    (error) =>
      error.code === 'CUSTOMER_INTEGRITY_PRODUCTION_CONFIRMATION_REQUIRED'
  );
  ok('producción exige confirmación adicional antes de leer o escribir');

  const duplicateRepository = new FakeRepository([
    ...structuredClone(customers),
    {
      ...structuredClone(customers[0]),
      _id: '64d000000000000000000002',
      customerCode: 'CLI-002',
      phone: '+57 300 123 4567',
      email: 'dos@example.com',
      normalizedEmail: 'dos@example.com',
      documentNumber: 'XY-999',
    },
  ]);
  await assert.rejects(
    () => runCustomerIntegrityMigration({ repository: duplicateRepository }),
    (error) =>
      error.code === 'CUSTOMER_IDENTITY_DUPLICATES_FOUND' &&
      error.details.duplicateGroups.some((group) => group.identityType === 'phone')
  );
  ok('la identidad canónica detecta duplicados antes de cualquier escritura');
  ok(
    'un preflight fallido no normaliza datos ni crea índices',
    duplicateRepository.bulkWrites.length === 0 &&
      duplicateRepository.createdIndexes.length === 0
  );

  const applyRepository = new FakeRepository(
    structuredClone(customers),
    {},
    structuredClone(followUps)
  );
  const applied = await runCustomerIntegrityMigration({
    repository: applyRepository,
    apply: true,
    confirmProduction: true,
    nodeEnv: 'production',
  });
  ok(
    'apply normaliza primero y crea únicamente índices faltantes',
    applied.normalizedCustomers === 1 &&
      applyRepository.bulkWrites.length === 1 &&
      applyRepository.followUpBulkWrites.length === 1 &&
      applyRepository.createdIndexes.length === plan.length
  );
  ok(
    'la normalización aplicada conserva letras del pasaporte y agrega la sede',
    applyRepository.customers[0].normalizedDocument === 'AB123' &&
      applyRepository.customers[0].normalizedPhone === '+573001234567' &&
      applyRepository.customers[0].branchIds.includes(branchId) &&
      applyRepository.customers[0].branchIds.includes('64c000000000000000000002')
  );
  ok(
    'los seguimientos heredados reciben una sede inequívoca sin alterar la nota',
    applyRepository.followUps[0].branch === branchId
  );

  const second = await runCustomerIntegrityMigration({
    repository: applyRepository,
    apply: true,
    confirmProduction: true,
    nodeEnv: 'production',
  });
  ok(
    'una segunda ejecución es idempotente',
    second.customersToNormalize === 0 &&
      second.createdIndexes.length === 0 &&
      second.mutations === 0
  );

  const conflictRepository = new FakeRepository(structuredClone(customers), {
    customers: [
      {
        name: 'customer_email_identity_unique',
        key: { email: 1 },
        unique: true,
      },
    ],
  });
  await assert.rejects(
    () => runCustomerIntegrityMigration({ repository: conflictRepository }),
    (error) => error.code === 'CUSTOMER_INDEX_CONFLICT'
  );
  ok('un índice canónico incompatible detiene el proceso sin mutaciones');

  const migrationSource = fs.readFileSync(
    path.join(__dirname, 'migrateCustomerIntegrity.js'),
    'utf8'
  );
  ok(
    'el ejecutor no borra datos ni usa syncIndexes',
    !/deleteOne|deleteMany|dropIndex|dropIndexes|syncIndexes/.test(migrationSource)
  );

  console.log(`\nMigración Clientes: ${controls}/${controls} controles superados.`);
}

main().catch((error) => {
  console.error('FAIL migración de Clientes');
  console.error(error);
  process.exitCode = 1;
});
