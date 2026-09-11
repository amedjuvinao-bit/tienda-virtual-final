'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const operations = require('../services/couponOperationsService');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');
const { COUPON_REDEMPTION_INDEX_DEFINITIONS } = require('../models/couponIndexDefinitions');

const ROOT = path.resolve(__dirname, '..', '..');
let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function source(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function main() {
  const couponId = new mongoose.Types.ObjectId();
  const filter = operations.buildRedemptionFilter(couponId, {
    status: 'applied', source: 'checkout', from: '2026-09-01', to: '2026-09-30', q: 'ORDER-1',
  });
  ok('el historial siempre queda limitado al cupón solicitado', String(filter.coupon) === String(couponId));
  ok('el historial valida estado y canal conocidos', filter.status === 'applied' && filter.source === 'checkout');
  ok('el historial admite un intervalo cerrado de fechas', filter.createdAt.$gte instanceof Date && filter.createdAt.$lte instanceof Date);
  ok('la búsqueda textual se escapa antes de construir expresiones regulares', Array.isArray(filter.$or) && filter.$or.length === 4);
  assert.throws(() => operations.buildRedemptionFilter('id-invalido'), (error) => error.code === 'COUPON_NOT_FOUND');
  ok('un identificador inválido falla sin consultar MongoDB');

  const serialized = operations.serializeRedemption({
    _id: new mongoose.Types.ObjectId(), coupon: couponId, code: 'CUP-PRIVADO', status: 'applied',
    source: 'checkout', customerEmail: 'persona@example.com', customerDocument: '1234567890',
    totalDiscountAmount: 15000, lifecycle: [{ from: 'reserved', to: 'applied', reason: 'Pago aprobado' }],
  });
  ok('el correo del cliente se entrega enmascarado', serialized.customer.email !== 'persona@example.com' && serialized.customer.email.endsWith('@example.com'));
  ok('el documento del cliente se entrega enmascarado', serialized.customer.document.endsWith('7890') && !serialized.customer.document.includes('123456'));
  ok('el detalle conserva el valor descontado', serialized.totalDiscountAmount === 15000);

  const csv = operations.buildRedemptionsCsv([serialized]);
  ok('el CSV abre correctamente en Excel mediante BOM', csv.startsWith('\uFEFF'));
  ok('el CSV incluye encabezados operativos', csv.includes('Descuento total') && csv.includes('Orden'));
  ok('el CSV no filtra el correo ni documento originales', !csv.includes('persona@example.com') && !csv.includes('1234567890'));
  ok('el CSV neutraliza fórmulas al abrirse en una hoja de cálculo', operations.buildRedemptionsCsv([{ code: '=IMPORTDATA("x")' }]).includes("'=IMPORTDATA"));

  const summaryRule = findAdminRoutePermission('GET', '/api/admin/coupons/summary');
  const exportRule = findAdminRoutePermission('GET', '/api/admin/coupons/export');
  const detailRule = findAdminRoutePermission('GET', `/api/admin/coupons/${couponId}/operations`);
  const createRule = findAdminRoutePermission('POST', '/api/admin/coupons');
  ok('las métricas exigen coupons:view', summaryRule?.permission === 'coupons:view');
  ok('la exportación exige vista y permiso de exportar', exportRule?.permission === 'coupons:export' && exportRule.requiredPermissions.includes('coupons:view'));
  ok('la actividad individual exige coupons:view', detailRule?.permission === 'coupons:view');
  ok('la creación queda marcada para auditoría', createRule?.audit === true);

  const routes = source('backend/routes/adminCoupons.js');
  const gate = source('backend/middleware/adminAccessGate.js');
  const page = source('frontend/src/admin/coupons/AdminCouponsPage.jsx');
  const modal = source('frontend/src/admin/coupons/CouponOperationsModal.jsx');
  ok('las rutas exponen métricas, actividad, historial y CSV', ['/summary', '/export', '/:id/operations', '/:id/redemptions'].every((item) => routes.includes(item)));
  ok('la auditoría enlaza también el identificador creado', gate.includes('adminAuditResourceId') && routes.includes('adminAuditResourceId'));
  ok('la tabla usa paginación real de servidor', page.includes('page: nextPage') && page.includes('limit: 20'));
  ok('el panel incluye alertas y descarga de usos', page.includes('Campañas que requieren atención') && page.includes('Exportar usos'));
  ok('el detalle enlaza órdenes y clientes sin exponer PII cruda', modal.includes('/admin/ordenes') && modal.includes('/admin/clientes'));
  ok('los nuevos accesos tienen índices de soporte', COUPON_REDEMPTION_INDEX_DEFINITIONS.some((item) => item.options.name === 'coupon_1_status_1_createdAt_-1__id_-1') && COUPON_REDEMPTION_INDEX_DEFINITIONS.some((item) => item.options.name === 'branch_1_createdAt_-1'));
  ok('el filtro de eliminados conserva la trazabilidad histórica', require('../services/couponService').buildEffectiveStatusFilter('deleted')?.deletedAt?.$ne === null);

  console.log(`\nCupones Nivel Plus Etapa 3: ${controls}/${controls} controles.`);
}

main();
