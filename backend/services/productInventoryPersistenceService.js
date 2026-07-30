const mongoose = require('mongoose');

const {
  syncProductInventoryFromProduct,
} = require('./productInventorySyncService');

class ProductInventoryPersistenceError extends Error {
  constructor(
    message = 'No se pudo guardar el producto y su inventario.',
    cause = null
  ) {
    super(message);
    this.name = 'ProductInventoryPersistenceError';
    this.code = 'PRODUCT_INVENTORY_TRANSACTION_FAILED';
    this.status = 500;
    if (cause) this.cause = cause;
  }
}

function ensureProductDocument(productDoc) {
  if (
    !productDoc ||
    typeof productDoc.save !== 'function' ||
    !productDoc.constructor?.db
  ) {
    throw new ProductInventoryPersistenceError(
      'El producto no es válido para guardarlo con su inventario.'
    );
  }
}

function resolveVariantsAuthoritative(productDoc, options = {}) {
  if (typeof options.variantsAuthoritative === 'boolean') {
    return options.variantsAuthoritative;
  }

  return productDoc?.$locals?.variantsAuthoritative === true;
}

async function persistProductAndInventory(
  productDoc,
  {
    session,
    adminId = null,
    variantsAuthoritative = false,
  }
) {
  productDoc.$locals = productDoc.$locals || {};
  productDoc.$locals.adminId =
    adminId || productDoc.$locals.adminId || null;
  productDoc.$locals.variantsAuthoritative =
    variantsAuthoritative;
  productDoc.$locals.inventoryPersistenceManaged = true;

  const saved = await productDoc.save({ session });
  const syncResult = await syncProductInventoryFromProduct(
    saved,
    {
      session,
      adminId: productDoc.$locals.adminId,
      variantsAuthoritative,
    }
  );

  if (!syncResult?.ok) {
    throw new ProductInventoryPersistenceError(
      syncResult?.message ||
        'No se pudo sincronizar el inventario del producto.'
    );
  }

  saved.stock = Number(syncResult.stock || 0);
  saved.$locals = saved.$locals || {};
  saved.$locals.inventorySyncResult = syncResult;

  return saved;
}

async function saveProductWithInventoryTransaction(
  productDoc,
  options = {}
) {
  ensureProductDocument(productDoc);

  const variantsAuthoritative =
    resolveVariantsAuthoritative(productDoc, options);
  const adminId =
    options.adminId || productDoc?.$locals?.adminId || null;
  const externalSession = options.session || null;

  try {
    if (externalSession) {
      return await persistProductAndInventory(productDoc, {
        session: externalSession,
        adminId,
        variantsAuthoritative,
      });
    }

    const connection =
      productDoc.constructor.db || mongoose.connection;
    let savedProduct = null;

    await connection.transaction(
      async (session) => {
        savedProduct = await persistProductAndInventory(
          productDoc,
          {
            session,
            adminId,
            variantsAuthoritative,
          }
        );
      },
      {
        readPreference: 'primary',
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      }
    );

    return savedProduct;
  } catch (error) {
    if (
      error instanceof ProductInventoryPersistenceError ||
      error?.name === 'ValidationError' ||
      error?.code === 11000
    ) {
      throw error;
    }

    throw new ProductInventoryPersistenceError(
      `No se pudo confirmar la transacción Producto–Inventario: ${error?.message || 'error desconocido'}`,
      error
    );
  } finally {
    productDoc.$locals = productDoc.$locals || {};
    productDoc.$locals.inventoryPersistenceManaged = false;
  }
}

module.exports = {
  ProductInventoryPersistenceError,
  saveProductWithInventoryTransaction,
};
