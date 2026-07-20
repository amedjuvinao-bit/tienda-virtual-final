// backend/scripts/testCouponsAdminFrontendModule.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

const results = { ok: 0, warn: 0, fail: 0 };

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function fail(message, error = null) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readProjectFile(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  assert(fs.existsSync(fullPath), `No existe el archivo ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function assertIncludes(content, expected, message) {
  assert(String(content).includes(expected), message || `No se encontró: ${expected}`);
}

function assertNotIncludes(content, unexpected, message) {
  assert(!String(content).includes(unexpected), message || `No debe existir: ${unexpected}`);
}

function assertMatches(content, pattern, message) {
  assert(pattern.test(String(content || '')), message || `No coincide el patrón: ${pattern}`);
}

function validateFiles() {
  [
    'frontend/src/admin/coupons/AdminCouponsPage.jsx',
    'frontend/src/admin/coupons/api/adminCouponsApi.js',
  ].forEach((file) => {
    readProjectFile(file);
    ok(`${file} existe`);
  });
}

function validateApiClient() {
  const api = readProjectFile('frontend/src/admin/coupons/api/adminCouponsApi.js');
  [
    'fetchAdminCoupons',
    'createAdminCoupon',
    'updateAdminCoupon',
    'changeAdminCouponStatus',
    'deleteAdminCoupon',
    '/api/admin/coupons',
  ].forEach((needle) => assertIncludes(api, needle, `API admin cupones no contiene ${needle}`));
  ok('API admin de cupones contiene CRUD completo');
}

function validateAdminPage() {
  const page = readProjectFile('frontend/src/admin/coupons/AdminCouponsPage.jsx');
  [
    'AdminCouponsPage',
    'Nuevo cupón',
    'Guardar cupón',
    'Editar',
    'Activar',
    'Desactivar',
    'Eliminar',
    'percentage',
    'fixed',
    'free_shipping',
    'useAppConfirm',
  ].forEach((needle) => assertIncludes(page, needle, `Página admin cupones no contiene ${needle}`));
  ok('Página admin de cupones tiene listado, formulario y acciones');
}

function validateSecureCodeGenerator() {
  const page = readProjectFile('frontend/src/admin/coupons/AdminCouponsPage.jsx');
  [
    "PUBLIC_CODE_PREFIX = 'CUP'",
    'SAFE_CODE_ALPHABET',
    'buildSecureCouponCode',
    'randomSafeChunk',
    'window.crypto.getRandomValues',
    'CUP-7K9X-P2Q4',
    'Código público seguro',
    'Auto',
  ].forEach((needle) => assertIncludes(page, needle, `Página admin cupones no contiene generador seguro: ${needle}`));

  assertNotIncludes(page, "AUTO_CODE_PREFIX = 'ROSA'", 'No se debe usar ROSA como prefijo estándar del proyecto');
  assertNotIncludes(page, 'ROSA0001', 'No se debe usar una marca específica como código automático');
  assertNotIncludes(page, 'CUP-0001', 'No se deben generar códigos públicos consecutivos predecibles');
  assertNotIncludes(page, 'CUP-0002', 'No se deben generar códigos públicos consecutivos predecibles');

  ok('Página admin genera códigos públicos aleatorios y no predecibles');
}

function validateRoutingAndMenu() {
  const app = readProjectFile('frontend/src/App.jsx');
  assertIncludes(app, "import AdminCouponsPage from './admin/coupons/AdminCouponsPage';", 'App.jsx no importa AdminCouponsPage');
  assertMatches(app, /<Route\s+path="cupones"\s+element=\{protectAdminContent\(<AdminCouponsPage\s*\/?\>\)\}/, 'App.jsx no registra la ruta /admin/cupones');

  const layout = readProjectFile('frontend/src/admin/AdminLayout.js');
  assertIncludes(layout, '/admin/cupones', 'AdminLayout.js no contiene enlace /admin/cupones');
  assertIncludes(layout, "label: 'Cupones'", 'AdminLayout.js no contiene label Cupones');

  const permissions = readProjectFile('frontend/src/admin/security/adminPermissions.js');
  assertIncludes(permissions, "cupones: ['coupons:view']", 'adminPermissions.js no registra permisos de cupones');

  ok('Ruta, menú y permisos frontend de cupones registrados');
}

function validatePackageScript() {
  const pkg = readProjectFile('backend/package.json');
  assertIncludes(pkg, 'test:coupons-admin', 'package.json no registra test:coupons-admin');
  ok('Script test:coupons-admin registrado');
}

function main() {
  console.log('Validando frontend admin del módulo Cupones...');

  [
    validateFiles,
    validateApiClient,
    validateAdminPage,
    validateSecureCodeGenerator,
    validateRoutingAndMenu,
    validatePackageScript,
  ].forEach((fn) => {
    try {
      fn();
    } catch (error) {
      fail(fn.name, error);
    }
  });

  console.log(`\nResumen cupones admin -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
  if (results.fail > 0) process.exit(1);
}

main();
