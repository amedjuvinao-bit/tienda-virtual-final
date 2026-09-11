'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const couponService = require('../services/couponService');
const couponIndexMigration = require('../services/couponIndexMigrationService');
const {
  COUPON_INDEX_DEFINITIONS,
  COUPON_REDEMPTION_INDEX_DEFINITIONS,
} = require('../models/couponIndexDefinitions');

let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function read(relativePath) {
  return fs
    .readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8')
    .replace(/\r\n?/g, '\n');
}

function objectId() {
  return new mongoose.Types.ObjectId().toHexString();
}

function validPayload(extra = {}) {
  return {
    code: 'STAGE0-VALID',
    name: 'Cupón válido',
    type: 'percentage',
    value: 10,
    minSubtotal: 0,
    maxDiscountAmount: 50000,
    status: 'active',
    startsAt: null,
    endsAt: null,
    usageLimit: 20,
    perCustomerLimit: 2,
    appliesTo: 'all',
    productIds: [],
    excludedProductIds: [],
    categories: [],
    excludedCategories: [],
    customerIds: [],
    newCustomersOnly: false,
    tags: [],
    internalNotes: '',
    ...extra,
  };
}

function assertServiceError(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
}

function validatePublicPrivacy() {
  const internal = {
    _id: objectId(),
    code: 'PRIVADO10',
    name: 'Promoción pública',
    description: 'Referencia interna no publicable',
    type: 'percentage',
    value: 10,
    internalNotes: 'No mostrar al cliente',
    createdBy: { username: 'propietario', role: 'owner' },
    updatedBy: { username: 'supervisor', role: 'manager' },
    productIds: [objectId()],
    customerIds: [objectId()],
    tags: ['interno'],
  };
  const safe = couponService.serializePublicValidation({
    valid: true,
    coupon: internal,
    discount: { totalDiscountAmount: 10000, meta: { rule: 'interna' } },
    debug: { query: 'no publicable' },
  });
  const json = JSON.stringify(safe);

  ok('la validación pública conserva el resultado comercial', safe.valid === true);
  ok('la validación pública conserva únicamente el nombre y código necesarios', safe.coupon.code === 'PRIVADO10' && safe.coupon.name === 'Promoción pública');
  ok('las notas internas nunca salen en la respuesta pública', !json.includes('internalNotes') && !json.includes('No mostrar'));
  ok('los actores administrativos nunca salen en la respuesta pública', !json.includes('createdBy') && !json.includes('updatedBy'));
  ok('las segmentaciones internas nunca salen en la respuesta pública', !json.includes('productIds') && !json.includes('customerIds') && !json.includes('tags'));
  ok('la respuesta pública descarta campos futuros que no estén permitidos', !json.includes('debug') && !json.includes('meta') && !json.includes('no publicable'));
}

function validateCommercialRules() {
  const includedProduct = objectId();
  const otherProduct = objectId();
  const productCoupon = {
    type: 'percentage',
    value: 10,
    appliesTo: 'products',
    productIds: [includedProduct],
    excludedProductIds: [],
    categories: [],
    excludedCategories: [],
  };
  const unrelatedItem = {
    productId: otherProduct,
    categories: ['Vestidos'],
    quantity: 1,
    price: 100000,
    lineTotal: 100000,
  };

  ok('un alcance de productos vacío falla cerrado', couponService.isItemEligibleForCoupon({ ...productCoupon, productIds: [] }, unrelatedItem) === false);
  ok('un producto ajeno al alcance no recibe descuento', couponService.isItemEligibleForCoupon(productCoupon, unrelatedItem) === false);

  const excludedAll = couponService.calculateDiscount(
    {
      type: 'percentage',
      value: 10,
      appliesTo: 'all',
      excludedCategories: ['Vestidos'],
      excludedProductIds: [],
    },
    { subtotal: 100000, shippingAmount: 20000, items: [unrelatedItem] }
  );
  ok('las exclusiones también funcionan cuando el alcance es toda la tienda', excludedAll.totalDiscountAmount === 0);

  const restrictedShipping = couponService.calculateDiscount(
    { ...productCoupon, type: 'free_shipping', value: 0 },
    { subtotal: 100000, shippingAmount: 20000, items: [unrelatedItem] }
  );
  ok('envío gratis no se aplica a un carrito fuera de su alcance', restrictedShipping.shippingDiscountAmount === 0);

  const eligibleShipping = couponService.calculateDiscount(
    { ...productCoupon, type: 'free_shipping', value: 0 },
    {
      subtotal: 100000,
      shippingAmount: 20000,
      items: [{ ...unrelatedItem, productId: includedProduct }],
    }
  );
  ok('envío gratis sí se aplica cuando existe un producto elegible', eligibleShipping.shippingDiscountAmount === 20000);
}

