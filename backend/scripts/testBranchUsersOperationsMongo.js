'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const AdminUser = require('../models/AdminUser');
const Order = require('../models/Order');
const InventoryStock = require('../models/InventoryStock');
const CashSession = require('../models/CashSession');
const branchRouter = require('../routes/adminBranches');
const protectionRouter = require('../routes/adminBranchProtection');
const userRouter = require('../routes/adminUsers');
const posRouter = require('../routes/adminPos');
const { getBranchOrFail } = require('../services/inventoryService');
const { getDefaultOnlineBranch } = require('../services/orderCreationBranchService');

function handler(router, method, path) {
  const route = router.stack.find((entry) => entry.route?.path === path && entry.route.methods?.[method]);
  assert(route, `Falta ${method.toUpperCase()} ${path}`);
  return route.route.stack.at(-1).handle;
}

async function invoke(action, req, { allowNext = false } = {}) {
  const res = {
    locals: {}, statusCode: 200,
    status(value) { this.statusCode = value; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;
  await action(req, res, (error) => {
    assert.ifError(error);
    nextCalled = true;
  });
  assert(res.body || (allowNext && nextCalled), 'La ruta no produjo una respuesta ni continuó.');
  return { ...res, nextCalled };
}

async function main() {
  const uri = process.env.BRANCH_USERS_OPERATIONS_TEST_MONGO_URI || '';
  assert(/\/orders_ci_branch_users_operations(?:\?|$)/.test(uri),
    'La integración solo puede usar la base aislada orders_ci_branch_users_operations.');
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  try {
    const mainBranch = await Branch.create({
      name: 'Sede principal', code: 'BRANCH-QA-MAIN', status: 'active', active: true,
      isMain: true, isDefaultForOnlineOrders: true,
    });
    const secondary = await Branch.create({
      name: 'Sede secundaria', code: 'BRANCH-QA-SECONDARY', status: 'active', active: true,
    });
    const user = await AdminUser.create({
      username: 'branchoperatorqa', passwordHash: 'test-only-hash', role: 'cashier',
      branches: [{ branch: secondary._id, branchName: secondary.name,
        branchCode: secondary.code, isDefault: true, canSell: true }],
      defaultBranch: secondary._id,
    });
    const owner = { adminRole: 'owner', adminAuthType: 'db',
      adminUserId: String(new mongoose.Types.ObjectId()) };
    const params = { id: String(secondary._id) };
    const disableRequest = { ...owner, params, body: { status: 'inactive', active: false } };
    const disable = () => invoke(handler(branchRouter, 'patch', '/:id/status'), disableRequest);
    const guard = (method, path, req = disableRequest) => invoke(
      handler(protectionRouter, method, path), req, { allowNext: true });

    let response = await disable();
    assert.equal(response.statusCode, 400, JSON.stringify(response.body));
    assert.equal(response.body.usersCount, 1, 'Una sede con usuarios asignados no se desactiva.');

    response = await invoke(handler(userRouter, 'put', '/:id'), {
      ...owner, params: { id: String(user._id) },
      body: { branches: [{ branch: String(mainBranch._id), canSell: true }],
        defaultBranch: String(mainBranch._id) },
    });
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    const reassigned = await AdminUser.findById(user._id);
    assert.equal(String(reassigned.defaultBranch), String(mainBranch._id));
    assert.equal(String(reassigned.branches[0].branch), String(mainBranch._id));

    const db = mongoose.connection.db;
    const order = new mongoose.Types.ObjectId();
    await db.collection(Order.collection.name).insertOne({
      _id: order, branch: secondary._id, status: 'pending', fulfillmentStatus: 'pending',
    });
    response = await guard('patch', '/:id/status');
    assert.equal(response.statusCode, 409, JSON.stringify(response.body));
    assert.equal(response.body.operationSummary.pendingOrdersCount, 1);
    await db.collection(Order.collection.name).updateOne({ _id: order },
      { $set: { status: 'delivered', fulfillmentStatus: 'delivered' } });

    const stock = new mongoose.Types.ObjectId();
    await db.collection(InventoryStock.collection.name).insertOne({
      _id: stock, branch: secondary._id, stock: 2, reservedStock: 0, deletedAt: null,
    });
    response = await guard('patch', '/:id/status');
    assert.equal(response.statusCode, 409, JSON.stringify(response.body));
    assert.equal(response.body.operationSummary.activeStockCount, 1);
    await db.collection(InventoryStock.collection.name).updateOne({ _id: stock },
      { $set: { stock: 0 } });

    const cash = new mongoose.Types.ObjectId();
    await db.collection(CashSession.collection.name).insertOne({
      _id: cash, branch: secondary._id, status: 'open',
    });
    response = await guard('patch', '/:id/status');
    assert.equal(response.statusCode, 409, JSON.stringify(response.body));
    assert.equal(response.body.operationSummary.openCashSessionsCount, 1);
    await db.collection(CashSession.collection.name).updateOne({ _id: cash },
      { $set: { status: 'closed' } });

    response = await guard('patch', '/:id/status');
    assert.equal(response.nextCalled, true, JSON.stringify(response.body));
    response = await disable();
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    assert.equal((await Branch.findById(secondary._id)).active, false);

    response = await invoke(handler(posRouter, 'get', '/bootstrap'), owner);
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body.branches.map((branch) => branch.id), [String(mainBranch._id)]);
    await assert.rejects(getBranchOrFail(secondary._id), /no existe o no está activa/);
    assert.equal(String((await getDefaultOnlineBranch())._id), String(mainBranch._id));

    response = await guard('delete', '/:id', { ...owner, params });
    assert.equal(response.statusCode, 409, JSON.stringify(response.body));
    assert.equal(response.body.operationSummary.historicalOrdersCount, 1);
    console.log('MongoDB: asignación, órdenes, inventario, caja, POS y sede desactivada verificados.');
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
