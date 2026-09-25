const assert = require('node:assert/strict');
const {
  requiredUserWritePermissions,
  canGrantRole,
  canAssignBranches,
  canAccessUserScope,
} = require('../security/adminUserWritePolicy');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');
const AdminRole = require('../models/AdminRole');
const usersRouter = require('../routes/adminUsers');

const userPath = '/api/admin/users/507f1f77bcf86cd799439011';
const create = findAdminRoutePermission('POST', '/api/admin/users');
const update = findAdminRoutePermission('PUT', userPath);
const status = findAdminRoutePermission('PATCH', `${userPath}/status`);
const password = findAdminRoutePermission('PATCH', `${userPath}/password`);

assert.deepEqual(create.requiredPermissions, [
  'admin-users:create', 'admin-users:assign_role',
]);
assert.deepEqual(requiredUserWritePermissions('PUT', { displayName: 'Nuevo nombre' }), [
  'admin-users:update',
]);
for (const field of ['role', 'roleRef', 'permissions', 'branches', 'branchIds', 'defaultBranch']) {
  assert.deepEqual(update.resolvePermissions({ body: { [field]: 'value' } }), [
    'admin-users:update', 'admin-users:assign_role',
  ], `${field} debe exigir autorización para asignar acceso`);
}
for (const field of ['status', 'active']) {
  assert.deepEqual(update.resolvePermissions({ body: { [field]: 'inactive' } }), [
    'admin-users:update', 'admin-users:disable',
  ], `${field} debe exigir autorización para cambiar estado`);
}
assert.deepEqual(update.resolvePermissions({ body: { mustChangePassword: false } }), [
  'admin-users:update', 'admin-users:password',
]);
assert.deepEqual(update.resolvePermissions({ body: { role: 'seller', status: 'inactive' } }), [
  'admin-users:update', 'admin-users:assign_role', 'admin-users:disable',
]);
assert.equal(status.permission, 'admin-users:disable');
assert.equal(status.audit, true);
assert.equal(password.permission, 'admin-users:password');

const manager = { code: 'manager', level: 30, scope: 'branch' };
const seller = { code: 'seller', level: 55, scope: 'branch', permissions: ['orders:view'] };
const admin = { code: 'admin', level: 10, scope: 'global', permissions: ['*'] };
const privilegedCustom = {
  code: 'custom', level: 60, scope: 'branch', permissions: ['orders:view', 'logs:export'],
};
const actor = { actorCode: 'manager', actorRole: manager, actorPermissions: ['orders:view'] };

assert.equal(canGrantRole({ ...actor, targetRole: seller }), true);
assert.equal(canGrantRole({ ...actor, targetRole: admin }), false);
assert.equal(canGrantRole({ ...actor, targetRole: privilegedCustom }), false);
assert.equal(canGrantRole({ ...actor, targetRole: { ...seller, scope: 'global' } }), false);
assert.equal(canGrantRole({ actorCode: 'admin', targetRole: { code: 'owner' } }), false);
assert.equal(canGrantRole({ actorCode: 'owner', targetRole: { code: 'owner' } }), true);

assert.equal(canAssignBranches({
  actorCode: 'manager', actorBranches: [{ branch: 'a' }],
  assignedBranches: [{ branch: 'a' }],
}), true);
assert.equal(canAssignBranches({
  actorCode: 'manager', actorBranches: [{ branch: 'a' }],
  assignedBranches: [{ branch: 'b' }],
}), false);
assert.equal(canAssignBranches({
  actorCode: 'owner', assignedBranches: [{ branch: 'b' }],
}), true);
assert.equal(canAccessUserScope({
  actorCode: 'manager', actorBranches: [{ branch: 'a' }],
  targetBranches: [{ branch: 'a' }, { branch: 'b' }], viewOnly: true,
}), true);
assert.equal(canAccessUserScope({
  actorCode: 'manager', actorBranches: [{ branch: 'a' }],
  targetBranches: [{ branch: 'a' }, { branch: 'b' }],
}), false);
assert.equal(canAccessUserScope({
  actorCode: 'manager', actorBranches: [{ branch: 'a' }],
  targetBranches: [{ branch: 'b' }], viewOnly: true,
}), false);

