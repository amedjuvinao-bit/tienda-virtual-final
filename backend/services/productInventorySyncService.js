// backend/services/productInventorySyncService.js

const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const Branch = require('../models/Branch');
const {
  buildVariantKey,
  normalizeProductVariants,
} = require('../lib/products/productVariantConfig');

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveInt(value, fallback = 0) {
  return Math.max(0, Math.floor(cleanNumber(value, fallback)));
}

function toPlainProduct(productDoc) {
  if (!productDoc) return null;
  return productDoc.toObject ? productDoc.toObject({ virtuals: true }) : { ...productDoc };
}

function getAdminId(value) {
  return value || null;
}

async function findDefaultInventoryBranch() {
  const baseFilter = {
    deletedAt: null,
    active: true,
    status: 'active',
  };

  return (
    (await Branch.findOne({ ...baseFilter, isMain: true }).lean()) ||
    (await Branch.findOne({ ...baseFilter, isDefaultForOnlineOrders: true }).lean()) ||
    (await Branch.findOne({ ...baseFilter, type: 'warehouse' }).lean()) ||
    (await Branch.findOne({ ...baseFilter, type: 'store' }).lean()) ||
    (await Branch.findOne(baseFilter).sort({ createdAt: 1 }).lean())
  );
}

function getLegacyInventoryStock(product = {}, size = '', color = '') {
  const rows = Array.isArray(product.inventory) ? product.inventory : [];
  const targetKey = buildVariantKey(size, color);

  const match = rows.find((row) => buildVariantKey(row?.size || '', row?.color || '') === targetKey);
  return positiveInt(match?.stock, 0);
}

function normalizeVariantRows(product = {}, options = {}) {
  if (product.trackInventory === false) return [];

  const rows = [];
  const seen = new Set();

  function addVariant({ size = '', color = '', sku = '', barcode = '', stock = 0 } = {}) {
    const cleanSize = cleanText(size);
    const cleanColor = cleanText(color);
    const variantKey = buildVariantKey(cleanSize, cleanColor);

    if (seen.has(variantKey)) return;
    seen.add(variantKey);

    rows.push({
      size: cleanSize,
      color: cleanColor,
      sku: cleanText(sku).toUpperCase(),
      barcode: cleanText(barcode),
      stock: positiveInt(stock),
      variantKey,
    });
  }

  const variantsAreExplicitlyEmpty =
    options.variantsAuthoritative === true &&
    (!Array.isArray(product.variants) || product.variants.length === 0);
  const advancedVariants = (
    variantsAreExplicitlyEmpty
      ? []
      : normalizeProductVariants(product.variants || [], product)
  ).filter((variant) => variant.active !== false);

  advancedVariants.forEach((variant) => {
    const legacyStock = getLegacyInventoryStock(product, variant.size, variant.color);
    addVariant({
      size: variant.size,
      color: variant.color,
      sku: variant.sku,
      barcode: variant.barcode,
      stock: positiveInt(variant.initialStock, legacyStock),
    });
  });

  if (options.variantsAuthoritative === true) {
    return rows;
  }

  const inventory = Array.isArray(product.inventory) ? product.inventory : [];
  inventory.forEach((row) => addVariant(row));

  if (!rows.length) {
    const sizes = Array.isArray(product.sizes) ? product.sizes.map(cleanText).filter(Boolean) : [];
    const colors = Array.isArray(product.colors) ? product.colors.map(cleanText).filter(Boolean) : [];

    if (sizes.length && colors.length) {
      sizes.forEach((size) => colors.forEach((color) => addVariant({ size, color, stock: 0 })));
    } else if (sizes.length) {
      sizes.forEach((size) => addVariant({ size, color: '', stock: 0 }));
    } else if (colors.length) {
      colors.forEach((color) => addVariant({ size: '', color, stock: 0 }));
    }
  }

  if (!rows.length) {
    addVariant({ size: '', color: '', stock: positiveInt(product.stock) });
  }

  return rows;
}

async function createInitialStockMovement({ stockRow, product, branch, variant, quantity, adminId }) {
  const qty = positiveInt(quantity);
  if (!qty) return null;

  const unitCost = Math.max(0, cleanNumber(product.averageCost || product.cost || 0));
  const now = new Date();

  const movement = new InventoryMovement({
    type: 'initial_stock',
    direction: 'in',
    status: 'posted',

    product: product._id,
    productSnapshot: InventoryMovement.buildProductSnapshot(product),
    variant: InventoryStock.buildVariantSnapshot(variant),

    branchTo: branch._id,
    branchToSnapshot: InventoryMovement.buildBranchSnapshot(branch),

    quantity: qty,
    stockTo: {
      before: 0,
      quantity: qty,
      after: qty,
    },

    unitCost,
    totalCost: unitCost * qty,
    reason: 'Carga inicial desde catálogo de productos',
    notes: 'Movimiento automático creado al registrar el producto. Los cambios posteriores deben hacerse desde Inventario.',
    reference: `PRODUCT-${cleanText(product.sku || product._id).slice(0, 80)}`,
    sourceModel: 'Product',
    sourceId: product._id,

    createdBy: adminId,
    updatedBy: adminId,
    postedBy: adminId,
    postedAt: now,
  });

  await movement.save();

  stockRow.lastMovement = movement._id;
  stockRow.lastMovementAt = now;
  await stockRow.save();

  return movement;
}

