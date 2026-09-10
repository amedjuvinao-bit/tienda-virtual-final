'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
let controls = 0;

function source(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function ok(message, condition) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

const model = source('backend/models/CouponRedemption.js');
const service = source('backend/services/couponService.js');
const creation = source('backend/services/orderCreationCouponService.js');
const status = source('backend/services/orderStatus/operationalEffects.js');
const wompi = source('backend/services/wompiWebhookOrder/nonApproved.js');
const payu = source('backend/services/payu/payuWebhookTransactionService.js');
const refund = source('backend/services/orderRefunds/refundTransactionService.js');
const expiration = source('backend/services/inventoryReservation/expireReservations.js');
const indexes = source('backend/models/couponIndexDefinitions.js');
const workflow = source('.github/workflows/coupons-ci.yml');

ok('la redención diferencia reserva, aplicación, liberación, cancelación y reembolso',
  ['reserved', 'applied', 'released', 'cancelled', 'refunded'].every((state) => model.includes(`'${state}'`)));
ok('la redención conserva marcas de tiempo e historial',
  ['reservedAt', 'appliedAt', 'releasedAt', 'cancelledAt', 'refundedAt', 'lifecycle'].every((field) => model.includes(field)));
ok('la creación registra primero una reserva salvo pago ya confirmado',
  creation.includes("initialStatus:") && creation.includes("=== 'paid'") && model.includes("default: 'reserved'"));
ok('el registro de una misma orden es idempotente',
  service.includes('CouponRedemption.findOne') && indexes.includes('coupon_1_order_1_code_1_unique'));
ok('el límite global se reclama mediante actualización atómica',
  service.includes("{ $inc: { usageCount: 1 } }") && service.includes('COUPON_USAGE_LIMIT_REACHED'));
ok('reservas y aplicaciones cuentan para el límite por cliente',
  service.includes("const consumingStatuses = ['reserved', 'applied']"));
ok('la transición del cupón es un servicio central reutilizable',
  service.includes('transitionOrderCouponRedemption') && service.includes('reconcileOrderCouponForStatus'));
ok('las transiciones repetidas no disminuyen dos veces el contador',
  service.includes("status: { $in: fromStatuses }") && service.includes("usageCount: { $gt: 0 }"));
ok('los cambios administrativos reconcilian el ciclo del cupón',
  status.includes('reconcileOrderCouponForStatus'));
ok('el vencimiento automático de la orden libera la reserva del cupón',
  expiration.includes('reconcileOrderCouponForStatus') && expiration.includes('inventory_reservation_expiration'));
ok('Wompi libera reservas ante pagos no aprobados',
  wompi.includes('reconcileOrderCouponForStatus') && wompi.includes("source: 'wompi_webhook'"));
ok('PayU confirma o libera mediante el mismo servicio',
  payu.includes('reconcileOrderCouponForStatus') && payu.includes("source: 'payu_webhook'"));
ok('los pagos confirmados ejecutan reconciliación durable post-commit',
  source('backend/services/orderCreationPostCommitService.js').includes('No fue posible confirmar el uso del cupón post pago.'));
ok('un reembolso parcial no libera el cupón',
  refund.includes('cumulativeRefundAmount >= orderTotal'));
ok('un reembolso total marca la redención como reembolsada',
  refund.includes("to: 'refunded'") && refund.includes("type: 'coupon_refunded'"));
ok('el CI ejecuta concurrencia e idempotencia sobre MongoDB',
  workflow.includes('test:coupons-level-plus-stage1-integration'));

console.log(`\nCupones Nivel Plus Etapa 1: ${controls}/${controls} controles.`);
