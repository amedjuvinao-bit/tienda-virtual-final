// backend/routes/orders.js
const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const crypto = require('crypto');
const {
  extractFactusLinks,
} = require('../lib/dian/factusDownloads');
const { generateOrderPdf } = require('../lib/orderPdfGenerator');
const { generateCUFE } = require('../lib/dian/cufe');
const { generateInvoiceXML } = require('../lib/dian/xmlGenerator');
const Order = require('../models/Order');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const SiteSettings = require('../models/SiteSettings');
const Subscriber = require('../models/Subscriber');
const Product = require('../models/Product');
const Counter = require('../models/Counter');
const { sendMail } = require('../lib/mailer');

// nuevos
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const validateOrderPayload = require('../validators/orderPayload');
const IdempotencyKey = require('../models/IdempotencyKey');

/* -------------------------------------------------------
 * RATE LIMIT LIGERO (en memoria) para mutaciones
 * (ÚNICAMENTE aplicado a POST /api/orders)
 * ----------------------------------------------------- */
const RL_WINDOW_MS = 10_000;
const RL_MAX_HITS = 40;
const rlBucket = new Map();

function rateLimit(req, res, next) {
  const ip =
    req.ip ||
    req.headers['x-forwarded-for'] ||
    req.connection?.remoteAddress ||
    'unknown';

  const now = Date.now();
  let entry = rlBucket.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RL_WINDOW_MS };
    rlBucket.set(ip, entry);
  }

  entry.count += 1;

  if (entry.count > RL_MAX_HITS) {
    return res
      .status(429)
      .json({ message: 'Rate limit excedido, intenta de nuevo en unos segundos.' });
  }

  next();
}

/* =========================================================
 * Modelos auxiliares
 * ======================================================= */
const OrderEvent =
  mongoose.models.OrderEvent ||
  mongoose.model(
    'OrderEvent',
    new mongoose.Schema(
      {
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true, required: true },
        type: { type: String, required: true },
        message: { type: String },
        meta: { type: Object },
      },
      { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
    ),
    'order_events'
  );

const OrderNote =
  mongoose.models.OrderNote ||
  mongoose.model(
    'OrderNote',
    new mongoose.Schema(
      {
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true, required: true },
        text: { type: String, required: true },
        author: { name: String, id: String },
        pinned: { type: Boolean, default: false },
      },
      { timestamps: true, versionKey: false }
    ),
    'order_notes'
  );

/* ---------------- helpers ---------------- */
function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function qtyOf(it) {
  return Number(it?.quantity ?? it?.qty ?? 0) || 0;
}

function resolvePid(it) {
  return it?._id || it?.productId || it?.id || null;
}

function calcSummaryFromItems(items) {
  const arr = Array.isArray(items) ? items : [];
  let totalItems = 0;
  let subtotal = 0;

  for (const it of arr) {
    const q = qtyOf(it);
    const pr = Number(it?.price ?? it?.unitPrice ?? it?.priceNumber ?? it?.product?.price ?? 0) || 0;
    totalItems += q;
    subtotal += q * pr;
  }

  return { totalItems, subtotal };
}

function normalizeTags(arr) {
  return (Array.isArray(arr) ? arr : String(arr || '')
    .split(',')
    .map((t) => String(t).trim()))
    .map((t) => t.toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean);
}

function asObjectId(id) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

function moneyCOP(n) {
  return Number(n || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
  });
}

function parseBoolean(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return false;
  return ['1', 'true', 'yes', 'y', 'on', 'si', 'sí'].includes(s);
}

const sortBy = (arr, sel) =>
  [...(arr || [])].sort((a, b) => {
    const A = sel(a);
    const B = sel(b);
    return A < B ? -1 : A > B ? 1 : A < B ? -1 : 0;
  });

const IDEMPOTENCY_STALE_MS = 2 * 60 * 1000;

function isIdempotencyRecordStale(record) {
  if (!record) return false;

  const updatedAt = record.updatedAt ? new Date(record.updatedAt).getTime() : 0;
  const createdAt = record.createdAt ? new Date(record.createdAt).getTime() : 0;
  const baseTime = updatedAt || createdAt;

  if (!baseTime) return false;

  return Date.now() - baseTime > IDEMPOTENCY_STALE_MS;
}

function isDuplicateKeyError(error) {
  return String(error?.code || '') === '11000';
}

function isDuplicateOrderNumberError(error) {
  if (!isDuplicateKeyError(error)) return false;

  const keyPattern =
    error?.keyPattern && typeof error.keyPattern === 'object'
      ? error.keyPattern
      : {};

  const keyValue =
    error?.keyValue && typeof error.keyValue === 'object'
      ? error.keyValue
      : {};

  if (keyPattern.orderNumber === 1) return true;
  if (Object.prototype.hasOwnProperty.call(keyValue, 'orderNumber')) return true;

  return /orderNumber/i.test(String(error?.message || ''));
}

function canReuseMutableOrderData(order) {
  const status = String(order?.status || '').trim().toLowerCase();
  const paymentStatus = String(order?.payment?.status || '').trim().toLowerCase();

  if (status === 'paid' || paymentStatus === 'paid') {
    return false;
  }

  return status === 'pending' || status === 'processing';
}

async function syncExistingOrderForRetry(orderId, cleaned, { session } = {}) {
  const order = await Order.findById(orderId).session(session);
  if (!order) return null;

  if (!canReuseMutableOrderData(order)) {
    return order.toObject();
  }

  const summary = calcSummaryFromItems(cleaned.cart);
  const nextSubtotal = Number(cleaned.subtotal ?? summary.subtotal ?? 0);
  const nextShipping = Number(cleaned.shipping ?? 0);
  const nextTotal = Number(cleaned.total ?? nextSubtotal + nextShipping);

  order.sessionId = cleaned.sessionId;
  order.customer = cleaned.customer;
  order.billing = cleaned.billing;

  if (cleaned.payment && typeof cleaned.payment === 'object') {
    order.payment = cleaned.payment;
  }

  if (Array.isArray(cleaned.cart)) {
    order.cart = cleaned.cart;
    if (Array.isArray(order.items)) {
      order.items = cleaned.cart;
    }
  }

  order.summary = {
    ...(order.summary && typeof order.summary === 'object' ? order.summary : {}),
    ...summary,
  };

  order.subtotal = nextSubtotal;
  order.shipping = nextShipping;
  order.total = nextTotal;
  order.tags = Array.isArray(cleaned.tags) ? cleaned.tags : [];

  await order.save({ session });

  await OrderEvent.create(
    [
      {
        orderId: order._id,
        type: 'order_retry_updated',
        message: 'Datos de la orden actualizados antes de reintentar el pago',
        meta: {
          by: 'system_retry',
          sessionId: cleaned.sessionId || null,
          total: nextTotal,
        },
      },
    ],
    { session }
  );

  return order.toObject();
}

