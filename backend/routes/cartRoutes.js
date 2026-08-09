const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const requireAdmin = require('../middleware/requireAdmin');
const {
  buildVariantKey,
  normalizeAttributes,
  resolveVariantCommercialSnapshot,
  resolveVariantIdentity,
} = require('../lib/products/productVariantConfig');
const {
  getBundleAvailableQuantity,
} = require('../services/productBundleService');
const {
  SAFE_CART_ACCESS_ERROR,
  getCartAccessFromRequest,
  getCartAccessSecret,
  isValidCartAccessToken,
  isValidCartSessionId,
  issueCartAccess,
  stripCartSecrets,
  verifyCartAccess,
} = require('../services/cartAccessService');
const {
  defaultCartCanonicalValidationService,
  toStoredCartItem,
} = require('../services/cartCanonicalValidationService');
const {
  createCartRecoveryService,
} = require('../services/cartRecoveryService');
const cartAdminRoutes = require('./cartAdminRoutes');

/* -------------------------------------------------------
 * RATE LIMIT LIGERO (en memoria) para mutaciones
 * ----------------------------------------------------- */
const RL_WINDOW_MS = 10_000; // 10s
const RL_MAX_HITS = 40;      // 40 requests / 10s por IP
const rlBucket = new Map();  // ip -> { count, resetAt }
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

function sendCartAccessNotFound(res) {
  return res.status(404).json(SAFE_CART_ACCESS_ERROR);
}

const CART_VERSION_HEADER = 'if-match-updated-at';

function cartVersionOf(cart) {
  if (!cart?.updatedAt) return '';
  const date = new Date(cart.updatedAt);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function readExpectedCartVersion(req) {
  const raw = clean(req?.headers?.[CART_VERSION_HEADER]);
  if (!raw) return { ok: false, reason: 'missing', value: '' };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== raw) {
    return { ok: false, reason: 'invalid', value: '' };
  }
  return { ok: true, reason: '', value: raw, date };
}

function sendCartVersionPrecondition(res, reason) {
  return res.status(428).json({
    ok: false,
    error: reason === 'invalid'
      ? 'CART_VERSION_INVALID'
      : 'CART_VERSION_REQUIRED',
    message: 'Debes enviar la version exacta y vigente del carrito.',
  });
}

function authorizedCartVersionFilter(cart, sessionId, expectedVersion) {
  return {
    _id: cart._id,
    sessionId,
    accessTokenHash: cart.accessTokenHash,
    accessVersion: cart.accessVersion,
    updatedAt: expectedVersion,
  };
}

function getCanonicalValidationService(req) {
  return req?.app?.locals?.cartCanonicalValidationService ||
    defaultCartCanonicalValidationService;
}

function getCartRecoveryService(req) {
  return req?.app?.locals?.cartRecoveryService || createCartRecoveryService();
}

function sendInvalidCartItems(res, validation) {
  return res.status(409).json({
    ok: false,
    error: 'CART_ITEMS_INVALID',
    message: 'El carrito contiene productos que no pueden comprarse.',
    items: validation.invalidItems,
  });
}

async function buildPublicCartResponse(
  cart,
  { canonicalService = defaultCartCanonicalValidationService } = {}
) {
  const plain = stripCartSecrets(cart);
  for (const field of [
    'adminTags',
    'adminNotes',
    'recoveryAttempts',
    'recoveryAccess',
    'lastAdminActivityAt',
    'lastRecoveryAttemptAt',
    'lastRecoveryEmailAt',
    'convertedOrderId',
    'convertedAt',
  ]) {
    delete plain[field];
  }
  const validation = await canonicalService.validateItems(
    Array.isArray(plain?.items) ? plain.items : [],
    { mode: 'soft' }
  );
  const items = await ensureProductContractFields(validation.items);
  const summaryItems = items.filter((item) => item.valid);
  return {
    ...plain,
    version: cartVersionOf(plain),
    items,
    valid: validation.ok,
    invalidItems: validation.invalidItems,
    summary: getCartSummary({ items: summaryItems }),
  };
}

async function sendCartWriteConflict(req, res, cart) {
  const current = await Cart.findOne({
    _id: cart._id,
    sessionId: cart.sessionId,
    accessTokenHash: cart.accessTokenHash,
    accessVersion: cart.accessVersion,
  })
    .select('+accessTokenHash +accessVersion +accessIssuedAt')
    .exec();

  if (!current) return sendCartAccessNotFound(res);
  const publicCart = await buildPublicCartResponse(current, {
    canonicalService: getCanonicalValidationService(req),
  });
  return res.status(409).json({
    ok: false,
    error: 'CART_WRITE_CONFLICT',
    message: 'El carrito cambio en otra pestana. Se conservo la version del servidor.',
    version: publicCart.version,
    cart: publicCart,
  });
}

