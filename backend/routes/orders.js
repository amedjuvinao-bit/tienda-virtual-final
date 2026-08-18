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
const Branch = require('../models/Branch');
const Counter = require('../models/Counter');

// nuevos
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const validateOrderPayload = require('../validators/orderPayload');
const IdempotencyKey = require('../models/IdempotencyKey');
const {
  createInventoryReservation,
  expandReservableItems,
  expireInventoryReservations,
} = require('../services/inventoryReservationService');
const {
  getAllowedOrderStatuses,
  transitionOrderStatus,
  processBulkOrderStatusTransitions,
} = require('../services/orderStatusTransitionService');
const couponService = require('../services/couponService');
const { buildOrderQuote } = require('../services/orderPricingService');
const {
  downloadOfficialInvoiceDocument,
} = require('../services/electronicInvoiceDocumentService');
const {
  processOrderRefund,
} = require('../services/orderRefundService');
const {
  confirmRefundPaymentReversal,
  listOrderRefunds,
} = require('../services/orderRefundReconciliationService');
const {
  automateOrderRefund,
} = require('../services/orderRefundAutomationService');
const {
  applyReservationToOrderDocument,
} = require('../services/orderInventoryAllocationService');
const {
  markCartConverted,
} = require('../services/cartAdminOperationsService');
const {
  requireAuthorizedOrderCart,
} = require('../services/authorizedCartOrderService');
const {
  SAFE_PAYMENT_ACCESS_ERROR,
  buildPublicThanksResponse,
  getPaymentAccessSecret,
  issueGuestOrderAccess,
  resolveAuthorizedPublicPaymentOrder,
} = require('../services/publicPaymentAccessService');
const {
  SAFE_CART_ACCESS_ERROR,
} = require('../services/cartAccessService');
const {
  applyOrderBranchAccessFilter,
  buildScopedOrderFilter,
} = require('../services/orderAdminScopeService');
const {
  listAdminOrders,
} = require('../controllers/orderAdminQueryController');
const {
  getOrderOperationalHealth,
} = require('../controllers/orderOperationalMonitoringController');
const {
  cancelShipmentLabel,
  generateShipmentLabel,
  getOrderLogistics,
  initializeLogistics,
  quoteShipment,
  shippingProviders,
  syncShipmentTracking,
  updateShipment,
} = require('../controllers/orderLogisticsController');
const {
  applyCustomerResolutionToOrderData,
  applyCustomerStatsForOrder,
  resolveCustomerForOrder,
  syncCustomerMasterFromOrder,
} = require('../services/customerOrderLinkService');

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

function withOrderPaymentAccess(payload, { order, sessionId, secret } = {}) {
  return {
    ...(payload || {}),
    paymentAccess: issueGuestOrderAccess({
      orderId: order?._id,
      sessionId,
      secret,
    }),
  };
}

function buildOrderCreationResult(order, extra = {}) {
  return {
    _id: order?._id,
    orderNumber: order?.orderNumber,
    subtotal: Number(order?.subtotal || 0),
    discount: order?.discount || null,
    coupon: order?.coupon || null,
    pricing: order?.pricing || null,
    taxes: order?.taxes || null,
    shipping: Number(order?.shipping || 0),
    total: Number(order?.total || 0),
    ...extra,
  };
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
        text: { type: String, required: true, maxlength: 2000 },
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

const ORDER_CUSTOMER_EDITABLE_FIELDS = new Set([
  'name',
  'lastname',
  'id',
  'documentType',
  'emailOrPhone',
  'email',
  'phone',
  'address',
  'city',
  'municipalityCode',
  'municipalityId',
  'municipality_id',
  'postalCode',
  'country',
  'countryCode',
  'department',
  'departmentCode',
  'deliveryType',
  'wantsNewsletter',
]);

const ORDER_BILLING_EDITABLE_FIELDS = new Set([
  'useSameAddress',
  'isFinalConsumer',
  'personType',
  'firstName',
  'lastName',
  'name',
  'lastname',
  'id',
  'documentNumber',
  'documentType',
  'dv',
  'businessName',
  'address',
  'city',
  'cityCode',
  'municipalityCode',
  'department',
  'departmentCode',
  'postalCode',
  'phone',
  'email',
  'extra',
  'country',
  'countryCode',
  'tributeCode',
]);

const ORDER_PARTY_BOOLEAN_FIELDS = new Set([
  'useSameAddress',
  'isFinalConsumer',
  'wantsNewsletter',
]);

const ORDER_PERSON_TYPES = new Set(['natural', 'juridica']);
const ORDER_DOCUMENT_TYPES = new Set([
  'RC',
  'TI',
  'CC',
  'TE',
  'CE',
  'NIT',
  'PP',
  'DIE',
  'PEP',
  'PPT',
  'NIT_EXTRANJERO',
  'NUIP',
]);

function sanitizeOrderPartyPatch(value, allowedFields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const result = {};

  for (const [field, rawValue] of Object.entries(value)) {
    if (!allowedFields.has(field)) continue;

    if (ORDER_PARTY_BOOLEAN_FIELDS.has(field)) {
      if (typeof rawValue === 'boolean') result[field] = rawValue;
      continue;
    }

    if (
      rawValue !== null &&
      typeof rawValue !== 'string' &&
      typeof rawValue !== 'number'
    ) continue;

    result[field] = String(rawValue ?? '').trim().slice(0, 180);
  }

  return Object.keys(result).length ? result : null;
}

function getOrderCustomerEmail(orderData = {}) {
  return String(
    orderData?.billing?.email ||
      orderData?.customer?.email ||
      orderData?.customer?.emailOrPhone ||
      ''
  )
    .trim()
    .toLowerCase();
}

function isValidDeliveryEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || '').trim().toLowerCase()
  );
}

function orderNeedsElectronicDelivery(items = []) {
  return (Array.isArray(items) ? items : []).some((item) => {
    const productType = String(
      item?.productType || ''
    ).trim().toLowerCase();

    if (['digital', 'service'].includes(productType)) {
      return true;
    }

    if (productType !== 'bundle') return false;

    return (
      item?.fulfillmentSnapshot?.bundle?.components || []
    ).some((component) =>
      ['digital', 'service'].includes(
        String(component?.productType || '')
          .trim()
          .toLowerCase()
      )
    );
  });
}

function buildOrderCouponSnapshot(quote = {}) {
  const validation = quote.couponValidation;
  if (!validation?.valid) return undefined;

  const coupon = validation.coupon || {};
  const pricing = quote.pricing || {};

  return {
    coupon: coupon._id || coupon.id || null,
    redemption: null,
    code: coupon.code || quote.couponCode || '',
    type: coupon.type || '',
    value: Number(coupon.value || 0),
    name: coupon.name || '',
    discountAmount: Number(pricing.productDiscount || 0),
    shippingDiscountAmount: Number(pricing.shippingDiscount || 0),
    totalDiscountAmount: Number(pricing.totalDiscount || 0),
    originalShippingAmount: Number(pricing.originalShipping || 0),
    finalShippingAmount: Number(pricing.shipping || 0),
    status: 'applied',
    message: validation.message || 'Cupón aplicado correctamente.',
    appliedAt: new Date(),
  };
}

