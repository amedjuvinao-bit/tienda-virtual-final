// backend/scripts/testAdminBranchProtection.js

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const InventoryReservation = require('../models/InventoryReservation');
const InventoryMovement = require('../models/InventoryMovement');

const BASE_URL = String(
  process.env.BRANCH_PROTECTION_BASE_URL ||
    process.env.TEST_API_URL ||
    'http://localhost:5000'
).replace(/\/+$/, '');

function trimSafe(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function printTitle(title) {
  console.log('\n==================================================');
  console.log(title);
  console.log('==================================================');
}

function buildLegacyAdminToken() {
  if (!process.env.JWT_SECRET) {
    throw new Error('Falta JWT_SECRET en backend/.env');
  }

  return jwt.sign(
    {
      role: 'admin',
      username: 'branch-protection-script',
      adminRole: 'owner',
      authType: 'legacy',
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

async function requestJson(url, { method = 'GET', token = '', body = null } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

async function getBranchOperationSummary(branchId) {
  const objectId = new mongoose.Types.ObjectId(String(branchId));

  const [activeStockCount, reservedStockCount, pendingReservationsCount, movementsCount] =
    await Promise.all([
      InventoryStock.countDocuments({
        branch: objectId,
        deletedAt: null,
        active: true,
        stock: { $gt: 0 },
      }),
      InventoryStock.countDocuments({
        branch: objectId,
        deletedAt: null,
        active: true,
        reservedStock: { $gt: 0 },
      }),
      InventoryReservation.countDocuments({
        status: 'pending',
        'items.branch': objectId,
      }),
      InventoryMovement.countDocuments({
        deletedAt: null,
        $or: [{ branchFrom: objectId }, { branchTo: objectId }],
      }),
    ]);

  return {
    activeStockCount,
    reservedStockCount,
    pendingReservationsCount,
    movementsCount,
  };
}

function hasOperation(summary = {}) {
  return (
    Number(summary.activeStockCount || 0) > 0 ||
    Number(summary.reservedStockCount || 0) > 0 ||
    Number(summary.pendingReservationsCount || 0) > 0 ||
    Number(summary.movementsCount || 0) > 0
  );
}

async function findBranchWithOperation() {
  const stock = await InventoryStock.findOne({
    deletedAt: null,
    active: true,
    $or: [{ stock: { $gt: 0 } }, { reservedStock: { $gt: 0 } }],
  })
    .sort({ stock: -1, reservedStock: -1, updatedAt: -1 })
    .lean();

  if (stock?.branch) {
    const branch = await Branch.findOne({
      _id: stock.branch,
      deletedAt: null,
    }).lean();

    if (branch) {
      return branch;
    }
  }

  const reservation = await InventoryReservation.findOne({
    status: 'pending',
    'items.branch': { $ne: null },
  })
    .sort({ updatedAt: -1 })
    .lean();

  const reservationBranchId = reservation?.items?.find((item) => item?.branch)?.branch;

  if (reservationBranchId) {
    const branch = await Branch.findOne({
      _id: reservationBranchId,
      deletedAt: null,
    }).lean();

    if (branch) {
      return branch;
    }
  }

  const movement = await InventoryMovement.findOne({
    deletedAt: null,
    $or: [{ branchFrom: { $ne: null } }, { branchTo: { $ne: null } }],
  })
    .sort({ createdAt: -1 })
    .lean();

  const movementBranchId = movement?.branchFrom || movement?.branchTo;

  if (movementBranchId) {
    const branch = await Branch.findOne({
      _id: movementBranchId,
      deletedAt: null,
    }).lean();

    if (branch) {
      return branch;
    }
  }

  return null;
}

async function createTemporaryBranch(label = 'CLEAN') {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

  const branch = await Branch.create({
    name: `Sede prueba ${label} ${suffix}`,
    code: `TEST-${label}-${suffix}`.slice(0, 30),
    type: 'office',
    status: 'active',
    active: true,
    isMain: false,
    isDefaultForOnlineOrders: false,
    notes: 'Sede temporal creada por testAdminBranchProtection.js',
  });

  return branch;
}

async function cleanupTemporaryBranch(branch) {
  if (!branch?._id) return;

  await Branch.updateOne(
    { _id: branch._id },
    {
      $set: {
        active: false,
        status: 'inactive',
        deletedAt: new Date(),
        notes: 'Sede temporal limpiada por testAdminBranchProtection.js',
      },
    }
  );
}

function assertStatus({ label, result, expectedStatus, expectedCode = '' }) {
  const receivedCode =
    typeof result.data === 'object' && result.data
      ? result.data.code || result.data.error || ''
      : '';

  const ok =
    result.status === expectedStatus &&
    (!expectedCode || receivedCode === expectedCode);

  console.log(
    `${ok ? '✅' : '❌'} ${label} | esperado HTTP ${expectedStatus}${
      expectedCode ? ` / ${expectedCode}` : ''
    }, recibido HTTP ${result.status}${receivedCode ? ` / ${receivedCode}` : ''}`
  );

  if (!ok) {
    console.log('Respuesta:', result.data);
  }

  return ok;
}

async function testProtectedBranch(token, branch) {
  printTitle('PRUEBA 1: sede con operación debe bloquear desactivar/eliminar');

  const summary = await getBranchOperationSummary(branch._id);

  console.log('Sede usada:', branch.name, branch.code, String(branch._id));
  console.log('Resumen operación:', summary);

  if (!hasOperation(summary)) {
    console.log('⏭️  Omitida: la sede encontrada no tiene operación contable/inventario detectable.');
    return { passed: 0, failed: 0, skipped: 2 };
  }

  const patchResult = await requestJson(
    `${BASE_URL}/api/admin/branches/${branch._id}/status`,
    {
      method: 'PATCH',
      token,
      body: {
        active: false,
        status: 'inactive',
      },
    }
  );

  const deleteResult = await requestJson(
    `${BASE_URL}/api/admin/branches/${branch._id}`,
    {
      method: 'DELETE',
      token,
    }
  );

  let passed = 0;
  let failed = 0;

  if (
    assertStatus({
      label: 'Bloquea desactivar sede con operación',
      result: patchResult,
      expectedStatus: 409,
      expectedCode: 'BRANCH_HAS_OPERATION',
    })
  ) {
    passed += 1;
  } else {
    failed += 1;
  }

  if (
    assertStatus({
      label: 'Bloquea eliminar sede con operación',
      result: deleteResult,
      expectedStatus: 409,
      expectedCode: 'BRANCH_HAS_OPERATION',
    })
  ) {
    passed += 1;
  } else {
    failed += 1;
  }

  return { passed, failed, skipped: 0 };
}

async function testCleanBranchCanChange(token) {
  printTitle('PRUEBA 2: sede limpia sí debe permitir desactivar/eliminar');

  let disableBranch = null;
  let deleteBranch = null;

  try {
    disableBranch = await createTemporaryBranch('DISABLE');
    deleteBranch = await createTemporaryBranch('DELETE');

    console.log('Sede limpia para desactivar:', disableBranch.name, disableBranch.code, String(disableBranch._id));
    console.log('Sede limpia para eliminar:', deleteBranch.name, deleteBranch.code, String(deleteBranch._id));

    const disableResult = await requestJson(
      `${BASE_URL}/api/admin/branches/${disableBranch._id}/status`,
      {
        method: 'PATCH',
        token,
        body: {
          active: false,
          status: 'inactive',
        },
      }
    );

    const deleteResult = await requestJson(
      `${BASE_URL}/api/admin/branches/${deleteBranch._id}`,
      {
        method: 'DELETE',
        token,
      }
    );

    let passed = 0;
    let failed = 0;

    if (
      assertStatus({
        label: 'Permite desactivar sede limpia',
        result: disableResult,
        expectedStatus: 200,
      })
    ) {
      passed += 1;
    } else {
      failed += 1;
    }

    if (
      assertStatus({
        label: 'Permite eliminar sede limpia',
        result: deleteResult,
        expectedStatus: 200,
      })
    ) {
      passed += 1;
    } else {
      failed += 1;
    }

    if (!disableResult.ok) {
      await cleanupTemporaryBranch(disableBranch);
    }

    if (!deleteResult.ok) {
      await cleanupTemporaryBranch(deleteBranch);
    }

    return { passed, failed, skipped: 0 };
  } catch (error) {
    await cleanupTemporaryBranch(disableBranch);
    await cleanupTemporaryBranch(deleteBranch);

    throw error;
  }
}

async function main() {
  if (typeof fetch !== 'function') {
    throw new Error('Este script requiere Node 18+ porque usa fetch global.');
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('Falta MONGODB_URI en backend/.env');
  }

  const token = buildLegacyAdminToken();

  console.log('🧪 Test protección operativa de sedes');
  console.log('Base URL:', BASE_URL);

  await mongoose.connect(process.env.MONGODB_URI);

  const operationBranch = await findBranchWithOperation();

  if (!operationBranch) {
    console.log('⚠️ No se encontró una sede con stock/reserva/movimiento para probar bloqueo.');
  }

  const protectedResult = operationBranch
    ? await testProtectedBranch(token, operationBranch)
    : { passed: 0, failed: 0, skipped: 2 };

  const cleanResult = await testCleanBranchCanChange(token);

  await mongoose.disconnect();

  printTitle('RESUMEN');

  const passed = protectedResult.passed + cleanResult.passed;
  const failed = protectedResult.failed + cleanResult.failed;
  const skipped = protectedResult.skipped + cleanResult.skipped;

  console.log(`✅ Correctas: ${passed}`);
  console.log(`❌ Fallidas: ${failed}`);
  console.log(`⏭️  Omitidas: ${skipped}`);

  if (failed > 0) {
    process.exitCode = 1;
    return;
  }

  console.log('\n✅ Pruebas de protección de sedes finalizadas correctamente.');
}

main().catch(async (error) => {
  console.error('\n❌ Error ejecutando pruebas de sedes:', error.message);

  try {
    await mongoose.disconnect();
  } catch {}

  process.exitCode = 1;
});