/* ---------- validación de stock ---------- */
async function dryRunCheck(cart) {
  const failures = [];

  for (const it of cart) {
    const pid = resolvePid(it);
    const need = qtyOf(it);
    const color = String(it?.color || '');
    const size = String(it?.size || '');

    if (!pid || !need) {
      failures.push({
        productId: pid,
        title: it?.title,
        reason: 'Línea inválida',
        requested: need,
      });
      continue;
    }

    const prod = await Product.findById(pid).lean();

    if (!prod) {
      failures.push({
        productId: pid,
        title: it?.title,
        reason: 'Producto no encontrado',
        requested: need,
      });
      continue;
    }

    if (Array.isArray(prod.inventory) && prod.inventory.length) {
      const variant = prod.inventory.find(
        (v) =>
          new RegExp(`^${escapeRegex(color)}$`, 'i').test(String(v?.color || '')) &&
          new RegExp(`^${escapeRegex(size)}$`, 'i').test(String(v?.size || ''))
      );

      const vStock = Number(variant?.stock || 0);

      if (!variant) {
        failures.push({
          productId: pid,
          title: it?.title,
          reason: `Variante no existe (${color || '-'} / ${size || '-'})`,
          requested: need,
        });
      } else if (vStock < need) {
        failures.push({
          productId: pid,
          title: it?.title,
          reason: `Sin stock suficiente para variante (${color || '-'} / ${size || '-'})`,
          requested: need,
        });
      }
    } else {
      const gStock = Number(prod.stock || 0);

      if (gStock < need) {
        failures.push({
          productId: pid,
          title: it?.title,
          reason: 'Sin stock suficiente',
          requested: need,
        });
      }
    }
  }

  return failures.length ? { ok: false, details: failures } : { ok: true };
}

/* ---------- descuento de inventario ---------- */
async function decrementStock(cart, { session } = {}) {
  const affected = new Set();

  for (const it of cart) {
    const pid = resolvePid(it);
    const need = qtyOf(it);
    const color = String(it?.color || '');
    const size = String(it?.size || '');

    if (!pid || !need) continue;

    const prod = await Product.findById(pid).session(session).lean();

    if (!prod) throw new Error('Producto no encontrado');

    if (Array.isArray(prod.inventory) && prod.inventory.length) {
      const res = await Product.updateOne(
        {
          _id: pid,
          inventory: {
            $elemMatch: {
              color: { $regex: `^${escapeRegex(color)}$`, $options: 'i' },
              size: { $regex: `^${escapeRegex(size)}$`, $options: 'i' },
              stock: { $gte: need },
            },
          },
        },
        { $inc: { 'inventory.$.stock': -need } },
        { session }
      );

      if (!res.matchedCount || !res.modifiedCount) {
        throw new Error(`No se pudo descontar variante (${color}/${size})`);
      }

      affected.add(String(pid));
    } else {
      const res = await Product.updateOne(
        { _id: pid, stock: { $gte: need } },
        { $inc: { stock: -need } },
        { session }
      );

      if (!res.matchedCount || !res.modifiedCount) {
        throw new Error('No se pudo descontar stock global');
      }
    }
  }

  for (const pid of affected) {
    const p = await Product.findById(pid).session(session).lean();
    if (!p) continue;

    if (Array.isArray(p.inventory) && p.inventory.length) {
      const total = p.inventory.reduce(
        (acc, row) => acc + Math.max(0, Number(row?.stock || 0)),
        0
      );

      await Product.updateOne({ _id: pid }, { $set: { stock: total } }, { session });
    }
  }
}

/* ---------- aumento de inventario ---------- */
async function incrementStock(cart, { session } = {}) {
  const affected = new Set();

  for (const it of cart) {
    const pid = resolvePid(it);
    const qty = qtyOf(it);
    const color = String(it?.color || '');
    const size = String(it?.size || '');

    if (!pid || !qty) continue;

    const prod = await Product.findById(pid).session(session).lean();

    if (!prod) throw new Error('Producto no encontrado');

    if (Array.isArray(prod.inventory) && prod.inventory.length) {
      const res = await Product.updateOne(
        {
          _id: pid,
          inventory: {
            $elemMatch: {
              color: { $regex: `^${escapeRegex(color)}$`, $options: 'i' },
              size: { $regex: `^${escapeRegex(size)}$`, $options: 'i' },
            },
          },
        },
        { $inc: { 'inventory.$.stock': qty } },
        { session }
      );

      if (!res.matchedCount || !res.modifiedCount) {
        throw new Error(`Variante no existe (${color}/${size})`);
      }

      affected.add(String(pid));
    } else {
      const res = await Product.updateOne({ _id: pid }, { $inc: { stock: qty } }, { session });

      if (!res.matchedCount || !res.modifiedCount) {
        throw new Error('No se pudo incrementar stock global');
      }
    }
  }

  for (const pid of affected) {
    const p = await Product.findById(pid).session(session).lean();
    if (!p) continue;

    if (Array.isArray(p.inventory) && p.inventory.length) {
      const total = p.inventory.reduce(
        (acc, row) => acc + Math.max(0, Number(row?.stock || 0)),
        0
      );

      await Product.updateOne({ _id: pid }, { $set: { stock: total } }, { session });
    }
  }
}

/* ---------- correlativo ---------- */
async function getNextOrderNumber({ session } = {}) {
  const doc = await Counter.findOneAndUpdate(
    { _id: 'orderNumber' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  ).lean();

  return String(doc.seq).padStart(6, '0');
}

/* ---------- idempotencia ---------- */
function canonicalizeCart(cart) {
  const safe = (Array.isArray(cart) ? cart : [])
    .map((it) => ({
      productId: String(resolvePid(it) || ''),
      title: String(it?.title || ''),
      color: String(it?.color || ''),
      size: String(it?.size || ''),
      price: Number(it?.price ?? it?.unitPrice ?? it?.priceNumber ?? 0) || 0,
      quantity: Number(it?.quantity ?? it?.qty ?? 0) || 0,
    }))
    .filter((it) => it.productId && it.quantity > 0 && it.price >= 0);

  return sortBy(
    safe,
    (x) => `${x.productId}|${x.color.toLowerCase()}|${x.size.toLowerCase()}|${x.price}|${x.quantity}`
  );
}

function getBillingMode(settings = {}) {
  const dianConfig = settings?.billing?.dian || {};
  const dianEnabled = dianConfig.enabled === true;
  const dianMode = String(dianConfig.mode || 'internal').trim().toLowerCase();

  return {
    dianEnabled,
    dianMode,
    isDianActive: dianEnabled && dianMode !== 'internal',
    isInternalMode: !dianEnabled || dianMode === 'internal',
  };
}

function deriveIdempotencyKey(cleaned) {
  const payload = {
    sessionId: String(cleaned.sessionId || ''),
    cart: canonicalizeCart(cleaned.cart),
    subtotal: Number(cleaned.subtotal || 0),
    shipping: Number(cleaned.shipping || 0),
    total: Number(cleaned.total || 0),
    customerEmail: String(cleaned.customer?.emailOrPhone || cleaned.customer?.email || ''),
    createdAtDay: new Date().toISOString().slice(0, 10),
  };

  const json = JSON.stringify(payload);

  return crypto.createHash('sha256').update(json).digest('hex');
}

router.use('/admin', requireAdmin);

const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'total', 'orderNumber']);

function parseSort(sortQuery) {
  if (!sortQuery) return { createdAt: -1 };

  const sort = {};

  String(sortQuery)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [rawField, rawDir] = pair.split(':');
      const field = String(rawField || '').trim();

      if (!ALLOWED_SORT_FIELDS.has(field)) return;

      const dirStr = String(rawDir || '').trim().toLowerCase();
      let dir = 1;

      if (dirStr === '-1' || dirStr === 'desc' || dirStr === 'descending') dir = -1;
      if (dirStr === '1' || dirStr === 'asc' || dirStr === 'ascending') dir = 1;

      sort[field] = dir;
    });

  return Object.keys(sort).length ? sort : { createdAt: -1 };
}

/* ============================
 * GET /api/orders/admin
 * ============================ */