function buildOrderDiscountSnapshot(quote = {}) {
  const validation = quote.couponValidation;
  const pricing = quote.pricing || {};
  const coupon = validation?.coupon || {};
  const amount = Number(pricing.productDiscount || 0);

  if (!validation?.valid || Number(pricing.totalDiscount || 0) <= 0) {
    return {
      type: 'none',
      value: 0,
      amount: 0,
      reason: '',
    };
  }

  return {
    type: coupon.type === 'percentage' ? 'percent' : 'amount',
    value: Number(coupon.value || 0),
    amount,
    reason:
      Number(pricing.shippingDiscount || 0) > 0 && amount <= 0
        ? `Cupón ${coupon.code || quote.couponCode || ''} - envío gratis`
        : `Cupón ${coupon.code || quote.couponCode || ''}`,
  };
}

function buildPricingSnapshot(pricing = {}) {
  return {
    version: Number(pricing.version || 2),
    currency: pricing.currency || 'COP',
    subtotal: Number(pricing.subtotal || 0),
    productDiscount: Number(pricing.productDiscount || 0),
    subtotalAfterDiscount: Number(pricing.subtotalAfterDiscount || 0),
    originalShipping: Number(pricing.originalShipping || 0),
    shippingDiscount: Number(pricing.shippingDiscount || 0),
    shipping: Number(pricing.shipping || 0),
    totalDiscount: Number(pricing.totalDiscount || 0),
    taxableBase: Number(pricing.tax?.taxableBase || pricing.subtotalAfterDiscount || 0),
    taxAmount: Number(pricing.tax?.amount || 0),
    total: Number(pricing.total || 0),
  };
}

function normalizeTags(arr) {
  const values = Array.isArray(arr) ? arr : String(arr || '').split(',');
  const normalized = values
    .map((tag) =>
      String(tag || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .slice(0, 24)
    )
    .filter(Boolean);

  return Array.from(new Set(normalized)).slice(0, 20);
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

  // Una orden ya creada conserva su fotografía económica. Reintentar el mismo
  // request no puede recalcular precios, retirar un cupón ni cambiar el IVA.
  order.sessionId = cleaned.sessionId;
  order.customer = cleaned.customer;
  order.billing = cleaned.billing;

  if (cleaned.payment && typeof cleaned.payment === 'object') {
    if (!order.payment || typeof order.payment !== 'object') order.payment = {};
    order.payment.active = cleaned.payment.active;
    order.payment.provider = cleaned.payment.provider;
    order.payment.providerLabel = cleaned.payment.providerLabel;
    order.payment.mode = cleaned.payment.mode;
    order.payment.currency = cleaned.payment.currency;
    order.payment.checkoutLabel = cleaned.payment.checkoutLabel;
    order.payment.enableWebhook = cleaned.payment.enableWebhook;
  }

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
          total: Number(order.total || 0),
          pricingVersion: Number(order.pricing?.version || 0),
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
      variantKey: String(
        it?.variantKey ||
          it?.variantId ||
          it?.selectedVariantKey ||
          it?.selectedVariantId ||
          ''
      ).toLowerCase(),
      price: Number(it?.price ?? it?.unitPrice ?? it?.priceNumber ?? 0) || 0,
      quantity: Number(it?.quantity ?? it?.qty ?? 0) || 0,
    }))
    .filter((it) => it.productId && it.quantity > 0 && it.price >= 0);

  return sortBy(
    safe,
    (x) =>
      `${x.productId}|${x.variantKey}|${x.color.toLowerCase()}|${x.size.toLowerCase()}|${x.price}|${x.quantity}`
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

function getValidSource(value, hasAdminUser = false) {
  const source = String(value || '').trim().toLowerCase();

  if (hasAdminUser && ['admin', 'pos', 'manual', 'import', 'system'].includes(source)) {
    return source;
  }

  return 'online';
}

function getBranchIdFromRequest(rawBody = {}, cleaned = {}) {
  return (
    rawBody.branch ||
    rawBody.branchId ||
    rawBody.defaultBranch ||
    cleaned.branch ||
    cleaned.branchId ||
    cleaned.defaultBranch ||
    ''
  );
}

function buildBranchSnapshot(branch) {
  if (!branch) {
    return {
      name: '',
      code: '',
      type: '',
    };
  }

  return {
    name: String(branch.name || '').trim(),
    code: String(branch.code || '').trim().toUpperCase(),
    type: String(branch.type || '').trim().toLowerCase(),
  };
}

function buildAdminSnapshot(req) {
  return {
    username: String(req.adminUsername || req.user?.username || '').trim().toLowerCase(),
    displayName: String(
      req.adminDisplayName ||
        req.user?.displayName ||
        req.user?.fullName ||
        req.adminUsername ||
        ''
    ).trim(),
    role: String(req.adminRole || req.user?.role || '').trim().toLowerCase(),
    adminRole: String(req.adminRole || req.user?.adminRole || '').trim().toLowerCase(),
  };
}

async function getDefaultOnlineBranch({ session } = {}) {
  return (
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
      isDefaultForOnlineOrders: true,
    })
      .session(session)
      .lean()) ||
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
      isMain: true,
    })
      .session(session)
      .lean()) ||
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
    })
      .session(session)
      .lean())
  );
}

async function resolveOrderBranchData(rawBody = {}, cleaned = {}, { session } = {}) {
  const requestedBranchId = getBranchIdFromRequest(rawBody, cleaned);

  let branch = null;

  if (requestedBranchId && mongoose.Types.ObjectId.isValid(String(requestedBranchId))) {
    branch = await Branch.findOne({
      _id: requestedBranchId,
      deletedAt: null,
      active: true,
      status: 'active',
    })
      .session(session)
      .lean();
  }

  if (!branch) {
    branch = await getDefaultOnlineBranch({ session });
  }

  return {
    branchId: branch?._id || null,
    branchSnapshot: buildBranchSnapshot(branch),
  };
}

function deriveIdempotencyKey(cleaned) {
  const payload = {
    sessionId: String(cleaned.sessionId || ''),
    cart: canonicalizeCart(cleaned.cart),
    subtotal: Number(cleaned.subtotal || 0),
    shipping: Number(cleaned.shipping || 0),
    total: Number(cleaned.total || 0),
    couponCode: String(cleaned.couponCode || ''),
    customerEmail: String(cleaned.customer?.emailOrPhone || cleaned.customer?.email || ''),
    createdAtDay: new Date().toISOString().slice(0, 10),
  };

  const json = JSON.stringify(payload);

  return crypto.createHash('sha256').update(json).digest('hex');
}

router.use('/admin', requireAdmin);

function sendOrderScopeError(res, access) {
  return res.status(access.status || 403).json({
    error: access.error || 'ORDER_BRANCH_ACCESS_DENIED',
    message:
      access.message ||
      'No tienes permiso para operar órdenes de esa sede.',
  });
}

function buildOrderOperationFilter(req, orderId) {
  const objectId = asObjectId(orderId);

  if (!objectId) {
    return {
      ok: false,
      status: 400,
      error: 'INVALID_ORDER_ID',
      message: 'El identificador de la orden no es válido.',
      filter: null,
    };
  }

  return buildScopedOrderFilter(
    req,
    { _id: objectId },
    { requestedBranchId: '' }
  );
}

