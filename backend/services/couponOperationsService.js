'use strict';

const mongoose = require('mongoose');

const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const AdminAuditLog = require('../models/AdminAuditLog');
const couponService = require('./couponService');

const REDEMPTION_STATUSES = ['reserved', 'applied', 'released', 'cancelled', 'refunded'];
const REDEMPTION_SOURCES = ['checkout', 'admin', 'pos', 'manual'];
const EXPORT_LIMIT = 10000;

function clean(value, max = 200) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function positiveInteger(value, fallback, max = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(max, parsed);
}

function escapeRegex(value) {
  return clean(value, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDate(value, { endOfDay = false } = {}) {
  const text = clean(value, 40);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}

function assertCouponId(id) {
  if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
    const error = new Error('Cupón no encontrado.');
    error.status = 404;
    error.code = 'COUPON_NOT_FOUND';
    throw error;
  }
  return new mongoose.Types.ObjectId(String(id));
}

function maskEmail(value) {
  const email = clean(value, 180).toLowerCase();
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  const shown = local.slice(0, Math.min(2, local.length));
  return `${shown}${'*'.repeat(Math.max(2, Math.min(6, local.length - shown.length)))}@${domain}`;
}

function maskDocument(value) {
  const document = clean(value, 80).replace(/\s+/g, '');
  if (!document) return '';
  if (document.length <= 4) return '*'.repeat(document.length);
  return `${'*'.repeat(Math.min(8, document.length - 4))}${document.slice(-4)}`;
}

function buildRedemptionFilter(couponId, params = {}) {
  const filter = { coupon: assertCouponId(couponId) };
  const status = clean(params.status, 30).toLowerCase();
  const source = clean(params.source, 30).toLowerCase();
  if (REDEMPTION_STATUSES.includes(status)) filter.status = status;
  if (REDEMPTION_SOURCES.includes(source)) filter.source = source;

  const from = parseDate(params.from || params.dateFrom);
  const to = parseDate(params.to || params.dateTo, { endOfDay: true });
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }

  const q = escapeRegex(params.q || params.search);
  if (q) {
    const regex = new RegExp(q, 'i');
    filter.$or = [
      { orderNumber: regex },
      { customerEmail: regex },
      { customerDocument: regex },
      { code: regex },
    ];
  }
  return filter;
}

function effectiveStatusExpression(now) {
  return {
    $switch: {
      branches: [
        { case: { $eq: ['$status', 'draft'] }, then: 'draft' },
        {
          case: {
            $or: [
              { $eq: ['$status', 'expired'] },
              { $and: [{ $ne: ['$endsAt', null] }, { $lte: ['$endsAt', now] }] },
            ],
          },
          then: 'expired',
        },
        {
          case: {
            $or: [
              { $eq: ['$active', false] },
              { $eq: ['$status', 'inactive'] },
            ],
          },
          then: 'inactive',
        },
        {
          case: { $and: [{ $ne: ['$startsAt', null] }, { $gt: ['$startsAt', now] }] },
          then: 'scheduled',
        },
        {
          case: {
            $and: [
              { $gt: [{ $ifNull: ['$usageLimit', 0] }, 0] },
              { $gte: [{ $ifNull: ['$usageCount', 0] }, '$usageLimit'] },
            ],
          },
          then: 'exhausted',
        },
      ],
      default: 'active',
    },
  };
}

function countStatus(status) {
  return { $sum: { $cond: [{ $eq: ['$_effectiveStatus', status] }, 1, 0] } };
}

