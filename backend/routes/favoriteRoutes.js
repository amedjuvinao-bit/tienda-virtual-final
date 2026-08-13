'use strict';

const express = require('express');
const mongoose = require('mongoose');

const Favorite = require('../models/Favorite');
const requireAdmin = require('../middleware/requireAdmin');
const {
  SAFE_FAVORITE_ACCESS_ERROR,
  getFavoriteAccessFromRequest,
  getFavoriteAccessSecret,
  issueFavoriteAccess,
  verifyFavoriteAccess,
} = require('../services/favoriteAccessService');
const {
  buildFavoriteDetail,
  buildFavoritesCsv,
  canonicalizeFavoriteItems,
  listAdminFavorites,
} = require('../services/favoriteOperationsService');

const router = express.Router();

function clean(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function sendOwnerNotFound(res) {
  return res.status(404).json(SAFE_FAVORITE_ACCESS_ERROR);
}

function requireFavoriteOwner(req, res, next) {
  try {
    const routeSessionId = clean(req.params.sessionId, 120);
    const credentials = getFavoriteAccessFromRequest(req);
    if (!routeSessionId || credentials.sessionId !== routeSessionId) {
      return sendOwnerNotFound(res);
    }

    const allowed = verifyFavoriteAccess({
      sessionId: credentials.sessionId,
      token: credentials.token,
      secret: getFavoriteAccessSecret(),
    });
    if (!allowed) return sendOwnerNotFound(res);

    req.favoriteSessionId = routeSessionId;
    return next();
  } catch (error) {
    console.error('Error validando acceso de favoritos:', error?.code || error?.message);
    return sendOwnerNotFound(res);
  }
}

function parseFavoriteId(value) {
  const id = clean(value, 80);
  return mongoose.Types.ObjectId.isValid(id) ? id : null;
}

/* =====================================================
 * EMISIÓN DE ACCESO ANÓNIMO SEGURO
 * =================================================== */
router.post('/access', (req, res) => {
  try {
    const access = issueFavoriteAccess({ secret: getFavoriteAccessSecret() });
    return res.status(201).json({
      sessionId: access.sessionId,
      favoriteAccessToken: access.token,
    });
  } catch (error) {
    console.error('Error creando acceso de favoritos:', error?.code || error?.message);
    return res.status(500).json({ message: 'No fue posible iniciar favoritos.' });
  }
});

/* =====================================================
 * RUTAS ADMINISTRATIVAS
 * =================================================== */
router.get('/admin/export', requireAdmin, async (req, res) => {
  try {
    const result = await listAdminFavorites(
      { ...req.query, page: 1, limit: 10_000 },
      { maxLimit: 10_000 }
    );
    const csv = buildFavoritesCsv(result.data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="favoritos.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    console.error('Error exportando favoritos:', error?.message);
    return res.status(500).json({ message: 'No fue posible exportar favoritos.' });
  }
});

router.get('/admin', requireAdmin, async (req, res) => {
  try {
    return res.status(200).json(await listAdminFavorites(req.query));
  } catch (error) {
    console.error('Error listando favoritos administrativos:', error?.message);
    return res.status(500).json({ message: 'No fue posible listar favoritos.' });
  }
});

router.get('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseFavoriteId(req.params.id);
    if (!id) return res.status(404).json({ message: 'Favoritos no encontrados.' });
    const favorite = await Favorite.findById(id).lean().exec();
    if (!favorite) return res.status(404).json({ message: 'Favoritos no encontrados.' });
    return res.status(200).json(await buildFavoriteDetail(favorite));
  } catch (error) {
    console.error('Error consultando detalle administrativo de favoritos:', error?.message);
    return res.status(500).json({ message: 'No fue posible cargar el detalle.' });
  }
});