router.get('/admin', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const q = String(req.query.q || '').trim();
    const populate = String(req.query.populate || '0') === '1';
    const format = String(req.query.format || '').toLowerCase();

    const filter = {};

    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');

      const or = [
        { orderNumber: rx },
        { 'customer.name': rx },
        { 'customer.lastname': rx },
        { 'customer.emailOrPhone': rx },
        { 'customer.email': rx },
        { 'customer.phone': rx },
        { 'customer.id': rx },
        { 'billing.name': rx },
        { 'billing.lastname': rx },
        { 'billing.id': rx },
      ];

      if (/^[0-9a-fA-F]{24}$/.test(q)) {
        or.push({ _id: q });
      }

      filter.$or = or;
    }

    const { dateFrom, dateTo } = req.query;

    if (dateFrom || dateTo) {
      filter.createdAt = {};

      if (dateFrom) filter.createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) filter.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);

      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }

    const STATUS_CANON = new Map([
      ['pendiente', 'pending'],
      ['pending', 'pending'],
      ['procesando', 'processing'],
      ['processing', 'processing'],
      ['pagado', 'paid'],
      ['pagada', 'paid'],
      ['paid', 'paid'],
      ['enviado', 'shipped'],
      ['enviada', 'shipped'],
      ['shipped', 'shipped'],
      ['cancelado', 'cancelled'],
      ['cancelada', 'cancelled'],
      ['cancelled', 'cancelled'],
      ['canceled', 'cancelled'],
      ['reembolsado', 'refunded'],
      ['reembolsada', 'refunded'],
      ['refunded', 'refunded'],
    ]);

    const ALLOWED = ['pending', 'processing', 'paid', 'shipped', 'cancelled', 'refunded'];

    const rawStatus = String(req.query.status || '').trim();

    if (rawStatus) {
      const canonSelected = Array.from(
        new Set(
          rawStatus
            .split(',')
            .map((s) => STATUS_CANON.get(String(s).toLowerCase().trim()) || '')
            .filter(Boolean)
        )
      ).filter((s) => ALLOWED.includes(s));

      if (canonSelected.length > 0) {
        const selectedForQuery = new Set(canonSelected);

        if (selectedForQuery.has('cancelled')) selectedForQuery.add('canceled');

        const arr = Array.from(selectedForQuery);

        filter.status = arr.length === 1 ? arr[0] : { $in: arr };
      }
    }

    const tagsQ = String(req.query.tags || '').trim();

    if (tagsQ) {
      const tags = normalizeTags(tagsQ);

      if (tags.length) {
        const mode = String(req.query.tagsMode || 'any').toLowerCase() === 'all' ? 'all' : 'any';
        filter.tags = mode === 'all' ? { $all: tags } : { $in: tags };
      }
    }

    /* ============================
    * Filtros operativos admin
    * printed / archived
    * ============================ */
    const printedQ = String(req.query.printed || '').trim().toLowerCase();

    if (printedQ === '1' || printedQ === 'true') {
      filter.printed = true;
    }

    if (printedQ === '0' || printedQ === 'false') {
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [
            { printed: false },
            { printed: { $exists: false } },
          ],
        },
      ];
    }

    const archivedQ = String(req.query.archived || '').trim().toLowerCase();

    if (archivedQ === '1' || archivedQ === 'true') {
      filter.archived = true;
    }

    if (archivedQ === '0' || archivedQ === 'false') {
      filter.archived = { $ne: true };
    }

    /* ============================
    * Filtro admin por factura electrónica
    * invoiceFilter
    * ============================ */
    const invoiceFilterQ = String(req.query.invoiceFilter || '').trim().toLowerCase();

    if (invoiceFilterQ && invoiceFilterQ !== 'all') {
      const invoiceBaseFilter = {};

      if (invoiceFilterQ === 'validated') {
        invoiceBaseFilter.$or = [
          { cufe: { $exists: true, $nin: ['', null] } },
          { invoiceNumber: { $exists: true, $nin: ['', null] } },
          { 'provider.cufe': { $exists: true, $nin: ['', null] } },
          { 'provider.number': { $exists: true, $nin: ['', null] } },
          { 'provider.isValidated': true },
          { 'provider.raw.is_validated': true },
          { 'dianResponse.raw.data.data.is_validated': true },
          { 'dianResponse.raw.data.data.cufe': { $exists: true, $nin: ['', null] } },
        ];
      }

      if (invoiceFilterQ === 'pending') {
        invoiceBaseFilter.$or = [
          { status: 'pending' },
          { status: 'sent' },
          { status: 'processing' },
          { 'provider.status': 'pending' },
          { 'provider.status': 'sent' },
          { 'provider.status': 'processing' },
        ];
      }

      if (invoiceFilterQ === 'rejected' || invoiceFilterQ === 'error') {
        invoiceBaseFilter.$or = [
          { status: 'rejected' },
          { status: 'failed' },
          { status: 'error' },
          { 'provider.status': 'rejected' },
          { 'provider.status': 'failed' },
          { 'provider.status': 'error' },
          { errors: { $exists: true, $ne: [] } },
          { providerErrors: { $exists: true, $ne: [] } },
        ];
      }

      if (invoiceFilterQ === 'credit_note') {
        invoiceBaseFilter.$or = [
          { creditNotes: { $exists: true, $ne: [] } },
          { 'creditNotes.0': { $exists: true } },
        ];
      }

      const invoiceRows = await ElectronicInvoice.find(invoiceBaseFilter)
        .select('orderId')
        .lean();

      const invoiceOrderIds = invoiceRows
        .map((invoice) => invoice.orderId)
        .filter(Boolean);

      if (invoiceFilterQ === 'without_invoice') {
        const ordersWithInvoice = await ElectronicInvoice.find({})
          .select('orderId')
          .lean();

        const idsWithInvoice = ordersWithInvoice
          .map((invoice) => invoice.orderId)
          .filter(Boolean);

        filter._id = {
          ...(filter._id && typeof filter._id === 'object' ? filter._id : {}),
          $nin: idsWithInvoice,
        };
      } else {
        filter._id = {
          ...(filter._id && typeof filter._id === 'object' ? filter._id : {}),
          $in: invoiceOrderIds,
        };
      }
    }

    const total = await Order.countDocuments(filter);
    const financialSummaryRows = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,

          totalOrders: { $sum: 1 },

          totalSales: {
            $sum: {
              $cond: [
                { $in: ['$status', ['paid', 'shipped']] },
                { $ifNull: ['$total', 0] },
                0,
              ],
            },
          },

          pendingAmount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['pending', 'processing']] },
                { $ifNull: ['$total', 0] },
                0,
              ],
            },
          },

          paidOrders: {
            $sum: {
              $cond: [
                { $in: ['$status', ['paid', 'shipped']] },
                1,
                0,
              ],
            },
          },

          pendingOrders: {
            $sum: {
              $cond: [
                { $in: ['$status', ['pending', 'processing']] },
                1,
                0,
              ],
            },
          },

          cancelledOrders: {
            $sum: {
              $cond: [
                { $in: ['$status', ['cancelled', 'canceled']] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalOrders: 1,
          totalSales: 1,
          pendingAmount: 1,
          paidOrders: 1,
          pendingOrders: 1,
          cancelledOrders: 1,
          averageTicket: {
            $cond: [
              { $gt: ['$paidOrders', 0] },
              { $divide: ['$totalSales', '$paidOrders'] },
              0,
            ],
          },
        },
      },
    ]);

    const baseFinancialSummary = financialSummaryRows[0] || {
      totalOrders: 0,
      totalSales: 0,
      pendingAmount: 0,
      paidOrders: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      averageTicket: 0,
    };

    const summaryOrders = await Order.find(filter).select('_id').lean();

    const summaryOrderIds = summaryOrders
      .map((order) => order._id)
      .filter(Boolean);

    const summaryInvoices = summaryOrderIds.length
      ? await ElectronicInvoice.find({
          orderId: { $in: summaryOrderIds },
        })
          .select('orderId status provider.status')
          .lean()
      : [];

    const ordersWithInvoiceSet = new Set(
      summaryInvoices
        .map((invoice) => String(invoice.orderId || ''))
        .filter(Boolean)
    );

    const validatedInvoiceSet = new Set(
    summaryInvoices
      .filter((invoice) => {
        const status = String(invoice.status || '').toLowerCase();
        const providerStatus = String(invoice.provider?.status || '').toLowerCase();
        const providerRawStatus = String(invoice.provider?.raw?.status || '').toLowerCase();
        const providerRawDataStatus = String(invoice.provider?.raw?.data?.status || '').toLowerCase();

        const hasValidatedStatus = [
          status,
          providerStatus,
          providerRawStatus,
          providerRawDataStatus,
        ].some((value) =>
          [
            'validated',
            'validada',
            'validado',
          ].includes(value)
        );

        const hasDianEvidence =
          Boolean(invoice.validatedAt) ||
          Boolean(invoice.cufe) ||
          Boolean(invoice.provider?.cufe) ||
          Boolean(invoice.provider?.raw?.cufe) ||
          Boolean(invoice.provider?.raw?.data?.cufe);

        return hasValidatedStatus || hasDianEvidence;
      })
      .map((invoice) => String(invoice.orderId || ''))
      .filter(Boolean)
  );
    

    const financialSummary = {
      ...baseFinancialSummary,
      withoutInvoiceOrders: Math.max(
        0,
        Number(baseFinancialSummary.totalOrders || 0) - ordersWithInvoiceSet.size
      ),
      validatedInvoiceOrders: validatedInvoiceSet.size,
    };

    const dianValidatedInvoiceCriteria = [
      { cufe: { $exists: true, $nin: ['', null] } },
      { invoiceNumber: { $exists: true, $nin: ['', null] } },
      { validatedAt: { $exists: true, $nin: ['', null] } },

      { 'provider.cufe': { $exists: true, $nin: ['', null] } },
      { 'provider.number': { $exists: true, $nin: ['', null] } },
      { 'provider.isValidated': true },
      { 'provider.validatedAt': { $exists: true, $nin: ['', null] } },

      { 'provider.raw.cufe': { $exists: true, $nin: ['', null] } },
      { 'provider.raw.number': { $exists: true, $nin: ['', null] } },
      { 'provider.raw.is_validated': true },
      { 'provider.raw.validated_at': { $exists: true, $nin: ['', null] } },

      { 'dianResponse.raw.data.data.cufe': { $exists: true, $nin: ['', null] } },
      { 'dianResponse.raw.data.data.number': { $exists: true, $nin: ['', null] } },
      { 'dianResponse.raw.data.data.is_validated': true },
      { 'dianResponse.raw.data.data.validated_at': { $exists: true, $nin: ['', null] } },
    ];

    const summaryOrderIdsForInvoices = await Order.distinct('_id', filter);

    const ordersWithInvoiceIdsForSummary = summaryOrderIdsForInvoices.length
      ? await ElectronicInvoice.distinct('orderId', {
          orderId: { $in: summaryOrderIdsForInvoices },
        })
      : [];

    const validatedInvoiceIdsForSummary = summaryOrderIdsForInvoices.length
      ? await ElectronicInvoice.distinct('orderId', {
          orderId: { $in: summaryOrderIdsForInvoices },
          $or: dianValidatedInvoiceCriteria,
        })
      : [];

    financialSummary.withoutInvoiceOrders = Math.max(
      0,
      Number(financialSummary.totalOrders || 0) - ordersWithInvoiceIdsForSummary.length
    );

    financialSummary.ordersWithoutInvoice = financialSummary.withoutInvoiceOrders;

    financialSummary.validatedInvoiceOrders = validatedInvoiceIdsForSummary.length;
    financialSummary.validatedInvoices = validatedInvoiceIdsForSummary.length;
    financialSummary.validatedDianOrders = validatedInvoiceIdsForSummary.length;


    const sort = parseSort(req.query.sort);

    const docs = await Order.find(filter).sort(sort).skip(skip).limit(limit).lean();

    const getItems = (o) =>
      Array.isArray(o?.items) ? o.items : Array.isArray(o?.cart) ? o.cart : [];

    const withDerived = [];

    if (populate) {
      const ids = new Set();

      for (const o of docs) {
        for (const it of getItems(o)) {
          const id = resolvePid(it);
          if (id) ids.add(String(id));
        }
      }

      let map = new Map();

      if (ids.size) {
        const prods = await Product.find({ _id: { $in: Array.from(ids) } })
          .select('title price image slug sku')
          .lean();

        map = new Map(prods.map((p) => [String(p._id), p]));
      }

      for (const o of docs) {
        const items = getItems(o).map((it) => {
          const pid = resolvePid(it);
          return { ...it, product: pid ? map.get(String(pid)) || null : null };
        });

        const summary = o.summary || calcSummaryFromItems(items);

        withDerived.push({
          ...o,
          items,
          itemsCount: items.length,
          summary,
          totalItems: summary.totalItems,
          subtotal: summary.subtotal,
        });
      }
    } else {
      for (const o of docs) {
        const items = getItems(o);
        const summary = o.summary || calcSummaryFromItems(items);

        withDerived.push({
          ...o,
          itemsCount: items.length,
          summary,
          totalItems: summary.totalItems,
          subtotal: summary.subtotal,
        });
      }
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));

    if (format === 'csv') {
      const rows = [
        [
          'orderNumber',
          '_id',
          'customerName',
          'customerEmailOrPhone',
          'itemsCount',
          'totalItems',
          'subtotal',
          'total',
          'status',
          'createdAt',
          'updatedAt',
        ].join(','),
      ];

      for (const o of withDerived) {
        const cust = o.customer || {};

        rows.push(
          [
            JSON.stringify(o.orderNumber || ''),
            JSON.stringify(o._id),
            JSON.stringify([cust.name, cust.lastname].filter(Boolean).join(' ').trim()),
            JSON.stringify(cust.emailOrPhone || cust.email || ''),
            String(o.itemsCount || 0),
            String(o.totalItems || 0),
            String(o.subtotal || 0),
            String(o.total || 0),
            JSON.stringify(o.status || ''),
            JSON.stringify(o.createdAt || ''),
            JSON.stringify(o.updatedAt || ''),
          ].join(',')
        );
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');

      return res.status(200).send(rows.join('\n'));
    }

    res.json({
      page,
      limit,
      total,
      totalPages,
      financialSummary,
      data: withDerived,
    });
  } catch (error) {
    console.error('Error en /api/orders/admin:', error);
    res.status(500).json({ message: 'Error al listar órdenes para admin' });
  }
});