async function ensureOrderOperationAccess(req, res, orderId) {
  const access = buildOrderOperationFilter(req, orderId);

  if (!access.ok) {
    sendOrderScopeError(res, access);
    return false;
  }

  const exists = await Order.exists(access.filter);

  if (!exists) {
    res.status(404).json({
      error: 'ORDER_NOT_FOUND',
      message: 'Orden no encontrada dentro de tus sedes autorizadas.',
    });
    return false;
  }

  return true;
}

async function buildAuthorizedSelectionFilter(req, res, orderIds) {
  const access = buildScopedOrderFilter(
    req,
    { _id: { $in: orderIds } },
    { requestedBranchId: '' }
  );

  if (!access.ok) {
    sendOrderScopeError(res, access);
    return null;
  }

  const allowedIds = await Order.distinct('_id', access.filter);

  if (allowedIds.length !== orderIds.length) {
    res.status(403).json({
      error: 'ORDER_SELECTION_OUT_OF_SCOPE',
      message:
        'La selección contiene órdenes fuera de tus sedes autorizadas.',
    });
    return null;
  }

  return access.filter;
}

/* GET /api/orders/admin: consulta paginada y métricas en un servicio aislado. */
router.get('/admin', listAdminOrders);

router.get('/admin/operations/health', getOrderOperationalHealth);

router.get(
  '/admin/shipping/providers',
  requireAdmin,
  requirePermission('orders:view'),
  shippingProviders
);

router.get(
  '/:id/fulfillment/logistics',
  requireAdmin,
  requirePermission('orders:view'),
  getOrderLogistics
);

router.post(
  '/:id/fulfillment/logistics/initialize',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  initializeLogistics
);

router.patch(
  '/:id/fulfillment/logistics/shipments/:shipmentId',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  updateShipment
);

router.post(
  '/:id/fulfillment/logistics/shipments/:shipmentId/rates',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  quoteShipment
);

router.post(
  '/:id/fulfillment/logistics/shipments/:shipmentId/label',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  generateShipmentLabel
);

router.post(
  '/:id/fulfillment/logistics/shipments/:shipmentId/tracking/sync',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  syncShipmentTracking
);

router.post(
  '/:id/fulfillment/logistics/shipments/:shipmentId/label/cancel',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  cancelShipmentLabel
);

/* ============================
 * GET /api/orders/:id/thanks
 * ============================ */
router.get('/:id/thanks', async (req, res) => {
  try {
    const access = await resolveAuthorizedPublicPaymentOrder({
      req,
      OrderModel: Order,
      orderId: req.params.id,
    });
    if (!access.allowed) {
      return res.status(404).json(SAFE_PAYMENT_ACCESS_ERROR);
    }

    return res.json(buildPublicThanksResponse({ order: access.order }));
  } catch (error) {
    console.error('GET /orders/:id/thanks', error);
    if (error?.code === 'PAYMENT_ACCESS_SECRET_MISCONFIGURED') {
      return res.status(500).json({
        ok: false,
        error: 'PAYMENT_ACCESS_UNAVAILABLE',
        message: 'No fue posible validar el acceso a la orden.',
      });
    }
    return res.status(404).json(SAFE_PAYMENT_ACCESS_ERROR);
  }
});

/* ============================
 * GET /api/orders/:id
 * ============================ */
router.patch(
  '/:id/fulfillment/services/:serviceId',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  async (req, res) => {
    try {
      const allowedStatuses = new Set([
        'awaiting_scheduling',
        'scheduled',
        'in_progress',
        'completed',
        'cancelled',
      ]);
      const status = String(req.body?.status || '')
        .trim()
        .toLowerCase();

      if (!allowedStatuses.has(status)) {
        return res.status(400).json({
          message: 'Estado de servicio inválido.',
          allowed: [...allowedStatuses],
        });
      }

      const access = buildOrderOperationFilter(req, req.params.id);

      if (!access.ok) return sendOrderScopeError(res, access);

      const order = await Order.findOne(access.filter).select(
        '+fulfillment.services.bookingUrl +fulfillment.services.internalInstructions'
      );
      if (!order) {
        return res.status(404).json({
          message: 'Orden no encontrada.',
        });
      }

      const service = order.fulfillment?.services?.id(
        req.params.serviceId
      );
      if (!service) {
        return res.status(404).json({
          message: 'Prestación de servicio no encontrada.',
        });
      }

      let scheduledAt = service.scheduledAt || null;
      if (req.body?.scheduledAt) {
        const parsed = new Date(req.body.scheduledAt);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({
            message: 'La fecha programada no es válida.',
          });
        }
        scheduledAt = parsed;
      }

      service.status = status;
      service.scheduledAt =
        ['scheduled', 'in_progress', 'completed'].includes(status)
          ? scheduledAt || new Date()
          : scheduledAt;
      service.completedAt =
        status === 'completed'
          ? service.completedAt || new Date()
          : null;
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'notes')) {
        service.notes = String(req.body.notes || '')
          .trim()
          .slice(0, 2000);
      }

      const services = order.fulfillment?.services || [];
      const completedServices = services.filter(
        (item) => item.status === 'completed'
      ).length;
      const activeServices = services.filter(
        (item) => item.status !== 'cancelled'
      );
      const allServicesCompleted =
        activeServices.length > 0 &&
        activeServices.every(
          (item) => item.status === 'completed'
        );
      const hasShipment = (order.items || []).some(
        (item) => item.requiresShipping !== false
      );

      if (allServicesCompleted && !hasShipment) {
        order.fulfillment.status = 'delivered';
        order.fulfillmentStatus = 'delivered';
      } else if (completedServices > 0) {
        order.fulfillment.status = 'partially_delivered';
        order.fulfillmentStatus = 'partially_delivered';
      } else {
        order.fulfillment.status = 'action_required';
        if (!hasShipment) order.fulfillmentStatus = 'processing';
      }

      await order.save();
      await OrderEvent.create({
        orderId: order._id,
        type: 'system',
        message: `Servicio ${service.title || service._id}: ${status}`,
        meta: {
          serviceId: String(service._id),
          status,
          scheduledAt: service.scheduledAt || null,
          by: req.adminUserId || null,
        },
      });

      return res.json({
        ok: true,
        fulfillmentStatus: order.fulfillmentStatus,
        fulfillment: {
          status: order.fulfillment.status,
          notificationStatus:
            order.fulfillment.notificationStatus,
        },
        service,
      });
    } catch (error) {
      console.error(
        'PATCH /orders/:id/fulfillment/services/:serviceId',
        error
      );
      return res.status(500).json({
        message: 'No fue posible actualizar el servicio.',
      });
    }
  }
);

