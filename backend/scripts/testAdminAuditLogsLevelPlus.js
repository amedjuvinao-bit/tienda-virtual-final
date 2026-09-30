'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AdminAuditLog = require('../models/AdminAuditLog');
const AdminLoginAudit = require('../models/AdminLoginAudit');
const router = require('../routes/adminAuditLogs');
const { buildLogFilter, csvCell } = router;
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');

assert.deepEqual(findAdminRoutePermission('GET', '/api/admin/audit-logs/export').requiredPermissions,
  ['logs:export', 'logs:view']);
assert.equal(csvCell('=HYPERLINK("url")'), '"\'=HYPERLINK(""url"")"');
assert.equal(csvCell('  +SUM(1,2)\r\n'), '"\'  +SUM(1,2)  "');
assert.equal(csvCell('Normal'), '"Normal"');
assert.deepEqual(buildLogFilter('operations', {
  username: 'a.*', status: 'failed', module: 'admin-users',
  from: '2026-09-01T00:00:00.000Z', to: '2026-09-02T00:00:00.000Z',
}), {
  adminUsername: { $regex: 'a\\.\\*', $options: 'i' },
  success: false, module: 'admin-users',
  createdAt: { $gte: new Date('2026-09-01T00:00:00.000Z'), $lt: new Date('2026-09-02T00:00:00.000Z') },
});
assert.throws(() => buildLogFilter('operations', { module: '$where' }));
assert.throws(() => buildLogFilter('login', { status: 'noexiste' }));
assert.throws(() => buildLogFilter('login', { from: '2026-02-30T00:00:00.000Z' }));
assert.throws(() => buildLogFilter('login', {
  from: '2026-09-03T00:00:00.000Z', to: '2026-09-02T00:00:00.000Z',
}));

function handler(path) {
  const route = router.stack.find((entry) => entry.route?.path === path && entry.route.methods.get);
  assert(route);
  return route.route.stack.at(-1).handle;
}

async function invoke(action, query) {
  const res = {
    statusCode: 200, headers: {},
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
    setHeader(key, value) { this.headers[key] = value; },
    send(value) { this.body = value; return this; },
  };
  await action({ query }, res, (error) => { throw error; });
  return res;
}

async function main() {
  const originalOperationsFind = AdminAuditLog.find;
  const originalOperationsCount = AdminAuditLog.countDocuments;
  const originalLoginFind = AdminLoginAudit.find;
  const originalLoginCount = AdminLoginAudit.countDocuments;
  const calls = [];
  const rows = [{ _id: 'one', createdAt: new Date('2026-09-01T12:00:00Z'),
    adminUsername: '=CMD()', module: 'admin-users', resourceId: 'user-1',
    success: false, description: 'Usuario desactivado', permission: 'admin-users:disable' }];
  const find = (filter) => {
    calls.push({ filter });
    return {
      sort(value) { calls.at(-1).sort = value; return this; },
      skip(value) { calls.at(-1).skip = value; return this; },
      limit(value) { calls.at(-1).limit = value; return this; },
      async lean() { return rows; },
    };
  };
  AdminAuditLog.find = find;
  AdminAuditLog.countDocuments = async (filter) => {
    calls.push({ countFilter: filter }); return 52;
  };
  AdminLoginAudit.find = find;
  AdminLoginAudit.countDocuments = async () => 0;
  try {
    const query = { scope: 'operations', module: 'admin-users', status: 'failed',
      username: '=CMD()', page: '2', limit: '25' };
    const listed = await invoke(handler('/'), query);
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.pagination.pages, 3);
    assert.equal(listed.body.data[0].resourceId, 'user-1');
    assert.deepEqual(calls[0].sort, { createdAt: -1, _id: -1 });
    assert.equal(calls[0].skip, 25);
    assert.equal(calls[0].filter.module, 'admin-users');
    assert.equal(calls[0].filter.success, false);
    assert.deepEqual(calls[1].countFilter, calls[0].filter);

    const exported = await invoke(handler('/export'), query);
    assert.equal(exported.statusCode, 200);
    assert.equal(calls[2].filter.module, 'admin-users');
    assert(exported.body.includes('"\'=CMD()"'), 'CSV debe neutralizar fórmulas del usuario.');
    assert(exported.body.includes('user-1'));
    assert.equal(exported.headers['Content-Type'], 'text/csv; charset=utf-8');

    const invalid = await invoke(handler('/'), { scope: 'operations', module: '$where' });
    assert.equal(invalid.statusCode, 400);
    assert.equal(calls.length, 3, 'Un filtro inválido no debe consultar MongoDB.');
  } finally {
    AdminAuditLog.find = originalOperationsFind;
    AdminAuditLog.countDocuments = originalOperationsCount;
    AdminLoginAudit.find = originalLoginFind;
    AdminLoginAudit.countDocuments = originalLoginCount;
  }

  const uri = process.env.ADMIN_AUDIT_LOGS_TEST_MONGO_URI;
  if (uri) {
    assert(/\/orders_ci_admin_audit_logs(?:\?|$)/.test(uri),
      'La integración solo puede usar la base aislada orders_ci_admin_audit_logs.');
    await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
    try {
      const createdAt = new Date('2026-09-01T12:00:00.000Z');
      await AdminLoginAudit.create({ username: 'operador', status: 'success', createdAt });
      await AdminAuditLog.create([
        { action: 'roles:update', permission: 'roles:update', module: 'roles',
          method: 'PUT', path: '/api/admin/roles/1', adminUsername: 'operador',
          success: true, createdAt },
        { action: 'branches:disable', permission: 'branches:disable', module: 'branches',
          method: 'PATCH', path: '/api/admin/branches/1', adminUsername: 'operador',
          success: false, createdAt },
      ]);
      const query = { scope: 'operations', module: 'roles', status: 'success',
        username: 'operador', from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-02T00:00:00.000Z' };
      const listed = await invoke(handler('/'), query);
      assert.equal(listed.body.pagination.total, 1);
      assert.equal(listed.body.data[0].module, 'roles');
      const exported = await invoke(handler('/export'), query);
      assert(exported.body.includes('roles:update'));
      assert(!exported.body.includes('branches:disable'));
      const logins = await invoke(handler('/'), { scope: 'login', status: 'success' });
      assert.equal(logins.body.pagination.total, 1);
      assert.equal(logins.body.data[0].type, 'login');
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
  console.log('Logs: filtros, páginas, exportación segura y validación verificados.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
