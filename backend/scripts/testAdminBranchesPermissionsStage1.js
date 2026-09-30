const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const requirePermission = require('../middleware/requirePermission');
const router = require('../routes/adminBranches');
const protectionRouter = require('../routes/adminBranchProtection');

const route = router.stack.find((entry) => entry.route?.path === '/:id' && entry.route.methods?.put);
assert.ok(route, 'Falta la ruta de edición de sedes');
const editBranch = route.route.stack.at(-1).handle;
const protectionRoute = protectionRouter.stack.find((entry) => entry.route?.path === '/:id' && entry.route.methods?.put);
assert.ok(protectionRoute, 'Falta la protección de edición de sedes');
const protectEdit = protectionRoute.route.stack.at(-1).handle;

const branchId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const originalFindOne = Branch.findOne;
const originalFindById = Branch.findById;
const originalPermissionCheck = requirePermission.hasEffectivePermission;

function response() {
  return { statusCode: 200, status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; } };
}

async function main() {
  let saved = false;
  let canDisable = false;
  const branch = { _id: branchId, name: 'Sede de prueba', code: 'PRUEBA',
    active: true, status: 'active', isMain: false, isDefaultForOnlineOrders: false,
    async save() { saved = true; },
    toSafeObject() { return { name: this.name, active: this.active, status: this.status }; } };

  try {
    Branch.findOne = async () => branch;
    Branch.findById = () => ({ populate: async () => branch });
    requirePermission.hasEffectivePermission = async (_req, permission) => {
      assert.equal(permission, 'branches:disable');
      return canDisable;
    };

    const req = { params: { id: String(branchId) }, body: { status: 'inactive' },
      adminRole: 'editor', adminUserId: String(userId) };
    const denied = response();
    await editBranch(req, denied);
    assert.equal(denied.statusCode, 403);
    assert.equal(saved, false);
    assert.equal(branch.status, 'active');

    const ordinaryEdit = response();
    await editBranch({ ...req, body: { name: 'Sede editada', status: 'active', active: true } }, ordinaryEdit);
    assert.equal(ordinaryEdit.statusCode, 200);
    assert.equal(ordinaryEdit.body.data.name, 'Sede editada');
    assert.equal(saved, true);

    canDisable = true;
    saved = false;
    branch.status = 'inactive';
    branch.active = false;
    const authorized = response();
    await editBranch({ ...req, body: { status: 'active', active: true } }, authorized);
    assert.equal(authorized.statusCode, 200);
    assert.equal(branch.status, 'active');
    assert.equal(saved, true);

    canDisable = false;
    saved = false;
    branch.status = 'inactive';
    branch.active = false;
    const editInactive = response();
    await editBranch({ ...req, body: { name: 'Sede inactiva editada', status: 'inactive', active: false } }, editInactive);
    assert.equal(editInactive.statusCode, 200);
    assert.equal(editInactive.body.data.name, 'Sede inactiva editada');
    assert.equal(saved, true);
    assert.equal(branch.status, 'inactive');

    // Reenviar el estado actual no debe convertir una edición en una desactivación.
    Branch.findOne = () => ({ select: () => ({ lean: async () => ({ status: 'inactive', active: false }) }) });
    let passedToEdit = false;
    await protectEdit(
      { params: { id: String(branchId) }, body: { name: 'Editada', status: 'inactive', active: false } },
      response(),
      () => { passedToEdit = true; }
    );
    assert.equal(passedToEdit, true);

    console.log('Sedes: cambios de estado protegidos y edición normal permitida.');
  } finally {
    Branch.findOne = originalFindOne;
    Branch.findById = originalFindById;
    requirePermission.hasEffectivePermission = originalPermissionCheck;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