async function getCouponDashboard({ now = new Date(), alertDays = 7 } = {}) {
  const safeNow = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const alertUntil = new Date(safeNow.getTime() + positiveInteger(alertDays, 7, 60) * 86400000);

  const [campaignResult, redemptionResult] = await Promise.all([
    Coupon.aggregate([
      { $match: { deletedAt: null } },
      { $addFields: { _effectiveStatus: effectiveStatusExpression(safeNow) } },
      {
        $facet: {
          counters: [{
            $group: {
              _id: null,
              totalCampaigns: { $sum: 1 },
              active: countStatus('active'),
              scheduled: countStatus('scheduled'),
              exhausted: countStatus('exhausted'),
              expired: countStatus('expired'),
              inactive: countStatus('inactive'),
              draft: countStatus('draft'),
              currentUses: { $sum: { $ifNull: ['$usageCount', 0] } },
            },
          }],
          alerts: [
            {
              $addFields: {
                _remainingUses: {
                  $cond: [
                    { $gt: [{ $ifNull: ['$usageLimit', 0] }, 0] },
                    { $max: [0, { $subtract: ['$usageLimit', { $ifNull: ['$usageCount', 0] }] }] },
                    null,
                  ],
                },
              },
            },
            {
              $match: {
                _effectiveStatus: { $in: ['active', 'exhausted'] },
                $or: [
                  { endsAt: { $gt: safeNow, $lte: alertUntil } },
                  { _remainingUses: { $ne: null, $lte: 5 } },
                ],
              },
            },
            { $sort: { endsAt: 1, _remainingUses: 1, createdAt: -1 } },
            { $limit: 8 },
            {
              $project: {
                _id: 1,
                code: 1,
                name: 1,
                endsAt: 1,
                remainingUses: '$_remainingUses',
                alertType: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$_effectiveStatus', 'exhausted'] }, then: 'exhausted' },
                      {
                        case: { $and: [{ $ne: ['$endsAt', null] }, { $lte: ['$endsAt', alertUntil] }] },
                        then: 'expiring',
                      },
                    ],
                    default: 'low_stock',
                  },
                },
              },
            },
          ],
        },
      },
    ]),
    CouponRedemption.aggregate([
      {
        $group: {
          _id: null,
          totalRedemptions: { $sum: 1 },
          confirmedRedemptions: {
            $sum: { $cond: [{ $in: ['$status', ['applied', 'refunded']] }, 1, 0] },
          },
          reservedRedemptions: {
            $sum: { $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0] },
          },
          releasedRedemptions: {
            $sum: { $cond: [{ $in: ['$status', ['released', 'cancelled']] }, 1, 0] },
          },
          totalDiscount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['applied', 'refunded']] },
                { $ifNull: ['$totalDiscountAmount', 0] },
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const campaigns = campaignResult?.[0]?.counters?.[0] || {};
  const redemptions = redemptionResult?.[0] || {};
  const alerts = campaignResult?.[0]?.alerts || [];
  return {
    metrics: {
      totalCampaigns: Number(campaigns.totalCampaigns || 0),
      active: Number(campaigns.active || 0),
      scheduled: Number(campaigns.scheduled || 0),
      exhausted: Number(campaigns.exhausted || 0),
      expired: Number(campaigns.expired || 0),
      inactive: Number(campaigns.inactive || 0),
      draft: Number(campaigns.draft || 0),
      currentUses: Number(campaigns.currentUses || 0),
      totalRedemptions: Number(redemptions.totalRedemptions || 0),
      confirmedRedemptions: Number(redemptions.confirmedRedemptions || 0),
      reservedRedemptions: Number(redemptions.reservedRedemptions || 0),
      releasedRedemptions: Number(redemptions.releasedRedemptions || 0),
      totalDiscount: Number(redemptions.totalDiscount || 0),
    },
    alerts: alerts.map((alert) => ({
      couponId: String(alert._id),
      code: clean(alert.code, 40),
      name: clean(alert.name, 120),
      type: alert.alertType,
      endsAt: alert.endsAt || null,
      remainingUses: alert.remainingUses == null ? null : Number(alert.remainingUses),
    })),
    generatedAt: safeNow,
  };
}

function plain(value) {
  return value?.toObject ? value.toObject() : { ...(value || {}) };
}