async function checkRoutePermission(method, path, body, actorPermissions) {
  const route = usersRouter.stack.find((layer) =>
    layer.route?.path === path && layer.route?.methods?.[method]
  );
  assert.ok(route, `Falta ${method.toUpperCase()} ${path}`);

  const authorization = route.route.stack[1].handle;
  const actorId = '507f1f77bcf86cd799439011';
  const req = {
    method: method.toUpperCase(), body,
    adminRole: 'manager', adminUser: 'manager', adminUserId: actorId,
    adminUserDoc: { roleRef: actorId }, adminPermissions: actorPermissions,
  };
  const res = {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  let authorized = false;

  const originalFindOne = AdminRole.findOne;
  AdminRole.findOne = () => ({ lean: async () => ({ permissions: actorPermissions }) });
  try {
    await authorization(req, res, () => { authorized = true; });
  } finally {
    AdminRole.findOne = originalFindOne;
  }

  return { authorized, statusCode: res.statusCode };
}

async function checkRoleGrantAtHandler() {
  const route = usersRouter.stack.find((layer) =>
    layer.route?.path === '/' && layer.route?.methods?.post
  );
  const handler = route.route.stack.at(-1).handle;
  const originalFindOne = AdminRole.findOne;
  const role = { code: 'admin', level: 10, scope: 'global', permissions: ['*'] };
  const actorRole = { code: 'manager', level: 30, scope: 'branch', permissions: [
    'admin-users:create', 'admin-users:assign_role',
  ] };
  AdminRole.findOne = (filter) => ({
    then: (resolve, reject) => Promise.resolve(filter.code === 'admin' ? role : actorRole)
      .then(resolve, reject),
    lean: async () => actorRole,
  });

  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; },
  };
  try {
    await handler({
      body: { username: 'test-manager', password: 'Prueba!123456', role: 'admin' },
      adminRole: 'manager', adminUserDoc: { roleRef: '507f1f77bcf86cd799439011' },
      adminEffectivePermissionsLoaded: true,
      adminEffectivePermissions: actorRole.permissions,
    }, res);
    assert.equal(res.statusCode, 403);
    assert.match(res.data.message, /privilegios superiores/i);
  } finally {
    AdminRole.findOne = originalFindOne;
  }
}

async function main() {
  await checkRoleGrantAtHandler();
  const updateOnly = ['admin-users:update'];
  const createOnly = await checkRoutePermission('post', '/', { role: 'seller' }, [
    'admin-users:create',
  ]);
  assert.equal(createOnly.authorized, false);
  assert.equal(createOnly.statusCode, 403);
  const createWithAssignment = await checkRoutePermission('post', '/', { role: 'seller' }, [
    'admin-users:create', 'admin-users:assign_role',
  ]);
  assert.equal(createWithAssignment.authorized, true);

  const edit = await checkRoutePermission('put', '/:id', { displayName: 'Nombre' }, updateOnly);
  assert.equal(edit.authorized, true);

  for (const body of [
    { role: 'admin' }, { roleRef: '507f1f77bcf86cd799439012' },
    { branches: [{ branch: '507f1f77bcf86cd799439013' }] },
    { status: 'inactive' }, { mustChangePassword: false },
  ]) {
    const denied = await checkRoutePermission('put', '/:id', body, updateOnly);
    assert.equal(denied.authorized, false);
    assert.equal(denied.statusCode, 403);
  }

  const resetOnly = await checkRoutePermission(
    'patch', '/:id/password', { password: 'Sample!Password123' }, ['admin-users:password']
  );
  assert.equal(resetOnly.authorized, true);
  const resetDenied = await checkRoutePermission(
    'patch', '/:id/password', {}, updateOnly
  );
  assert.equal(resetDenied.statusCode, 403);

  const statusDenied = await checkRoutePermission('patch', '/:id/status', {
    status: 'inactive',
  }, updateOnly);
  assert.equal(statusDenied.statusCode, 403);
  const statusAllowed = await checkRoutePermission('patch', '/:id/status', {
    status: 'inactive',
  }, ['admin-users:disable']);
  assert.equal(statusAllowed.authorized, true);

  console.log('✅ Permisos granulares y límites de asignación de Usuarios aprobados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
