'use strict';

const mongoose = require('mongoose');
const { env } = require('../config/env');
const {
  parseArguments,
  runCustomerIntegrityMigration,
  safeError,
} = require('../services/customerIntegrityMigrationService');

function isNamespaceNotFound(error) {
  return Number(error?.code) === 26 || error?.codeName === 'NamespaceNotFound';
}

function createMongoRepository(connection) {
  return {
    async listCustomers() {
      return connection
        .collection('customers')
        .find(
          {},
          {
            projection: {
              _id: 1,
              customerCode: 1,
              fullName: 1,
              phone: 1,
              normalizedPhone: 1,
              email: 1,
              normalizedEmail: 1,
              documentType: 1,
              documentNumber: 1,
              normalizedDocument: 1,
              country: 1,
              defaultBranch: 1,
              branchIds: 1,
              deletedAt: 1,
            },
          }
        )
        .toArray();
    },
    async listCustomerOrderBranches() {
      const rows = await connection.collection('orders').aggregate([
        {
          $match: {
            'customer.customerId': { $type: 'objectId' },
          },
        },
        {
          $project: {
            customerId: '$customer.customerId',
            branches: {
              $setUnion: [
                {
                  $cond: [
                    { $ne: ['$branch', null] },
                    ['$branch'],
                    [],
                  ],
                },
                {
                  $map: {
                    input: { $ifNull: ['$inventoryAllocations', []] },
                    as: 'allocation',
                    in: '$$allocation.branch',
                  },
                },
              ],
            },
          },
        },
        { $unwind: '$branches' },
        { $match: { branches: { $ne: null } } },
        {
          $group: {
            _id: '$customerId',
            branchIds: { $addToSet: '$branches' },
          },
        },
      ]).toArray();

      return new Map(
        rows.map((row) => [
          String(row._id),
          (row.branchIds || []).map(String),
        ])
      );
    },
    async listCustomerFollowUps() {
      return connection
        .collection('customerfollowups')
        .find(
          {},
          {
            projection: {
              _id: 1,
              customer: 1,
              branch: 1,
            },
          }
        )
        .toArray();
    },
    async listIndexes(collectionName) {
      try {
        return await connection.collection(collectionName).listIndexes().toArray();
      } catch (error) {
        if (isNamespaceNotFound(error)) return [];
        throw error;
      }
    },
    async bulkWriteCustomers(operations) {
      const normalizedOperations = operations.map((operation) => {
        const branchIds = operation?.updateOne?.update?.$set?.branchIds;
        if (!Array.isArray(branchIds)) return operation;
        return {
          updateOne: {
            ...operation.updateOne,
            update: {
              ...operation.updateOne.update,
              $set: {
                ...operation.updateOne.update.$set,
                branchIds: branchIds
                  .filter((branchId) => mongoose.Types.ObjectId.isValid(branchId))
                  .map((branchId) => new mongoose.Types.ObjectId(branchId)),
              },
            },
          },
        };
      });
      return connection.collection('customers').bulkWrite(normalizedOperations, {
        ordered: true,
      });
    },
    async bulkWriteCustomerFollowUps(operations) {
      const normalizedOperations = operations.map((operation) => {
        const branchId = operation?.updateOne?.update?.$set?.branch;
        if (!mongoose.Types.ObjectId.isValid(String(branchId || ''))) {
          return operation;
        }
        return {
          updateOne: {
            ...operation.updateOne,
            update: {
              ...operation.updateOne.update,
              $set: {
                ...operation.updateOne.update.$set,
                branch: new mongoose.Types.ObjectId(String(branchId)),
              },
            },
          },
        };
      });
      return connection
        .collection('customerfollowups')
        .bulkWrite(normalizedOperations, { ordered: true });
    },
    async createIndex(collectionName, key, options) {
      return connection.collection(collectionName).createIndex(key, options);
    },
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);

  if (!/^mongodb(?:\+srv)?:\/\//i.test(String(env.mongoUri || '').trim())) {
    throw new Error('MONGODB_URI debe estar configurada para auditar Clientes.');
  }

  await mongoose.connect(env.mongoUri, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });
  try {
    const result = await runCustomerIntegrityMigration({
      repository: createMongoRepository(mongoose.connection),
      apply: options.apply,
      confirmProduction: options.confirmProduction,
      nodeEnv: env.nodeEnv,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, ...safeError(error) }, null, 2)}\n`);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => null);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  createMongoRepository,
  main,
};