router.get(
  '/:id',
  requireAdmin,
  requirePermission('orders:view'),
  async (req, res) => {
  try {
    const filter = {
      _id: req.params.id,
    };
    const branchAccess = applyOrderBranchAccessFilter(req, filter);

    if (!branchAccess.ok) {
      return res.status(branchAccess.status || 403).json({
        error:
          branchAccess.error || 'BRANCH_ACCESS_DENIED',
        message:
          branchAccess.message ||
          'No tienes permiso para consultar órdenes de esa sede.',
      });
    }

    const o = await Order.findOne(filter).lean();
    if (!o) return res.status(404).json({ error: 'Orden no encontrada' });

    const invoice = await ElectronicInvoice.findOne({
      orderId: o._id,
    }).lean();

    res.json({
      ...o,
      electronicInvoice: invoice || null,
      factusLinks: invoice ? extractFactusLinks(invoice) : null,
    });
  } catch {
    res.status(400).json({ error: 'ID inválido' });
  }
  }
);

/* ============================
 * PATCH /api/orders/:id/status
 * ============================ */
router.options('/:id/status', (_req, res) => res.sendStatus(204));

router.patch('/:id/status', requireAdmin, requirePermission('orders:status'), async (req, res) => {
  try {
    if (!(await ensureOrderOperationAccess(req, res, req.params.id))) return;

    const result = await transitionOrderStatus(
      {
        orderId: req.params.id,
        status: req.body?.status,
        actor: {
          id: req.adminUserId || req.user?._id || req.user?.id || null,
          label:
            req.adminDisplayName ||
            req.adminUsername ||
            'admin',
          source: 'admin',
          ip: req.ip,
        },
      },
      {
        OrderEventModel: OrderEvent,
        allowInventoryRestock: false,
      }
    );

    res.json({
      ok: true,
      changed: result.changed,
      order: result.order,
      fulfillmentWarning: result.fulfillmentWarning,
    });
  } catch (e) {
    console.error('PATCH /orders/:id/status', e);
    res.status(e.statusCode || e.status || 500).json({
      error: e.code || 'ORDER_STATUS_TRANSITION_FAILED',
      message: e.message,
      code: e.code || '',
      details: e.details || undefined,
      allowed:
        e.code === 'INVALID_ORDER_STATUS'
          ? getAllowedOrderStatuses()
          : undefined,
    });
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
    const access = buildOrderOperationFilter(req, id);

    if (!access.ok) return sendOrderScopeError(res, access);

    const o = await Order.findOne(access.filter);

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
        by: req.adminUsername || req.adminUserId || 'admin',
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
    const access = buildOrderOperationFilter(req, id);

    if (!access.ok) return sendOrderScopeError(res, access);

    const o = await Order.findOne(access.filter);

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
        by: req.adminUsername || req.adminUserId || 'admin',
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
  const session = await mongoose.startSession();

  try {
    const id = req.params.id;
    const syncCustomer = req.body?.syncCustomer === true;

    const customer = sanitizeOrderPartyPatch(
      req.body?.customer,
      ORDER_CUSTOMER_EDITABLE_FIELDS
    );

    const billing = sanitizeOrderPartyPatch(
      req.body?.billing,
      ORDER_BILLING_EDITABLE_FIELDS
    );

    if (customer?.documentType) {
      customer.documentType = customer.documentType.toUpperCase();
      if (!ORDER_DOCUMENT_TYPES.has(customer.documentType)) {
        return res.status(400).json({
          error: 'CUSTOMER_DOCUMENT_TYPE_INVALID',
          message: 'Selecciona un tipo de documento válido para el comprador.',
        });
      }
    }

    if (billing?.personType) {
      billing.personType = billing.personType.toLowerCase();
      if (!ORDER_PERSON_TYPES.has(billing.personType)) {
        return res.status(400).json({
          error: 'BILLING_PERSON_TYPE_INVALID',
          message: 'Selecciona un tipo de persona válido.',
        });
      }
    }

    if (billing?.documentType) {
      billing.documentType = billing.documentType.toUpperCase();
      if (!ORDER_DOCUMENT_TYPES.has(billing.documentType)) {
        return res.status(400).json({
          error: 'BILLING_DOCUMENT_TYPE_INVALID',
          message: 'Selecciona un tipo de documento fiscal válido.',
        });
      }
    }

    if (
      billing?.personType === 'juridica' &&
      billing?.documentType &&
      billing.documentType !== 'NIT'
    ) {
      return res.status(400).json({
        error: 'BILLING_COMPANY_DOCUMENT_TYPE_INVALID',
        message: 'Una persona jurídica debe identificarse con NIT.',
      });
    }

    if (!customer && !billing) {
      return res.status(400).json({
        error: 'CUSTOMER_DATA_REQUIRED',
        message: 'No se recibieron campos editables de cliente o facturación.',
      });
    }

    const access = buildOrderOperationFilter(req, id);

    if (!access.ok) return sendOrderScopeError(res, access);

    let order = null;
    let linkedCustomer = null;

    await session.withTransaction(async () => {
      order = await Order.findOne(access.filter).session(session);

      if (!order) {
        throw Object.assign(new Error('Orden no encontrada.'), {
          code: 'ORDER_NOT_FOUND',
          statusCode: 404,
        });
      }

      const beforeCustomer = order.customer?.toObject
        ? order.customer.toObject()
        : order.customer || {};
      const beforeBilling = order.billing?.toObject
        ? order.billing.toObject()
        : order.billing || {};

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

      if (syncCustomer) {
        const result = await syncCustomerMasterFromOrder(order, {
          session,
          updatedByAdmin:
            req.adminUserId || req.user?._id || req.user?.id || null,
        });
        linkedCustomer = result.customer;
      }

      await order.save({ session });
      await applyCustomerStatsForOrder(order, { session });

      await OrderEvent.create(
        [
          {
            orderId: order._id,
            type: 'customer_data_updated',
            message: syncCustomer
              ? 'Datos actualizados en la orden y en la ficha del cliente'
              : 'Datos actualizados únicamente en la orden',
            meta: {
              customerFields: customer ? Object.keys(customer) : [],
              billingFields: billing ? Object.keys(billing) : [],
              syncCustomer,
              customerId: linkedCustomer?._id || order.customer?.customerId || null,
              by: req.adminUsername || req.adminUserId || 'admin',
            },
          },
        ],
        { session }
      );
    });

    return res.json({
      ok: true,
      customer: order.customer,
      billing: order.billing,
      customerRelationship: order.customerRelationship,
      linkedCustomer: linkedCustomer
        ? {
            id: String(linkedCustomer._id),
            customerCode: linkedCustomer.customerCode || '',
          }
        : null,
      order: order.toObject({ virtuals: true }),
    });
  } catch (e) {
    console.error('PATCH /orders/:id/customer-data', e);

    return res.status(e.statusCode || e.status || 500).json({
      error: e.code || 'CUSTOMER_DATA_UPDATE_ERROR',
      message:
        e.message || 'No fue posible actualizar los datos del cliente.',
      details: e.details || undefined,
    });
  } finally {
    await session.endSession();
  }
});

/* =========================================================
 * PUT /api/orders/:id/tags
 * ======================================================= */
router.put('/:id/tags', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const tags = normalizeTags(req.body?.tags || []);
    const access = buildOrderOperationFilter(req, id);

    if (!access.ok) return sendOrderScopeError(res, access);

    const o = await Order.findOne(access.filter);

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
        by: req.adminUsername || req.adminUserId || 'admin',
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
router.post('/', rateLimit, requireAuthorizedOrderCart, async (req, res) => {
  const endpoint = 'POST /orders';

  let paymentAccessSecret;
  try {
    paymentAccessSecret = getPaymentAccessSecret();
  } catch (error) {
    console.error('No fue posible habilitar el acceso publico de la orden.');
    return res.status(500).json({
      ok: false,
      error: 'ORDER_ACCESS_UNAVAILABLE',
      message: 'No fue posible iniciar la compra de forma segura.',
    });
  }

  if (req.authorizedOrderReplay?.orderId) {
    const replayOrder = await Order.findById(req.authorizedOrderReplay.orderId);
    if (!replayOrder) return res.status(404).json(SAFE_CART_ACCESS_ERROR);
    return res.status(200).json(
      withOrderPaymentAccess(
        buildOrderCreationResult(replayOrder, {
          idempotent: true,
          reused: true,
        }),
        {
          order: replayOrder,
          sessionId: req.authorizedCartSessionId,
          secret: paymentAccessSecret,
        }
      )
    );
  }

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
        if (!sameRequestHash) {
          return res.status(409).json({
            error: 'IDEMPOTENCY_CONFLICT',
            message: 'La clave de idempotencia ya fue usada con otro payload.',
          });
        }
        const existingOrder = await Order.findById(prevKey.orderId);

        if (existingOrder && !canReuseMutableOrderData(existingOrder)) {
          await markCartConverted({
            sessionId: cleaned.sessionId,
            orderId: existingOrder._id,
            convertedAt: existingOrder.createdAt || new Date(),
          });
          return res.status(200).json(
            withOrderPaymentAccess(
              buildOrderCreationResult(existingOrder, {
                idempotent: true,
                reused: true,
              }),
              {
                order: existingOrder,
                sessionId: cleaned.sessionId,
                secret: paymentAccessSecret,
              }
            )
          );
        }

        const syncedOrder = await syncExistingOrderForRetry(prevKey.orderId, cleaned);

        if (syncedOrder) {
          await markCartConverted({
            sessionId: cleaned.sessionId,
            orderId: syncedOrder._id,
            convertedAt: syncedOrder.createdAt || new Date(),
          });
          return res.status(200).json(
            withOrderPaymentAccess(
              buildOrderCreationResult(syncedOrder, {
                idempotent: true,
                reused: true,
              }),
              {
                order: syncedOrder,
                sessionId: cleaned.sessionId,
                secret: paymentAccessSecret,
              }
            )
          );
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

    try {
    await expireInventoryReservations({ limit: 25 });
  } catch (expirationError) {
    console.warn(
      '⚠️ No se pudieron liberar reservas vencidas antes de crear la orden:',
      expirationError.message
    );
  }

  const session = await mongoose.startSession();

  try {
    let created;
    let inventoryReservation = null;

    await session.withTransaction(async () => {
      // withTransaction puede volver a ejecutar este callback. Ningún documento
      // procedente de un intento abortado puede reutilizarse en el siguiente.
      created = null;
      inventoryReservation = null;
      activeIdempotencyRecord = null;

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

      const orderNumber = await getNextOrderNumber({ session });
      const settings = await SiteSettings.findOne().session(session).lean();
      const billingMode = getBillingMode(settings);

      const quote = await buildOrderQuote(
        {
          items: cleaned.cart,
          customer: cleaned.customer,
          billing: cleaned.billing,
          couponCode: cleaned.couponCode,
          customerEmail: getOrderCustomerEmail(cleaned),
          sessionId: cleaned.sessionId,
        },
        { session, settings }
      );

      if (quote.couponCode && !quote.couponValidation?.valid) {
        throw Object.assign(
          new Error(quote.couponValidation?.message || 'El cupón no es válido.'),
          {
            code: quote.couponValidation?.code || 'COUPON_INVALID',
            statusCode: 422,
            details: {
              code: quote.couponValidation?.code || 'COUPON_INVALID',
            },
          }
        );
      }

      const pricing = quote.pricing;
      if (
        orderNeedsElectronicDelivery(pricing.items) &&
        !isValidDeliveryEmail(getOrderCustomerEmail(cleaned))
      ) {
        throw Object.assign(
          new Error(
            'Los productos digitales y servicios necesitan un correo válido para completar la entrega.'
          ),
          {
            code: 'FULFILLMENT_EMAIL_REQUIRED',
            statusCode: 400,
          }
        );
      }

      const reservableItems = await expandReservableItems(
        pricing.items,
        { session }
      );
      const reservationRequired = reservableItems.length > 0;
      const pricingSnapshot = buildPricingSnapshot(pricing);
      const couponSnapshot = buildOrderCouponSnapshot(quote);
      const discountSnapshot = buildOrderDiscountSnapshot(quote);
      const summary = calcSummaryFromItems(pricing.items);

      const orderBranchData = await resolveOrderBranchData(req.body || {}, cleaned, {
        session,
      });

      const hasAdminUser = Boolean(req.adminUserId);
      const orderSource = getValidSource(req.body?.source || cleaned.source, hasAdminUser);
      const createdByAdminSnapshot = buildAdminSnapshot(req);

      console.log('🧾 MODO FACTURACIÓN:', {
        dianEnabled: billingMode.dianEnabled,
        dianMode: billingMode.dianMode,
        isDianActive: billingMode.isDianActive,
        isInternalMode: billingMode.isInternalMode,
      });

      const taxesSnapshot = {
        iva: {
          enabled: pricing.tax.enabled,
          percent: pricing.tax.percent,
          code: pricing.tax.code,
          name: pricing.tax.name,
          taxableBase: pricing.tax.taxableBase,
          amount: pricing.tax.amount,
        },
      };

      const base = {
        ...cleaned,
        orderNumber,
        cart: pricing.items,
        items: pricing.items,
        summary: {
          itemsCount: pricing.items.length,
          totalItems: summary.totalItems,
          subtotal: pricing.subtotal,
        },
        subtotal: pricing.subtotal,
        shipping: pricing.shipping,
        total: pricing.total,
        discount: discountSnapshot,
        coupon: couponSnapshot,
        pricing: pricingSnapshot,
        taxes: taxesSnapshot,
        payment: {
          ...(cleaned.payment || {}),
          amount: pricing.total,
          amountInCents: Math.round(pricing.total * 100),
        },

        branch: orderBranchData.branchId,
        branchSnapshot: orderBranchData.branchSnapshot,

        createdByAdmin: hasAdminUser && req.adminUserId ? req.adminUserId : null,
        createdByAdminSnapshot,

        source: orderSource,

        inventoryControl: {
          reservationRequired,
          reservationId: null,
          discountedAtCheckout: false,
          restockedOnFailure: false,
          restockedAt: null,
        },
      };

      base.status = base.status || 'pending';

      const customerResolution = await resolveCustomerForOrder(base, {
        session,
        source: orderSource,
      });
      const linkedBase = applyCustomerResolutionToOrderData(
        base,
        customerResolution
      );

      created = await Order.create([{ ...linkedBase }], { session });
      created = created[0];

      await applyCustomerStatsForOrder(created, { session });

      if (reservationRequired) {
        inventoryReservation = await createInventoryReservation(
          {
          sessionId: cleaned.sessionId,
          order: created._id,
          orderNumber: created.orderNumber,
          paymentReference:
            req.body?.paymentReference ||
            req.body?.payment?.reference ||
            req.body?.payment?.transactionId ||
            '',
          paymentTransactionId:
            req.body?.paymentTransactionId ||
            req.body?.payment?.transactionId ||
            '',
          source: 'checkout',
          items: created.items,
          branchPriorityIds: orderBranchData.branchId
            ? [String(orderBranchData.branchId)]
            : [],
          expiresInMinutes: 20,
          currency: cleaned.payment?.currency || 'COP',
          metadata: {
            orderSource,
            idempotencyKey: idempoKey || '',
            orderBranch: orderBranchData.branchId
              ? String(orderBranchData.branchId)
              : '',
            orderBranchSnapshot: orderBranchData.branchSnapshot,
          },
          notes: 'Reserva automática creada al generar la orden online.',
          },
          { session }
        );

        created.inventoryControl.reservationId =
          inventoryReservation?._id || null;
        applyReservationToOrderDocument(
          created,
          inventoryReservation
        );
        await created.save({ session });
      }

      if (quote.couponValidation?.valid && created.coupon?.coupon) {
        const redemption = await couponService.recordCouponRedemption(
          {
            couponId: created.coupon.coupon,
            code: created.coupon.code,
            orderId: created._id,
            orderNumber: created.orderNumber,
            customerEmail: getOrderCustomerEmail(cleaned),
            sessionId: cleaned.sessionId,
            source: 'checkout',
            subtotal: pricing.subtotal,
            shippingAmount: pricing.originalShipping,
            discount: {
              eligibleSubtotal: quote.couponValidation?.discount?.eligibleSubtotal || 0,
              discountAmount: pricing.productDiscount,
              shippingDiscountAmount: pricing.shippingDiscount,
              totalDiscountAmount: pricing.totalDiscount,
            },
          },
          { session }
        );

        created.coupon.redemption = redemption?._id || null;
        await created.save({ session });

        await OrderEvent.create(
          [
            {
              orderId: created._id,
              type: 'coupon_applied',
              message: `Cupón aplicado: ${created.coupon.code}`,
              meta: {
                coupon: created.coupon.toObject ? created.coupon.toObject() : created.coupon,
                redemptionId: redemption?._id || null,
                subtotal: pricing.subtotal,
                productDiscount: pricing.productDiscount,
                originalShipping: pricing.originalShipping,
                shippingDiscount: pricing.shippingDiscount,
                finalShipping: pricing.shipping,
                taxableBase: pricing.subtotalAfterDiscount,
                taxAmount: pricing.tax.amount,
                finalTotal: pricing.total,
              },
            },
          ],
          { session }
        );
      }

      await OrderEvent.create(
        [
          {
            orderId: created._id,
            type: 'status_changed',
            message: `Orden creada con estado ${created.status}`,
            meta: {
              to: created.status,
              ip: req.ip,
              branch: orderBranchData.branchId,
              branchSnapshot: orderBranchData.branchSnapshot,
              source: orderSource,
              reservationId: inventoryReservation?._id || null,
              reservationCode: inventoryReservation?.reservationCode || '',
              reservationStatus: inventoryReservation?.status || '',
              reservationExpiresAt: inventoryReservation?.expiresAt || null,
              by: createdByAdminSnapshot.username || 'system',
            },
          },
        ],
        { session }
      );
      const cartConversion = await markCartConverted(
        {
          sessionId: cleaned.sessionId,
          orderId: created._id,
          convertedAt: created.createdAt || new Date(),
        },
        { session }
      );
      if (Number(cartConversion?.matchedCount || 0) !== 1) {
        throw Object.assign(
          new Error('La credencial del carrito ya fue utilizada.'),
          { code: 'CART_ACCESS_ALREADY_USED', statusCode: 404 }
        );
      }


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
        if (!activeIdempotencyRecord) {
          throw Object.assign(
            new Error('No se pudo finalizar el registro de idempotencia.'),
            { code: 'IDEMPOTENCY_FINALIZATION_FAILED' }
          );
        }

        activeIdempotencyRecord.status = 'completed';
        activeIdempotencyRecord.orderId = created._id;
        activeIdempotencyRecord.response = {
          _id: created._id,
          orderNumber: created.orderNumber,
          reservationId: inventoryReservation?._id || null,
          reservationCode: inventoryReservation?.reservationCode || '',
          subtotal: pricing.subtotal,
          discount: pricing.totalDiscount,
          tax: pricing.tax.amount,
          shipping: pricing.shipping,
          total: pricing.total,
        };
        activeIdempotencyRecord.completedAt = new Date();
        await activeIdempotencyRecord.save({ session });

        if (activeIdempotencyRecord.status !== 'completed') {
          throw Object.assign(
            new Error('El registro de idempotencia no quedó completado.'),
            { code: 'IDEMPOTENCY_FINALIZATION_FAILED' }
          );
        }
      }
    });

    if (created && created._id) {
      const statusCode = created.idempotent || created.reused ? 200 : 201;

      return res.status(statusCode).json(
        withOrderPaymentAccess(
          buildOrderCreationResult(created, {
            reservationId: inventoryReservation?._id || null,
            reservationCode: inventoryReservation?.reservationCode || '',
            reservationStatus: inventoryReservation?.status || '',
            reservationExpiresAt: inventoryReservation?.expiresAt || null,
            ...(created.idempotent || created.reused
              ? { idempotent: true, reused: true }
              : {}),
          }),
          {
            order: created,
            sessionId: cleaned.sessionId,
            secret: paymentAccessSecret,
          }
        )
      );
    }

    const existing = await IdempotencyKey.findOne({ key: idempoKey, endpoint }).lean();

    if (existing?.orderId) {
      const prev = await syncExistingOrderForRetry(existing.orderId, cleaned);

      if (prev) {
        await markCartConverted({
          sessionId: cleaned.sessionId,
          orderId: prev._id,
          convertedAt: prev.createdAt || new Date(),
        });
        return res.status(200).json(
          withOrderPaymentAccess(
            buildOrderCreationResult(prev, {
              idempotent: true,
              reused: true,
            }),
            {
              order: prev,
              sessionId: cleaned.sessionId,
              secret: paymentAccessSecret,
            }
          )
        );
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
    if (code === 'CART_ACCESS_ALREADY_USED') {
      return res.status(404).json(SAFE_CART_ACCESS_ERROR);
    }
    if (code === 'INSUFFICIENT_STOCK') {
      return res.status(error.statusCode || 409).json({
        error: 'No hay inventario suficiente para completar la compra.',
        code,
        details: error.details || {},
      });
    }

    if (code === 'CONCURRENT_STOCK_CHANGE') {
      return res.status(error.statusCode || 409).json({
        error: 'El inventario cambió mientras se intentaba reservar. Intenta nuevamente.',
        code,
        details: error.details || {},
      });
    }

    if (
      [
        'INVALID_PRODUCT_ID',
        'MISSING_SIZE',
        'MISSING_COLOR',
        'INVALID_QUANTITY',
        'PRODUCT_NOT_AVAILABLE',
        'PRODUCT_PRICE_INVALID',
      ].includes(code)
    ) {
      return res.status(error.statusCode || 400).json({
        error: error.message || 'Datos inválidos para reservar inventario.',
        code,
        details: error.details || {},
      });
    }

    if (code.startsWith('COUPON_')) {
      return res.status(error.statusCode || error.status || 422).json({
        ok: false,
        error: code,
        code,
        message: error.message || 'El cupón no pudo aplicarse a la orden.',
        details: error.details || null,
      });
    }

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

    if (!(await ensureOrderOperationAccess(req, res, orderId))) return;

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
    const text = String(req.body?.text || '').trim().slice(0, 2000);
    const pinned = !!req.body?.pinned;
    const author = {
      name: String(req.adminUsername || req.adminProfile?.displayName || 'admin'),
      id: String(req.adminUserId || ''),
    };

    if (!(await ensureOrderOperationAccess(req, res, orderId))) return;

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

    if (!(await ensureOrderOperationAccess(req, res, orderId))) return;

    const patch = {};

    if (typeof req.body?.text === 'string') {
      const text = req.body.text.trim().slice(0, 2000);
      if (!text) {
        return res.status(400).json({
          error: 'NOTE_TEXT_REQUIRED',
          message: 'El texto de la nota es obligatorio.',
        });
      }
      patch.text = text;
    }
    if (typeof req.body?.pinned === 'boolean') patch.pinned = req.body.pinned;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({
        error: 'NOTE_PATCH_REQUIRED',
        message: 'No se recibieron cambios válidos para la nota.',
      });
    }

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

    if (!(await ensureOrderOperationAccess(req, res, orderId))) return;

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

    if (!(await ensureOrderOperationAccess(req, res, orderId))) return;

    const items = await OrderEvent.find({ orderId }).sort({ _id: -1 }).lean();

    res.json({ data: items });
  } catch (e) {
    console.error('GET /orders/:id/timeline', e);
    res.status(500).json({ error: 'No se pudo obtener el timeline' });
  }
});

/* =========================================================
 * XML FACTURA ELECTRÓNICA
 * GET /api/orders/:id/invoice-xml
 * ======================================================= */
function safeInvoiceDownloadName(value, fallback, extension) {
  const name = String(value || fallback || 'factura')
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^[_\.]+|[_\.]+$/g, '') || 'factura';

  return name.toLowerCase().endsWith(extension)
    ? name
    : `${name}${extension}`;
}

function sendOfficialInvoiceDocument(res, documentResult) {
  const extension = documentResult.type === 'pdf' ? '.pdf' : '.xml';
  const fallback = `factura-${documentResult.invoiceNumber || 'factus'}`;
  const fileName = safeInvoiceDownloadName(
    documentResult.fileName,
    fallback,
    extension
  );

  res.setHeader('Content-Type', documentResult.contentType);
  res.setHeader('Content-Length', String(documentResult.buffer.length));
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Invoice-Document-Source', 'factus');
  res.setHeader('X-Invoice-Number', documentResult.invoiceNumber || '');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Disposition, X-Invoice-Document-Source, X-Invoice-Number'
  );
  return res.status(200).send(documentResult.buffer);
}

function sendInvoiceDocumentError(res, error, fallback) {
  const candidate = Number(error?.status || error?.statusCode || 500);
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599
    ? candidate
    : 500;
  return res.status(status).json({
    error: error?.code || 'INVOICE_DOCUMENT_DOWNLOAD_ERROR',
    message: error?.message || fallback,
  });
}

router.get(
  '/:id/invoice-xml',
  requireAdmin,
  requirePermission('billing:download'),
  async (req, res) => {
    try {
      const orderId = req.params.id;

      if (!(await ensureOrderOperationAccess(req, res, orderId))) return;

      const documentResult = await downloadOfficialInvoiceDocument({
        orderId,
        type: 'xml',
      });

      if (documentResult.official) {
        return sendOfficialInvoiceDocument(res, documentResult);
      }

      const invoice = documentResult.invoice?.toObject
        ? documentResult.invoice.toObject()
        : documentResult.invoice;

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

      const safeFileName = safeInvoiceDownloadName(
        `factura-${invoiceNumber || orderId}`,
        `factura-${orderId}`,
        '.xml'
      );

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Invoice-Document-Source', 'internal');
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Disposition, X-Invoice-Document-Source, X-Invoice-Number'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeFileName}"`
      );

      return res.status(200).send(xmlContent);
    } catch (error) {
      console.error('GET /orders/:id/invoice-xml', error);

      return sendInvoiceDocumentError(
        res,
        error,
        'No se pudo descargar el XML de la factura.'
      );
    }
  }
);
/* =========================================================
 * PDF INTERNO DE LA ORDEN
 * Conserva el comprobante comercial detallado aunque la
 * factura electrónica todavía no exista o haya fallado.
 * ======================================================= */
