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
  getAdminFavoriteSummary,
  listAdminFavorites,
} = require('../services/favoriteOperationsService');

const { favoriteRevision, writeFavoriteList } = require('../services/favoriteWriteService');

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
    const invalid = error?.code === 'FAVORITES_ADMIN_FILTER_INVALID';
    if (!invalid) console.error('Error exportando favoritos:', error?.message);
    return res.status(invalid ? 400 : 500).json({
      message: invalid ? error.message : 'No fue posible exportar favoritos.',
    });
  }
});

router.get('/admin', requireAdmin, async (req, res) => {
  try {
    return res.status(200).json(await listAdminFavorites(req.query));
  } catch (error) {
    const invalid = error?.code === 'FAVORITES_ADMIN_FILTER_INVALID';
    if (!invalid) console.error('Error listando favoritos administrativos:', error?.message);
    return res.status(invalid ? 400 : 500).json({
      message: invalid ? error.message : 'No fue posible listar favoritos.',
    });
  }
});

router.get('/admin/summary', requireAdmin, async (req, res) => {
  try {
    return res.status(200).json(await getAdminFavoriteSummary(req.query));
  } catch (error) {
    const invalid = error?.code === 'FAVORITES_ADMIN_FILTER_INVALID';
    if (!invalid) {
      console.error('Error calculando resumen administrativo de favoritos:', error?.message);
    }
    return res.status(invalid ? 400 : 500).json({
      message: invalid ? error.message : 'No fue posible calcular el resumen de favoritos.',
    });
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
      { $pull: { items: { _id: itemId } }, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    ).exec();
    if (!favorite) return res.status(404).json({ message: 'Favorito no encontrado.' });
    if (!favorite.items.length) {
      await Favorite.deleteOne({ _id: favorite._id, 'items.0': { $exists: false } }).exec();
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
      return res.status(200).json({ sessionId: req.favoriteSessionId, items: [], itemsCount: 0, revision: favoriteRevision(favorite) });
    }
    return res.status(200).json({ ...(await buildFavoriteDetail(favorite)), revision: favoriteRevision(favorite) });
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
    const favorite = await writeFavoriteList({
      sessionId: req.favoriteSessionId,
      items: req.body.items,
      revision: req.body.revision,
    });
    return res.status(200).json({
      persisted: Boolean(favorite.items.length),
      favorites: { ...(await buildFavoriteDetail(favorite)), revision: favoriteRevision(favorite) },
    });
  } catch (error) {
    if (!error.status) console.error('Error sincronizando favoritos:', error?.code || error?.message);
    return res.status(error.status || 500).json({
      error: error.code || 'FAVORITE_WRITE_FAILED',
      message: error.status ? error.message : 'No fue posible sincronizar favoritos.',
    });
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
