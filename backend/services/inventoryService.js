// backend/services/inventoryService.js

const mongoose = require('mongoose');

const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const Product = require('../models/Product');
const Branch = require('../models/Branch');

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function toObjectId(value) {
  if (!mongoose.Types.ObjectId.isValid(String(value || ''))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function getValidObjectId(value, fieldName) {
  const objectId = toObjectId(value);

  if (!objectId) {
    throw new Error(`${fieldName} no es válido.`);
  }

  return objectId;
}

function getQuantity(value) {
  const quantity = Math.floor(Number(value || 0));

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('La cantidad debe ser mayor a cero.');
  }

  return quantity;
}

function getVariantFromPayload(payload = {}, product = null) {
  const size =
    payload.size ||
    payload.variant?.size ||
    payload.talla ||
    '';

  const color =
    payload.color ||
    payload.variant?.color ||
    payload.selectedColor ||
    '';

  const productInventory = Array.isArray(product?.inventory)
    ? product.inventory
    : [];

  const matchedVariant = productInventory.find((item) => {
    const sameSize = cleanLower(item?.size) === cleanLower(size);
    const sameColor = cleanLower(item?.color) === cleanLower(color);

    return sameSize && sameColor;
  });

  return {
    size: cleanText(size),
    color: cleanText(color),
    sku:
      payload.variant?.sku ||
      payload.sku ||
      matchedVariant?.sku ||
      '',
    barcode:
      payload.variant?.barcode ||
      payload.barcode ||
      matchedVariant?.barcode ||
      product?.barcode ||
      '',
  };
}

async function getProductOrFail(productId, { session } = {}) {
  const product = await Product.findOne({
    _id: getValidObjectId(productId, 'El producto'),
    deletedAt: { $in: [null, undefined] },
  })
    .session(session || null)
    .lean();

  if (!product) {
    throw new Error('Producto no encontrado.');
  }

  return product;
}

async function getBranchOrFail(branchId, { session, fieldName = 'La sede' } = {}) {
  const branch = await Branch.findOne({
    _id: getValidObjectId(branchId, fieldName),
    deletedAt: null,
    active: true,
    status: 'active',
  })
    .session(session || null)
    .lean();

  if (!branch) {
    throw new Error(`${fieldName} no existe o no está activa.`);
  }

  return branch;
}

async function getOrCreateStock({
  branch,
  product,
  variant,
  adminId = null,
  session = null,
}) {
  const branchId = getValidObjectId(branch?._id, 'La sede');
  const productId = getValidObjectId(product?._id, 'El producto');
  const variantSnapshot = InventoryStock.buildVariantSnapshot(variant);
  const variantKey = InventoryStock.buildVariantKey(
    variantSnapshot.size,
    variantSnapshot.color
  );

  let stockRow = await InventoryStock.findOne({
    branch: branchId,
    product: productId,
    variantKey,
    deletedAt: null,
  }).session(session);

  if (stockRow) {
    return stockRow;
  }

  stockRow = new InventoryStock({
    branch: branchId,
    branchSnapshot: InventoryStock.buildBranchSnapshot(branch),
    product: productId,
    productSnapshot: InventoryStock.buildProductSnapshot(product),
    variant: variantSnapshot,
    variantKey,
    stock: 0,
    reservedStock: 0,
    availableStock: 0,
    createdBy: adminId,
    updatedBy: adminId,
  });

  await stockRow.save({ session });

  return stockRow;
}

async function syncProductTotalStock(productId, { session = null } = {}) {
  const productObjectId = getValidObjectId(productId, 'El producto');

  const rows = await InventoryStock.find({
    product: productObjectId,
    deletedAt: null,
    active: true,
  })
    .select('stock')
    .session(session)
    .lean();

  const totalStock = rows.reduce(
    (acc, row) => acc + Math.max(0, Number(row?.stock || 0)),
    0
  );

  await Product.updateOne(
    { _id: productObjectId },
    { $set: { stock: totalStock } },
    { session }
  );

  return totalStock;
}

function applyInStock(stockRow, quantity) {
  const before = Number(stockRow.stock || 0);
  const after = before + quantity;

  stockRow.stock = after;
  stockRow.availableStock = Math.max(0, after - Number(stockRow.reservedStock || 0));

  return {
    before,
    quantity,
    after,
  };
}

function applyOutStock(stockRow, quantity, { allowNegativeStock = false } = {}) {
  const before = Number(stockRow.stock || 0);

  if (!allowNegativeStock && before < quantity) {
    throw new Error(
      `Stock insuficiente. Disponible: ${before}. Solicitado: ${quantity}.`
    );
  }

  const after = Math.max(0, before - quantity);

  stockRow.stock = after;
  stockRow.reservedStock = Math.min(Number(stockRow.reservedStock || 0), after);
  stockRow.availableStock = Math.max(0, after - Number(stockRow.reservedStock || 0));

  return {
    before,
    quantity,
    after,
  };
}

async function createInventoryMovement(payload = {}, options = {}) {
  const {
    adminId = null,
    postNow = true,
    session: externalSession = null,
  } = options;

  const hasExternalSession = Boolean(externalSession);
  const session = externalSession || (await mongoose.startSession());

  async function execute() {
    const type = InventoryMovement.resolveDirectionFromType
      ? cleanLower(payload.type || 'correction')
      : cleanLower(payload.type || 'correction');

    const direction = InventoryMovement.resolveDirectionFromType(type);
    const quantity = getQuantity(payload.quantity);

    const product = await getProductOrFail(payload.product || payload.productId, {
      session,
    });

    const variant = getVariantFromPayload(payload, product);

    let branchFrom = null;
    let branchTo = null;

    if (direction === 'in') {
      branchTo = await getBranchOrFail(payload.branchTo || payload.branch || payload.branchId, {
        session,
        fieldName: 'La sede destino',
      });
    }

    if (direction === 'out') {
      branchFrom = await getBranchOrFail(payload.branchFrom || payload.branch || payload.branchId, {
        session,
        fieldName: 'La sede origen',
      });
    }

    if (direction === 'transfer') {
      branchFrom = await getBranchOrFail(payload.branchFrom, {
        session,
        fieldName: 'La sede origen',
      });

      branchTo = await getBranchOrFail(payload.branchTo, {
        session,
        fieldName: 'La sede destino',
      });

      if (String(branchFrom._id) === String(branchTo._id)) {
        throw new Error('La sede origen y la sede destino no pueden ser la misma.');
      }
    }

    let stockFromImpact = {
      before: 0,
      quantity: 0,
      after: 0,
    };

    let stockToImpact = {
      before: 0,
      quantity: 0,
      after: 0,
    };

    let stockFromRow = null;
    let stockToRow = null;

    if (postNow && direction === 'in') {
      stockToRow = await getOrCreateStock({
        branch: branchTo,
        product,
        variant,
        adminId,
        session,
      });

      stockToImpact = applyInStock(stockToRow, quantity);

      stockToRow.lastMovementAt = new Date();
      stockToRow.updatedBy = adminId;

      await stockToRow.save({ session });
    }

    if (postNow && direction === 'out') {
      stockFromRow = await getOrCreateStock({
        branch: branchFrom,
        product,
        variant,
        adminId,
        session,
      });

      stockFromImpact = applyOutStock(stockFromRow, quantity, {
        allowNegativeStock: payload.allowNegativeStock === true,
      });

      stockFromRow.lastMovementAt = new Date();
      stockFromRow.updatedBy = adminId;

      await stockFromRow.save({ session });
    }

    if (postNow && direction === 'transfer') {
      stockFromRow = await getOrCreateStock({
        branch: branchFrom,
        product,
        variant,
        adminId,
        session,
      });

      stockToRow = await getOrCreateStock({
        branch: branchTo,
        product,
        variant,
        adminId,
        session,
      });

      stockFromImpact = applyOutStock(stockFromRow, quantity, {
        allowNegativeStock: false,
      });

      stockToImpact = applyInStock(stockToRow, quantity);

      const now = new Date();

      stockFromRow.lastMovementAt = now;
      stockToRow.lastMovementAt = now;

      stockFromRow.updatedBy = adminId;
      stockToRow.updatedBy = adminId;

      await stockFromRow.save({ session });
      await stockToRow.save({ session });
    }

    const movement = new InventoryMovement({
      type,
      direction,
      status: postNow ? 'posted' : 'draft',

      product: product._id,
      productSnapshot: InventoryMovement.buildProductSnapshot(product),
      variant,

      branchFrom: branchFrom?._id || null,
      branchFromSnapshot: InventoryMovement.buildBranchSnapshot(branchFrom),

      branchTo: branchTo?._id || null,
      branchToSnapshot: InventoryMovement.buildBranchSnapshot(branchTo),

      quantity,

      stockFrom: stockFromImpact,
      stockTo: stockToImpact,

      unitCost: payload.unitCost || 0,
      totalCost: payload.totalCost || 0,

      reason: cleanText(payload.reason),
      notes: cleanText(payload.notes),
      reference: cleanUpper(payload.reference),

      order: payload.order || null,
      orderNumber: cleanUpper(payload.orderNumber),

      sourceModel: cleanText(payload.sourceModel),
      sourceId: payload.sourceId || null,

      createdBy: adminId,
      updatedBy: adminId,
      postedBy: postNow ? adminId : null,
      postedAt: postNow ? new Date() : null,
    });

    await movement.save({ session });

    if (stockFromRow) {
      stockFromRow.lastMovement = movement._id;
      await stockFromRow.save({ session });
    }

    if (stockToRow) {
      stockToRow.lastMovement = movement._id;
      await stockToRow.save({ session });
    }

    if (postNow) {
      await syncProductTotalStock(product._id, { session });
    }

    return movement;
  }

  try {
    if (hasExternalSession) {
      return await execute();
    }

    let result = null;

    await session.withTransaction(async () => {
      result = await execute();
    });

    return result;
  } finally {
    if (!hasExternalSession) {
      await session.endSession();
    }
  }
}

async function getBranchStockSummary(branchId, { session = null } = {}) {
  const branchObjectId = getValidObjectId(branchId, 'La sede');

  const rows = await InventoryStock.find({
    branch: branchObjectId,
    deletedAt: null,
    active: true,
  })
    .sort({ 'productSnapshot.title': 1, 'variant.size': 1, 'variant.color': 1 })
    .session(session)
    .lean();

  const totals = rows.reduce(
    (acc, row) => {
      acc.stock += Number(row.stock || 0);
      acc.reservedStock += Number(row.reservedStock || 0);
      acc.availableStock += Number(row.availableStock || 0);
      acc.products += 1;

      return acc;
    },
    {
      products: 0,
      stock: 0,
      reservedStock: 0,
      availableStock: 0,
    }
  );

  return {
    totals,
    rows,
  };
}

module.exports = {
  createInventoryMovement,
  getBranchStockSummary,
  syncProductTotalStock,
};