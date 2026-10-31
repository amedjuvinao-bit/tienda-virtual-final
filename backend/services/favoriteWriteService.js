'use strict';
const Favorite = require('../models/Favorite');
const { canonicalizeFavoriteItems } = require('./favoriteOperationsService');

const favoriteRevision = (favorite) =>
  favorite?._id ? `${favorite._id}:${Number(favorite.__v || 0)}` : null;
function conflict() {
  return Object.assign(
    new Error('La lista cambió en otra ventana. Vuelve a intentarlo.'),
    {
      status: 409,
      code: 'FAVORITE_WRITE_CONFLICT',
    }
  );
}
// A revision includes the document identity: deleting and recreating a list can
// never make an old version valid again. Canonicalization runs before the CAS.
async function writeFavoriteList(
  { sessionId, items, revision },
  { FavoriteModel = Favorite, canonicalize = canonicalizeFavoriteItems } = {}
) {
  if (revision !== null && typeof revision !== 'string')
    throw Object.assign(new Error('Actualiza favoritos antes de guardar.'), {
      status: 428,
      code: 'FAVORITE_REVISION_REQUIRED',
    });
  if (!Array.isArray(items) || items.length > 200)
    throw Object.assign(new Error('La lista admite máximo 200 favoritos.'), {
      status: 400,
    });
  if (items.some((item) => !item || typeof item !== 'object' || Array.isArray(item)))
    throw Object.assign(new Error('La selección de favoritos es inválida.'), { status: 400 });
  const current = await FavoriteModel.findOne({ sessionId }).lean().exec();
  if (favoriteRevision(current) !== revision) throw conflict();
  let canonical;
  try {
    canonical = await canonicalize(items, { previousItems: current?.items || [] });
  } catch (error) {
    if (error.code === 'VARIANT_KEY_MISMATCH') error.status = 400;
    throw error;
  }
  const filter = current
    ? { _id: current._id, __v: current.__v || 0 }
    : { sessionId };
  if (!canonical.length) {
    if (current) {
      const removed = await FavoriteModel.deleteOne(filter).exec();
      if (!removed.deletedCount) throw conflict();
    }
    return { sessionId, items: [], revision: null };
  }
  try {
    if (!current)
      return await FavoriteModel.create({
        sessionId,
        items: canonical,
        lastCustomerActivityAt: new Date(),
      });
    const updated = await FavoriteModel.findOneAndUpdate(
      filter,
      {
        $set: { items: canonical, lastCustomerActivityAt: new Date() },
        $inc: { __v: 1 },
      },
      { new: true, runValidators: true }
    ).exec();
    if (!updated) throw conflict();
    return updated;
  } catch (error) {
    if (error.code === 11000) throw conflict();
    throw error;
  }
}
module.exports = { favoriteRevision, writeFavoriteList };