router.get(
  '/:id/receipt-pdf',
  requireAdmin,
  requirePermission('billing:download'),
  async (req, res) => {
    try {
      const id = req.params.id;
      const access = buildOrderOperationFilter(req, id);

      if (!access.ok) return sendOrderScopeError(res, access);

      const order = await Order.findOne(access.filter)
        .populate({ path: 'items.product', select: 'title sku price image slug' })
        .lean();

      if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

      const [invoice, settings] = await Promise.all([
        ElectronicInvoice.findOne({ orderId: order._id }).lean(),
        SiteSettings.findOne().lean(),
      ]);

      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Disposition, X-Invoice-Document-Source, X-Invoice-Number'
      );
      res.setHeader('X-Invoice-Document-Source', 'order-receipt');

      await generateOrderPdf({
        order,
        invoice,
        settings,
        res,
      });
    } catch (error) {
      console.error('GET /orders/:id/receipt-pdf', error);
      return sendInvoiceDocumentError(
        res,
        error,
        'No se pudo descargar el comprobante PDF de la orden.'
      );
    }
  }
);

/* =========================================================
 * PDF OFICIAL DE FACTUS
 * ======================================================= */
router.get(
  '/:id/pdf',
  requireAdmin,
  requirePermission('billing:download'),
  async (req, res) => {
    try {
      const id = req.params.id;
      const access = buildOrderOperationFilter(req, id);

      if (!access.ok) return sendOrderScopeError(res, access);

      const order = await Order.findOne(access.filter)
        .populate({ path: 'items.product', select: 'title sku price image slug' })
        .lean();

      if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

      const invoice = await ElectronicInvoice.findOne({
        orderId: order._id,
      }).lean();

      if (invoice) {
        const documentResult = await downloadOfficialInvoiceDocument({
          orderId: order._id,
          type: 'pdf',
        });

        if (documentResult.official) {
          return sendOfficialInvoiceDocument(res, documentResult);
        }
      }

      const settings = await SiteSettings.findOne().lean();

      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Disposition, X-Invoice-Document-Source, X-Invoice-Number'
      );

      await generateOrderPdf({
        order,
        invoice,
        settings,
        res,
      });
    } catch (e) {
      console.error('GET /orders/:id/pdf', e);
      return sendInvoiceDocumentError(
        res,
        e,
        'No se pudo descargar el PDF de la factura.'
      );
    }
  }
);