async function loadAuthorizedCart(req, requestedSessionId) {
  const credentials = getCartAccessFromRequest(req);
  const safeRequestedSessionId = clean(requestedSessionId);
  if (
    !credentials.sessionId ||
    credentials.sessionId !== safeRequestedSessionId ||
    !credentials.token ||
    !isValidCartSessionId(safeRequestedSessionId) ||
    !isValidCartAccessToken(credentials.token)
  ) {
    return null;
  }

  const cart = await Cart.findOne({ sessionId: safeRequestedSessionId })
    .select('+accessTokenHash +accessVersion +accessIssuedAt')
    .exec();
  if (!cart) return null;

  return verifyCartAccess({
    cart,
    sessionId: credentials.sessionId,
    token: credentials.token,
    secret: getCartAccessSecret(),
  })
    ? cart
    : null;
}

/* -------------------------------------------------------
 * Helpers
 * ----------------------------------------------------- */

function clean(value) {
  return String(value || '').trim();
}

function cleanLower(value) {
  return clean(value).toLowerCase();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Obtiene un id de producto robusto desde varias formas comunes
function readProductId(raw) {
  const p = raw?.product ?? raw;
  const candidates = [
    raw?._id,
    raw?.id,
    raw?.productId, // compatibilidad de entrada
    p?._id,
    p?.id,
  ]
    .map((v) => (typeof v === 'object' && v ? v._id || v.id : v))
    .filter(Boolean);

  return String(candidates[0] || '').trim();
}

function readVariantId(raw = {}) {
  return clean(raw.variantId || raw.variantKey || raw.selectedVariantId || raw.selectedVariantKey || '');
}

function getVariantSelector(raw = {}) {
  const variantKey = cleanLower(readVariantId(raw));
  const size = clean(raw.size || raw.talla || '');
  const color = clean(raw.rawColor || raw.colorValue || raw.color || '');
  const variantAttributes = normalizeAttributes(
    raw.variantAttributes || raw.attributes || raw.selectedAttributes || []
  );

  return {
    variantKey: variantKey || buildVariantKey(size, color, variantAttributes),
    size,
    color,
    variantAttributes,
  };
}

// Snapshot de precio robusto desde múltiples nombres
function readUnitPrice(raw) {
  const p = raw?.product ?? raw;
  const candidates = [
    raw?.price,
    raw?.unitPrice,
    raw?.priceNumber,
    p?.price,
  ].map((n) => Number(n));

  const v = candidates.find((n) => Number.isFinite(n) && n >= 0);
  return Math.max(0, Number(v || 0));
}

// Normaliza items (dedupe por _id+color+size+variantId) y **devuelve `_id`**
function sanitizeCartItems(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  const seen = new Set();

  for (const raw of items) {
    const idStr = readProductId(raw);
    const title = String(raw?.title || raw?.product?.title || '').trim();
    const image = String(raw?.image || raw?.product?.image || '').trim();
    const colorLabel = clean(raw?.colorLabel || raw?.color || '').slice(0, 80);
    const color = clean(
      raw?.colorValue || raw?.rawColor || raw?.color || ''
    ).slice(0, 80);
    const size = String(raw?.size || '').trim();
    const variantId = readVariantId(raw);
    const variantAttributes = normalizeAttributes(
      raw?.variantAttributes ||
        raw?.attributes ||
        raw?.selectedAttributes ||
        []
    );
    const identity = resolveVariantIdentity({
      variantKey: variantId,
      size,
      color,
      attributes: variantAttributes,
    });
    const variantKey = identity.variantKey;
    const variantLabel = clean(
      raw?.variantLabel || raw?.selectedVariant?.label || ''
    ).slice(0, 180);

    const qtyNum = Number(raw?.qty ?? raw?.quantity ?? raw?.qtyNumber ?? 0);
    const qty = Number.isFinite(qtyNum) ? Math.max(0, Math.floor(qtyNum)) : 0;

    const price = readUnitPrice(raw);

    if (!idStr) continue;
    if (qty <= 0) continue;

    const dedupeKey = `${idStr}|||${variantKey}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    out.push({
      _id: idStr,               // <-- clave: guardamos `_id` (Mongoose castea a ObjectId)
      title,
      image,
      price,
      color: identity.color,
      colorLabel,
      size: identity.size,
      variantId: variantKey,
      variantKey,
      variantLabel,
      variantAttributes: identity.attributes,
      qty,
      quantity: qty, // compatibilidad
    });

    if (out.length >= 300) break;
  }
  return out;
}

// Resume exclusivamente los renglones ya reconstruidos por la autoridad canonica.
function getCartSummary(cartDoc) {
  const items = Array.isArray(cartDoc.items) ? cartDoc.items : [];
  let totalItems = 0;
  let subtotal = 0;

  for (const it of items) {
    const rawQty = Number(it?.qty ?? it?.quantity ?? 0);
    const qty = Number.isFinite(rawQty) ? Math.max(0, rawQty) : 0;
    totalItems += qty;

    const rawPrice = Number(it?.price || 0);
    const unitPrice = Number.isFinite(rawPrice) ? Math.max(0, rawPrice) : 0;

    subtotal += qty * unitPrice;
  }
  return { totalItems, subtotal };
}

function computeAvailableStockTotal(product) {
  if (!product) return 0;
  if (Array.isArray(product.inventory) && product.inventory.length) {
    return product.inventory.reduce(
      (total, row) => total + Number(row?.stock ?? row?.qty ?? row?.quantity ?? 0),
      0
    );
  }
  return Number(product.stock ?? 0);
}

function computeAvailableStockForVariant(product, color, size) {
  if (!product) return 0;
  if (!Array.isArray(product.inventory) || product.inventory.length === 0) {
    return Number(product.stock ?? 0);
  }
  const colorPattern = new RegExp(`^${escapeRegex(color)}$`, 'i');
  const sizePattern = new RegExp(`^${escapeRegex(size)}$`, 'i');
  const row = product.inventory.find(
    (entry) =>
      colorPattern.test(String(entry?.color || '')) &&
      sizePattern.test(String(entry?.size || ''))
  );
  return Number(row?.stock ?? row?.qty ?? row?.quantity ?? 0);
}

async function computeAvailableStockForCartItem(product, item) {
  if (!product) return Infinity;
  if (product.productType === 'bundle') {
    return getBundleAvailableQuantity(product);
  }
  if (product.trackInventory === false || product.allowBackorder === true) {
    return Infinity;
  }

  const selector = getVariantSelector(item);
  const byVariant = Boolean(selector.variantKey) || Boolean(clean(item.color)) || Boolean(clean(item.size));
  if (selector.variantKey && selector.variantKey !== 'default__default') {
    const stockRow = await InventoryStock.findOne({
      product: product._id,
      variantKey: selector.variantKey,
      deletedAt: null,
      active: { $ne: false },
    })
      .select('stock reservedStock availableStock')
      .lean()
      .exec();
    if (stockRow) {
      const available = Number(stockRow.availableStock);
      if (Number.isFinite(available)) return Math.max(0, available);
      return Math.max(
        0,
        Number(stockRow.stock || 0) - Number(stockRow.reservedStock || 0)
      );
    }
  }

  return byVariant
    ? computeAvailableStockForVariant(product, item.color, item.size)
    : computeAvailableStockTotal(product);
}

function resolveCartCommercialSnapshot(product, item) {
  if (!product) {
    return {
      sku: '',
      barcode: '',
      variantKey: readVariantId(item),
    };
  }
  return resolveVariantCommercialSnapshot(product, getVariantSelector(item));
}

// La autoridad canonica ya entrega estos campos. Este fallback conserva el
// contrato comercial de Productos cuando se inyecta una autoridad compatible
// que no los proyecta, sin debilitar la validacion de CarritosAdmin.
async function ensureProductContractFields(items = []) {
  const source = Array.isArray(items) ? items : [];
  if (mongoose.connection.readyState !== 1) return source;
  const missing = source.filter(
    (item) =>
      item?.valid === true &&
      (!Object.hasOwn(item, 'variantSku') ||
        !Object.hasOwn(item, 'variantBarcode') ||
        !Object.hasOwn(item, 'availableStock'))
  );
  if (!missing.length) return source;

  const ids = Array.from(
    new Set(missing.map((item) => readProductId(item)).filter(mongoose.isValidObjectId))
  );
  if (!ids.length) return source;
  const products = await Product.find({ _id: { $in: ids } }).lean().exec();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  return Promise.all(source.map(async (item) => {
    const product = productMap.get(readProductId(item));
    if (!product || item?.valid !== true) return item;
    const commercial = resolveCartCommercialSnapshot(product, item);
    const availableStock = await computeAvailableStockForCartItem(product, item);
    return {
      ...item,
      variantSku: Object.hasOwn(item, 'variantSku')
        ? item.variantSku
        : commercial.sku || '',
      variantBarcode: Object.hasOwn(item, 'variantBarcode')
        ? item.variantBarcode
        : commercial.barcode || '',
      availableStock: Object.hasOwn(item, 'availableStock')
        ? item.availableStock
        : Number.isFinite(availableStock)
          ? Math.max(0, availableStock)
          : null,
    };
  }));
}

/* ============================
 * POST /api/cart
 * ============================ */
router.post('/', rateLimit, async (req, res) => {
  const { items, userId, userName, userEmail } = req.body || {};

  if (!Array.isArray(items)) {
    return res.status(400).json({
      message: 'Datos inválidos. Se requiere una lista de items.',
    });
  }

  try {
    const validation = await getCanonicalValidationService(req).validateItems(items, {
      mode: 'strict',
    });
    if (!validation.ok) return sendInvalidCartItems(res, validation);
    const safeItems = sanitizeCartItems(validation.items.map(toStoredCartItem));
    const cartId = new mongoose.Types.ObjectId();
    const access = issueCartAccess({
      cartId,
      secret: getCartAccessSecret(),
    });
    const newCart = new Cart({
      _id: cartId,
      sessionId: access.sessionId,
      accessTokenHash: access.tokenHash,
      accessVersion: access.version,
      accessIssuedAt: new Date(),
      lastCustomerActivityAt: new Date(),
      items: safeItems,
      ...(userId ? { userId } : {}),
      ...(userName ? { userName } : {}),
      ...(userEmail ? { userEmail } : {}),
    });

    await newCart.save();

    res.status(201).json({
      message: 'Carrito creado exitosamente',
      sessionId: access.sessionId,
      cartAccessToken: access.token,
      version: cartVersionOf(newCart),
      cart: stripCartSecrets(newCart),
    });
  } catch (error) {
    console.error('Error al crear carrito:', error?.code || error?.message);
    res.status(500).json({ message: 'Error al guardar el carrito en la base de datos' });
  }
});

/* =====================================================
 * GET /api/cart/admin
 * - ?format=csv
 * - ?populate=1
 * ===================================================== */
router.use('/admin', requireAdmin, cartAdminRoutes);

router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const q = String(req.query.q || '').trim();
    const format = String(req.query.format || '').toLowerCase();

    const filter = {};
    if (q) {
      filter.$or = [
        { sessionId: { $regex: q, $options: 'i' } },
        { userEmail: { $regex: q, $options: 'i' } },
        { userName: { $regex: q, $options: 'i' } },
      ];
    }

    const { dateFrom, dateTo } = req.query;
    if (dateFrom || dateTo) {
      filter.updatedAt = {};
      if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00.000Z`);
        if (!isNaN(from)) filter.updatedAt.$gte = from;
      }
      if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59.999Z`);
        if (!isNaN(to)) filter.updatedAt.$lte = to;
      }
      if (Object.keys(filter.updatedAt).length === 0) delete filter.updatedAt;
    }

    const total = await Cart.countDocuments(filter);

    const carts = await Cart.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    const canonicalService = getCanonicalValidationService(req);
    const data = [];
    for (const cart of carts) {
      const publicCart = await buildPublicCartResponse(cart, { canonicalService });
      data.push({
        ...publicCart,
        itemsCount: publicCart.items.length,
        totalItems: publicCart.summary.totalItems,
        subtotal: publicCart.summary.subtotal,
      });
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));

    if (format === 'csv') {
      const rows = [
        ['_id', 'sessionId', 'userName', 'userEmail', 'itemsCount', 'totalItems', 'subtotal', 'updatedAt', 'createdAt'].join(','),
      ];
      for (const c of data) {
        rows.push([
          JSON.stringify(c._id),
          JSON.stringify(c.sessionId),
          JSON.stringify(c.userName || ''),
          JSON.stringify(c.userEmail || ''),
          String(c.itemsCount || 0),
          String(c.totalItems || 0),
          String(c.subtotal || 0),
          JSON.stringify(c.updatedAt || ''),
          JSON.stringify(c.createdAt || ''),
        ].join(','));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="carts.csv"');
      return res.status(200).send(rows.join('\n'));
    }

    res.json({ page, limit, total, totalPages, data });
  } catch (error) {
    console.error('Error en /api/cart/admin:', error);
    res.status(500).json({ message: 'Error al listar carritos para admin' });
  }
});

/* Rutas administrativas explícitas: no sustituyen la prueba del comprador. */
router.get('/admin/:sessionId', requireAdmin, async (req, res) => {
  try {
    const cart = await Cart.findOne({ sessionId: req.params.sessionId }).lean().exec();
    if (!cart) return res.status(404).json({ message: 'Carrito no encontrado.' });
    const publicCart = await buildPublicCartResponse(cart, {
      canonicalService: getCanonicalValidationService(req),
    });
    return res.status(200).json(publicCart);
  } catch (error) {
    console.error('Error al obtener carrito administrativo:', error?.message);
    return res.status(500).json({ message: 'Error interno al obtener el carrito.' });
  }
});

router.put('/admin/:sessionId', requireAdmin, async (req, res) => {
  if (!Array.isArray(req.body?.items)) {
    return res.status(400).json({ message: 'La lista de items es inválida.' });
  }
  try {
    const validation = await getCanonicalValidationService(req).validateItems(
      req.body.items,
      { mode: 'strict' }
    );
    if (!validation.ok) return sendInvalidCartItems(res, validation);
    const setObj = {
      items: sanitizeCartItems(validation.items.map(toStoredCartItem)),
    };
    for (const field of ['userId', 'userName', 'userEmail']) {
      if (req.body?.[field]) setObj[field] = req.body[field];
    }
    const updated = await Cart.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { $set: setObj, $currentDate: { updatedAt: true } },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) return res.status(404).json({ message: 'Carrito no encontrado.' });
    const publicCart = await buildPublicCartResponse(updated, {
      canonicalService: getCanonicalValidationService(req),
    });
    return res.status(200).json({
      message: 'Carrito actualizado correctamente',
      cart: publicCart,
    });
  } catch (error) {
    console.error('Error al actualizar carrito administrativo:', error?.message);
    return res.status(500).json({ message: 'Error interno al actualizar el carrito.' });
  }
});

router.delete('/admin/:sessionId', requireAdmin, async (req, res) => {
  try {
    const deleted = await Cart.findOneAndDelete({ sessionId: req.params.sessionId });
    if (!deleted) return res.status(404).json({ message: 'Carrito no encontrado.' });
    return res.status(200).json({ message: 'Carrito eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar carrito administrativo:', error?.message);
    return res.status(500).json({ message: 'Error interno al eliminar el carrito.' });
  }
});

router.post('/recovery/claim', rateLimit, async (req, res) => {
  try {
    const claimed = await getCartRecoveryService(req).claim({
      sessionId: req.headers['x-session-id'],
      credential: req.headers['x-cart-recovery-token'],
    });
    if (!claimed) return sendCartAccessNotFound(res);
    const cart = await buildPublicCartResponse(claimed.cart, {
      canonicalService: getCanonicalValidationService(req),
    });
    return res.json({
      sessionId: claimed.sessionId,
      cartAccessToken: claimed.token,
      version: cart.version,
      cart,
    });
  } catch (error) {
    console.error('Error reclamando recuperacion del carrito:', error?.code || 'unknown');
    return sendCartAccessNotFound(res);
  }
});

/* ============================
 * GET /api/cart/:sessionId
 * ============================ */
router.get('/:sessionId', rateLimit, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const cartDocument = await loadAuthorizedCart(req, sessionId);
    if (!cartDocument) return sendCartAccessNotFound(res);
    const cart = await buildPublicCartResponse(cartDocument, {
      canonicalService: getCanonicalValidationService(req),
    });
    res.status(200).json(cart);
  } catch (error) {
    console.error('Error al obtener carrito:', error?.code || error?.message);
    res.status(500).json({ message: 'Error interno al obtener el carrito.' });
  }
});

/**
 * ========================================
 * PUT /api/cart/:sessionId
 * ========================================
 */
router.put('/:sessionId', rateLimit, async (req, res) => {
  const { sessionId } = req.params;
  const { items, userId, userName, userEmail } = req.body || {};

  try {
    const cart = await loadAuthorizedCart(req, sessionId);
    if (!cart) return sendCartAccessNotFound(res);
    const expectedVersion = readExpectedCartVersion(req);
    if (!expectedVersion.ok) {
      return sendCartVersionPrecondition(res, expectedVersion.reason);
    }
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'La lista de items es inválida o no existe.' });
    }
    const validation = await getCanonicalValidationService(req).validateItems(items, {
      mode: 'strict',
    });
    if (!validation.ok) return sendInvalidCartItems(res, validation);
    const safeItems = sanitizeCartItems(validation.items.map(toStoredCartItem));
    const set = { items: safeItems, lastCustomerActivityAt: new Date() };
    if (safeItems.length === 0) set['recoveryAccess.usedAt'] = new Date();
    if (userId) set.userId = userId;
    if (userName) set.userName = userName;
    if (userEmail) set.userEmail = userEmail;

    const updatedCart = await Cart.findOneAndUpdate(
      authorizedCartVersionFilter(cart, sessionId, expectedVersion.date),
      { $set: set, $currentDate: { updatedAt: true } },
      { new: true, runValidators: true, timestamps: false }
    )
      .select('+accessTokenHash +accessVersion +accessIssuedAt')
      .exec();

    if (!updatedCart) return sendCartWriteConflict(req, res, cart);
    const publicCart = await buildPublicCartResponse(updatedCart, {
      canonicalService: getCanonicalValidationService(req),
    });

    res.status(200).json({
      message: 'Carrito actualizado correctamente',
      version: publicCart.version,
      cart: publicCart,
    });
  } catch (error) {
    console.error('Error al actualizar carrito:', error?.code || error?.message);
    res.status(500).json({ message: 'Error interno al actualizar el carrito' });
  }
});

/* ============================
 * DELETE /api/cart/:sessionId
 * ============================ */
router.delete('/:sessionId', rateLimit, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const cart = await loadAuthorizedCart(req, sessionId);
    if (!cart) return sendCartAccessNotFound(res);
    const expectedVersion = readExpectedCartVersion(req);
    if (!expectedVersion.ok) {
      return sendCartVersionPrecondition(res, expectedVersion.reason);
    }
    const deleted = await Cart.findOneAndDelete(
      authorizedCartVersionFilter(cart, sessionId, expectedVersion.date)
    );
    if (!deleted) return sendCartWriteConflict(req, res, cart);
    res.status(200).json({
      message: 'Carrito eliminado correctamente',
      version: cartVersionOf(deleted),
    });
  } catch (error) {
    console.error('❌ Error al eliminar carrito:', error.message);
    res.status(500).json({ message: 'Error al eliminar el carrito en la base de datos' });
  }
});

/**
 * ========================================
 * POST /api/cart/validate
 * - Valida por variante avanzada si aplica
 * - Usa precio/imagen/SKU/barcode de Product.variants
 * - Usa InventoryStock real por variantKey para stock disponible
 * ========================================
 */
router.post('/validate', rateLimit, async (req, res) => {
  try {
    const { sessionId, items, mode } = req.body || {};
    const strict = String(mode || 'soft') === 'strict';

    let sourceItems = [];
    let cartVersion = '';

    if (sessionId) {
      const cart = await loadAuthorizedCart(req, sessionId);
      if (!cart) return sendCartAccessNotFound(res);
      sourceItems = Array.isArray(cart.items) ? cart.items : [];
      cartVersion = cartVersionOf(cart);
    } else if (Array.isArray(items) && items.length > 0) {
      sourceItems = items;
    } else {
      return res.status(400).json({ message: 'Debes enviar sessionId o items para validar.' });
    }

    const validation = await getCanonicalValidationService(req).validateItems(
      sourceItems,
      { mode: strict ? 'strict' : 'soft' }
    );
    const validated = validation.items;
    const adjustments = validation.adjustments;

    const itemsForSummary = validated.filter((item) => item.valid);
    const summary = getCartSummary({ items: itemsForSummary });

    res.status(200).json({
      ok: validation.ok,
      mode: strict ? 'strict' : 'soft',
      items: validated,
      adjustments,
      summary,
      version: cartVersion || undefined,
    });
  } catch (error) {
    console.error('Error en /api/cart/validate:', error);
    res.status(500).json({ message: 'Error validando carrito.' });
  }
});

/* =========================================
 * POST /api/cart/merge
 * ========================================= */
router.post('/merge', rateLimit, async (req, res) => {
  // Sin autenticación de clientes no existe una identidad segura para el
  // carrito de destino. La operación queda cerrada, sin consultar MongoDB.
  return sendCartAccessNotFound(res);
});

module.exports = router;
