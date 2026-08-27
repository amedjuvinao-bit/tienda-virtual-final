'use strict';

/* eslint-disable no-console */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CONTROLLER_ROOT = 'backend/controllers/orderReturns';
const FACADE = 'backend/controllers/orderReturnController.js';

const EXPECTED_EXPORTS = [
  'buildAccess',
  'cancelCustomerOrderReturn',
  'getCustomerOrderReturns',
  'getCustomerReturnLabel',
  'getReturnPolicy',
  'getOrderReturns',
  'patchOrderReturn',
  'postCustomerOrderReturn',
  'postOrderReturn',
  'postReturnAutomaticExchange',
  'postReturnExchange',
  'postReturnRefund',
  'postReturnStoreCredit',
  'putReturnPolicy',
  'returnCreationIdempotencyKey',
  'wholeOrderAccessOptions',
];

const MODULE_LIMITS = {
  [`${CONTROLLER_ROOT}/adminController.js`]: 250,
  [`${CONTROLLER_ROOT}/customerController.js`]: 150,
  [`${CONTROLLER_ROOT}/customerLabelController.js`]: 120,
  [`${CONTROLLER_ROOT}/policyController.js`]: 60,
  [`${CONTROLLER_ROOT}/shared.js`]: 150,
};

let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK  ${message}`);
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(absolute(relativePath), 'utf8');
}

function lineCount(relativePath) {
  return read(relativePath).split(/\r?\n/).length;
}

function verifyFacadeComposition() {
  const facade = require('../controllers/orderReturnController');
  const admin = require('../controllers/orderReturns/adminController');
  const customer = require('../controllers/orderReturns/customerController');
  const label = require('../controllers/orderReturns/customerLabelController');
  const policy = require('../controllers/orderReturns/policyController');
  const shared = require('../controllers/orderReturns/shared');
  const implementations = { ...admin, ...customer, ...label, ...policy, ...shared };

  assert.deepStrictEqual(Object.keys(facade), EXPECTED_EXPORTS);
  EXPECTED_EXPORTS.forEach((name) => {
    assert.strictEqual(
      facade[name],
      implementations[name],
      `${name} debe conservar la referencia del controlador cohesivo`
    );
  });
  ok('la fachada conserva exactamente sus 16 exports y referencias');
}

function verifyFacadeBoundary() {
  const source = read(FACADE);
  assert.ok(lineCount(FACADE) <= 100);
  assert.ok(!source.includes("require('../models/"));
  assert.ok(!source.includes("require('../services/"));
  assert.ok(!source.includes('mongoose'));
  assert.ok(!source.includes('PDFDocument'));
  assert.ok(!/async function|function\s+[A-Za-z]/.test(source));
  ok('la fachada es delgada y no contiene lógica de dominio o persistencia');
}

function verifyModuleBoundaries() {
  Object.entries(MODULE_LIMITS).forEach(([relativePath, maximum]) => {
    assert.ok(
      lineCount(relativePath) <= maximum,
      `${relativePath} excede el límite cohesivo de ${maximum} líneas`
    );
  });

  const policy = read(`${CONTROLLER_ROOT}/policyController.js`);
  const label = read(`${CONTROLLER_ROOT}/customerLabelController.js`);
  assert.ok(!policy.includes('orderReturnService'));
  assert.ok(!label.includes('resolveOrderReturn'));
  assert.ok(!label.includes('createOrderReturn'));
  ok('policy, RMA, autoservicio y etiquetas permanecen separados y acotados');
}

function verifyAdminSecurityWiring() {
  const shared = read(`${CONTROLLER_ROOT}/shared.js`);
  const admin = read(`${CONTROLLER_ROOT}/adminController.js`);
  assert.ok(shared.includes('requireWholeOrder: true'));
  assert.ok(shared.includes("{ ...options, requestedBranchId: '' }"));
  assert.ok(admin.includes("wholeOrderAccessOptions('canManageInventory')"));
  assert.ok(admin.includes("wholeOrderAccessOptions('canInvoice')"));
  assert.ok(admin.includes('replacementOrderFilter: replacementAccess.filter'));
  assert.ok(admin.includes('authorizedBranchIds: access.branchIds || []'));
  assert.ok(admin.includes("allowAllBranches: access.mode === 'all'"));
  ok('RMA admin conserva whole-order, capacidades y whitelist multisede');
}

function verifyPublicSecurityAndIdempotency() {
  const shared = read(`${CONTROLLER_ROOT}/shared.js`);
  const customer = read(`${CONTROLLER_ROOT}/customerController.js`);
  assert.ok(shared.includes('resolveAuthorizedPublicReturnOrder'));
  assert.ok(shared.includes("req.headers?.['idempotency-key']"));
  assert.ok(shared.includes("req.headers?.['x-idempotency-key']"));
  assert.ok(customer.includes('SAFE_RETURN_ACCESS_ERROR'));
  assert.ok(customer.includes("requestSource: 'customer'"));
  assert.ok(customer.includes('returnCase.idempotent ? 200 : 201'));
  assert.ok(customer.includes("action: 'cancel'"));
  ok('autoservicio mantiene acceso opaco, pertenencia e idempotencia');
}

function verifyLabelSafety() {
  const label = read(`${CONTROLLER_ROOT}/customerLabelController.js`);
  assert.ok(label.includes("status: {"));
  assert.ok(label.includes("'authorized'"));
  assert.ok(label.includes("'resolved'"));
  assert.ok(label.includes('/^https:\\/\\//i'));
  assert.ok(label.includes('return res.redirect(302, returnCase.shipping.labelUrl)'));
  assert.ok(label.includes("new PDFDocument({ size: 'A6', margin: 26 })"));
  ok('la etiqueta conserva estados permitidos, PDF local y redirección HTTPS');
}

function verifyRouteContract() {
  const routes = read('backend/routes/orderReturnRoutes.js');
  [
    'getReturnPolicy',
    'putReturnPolicy',
    'getCustomerOrderReturns',
    'postCustomerOrderReturn',
    'cancelCustomerOrderReturn',
    'getCustomerReturnLabel',
    'getOrderReturns',
    'postOrderReturn',
    'patchOrderReturn',
    'postReturnRefund',
    'postReturnExchange',
    'postReturnAutomaticExchange',
    'postReturnStoreCredit',
  ].forEach((handler) => assert.ok(routes.includes(handler)));
  assert.ok(routes.includes("requirePermission('orders:view')"));
  assert.ok(routes.includes("requirePermission('orders:returns')"));
  assert.ok(routes.includes("requirePermission('orders:refund')"));
  assert.ok(routes.includes("requirePermission('settings:store')"));
  ok('las rutas públicas/admin y sus permisos conservan el contrato existente');
}

function verifyNoInternalCycle() {
  const files = Object.keys(MODULE_LIMITS);
  const graph = new Map(
    files.map((file) => {
      const dependencies = [];
      const pattern = /require\(\s*['"](\.\/[^'"]+)['"]\s*\)/g;
      let match;
      while ((match = pattern.exec(read(file)))) {
        const dependency = path.posix.normalize(
          path.posix.join(path.posix.dirname(file), `${match[1]}.js`)
        );
        if (files.includes(dependency)) dependencies.push(dependency);
      }
      return [file, dependencies];
    })
  );
  const visiting = new Set();
  const visited = new Set();
  function visit(file) {
    assert.ok(!visiting.has(file), `ciclo interno detectado desde ${file}`);
    if (visited.has(file)) return;
    visiting.add(file);
    (graph.get(file) || []).forEach(visit);
    visiting.delete(file);
    visited.add(file);
  }
  files.forEach(visit);
  ok('los controladores internos no forman ciclos CommonJS');
}

try {
  verifyFacadeComposition();
  verifyFacadeBoundary();
  verifyModuleBoundaries();
  verifyAdminSecurityWiring();
  verifyPublicSecurityAndIdempotency();
  verifyLabelSafety();
  verifyRouteContract();
  verifyNoInternalCycle();
  console.log(`\nControlador modular de devoluciones: ${passed}/8 controles aprobados.`);
} catch (error) {
  console.error('\nFALLO composición del controlador de devoluciones:', error.message);
  process.exitCode = 1;
}
