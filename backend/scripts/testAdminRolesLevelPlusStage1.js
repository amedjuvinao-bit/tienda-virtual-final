const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AdminRole = require('../models/AdminRole');
const AdminUser = require('../models/AdminUser');
const router = require('../routes/adminRoles');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');

const id = new mongoose.Types.ObjectId();
const owner = { adminRole: 'owner', adminUserId: String(new mongoose.Types.ObjectId()) };

function handler(path, method) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods?.[method]);
  assert.ok(layer, `Missing ${method} ${path}`);
  return layer.route.stack.at(-1).handle;
}

function response() {
  return {
    statusCode: 200,
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

async function main() {
  const statusAudit = findAdminRoutePermission(
    'PATCH', '/api/admin/roles/507f1f77bcf86cd799439011/status'
  );
  assert.equal(statusAudit?.permission, 'roles:disable');
  assert.equal(statusAudit?.audit, true);
  const original = {
    find: AdminRole.find, findOne: AdminRole.findOne,
    countRoles: AdminRole.countDocuments, countUsers: AdminUser.countDocuments,
    aggregate: AdminUser.aggregate,
  };
  const role = () => ({
    _id: id, code: 'cashier', name: 'Cajero', active: true, status: 'active',
    isSystem: false, isDefault: false, permissions: ['pos:view'], scope: 'branch', level: 50,
    async save() { this.saved = true; },
    toSafeObject() { return { active: this.active, status: this.status }; },
  });
  try {
    AdminRole.countDocuments = async () => 1;
    AdminRole.find = () => ({ sort() { return this; }, skip() { return this; },
      limit() { return this; }, async lean() { return [role()]; } });
    AdminUser.aggregate = async (pipeline) => {
      assert.deepEqual(pipeline[0].$match.$or[1], {
        roleRef: null, role: { $in: ['cashier'] },
      });
      return [{ _id: id, count: 2 }, { _id: 'cashier', count: 1 }];
    };
    const listed = response();
    await handler('/', 'get')({ query: {}, ...owner }, listed);
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.data[0].usersCount, 3);

    AdminRole.findOne = async () => role();
    AdminUser.countDocuments = async (filter) => {
      assert.equal(String(filter.$or[0].roleRef), String(id));
      assert.deepEqual(filter.$or[1], { roleRef: null, role: 'cashier' });
      return 1;
    };
    const blocked = response();
    await handler('/:id', 'delete')({ ...owner, params: { id: String(id) } }, blocked);
    assert.equal(blocked.statusCode, 400);
    assert.equal(blocked.body.usersCount, 1);

    const activated = response();
    await handler('/:id/status', 'patch')({ ...owner, params: { id: String(id) },
      body: { active: true } }, activated);
    assert.equal(activated.statusCode, 200, 'Activation must not be blocked by assigned users');
    assert.deepEqual(activated.body.data, { active: true, status: 'active' });

    const inconsistent = response();
    await handler('/:id/status', 'patch')({ ...owner, params: { id: String(id) },
      body: { active: true, status: 'inactive' } }, inconsistent);
    assert.equal(inconsistent.statusCode, 400);

    const renamed = response();
    AdminRole.findOne = () => ({ ...role(), async lean() { return null; } });
    await handler('/:id', 'put')({ ...owner, params: { id: String(id) },
      body: { code: 'new-code' } }, renamed);
    assert.equal(renamed.statusCode, 400, 'Renaming an assigned role loses legacy accounts');

    const actorId = new mongoose.Types.ObjectId();
    const manager = { adminRole: 'manager', adminUserId: String(new mongoose.Types.ObjectId()),
      adminUserDoc: { roleRef: actorId }, adminEffectivePermissionsLoaded: true,
      adminEffectivePermissions: ['roles:create', 'roles:update'] };
    AdminRole.findOne = (filter) => filter.code === 'elevated'
      ? { async lean() { return null; } }
      : { async lean() { return { code: 'manager', level: 30, scope: 'branch' }; } };
    const elevated = response();
    await handler('/', 'post')({ ...manager, body: {
      name: 'Privilegio elevado', code: 'elevated', level: 10, scope: 'global',
      permissions: ['roles:disable'],
    } }, elevated);
    assert.equal(elevated.statusCode, 403, 'Manager must not create a higher role');

    console.log('✅ Perfiles: uso legado, protección, activación y estado coherente.');
  } finally {
    AdminRole.find = original.find;
    AdminRole.findOne = original.findOne;
    AdminRole.countDocuments = original.countRoles;
    AdminUser.countDocuments = original.countUsers;
    AdminUser.aggregate = original.aggregate;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
