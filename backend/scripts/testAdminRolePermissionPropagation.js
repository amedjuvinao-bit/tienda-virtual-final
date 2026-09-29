'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AdminRole = require('../models/AdminRole');
const Branch = require('../models/Branch');
const SiteSettings = require('../models/SiteSettings');
const requirePermission = require('../middleware/requirePermission');
const posRouter = require('../routes/adminPos');
const { getAdminUserPermissionView } = require('../security/adminUserPermissionView');

async function check(role, expected, oldPermissions) {
  const req = {
    adminUserId: String(new mongoose.Types.ObjectId()),
    adminRole: 'manager',
    adminPermissions: oldPermissions,
    adminUserDoc: { roleRef: role._id },
  };
  const serverPermissions = await requirePermission.getEffectivePermissions(req);
  const clientPermissions = getAdminUserPermissionView({
    roleRef: role,
    permissions: oldPermissions,
  }).permissions;
  assert.deepEqual(serverPermissions, expected);
  assert.deepEqual(clientPermissions, expected);
}

async function main() {
  const role = new AdminRole({
    name: 'Encargado', code: 'manager', active: true, status: 'active',
    permissions: ['orders:view', 'pos:view'],
  });
  const originalFindOne = AdminRole.findOne;
  const originalBranchFind = Branch.find;
  const originalSettingsFindOne = SiteSettings.findOne;
  try {
    AdminRole.findOne = (filter) => {
      if (filter._id) assert.equal(String(filter._id), String(role._id));
      else assert.equal(filter.code, role.code);
      assert.equal(filter.active, true);
      return { lean: async () => role.active && role.status === 'active' ? role : null };
    };

    await check(role, ['orders:view', 'pos:view'], ['billing:view']);
    role.permissions = ['pos:view'];
    await check(role, ['pos:view'], ['orders:view', 'billing:view']);
    role.permissions = [];
    await check(role, [], ['orders:view', 'billing:view']);

    role.permissions = ['pos:view'];
    Branch.find = () => ({ sort() { return this; }, lean: async () => [] });
    SiteSettings.findOne = () => ({ select() { return this; }, lean: async () => null });
    const branchId = new mongoose.Types.ObjectId();
    const route = posRouter.stack.find((entry) => entry.route?.path === '/bootstrap');
    assert(route, 'La ruta POS bootstrap debe existir.');
    const result = {};
    await route.route.stack.at(-1).handle({
      adminUserId: String(new mongoose.Types.ObjectId()),
      adminRole: 'manager',
      adminUserDoc: { roleRef: role._id },
      adminPermissions: ['pos:view', 'pos:discount'],
      adminBranches: [{ branch: branchId, canSell: true }],
    }, { json(body) { result.body = body; return this; },
      status(code) { result.status = code; return this; } });
    assert.equal(result.body?.permissions?.canView, true);
    assert.equal(result.body?.permissions?.canDiscount, false,
      'POS no puede usar el permiso antiguo guardado en el usuario.');

    role.active = false;
    role.status = 'inactive';
    await check(role, [], ['orders:view']);
    assert.deepEqual(getAdminUserPermissionView({
      roleRef: null, permissions: ['orders:view'],
    }).permissions, ['orders:view'], 'Las cuentas legadas sin referencia conservan sus permisos.');

    console.log('Perfiles: concesión, revocación total e inactividad coherentes entre API y autorización.');
  } finally {
    AdminRole.findOne = originalFindOne;
    Branch.find = originalBranchFind;
    SiteSettings.findOne = originalSettingsFindOne;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
