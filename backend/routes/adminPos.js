// backend/routes/adminPos.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const Branch = require('../models/Branch');
const CashSession = require('../models/CashSession');
const Order = require('../models/Order');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const SiteSettings = require('../models/SiteSettings');
const { serializeCashSession } = require('../services/cashSessionService');
const {
  POS_PAYMENT_METHODS,
  preparePosSalePreview,
  validateDiscountAuthorization,
} = require('../services/adminPosService');
const { createPosSaleWithCashSession } = require('../services/posCashSaleService');
const {
  assertPosBranchAccess,
  buildPosBranchFilter,
  buildPosResourceAccess,
} = require('../services/adminPosAccessService');
const {
  buildPosSaleIdempotency,
  inspectPosSaleIdempotency,
} = require('../services/posSaleIdempotencyService');
const {
  closeHeldSale,
  createHeldSale,
  listHeldSales,
  listPosSalesHistory,
  touchHeldSale,
} = require('../services/posOperationsService');
const { buildPosShiftSummary } = require('../services/posShiftReportService');

const router = express.Router();

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizePermission(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, ':');
}

function escapeRegex(value) {
  return cleanText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPositiveInt(value, fallback = 30, max = 60) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(Math.floor(number), max);
}

function getEffectivePermissions(req) {
  const permissions = new Set();
  const sources = [
    req.adminEffectivePermissions,
    req.adminPermissions,
    req.adminRolePermissions,
    req.adminProfile?.permissions,
  ];

  sources.forEach((items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      const permission = normalizePermission(item);
      if (permission) permissions.add(permission);
    });
  });

  return permissions;
}

function hasPermission(req, permission) {
  const role = cleanText(req.adminRole || req.adminProfile?.adminRole).toLowerCase();

  if (req.adminAuthType === 'legacy') return true;
  if (role === 'owner' || role === 'admin') return true;

  const cleanPermission = normalizePermission(permission);
  const [moduleName] = cleanPermission.split(':');
  const permissions = getEffectivePermissions(req);

  return (
    permissions.has(cleanPermission) ||
    permissions.has('*') ||
    permissions.has('*:*') ||
    Boolean(moduleName && permissions.has(`${moduleName}:*`))
  );
}

function buildAdminContext(req) {
  return {
    _id: req.adminUserId || req.adminProfile?.id || null,
    id: req.adminUserId || req.adminProfile?.id || null,
    username: req.adminUsername || req.adminProfile?.username || '',
    displayName:
      req.adminProfile?.displayName ||
      req.adminProfile?.fullName ||
      req.adminUsername ||
      '',
    role: req.adminProfile?.role || 'admin',
    adminRole: req.adminRole || req.adminProfile?.adminRole || '',
    canApplyPosDiscount: hasPermission(req, 'pos:discount'),
    canApprovePosDiscount: hasPermission(req, 'pos:discount:approve'),
  };
}

function serializeBranch(branch = {}) {
  return {
    id: String(branch._id || branch.id || ''),
    name: branch.name || '',
    code: branch.code || '',
    type: branch.type || '',
    isMain: branch.isMain === true,
    isDefaultForOnlineOrders: branch.isDefaultForOnlineOrders === true,
    settings: {
      allowPosSales: branch.settings?.allowPosSales === true,
      requireCashSessionForPos: branch.settings?.requireCashSessionForPos === true,
      allowNegativeStock: branch.settings?.allowNegativeStock === true,
      defaultPaymentMethod: branch.settings?.defaultPaymentMethod || 'cash',
      defaultCustomerName: branch.settings?.defaultCustomerName || 'Consumidor final',
    },
  };
}

function getProductImage(product = {}, stock = {}) {
  if (product.image) return product.image;

  if (Array.isArray(product.images) && product.images.length > 0) {
    if (typeof product.images[0] === 'string') return product.images[0];
    if (product.images[0]?.url) return product.images[0].url;
  }

  return stock.productSnapshot?.image || '';
}

function getAvailableStock(stock = {}) {
  return Math.max(0, Number(stock.stock || 0) - Number(stock.reservedStock || 0));
}