/* ============================
 * GET /api/orders/:id/thanks
 * ============================ */
router.get('/:id/thanks', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const customer = order.customer || {};
    const payment = order.payment || {};
    const items = Array.isArray(order.items)
      ? order.items
      : Array.isArray(order.cart)
        ? order.cart
        : [];

    const summary = order.summary || calcSummaryFromItems(items);

    return res.json({
      ok: true,
      orderId: String(order._id || ''),
      orderNumber: String(order.orderNumber || ''),
      status: String(order.status || ''),
      subtotal: Number(order.subtotal ?? summary.subtotal ?? 0),
      shipping: Number(order.shipping || 0),
      total: Number(order.total || 0),
      itemCount: Number(summary.totalItems || 0),
      customerName: [customer.name, customer.lastname].filter(Boolean).join(' ').trim(),
      customerEmail: String(customer.emailOrPhone || customer.email || ''),
      customerPhone: String(customer.phone || ''),
      customerCity: String(customer.city || ''),
      customerAddress: String(customer.address || ''),
      customerCountry: String(customer.country || ''),
      customerDepartment: String(customer.department || ''),
      paymentProvider: String(payment.provider || ''),
      paymentProviderLabel: String(payment.providerLabel || ''),
      paymentStatus: String(payment.status || ''),
      currency: String(payment.currency || 'COP'),
      createdAt: order.createdAt || null,
      updatedAt: order.updatedAt || null,
    });
  } catch (error) {
    console.error('GET /orders/:id/thanks', error);
    return res.status(400).json({ error: 'ID inválido' });
  }
});

