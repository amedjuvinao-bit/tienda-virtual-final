const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Favorite = require('../models/Favorite');
const Product = require('../models/Product');
const requireAdmin = require('../middleware/requireAdmin');

const { isValidObjectId } = mongoose;

/* ============================
   Helpers
   ============================ */
function sanitizeFavoriteItems(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of items) {
    const productId = String(raw?.productId || '').trim();
    const title = String(raw?.title || '').trim();
    const image = String(raw?.image || '').trim();
    const color = String(raw?.color || '').trim();
    const size = String(raw?.size || '').trim();
    const price = Math.max(0, Number(raw?.price || 0));

    const dedupeKey = `${productId}|||${color}|||${size}`;
    if (!productId || seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    // No forzamos a ObjectId aquí; dejamos casting a nivel modelo si corresponde
    out.push({ productId, title, image, price, color, size });
    if (out.length >= 200) break;
  }
  return out;
}

function pickUpdatedOrCreated(doc) {
  return doc?.updatedAt || doc?.createdAt || null;
}

const PRODUCT_SELECT =
  'title price image slug sku category inventory stock visible';

/** Populate manual, tolerante a productId no-ObjectId.
 * Agrega `product` y conserva `productId` sin modificar.
 */
async function safePopulateItems(items, { withCategory = true } = {}) {
  const arr = Array.isArray(items) ? items : [];
  const validIds = [];
  for (const it of arr) {
    const pid = it?.productId;
    // si es objeto con _id válido, lo tomamos; si es string, validamos
    const rawId = pid && typeof pid === 'object' ? pid._id || pid.id : pid;
    if (rawId && isValidObjectId(String(rawId))) {
      validIds.push(String(rawId));
    }
  }

  let products = [];
  if (validIds.length > 0) {
    const prodQuery = Product.find({ _id: { $in: validIds } }).select(PRODUCT_SELECT);
    if (withCategory) {
      prodQuery.populate({ path: 'category', select: 'name' });
    }
    products = await prodQuery.lean().exec();
  }
  const map = new Map(products.map((p) => [String(p._id), p]));

  return arr.map((it) => {
    const pid = it?.productId;
    const rawId = pid && typeof pid === 'object' ? pid._id || pid.id : pid;
    const key = rawId ? String(rawId) : null;
    const pdoc = key && map.get(key) ? map.get(key) : null;

    // Agregamos `product` y conservamos `productId` tal cual
    return {
      ...it,
      product: pdoc || null,
    };
  });
}

/* =====================================================
   GET /api/favorites/admin  (lista admin con filtros)
   ===================================================== */
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;
    const q = String(req.query.q || '').trim();
    const populate = String(req.query.populate || '0') === '1';

    const filter = {};
    if (q) {
      filter.sessionId = { $regex: q, $options: 'i' };
    }

    const { dateFrom, dateTo } = req.query;
    if (dateFrom || dateTo) {
      const range = {};
      if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00.000Z`);
        if (!isNaN(from)) range.$gte = from;
      }
      if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59.999Z`);
        if (!isNaN(to)) range.$lte = to;
      }
      if (Object.keys(range).length) {
        filter.$or = [{ updatedAt: range }, { createdAt: range }];
      }
    }

    const total = await Favorite.countDocuments(filter);

    // obtenemos sin populate para evitar CastError
    const favs = await Favorite.find(filter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    // populate manual (solo si se pide)
    let data = favs;
    if (populate) {
      const out = [];
      for (const f of favs) {
        let itemsPop = f.items || [];
        try {
          itemsPop = await safePopulateItems(f.items, { withCategory: true });
        } catch (_) {}
        out.push({
          _id: f._id,
          sessionId: f.sessionId,
          itemsCount: Array.isArray(f.items) ? f.items.length : 0,
          lastUpdate: pickUpdatedOrCreated(f),
          items: itemsPop,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        });
      }
      data = out;
    } else {
      data = favs.map((f) => ({
        _id: f._id,
        sessionId: f.sessionId,
        itemsCount: Array.isArray(f.items) ? f.items.length : 0,
        lastUpdate: pickUpdatedOrCreated(f),
        items: f.items,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      }));
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));
    res.json({ page, limit, total, totalPages, data });
  } catch (error) {
    console.error('Error en /api/favorites/admin:', error);
    res.status(500).json({ message: 'Error al listar favoritos para admin' });
  }
});

/* ============================
   GET /api/favorites/:sessionId
   ============================ */
router.get('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const populate = String(req.query.populate || '0') === '1';

  try {
    // sin populate para evitar CastError
    const favorite = await Favorite.findOne({ sessionId }).lean().exec();

    if (!favorite) {
      return res
        .status(404)
        .json({ message: 'No se encontraron favoritos para esta sesión.' });
    }

    let items = favorite.items || [];
    if (populate) {
      try {
        items = await safePopulateItems(favorite.items, { withCategory: true });
      } catch (_) {}
    }

    const itemsCount = Array.isArray(items) ? items.length : 0;

    res.status(200).json({
      ...favorite,
      items,
      itemsCount,
      lastUpdate: pickUpdatedOrCreated(favorite),
    });
  } catch (error) {
    console.error('Error al obtener favoritos:', error);
    res.status(500).json({ message: 'Error interno al obtener favoritos.' });
  }
});

/* ============================
   PUT /api/favorites/:sessionId
   ============================ */
router.put('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { items } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ message: 'La lista de items es inválida.' });
  }

  try {
    const safeItems = sanitizeFavoriteItems(items);

    const updatedFavorites = await Favorite.findOneAndUpdate(
      { sessionId },
      { items: safeItems },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    // devolvemos con populate manual para el front (opcional)
    let itemsPop = updatedFavorites.items || [];
    try {
      itemsPop = await safePopulateItems(updatedFavorites.items, { withCategory: true });
    } catch (_) {}

    res.status(200).json({
      message: 'Favoritos actualizados correctamente',
      favorites: {
        ...updatedFavorites,
        items: itemsPop,
        itemsCount: Array.isArray(updatedFavorites.items) ? updatedFavorites.items.length : 0,
        lastUpdate: pickUpdatedOrCreated(updatedFavorites),
      },
    });
  } catch (error) {
    console.error('Error al actualizar favoritos:', error);
    res.status(500).json({ message: 'Error interno al actualizar favoritos.' });
  }
});

/* ============================
   DELETE /api/favorites/:sessionId
   ============================ */
router.delete('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const result = await Favorite.findOneAndDelete({ sessionId });

    if (!result) {
      return res
        .status(404)
        .json({ message: 'No se encontraron favoritos para esta sesión.' });
    }

    res.status(200).json({ message: 'Favoritos eliminados correctamente' });
  } catch (error) {
    console.error('Error al eliminar favoritos:', error.message);
    res.status(500).json({ message: 'Error al eliminar favoritos en la base de datos' });
  }
});

module.exports = router;
