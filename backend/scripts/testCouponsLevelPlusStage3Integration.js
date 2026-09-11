'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');
const AdminAuditLog = require('../models/AdminAuditLog');
const couponService = require('../services/couponService');
const operations = require('../services/couponOperationsService');
const { applyCouponIndexes } = require('../services/couponIndexMigrationService');

const MONGO_URI = String(process.env.COUPONS_STAGE3_MONGO_URI || '').trim();
const PREFIX = 'CUP-STAGE3-';
let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

async function cleanup() {
  const coupons = await Coupon.find({ code: new RegExp(`^${PREFIX}`) }).select('_id').lean();
  const ids = coupons.map((coupon) => coupon._id);
  if (ids.length) {
    await CouponRedemption.deleteMany({ coupon: { $in: ids } });
    await AdminAuditLog.deleteMany({ module: 'coupons', resourceId: { $in: ids.map(String) } });
  }
  await Coupon.deleteMany({ code: new RegExp(`^${PREFIX}`) });
  await Customer.deleteMany({ customerCode: new RegExp(`^${PREFIX}`) });
  await Branch.deleteMany({ code: new RegExp(`^${PREFIX}`) });
}

async function main() {
  assert.match(MONGO_URI, /^mongodb(?:\+srv)?:\/\//i, 'COUPONS_STAGE3_MONGO_URI_REQUIRED');
  await mongoose.connect(MONGO_URI, { autoIndex: false });
  try {
    await cleanup();
    await applyCouponIndexes({
      coupons: mongoose.connection.collection('coupons'),
      couponredemptions: mongoose.connection.collection('couponredemptions'),
    });

    const branch = await Branch.create({ name: 'Sede Etapa 3', code: `${PREFIX}SEDE`, type: 'store', status: 'active' });
    const customer = await Customer.create({
      customerCode: `${PREFIX}CLIENTE`, fullName: 'Cliente etapa tres', email: 'cliente.etapa3@example.com',
      documentType: 'CC', documentNumber: '930000001', source: 'admin', stats: { ordersCount: 1 },
    });
    const now = new Date();
    const coupon = await couponService.createCoupon({
      code: `${PREFIX}ACTIVO`, name: 'Operación etapa tres', type: 'fixed', value: 9000,
      status: 'active', appliesTo: 'all', usageLimit: 4, perCustomerLimit: 2,
      startsAt: new Date(now.getTime() - 86400000), endsAt: new Date(now.getTime() + 2 * 86400000),
      allowedChannels: ['web'], branchIds: [branch._id],
    });
    const orderId = new mongoose.Types.ObjectId();
    await couponService.recordCouponRedemption({
      couponId: coupon._id, code: coupon.code, orderId, orderNumber: `${PREFIX}ORDER-1`,
      customerId: customer._id, customerEmail: customer.email, customerDocument: customer.documentNumber,
      branchId: branch._id, source: 'checkout', subtotal: 100000, shippingAmount: 12000,
      discount: { discountAmount: 9000, totalDiscountAmount: 9000 },
    }, { initialStatus: 'applied', source: 'stage3_integration' });
    await AdminAuditLog.create({
      action: 'coupons:update', permission: 'coupons:update', module: 'coupons', description: 'Editar cupón de prueba.',
      method: 'PUT', path: `/api/admin/coupons/${coupon._id}`, routePattern: '/api/admin/coupons/:id',
      resourceId: String(coupon._id), adminUsername: 'stage3-admin', adminRole: 'owner', statusCode: 200, success: true,
    });

    const dashboard = await operations.getCouponDashboard({ now });
    ok('las métricas globales se calculan en MongoDB', dashboard.metrics.totalCampaigns >= 1 && dashboard.metrics.currentUses >= 1);
    ok('una redención aplicada alimenta indicadores financieros', dashboard.metrics.confirmedRedemptions >= 1 && dashboard.metrics.totalDiscount >= 9000);
    ok('el vencimiento próximo genera una alerta operativa', dashboard.alerts.some((alert) => alert.couponId === String(coupon._id) && alert.type === 'expiring'));

    const history = await operations.listCouponRedemptions(coupon._id, { status: 'applied', source: 'checkout', page: 1, limit: 10 });
    ok('el historial filtra y pagina desde el servidor', history.total === 1 && history.page === 1 && history.pages === 1);
    ok('cada uso incluye orden, sede y valor descontado', history.rows[0].order.number === `${PREFIX}ORDER-1` && history.rows[0].branch.code === `${PREFIX}SEDE` && history.rows[0].totalDiscountAmount === 9000);
    ok('los datos personales se entregan enmascarados', history.rows[0].customer.email !== customer.email && history.rows[0].customer.document.endsWith('0001'));

    const detail = await operations.getCouponOperationsDetail(coupon._id);
    ok('el detalle resume estados de redención', detail.activity.byStatus.applied.count === 1 && detail.activity.totalDiscount === 9000);
    ok('el detalle recupera auditoría vinculada al cupón', detail.audit.some((event) => event.actor === 'stage3-admin'));

    const exported = await operations.exportCouponRedemptions({ q: `${PREFIX}ACTIVO`, redemptionStatus: 'applied' });
    ok('la exportación respeta filtros y genera CSV', exported.rows === 1 && exported.csv.includes(`${PREFIX}ORDER-1`));
    ok('el CSV no expone correo ni documento completos', !exported.csv.includes(customer.email) && !exported.csv.includes(customer.documentNumber));

    const indexes = await mongoose.connection.collection('couponredemptions').indexes();
    ok('MongoDB tiene índice de historial por cupón y estado', indexes.some((index) => index.name === 'coupon_1_status_1_createdAt_-1__id_-1'));
    ok('MongoDB tiene índice de reportes por sede', indexes.some((index) => index.name === 'branch_1_createdAt_-1'));

    await couponService.deleteCoupon(coupon._id);
    const archived = await couponService.listCoupons({ effectiveStatus: 'deleted' });
    ok('los cupones eliminados siguen disponibles en el filtro histórico', archived.rows.some((row) => String(row._id) === String(coupon._id) && row.effectiveStatus === 'deleted'));
    const retained = await operations.getCouponOperationsDetail(coupon._id);
    ok('el historial permanece consultable después del borrado lógico', retained.activity.byStatus.applied.count === 1);

    console.log(`\nCupones Nivel Plus Etapa 3 MongoDB: ${controls}/${controls} controles.`);
  } finally {
    await cleanup().catch(() => null);
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
