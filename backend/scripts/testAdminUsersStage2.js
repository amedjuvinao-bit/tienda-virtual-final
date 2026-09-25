const assert = require('node:assert/strict');
const AdminUser = require('../models/AdminUser');
const usersRouter = require('../routes/adminUsers');
const { canAssignBranches } = require('../security/adminUserWritePolicy');

const statusRoute = usersRouter.stack.find((layer) =>
  layer.route?.path === '/:id/status' && layer.route?.methods?.patch
);
assert.ok(statusRoute, 'Falta la ruta de cambio de estado');

async function checkStatus(body, expectedStatus) {
  const id = '507f1f77bcf86cd799439011';
  let invalidations = 0;
  const target = {
    _id: id, role: 'seller', status: 'active', active: true,
    branches: [{ branch: id }],
    async invalidateSessions() { invalidations += 1; },
    async save() {},
    toObject() { return { role: this.role, status: this.status, active: this.active }; },
  };
  const originalFindOne = AdminUser.findOne;
  AdminUser.findOne = () => ({ select: async () => target });
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; },
  };
  try {
    await statusRoute.route.stack.at(-1).handle({
      params: { id }, body, adminRole: 'owner', adminUserId: '507f1f77bcf86cd799439012',
    }, res);
    assert.equal(res.statusCode, expectedStatus);
    assert.equal(invalidations, expectedStatus === 200 ? 1 : 0);
    if (expectedStatus === 200) {
      assert.equal(target.status, 'pending');
      assert.equal(target.active, false);
    }
  } finally {
    AdminUser.findOne = originalFindOne;
  }
}

async function main() {
  assert.equal(canAssignBranches({
    actorCode: 'manager', actorBranches: [{ branch: 'a', canInvoice: false }],
    assignedBranches: [{ branch: 'a', canInvoice: true }],
  }), false);
  await checkStatus({ status: 'pending', active: true }, 400);
  await checkStatus({ status: 'pending', active: false }, 200);
  console.log('✅ Estados coherentes y alcance de sedes verificados.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