async function validateStrictPayload() {
  const clean = couponService.__test.cleanCouponPayload;
  const draft = clean(validPayload({ status: 'draft' }));
  ok('el estado y la disponibilidad quedan normalizados', draft.status === 'draft' && draft.active === false);

  assertServiceError(
    () => clean(validPayload({ appliesTo: 'products', productIds: [] })),
    'COUPON_PRODUCTS_REQUIRED'
  );
  ok('no se acepta un cupón de productos sin selección');

  assertServiceError(
    () => clean(validPayload({ appliesTo: 'categories', categories: [] })),
    'COUPON_CATEGORIES_REQUIRED'
  );
  ok('no se acepta un cupón de categorías sin selección');

  assertServiceError(
    () => clean(validPayload({ usageLimit: 1.5 })),
    'COUPON_USAGE_LIMIT_INVALID'
  );
  ok('los límites de uso deben ser enteros positivos');

  assertServiceError(
    () => clean(validPayload({ startsAt: '2026-10-02', endsAt: '2026-10-01' })),
    'COUPON_DATE_RANGE_INVALID'
  );
  ok('un rango de fechas invertido se rechaza');

  assertServiceError(
    () => clean(validPayload({ startsAt: 'fecha-imposible' })),
    'COUPON_START_DATE_INVALID'
  );
  ok('una fecha inválida no se convierte silenciosamente en ausencia de fecha');

  const segmented = clean(validPayload({ customerIds: [objectId()] }));
  ok('las reglas de cliente se conservan con identidad autoritativa', segmented.customerIds.length === 1);

  const directModel = new Coupon(validPayload({ value: 150 }));
  await assert.rejects(
    () => directModel.validate(),
    (error) => Boolean(error?.errors?.value)
  );
  ok('el modelo también rechaza porcentajes superiores a 100');
}

function validateStatusesAndFilters() {
  const now = Date.now();
  const draft = couponService.serializeCoupon({ status: 'draft', active: false });
  const expired = couponService.serializeCoupon({
    status: 'active',
    active: true,
    endsAt: new Date(now - 1000),
  });
  const scheduled = couponService.serializeCoupon({
    status: 'active',
    active: true,
    startsAt: new Date(now + 60000),
  });
  const exhausted = couponService.serializeCoupon({
    status: 'active',
    active: true,
    usageLimit: 1,
    usageCount: 1,
  });

  ok('borrador conserva su estado efectivo aunque no esté activo', draft.effectiveStatus === 'draft');
  ok('la vigencia vencida prevalece en el estado efectivo', expired.effectiveStatus === 'expired');
  ok('una vigencia futura se reconoce como programada', scheduled.effectiveStatus === 'scheduled');
  ok('un límite consumido se reconoce como agotado', exhausted.effectiveStatus === 'exhausted');
  ok('cada estado efectivo tiene un filtro de servidor', ['active', 'scheduled', 'exhausted', 'expired', 'inactive', 'draft'].every((status) => couponService.buildEffectiveStatusFilter(status)));
}