/* ============================
 * GET /api/orders/:id
 * ============================ */
router.get('/:id', async (req, res) => {
  try {
    const o = await Order.findById(req.params.id).lean();

    const invoice = await ElectronicInvoice.findOne({
      orderId: o?._id,
    }).lean();

    if (!o) return res.status(404).json({ error: 'Orden no encontrada' });

    res.json({
      ...o,
      electronicInvoice: invoice || null,
      factusLinks: invoice ? extractFactusLinks(invoice) : null,
    });
  } catch {
    res.status(400).json({ error: 'ID inválido' });
  }
});

/* ============================
 * PATCH /api/orders/:id/status
 * ============================ */
router.options('/:id/status', (_req, res) => res.sendStatus(204));

router.patch('/:id/status', requireAdmin, requirePermission('orders:update'), async (req, res) => {
  try {
    const STATUS_MAP = new Map([
      ['pendiente', 'pending'],
      ['pending', 'pending'],
      ['procesando', 'processing'],
      ['processing', 'processing'],
      ['pagado', 'paid'],
      ['paid', 'paid'],
      ['enviado', 'shipped'],
      ['shipped', 'shipped'],
      ['cancelado', 'cancelled'],
      ['cancelada', 'cancelled'],
      ['cancelled', 'cancelled'],
      ['canceled', 'cancelled'],
      ['reembolsado', 'refunded'],
      ['reembolsada', 'refunded'],
      ['refunded', 'refunded'],
    ]);

    const raw = String(req.body?.status || '').toLowerCase().trim();
    const status = STATUS_MAP.get(raw);

    if (!status) {
      return res.status(400).json({
        error: 'Estado inválido',
        allowed: Array.from(new Set(STATUS_MAP.values())),
        received: raw,
      });
    }

    const before = await Order.findById(req.params.id).select('status').lean();

    if (!before) return res.status(404).json({ error: 'Orden no encontrada' });

    const upd = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    ).lean();

    await OrderEvent.create({
      orderId: upd._id,
      type: 'status_changed',
      message: `Estado: ${before.status || '—'} -> ${status}`,
      meta: {
        from: before.status || null,
        to: status,
        ip: req.ip,
        by: req.headers['x-admin-user'] || null,
      },
    });

    res.json({ ok: true, order: upd });
  } catch (e) {
    console.error('PATCH /orders/:id/status', e);
    res.status(500).json({ error: 'No se pudo actualizar el estado' });
  }
});

/* ============================
 * PATCH /api/orders/:id/printed
 * ============================ */
router.options('/:id/printed', (_req, res) => res.sendStatus(204));

router.patch('/:id/printed', requireAdmin, async (req, res) => {
  try {
    if (typeof req.body?.printed === 'undefined') {
      return res.status(400).json({
        error: 'PRINTED_REQUIRED',
        message: 'Debes enviar { printed: true|false }',
      });
    }

    const id = req.params.id;
    const o = await Order.findById(id);

    if (!o) return res.status(404).json({ error: 'Orden no encontrada' });

    const before = !!o.printed;
    const after = parseBoolean(req.body.printed);

    o.printed = after;
    await o.save();

    await OrderEvent.create({
      orderId: o._id,
      type: 'note_updated',
      message: after ? 'Orden marcada como impresa' : 'Se quitó la marca de impresa',
      meta: {
        flag: 'printed',
        before,
        after,
        by: req.headers['x-admin-user'] || 'admin',
      },
    });

    res.json({ ok: true, printed: o.printed });
  } catch (e) {
    console.error('PATCH /orders/:id/printed', e);
    res.status(500).json({ error: 'No se pudo actualizar printed' });
  }
});

/* ============================
 * PATCH /api/orders/:id/archived
 * ============================ */
router.options('/:id/archived', (_req, res) => res.sendStatus(204));

router.patch('/:id/archived', requireAdmin, async (req, res) => {
  try {
    if (typeof req.body?.archived === 'undefined') {
      return res.status(400).json({
        error: 'ARCHIVED_REQUIRED',
        message: 'Debes enviar { archived: true|false }',
      });
    }

    const id = req.params.id;
    const o = await Order.findById(id);

    if (!o) return res.status(404).json({ error: 'Orden no encontrada' });

    const before = !!o.archived;
    const after = parseBoolean(req.body.archived);

    o.archived = after;
    await o.save();

    await OrderEvent.create({
      orderId: o._id,
      type: 'note_updated',
      message: after ? 'Orden archivada' : 'Orden desarchivada',
      meta: {
        flag: 'archived',
        before,
        after,
        by: req.headers['x-admin-user'] || 'admin',
      },
    });

    res.json({ ok: true, archived: o.archived });
  } catch (e) {
    console.error('PATCH /orders/:id/archived', e);
    res.status(500).json({ error: 'No se pudo actualizar archived' });
  }
});

/* ============================
 * PATCH /api/orders/:id/customer-data
 * ============================ */
router.patch('/:id/customer-data', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    const customer =
      req.body?.customer && typeof req.body.customer === 'object'
        ? req.body.customer
        : null;

    const billing =
      req.body?.billing && typeof req.body.billing === 'object'
        ? req.body.billing
        : null;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        error: 'ORDER_NOT_FOUND',
      });
    }

    const beforeCustomer = order.customer || {};
    const beforeBilling = order.billing || {};

    if (customer) {
      order.customer = {
        ...beforeCustomer,
        ...customer,
      };
    }

    if (billing) {
      order.billing = {
        ...beforeBilling,
        ...billing,
      };
    }

    await order.save();

    await OrderEvent.create({
      orderId: order._id,
      type: 'customer_data_updated',
      message: 'Datos de facturación actualizados desde panel administrativo',
      meta: {
        beforeCustomer,
        beforeBilling,
        afterCustomer: order.customer,
        afterBilling: order.billing,
        by: req.headers['x-admin-user'] || 'admin',
      },
    });

    return res.json({
      ok: true,
      customer: order.customer,
      billing: order.billing,
    });
  } catch (e) {
    console.error('PATCH /orders/:id/customer-data', e);

    return res.status(500).json({
      error: 'CUSTOMER_DATA_UPDATE_ERROR',
    });
  }
});

/* =========================================================
 * PUT /api/orders/:id/tags
 * ======================================================= */
router.put('/:id/tags', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const tags = normalizeTags(req.body?.tags || []);
    const o = await Order.findById(id);

    if (!o) return res.status(404).json({ error: 'Orden no encontrada' });

    const before = Array.isArray(o.tags) ? o.tags.slice() : [];

    o.tags = tags;
    await o.save();

    await OrderEvent.create({
      orderId: o._id,
      type: 'tags_updated',
      message: `Tags actualizados: ${tags.join(', ') || '—'}`,
      meta: {
        before,
        after: o.tags,
        by: req.headers['x-admin-user'] || 'admin',
      },
    });

    res.json({ ok: true, tags: o.tags });
  } catch (e) {
    console.error('PUT /orders/:id/tags', e);
    res.status(500).json({ error: 'No se pudieron guardar los tags' });
  }
});

/* ============================
 * POST /api/orders
 * ============================ */