function serializePosProduct(stock = {}, branch = {}) {
  const product = stock.product && typeof stock.product === 'object' ? stock.product : {};
  const productId = String(product._id || stock.product || '');
  const variant = stock.variant || {};
  const availableStock = getAvailableStock(stock);
  const category = product.category || stock.productSnapshot?.category || '';

  return {
    id: `${productId}:${stock.variantKey || 'default__default'}`,
    productId,
    title: product.title || stock.productSnapshot?.title || '',
    sku: product.sku || stock.productSnapshot?.sku || '',
    barcode: product.barcode || variant.barcode || '',
    category,
    categories: Array.isArray(product.categories) ? product.categories : category ? [category] : [],
    price: Number(product.price || 0),
    image: getProductImage(product, stock),
    variantKey: stock.variantKey || 'default__default',
    variantLabel: variant.label || '',
    variantAttributes: Array.isArray(variant.attributes)
      ? variant.attributes
      : [],
    size: variant.size || '',
    color: variant.color || '',
    variantSku: variant.sku || '',
    variantBarcode: variant.barcode || '',
    stock: Number(stock.stock || 0),
    reservedStock: Number(stock.reservedStock || 0),
    availableStock,
    branch: serializeBranch(branch),
  };
}

function serializePreview(preview = {}) {
  return {
    branch: serializeBranch(preview.branch || {}),
    branchSnapshot: preview.branchSnapshot || {},
    items: (preview.items || []).map((item) => ({
      productId: item.productId,
      title: item.productSnapshot?.title || item.title,
      sku: item.productSnapshot?.sku || item.sku || '',
      image: item.productSnapshot?.image || item.image || '',
      size: item.size,
      color: item.color,
      variantLabel: item.variantLabel || '',
      variantAttributes: item.variantAttributes || [],
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineSubtotal: item.lineSubtotal,
      availableStock: item.availableStock,
      variantKey: item.variantKey,
    })),
    summary: preview.summary,
    subtotal: preview.subtotal,
    discount: preview.discount,
    taxes: preview.taxes,
    shipping: preview.shipping,
    total: preview.total,
    payment: preview.payment,
    customer: preview.customer,
    billing: preview.billing,
  };
}

function serializeOrder(order = {}) {
  if (typeof order.toSafeObject === 'function') return order.toSafeObject();
  if (typeof order.toObject === 'function') return order.toObject();
  return order;
}

function serializePosSaleResult(result = {}, options = {}) {
  return {
    ok: true,
    order: serializeOrder(result.order || {}),
    movements: (result.movements || []).map((movement) =>
      movement.toSafeObject
        ? movement.toSafeObject()
        : movement.toObject?.() || movement
    ),
    branch: serializeBranch(result.branch || {}),
    cashSession: result.cashSession
      ? serializeCashSession(result.cashSession)
      : null,
    cashRegisterCode: result.cashRegisterCode || '',
    cashSessionRequired: result.cashSessionRequired === true,
    idempotent: options.idempotent === true,
    reused: options.reused === true,
  };
}

async function loadReusedPosSale(orderId, req) {
  const order = await Order.findById(orderId);

  if (!order || order.source !== 'pos') {
    throw createRouteError(
      'La venta protegida no pudo recuperarse.',
      'POS_IDEMPOTENCY_ORDER_NOT_FOUND',
      409
    );
  }

  assertPosBranchAccess(req, order.branch, { requireSell: true });

  const [branch, cashSession] = await Promise.all([
    Branch.findById(order.branch),
    order.cashSession ? CashSession.findById(order.cashSession) : null,
  ]);

  return {
    order,
    movements: [],
    branch: branch || {
      _id: order.branch,
      ...(order.branchSnapshot || {}),
    },
    cashSession,
    cashRegisterCode:
      cashSession?.cashRegisterCode || order.pos?.registerCode || '',
    cashSessionRequired:
      branch?.settings?.requireCashSessionForPos === true,
  };
}

function sendError(res, error) {
  const status = Number(error?.statusCode || error?.status || 500);

  if (status >= 500) {
    console.error('[adminPosRoutes] Error:', error);
  }

  return res.status(status).json({
    ok: false,
    error: error?.code || 'POS_ROUTE_ERROR',
    message: error?.message || 'No se pudo procesar la solicitud POS.',
    details: error?.details || {},
  });
}

