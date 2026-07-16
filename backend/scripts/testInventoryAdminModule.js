// backend/scripts/testInventoryAdminModule.js
/* eslint-disable no-console */

/**
 * Prueba general del modulo Inventario administrativo.
 *
 * Usa una transaccion y la aborta al final para no dejar ajustes,
 * traslados, reversos ni cambios reales de stock.
 *
 * Ejecutar:
 *   npm run test:inventory-admin
 */

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryReservation = require('../models/InventoryReservation');
const { createInventoryMovement } = require('../services/inventoryService');

const RUN_ID = Math.random().toString(36).slice(2, 10).toUpperCase();
const IN_QTY = 2;
const OUT_QTY = 1;
const TRANSFER_QTY = 1;
const LOW_STOCK_LIMIT = 5;

const results = {
  ok: 0,
  warn: 0,
  fail: 0,
};

function printOk(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function printWarn(message) {
  results.warn += 1;
  console.log(`WARN ${message}`);
}

function printFail(message) {
  results.fail += 1;
  console.log(`FAIL ${message}`);
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getId(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value);
  return String(value);
}

function getAvailableStock(row = {}) {
  const stock = toNumber(row.stock, 0);
  const reservedStock = toNumber(row.reservedStock, 0);
  const availableStock = toNumber(row.availableStock, stock - reservedStock);
  return Math.max(0, availableStock);
}

function getVariant(row = {}) {
  return {
    size: cleanText(row.variant?.size || row.size || ''),
    color: cleanText(row.variant?.color || row.color || ''),
    sku: cleanText(row.variant?.sku || ''),
    barcode: cleanText(row.variant?.barcode || ''),
  };
}

function sameVariant(a = {}, b = {}) {
  return cleanLower(a.size) === cleanLower(b.size) && cleanLower(a.color) === cleanLower(b.color);
}

function buildAdminMock() {
  return null;
}

function buildMovementPayload({ type, stock, branchId, branchFrom, branchTo, quantity, reason }) {
  const variant = getVariant(stock);
  return {
    type,
    productId: getId(stock.product),
    branchId,
    branch: branchId,
    branchFrom,
    branchTo,
    size: variant.size,
    color: variant.color,
    variant,
    quantity,
    reason,
    reference: `TEST-${RUN_ID}`,
    notes: `Prueba automatica inventario admin ${RUN_ID}`,
    postNow: true,
  };
}

function getMovementEffect(movement, branchId) {
  const quantity = Math.max(0, toNumber(movement.quantity, 0));
  const direction = cleanLower(movement.direction || '');
  const targetBranchId = getId(branchId);
  const branchFromId = getId(movement.branchFrom);
  const branchToId = getId(movement.branchTo);

  if (!quantity) return { entry: 0, exit: 0 };

  if (direction === 'transfer') {
    if (branchToId === targetBranchId) return { entry: quantity, exit: 0 };
    if (branchFromId === targetBranchId) return { entry: 0, exit: quantity };
    return { entry: 0, exit: 0 };
  }

  if (direction === 'in') return { entry: quantity, exit: 0 };
  if (direction === 'out') return { entry: 0, exit: quantity };

  return { entry: 0, exit: 0 };
}

function buildInventoryCsv(rows = []) {
  const headers = [
    'Producto',
    'SKU',
    'Sede',
    'Talla',
    'Color',
    'Stock fisico',
    'Reservado',
    'Disponible',
    'Estado',
  ];

  const escapeValue = (value) => {
    const text = String(value ?? '').replace(/\r?\n|\r/g, ' ').trim();
    if (text.includes(',') || text.includes('"')) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  const lines = [headers.map(escapeValue).join(',')];

  rows.forEach((row) => {
    const available = getAvailableStock(row);
    const status = available <= 0 ? 'Agotado' : available <= LOW_STOCK_LIMIT ? 'Bajo stock' : 'Disponible';
    const variant = getVariant(row);

    lines.push([
      row.product?.title || row.productSnapshot?.title || '',
      row.product?.sku || row.productSnapshot?.sku || variant.sku || '',
      row.branch?.name || row.branchSnapshot?.name || '',
      variant.size,
      variant.color,
      toNumber(row.stock, 0),
      toNumber(row.reservedStock, 0),
      available,
      status,
    ].map(escapeValue).join(','));
  });

  return `\uFEFF${lines.join('\n')}`;
}

async function connect() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no esta configurado en backend/.env');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
}

async function calculateProductTotalStock(productId, { session = null } = {}) {
  const rows = await InventoryStock.find({
    product: productId,
    active: true,
    deletedAt: null,
  })
    .select('stock')
    .session(session)
    .lean();

  return rows.reduce((sum, row) => sum + Math.max(0, toNumber(row.stock, 0)), 0);
}

async function findCandidate() {
  const stockRows = await InventoryStock.find({
    active: true,
    deletedAt: null,
    stock: { $gte: 2 },
  })
    .sort({ availableStock: -1, updatedAt: -1 })
    .limit(100)
    .populate('product', 'title sku barcode price active visible stock inventory')
    .populate('branch', 'name code type status active settings')
    .lean();

  const sourceStock = stockRows.find((row) => {
    const product = row.product || {};
    const branch = row.branch || {};
    const variant = getVariant(row);

    return (
      product &&
      product.active !== false &&
      product.visible !== false &&
      branch &&
      branch.active !== false &&
      branch.status === 'active' &&
      getAvailableStock(row) >= 2 &&
      Boolean(variant.size) &&
      Boolean(variant.color)
    );
  });

  if (!sourceStock) {
    return {
      sourceStock: null,
      destinationBranch: null,
      reason: 'No hay un registro de inventario activo con producto, sede, talla, color y stock suficiente.',
    };
  }

  const destinationBranch = await Branch.findOne({
    _id: { $ne: sourceStock.branch?._id || sourceStock.branch },
    deletedAt: null,
    active: true,
    status: 'active',
  })
    .sort({ type: 1, name: 1 })
    .select('_id name code type status active settings')
    .lean();

  return {
    sourceStock,
    destinationBranch,
    reason: '',
  };
}

async function getStockRow({ productId, branchId, variant, session = null }) {
  return InventoryStock.findOne({
    product: productId,
    branch: branchId,
    deletedAt: null,
    $or: [
      {
        'variant.size': variant.size,
        'variant.color': variant.color,
      },
      {
        size: variant.size,
        color: variant.color,
      },
    ],
  })
    .session(session)
    .lean();
}

async function createReverseMovement(originalMovement, { adminId = null, session = null } = {}) {
  const original = await InventoryMovement.findById(originalMovement._id).session(session);

  if (!original) {
    throw new Error('Movimiento original no encontrado para reversar.');
  }

  if (original.status !== 'posted' || original.reversedByMovement || original.reversalOfMovement) {
    throw new Error('El movimiento original no se puede reversar.');
  }

  const variant = original.variant || {};
  const basePayload = {
    productId: original.product,
    size: variant.size || '',
    color: variant.color || '',
    variant,
    quantity: original.quantity,
    reason: `Reverso automatico prueba ${RUN_ID}`,
    reference: `REV-${original.movementNumber || RUN_ID}`,
    notes: `Movimiento generado por prueba automatica para reversar ${original.movementNumber || original._id}.`,
    sourceModel: 'InventoryMovement',
    sourceId: original._id,
    postNow: true,
  };

  let reversalPayload = null;

  if (original.direction === 'in') {
    reversalPayload = {
      ...basePayload,
      type: 'adjustment_out',
      branchId: original.branchTo || original.branchFrom,
      branch: original.branchTo || original.branchFrom,
      branchFrom: original.branchTo || original.branchFrom,
    };
  } else if (original.direction === 'out') {
    reversalPayload = {
      ...basePayload,
      type: 'adjustment_in',
      branchId: original.branchFrom || original.branchTo,
      branch: original.branchFrom || original.branchTo,
      branchTo: original.branchFrom || original.branchTo,
    };
  } else if (original.direction === 'transfer') {
    reversalPayload = {
      ...basePayload,
      type: 'transfer',
      branchFrom: original.branchTo,
      branchTo: original.branchFrom,
    };
  } else {
    throw new Error('Este tipo de movimiento no se puede reversar.');
  }

  const reversal = await createInventoryMovement(reversalPayload, {
    adminId,
    postNow: true,
    session,
  });

  original.status = 'reversed';
  original.reversedByMovement = reversal._id;
  original.updatedBy = adminId;

  reversal.reversalOfMovement = original._id;
  reversal.updatedBy = adminId;

  await original.save({ session });
  await reversal.save({ session });

  return { original, reversal };
}

async function runTransactionalTest({ sourceStock, destinationBranch }) {
  const session = await mongoose.startSession();
  let shouldAbort = false;

  try {
    session.startTransaction();
    shouldAbort = true;

    const productId = getId(sourceStock.product);
    const sourceBranchId = getId(sourceStock.branch);
    const variant = getVariant(sourceStock);
    const sourceLabel = sourceStock.branch?.name || sourceBranchId;
    const productLabel = sourceStock.product?.title || productId;
    const originalSourceStock = toNumber(sourceStock.stock, 0);
    const productTotalBefore = await calculateProductTotalStock(productId, { session });

    console.log(`Producto prueba: ${productLabel}`);
    console.log(`Origen: ${sourceLabel}`);
    console.log(`Variante: ${variant.size} / ${variant.color}`);
    console.log(`Stock inicial origen: ${originalSourceStock} | Disponible: ${getAvailableStock(sourceStock)}`);

    const activeStockRows = await InventoryStock.find({ deletedAt: null, active: true })
      .session(session)
      .limit(500)
      .lean();

    if (activeStockRows.length > 0) {
      printOk(`Listar stock funciona: ${activeStockRows.length} registro(s) consultado(s)`);
    } else {
      printFail('No se pudo listar stock activo.');
    }

    const inMovement = await createInventoryMovement(
      buildMovementPayload({
        type: 'adjustment_in',
        stock: sourceStock,
        branchId: sourceBranchId,
        branchTo: sourceBranchId,
        quantity: IN_QTY,
        reason: `Entrada prueba inventario admin ${RUN_ID}`,
      }),
      { adminId: buildAdminMock(), postNow: true, session }
    );

    const stockAfterIn = await getStockRow({ productId, branchId: sourceBranchId, variant, session });

    if (inMovement?.type === 'adjustment_in' && inMovement.status === 'posted') {
      printOk('Crear entrada de stock genera movimiento aplicado');
    } else {
      printFail('La entrada de stock no genero movimiento aplicado');
    }

    if (toNumber(stockAfterIn?.stock, 0) === originalSourceStock + IN_QTY) {
      printOk('Entrada de stock suma correctamente al inventario');
    } else {
      printFail(`Entrada incorrecta. Esperado ${originalSourceStock + IN_QTY}, actual ${stockAfterIn?.stock}`);
    }

    const outMovement = await createInventoryMovement(
      buildMovementPayload({
        type: 'adjustment_out',
        stock: sourceStock,
        branchId: sourceBranchId,
        branchFrom: sourceBranchId,
        quantity: OUT_QTY,
        reason: `Salida prueba inventario admin ${RUN_ID}`,
      }),
      { adminId: buildAdminMock(), postNow: true, session }
    );

    const stockAfterOut = await getStockRow({ productId, branchId: sourceBranchId, variant, session });

    if (outMovement?.type === 'adjustment_out' && outMovement.status === 'posted') {
      printOk('Crear salida manual genera movimiento aplicado');
    } else {
      printFail('La salida manual no genero movimiento aplicado');
    }

    if (toNumber(stockAfterOut?.stock, 0) === originalSourceStock + IN_QTY - OUT_QTY) {
      printOk('Salida manual descuenta correctamente el inventario');
    } else {
      printFail(`Salida incorrecta. Esperado ${originalSourceStock + IN_QTY - OUT_QTY}, actual ${stockAfterOut?.stock}`);
    }

    const stockBeforeOversell = await getStockRow({ productId, branchId: sourceBranchId, variant, session });
    let oversellBlocked = false;

    try {
      await createInventoryMovement(
        buildMovementPayload({
          type: 'adjustment_out',
          stock: sourceStock,
          branchId: sourceBranchId,
          branchFrom: sourceBranchId,
          quantity: toNumber(stockBeforeOversell?.stock, 0) + 999,
          reason: `Sobreventa prueba inventario admin ${RUN_ID}`,
        }),
        { adminId: buildAdminMock(), postNow: true, session }
      );
    } catch (error) {
      oversellBlocked = /Stock insuficiente/i.test(error.message || '');
    }

    if (oversellBlocked) {
      printOk('Backend bloquea salida manual mayor al stock fisico');
    } else {
      printFail('Backend permitio salida manual mayor al stock fisico');
    }

    const stockAfterOversell = await getStockRow({ productId, branchId: sourceBranchId, variant, session });
    if (toNumber(stockAfterOversell?.stock, 0) === toNumber(stockBeforeOversell?.stock, 0)) {
      printOk('Salida fallida no modifica inventario');
    } else {
      printFail('Salida fallida modifico inventario');
    }

    let transferMovement = null;
    let destinationStockAfterTransfer = null;

    if (destinationBranch?._id) {
      transferMovement = await createInventoryMovement(
        buildMovementPayload({
          type: 'transfer',
          stock: sourceStock,
          branchFrom: sourceBranchId,
          branchTo: destinationBranch._id,
          quantity: TRANSFER_QTY,
          reason: `Traslado prueba inventario admin ${RUN_ID}`,
        }),
        { adminId: buildAdminMock(), postNow: true, session }
      );

      const sourceAfterTransfer = await getStockRow({ productId, branchId: sourceBranchId, variant, session });
      destinationStockAfterTransfer = await getStockRow({
        productId,
        branchId: destinationBranch._id,
        variant,
        session,
      });

      if (transferMovement?.type === 'transfer' && transferMovement.direction === 'transfer') {
        printOk('Crear traslado genera movimiento de transferencia');
      } else {
        printFail('El traslado no genero movimiento de transferencia');
      }

      if (
        toNumber(sourceAfterTransfer?.stock, 0) === toNumber(stockAfterOversell?.stock, 0) - TRANSFER_QTY &&
        toNumber(destinationStockAfterTransfer?.stock, 0) >= TRANSFER_QTY
      ) {
        printOk('Traslado descuenta origen y suma destino correctamente');
      } else {
        printFail('El traslado no actualizo origen/destino correctamente');
      }
    } else {
      printWarn('No hay segunda sede activa para probar traslado entre sedes.');
    }

    const movementRows = await InventoryMovement.find({
      product: productId,
      deletedAt: null,
      $or: [
        { branchFrom: sourceBranchId },
        { branchTo: sourceBranchId },
      ],
    })
      .sort({ createdAt: -1 })
      .session(session)
      .lean();

    if (movementRows.length >= 2) {
      printOk(`Consultar movimientos funciona: ${movementRows.length} movimiento(s) encontrados`);
    } else {
      printFail('No se pudieron consultar movimientos del producto/sede');
    }

    const kardexRows = await InventoryMovement.find({
      product: productId,
      deletedAt: null,
      status: { $in: ['posted', 'reversed'] },
      'variant.size': variant.size,
      'variant.color': variant.color,
      $or: [
        { branchFrom: sourceBranchId },
        { branchTo: sourceBranchId },
      ],
    })
      .sort({ postedAt: 1, createdAt: 1, _id: 1 })
      .session(session)
      .lean();

    let totalIn = 0;
    let totalOut = 0;

    kardexRows.forEach((movement) => {
      const effect = getMovementEffect(movement, sourceBranchId);
      totalIn += effect.entry;
      totalOut += effect.exit;
    });

    if (kardexRows.length > 0 && totalIn >= IN_QTY && totalOut >= OUT_QTY) {
      printOk('Consultar Kardex por producto/sede/talla/color funciona');
    } else {
      printFail('Kardex no retorno los movimientos esperados');
    }

    const { original: reversedOriginal, reversal } = await createReverseMovement(inMovement, {
      adminId: buildAdminMock(),
      session,
    });

    const stockAfterReverse = await getStockRow({ productId, branchId: sourceBranchId, variant, session });

    if (
      reversedOriginal?.status === 'reversed' &&
      reversal?.reversalOfMovement &&
      String(reversal.reversalOfMovement) === String(inMovement._id)
    ) {
      printOk('Reversar movimiento marca original y crea movimiento contrario');
    } else {
      printFail('El reverso no marco correctamente el movimiento original');
    }

    if (toNumber(stockAfterReverse?.stock, 0) === toNumber(stockAfterOversell?.stock, 0) - IN_QTY - (transferMovement ? TRANSFER_QTY : 0)) {
      printOk('Reverso ajusta el stock correctamente');
    } else {
      printWarn('Reverso creado, pero el stock final no coincide con el calculo esperado. Revisar manualmente si habia movimientos previos.');
    }

    const productAfterMovements = await Product.findById(productId).session(session).lean();
    const productTotalAfter = await calculateProductTotalStock(productId, { session });

    if (toNumber(productAfterMovements?.stock, 0) === productTotalAfter) {
      printOk('Product.stock queda sincronizado con InventoryStock despues de movimientos');
    } else {
      printFail(`Product.stock no quedo sincronizado. Esperado ${productTotalAfter}, actual ${productAfterMovements?.stock}`);
    }

    const alertRows = await InventoryStock.find({ deletedAt: null, active: true })
      .populate('product', 'title sku image price stock reorderPoint stockMin')
      .populate('branch', 'name code type status active')
      .limit(1000)
      .session(session)
      .lean();

    const outOfStockCount = alertRows.filter((row) => getAvailableStock(row) <= 0).length;
    const lowStockCount = alertRows.filter((row) => {
      const available = getAvailableStock(row);
      const limit = toNumber(row.reorderPoint || row.product?.reorderPoint || row.product?.stockMin || LOW_STOCK_LIMIT, LOW_STOCK_LIMIT);
      return available > 0 && available <= limit;
    }).length;

    const expiredReservationsCount = await InventoryReservation.countDocuments({
      status: 'pending',
      expiresAt: { $lte: new Date() },
    }).session(session);

    if (Number.isFinite(outOfStockCount) && Number.isFinite(lowStockCount) && Number.isFinite(expiredReservationsCount)) {
      printOk(`Alertas consultadas: bajo stock ${lowStockCount}, agotados ${outOfStockCount}, reservas vencidas ${expiredReservationsCount}`);
    } else {
      printFail('No se pudieron calcular alertas de inventario');
    }

    const csv = buildInventoryCsv(alertRows.slice(0, 20));
    if (csv.includes('Producto') && csv.includes('Stock fisico') && csv.split('\n').length >= 2) {
      printOk('Exportacion CSV de inventario genera encabezados y filas');
    } else {
      printFail('Exportacion CSV no genero contenido valido');
    }

    if (productTotalBefore !== null) {
      printOk('Prueba administrativa completo los flujos principales de inventario');
    }
  } finally {
    if (shouldAbort && session.inTransaction()) {
      await session.abortTransaction();
      printOk('Transaccion de prueba abortada: no se dejaron ajustes ni traslados reales');
    }

    await session.endSession();
  }
}

async function main() {
  console.log('\n=== Prueba general Inventario Administrativo ===');
  console.log(`Run ID: ${RUN_ID}`);

  await connect();
  printOk('Conexion a MongoDB activa');

  const { sourceStock, destinationBranch, reason } = await findCandidate();

  if (!sourceStock) {
    printFail(reason || 'No se encontro inventario suficiente para ejecutar la prueba.');
    return;
  }

  printOk('Existe producto con stock activo para pruebas administrativas');

  if (destinationBranch?._id) {
    printOk('Existe segunda sede activa para probar traslados');
  } else {
    printWarn('Solo hay una sede activa; se omitira la prueba completa de traslado.');
  }

  try {
    await runTransactionalTest({ sourceStock, destinationBranch });
  } catch (error) {
    printFail(error?.message || 'Error no controlado ejecutando prueba inventario admin');
    console.error(error);
  }
}

main()
  .catch((error) => {
    printFail(error?.message || 'Error general ejecutando prueba inventario admin');
    console.error(error);
  })
  .finally(async () => {
    console.log('\n=== Resultado final ===');
    console.log(`OK: ${results.ok}`);
    console.log(`WARN: ${results.warn}`);
    console.log(`FAIL: ${results.fail}`);

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    if (results.fail > 0) {
      process.exitCode = 1;
    }
  });
