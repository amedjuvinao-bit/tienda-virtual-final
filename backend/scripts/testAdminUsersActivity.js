const assert = require('node:assert/strict');
const AdminUser = require('../models/AdminUser');
const AdminAuditLog = require('../models/AdminAuditLog');
const usersRouter = require('../routes/adminUsers');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');

const route = usersRouter.stack.find((layer) =>
  layer.route?.path === '/:id/activity' && layer.route.methods.get
);
assert.ok(route, 'Falta la consulta de actividad individual');
const rule = findAdminRoutePermission('GET', '/api/admin/users/507f1f77bcf86cd799439011/activity');
assert.deepEqual(rule.requiredPermissions, ['admin-users:view', 'logs:view']);

const originalFindOne = AdminUser.findOne;
const originalFind = AdminAuditLog.find;
const originalCount = AdminAuditLog.countDocuments;
const targetId = '507f1f77bcf86cd799439011';
let readFilter = null;
let readCount = 0;

async function callRoute(branches) {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.data = value; return this; },
  };
  await route.route.stack.at(-1).handle({
    params: { id: targetId }, query: {}, adminRole: 'manager',
    adminUserId: '507f1f77bcf86cd799439022',
    adminBranches: branches,
  }, res);
  return res;
}

async function main() {
  AdminUser.findOne = () => ({ select: async () => ({
    _id: targetId, username: 'ana', role: 'seller', branches: [{ branch: targetId }],
  }) });
  AdminAuditLog.find = (filter) => {
    readFilter = filter;
    const query = { sort() { return this; }, skip() { return this; },
      limit() { return this; }, select() { return this; },
      async lean() { return [{ _id: 'event-1', description: 'Cambio de estado', success: true }]; } };
    readCount += 1;
    return query;
  };
  AdminAuditLog.countDocuments = async () => 1;
  try {
    const denied = await callRoute([{ branch: '507f1f77bcf86cd799439099' }]);
    assert.equal(denied.statusCode, 403);
    assert.equal(readCount, 0, 'No se deben leer logs fuera del alcance');

    const allowed = await callRoute([{ branch: targetId }]);
    assert.equal(allowed.statusCode, 200);
    assert.equal(allowed.data.pagination.total, 1);
    assert.equal(readFilter.resourceId, targetId);
    assert.deepEqual(readFilter.$or, [
      { module: 'admin-users' },
      { module: 'seguridad', permission: 'seguridad:2fa:owner' },
    ]);
    console.log('✅ Actividad por usuario: permisos, alcance de sede y filtro de auditoría.');
  } finally {
    AdminUser.findOne = originalFindOne;
    AdminAuditLog.find = originalFind;
    AdminAuditLog.countDocuments = originalCount;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
