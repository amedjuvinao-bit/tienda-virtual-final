// backend/scripts/testCouponsBackendModule.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

const results = {
  ok: 0,
  warn: 0,
  fail: 0,
};

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

function validateFilesExist() {
  [
    'backend/models/Coupon.js',
    'backend/models/CouponRedemption.js',
    'backend/services/couponService.js',
    'backend/routes/adminCoupons.js',
    'backend/routes/coupons.js',
  ].forEach((file) => {
    readProjectFile(file);
    ok(`${file} existe`);
  });
}

function validateCouponModel() {
  const model = readProjectFile('backend/models/Coupon.js');

  [
    'COUPON_TYPES',
    'percentage',
    'fixed',
    'free_shipping',
    'usageLimit',
    'usageCount',
    'perCustomerLimit',
    'minSubtotal',
    'maxDiscountAmount',
    'appliesTo',
    'productIds',
    'categories',
    'deletedAt',
  ].forEach((needle) => assertIncludes(model, needle, `Coupon.js no contiene ${needle}`));

  ok('Modelo Coupon soporta tipos, límites, reglas y borrado lógico');
}

function validateCouponService() {
  const service = readProjectFile('backend/services/couponService.js');

  [
    'listCoupons',
    'getCouponById',
    'createCoupon',
    'updateCoupon',
    'setCouponStatus',
    'deleteCoupon',
    'validateCoupon',
    'calculateDiscount',
    'recordCouponRedemption',
    'COUPON_MIN_SUBTOTAL_NOT_REACHED',
    'COUPON_USAGE_LIMIT_REACHED',
    'COUPON_NOT_APPLICABLE_TO_CART',
  ].forEach((needle) => assertIncludes(service, needle, `couponService.js no contiene ${needle}`));

  ok('Servicio de cupones contiene CRUD, validación, cálculo y redención');
}

function validateRoutesAndPermissions() {
  const adminRoutes = readProjectFile('backend/routes/adminCoupons.js');
  const publicRoutes = readProjectFile('backend/routes/coupons.js');
  const indexFile = readProjectFile('backend/index.js');
  const catalog = readProjectFile('backend/security/adminPermissionCatalog.js');

  [
    "requirePermission('coupons:create')",
    "requirePermission('coupons:update')",
    "requirePermission('coupons:delete')",
    "requirePermission.any(['coupons:view'",
  ].forEach((needle) => assertIncludes(adminRoutes, needle, `adminCoupons.js no contiene ${needle}`));

  assertMatches(
    adminRoutes,
    /router\.post\(\s*['"]\/validate['"]/,
    'adminCoupons.js no expone POST /validate.'
  );
  assertIncludes(publicRoutes, "router.post('/validate'", 'coupons.js no expone validación pública.');
  assertIncludes(indexFile, "./routes/coupons", 'index.js no carga rutas públicas de cupones.');
  assertIncludes(indexFile, "./routes/adminCoupons", 'index.js no carga rutas admin de cupones.');
  assertIncludes(indexFile, "/api/coupons", 'index.js no monta /api/coupons.');
  assertIncludes(indexFile, "/api/admin/coupons", 'index.js no monta /api/admin/coupons.');

  [
    'coupons:view',
    'coupons:create',
    'coupons:update',
    'coupons:delete',
    'coupons:export',
  ].forEach((needle) => assertIncludes(catalog, needle, `Catálogo no contiene permiso ${needle}`));

  ok('Rutas y permisos de cupones están montados');
}

function validateTestCouponSeed() {
  const seed = readProjectFile('backend/scripts/seedTestCoupon.js');

  [
    "COUPON_PREFIX = 'CUP'",
    'SAFE_CHARS',
    'crypto.randomInt',
    'generatePublicCouponCode',
    'generateUniqueCouponCode',
    'seed-test-coupon',
  ].forEach((needle) => assertIncludes(seed, needle, `seedTestCoupon.js no contiene ${needle}`));

  assertNotIncludes(seed, "const COUPON_CODE = 'ROSAPRUEBA10'", 'El seed no debe usar una marca fija como código de cupón');
  assertNotIncludes(seed, "code: 'ROSAPRUEBA10'", 'El seed no debe crear cupones con marca fija');

  ok('Seed de cupón de prueba genera código genérico y no predecible');
}

function validatePackageScript() {
  const pkg = readProjectFile('backend/package.json');
  assertIncludes(pkg, 'test:coupons-backend', 'package.json no tiene script test:coupons-backend');
  ok('Script test:coupons-backend registrado');
}

function main() {
  console.log('Validando backend del módulo Cupones...');

  [
    validateFilesExist,
    validateCouponModel,
    validateCouponService,
    validateRoutesAndPermissions,
    validateTestCouponSeed,
    validatePackageScript,
  ].forEach((step) => {
    try {
      step();
    } catch (error) {
      fail(step.name, error);
    }
  });

  console.log('');
  console.log(`Resumen cupones backend -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);

  if (results.fail > 0) process.exit(1);
}

main();