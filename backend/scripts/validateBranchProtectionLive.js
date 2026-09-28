/* eslint-disable no-console */
'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const Branch = require('../models/Branch');
const Order = require('../models/Order');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const ManualPaymentConfirmation = require('../models/ManualPaymentConfirmation');
const InventoryReservation = require('../models/InventoryReservation');
const { getBranchOperationSummary, hasBranchOperation } = require('../services/branchOperationProtectionService');
const { normalizeTags } = require('../models/order/normalizers');
const { buildTraceIdentity } = require('./seedPersistentManualInvoiceOrder');
const { pendingDraft, assertSafeMongoTarget } = require('./validatePaymentInvoiceSandbox');

const TAG = 'qa-sede-proteccion';
const LEGACY_TAG = 'qa-branch-protection-live';
const CHECKOUT_LABEL = 'Sin cobro: validación temporal de protección de sede';

function buildFixture(identity = buildTraceIdentity()) {
  const suffix = identity.orderNumber.slice(-6);
  const branch = {
    name: `QA protección de sede ${suffix}`,
    code: `QA-BRANCH-${suffix}`,
    type: 'office',
    active: true,
    status: 'active',
    isMain: false,
    isDefaultForOnlineOrders: false,
    notes: `Temporal ${TAG}: ${identity.orderNumber}`,
  };
  return { identity, branch };
}

async function createFixture() {
  const { identity, branch: branchData } = buildFixture();
  const branch = await Branch.create(branchData);
  let order;
  try {
    const draft = pendingDraft({
      branch: { id: String(branch._id), name: branch.name, code: branch.code, type: branch.type },
      product: {
        id: String(new mongoose.Types.ObjectId()),
        title: 'Servicio temporal de validación de sede',
        price: 1000,
        productType: 'service',
      },
    }, identity);
    draft.tags = [TAG];
    draft.inventoryControl.reservationRequired = false;
    draft.payment.checkoutLabel = CHECKOUT_LABEL;
    draft.items[0].requiresShipping = false;
    draft.items[0].fulfillmentKind = 'service';
    draft.items[0].fulfillmentSnapshot = {
      productType: 'service', kind: 'service', requiresShipping: false,
    };
    order = await Order.create(draft);
    assert(order.tags.includes(TAG), 'La etiqueta de seguridad no se guardó en la orden temporal.');
    return { branch, order };
  } catch (error) {
    const cleanup = await Promise.allSettled([
      Order.deleteOne({ orderNumber: identity.orderNumber, tags: TAG }),
      Branch.deleteOne({ _id: branch._id, code: branchData.code }),
    ]);
    const failures = cleanup.filter((result) => result.status === 'rejected').map((result) => result.reason);
    if (failures.length) throw new AggregateError([error, ...failures], 'Falló la creación o limpieza de los datos temporales.');
    throw error;
  }
}