/* =========================================================
 * Reembolso
 * ======================================================= */
router.options('/:id/refund', (_req, res) => res.sendStatus(204));

router.post(
  '/:id/refund',
  requireAdmin,
  requirePermission('orders:refund'),
  async (req, res) => {
  try {
    if (!(await ensureOrderOperationAccess(req, res, req.params.id))) return;

    const result = await processOrderRefund(
      {
        orderId: req.params.id,
        amount: req.body?.amount,
        reason: req.body?.reason,
        items: req.body?.items,
        idempotencyKey:
          req.headers['x-idempotency-key'] ||
          req.body?.idempotencyKey ||
          '',
        adminId:
          req.adminUserId ||
          req.user?._id ||
          req.user?.id ||
          null,
        adminLabel:
          req.adminDisplayName ||
          req.adminUsername ||
          req.user?.displayName ||
          req.user?.username ||
          'admin',
      },
      {
        OrderEventModel: OrderEvent,
      }
    );

    return res.status(result.idempotent ? 200 : 201).json({
      ok: true,
      idempotent: result.idempotent,
      refund: result.refund,
    });
  } catch (e) {
    console.error('POST /orders/:id/refund', e);
    return res.status(Number(e.statusCode || 500)).json({
      error: e.code || 'ORDER_REFUND_FAILED',
      message:
        e.statusCode && e.message
          ? e.message
          : 'No se pudo procesar el reembolso.',
      details: e.details || undefined,
    });
  }
  }
);