function createRouteError(message, code, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

async function loadBillingInfo() {
  const settings = await SiteSettings.findOne().select('billing').lean();
  const dian = settings?.billing?.dian || {};
  const electronicProvider = settings?.billing?.electronicProvider || {};

  return {
    electronicBillingActive:
      dian?.enabled === true &&
      String(dian?.mode || 'internal').trim().toLowerCase() !== 'internal' &&
      String(electronicProvider?.provider || 'mock').trim().toLowerCase() !== 'mock',
    dianMode: dian?.mode || 'internal',
    provider: electronicProvider?.provider || 'mock',
  };
}

async function loadPosBranch(req, branchId) {
  const cleanBranchId = cleanText(branchId || req.adminDefaultBranch || '');

  if (!cleanBranchId || !mongoose.Types.ObjectId.isValid(cleanBranchId)) {
    throw createRouteError(
      'Debes seleccionar una sede válida para buscar productos POS.',
      'POS_BRANCH_REQUIRED',
      400,
      { branchId: cleanBranchId }
    );
  }

  const branch = await Branch.findOne(
    buildPosBranchFilter(req, {
      _id: cleanBranchId,
      'settings.allowPosSales': true,
    }, { requestedBranchId: cleanBranchId })
  ).lean();

  if (!branch) {
    throw createRouteError(
      'La sede seleccionada no está habilitada para ventas POS o no tienes acceso.',
      'POS_BRANCH_NOT_AVAILABLE',
      404,
      { branchId: cleanBranchId }
    );
  }

  return branch;
}

async function buildProductSearchFilter(searchText) {
  const filter = {
    active: { $ne: false },
    visible: { $ne: false },
    price: { $gt: 0 },
  };

  if (!searchText) return filter;

  const regex = new RegExp(escapeRegex(searchText), 'i');

  return {
    ...filter,
    $or: [
      { title: regex },
      { sku: regex },
      { barcode: regex },
      { category: regex },
      { categories: regex },
    ],
  };
}

router.use(requireAdmin);

router.get('/bootstrap', requirePermission('pos:view'), async (req, res) => {
  try {
    const branches = await Branch.find(
      buildPosBranchFilter(req, {
        'settings.allowPosSales': true,
      })
    )
      .sort({ isMain: -1, isDefaultForOnlineOrders: -1, name: 1 })
      .lean();

    const serializedBranches = branches.map(serializeBranch);
    const defaultBranchId = String(req.adminDefaultBranch || '');
    const defaultBranch =
      serializedBranches.find((branch) => branch.id === defaultBranchId) ||
      serializedBranches.find((branch) => branch.isMain) ||
      serializedBranches[0] ||
      null;

    const billing = await loadBillingInfo();

    return res.json({
      ok: true,
      branches: serializedBranches,
      defaultBranch,
      paymentMethods: POS_PAYMENT_METHODS.map((method) => ({
        key: method,
        label:
          method === 'cash'
            ? 'Efectivo'
            : method === 'transfer'
              ? 'Transferencia'
              : method === 'card'
                ? 'Tarjeta / Datáfono'
                : method === 'mixed'
                  ? 'Pago mixto'
                  : 'Otro',
      })),
      permissions: {
        canView: hasPermission(req, 'pos:view'),
        canSell: hasPermission(req, 'pos:sell'),
        canDiscount: hasPermission(req, 'pos:discount'),
        canApproveDiscount: hasPermission(req, 'pos:discount:approve'),
        canReceipt: hasPermission(req, 'pos:receipt'),
        canManageOrders: hasPermission(req, 'orders:view'),
        canUpdateOrderStatus: hasPermission(req, 'orders:status'),
        canRefundOrders: hasPermission(req, 'orders:refund'),
      },
      billing,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/held-sales', requirePermission('pos:view'), async (req, res) => {
  try {
    const branchId = cleanText(req.query.branchId || '');
    const access = buildPosResourceAccess(req, {
      requestedBranchId: branchId,
    });
    const sales = await listHeldSales({
      branchIds: access.branchIds,
      branchId,
      q: req.query.q,
      limit: req.query.limit,
    });

    return res.json({
      ok: true,
      heldSales: sales,
      total: sales.length,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/held-sales', requirePermission('pos:sell'), async (req, res) => {
  try {
    const branchId = cleanText(req.body?.branchId || '');
    assertPosBranchAccess(req, branchId, { requireSell: true });
    const heldSale = await createHeldSale(req.body || {}, {
      admin: buildAdminContext(req),
    });

    return res.status(201).json({ ok: true, heldSale });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/held-sales/:id/open', requirePermission('pos:sell'), async (req, res) => {
  try {
    const access = buildPosResourceAccess(req, { requireSell: true });
    const heldSale = await touchHeldSale(req.params.id, {
      branchIds: access.branchIds,
    });

    return res.json({ ok: true, heldSale });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/held-sales/:id/close', requirePermission('pos:sell'), async (req, res) => {
  try {
    const access = buildPosResourceAccess(req, { requireSell: true });
    const heldSale = await closeHeldSale(req.params.id, {
      reason: req.body?.reason,
      orderId: req.body?.orderId,
      branchIds: access.branchIds,
    });

    return res.json({ ok: true, heldSale });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/sales/history', requirePermission('pos:view'), async (req, res) => {
  try {
    const branchId = cleanText(req.query.branchId || '');
    const access = buildPosResourceAccess(req, {
      requestedBranchId: branchId,
    });
    const sales = await listPosSalesHistory({
      branchIds: access.branchIds,
      branchId,
      q: req.query.q,
      limit: req.query.limit,
    });

    return res.json({
      ok: true,
      sales,
      total: sales.length,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/shift-summary', requirePermission('pos:view'), async (req, res) => {
  try {
    const branchId = cleanText(req.query.branchId || '');
    const [branch, billing] = await Promise.all([
      loadPosBranch(req, branchId),
      loadBillingInfo(),
    ]);
    const access = buildPosResourceAccess(req, {
      requestedBranchId: branchId,
    });
    const report = await buildPosShiftSummary({
      branch,
      branchIds: access.branchIds,
      range: req.query.range,
      cashRegisterCode: req.query.cashRegisterCode || 'CAJA POS',
      billingActive: billing.electronicBillingActive,
    });

    return res.json({ ok: true, report });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/products', requirePermission('pos:view'), async (req, res) => {
  try {
    const q = cleanText(req.query.q || '').slice(0, 120);
    const limit = toPositiveInt(req.query.limit, 30, 60);
    const branch = await loadPosBranch(req, req.query.branchId);
    const productFilter = await buildProductSearchFilter(q);
    const products = await Product.find(productFilter)
      .select('title sku barcode price image images category categories active visible')
      .sort(q ? { title: 1 } : { updatedAt: -1 })
      .limit(q ? 80 : 120)
      .lean();
    const productIds = products.map((product) => product._id);

    if (productIds.length === 0) {
      return res.json({
        ok: true,
        query: q,
        branch: serializeBranch(branch),
        products: [],
        total: 0,
      });
    }

    const stockRows = await InventoryStock.find({
      branch: branch._id,
      product: { $in: productIds },
      active: true,
      deletedAt: null,
    })
      .populate({
        path: 'product',
        select: 'title sku barcode price image images category categories active visible',
      })
      .sort({ availableStock: -1, lastMovementAt: -1, updatedAt: -1 })
      .limit(limit * 3)
      .lean();

    const rows = stockRows
      .filter((row) => getAvailableStock(row) > 0)
      .filter((row) => row.product && row.product.active !== false && row.product.visible !== false)
      .map((row) => serializePosProduct(row, branch))
      .filter((row) => Number(row.price || 0) > 0)
      .slice(0, limit);

    return res.json({
      ok: true,
      query: q,
      branch: serializeBranch(branch),
      products: rows,
      total: rows.length,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/sales/preview', requirePermission('pos:view'), async (req, res) => {
  try {
    const preview = await preparePosSalePreview(req.body || {});

    assertPosBranchAccess(req, preview.branch?._id);
    validateDiscountAuthorization({
      normalizedPayload: preview,
      admin: buildAdminContext(req),
    });

    return res.json({
      ok: true,
      preview: serializePreview(preview),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/sales', requirePermission('pos:sell'), async (req, res) => {
  try {
    const admin = buildAdminContext(req);
    const idempotency = buildPosSaleIdempotency({
      key: req.headers['idempotency-key'],
      payload: req.body || {},
      admin,
    });
    const existing = await inspectPosSaleIdempotency(idempotency);

    if (existing.action === 'conflict') {
      throw createRouteError(
        existing.message,
        'POS_IDEMPOTENCY_CONFLICT',
        409
      );
    }

    if (existing.action === 'in_progress') {
      throw createRouteError(
        'La misma venta todavía está siendo procesada. Reintenta en unos segundos con la misma clave.',
        'POS_IDEMPOTENT_IN_PROGRESS',
        409
      );
    }

    if (existing.action === 'reuse') {
      const reusedResult = await loadReusedPosSale(existing.orderId, req);
      return res.status(200).json(
        serializePosSaleResult(reusedResult, {
          idempotent: true,
          reused: true,
        })
      );
    }

    const preview = await preparePosSalePreview(req.body || {});

    assertPosBranchAccess(req, preview.branch?._id, { requireSell: true });
    validateDiscountAuthorization({ normalizedPayload: preview, admin });

    const result = await createPosSaleWithCashSession(req.body || {}, {
      admin,
      idempotency,
    });

    return res.status(201).json(serializePosSaleResult(result));
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
