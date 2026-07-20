// backend/scripts/testCouponsModuleClosure.js
/* eslint-disable no-console */
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const mongoose = require('mongoose');

const { env, assertEnv } = require('../config/env');
const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const couponService = require('../services/couponService');

const BACKEND_ROOT = path.join(__dirname, '..');

const results = { ok: 0, warn: 0, fail: 0 };

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function warn(message) {
  results.warn += 1;
  console.warn(`WARN ${message}`);
}

function fail(message, error = null) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function buildSecureTestCode() {
  const raw = crypto.randomBytes(5).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `CUP-CLOSE-${raw.slice(0, 8)}`;
}

function runNodeScript(scriptName) {
  const scriptPath = path.join(BACKEND_ROOT, 'scripts', scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: BACKEND_ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  assert(result.status === 0, `${scriptName} terminó con código ${result.status}`);
}

async function cleanupTestCoupons(code = '') {
  const filter = code
    ? { code }
    : { code: /^CUP-CLOSE-/ };

  const coupons = await Coupon.find(filter).select('_id code').lean();
  const couponIds = coupons.map((coupon) => coupon._id);

  if (couponIds.length > 0) {
    await CouponRedemption.deleteMany({ coupon: { $in: couponIds } });
    await Coupon.deleteMany({ _id: { $in: couponIds } });
  }
}

async function validateStaticScripts() {
  runNodeScript('testCouponsBackendModule.js');
  ok('Prueba estructural backend cupones ejecutada');

  runNodeScript('testCouponsCheckoutModule.js');
  ok('Prueba estructural checkout cupones ejecutada');

  runNodeScript('testCouponsAdminFrontendModule.js');
  ok('Prueba estructural admin cupones ejecutada');
}

async function validateRealCouponLifecycle() {
  const code = buildSecureTestCode();
  const actor = {
    username: 'closure-test',
    displayName: 'Prueba cierre cupones',
    role: 'system',
  };

  await cleanupTestCoupons(code);

  const created = await couponService.createCoupon(
    {
      code,
      name: 'Cupón cierre módulo',
      description: 'Cupón temporal creado por test:coupons-module.',
      type: 'percentage',
      value: 10,
      minSubtotal: 50000,
      maxDiscountAmount: 25000,
      status: 'active',
      active: true,
      startsAt: new Date(Date.now() - 60 * 1000),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      usageLimit: 5,
      perCustomerLimit: 2,
      appliesTo: 'all',
      categories: [],
      excludedCategories: [],
      tags: ['closure-test'],
      internalNotes: 'Se elimina automáticamente al finalizar la prueba.',
    },
    actor
  );

  assert(created?._id, 'No se creó el cupón de prueba.');
  assert(created.code === code, 'El cupón creado no conserva el código esperado.');
  ok('Crear cupón desde servicio admin funciona');

  const listed = await couponService.listCoupons({ q: code, limit: 10 });
  assert(listed.total >= 1, 'El cupón creado no aparece en el listado admin.');
  assert(listed.rows.some((coupon) => coupon.code === code), 'El cupón creado no aparece en los resultados filtrados.');
  ok('Listar y buscar cupón desde admin funciona');

  const validation = await couponService.validateCoupon({
    code,
    subtotal: 200000,
    shippingAmount: 20000,
    customerEmail: 'cliente.cierre@example.com',
    items: [
      {
        productId: new mongoose.Types.ObjectId().toString(),
        category: 'Vestidos',
        quantity: 2,
        price: 100000,
        lineTotal: 200000,
      },
    ],
  });

  assert(validation.valid === true, validation.message || 'El cupón válido fue rechazado.');
  assert(validation.discount.discountAmount === 20000, 'El descuento del 10% no se calculó correctamente.');
  assert(validation.totals.totalAfterDiscount === 200000, 'El total con descuento no coincide.');
  ok('Validar cupón en checkout y calcular descuento funciona');

  const updated = await couponService.updateCoupon(
    created._id,
    {
      name: 'Cupón cierre módulo editado',
      value: 15,
      maxDiscountAmount: 30000,
    },
    actor
  );

  assert(updated.name === 'Cupón cierre módulo editado', 'La edición del nombre no se aplicó.');
  assert(Number(updated.value) === 15, 'La edición del valor no se aplicó.');
  ok('Editar cupón desde admin funciona');

  const updatedValidation = await couponService.validateCoupon({
    code,
    subtotal: 200000,
    shippingAmount: 20000,
    customerEmail: 'cliente.cierre@example.com',
    items: [{ quantity: 1, price: 200000, lineTotal: 200000 }],
  });

  assert(updatedValidation.valid === true, 'El cupón editado no valida correctamente.');
  assert(updatedValidation.discount.discountAmount === 30000, 'El descuento editado con tope no se calculó correctamente.');
  ok('Checkout usa los cambios del cupón editado');

  await couponService.setCouponStatus(created._id, { active: false, status: 'inactive' }, actor);
  const inactiveValidation = await couponService.validateCoupon({
    code,
    subtotal: 200000,
    shippingAmount: 20000,
  });

  assert(inactiveValidation.valid === false, 'El cupón inactivo todavía aparece como válido.');
  assert(inactiveValidation.code === 'COUPON_INACTIVE', 'El rechazo por inactivo no devuelve el código esperado.');
  ok('Desactivar cupón desde admin funciona');

  await couponService.setCouponStatus(created._id, { active: true, status: 'active' }, actor);
  const activeValidation = await couponService.validateCoupon({
    code,
    subtotal: 200000,
    shippingAmount: 20000,
    customerEmail: 'cliente.cierre@example.com',
  });

  assert(activeValidation.valid === true, 'El cupón reactivado no vuelve a ser válido.');
  ok('Activar cupón desde admin funciona');

  const redemption = await couponService.recordCouponRedemption({
    couponId: created._id,
    code,
    orderNumber: 'CLOSE-COUPON-001',
    customerEmail: 'cliente.cierre@example.com',
    source: 'checkout',
    subtotal: 200000,
    shippingAmount: 20000,
    discount: activeValidation.discount,
  });

  assert(redemption?._id, 'No se registró la redención del cupón.');
  const afterRedemption = await couponService.getCouponById(created._id);
  assert(Number(afterRedemption.usageCount) === 1, 'El contador de usos no aumentó después de redimir.');
  ok('Registrar uso/redención del cupón funciona');

  const deleted = await couponService.deleteCoupon(created._id, actor);
  assert(deleted.deletedAt, 'El borrado lógico no marcó deletedAt.');
  assert(deleted.active === false, 'El cupón eliminado no quedó inactivo.');

  const deletedValidation = await couponService.validateCoupon({
    code,
    subtotal: 200000,
    shippingAmount: 20000,
  });
  assert(deletedValidation.valid === false, 'El cupón eliminado todavía valida en checkout.');
  assert(deletedValidation.code === 'COUPON_NOT_FOUND', 'El cupón eliminado no queda oculto para checkout.');
  ok('Eliminar cupón con borrado lógico funciona');

  await cleanupTestCoupons(code);
  ok('Limpieza de datos temporales de cupones completada');
}

async function main() {
  console.log('Validando cierre integral del módulo Cupones...');
  assertEnv();

  try {
    await validateStaticScripts();
  } catch (error) {
    fail('Pruebas estructurales del módulo cupones', error);
  }

  try {
    await mongoose.connect(env.mongoUri);
    ok('Conexión MongoDB activa para prueba integral de cupones');
    await validateRealCouponLifecycle();
  } catch (error) {
    fail('Flujo real crear/editar/activar/eliminar cupón', error);
  } finally {
    try {
      await cleanupTestCoupons();
    } catch (cleanupError) {
      warn(`No se pudo limpiar todos los cupones temporales: ${cleanupError.message}`);
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log('');
  console.log(`Resumen cierre cupones -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);

  if (results.fail > 0) process.exit(1);
}

main().catch(async (error) => {
  fail('Error inesperado en cierre integral de cupones', error);
  try {
    await mongoose.disconnect();
  } catch {}
  console.log(`\nResumen cierre cupones -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
  process.exit(1);
});