router.post('/', rateLimit, async (req, res) => {
  const endpoint = 'POST /orders';

  const { ok, errors, cleaned } = validateOrderPayload(req.body || {});

  if (!ok) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: errors,
    });
  }

  const headerKey = String(req.headers['idempotency-key'] || '').trim();
  const derivedKey = deriveIdempotencyKey(cleaned);
  const idempoKey = headerKey || derivedKey;

  let activeIdempotencyRecord = null;

  try {
    const prevKey = await IdempotencyKey.findOne({ key: idempoKey, endpoint });

    if (prevKey) {
      const sameRequestHash = String(prevKey.requestHash || '') === String(derivedKey || '');

      if (prevKey.status === 'completed' && prevKey.orderId) {
        const existingOrder = await Order.findById(prevKey.orderId);

        if (existingOrder && !canReuseMutableOrderData(existingOrder)) {
          return res.status(200).json({
            _id: existingOrder._id,
            orderNumber: existingOrder.orderNumber,
            idempotent: true,
            reused: true,
          });
        }

        const syncedOrder = await syncExistingOrderForRetry(prevKey.orderId, cleaned);

        if (syncedOrder) {
          return res.status(200).json({
            _id: syncedOrder._id,
            orderNumber: syncedOrder.orderNumber,
            idempotent: true,
            reused: true,
          });
        }
      }

      if (prevKey.status === 'processing') {
        if (!sameRequestHash) {
          return res.status(409).json({
            error: 'IDEMPOTENCY_CONFLICT',
            message: 'La clave de idempotencia ya está siendo usada con otro payload.',
          });
        }

        if (isIdempotencyRecordStale(prevKey)) {
          prevKey.status = 'failed';
          await prevKey.save();
        } else {
          return res.status(409).json({
            error: 'IDEMPOTENT_IN_PROGRESS',
            message: 'Existe una solicitud idéntica en progreso. Reintenta en unos segundos.',
          });
        }
      }

      if (prevKey.status === 'failed') {
        if (!sameRequestHash) {
          return res.status(409).json({
            error: 'IDEMPOTENCY_CONFLICT',
            message: 'La clave de idempotencia fallida pertenece a otro payload.',
          });
        }

        await IdempotencyKey.deleteOne({ _id: prevKey._id });
      }
    }
  } catch (err) {
    console.error('Idempotency lookup error:', err);
  }

  const check = await dryRunCheck(cleaned.cart);

  if (!check.ok) {
    return res.status(409).json({
      error: 'No hay stock suficiente para uno o más artículos.',
      code: 'NO_STOCK',
      details: check.details,
    });
  }

  const session = await mongoose.startSession();

  try {
    let created;

    await session.withTransaction(async () => {
      if (idempoKey) {
        try {
          const docs = await IdempotencyKey.create(
            [
              {
                key: idempoKey,
                endpoint,
                requestHash: derivedKey,
                status: 'processing',
                createdAt: new Date(),
              },
            ],
            { session }
          );

          activeIdempotencyRecord = Array.isArray(docs) ? docs[0] : null;
        } catch (e) {
          if (String(e?.code) === '11000') {
            throw Object.assign(new Error('IDEMPOTENT_IN_PROGRESS'), {
              code: 'IDEMPOTENT_IN_PROGRESS',
            });
          }

          throw e;
        }
      }

      if (created) return;

      await decrementStock(cleaned.cart, { session });

      const orderNumber = await getNextOrderNumber({ session });
      const settings = await SiteSettings.findOne().session(session).lean();
      const billingMode = getBillingMode(settings);

      console.log('🧾 MODO FACTURACIÓN:', {
        dianEnabled: billingMode.dianEnabled,
        dianMode: billingMode.dianMode,
        isDianActive: billingMode.isDianActive,
        isInternalMode: billingMode.isInternalMode,
      });

      const dianConfig = settings?.billing?.dian || {};
      const dian = settings?.billing?.dianResolution || {};

      const effectiveDianEnvironment =
        billingMode.dianMode === 'production'
          ? '1'
          : dianConfig.environment || dian.environment || '2';

      const settingsForInvoice = {
        ...(settings || {}),
        billing: {
          ...(settings?.billing || {}),
          dianResolution: {
            ...(dian || {}),
            environment: effectiveDianEnvironment,
          },
        },
      };

      const prefix = dian.prefix || 'ORD';
      const currentNumber = Number(dian.currentNumber || 1);
      const invoiceNumber = `${prefix}-${String(currentNumber).padStart(6, '0')}`;

      const now = new Date();
      const issueDate = now.toISOString().slice(0, 10);
      const issueTime = now.toISOString().slice(11, 19);

      const customerDocument =
        cleaned.customer?.document ||
        cleaned.customer?.cedula ||
        cleaned.customer?.identification ||
        '222222222222';

      const ivaConfig = settings?.billing?.taxes?.iva || {};
      const ivaEnabled = ivaConfig.enabled !== false;
      const ivaPercent = Number(ivaConfig.percent || 0);
      const ivaCode = ivaConfig.code || '01';
      const ivaName = ivaConfig.name || 'IVA';

      const grossAmount = Number(cleaned.subtotal || 0);
      const shippingAmount = Number(cleaned.shipping || 0);
      const taxAmount = ivaEnabled
        ? Number(((grossAmount * ivaPercent) / 100).toFixed(2))
        : 0;

      const totalAmount = Number((grossAmount + taxAmount + shippingAmount).toFixed(2));

      const taxesSnapshot = {
        iva: {
          enabled: ivaEnabled,
          percent: ivaPercent,
          code: ivaCode,
          name: ivaName,
          amount: taxAmount,
        },
      };

      
      const base = {
        ...cleaned,
        orderNumber,
        subtotal: grossAmount,
        shipping: shippingAmount,
        total: totalAmount,
        taxes: taxesSnapshot,
      };

      base.status = base.status || 'pending';

      created = await Order.create([{ ...base }], { session });
      created = created[0];

     
     

      await OrderEvent.create(
        [
          {
            orderId: created._id,
            type: 'status_changed',
            message: `Orden creada con estado ${created.status}`,
            meta: { to: created.status, ip: req.ip },
          },
        ],
        { session }
      );

      if (cleaned.customer?.wantsNewsletter) {
        const { emailOrPhone, phone } = cleaned.customer;
        const sessionId = cleaned.sessionId;

        try {
          await Subscriber.create([{ email: emailOrPhone || undefined, phone, sessionId }], {
            session,
          });
        } catch (err) {
          console.error('Error al guardar suscriptor:', err);
        }
      }

      if (idempoKey) {
        await IdempotencyKey.updateOne(
          { key: idempoKey, endpoint },
          {
            $set: {
              status: 'completed',
              orderId: created._id,
              response: {
                _id: created._id,
                orderNumber: created.orderNumber,
              },
              completedAt: new Date(),
            },
          },
          { session }
        );
      }
    });

    if (created && created._id) {
      const statusCode = created.idempotent || created.reused ? 200 : 201;

      return res.status(statusCode).json({
        _id: created._id,
        orderNumber: created.orderNumber,
        ...(created.idempotent || created.reused
          ? { idempotent: true, reused: true }
          : {}),
      });
    }

    const existing = await IdempotencyKey.findOne({ key: idempoKey, endpoint }).lean();

    if (existing?.orderId) {
      const prev = await syncExistingOrderForRetry(existing.orderId, cleaned);

      if (prev) {
        return res.status(200).json({
          _id: prev._id,
          orderNumber: prev.orderNumber,
          idempotent: true,
          reused: true,
        });
      }
    }

    return res.status(500).json({
      error: 'No se pudo finalizar la creación de la orden',
    });
  } catch (error) {
    console.error('Error al guardar orden (tx):', error);

    if (idempoKey) {
      try {
        await IdempotencyKey.updateOne(
          { key: idempoKey, endpoint, status: 'processing' },
          {
            $set: {
              status: 'failed',
            },
          }
        );
      } catch (cleanupError) {
        console.error('Error marcando idempotency key como failed:', cleanupError);
      }
    }

    const code = String(error?.code || '');

    if (isDuplicateOrderNumberError(error)) {
      return res.status(409).json({
        error: 'DUPLICATE_ORDER',
        code: 'ORDER_NUMBER_DUP',
        message: 'Esta orden ya fue creada anteriormente.',
      });
    }

    if (code === 'ORDER_NUMBER_DUP') {
      return res.status(409).json({
        error: 'Conflicto con el número de orden. Intenta nuevamente.',
        code: 'ORDER_NUMBER_DUP',
      });
    }

    if (code === 'IDEMPOTENT_IN_PROGRESS') {
      return res.status(409).json({
        error: 'IDEMPOTENT_IN_PROGRESS',
        message: 'Existe una solicitud idéntica en progreso. Reintenta en unos segundos.',
      });
    }

    if (isDuplicateKeyError(error)) {
      return res.status(409).json({
        error: 'IDEMPOTENCY_CONFLICT',
        message: 'La clave de idempotencia ya fue usada para este endpoint.',
      });
    }

    return res.status(500).json({ error: 'Error al guardar la orden' });
  } finally {
    session.endSession();
  }
});

