const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const requireAdmin = require('../middleware/requireAdmin');
const {
  buildVariantKey,
  resolveVariantCommercialSnapshot,
} = require('../lib/products/productVariantConfig');

const { isValidObjectId } = mongoose;

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

/* -------------------------------------------------------
 * Helpers
 * ----------------------------------------------------- */

function clean(value) {
  return String(value || '').trim();
}

function cleanLower(value) {
  return clean(value).toLowerCase();
}

function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  return {
    variantKey: variantKey || buildVariantKey(size, color),
    size,
    color,
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
    const color = String(raw?.color || '').trim();
    const size = String(raw?.size || '').trim();
    const variantId = readVariantId(raw);

    const qtyNum = Number(raw?.qty ?? raw?.quantity ?? raw?.qtyNumber ?? 0);
    const qty = Number.isFinite(qtyNum) ? Math.max(0, Math.floor(qtyNum)) : 0;

    const price = readUnitPrice(raw);

    if (!idStr) continue;
    if (qty <= 0) continue;

    const dedupeKey = `${idStr}|||${color}|||${size}|||${variantId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    out.push({
      _id: idStr,               // <-- clave: guardamos `_id` (Mongoose castea a ObjectId)
      title,
      image,
      price,
      color,
      size,
      variantId,
      variantKey: variantId,
      qty,
      quantity: qty, // compatibilidad
    });

    if (out.length >= 300) break;
  }
  return out;
}

// Populate manual, TOLERANTE: nunca lanza; añade `product` sin tocar `_id`
async function safePopulateItems(items) {
  try {
    const arr = Array.isArray(items) ? items : [];
    const validIds = [];
    for (const it of arr) {
      const rawId = it?._id;
      const idStr = rawId && typeof rawId === 'object' ? (rawId._id || rawId.id) : rawId;
      if (idStr && isValidObjectId(String(idStr))) validIds.push(String(idStr));
    }

    if (validIds.length === 0) return arr.map((it) => ({ ...it, product: null }));

    const products = await Product.find({ _id: { $in: validIds } })
      .select('title price image images slug sku barcode category inventory stock visible active trackInventory allowBackorder variants')
      .populate({ path: 'category', select: 'name' })
      .lean()
      .exec();

    const map = new Map(products.map((p) => [String(p._id), p]));
    return arr.map((it) => {
      const rawId = it?._id;
      const idStr = rawId && typeof rawId === 'object' ? (rawId._id || rawId.id) : rawId;
      const key = idStr ? String(idStr) : null;
      const pdoc = key && map.get(key) ? map.get(key) : null;
      return { ...it, product: pdoc || null };
    });
  } catch (err) {
    console.error('safePopulateItems fallback (sin populate):', err?.message || err);
    return Array.isArray(items) ? items.map((it) => ({ ...it, product: null })) : [];
  }
}

function getCartSummary(cartDoc) {
  const items = Array.isArray(cartDoc.items) ? cartDoc.items : [];
  let totalItems = 0;
  let subtotal = 0;

  for (const it of items) {
    const qty = Number(it?.qty ?? it?.quantity ?? 0);
    totalItems += qty;

    const priceFromCart = Number(it?.price || 0);
    const priceFromProduct = Number(it?.product?.price || 0);
    const unitPrice =
      priceFromCart > 0 ? priceFromCart : (priceFromProduct > 0 ? priceFromProduct : 0);

    subtotal += qty * unitPrice;
  }
  return { totalItems, subtotal };
}

function computeAvailableStockTotal(p) {
  if (!p) return 0;
  if (Array.isArray(p.inventory) && p.inventory.length) {
    return p.inventory.reduce(
      (acc, r) => acc + Number(r?.stock ?? r?.qty ?? r?.quantity ?? 0),
      0
    );
  }
  return Number(p?.stock ?? 0);
}

function computeAvailableStockForVariant(p, color, size) {
  if (!p) return 0;
  const c = String(color || '');
  const s = String(size || '');
  if (!Array.isArray(p.inventory) || p.inventory.length === 0) {
    return Number(p?.stock ?? 0);
  }
  // Coincidencia exacta, case-insensitive
  const rxC = new RegExp(`^${escapeRegex(c)}$`, 'i');
  const rxS = new RegExp(`^${escapeRegex(s)}$`, 'i');
  const v = p.inventory.find(
    (row) => rxC.test(String(row?.color || '')) && rxS.test(String(row?.size || ''))
  );
  if (!v) return 0;
  return Number(v?.stock ?? v?.qty ?? v?.quantity ?? 0);
}

async function computeAvailableStockForCartItem(p, item) {
  if (!p) return Infinity;
  if (p.trackInventory === false || p.allowBackorder === true) return Infinity;

  const selector = getVariantSelector(item);
  const byVariant = Boolean(clean(selector.variantKey)) || Boolean(clean(item.color)) || Boolean(clean(item.size));

  if (selector.variantKey && selector.variantKey !== 'default__default') {
    const stockRow = await InventoryStock.findOne({
      product: p._id,
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
      return Math.max(0, Number(stockRow.stock || 0) - Number(stockRow.reservedStock || 0));
    }
  }

  return byVariant
    ? computeAvailableStockForVariant(p, item.color, item.size)
    : computeAvailableStockTotal(p);
}

function resolveCartCommercialSnapshot(p, item) {
  if (!p) {
    return {
      price: Math.max(0, Number(item.price || 0)),
      image: item.image || '',
      sku: '',
      barcode: '',
      variantKey: readVariantId(item),
    };
  }

  const selector = getVariantSelector(item);
  return resolveVariantCommercialSnapshot(p, selector);
}

/* ============================
 * POST /api/cart
 * ============================ */
router.post('/', rateLimit, async (req, res) => {
  const { sessionId, items, userId, userName, userEmail } = req.body;

  if (!sessionId || !Array.isArray(items)) {
    return res.status(400).json({
      message: 'Datos inválidos. Se requiere sessionId y lista de items.',
    });
  }

  try {
    const safeItems = sanitizeCartItems(items);

    // Idempotente por sessionId: si existe, actualiza; si no, crea
    const existing = await Cart.findOne({ sessionId }).exec();
    if (existing) {
      existing.items = safeItems;
      if (userId) existing.userId = userId;
      if (userName) existing.userName = userName;
      if (userEmail) existing.userEmail = userEmail;
      await existing.save();
      return res.status(200).json({
        message: 'Carrito actualizado exitosamente',
        cart: existing,
      });
    }

    const newCart = new Cart({
      sessionId,
      items: safeItems,
      ...(userId ? { userId } : {}),
      ...(userName ? { userName } : {}),
      ...(userEmail ? { userEmail } : {}),
    });

    await newCart.save();

    res.status(201).json({
      message: 'Carrito creado exitosamente',
      cart: newCart,
    });
  } catch (error) {
    console.error('Error al guardar carrito:', error);
    res.status(500).json({ message: 'Error al guardar el carrito en la base de datos' });
  }
});

/* =====================================================
 * GET /api/cart/admin
 * - ?format=csv
 * - ?populate=1
 * ===================================================== */
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const q = String(req.query.q || '').trim();
    const populate = String(req.query.populate || '0') === '1';
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

    let data;
    if (populate) {
      const out = [];
      for (const c of carts) {
        let itemsPop = c.items || [];
        try {
          itemsPop = await safePopulateItems(c.items);
        } catch (_) { /* fallback ya en helper */ }
        const summary = getCartSummary({ items: itemsPop });
        out.push({
          ...c,
          items: itemsPop,
          itemsCount: Array.isArray(c.items) ? c.items.length : 0,
          summary,
          totalItems: summary.totalItems,
          subtotal: summary.subtotal,
        });
      }
      data = out;
    } else {
      data = carts.map((c) => {
        const summary = getCartSummary(c);
        return {
          ...c,
          itemsCount: Array.isArray(c.items) ? c.items.length : 0,
          summary,
          totalItems: summary.totalItems,
          subtotal: summary.subtotal,
        };
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

/* ============================
 * GET /api/cart/:sessionId
 * ============================ */
router.get('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const populate = String(req.query.populate || '0') === '1';

  try {
    const cart = await Cart.findOne({ sessionId }).lean().exec();
    if (!cart) {
      return res.status(404).json({ message: 'No se encontró carrito para esta sesión.' });
    }

    let items = cart.items || [];
    if (populate) {
      try {
        items = await safePopulateItems(items);
      } catch (_) { /* fallback ya en helper */ }
    }
    const summary = getCartSummary({ items });

    res.status(200).json({ ...cart, items, summary });
  } catch (error) {
    console.error('Error al obtener carrito:', error);
    res.status(500).json({ message: 'Error interno al obtener el carrito.' });
  }
});

/**
 * ========================================
 * PUT /api/cart/:sessionId  (upsert)
 * ========================================
 */
router.put('/:sessionId', rateLimit, async (req, res) => {
  const { sessionId } = req.params;
  const { items, userId, userName, userEmail } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ message: 'La lista de items es inválida o no existe.' });
  }

  try {
    const ifMatch = req.headers['if-match-updated-at'] || req.query.ifMatchUpdatedAt || null;
    const safeItems = sanitizeCartItems(items);

    if (ifMatch) {
      const current = await Cart.findOne({ sessionId }).select('updatedAt').exec();
      if (
        current &&
        current.updatedAt &&
        new Date(ifMatch).getTime() !== new Date(current.updatedAt).getTime()
      ) {
        return res.status(409).json({
          message: 'El carrito cambió en el servidor. Refresca y vuelve a intentar.',
          serverUpdatedAt: current.updatedAt,
        });
      }
    }

    const setObj = { items: safeItems };
    if (userId) setObj.userId = userId;
    if (userName) setObj.userName = userName;
    if (userEmail) setObj.userEmail = userEmail;

    const updatedCart = await Cart.findOneAndUpdate(
      { sessionId },
      { $set: setObj, $currentDate: { updatedAt: true } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    let itemsPop = updatedCart.items || [];
    try {
      itemsPop = await safePopulateItems(itemsPop);
    } catch (_) { /* fallback */ }
    const summary = getCartSummary({ items: itemsPop });

    res.status(200).json({
      message: 'Carrito actualizado o creado correctamente',
      cart: { ...updatedCart, items: itemsPop, summary },
    });
  } catch (error) {
    console.error('Error al actualizar carrito:', error);
    res.status(500).json({ message: 'Error interno al actualizar el carrito' });
  }
});

/* ============================
 * DELETE /api/cart/:sessionId
 * ============================ */
router.delete('/:sessionId', rateLimit, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const result = await Cart.findOneAndDelete({ sessionId });
    if (!result) {
      return res.status(404).json({ message: 'No se encontró carrito para esta sesión.' });
    }
    res.status(200).json({ message: 'Carrito eliminado correctamente' });
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
router.post('/validate', async (req, res) => {
  try {
    const { sessionId, items, mode } = req.body || {};
    const strict = String(mode || 'soft') === 'strict';

    let sourceItems = [];

    if (sessionId) {
      const cart = await Cart.findOne({ sessionId }).lean().exec();

      if (cart && Array.isArray(cart.items)) {
        sourceItems = cart.items;
      } else if (Array.isArray(items) && items.length > 0) {
        sourceItems = items;
      } else {
        return res
          .status(404)
          .json({ message: 'Carrito no encontrado para validar y no se enviaron items.' });
      }
    } else if (Array.isArray(items) && items.length > 0) {
      sourceItems = items;
    } else {
      return res.status(400).json({ message: 'Debes enviar sessionId o items para validar.' });
    }

    const sanitized = sanitizeCartItems(sourceItems);
    let populated = sanitized;
    try {
      populated = await safePopulateItems(sanitized);
    } catch (_) { /* fallback */ }

    const validated = [];
    const adjustments = [];
    for (const it of populated) {
      const p = it.product || null;
      const commercial = resolveCartCommercialSnapshot(p, it);

      const currentPrice = Math.max(0, Number(commercial?.price ?? p?.price ?? it.price ?? 0));
      const visible = p ? (p.visible !== false && p.active !== false) : true;
      const available = await computeAvailableStockForCartItem(p, it);
      const byVariant = Boolean(readVariantId(it)) || String(it.color || '').length > 0 || String(it.size || '').length > 0;

      let finalQty = Number(it.qty || 0);
      const note = [];

      if (!visible) {
        finalQty = 0;
        note.push('producto no visible');
      }

      if (available <= 0) {
        finalQty = 0;
        note.push(byVariant ? 'sin stock para la variante' : 'sin stock');
      } else if (Number.isFinite(available) && finalQty > available) {
        if (strict) {
          finalQty = 0;
          note.push(byVariant ? 'supera stock de la variante (strict)' : 'cantidad supera stock (strict)');
        } else {
          finalQty = available;
          note.push(byVariant ? `cantidad ajustada a stock de la variante (${available})` : `cantidad ajustada a stock (${available})`);
        }
      }

      const finalItem = {
        ...it,
        variantId: readVariantId(it) || commercial?.variantKey || '',
        variantKey: readVariantId(it) || commercial?.variantKey || '',
        variantSku: commercial?.sku || '',
        variantBarcode: commercial?.barcode || '',
        image: commercial?.image || it.image || p?.image || '',
        price: currentPrice,
        qty: finalQty,
        quantity: finalQty,
      };
      validated.push(finalItem);

      if (note.length || Number(it.price || 0) !== currentPrice) {
        adjustments.push({
          productId: String(it._id),
          variantId: finalItem.variantId,
          requestedQty: it.qty,
          finalQty,
          price: currentPrice,
          previousPrice: Number(it.price || 0),
          note: note.join('; ') || 'precio actualizado desde variante',
        });
      }
    }

    const itemsForSummary = strict ? validated.filter((i) => i.qty > 0) : validated;
    const summary = getCartSummary({ items: itemsForSummary });

    res.status(200).json({
      ok: true,
      mode: strict ? 'strict' : 'soft',
      items: validated,
      adjustments,
      summary,
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
  try {
    const { fromSessionId, toUserId, toSessionId, strategy } = req.body || {};
    if (!fromSessionId || !toUserId) {
      return res.status(400).json({ message: 'fromSessionId y toUserId son requeridos.' });
    }

    const anon = await Cart.findOne({ sessionId: fromSessionId }).lean().exec();
    const userCartId = toSessionId
      ? { $or: [{ userId: toUserId }, { sessionId: toSessionId }] }
      : { userId: toUserId };
    let userCart = await Cart.findOne(userCartId).lean().exec();

    if (!anon && !userCart) {
      const created = await Cart.findOneAndUpdate(
        { userId: toUserId },
        {
          $setOnInsert: {
            sessionId: toSessionId || `sess_${toUserId}_${Date.now()}`,
            items: [],
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean();
      return res
        .status(200)
        .json({ message: 'Nada para fusionar. Carrito de usuario listo.', cart: created });
    }

    const baseItems = Array.isArray(userCart?.items) ? userCart.items : [];
    const incoming = Array.isArray(anon?.items) ? anon.items : [];

    const map = new Map();
    const makeKey = (it) =>
      `${String(it._id)}|||${it.color || ''}|||${it.size || ''}|||${it.variantId || ''}`;

    for (const it of sanitizeCartItems(baseItems)) {
      map.set(makeKey(it), { ...it });
    }

    const mode = strategy || 'sum';
    for (const it of sanitizeCartItems(incoming)) {
      const k = makeKey(it);
      const exists = map.get(k);
      if (!exists) {
        map.set(k, { ...it });
      } else {
        if (mode === 'preferIncoming') {
          map.set(k, { ...it });
        } else if (mode === 'preferExisting') {
          // deja "exists"
        } else {
          const qty = Math.max(0, Number((exists.qty || 0) + (it.qty || 0)));
          map.set(k, {
            ...exists,
            qty,
            quantity: qty,
            price: it.price || exists.price || 0,
            title: it.title || exists.title,
            image: it.image || exists.image,
          });
        }
      }
    }

    const mergedItems = Array.from(map.values());
    const updatedCart = await Cart.findOneAndUpdate(
      userCart ? { _id: userCart._id } : { userId: toUserId },
      { $set: { items: mergedItems, userId: toUserId }, $currentDate: { updatedAt: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    if (anon) await Cart.deleteOne({ _id: anon._id });

    let itemsPop = updatedCart.items || [];
    try {
      itemsPop = await safePopulateItems(itemsPop);
    } catch (_) { /* fallback */ }
    const summary = getCartSummary({ items: itemsPop });

    res.status(200).json({
      message: 'Carritos fusionados correctamente',
      cart: { ...updatedCart, items: itemsPop, summary },
    });
  } catch (error) {
    console.error('Error al fusionar carritos:', error);
    res.status(500).json({ message: 'Error al fusionar carritos.' });
  }
});

module.exports = router;