router.get(
  '/:id/refunds',
  requireAdmin,
  requirePermission('orders:view'),
  async (req, res) => {
    try {
      if (!(await ensureOrderOperationAccess(req, res, req.params.id))) return;
      const refunds = await listOrderRefunds(req.params.id);
      return res.json({ ok: true, refunds });
    } catch (error) {
      return res.status(Number(error?.statusCode || 500)).json({
        ok: false,
        error: error?.code || 'ORDER_REFUNDS_LIST_FAILED',
        message: error?.message || 'No se pudieron consultar las devoluciones.',
      });
    }
  }
);

router.options('/:id/refunds/:refundId/confirm-payment', (_req, res) =>
  res.sendStatus(204)
);

router.post(
  '/:id/refunds/:refundId/confirm-payment',
  requireAdmin,
  requirePermission('orders:refund'),
  async (req, res) => {
    try {
      if (!(await ensureOrderOperationAccess(req, res, req.params.id))) return;
      const refund = await confirmRefundPaymentReversal({
        orderId: req.params.id,
        refundId: req.params.refundId,
        reference: req.body?.reference,
        adminLabel:
          req.adminDisplayName ||
          req.adminUsername ||
          req.user?.displayName ||
          req.user?.username ||
          'admin',
      });

      return res.json({
        ok: true,
        message: 'Devolución del dinero confirmada y conciliación actualizada.',
        refund,
      });
    } catch (error) {
      return res.status(Number(error?.statusCode || 500)).json({
        ok: false,
        error: error?.code || 'PAYMENT_REVERSAL_CONFIRMATION_FAILED',
        message: error?.message || 'No se pudo confirmar la devolución del dinero.',
        details: error?.details || undefined,
      });
    }
  }
);