async function syncProductLegacyStock(productDoc, productId) {
  const ProductModel = productDoc?.constructor;
  if (!ProductModel || typeof ProductModel.updateOne !== 'function') return 0;

  const rows = await InventoryStock.find({
    product: productId,
    deletedAt: null,
    active: true,
  }).select('stock').lean();

  const total = rows.reduce((sum, row) => sum + positiveInt(row?.stock), 0);

  await ProductModel.updateOne(
    { _id: productId },
    { $set: { stock: total } }
  );

  return total;
}

async function syncProductInventoryFromProduct(productDoc, options = {}) {
  const product = toPlainProduct(productDoc);
  const adminId = getAdminId(options.adminId);

  if (!product?._id) {
    return { ok: false, message: 'Producto inválido para sincronizar inventario.' };
  }

  const productId = product._id;
  const productSnapshot = InventoryStock.buildProductSnapshot(product);

  await InventoryStock.updateMany(
    { product: productId, deletedAt: null },
    {
      $set: {
        productSnapshot,
        updatedBy: adminId,
      },
    }
  );

  if (product.trackInventory === false) {
    await InventoryStock.updateMany(
      { product: productId, deletedAt: null, active: true },
      {
        $set: {
          active: false,
          updatedBy: adminId,
        },
      }
    );

    const stock = await syncProductLegacyStock(productDoc, productId);
    return { ok: true, action: 'inventory_disabled', stock };
  }

  const desiredRows = normalizeVariantRows(product, options);
  const existingRows = await InventoryStock.find({
    product: productId,
    deletedAt: null,
  });

  const hadExistingRows = existingRows.length > 0;
  const desiredVariantKeys = new Set(
    desiredRows.map((row) =>
      InventoryStock.buildVariantKey(row.size, row.color)
    )
  );

  if (!desiredRows.length) {
    const deactivation = await InventoryStock.updateMany(
      {
        product: productId,
        deletedAt: null,
        active: true,
      },
      {
        $set: {
          active: false,
          updatedBy: adminId,
        },
      }
    );

    const stock = await syncProductLegacyStock(productDoc, productId);
    return {
      ok: true,
      action: 'variants_retired',
      stock,
      createdRows: 0,
      reactivatedRows: 0,
      deactivatedRows: Number(deactivation.modifiedCount || 0),
      movementsCreated: 0,
    };
  }

  const branch = await findDefaultInventoryBranch();
  if (!branch?._id) {
    return {
      ok: false,
      message: 'No hay sede activa para crear el inventario inicial del producto.',
    };
  }

  const branchId = branch._id;
  const existingByKey = new Map();

  existingRows.forEach((row) => {
    existingByKey.set(`${String(row.branch)}__${row.variantKey}`, row);
  });

  let createdRows = 0;
  let reactivatedRows = 0;
  let deactivatedRows = 0;
  let movementsCreated = 0;

  for (const desired of desiredRows) {
    const variant = InventoryStock.buildVariantSnapshot(desired);
    const variantKey = InventoryStock.buildVariantKey(variant.size, variant.color);
    const mapKey = `${String(branchId)}__${variantKey}`;
    const initialQty = hadExistingRows ? 0 : positiveInt(desired.stock);

    let stockRow = existingByKey.get(mapKey) || null;

    if (!stockRow) {
      stockRow = new InventoryStock({
        branch: branchId,
        branchSnapshot: InventoryStock.buildBranchSnapshot(branch),
        product: productId,
        productSnapshot,
        variant,
        variantKey,
        stock: initialQty,
        reservedStock: 0,
        availableStock: initialQty,
        reorderPoint: positiveInt(product.reorderPoint),
        reorderQty: positiveInt(product.reorderQty),
        warehouseLocation: product.warehouseLocation || '',
        notes: hadExistingRows
          ? 'Variante creada desde catálogo. Cargar existencias desde Inventario.'
          : 'Stock inicial creado desde catálogo de productos.',
        active: true,
        createdBy: adminId,
        updatedBy: adminId,
      });

      await stockRow.save();
      createdRows += 1;

      if (initialQty > 0) {
        const movement = await createInitialStockMovement({
          stockRow,
          product,
          branch,
          variant,
          quantity: initialQty,
          adminId,
        });

        if (movement) movementsCreated += 1;
      }
    } else {
      const wasInactive = stockRow.active === false;

      stockRow.branchSnapshot = InventoryStock.buildBranchSnapshot(branch);
      stockRow.productSnapshot = productSnapshot;
      stockRow.variant = variant;
      stockRow.reorderPoint = positiveInt(product.reorderPoint);
      stockRow.reorderQty = positiveInt(product.reorderQty);
      stockRow.warehouseLocation = product.warehouseLocation || stockRow.warehouseLocation || '';
      stockRow.active = true;
      stockRow.updatedBy = adminId;

      await stockRow.save();
      if (wasInactive) reactivatedRows += 1;
    }
  }

  const retiredRows = await InventoryStock.updateMany(
    {
      product: productId,
      deletedAt: null,
      active: true,
      variantKey: { $nin: [...desiredVariantKeys] },
    },
    {
      $set: {
        active: false,
        updatedBy: adminId,
      },
    }
  );
  deactivatedRows = Number(retiredRows.modifiedCount || 0);

  const stock = await syncProductLegacyStock(productDoc, productId);

  return {
    ok: true,
    action: 'inventory_synced',
    stock,
    createdRows,
    reactivatedRows,
    deactivatedRows,
    movementsCreated,
  };
}

module.exports = {
  normalizeVariantRows,
  syncProductInventoryFromProduct,
};
