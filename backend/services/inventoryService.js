// backend/services/inventoryService.js

const mongoose = require('mongoose');

const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const {
  canonicalizeVariantKey,
  normalizeAttributes,
  resolveVariantIdentity,
} = require('../lib/products/productVariantConfig');
const { applyAvailableStockOut } = require('./inventoryStockPolicy');

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

function getMovementType(value) {
  const type = cleanLower(value);
  const allowedTypes = new Set(InventoryMovement.getTypes());

  if (!type || !allowedTypes.has(type)) {
    const error = new Error('El tipo de movimiento de inventario no es válido.');
    error.code = 'INVALID_INVENTORY_MOVEMENT_TYPE';
    error.statusCode = 400;
    throw error;
  }

  const direction = InventoryMovement.resolveDirectionFromType(type);
  if (!['in', 'out', 'transfer'].includes(direction)) {
    const error = new Error('El tipo de movimiento no produce un cambio de inventario.');
    error.code = 'INVENTORY_MOVEMENT_WITHOUT_STOCK_IMPACT';
    error.statusCode = 400;
    throw error;
  }

  return type;
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
  const rawRequestedVariantKey = cleanLower(
    payload.variantKey ||
      payload.variantId ||
      payload.variant?.variantKey ||
      ''
  );
  const requestedVariantKey = rawRequestedVariantKey
    ? canonicalizeVariantKey(rawRequestedVariantKey) || rawRequestedVariantKey
    : '';
  const productVariants = Array.isArray(product?.variants)
    ? product.variants
    : [];

  const matchedProductVariant =
    (requestedVariantKey
      ? productVariants.find(
          (item) =>
            canonicalizeVariantKey(item?.variantKey) === requestedVariantKey
        )
      : null) ||
    productVariants.find((item) => {
      const sameSize = cleanLower(item?.size) === cleanLower(size);
      const sameColor = cleanLower(item?.color) === cleanLower(color);
      return sameSize && sameColor;
    });
  const matchedLegacyInventory = productInventory.find((item) => {
    const sameSize = cleanLower(item?.size) === cleanLower(size);
    const sameColor = cleanLower(item?.color) === cleanLower(color);

    return sameSize && sameColor;
  });
  const variantAttributes = normalizeAttributes(
    payload.variantAttributes ||
      payload.attributes ||
      payload.variant?.attributes ||
      matchedProductVariant?.attributes ||
      []
  );
  const variantIdentity = resolveVariantIdentity({
    variantKey:
      requestedVariantKey || matchedProductVariant?.variantKey || '',
    size: size || matchedProductVariant?.size,
    color: color || matchedProductVariant?.color,
    attributes: variantAttributes,
  });

  return {
    size: variantIdentity.size,
    color: variantIdentity.color,
    variantKey: variantIdentity.variantKey,
    label: cleanText(
      payload.variantLabel ||
        payload.variant?.label ||
        matchedProductVariant?.label ||
        ''
    ),
    attributes: variantIdentity.attributes,
    sku:
      payload.variant?.sku ||
      payload.sku ||
      matchedProductVariant?.sku ||
      matchedLegacyInventory?.sku ||
      '',
    barcode:
      payload.variant?.barcode ||
      payload.barcode ||
      matchedProductVariant?.barcode ||
      matchedLegacyInventory?.barcode ||
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
  const variantIdentity = resolveVariantIdentity({
    variantKey: variant?.variantKey,
    size: variant?.size,
    color: variant?.color,
    attributes: variant?.attributes || [],
  });
  const variantSnapshot = InventoryStock.buildVariantSnapshot({
    ...variant,
    size: variantIdentity.size,
    color: variantIdentity.color,
    attributes: variantIdentity.attributes,
  });
  const variantKey = variantIdentity.variantKey;

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

function applyOutStock(stockRow, quantity) {
  return applyAvailableStockOut(stockRow, quantity);
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
    const type = getMovementType(payload.type);

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

      stockFromImpact = applyOutStock(stockFromRow, quantity);

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

      stockFromImpact = applyOutStock(stockFromRow, quantity);

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
      variantKey:
        stockFromRow?.variantKey ||
        stockToRow?.variantKey ||
        variant.variantKey,

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
      approvalRequired: !postNow,
      requestedBy: !postNow ? adminId : null,
      requestedAt: !postNow ? new Date() : null,
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

async function approveInventoryMovement(
  movementId,
  { adminId = null, reviewNote = '' } = {}
) {
  const session = await mongoose.startSession();
  let result = null;

  try {
    await session.withTransaction(async () => {
      const movement = await InventoryMovement.findOne({
        _id: getValidObjectId(movementId, 'El movimiento'),
        deletedAt: null,
      }).session(session);

      if (!movement) {
        const error = new Error('Solicitud de inventario no encontrada.');
        error.code = 'INVENTORY_APPROVAL_NOT_FOUND';
        error.statusCode = 404;
        throw error;
      }

      if (!movement.approvalRequired || movement.status !== 'draft') {
        const error = new Error('Esta solicitud ya fue resuelta o no requiere aprobación.');
        error.code = 'INVENTORY_APPROVAL_ALREADY_RESOLVED';
        error.statusCode = 409;
        throw error;
      }

      const product = await getProductOrFail(movement.product, { session });
      const variant = movement.variant?.toObject
        ? movement.variant.toObject()
        : movement.variant;
      const quantity = getQuantity(movement.quantity);
      const direction = movement.direction;
      let branchFrom = null;
      let branchTo = null;
      let stockFromRow = null;
      let stockToRow = null;
      let stockFromImpact = { before: 0, quantity: 0, after: 0 };
      let stockToImpact = { before: 0, quantity: 0, after: 0 };

      if (direction === 'out' || direction === 'transfer') {
        branchFrom = await getBranchOrFail(movement.branchFrom, {
          session,
          fieldName: 'La sede origen',
        });
        stockFromRow = await getOrCreateStock({
          branch: branchFrom,
          product,
          variant,
          adminId,
          session,
        });
        stockFromImpact = applyOutStock(stockFromRow, quantity);
      }

      if (direction === 'in' || direction === 'transfer') {
        branchTo = await getBranchOrFail(movement.branchTo, {
          session,
          fieldName: 'La sede destino',
        });
        stockToRow = await getOrCreateStock({
          branch: branchTo,
          product,
          variant,
          adminId,
          session,
        });
        stockToImpact = applyInStock(stockToRow, quantity);
      }

      const now = new Date();
      const rows = [stockFromRow, stockToRow].filter(Boolean);

      for (const stockRow of rows) {
        stockRow.lastMovement = movement._id;
        stockRow.lastMovementAt = now;
        stockRow.updatedBy = adminId;
        await stockRow.save({ session });
      }

      movement.stockFrom = stockFromImpact;
      movement.stockTo = stockToImpact;
      movement.status = 'posted';
      movement.postedBy = adminId;
      movement.postedAt = now;
      movement.reviewedBy = adminId;
      movement.reviewedAt = now;
      movement.reviewDecision = 'approved';
      movement.reviewNote = cleanText(reviewNote);
      movement.updatedBy = adminId;
      await movement.save({ session });

      await syncProductTotalStock(product._id, { session });
      result = movement;
    });

    return result;
  } finally {
    await session.endSession();
  }
}

async function rejectInventoryMovement(
  movementId,
  { adminId = null, reviewNote = '' } = {}
) {
  const note = cleanText(reviewNote);

  if (!note) {
    const error = new Error('Escribe el motivo del rechazo.');
    error.code = 'INVENTORY_REJECTION_NOTE_REQUIRED';
    error.statusCode = 400;
    throw error;
  }

  const session = await mongoose.startSession();
  let result = null;

  try {
    await session.withTransaction(async () => {
      const movement = await InventoryMovement.findOne({
        _id: getValidObjectId(movementId, 'El movimiento'),
        deletedAt: null,
      }).session(session);

      if (!movement) {
        const error = new Error('Solicitud de inventario no encontrada.');
        error.code = 'INVENTORY_APPROVAL_NOT_FOUND';
        error.statusCode = 404;
        throw error;
      }

      if (!movement.approvalRequired || movement.status !== 'draft') {
        const error = new Error('Esta solicitud ya fue resuelta o no requiere aprobación.');
        error.code = 'INVENTORY_APPROVAL_ALREADY_RESOLVED';
        error.statusCode = 409;
        throw error;
      }

      const now = new Date();
      movement.status = 'cancelled';
      movement.cancelledBy = adminId;
      movement.cancelledAt = now;
      movement.reviewedBy = adminId;
      movement.reviewedAt = now;
      movement.reviewDecision = 'rejected';
      movement.reviewNote = note;
      movement.updatedBy = adminId;
      await movement.save({ session });
      result = movement;
    });

    return result;
  } finally {
    await session.endSession();
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
  approveInventoryMovement,
  createInventoryMovement,
  getBranchStockSummary,
  rejectInventoryMovement,
  syncProductTotalStock,
};
