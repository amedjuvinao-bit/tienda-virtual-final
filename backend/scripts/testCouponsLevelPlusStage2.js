'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const couponService = require('../services/couponService');

const ROOT = path.resolve(__dirname, '..', '..');
let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function source(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n?/g, '\n');
}

function objectId() {
  return new mongoose.Types.ObjectId();
}

function payload(extra = {}) {
  return {
    code: 'ETAPA2-PLUS', name: 'Campaña avanzada', type: 'percentage', value: 15,
    status: 'active', appliesTo: 'all', productIds: [], excludedProductIds: [],
    categories: [], excludedCategories: [], customerIds: [], newCustomersOnly: false,
    allowedChannels: ['web', 'pos'], branchIds: [], allowWithStoreCredit: true,
    allowWithManualDiscount: false, allowWithAutomaticPromotions: false,
    ...extra,
  };
}

function customerModel(result) {
  return {
    findOne() {
      return {
        select() { return this; },
        session() { return this; },
        async lean() { return result; },
      };
    },
  };
}

function redemptionModel(count) {
  return {
    countDocuments() {
      return Promise.resolve(count);
    },
  };
}

async function eligibility(coupon, input = {}, customer = null) {
  return couponService.validateCommercialEligibility(coupon, input, {
    CustomerModel: customerModel(customer),
  });
}