/* =========================================================
 * Notas internas
 * ======================================================= */
router.get('/:id/notes', requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const notes = await OrderNote.find({ orderId }).sort({ pinned: -1, createdAt: -1 }).lean();

    res.json({ data: notes });
  } catch (e) {
    console.error('GET /orders/:id/notes', e);
    res.status(500).json({ error: 'No se pudieron obtener las notas' });
  }
});

router.post('/:id/notes', requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const text = String(req.body?.text || '').trim();
    const pinned = !!req.body?.pinned;
    const author =
      req.body?.author && typeof req.body.author === 'object' ? req.body.author : undefined;

    if (!text) {
      return res.status(400).json({ error: 'El texto de la nota es obligatorio' });
    }

    const note = await OrderNote.create({ orderId, text, pinned, author });

    await OrderEvent.create({
      orderId,
      type: 'note_created',
      message: `Nota creada${pinned ? ' (fijada)' : ''}`,
      meta: { noteId: note._id, author },
    });

    res.status(201).json({ ok: true, note });
  } catch (e) {
    console.error('POST /orders/:id/notes', e);
    res.status(500).json({ error: 'No se pudo crear la nota' });
  }
});

router.patch('/:id/notes/:noteId', requireAdmin, async (req, res) => {
  try {
    const { id: orderId, noteId } = req.params;

    const patch = {};

    if (typeof req.body?.text === 'string') patch.text = req.body.text;
    if (typeof req.body?.pinned === 'boolean') patch.pinned = req.body.pinned;

    const note = await OrderNote.findOneAndUpdate(
      { _id: noteId, orderId },
      { $set: patch },
      { new: true }
    ).lean();

    if (!note) return res.status(404).json({ error: 'Nota no encontrada' });

    await OrderEvent.create({
      orderId,
      type: 'note_updated',
      message: 'Nota actualizada',
      meta: { noteId },
    });

    res.json({ ok: true, note });
  } catch (e) {
    console.error('PATCH /orders/:id/notes/:noteId', e);
    res.status(500).json({ error: 'No se pudo actualizar la nota' });
  }
});

router.delete('/:id/notes/:noteId', requireAdmin, async (req, res) => {
  try {
    const { id: orderId, noteId } = req.params;

    const del = await OrderNote.deleteOne({ _id: noteId, orderId });

    if (!del.deletedCount) return res.status(404).json({ error: 'Nota no encontrada' });

    await OrderEvent.create({
      orderId,
      type: 'note_deleted',
      message: 'Nota eliminada',
      meta: { noteId },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /orders/:id/notes/:noteId', e);
    res.status(500).json({ error: 'No se pudo eliminar la nota' });
  }
});

/* =========================================================
 * Timeline
 * ======================================================= */
router.get('/:id/timeline', requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const items = await OrderEvent.find({ orderId }).sort({ _id: -1 }).lean();

    res.json({ data: items });
  } catch (e) {
    console.error('GET /orders/:id/timeline', e);
    res.status(500).json({ error: 'No se pudo obtener el timeline' });
  }
});

/* =========================================================
 * Email
 * ======================================================= */
router.post('/:id/email', requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const type = String(req.body?.action || req.body?.type || 'confirmation')
      .toLowerCase()
      .trim();

    if (!['confirmation', 'invoice'].includes(type)) {
      return res.status(400).json({
        error: 'Tipo de email inválido',
        allowed: ['confirmation', 'invoice'],
      });
    }

    const o = await Order.findById(orderId).lean();

    if (!o) return res.status(404).json({ error: 'Orden no encontrada' });

    const to = o.customer?.emailOrPhone || o.customer?.email;

    if (!to || !String(to).includes('@')) {
      return res.status(422).json({
        error: 'La orden no tiene un email válido del cliente',
      });
    }

    const subject =
      type === 'invoice'
        ? `Factura de tu compra #${o.orderNumber}`
        : `Confirmación de pedido #${o.orderNumber}`;

    const lines = (arr) => arr.map((l) => `<div>${l}</div>`).join('');

    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;line-height:1.4">
        <h2 style="margin:0 0 8px">Tienda - ${type === 'invoice' ? 'Factura' : 'Confirmación'} de orden</h2>
        <div>Orden <strong>#${o.orderNumber}</strong> (${o.status})</div>
        <hr/>
        <div>${lines((o.cart || o.items || []).map((it) => `${it.title || 'Producto'} x ${it.quantity || it.qty || 1}`))}</div>
        <hr/>
        <div>Subtotal: <strong>${o.subtotal ?? 0}</strong></div>
        <div>Envío: <strong>${o.shipping ?? 0}</strong></div>
        <div>Total: <strong>${o.total ?? 0}</strong></div>
        <hr/>
        <small>Gracias por tu compra.</small>
      </div>
    `;

    const text =
      `Tienda - ${type === 'invoice' ? 'Factura' : 'Confirmación'}\n` +
      `Orden #${o.orderNumber} (${o.status})\n` +
      (o.cart || o.items || [])
        .map((it) => `- ${it.title || 'Producto'} x ${it.quantity || it.qty || 1}`)
        .join('\n') +
      `\nSubtotal: ${o.subtotal ?? 0}\nEnvío: ${o.shipping ?? 0}\nTotal: ${o.total ?? 0}`;

    const sent = await sendMail({ to, subject, html, text });

    await OrderEvent.create({
      orderId,
      type: 'email_sent',
      message: `Email ${type} enviado a ${to}`,
      meta: {
        to,
        type,
        previewUrl: sent.previewUrl,
        messageId: sent.messageId,
        isTest: sent.isTest,
      },
    });

    return res.json({
      ok: true,
      type,
      to,
      previewUrl: sent.previewUrl,
      isTest: sent.isTest,
    });
  } catch (e) {
    console.error('POST /orders/:id/email', e);
    return res.status(500).json({ error: 'No se pudo enviar el email' });
  }
});
/* =========================================================
 * XML FACTURA ELECTRÓNICA
 * GET /api/orders/:id/invoice-xml
 * ======================================================= */
