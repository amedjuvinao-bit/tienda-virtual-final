'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AdminRole = require('../models/AdminRole');
const AdminUser = require('../models/AdminUser');
const Branch = require('../models/Branch');
const roleRouter = require('../routes/adminRoles');
const userRouter = require('../routes/adminUsers');
const branchRouter = require('../routes/adminBranches');
const posRouter = require('../routes/adminPos');
const requirePermission = require('../middleware/requirePermission');
const { getAdminUserPermissionView } = require('../security/adminUserPermissionView');

function handler(router, method, path) {
  const route = router.stack.find((entry) => entry.route?.path === path && entry.route.methods?.[method]);
  assert(route, `Falta ${method.toUpperCase()} ${path}`);
  return route.route.stack.at(-1).handle;
}

async function invoke(action, req) {
  const res = {
    locals: {}, statusCode: 200,
    status(value) { this.statusCode = value; return this; },
    json(body) { this.body = body; return this; },
  };
  await action(req, res);
  assert(res.body, 'La ruta no produjo una respuesta.');
  return res;
}

function requestFor(user) {
  return {
    adminUserId: String(user._id), adminRole: user.role,
    adminUserDoc: user, adminPermissions: user.permissions,
    adminBranches: user.branches, adminDefaultBranch: user.defaultBranch,
    adminProfile: { username: user.username, displayName: user.displayName },
  };
}

async function checkAssignedUser(userId, expected) {
  const user = await AdminUser.findById(userId);
  const req = requestFor(user);
  for (const [permission, allowed] of Object.entries(expected)) {
    assert.equal(await requirePermission.hasEffectivePermission(req, permission), allowed,
      `El acceso ${permission} debe cambiar sin modificar al usuario asignado.`);
  }
  await user.populate('roleRef', 'name code level scope permissions active status deletedAt');
  assert.deepEqual(getAdminUserPermissionView(user).permissions,
    Object.entries(expected).filter(([, allowed]) => allowed).map(([permission]) => permission));
  return req;
}

async function main() {
  const uri = process.env.ADMIN_ROLE_ASSIGNMENT_TEST_MONGO_URI || '';
  assert(/\/orders_ci_role_assignment(?:\?|$)/.test(uri),
    'La prueba solo puede usar la base aislada orders_ci_role_assignment.');
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  try {
    const branch = await Branch.create({
      name: 'Sede de prueba', code: 'ROLE-QA', status: 'active', active: true, isMain: true,
    });
    const secondary = await Branch.create({
      name: 'Sede secundaria', code: 'ROLE-QA-SECONDARY', status: 'active', active: true,
    });
    const owner = { adminRole: 'owner', adminUserId: String(new mongoose.Types.ObjectId()) };
    const createdRole = await invoke(handler(roleRouter, 'post', '/'), {
      ...owner, body: { name: 'Operador de prueba', code: 'operator-qa',
        permissions: ['orders:view', 'pos:view', 'pos:discount'], scope: 'branch', level: 50 },
    });
    assert.equal(createdRole.statusCode, 201, JSON.stringify(createdRole.body));
    const roleId = createdRole.body.data._id;

    const createdUser = await invoke(handler(userRouter, 'post', '/'), {
      ...owner, body: { username: 'operatorqa', password: 'RoleQa!2026#Secret',
        firstName: 'Operador', lastName: 'Prueba', roleRef: roleId,
        branches: [{ branch: String(secondary._id), canSell: true }], mustChangePassword: false },
    });
    assert.equal(createdUser.statusCode, 201, JSON.stringify(createdUser.body));
    const userId = createdUser.body.data._id;
    await checkAssignedUser(userId, {
      'orders:view': true, 'pos:view': true, 'pos:discount': true,
    });

    const updateRole = async (permissions) => {
      const result = await invoke(handler(roleRouter, 'put', '/:id'), {
        ...owner, params: { id: String(roleId) }, body: { permissions },
      });
      assert.equal(result.statusCode, 200, JSON.stringify(result.body));
    };

    await updateRole(['pos:view']);
    assert((await AdminUser.findById(userId)).permissions.includes('pos:discount'),
      'El usuario conserva una copia anterior para probar la revocación efectiva.');
    const posRequest = await checkAssignedUser(userId, {
      'pos:view': true, 'orders:view': false, 'pos:discount': false,
    });
    const bootstrap = await invoke(handler(posRouter, 'get', '/bootstrap'), posRequest);
    assert.equal(bootstrap.statusCode, 200, JSON.stringify(bootstrap.body));
    assert.equal(bootstrap.body.permissions.canDiscount, false);
    assert.equal(bootstrap.body.permissions.canManageOrders, false);

    await updateRole([]);
    await checkAssignedUser(userId, {
      'orders:view': false, 'pos:view': false, 'pos:discount': false,
    });
    await updateRole(['orders:view']);
    await checkAssignedUser(userId, {
      'orders:view': true, 'pos:view': false, 'pos:discount': false,
    });

    const roleParams = { id: String(roleId) };
    const branchParams = { id: String(secondary._id) };
    const disableBranch = () => invoke(handler(branchRouter, 'patch', '/:id/status'), {
      ...owner, params: branchParams, body: { status: 'inactive', active: false },
    });
    const listRoles = () => invoke(handler(roleRouter, 'get', '/'), { ...owner, query: {} });
    const assignedRole = (response) => response.body.data.find((role) => String(role._id) === String(roleId));

    assert.equal(assignedRole(await listRoles()).usersCount, 1);
    let blocked = await disableBranch();
    assert.equal(blocked.statusCode, 400, JSON.stringify(blocked.body));
    assert.equal(blocked.body.usersCount, 1);
    blocked = await invoke(handler(roleRouter, 'delete', '/:id'), { ...owner, params: roleParams });
    assert.equal(blocked.statusCode, 400, JSON.stringify(blocked.body));
    assert.equal(blocked.body.usersCount, 1);

    const beforeDelete = await AdminUser.findById(userId).select('+tokenVersion');
    const deleted = await invoke(handler(userRouter, 'delete', '/:id'), {
      ...owner, params: { id: String(userId) },
    });
    assert.equal(deleted.statusCode, 200, JSON.stringify(deleted.body));
    const afterDelete = await AdminUser.findById(userId).select('+tokenVersion');
    assert(afterDelete.deletedAt instanceof Date);
    assert.equal(afterDelete.active, false);
    assert.equal(afterDelete.status, 'inactive');
    assert.equal(afterDelete.tokenVersion, beforeDelete.tokenVersion + 1,
      'La eliminación debe invalidar las sesiones activas.');

    const users = await invoke(handler(userRouter, 'get', '/'), { ...owner, query: {} });
    assert.equal(users.body.total, 0, 'El usuario eliminado no debe aparecer en Usuarios.');
    assert.equal(assignedRole(await listRoles()).usersCount, 0,
      'El usuario eliminado no debe contar como asignado al perfil.');
    const disabled = await disableBranch();
    assert.equal(disabled.statusCode, 200, JSON.stringify(disabled.body));
    assert.equal((await Branch.findById(secondary._id)).active, false);
    const deletedRole = await invoke(handler(roleRouter, 'delete', '/:id'), {
      ...owner, params: roleParams,
    });
    assert.equal(deletedRole.statusCode, 200, JSON.stringify(deletedRole.body));
    assert.equal((await AdminRole.findById(roleId)).active, false);
    console.log('MongoDB: permisos, eliminación de usuario, sesiones, conteo de perfil y sede verificados.');
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