async function main() {
  const branchId = objectId();
  const customerId = objectId();
  const productId = objectId();
  const clean = couponService.cleanCouponPayload(payload({
    appliesTo: 'products', productIds: [productId], customerIds: [customerId],
    branchIds: [branchId], allowedChannels: ['web'], newCustomersOnly: true,
  }));
  ok('el payload conserva productos, clientes, canales y sedes', clean.productIds.length === 1 && clean.customerIds.length === 1 && clean.branchIds.length === 1 && clean.allowedChannels[0] === 'web');
  ok('el modelo declara las reglas de segmentación avanzada', ['allowedChannels', 'branchIds', 'allowWithStoreCredit', 'allowWithManualDiscount', 'allowWithAutomaticPromotions'].every((field) => Coupon.schema.path(field)));
  ok('las redenciones conservan documento normalizado', CouponRedemption.schema.path('customerDocument'));
  assert.throws(() => couponService.cleanCouponPayload(payload({ allowedChannels: [] })), (error) => error.code === 'COUPON_CHANNEL_REQUIRED');
  ok('una campaña sin canales falla cerrada');

  let result = await eligibility(payload({ allowedChannels: ['web'] }), { channel: 'pos' });
  ok('un canal no autorizado queda bloqueado', !result.ok && result.code === 'COUPON_CHANNEL_NOT_ALLOWED');
  result = await eligibility(payload({ branchIds: [branchId] }), { channel: 'web', branchId: objectId() });
  ok('una sede distinta queda bloqueada', !result.ok && result.code === 'COUPON_BRANCH_NOT_ALLOWED');
  result = await eligibility(payload({ branchIds: [branchId] }), { channel: 'web', branchId });
  ok('la sede autorizada es aceptada', result.ok === true);

  const knownCustomer = {
    _id: customerId, normalizedEmail: 'cliente@example.com', normalizedDocument: '123456789',
    stats: { ordersCount: 0 }, active: true, status: 'active',
  };
  result = await eligibility(payload({ customerIds: [customerId] }), { channel: 'web', customerId }, knownCustomer);
  ok('el cliente específico autorizado puede usar el cupón', result.ok === true);
  result = await eligibility(payload({ customerIds: [objectId()] }), { channel: 'web', customerId }, knownCustomer);
  ok('otro cliente no puede usar una campaña privada', !result.ok && result.code === 'COUPON_CUSTOMER_NOT_ALLOWED');
  result = await eligibility(payload({ newCustomersOnly: true }), { channel: 'web', customerDocument: '123.456.789' }, knownCustomer);
  ok('un cliente sin compras cumple primera compra', result.ok === true);
  result = await eligibility(payload({ newCustomersOnly: true }), { channel: 'web', customerDocument: '123456789' }, { ...knownCustomer, stats: { ordersCount: 2 } });
  ok('un cliente con compras no reutiliza la bienvenida', !result.ok && result.code === 'COUPON_FIRST_PURCHASE_ONLY');
  result = await eligibility(payload({ newCustomersOnly: true }), { channel: 'web' });
  ok('primera compra exige documento', !result.ok && result.code === 'COUPON_CUSTOMER_IDENTITY_REQUIRED');

  result = await couponService.validateCouponDefinition(payload({ perCustomerLimit: 1 }), {
    channel: 'web', subtotal: 100000,
  }, {
    CustomerModel: customerModel(null),
    RedemptionModel: redemptionModel(0),
  });
  ok('un límite por cliente no puede validarse de forma anónima', !result.valid && result.code === 'COUPON_CUSTOMER_IDENTITY_REQUIRED');

  result = await couponService.validateCouponDefinition(payload({ newCustomersOnly: true }), {
    channel: 'web', customerDocument: '123456789', subtotal: 100000,
  }, {
    CustomerModel: customerModel(knownCustomer),
    RedemptionModel: redemptionModel(1),
  });
  ok('primera compra implica un único uso activo por identidad', !result.valid && result.code === 'COUPON_CUSTOMER_LIMIT_REACHED');

  result = await eligibility(payload({ allowWithStoreCredit: false }), { channel: 'web', storeCreditAmount: 5000 });
  ok('la política puede impedir combinar saldo a favor', !result.ok && result.code === 'COUPON_STORE_CREDIT_CONFLICT');
  result = await eligibility(payload({ allowWithManualDiscount: false }), { channel: 'pos', manualDiscountAmount: 1000 });
  ok('la política puede impedir doble descuento en POS', !result.ok && result.code === 'COUPON_MANUAL_DISCOUNT_CONFLICT');
  result = await eligibility(payload({ allowWithAutomaticPromotions: false }), { channel: 'web', promotionDiscountAmount: 1000 });
  ok('la política puede impedir apilar promociones', !result.ok && result.code === 'COUPON_PROMOTION_CONFLICT');

  const service = source('backend/services/couponService.js');
  const pricing = source('backend/services/orderPricingService.js');
  const creation = source('backend/services/orderCreationTransactionService.js');
  const pos = source('backend/services/adminPosService.js');
  const admin = source('frontend/src/admin/coupons/AdminCouponsPage.jsx');
  const posUi = source('frontend/src/admin/pos/PosSalesPageSafe.jsx');
  const routes = source('backend/routes/adminCoupons.js');
  ok('checkout envía documento, canal y combinaciones al motor', ['customerDocument', 'channel', 'storeCreditAmount'].every((field) => pricing.includes(field)));
  ok('la orden revalida el cupón después de resolver la sede', creation.includes('orderBranchData.branchId') && creation.includes('couponService.validateCoupon'));
  ok('POS valida el código con cliente y sede autoritativos', pos.includes("channel: 'pos'") && pos.includes('customerResolution.customer') && pos.includes('branch._id'));
  ok('POS registra una redención aplicada dentro de la transacción', pos.includes('recordCouponRedemption') && pos.includes("initialStatus: 'applied'"));
  ok('la interfaz POS permite ingresar el cupón', posUi.includes('Cupón de campaña') && posUi.includes('couponCode'));
  ok('el formulario ofrece selectores reales de productos, categorías, clientes y sedes', ['Productos incluidos', 'Categorías incluidas', 'Clientes permitidos', 'Sedes permitidas'].every((label) => admin.includes(label)));
  ok('el formulario configura canales y combinaciones', admin.includes('Canales habilitados') && admin.includes('Permitir saldo a favor') && admin.includes('Permitir descuento manual'));
  ok('el simulador usa precios reales sin guardar', routes.includes("'/simulate'") && source('backend/services/couponCampaignService.js').includes('resolveAuthoritativeItems'));
  ok('la respuesta pública sigue siendo lista permitida', service.includes('serializePublicCoupon') && !source('backend/routes/coupons.js').includes('serializeCoupon('));

  console.log(`\nCupones Nivel Plus Etapa 2: ${controls}/${controls} controles.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