function validateIndexesAndMigration() {
  const couponIndexes = Coupon.schema.indexes();
  const redemptionIndexes = CouponRedemption.schema.indexes();
  ok('Coupon usa las definiciones canónicas compartidas', couponIndexes.length === COUPON_INDEX_DEFINITIONS.length);
  ok('CouponRedemption usa las definiciones canónicas compartidas', redemptionIndexes.length === COUPON_REDEMPTION_INDEX_DEFINITIONS.length);

  const plan = couponIndexMigration.buildMigrationPlan();
  ok('la migración cubre cupones y redenciones', plan.length === 2 && plan.some((entry) => entry.collection === 'coupons') && plan.some((entry) => entry.collection === 'couponredemptions'));
  assert.throws(
    () => couponIndexMigration.parseArguments(['--desconocido']),
    (error) => error?.code === 'COUPON_INDEX_MIGRATION_UNKNOWN_ARGUMENT'
  );
  ok('la migración rechaza argumentos desconocidos');
  assert.throws(
    () => couponIndexMigration.assertWriteAuthorization({ apply: true, nodeEnv: 'production' }),
    (error) => error?.code === 'COUPON_INDEX_MIGRATION_PRODUCTION_CONFIRMATION_REQUIRED'
  );
  ok('producción exige confirmación adicional para crear índices');
}

function validateComposition() {
  const publicRoutes = read('backend/routes/coupons.js');
  const adminRoutes = read('backend/routes/adminCoupons.js');
  const adminPage = read('frontend/src/admin/coupons/AdminCouponsPage.jsx');
  const workflow = read('.github/workflows/coupons-ci.yml');

  ok('la ruta pública aplica el serializador seguro', publicRoutes.includes('serializePublicValidation'));
  ok('las rutas de Cupones deshabilitan caché privada', publicRoutes.includes("Cache-Control', 'private, no-store") && adminRoutes.includes("Cache-Control', 'private, no-store"));
  ok('los errores internos no se exponen al navegador', publicRoutes.includes('status >= 500 ? fallback') && adminRoutes.includes('status >= 500 ? fallback'));
  ok('la interfaz filtra por estado efectivo del negocio', adminPage.includes('effectiveStatus: statusFilter'));
  ok('vencidos y agotados conducen a corregir su regla', adminPage.includes("'Editar vigencia'") && adminPage.includes("'Ajustar límite'"));
  ok('CI ejecuta contratos, MongoDB aislado, migración y compilación', workflow.includes('test:coupons-level-plus-stage0') && workflow.includes('test:coupons-level-plus-stage0-integration') && workflow.includes('migrate:coupon-indexes') && workflow.includes('npm --prefix frontend run build'));
}

function fakeCollection(existingIndexes = []) {
  const created = [];
  return {
    created,
    listIndexes() {
      return { toArray: async () => [...existingIndexes, ...created] };
    },
    async createIndex(key, options) {
      created.push({ key: { ...key }, ...options });
      return options.name;
    },
  };
}

async function main() {
  validatePublicPrivacy();
  validateCommercialRules();
  await validateStrictPayload();
  validateStatusesAndFilters();
  validateIndexesAndMigration();
  validateComposition();

  const dryRun = await couponIndexMigration.runMigration({ argv: [] });
  ok('el modo predeterminado de la migración no escribe', dryRun.mode === 'dry-run' && dryRun.mutations === 0 && dryRun.destructiveOperations.length === 0);

  const couponCollection = fakeCollection();
  const redemptionCollection = fakeCollection();
  const applied = await couponIndexMigration.applyCouponIndexes({
    coupons: couponCollection,
    couponredemptions: redemptionCollection,
  });
  ok('la migración crea únicamente los índices faltantes', applied.mutations === 19 && couponCollection.created.length === 9 && redemptionCollection.created.length === 10);

  const safeCouponCollection = fakeCollection();
  const conflictingRedemptions = fakeCollection([
    { name: 'order_1', key: { orderNumber: 1 } },
  ]);
  await assert.rejects(
    () => couponIndexMigration.applyCouponIndexes({
      coupons: safeCouponCollection,
      couponredemptions: conflictingRedemptions,
    }),
    (error) => error?.code === 'COUPON_INDEX_MIGRATION_COUPONREDEMPTIONS_CONFLICT'
  );
  ok('un conflicto detiene ambas colecciones antes de escribir', safeCouponCollection.created.length === 0 && conflictingRedemptions.created.length === 0);

  console.log(`\nCupones Nivel Plus Etapa 0: ${controls}/${controls} controles.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