async function recoverLegacyFixture(orderNumber) {
  assert(/^FM-\d{14}-[0-9A-F]{6}$/.test(orderNumber), 'Número de orden temporal inválido.');
  const suffix = orderNumber.slice(-6);
  const code = `QA-BRANCH-${suffix}`;
  const order = await Order.findOne({ orderNumber }).lean();
  const branch = await Branch.findOne({ code }).lean();

  if (order) {
    assert.equal(order.branchSnapshot?.code, code, 'La orden no corresponde a la sede temporal.');
    assert.equal(order.status, 'pending', 'La orden ya no está pendiente; no se puede retirar automáticamente.');
    assert.equal(order.payment?.status, 'pending_manual', 'El pago cambió; no se puede retirar automáticamente.');
    assert.equal(order.payment?.checkoutLabel, CHECKOUT_LABEL, 'La orden no tiene la marca de esta prueba.');
    assert.equal(order.payment?.paidAt, null, 'La orden registra un pago.');
    assert(!order.payment?.transactionId && !order.payment?.reference, 'La orden registra una transacción.');
    assert(!order.inventoryControl?.reservationId, 'La orden registra una reserva de inventario.');
    assert.equal(order.inventoryControl?.reservationRequired, false);
    assert.equal(order.items?.length, 1);
    assert.equal(order.items[0].title, 'Servicio temporal de validación de sede');
    assert.equal(order.items[0].productType, 'service');
    assert(String(order.sessionId || '').startsWith('manual_invoice_'));
    const [invoices, payments, reservations] = await Promise.all([
      ElectronicInvoice.countDocuments({ orderId: order._id }),
      ManualPaymentConfirmation.countDocuments({ order: order._id }),
      InventoryReservation.countDocuments({ order: order._id }),
    ]);
    assert.equal(invoices + payments + reservations, 0, 'La orden tiene factura, pago o reserva asociada.');
    if (branch) assert.equal(String(order.branch), String(branch._id));
    const removed = await Order.deleteOne({
      _id: order._id,
      orderNumber,
      branch: order.branch,
      status: 'pending',
      'payment.status': 'pending_manual',
      'payment.checkoutLabel': CHECKOUT_LABEL,
    });
    assert.equal(removed.deletedCount, 1, 'La orden temporal cambió durante la recuperación.');
    console.log(`Orden temporal anterior ${orderNumber} retirada.`);
  }

  if (branch) {
    assert.equal(branch.notes, `Temporal ${LEGACY_TAG}: ${orderNumber}`,
      'La sede no tiene la marca de la prueba anterior.');
    assert.equal(branch.isMain, false);
    assert.equal(branch.isDefaultForOnlineOrders, false);
    const summary = await getBranchOperationSummary(branch._id, { action: 'delete' });
    assert(!hasBranchOperation(summary), 'La sede temporal tiene operaciones asociadas.');
    const removed = await Branch.deleteOne({ _id: branch._id, code, notes: branch.notes });
    assert.equal(removed.deletedCount, 1, 'La sede temporal cambió durante la recuperación.');
    console.log(`Sede temporal anterior ${code} retirada.`);
  }
  if (!order && !branch) console.log(`Los datos temporales ${orderNumber} ya estaban retirados.`);
}

function loadProtectionRouter() {
  const adminPath = require.resolve('../middleware/requireAdmin');
  const permissionPath = require.resolve('../middleware/requirePermission');
  require(adminPath);
  require(permissionPath);
  const originalAdmin = require.cache[adminPath].exports;
  const originalPermission = require.cache[permissionPath].exports;
  try {
    // La autenticación se sustituye solo en el servidor de prueba local.
    // El middleware operativo y las consultas MongoDB son los reales.
    require.cache[adminPath].exports = (_req, _res, next) => next();
    require.cache[permissionPath].exports = () => (_req, _res, next) => next();
    return require('../routes/adminBranchProtection');
  } finally {
    require.cache[adminPath].exports = originalAdmin;
    require.cache[permissionPath].exports = originalPermission;
  }
}

