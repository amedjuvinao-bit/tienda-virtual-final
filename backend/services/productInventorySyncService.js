// backend/services/productInventorySyncService.js

const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const Branch = require('../models/Branch');
const {
  buildVariantKey,
  canonicalizeVariantKey,
  normalizeVariantKey,
  normalizeProductVariants,
  resolveVariantIdentity,
} = require('../lib/products/productVariantConfig');

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
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

function applySession(query, session = null) {
  return session ? query.session(session) : query;
}

function writeOptions(session = null) {
  return session ? { session } : undefined;
}

async function findDefaultInventoryBranch({ session = null } = {}) {
  const baseFilter = {
    deletedAt: null,
    active: true,
    status: 'active',
  };

  return (
    (await applySession(
      Branch.findOne({ ...baseFilter, isMain: true }),
      session
    ).lean()) ||
    (await applySession(
      Branch.findOne({
        ...baseFilter,
        isDefaultForOnlineOrders: true,
      }),
      session
    ).lean()) ||
    (await applySession(
      Branch.findOne({ ...baseFilter, type: 'warehouse' }),
      session
    ).lean()) ||
    (await applySession(
      Branch.findOne({ ...baseFilter, type: 'store' }),
      session
    ).lean()) ||
    (await applySession(
      Branch.findOne(baseFilter).sort({ createdAt: 1 }),
      session
    ).lean())
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

  function addVariant({
    size = '',
    color = '',
    attributes = [],
    label = '',
    sku = '',
    barcode = '',
    stock = 0,
    variantKey: providedVariantKey = '',
  } = {}) {
    const cleanSize = cleanText(size);
    const cleanColor = cleanText(color);
    const identity = resolveVariantIdentity({
      variantKey: providedVariantKey,
      size: cleanSize,
      color: cleanColor,
      attributes,
    });
    const variantKey = identity.variantKey;

    if (seen.has(variantKey)) return;
    seen.add(variantKey);

    rows.push({
      size: identity.size,
      color: identity.color,
      attributes: identity.attributes,
      label: cleanText(label),
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
      attributes: variant.attributes,
      label: variant.label,
      sku: variant.sku,
      barcode: variant.barcode,
      variantKey: variant.variantKey,
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

function buildVariantSyncPlan({ desiredRows = [], existingRows = [], branchId }) {
  const normalizedDesiredRows = desiredRows.map((row) => {
    const identity = resolveVariantIdentity({
      variantKey: row?.variantKey,
      size: row?.size,
      color: row?.color,
      attributes: row?.attributes || [],
    });
    return {
      ...row,
      variantKey: identity.variantKey,
      size: identity.size,
      color: identity.color,
      attributes: identity.attributes,
    };
  });
  const desiredVariantKeys = new Set(
    normalizedDesiredRows.map((row) => row.variantKey)
  );
  const existingByKey = new Map();

  existingRows.forEach((row) => {
    const variantKey = canonicalizeVariantKey(row?.variantKey);
    if (!variantKey) return;
    const mapKey = `${String(row.branch)}__${variantKey}`;
    const current = existingByKey.get(mapKey);
    const isExactCanonical = normalizeVariantKey(row?.variantKey) === variantKey;
    const currentIsExact =
      current && normalizeVariantKey(current.variantKey) === variantKey;
    if (!current || (isExactCanonical && !currentIsExact)) {
      existingByKey.set(mapKey, row);
    }
  });

  const rowsToReuse = [];
  const rowsToCreate = [];
  normalizedDesiredRows.forEach((row) => {
    const existing = existingByKey.get(
      `${String(branchId)}__${row.variantKey}`
    );
    (existing ? rowsToReuse : rowsToCreate).push({ row, existing: existing || null });
  });

  const rowsToDeactivate = existingRows.filter(
    (row) =>
      row?.active !== false &&
      !desiredVariantKeys.has(canonicalizeVariantKey(row?.variantKey))
  );

  return {
    desiredRows: normalizedDesiredRows,
    desiredVariantKeys,
    existingByKey,
    rowsToReuse,
    rowsToCreate,
    rowsToDeactivate,
  };
}

async function createInitialStockMovement({
  stockRow,
  product,
  branch,
  variant,
  quantity,
  adminId,
  session = null,
}) {
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
    variantKey: stockRow.variantKey,

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

  await movement.save(writeOptions(session));

  stockRow.lastMovement = movement._id;
  stockRow.lastMovementAt = now;
  await stockRow.save(writeOptions(session));

  return movement;
}

async function syncProductLegacyStock(
  productDoc,
  productId,
  { session = null } = {}
) {
  const ProductModel = productDoc?.constructor;
  if (!ProductModel || typeof ProductModel.updateOne !== 'function') return 0;

  const rows = await applySession(
    InventoryStock.find({
      product: productId,
      deletedAt: null,
      active: true,
    }),
    session
  )
    .select('stock')
    .lean();

  const total = rows.reduce((sum, row) => sum + positiveInt(row?.stock), 0);

  await ProductModel.updateOne(
    { _id: productId },
    { $set: { stock: total } },
    writeOptions(session)
  );

  return total;
}

async function syncProductInventoryFromProduct(productDoc, options = {}) {
  const product = toPlainProduct(productDoc);
  const adminId = getAdminId(options.adminId);
  const session =
    options.session ||
    (typeof productDoc?.$session === 'function'
      ? productDoc.$session()
      : null);

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
    },
    writeOptions(session)
  );

  if (product.trackInventory === false) {
    await InventoryStock.updateMany(
      { product: productId, deletedAt: null, active: true },
      {
        $set: {
          active: false,
          updatedBy: adminId,
        },
      },
      writeOptions(session)
    );

    const stock = await syncProductLegacyStock(
      productDoc,
      productId,
      { session }
    );
    return { ok: true, action: 'inventory_disabled', stock };
  }

  const desiredRows = normalizeVariantRows(product, options);
  const existingRows = await applySession(
    InventoryStock.find({
      product: productId,
      deletedAt: null,
    }),
    session
  );

  const hadExistingRows = existingRows.length > 0;
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
      },
      writeOptions(session)
    );

    const stock = await syncProductLegacyStock(
      productDoc,
      productId,
      { session }
    );
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

  const branch = await findDefaultInventoryBranch({ session });
  if (!branch?._id) {
    return {
      ok: false,
      message: 'No hay sede activa para crear el inventario inicial del producto.',
    };
  }

  const branchId = branch._id;
  const syncPlan = buildVariantSyncPlan({
    desiredRows,
    existingRows,
    branchId,
  });
  const desiredVariantKeys = syncPlan.desiredVariantKeys;
  const existingByKey = syncPlan.existingByKey;

  let createdRows = 0;
  let reactivatedRows = 0;
  let deactivatedRows = 0;
  let movementsCreated = 0;

  for (const desired of syncPlan.desiredRows) {
    const variant = InventoryStock.buildVariantSnapshot(desired);
    const variantKey = desired.variantKey;
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

      await stockRow.save(writeOptions(session));
      createdRows += 1;

      if (initialQty > 0) {
        const movement = await createInitialStockMovement({
          stockRow,
          product,
          branch,
          variant,
          quantity: initialQty,
          adminId,
          session,
        });

        if (movement) movementsCreated += 1;
      }
    } else {
      const wasInactive = stockRow.active === false;

      stockRow.branchSnapshot = InventoryStock.buildBranchSnapshot(branch);
      stockRow.productSnapshot = productSnapshot;
      stockRow.variant = variant;
      stockRow.variantKey = variantKey;
      stockRow.reorderPoint = positiveInt(product.reorderPoint);
      stockRow.reorderQty = positiveInt(product.reorderQty);
      stockRow.warehouseLocation = product.warehouseLocation || stockRow.warehouseLocation || '';
      stockRow.active = true;
      stockRow.updatedBy = adminId;

      await stockRow.save(writeOptions(session));
      if (wasInactive) reactivatedRows += 1;
    }
  }

  const retiredIds = syncPlan.rowsToDeactivate
    .map((row) => row?._id)
    .filter(Boolean);
  const retiredRows = retiredIds.length
    ? await InventoryStock.updateMany(
        { _id: { $in: retiredIds }, active: true },
        {
          $set: {
            active: false,
            updatedBy: adminId,
          },
        },
        writeOptions(session)
      )
    : { modifiedCount: 0 };
  deactivatedRows = Number(retiredRows.modifiedCount || 0);

  const stock = await syncProductLegacyStock(
    productDoc,
    productId,
    { session }
  );

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
  buildVariantSyncPlan,
  normalizeVariantRows,
  syncProductInventoryFromProduct,
};