router.get('/:id/invoice-xml', requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;

    const invoice = await ElectronicInvoice.findOne({ orderId }).lean();

    if (!invoice) {
      return res.status(404).json({
        error: 'INVOICE_NOT_FOUND',
        message: 'No se encontró factura electrónica para esta orden.',
      });
    }

    const xmlContent = String(invoice.xmlContent || '').trim();

    if (!xmlContent) {
      return res.status(404).json({
        error: 'XML_NOT_FOUND',
        message: 'La factura electrónica no tiene XML guardado.',
      });
    }

    const invoiceNumber =
      invoice.invoiceNumber ||
      invoice?.provider?.number ||
      invoice?.provider?.raw?.number ||
      orderId;

    const safeFileName = String(invoiceNumber)
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '');

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="factura-${safeFileName || orderId}.xml"`
    );

    return res.status(200).send(xmlContent);
  } catch (error) {
    console.error('GET /orders/:id/invoice-xml', error);

    return res.status(500).json({
      error: 'XML_DOWNLOAD_ERROR',
      message: 'No se pudo descargar el XML de la factura.',
    });
  }
});
/* =========================================================
 * PDF
 * ======================================================= */
router.get('/:id/pdf', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    const order = await Order.findById(id)
      .populate({ path: 'items.product', select: 'title sku price image slug' })
      .lean();

    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const invoice = await ElectronicInvoice.findOne({
      orderId: order._id,
    }).lean();

    const settings = await SiteSettings.findOne().lean();

    await generateOrderPdf({
      order,
      invoice,
      settings,
      res,
    });
  } catch (e) {
    console.error('GET /orders/:id/pdf', e);
    res.status(500).json({ error: 'No se pudo generar el PDF' });
  }
});

/* =========================================================
 * Reembolso
 * ======================================================= */
router.options('/:id/refund', (_req, res) => res.sendStatus(204));

router.post('/:id/refund', requireAdmin, async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const id = req.params.id;
    const amount = Number(req.body?.amount || 0);
    const reason = String(req.body?.reason || '').trim();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'AMOUNT_INVALID',
        message: 'Monto inválido.',
      });
    }

    const order = await Order.findById(id).lean();

    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    await session.withTransaction(async () => {
      if (items.length) {
        await incrementStock(items, { session });
      }

      await OrderEvent.create(
        [
          {
            orderId: order._id,
            type: 'refund_created',
            message: `Reembolso por ${moneyCOP(amount)}${reason ? ` · ${reason}` : ''}`,
            meta: {
              amount,
              currency: 'COP',
              reason,
              items,
              by: req.headers['x-admin-user'] || 'admin',
            },
          },
        ],
        { session }
      );
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /orders/:id/refund', e);
    return res.status(500).json({ error: 'No se pudo procesar el reembolso' });
  } finally {
    session.endSession();
  }
});

/* =========================================================
 * POST /api/orders/admin/bulk
 * ======================================================= */
router.post('/admin/bulk', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];

    if (ids.length === 0) return res.status(400).json({ error: 'IDS_REQUIRED' });

    const objIds = ids.map(asObjectId).filter(Boolean);

    if (objIds.length === 0) return res.status(400).json({ error: 'INVALID_IDS' });

    const action = req.body?.action || {};
    const type = String(action.type || '').toLowerCase();

    let modified = 0;
    const events = [];

    const STATUS_MAP = new Map([
      ['pendiente', 'pending'],
      ['pending', 'pending'],
      ['procesando', 'processing'],
      ['processing', 'processing'],
      ['pagado', 'paid'],
      ['paid', 'paid'],
      ['enviado', 'shipped'],
      ['shipped', 'shipped'],
      ['cancelado', 'cancelled'],
      ['cancelada', 'cancelled'],
      ['cancelled', 'cancelled'],
      ['canceled', 'cancelled'],
      ['reembolsado', 'refunded'],
      ['reembolsada', 'refunded'],
      ['refunded', 'refunded'],
    ]);

    if (type === 'status') {
      const raw = String(action.value || '').toLowerCase().trim();
      const status = STATUS_MAP.get(raw);

      if (!status) return res.status(400).json({ error: 'INVALID_STATUS' });

      const orders = await Order.find({ _id: { $in: objIds } });

      for (const o of orders) {
        const prev = o.status;

        if (prev === status) continue;

        o.status = status;
        await o.save();

        modified++;

        events.push({
          orderId: o._id,
          type: 'status_changed',
          message: `Estado: ${prev || '—'} -> ${status}`,
          meta: {
            from: prev || null,
            to: status,
            by: 'admin_bulk',
          },
        });
      }
    } else if (type === 'tags_add') {
      const tags = normalizeTags(action.value || action.values || []);

      if (tags.length === 0) return res.status(400).json({ error: 'TAGS_REQUIRED' });

      const result = await Order.updateMany(
        { _id: { $in: objIds } },
        { $addToSet: { tags: { $each: tags } } }
      );

      modified = result.modifiedCount || 0;

      for (const oid of objIds) {
        events.push({
          orderId: oid,
          type: 'tags_updated',
          message: `Tags añadidos: ${tags.join(', ')}`,
          meta: { by: 'admin_bulk' },
        });
      }
    } else if (type === 'tags_remove') {
      const tags = normalizeTags(action.value || action.values || []);

      if (tags.length === 0) return res.status(400).json({ error: 'TAGS_REQUIRED' });

      const result = await Order.updateMany(
        { _id: { $in: objIds } },
        { $pull: { tags: { $in: tags } } }
      );

      modified = result.modifiedCount || 0;

      for (const oid of objIds) {
        events.push({
          orderId: oid,
          type: 'tags_updated',
          message: `Tags retirados: ${tags.join(', ')}`,
          meta: { by: 'admin_bulk' },
        });
      }
    } else {
      return res.status(400).json({ error: 'INVALID_ACTION' });
    }

    if (events.length) await OrderEvent.insertMany(events);

    res.json({ ok: true, modified });
  } catch (e) {
    console.error('POST /orders/admin/bulk', e);
    res.status(500).json({ error: 'No se pudieron aplicar las acciones masivas' });
  }
});

/* =========================================================
 * POST /api/orders/admin/export
 * ======================================================= */
router.post('/admin/export', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];

    if (ids.length === 0) return res.status(400).json({ error: 'IDS_REQUIRED' });

    const objIds = ids.map(asObjectId).filter(Boolean);

    if (objIds.length === 0) return res.status(400).json({ error: 'INVALID_IDS' });

    const docs = await Order.find({ _id: { $in: objIds } })
      .sort({ createdAt: -1 })
      .lean();

    const rows = [
      [
        'orderNumber',
        '_id',
        'customerName',
        'customerEmailOrPhone',
        'itemsCount',
        'totalItems',
        'subtotal',
        'total',
        'status',
        'tags',
        'createdAt',
        'updatedAt',
      ].join(','),
    ];

    for (const o of docs) {
      const items = Array.isArray(o.items) ? o.items : Array.isArray(o.cart) ? o.cart : [];
      const summary = o.summary || calcSummaryFromItems(items);
      const cust = o.customer || {};

      rows.push(
        [
          JSON.stringify(o.orderNumber || ''),
          JSON.stringify(o._id),
          JSON.stringify([cust.name, cust.lastname].filter(Boolean).join(' ').trim()),
          JSON.stringify(cust.emailOrPhone || cust.email || ''),
          String(items.length || 0),
          String(summary.totalItems || 0),
          String(summary.subtotal || 0),
          String(o.total || summary.subtotal + Number(o.shipping || 0) || 0),
          JSON.stringify(o.status || ''),
          JSON.stringify(Array.isArray(o.tags) ? o.tags.join('|') : ''),
          JSON.stringify(o.createdAt || ''),
          JSON.stringify(o.updatedAt || ''),
        ].join(',')
      );
    }

    const csv = rows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders-selected.csv"');
    res.status(200).send(csv);
  } catch (e) {
    console.error('POST /orders/admin/export', e);
    res.status(500).json({ error: 'No se pudo exportar el CSV de seleccionadas' });
  }
});

module.exports = router;