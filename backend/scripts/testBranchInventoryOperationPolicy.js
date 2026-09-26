'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const { getBranchOrFail } = require('../services/inventoryService');

const branchId = new mongoose.Types.ObjectId();
const originalFindOne = Branch.findOne;

async function main() {
  let branch = {
    _id: branchId,
    active: true,
    status: 'active',
    settings: { allowInventoryMovements: false },
  };

  try {
    Branch.findOne = (filter) => {
      assert.equal(String(filter._id), String(branchId));
      assert.equal(filter.active, true);
      assert.equal(filter.status, 'active');
      return {
        session() { return this; },
        async lean() { return branch; },
      };
    };

    await assert.rejects(
      getBranchOrFail(branchId, { fieldName: 'La sede destino' }),
      (error) => error.code === 'BRANCH_INVENTORY_DISABLED' &&
        error.statusCode === 409 &&
        error.message.includes('Configuración > Sedes')
    );

    branch = { ...branch, settings: { allowInventoryMovements: true } };
    assert.equal((await getBranchOrFail(branchId))._id, branchId);

    branch = { ...branch, settings: {} };
    assert.equal((await getBranchOrFail(branchId))._id, branchId);

    branch = null;
    await assert.rejects(
      getBranchOrFail(branchId),
      (error) => error.message.includes('no existe o no está activa')
    );

    console.log('Sedes: inventario bloqueado por configuración; sedes habilitadas y legadas conservan acceso.');
  } finally {
    Branch.findOne = originalFindOne;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