function serializeRedemption(value) {
  const redemption = plain(value);
  const customer = plain(redemption.customer);
  const order = plain(redemption.order);
  const directBranch = plain(redemption.branch);
  const orderBranch = plain(order.branch);
  const branch = directBranch?._id ? directBranch : orderBranch;
  return {
    id: String(redemption._id || ''),
    couponId: String(redemption.coupon?._id || redemption.coupon || ''),
    code: clean(redemption.code, 40),
    status: clean(redemption.status, 30),
    source: clean(redemption.source, 30),
    order: {
      id: String(order._id || redemption.order || ''),
      number: clean(order.orderNumber || redemption.orderNumber, 80),
      status: clean(order.status, 30),
      paymentStatus: clean(order.payment?.status || order.paymentStatus, 30),
    },
    customer: {
      id: String(customer._id || redemption.customer || ''),
      code: clean(customer.customerCode, 80),
      email: maskEmail(customer.email || redemption.customerEmail),
      document: maskDocument(customer.documentNumber || redemption.customerDocument),
    },
    branch: {
      id: String(branch?._id || redemption.branch || ''),
      name: clean(branch?.name, 120),
      code: clean(branch?.code, 80),
    },
    subtotal: Number(redemption.subtotal || 0),
    shippingAmount: Number(redemption.shippingAmount || 0),
    discountAmount: Number(redemption.discountAmount || 0),
    shippingDiscountAmount: Number(redemption.shippingDiscountAmount || 0),
    totalDiscountAmount: Number(redemption.totalDiscountAmount || 0),
    reservedAt: redemption.reservedAt || null,
    appliedAt: redemption.appliedAt || null,
    releasedAt: redemption.releasedAt || null,
    cancelledAt: redemption.cancelledAt || null,
    refundedAt: redemption.refundedAt || null,
    lifecycle: Array.isArray(redemption.lifecycle)
      ? redemption.lifecycle.map((event) => ({
          from: clean(event.from, 30),
          to: clean(event.to, 30),
          reason: clean(event.reason, 500),
          source: clean(event.source, 60),
          at: event.at || null,
        }))
      : [],
    createdAt: redemption.createdAt || null,
    updatedAt: redemption.updatedAt || null,
  };
}

function redemptionQuery(filter) {
  return CouponRedemption.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .populate({
      path: 'order',
      select: 'orderNumber status payment.status branch',
      populate: { path: 'branch', select: 'name code type' },
    })
    .populate('customer', 'customerCode email documentNumber')
    .populate('branch', 'name code type');
}