async function startGuardServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/branches', loadProtectionRouter());
  // Nunca monta las rutas de escritura: si el guard falla, ninguna sede cambia.
  app.use((_req, res) => res.status(204).end());
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function request(baseUrl, branchId, method, suffix = '', body = null) {
  const response = await fetch(`${baseUrl}/api/admin/branches/${branchId}${suffix}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

async function assertBlocked(baseUrl, branchId, method, suffix, body, expectedKey) {
  const response = await request(baseUrl, branchId, method, suffix, body);
  assert.equal(response.status, 409, `${method} ${suffix || '/'}: HTTP ${response.status}`);
  assert.equal(response.data.code, 'BRANCH_HAS_OPERATION');
  assert(Number(response.data.operationSummary?.[expectedKey] || 0) >= 1,
    `Falta ${expectedKey} en el motivo del bloqueo.`);
}

async function run() {
  assert.equal(normalizeTags([TAG])[0], TAG, 'La etiqueta de prueba excede el límite del modelo.');
  const recoveryArg = process.argv.slice(2).find((value) => value.startsWith('--recover='));
  assert(process.argv.length <= (recoveryArg ? 3 : 2), 'Solo se admite --recover=NUMERO_DE_ORDEN.');
  assert.notEqual(String(process.env.NODE_ENV || '').toLowerCase(), 'production',
    'La prueba está bloqueada con NODE_ENV=production.');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;
  assert(uri, 'Falta MONGODB_URI o MONGO_URI en backend/.env.');
  assertSafeMongoTarget(uri);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });

  let fixture;
  let guard;
  let validationError;
  try {
    if (recoveryArg) await recoverLegacyFixture(recoveryArg.slice('--recover='.length));
    fixture = await createFixture();
    guard = await startGuardServer();
    const id = String(fixture.branch._id);
    const disable = { status: 'inactive', active: false };
    console.log(`Sede temporal ${fixture.branch.code}; orden temporal ${fixture.order.orderNumber}.`);

    const pending = await getBranchOperationSummary(id);
    assert.equal(pending.pendingOrdersCount, 1);
    await assertBlocked(guard.baseUrl, id, 'PATCH', '/status', disable, 'pendingOrdersCount');
    await assertBlocked(guard.baseUrl, id, 'PUT', '', disable, 'pendingOrdersCount');
    await assertBlocked(guard.baseUrl, id, 'DELETE', '', null, 'historicalOrdersCount');
    console.log('OK: orden pendiente bloquea desactivar por PATCH/PUT y eliminar por DELETE.');

    const updated = await Order.updateOne({ _id: fixture.order._id, tags: TAG }, {
      $set: { status: 'delivered', fulfillmentStatus: 'delivered' },
    });
    assert.equal(updated.matchedCount, 1, 'No se encontró la orden temporal para cerrarla.');
    const closed = await getBranchOperationSummary(id);
    assert.equal(closed.pendingOrdersCount, 0);
    const disableWithHistory = await request(guard.baseUrl, id, 'PATCH', '/status', disable);
    assert.equal(disableWithHistory.status, 204, 'El historial cerrado no debe bloquear el trámite de desactivación.');
    await assertBlocked(guard.baseUrl, id, 'DELETE', '', null, 'historicalOrdersCount');

    const unchanged = await Branch.findById(id).lean();
    assert.equal(unchanged.active, true);
    assert.equal(unchanged.status, 'active');
    assert.equal(unchanged.deletedAt, null);
    console.log('OK: el guard permite tramitar la desactivación, bloquea la eliminación y la sede sigue intacta.');
  } catch (error) {
    validationError = error;
  } finally {
    try {
      if (guard) await new Promise((resolve) => guard.server.close(resolve));
      const cleanupErrors = [];
      if (fixture?.order?._id) {
        try {
          const removed = await Order.deleteOne({ _id: fixture.order._id, tags: TAG });
          assert.equal(removed.deletedCount, 1, 'No se retiró la orden temporal.');
        } catch (error) { cleanupErrors.push(error); }
      }
      if (fixture?.branch?._id) {
        try {
          const removed = await Branch.deleteOne({ _id: fixture.branch._id, code: fixture.branch.code });
          assert.equal(removed.deletedCount, 1, 'No se retiró la sede temporal.');
        } catch (error) { cleanupErrors.push(error); }
      }
      if (cleanupErrors.length) {
        throw new AggregateError(validationError ? [validationError, ...cleanupErrors] : cleanupErrors,
          validationError ? 'Fallaron la validación y la limpieza.' : 'Falló la limpieza de datos temporales.');
      }
      if (fixture) console.log('Datos temporales retirados.');
    } finally {
      await mongoose.disconnect().catch(() => {});
    }
  }
  if (validationError) throw validationError;
  console.log('APROBADO: protección de sedes verificada con MongoDB real.');
}

function describeError(error) {
  if (error instanceof AggregateError) {
    return `${error.message} ${error.errors.map((part) => describeError(part)).join(' | ')}`;
  }
  return error?.message || String(error);
}

if (require.main === module) {
  run().catch(async (error) => {
    console.error(`FALLÓ la validación real de sedes: ${describeError(error)}`);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}

module.exports = { buildFixture, loadProtectionRouter, startGuardServer };
