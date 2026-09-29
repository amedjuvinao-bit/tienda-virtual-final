'use strict';

const assert = require('node:assert/strict');
const { evaluate, inspect } = require('./validateAdminAccessReadOnly');
const roleIndex = require('../models/adminRoleDefaultIndex');
const branchIndexes = require('../models/branchSelectionIndexes');

const index = ({ key, options }) => ({
  name: options.name, key, unique: true,
  partialFilterExpression: options.partialFilterExpression,
});

const fixture = () => ({
  users: [{ _id: 'u1', role: 'owner', roleRef: 'r1', active: true, status: 'active',
    defaultBranch: 'b1', branches: [{ branch: 'b1', isDefault: true }] }],
  roles: [{ _id: 'r1', code: 'owner', active: true, status: 'active', isDefault: true }],
  branches: [{ _id: 'b1', active: true, status: 'active', isMain: true,
    isDefaultForOnlineOrders: true }],
  roleIndexes: [index(roleIndex)],
  branchIndexes: branchIndexes.map(index),
});

const codes = (result, field = 'blockers') => result[field].map((item) => item.code);

async function main() {
  assert.equal(evaluate(fixture()).relationshipsReady, true);

  const broken = fixture();
  broken.roles[0].code = 'admin';
  broken.users[0].defaultBranch = 'b2';
  broken.users[0].branches.push({ branch: 'b2', isDefault: false });
  broken.branchIndexes = [];
  assert.deepEqual(codes(evaluate(broken)), [
    'active_owner_missing', 'active_user_branch_unavailable', 'active_user_role_mismatch',
    'required_index_missing', 'user_default_branch_mismatch',
  ]);
  assert.equal(evaluate(broken).blockers.find((item) =>
    item.code === 'required_index_missing').count, 2);

  const legacy = fixture();
  legacy.users[0].roleRef = null;
  assert.equal(evaluate(legacy).relationshipsReady, true);
  assert.deepEqual(codes(evaluate(legacy), 'warnings'), ['legacy_user_without_role_ref']);

  const inactive = fixture();
  inactive.users[0].active = false;
  inactive.users[0].status = 'inactive';
  inactive.users[0].roleRef = 'missing';
  assert.equal(evaluate(inactive).relationshipsReady, false);
  assert.deepEqual(codes(evaluate(inactive), 'warnings'), ['inactive_user_role_unavailable']);
  assert.deepEqual(codes(evaluate(inactive)), ['active_owner_missing']);

  const missingDefaults = fixture();
  missingDefaults.roles[0].isDefault = false;
  missingDefaults.branches[0].active = false;
  assert.deepEqual(codes(evaluate(missingDefaults)), [
    'active_user_branch_unavailable', 'main_branch_invalid', 'online_branch_invalid',
    'default_role_invalid',
  ].sort());

  // The database adapter must issue only list/find operations. No test data is written.
  const collections = fixture();
  const values = {
    adminusers: collections.users, adminroles: collections.roles, branches: collections.branches,
  };
  const indexes = {
    adminroles: collections.roleIndexes, branches: collections.branchIndexes,
  };
  const calls = [];
  const db = {
    listCollections({ name }) {
      calls.push(`list:${name}`);
      return { hasNext: async () => name in values };
    },
    collection(name) {
      return {
        find(filter, options) {
          calls.push(`find:${name}`);
          assert.deepEqual(filter, { deletedAt: null });
          assert.ok(options.projection);
          assert.ok(!('passwordHash' in options.projection));
          return { toArray: async () => values[name] };
        },
        listIndexes() {
          calls.push(`indexes:${name}`);
          return { toArray: async () => indexes[name] };
        },
      };
    },
  };
  assert.equal((await inspect(db)).relationshipsReady, true);
  assert.ok(calls.every((call) => /^(list|find|indexes):/.test(call)));
  process.stdout.write('Auditoría de accesos: casos válidos, inconsistencias y lectura exclusiva OK.\n');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