async function listCouponRedemptions(couponId, params = {}) {
  const couponObjectId = assertCouponId(couponId);
  const coupon = await Coupon.findById(couponObjectId).select('_id code name deletedAt').lean();
  if (!coupon) {
    const error = new Error('Cupón no encontrado.');
    error.status = 404;
    error.code = 'COUPON_NOT_FOUND';
    throw error;
  }

  const page = positiveInteger(params.page, 1, 1000000);
  const limit = positiveInteger(params.limit, 20, 100);
  const filter = buildRedemptionFilter(couponObjectId, params);
  const [total, rows] = await Promise.all([
    CouponRedemption.countDocuments(filter),
    redemptionQuery(filter).skip((page - 1) * limit).limit(limit),
  ]);
  return {
    coupon: { id: String(coupon._id), code: coupon.code, name: coupon.name || '' },
    rows: rows.map(serializeRedemption),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function getCouponOperationsDetail(couponId) {
  const couponObjectId = assertCouponId(couponId);
  const coupon = await Coupon.findById(couponObjectId);
  if (!coupon) {
    const error = new Error('Cupón no encontrado.');
    error.status = 404;
    error.code = 'COUPON_NOT_FOUND';
    throw error;
  }

  const [redemptionSummary, recentRedemptions, auditRows] = await Promise.all([
    CouponRedemption.aggregate([
      { $match: { coupon: couponObjectId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          discount: { $sum: { $ifNull: ['$totalDiscountAmount', 0] } },
        },
      },
    ]),
    redemptionQuery({ coupon: couponObjectId }).limit(10),
    AdminAuditLog.find({ module: 'coupons', resourceId: String(couponObjectId) })
      .select('action permission description method path adminUsername adminRole statusCode success createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .limit(30)
      .lean(),
  ]);

  const byStatus = Object.fromEntries(REDEMPTION_STATUSES.map((status) => [status, { count: 0, discount: 0 }]));
  redemptionSummary.forEach((item) => {
    if (!byStatus[item._id]) return;
    byStatus[item._id] = { count: Number(item.count || 0), discount: Number(item.discount || 0) };
  });
  return {
    coupon: couponService.serializeCoupon(coupon),
    activity: {
      byStatus,
      total: Object.values(byStatus).reduce((sum, item) => sum + item.count, 0),
      totalDiscount: byStatus.applied.discount + byStatus.refunded.discount,
    },
    recentRedemptions: recentRedemptions.map(serializeRedemption),
    audit: auditRows.map((event) => ({
      id: String(event._id),
      action: clean(event.action, 100),
      permission: clean(event.permission, 100),
      description: clean(event.description, 240),
      method: clean(event.method, 10),
      path: clean(event.path, 240),
      actor: clean(event.adminUsername || event.adminRole || 'Administrador', 120),
      success: event.success === true,
      statusCode: Number(event.statusCode || 0),
      createdAt: event.createdAt || null,
    })),
  };
}

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  const safeText = /^[=+\-@\t]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function buildRedemptionsCsv(rows = []) {
  const headers = [
    'Fecha', 'Código', 'Estado', 'Orden', 'Cliente', 'Canal', 'Sede',
    'Subtotal', 'Descuento productos', 'Descuento envío', 'Descuento total',
  ];
  const lines = [headers.map(csvCell).join(',')];
  rows.forEach((row) => {
    lines.push([
      row.createdAt ? new Date(row.createdAt).toISOString() : '',
      row.code,
      row.status,
      row.order?.number,
      row.customer?.code || row.customer?.email || row.customer?.document,
      row.source,
      row.branch?.name || row.branch?.code,
      row.subtotal,
      row.discountAmount,
      row.shippingDiscountAmount,
      row.totalDiscountAmount,
    ].map(csvCell).join(','));
  });
  return `\uFEFF${lines.join('\r\n')}`;
}

async function exportCouponRedemptions(params = {}) {
  const couponFilter = couponService.buildCouponListFilter(params);
  const coupons = await Coupon.find(couponFilter).select('_id').lean();
  const couponIds = coupons.map((coupon) => coupon._id);
  const filter = couponIds.length ? { coupon: { $in: couponIds } } : { coupon: { $in: [] } };
  const status = clean(params.redemptionStatus, 30).toLowerCase();
  const source = clean(params.source, 30).toLowerCase();
  if (REDEMPTION_STATUSES.includes(status)) filter.status = status;
  if (REDEMPTION_SOURCES.includes(source)) filter.source = source;
  const from = parseDate(params.from || params.dateFrom);
  const to = parseDate(params.to || params.dateTo, { endOfDay: true });
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  const rows = await redemptionQuery(filter).limit(EXPORT_LIMIT + 1);
  const truncated = rows.length > EXPORT_LIMIT;
  const serialized = rows.slice(0, EXPORT_LIMIT).map(serializeRedemption);
  const date = new Date().toISOString().slice(0, 10);
  return {
    csv: buildRedemptionsCsv(serialized),
    filename: `redenciones-cupones-${date}.csv`,
    rows: serialized.length,
    truncated,
  };
}

module.exports = {
  REDEMPTION_STATUSES,
  REDEMPTION_SOURCES,
  buildRedemptionFilter,
  serializeRedemption,
  buildRedemptionsCsv,
  getCouponDashboard,
  listCouponRedemptions,
  getCouponOperationsDetail,
  exportCouponRedemptions,
  __test: { maskEmail, maskDocument, parseDate, effectiveStatusExpression },
};
