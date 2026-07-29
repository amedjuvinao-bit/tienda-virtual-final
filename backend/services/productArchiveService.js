const mongoose = require('mongoose');

const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');

function transactionIsUnavailable(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('transaction numbers are only allowed') ||
    message.includes('does not support transactions') ||
    message.includes('replica set member or mongos')
  );
}

async function archiveProductAndInventory({
  id,
  adminId = null,
  session = null,
  compensateOnFailure = false,
}) {
  let query = Product.findOne({
    _id: id,
    archivedAt: null,
  });

  if (session) query = query.session(session);

  const product = await query;
  if (!product) return null;

  const previousState = {
    active: product.active !== false,
    visible: product.visible !== false,
    archivedAt: product.archivedAt || null,
    archivedBy: product.archivedBy || null,
  };
  const archivedAt = new Date();

  const productUpdate = await Product.updateOne(
    {
      _id: product._id,
      archivedAt: null,
    },
    {
      $set: {
        active: false,
        visible: false,
        archivedAt,
        archivedBy: adminId,
      },
    },
    session ? { session } : undefined
  );

  if (Number(productUpdate.matchedCount || 0) !== 1) {
    return null;
  }

  try {
    const inventoryResult = await InventoryStock.updateMany(
      {
        product: product._id,
        deletedAt: null,
        active: true,
      },
      {
        $set: {
          active: false,
          updatedBy: adminId,
        },
      },
      session ? { session } : undefined
    );

    return {
      archivedProduct: {
        _id: product._id,
        archivedAt,
      },
      inventoryRowsArchived: Number(
        inventoryResult.modifiedCount || 0
      ),
    };
  } catch (error) {
    if (compensateOnFailure) {
      await Product.updateOne(
        {
          _id: product._id,
          archivedAt,
        },
        {
          $set: previousState,
        }
      );
    }
    throw error;
  }
}

async function archiveProductSafely({
  id,
  adminId = null,
}) {
  let session = null;

  try {
    session = await mongoose.startSession();
    let archiveResult = null;

    try {
      await session.withTransaction(async () => {
        archiveResult = await archiveProductAndInventory({
          id,
          adminId,
          session,
        });
      });
    } catch (error) {
      if (!transactionIsUnavailable(error)) throw error;

      archiveResult = await archiveProductAndInventory({
        id,
        adminId,
        compensateOnFailure: true,
      });
    }

    return archiveResult;
  } finally {
    if (session) await session.endSession();
  }
}

module.exports = {
  archiveProductSafely,
};