router.options('/:id/refunds/:refundId/automate', (_req, res) =>
  res.sendStatus(204)
);

router.post(
  '/:id/refunds/:refundId/automate',
  requireAdmin,
  requirePermission('orders:refund'),
  requirePermission('billing:credit_note'),
  async (req, res) => {
    try {
      if (!(await ensureOrderOperationAccess(req, res, req.params.id))) return;
      const result = await automateOrderRefund(
        {
          orderId: req.params.id,
          refundId: req.params.refundId,
          adminLabel:
            req.adminDisplayName ||
            req.adminUsername ||
            req.user?.displayName ||
            req.user?.username ||
            'admin',
        },
        { OrderEventModel: OrderEvent }
      );

      return res.status(result.completed ? 200 : 202).json({
        ok: true,
        message: result.completed
          ? 'Reembolso conciliado automáticamente.'
          : 'La automatización avanzó y dejó visibles las acciones que aún requieren intervención.',
        ...result,
      });
    } catch (error) {
      return res.status(Number(error?.statusCode || 500)).json({
        ok: false,
        error: error?.code || 'ORDER_REFUND_AUTOMATION_FAILED',
        message: error?.message || 'No se pudo automatizar el cierre del reembolso.',
        details: error?.details || undefined,
      });
    }
  }
);

/* =========================================================
 * POST /api/orders/admin/bulk
 * ======================================================= */
router.post('/admin/bulk', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];

    if (ids.length === 0) return res.status(400).json({ error: 'IDS_REQUIRED' });

    const uniqueIds = Array.from(
      new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))
    );
    const objIds = uniqueIds.map(asObjectId).filter(Boolean);

    if (objIds.length !== uniqueIds.length) {
      return res.status(400).json({
        error: 'INVALID_IDS',
        message: 'La selección contiene identificadores de orden inválidos.',
      });
    }

    const selectionFilter = await buildAuthorizedSelectionFilter(
      req,
      res,
      objIds
    );
    if (!selectionFilter) return;

    const action = req.body?.action || {};
    const type = String(action.type || '').toLowerCase();

    let modified = 0;
    const events = [];

    if (type === 'status') {
      const result = await processBulkOrderStatusTransitions(
        {
          orderIds: objIds,
          status: action.value,
          actor: {
            id:
              req.adminUserId ||
              req.user?._id ||
              req.user?.id ||
              null,
            label:
              req.adminDisplayName ||
              req.adminUsername ||
              'admin',
            source: 'admin_bulk',
            ip: req.ip,
          },
        },
        {
          OrderEventModel: OrderEvent,
        }
      );

      return res.status(result.failed > 0 ? 207 : 200).json(result);
    } else if (type === 'tags_add') {
      const tags = normalizeTags(action.value || action.values || []);

      if (tags.length === 0) return res.status(400).json({ error: 'TAGS_REQUIRED' });

      const result = await Order.updateMany(
        selectionFilter,
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
        selectionFilter,
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
    res.status(e.statusCode || e.status || 500).json({
      error: e.code || 'ORDER_BULK_ACTION_FAILED',
      message:
        e.message || 'No se pudieron aplicar las acciones masivas',
      details: e.details || undefined,
    });
  }
});

/* =========================================================
 * POST /api/orders/admin/export
 * ======================================================= */
router.post('/admin/export', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];

    if (ids.length === 0) return res.status(400).json({ error: 'IDS_REQUIRED' });

    const uniqueIds = Array.from(
      new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))
    );
    const objIds = uniqueIds.map(asObjectId).filter(Boolean);

    if (objIds.length !== uniqueIds.length) {
      return res.status(400).json({ error: 'INVALID_IDS' });
    }

    const selectionFilter = await buildAuthorizedSelectionFilter(
      req,
      res,
      objIds
    );
    if (!selectionFilter) return;

    const docs = await Order.find(selectionFilter)
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