router.delete('/admin/:id/items/:itemId', requireAdmin, async (req, res) => {
  try {
    const id = parseFavoriteId(req.params.id);
    const itemId = parseFavoriteId(req.params.itemId);
    if (!id || !itemId) {
      return res.status(404).json({ message: 'Favorito no encontrado.' });
    }
    const favorite = await Favorite.findOneAndUpdate(
      { _id: id, 'items._id': itemId },
      { $pull: { items: { _id: itemId } } },
      { new: true, runValidators: true }
    ).exec();
    if (!favorite) return res.status(404).json({ message: 'Favorito no encontrado.' });
    if (!favorite.items.length) {
      await Favorite.deleteOne({ _id: favorite._id }).exec();
      return res.status(200).json({ deleted: true, itemsCount: 0 });
    }
    return res.status(200).json(await buildFavoriteDetail(favorite));
  } catch (error) {
    console.error('Error retirando favorito desde administración:', error?.message);
    return res.status(500).json({ message: 'No fue posible retirar el favorito.' });
  }
});

router.delete('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseFavoriteId(req.params.id);
    if (!id) return res.status(404).json({ message: 'Favoritos no encontrados.' });
    const result = await Favorite.findByIdAndDelete(id).exec();
    if (!result) return res.status(404).json({ message: 'Favoritos no encontrados.' });
    return res.status(200).json({ deleted: true });
  } catch (error) {
    console.error('Error eliminando favoritos desde administración:', error?.message);
    return res.status(500).json({ message: 'No fue posible eliminar favoritos.' });
  }
});

/* =====================================================
 * RUTAS DEL COMPRADOR
 * La sesión y su credencial firmada prueban propiedad.
 * =================================================== */
router.get('/:sessionId', requireFavoriteOwner, async (req, res) => {
  try {
    const favorite = await Favorite.findOne({ sessionId: req.favoriteSessionId })
      .lean()
      .exec();
    if (!favorite || !Array.isArray(favorite.items) || favorite.items.length === 0) {
      return res.status(404).json({ message: 'No se encontraron favoritos.' });
    }
    return res.status(200).json(await buildFavoriteDetail(favorite));
  } catch (error) {
    console.error('Error obteniendo favoritos del comprador:', error?.message);
    return res.status(500).json({ message: 'No fue posible cargar favoritos.' });
  }
});

router.put('/:sessionId', requireFavoriteOwner, async (req, res) => {
  if (!Array.isArray(req.body?.items)) {
    return res.status(400).json({ message: 'La lista de favoritos es inválida.' });
  }
  try {
    const current = await Favorite.findOne({ sessionId: req.favoriteSessionId }).lean().exec();
    const items = await canonicalizeFavoriteItems(req.body.items, {
      previousItems: current?.items || [],
    });

    if (!items.length) {
      await Favorite.deleteOne({ sessionId: req.favoriteSessionId }).exec();
      return res.status(200).json({
        message: 'Lista de favoritos vacía.',
        persisted: false,
        favorites: {
          sessionId: req.favoriteSessionId,
          items: [],
          itemsCount: 0,
          potentialValue: 0,
        },
      });
    }

    const favorite = await Favorite.findOneAndUpdate(
      { sessionId: req.favoriteSessionId },
      {
        $set: {
          items,
          lastCustomerActivityAt: new Date(),
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).exec();

    return res.status(200).json({
      message: 'Favoritos sincronizados.',
      persisted: true,
      favorites: await buildFavoriteDetail(favorite),
    });
  } catch (error) {
    console.error('Error sincronizando favoritos:', error?.code || error?.message);
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'La lista cambió. Vuelve a intentarlo.' });
    }
    return res.status(500).json({ message: 'No fue posible sincronizar favoritos.' });
  }
});

router.delete('/:sessionId', requireFavoriteOwner, async (req, res) => {
  try {
    await Favorite.deleteOne({ sessionId: req.favoriteSessionId }).exec();
    return res.status(200).json({ deleted: true });
  } catch (error) {
    console.error('Error eliminando favoritos del comprador:', error?.message);
    return res.status(500).json({ message: 'No fue posible eliminar favoritos.' });
  }
});

module.exports = router;
