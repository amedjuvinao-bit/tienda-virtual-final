/* eslint-disable no-console */
'use strict';

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const crypto = require('crypto');
const mongoose = require('mongoose');

require('../models/Branch');
require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const Order = require('../models/Order');
const {
  resolveVariantCommercialSnapshot,
} = require('../lib/products/productVariantConfig');
const {
  summarizeInventoryAllocations,
} = require('../services/orderInventoryAllocationService');
const {
  initializeOrderLogistics,
  updateOrderShipment,
} = require('../services/orderLogisticsService');

const BASE_SCENARIOS = Object.freeze([
  Object.freeze({
    key: 'payment_pending',
    label: 'Pago pendiente y reserva liberada',
    status: 'pending',
    paymentStatus: 'pending_gateway',
    allocationState: 'released',
    actions: [],
  }),
  Object.freeze({
    key: 'ready_to_pick',
    label: 'Pago confirmado, lista para picking',
    status: 'paid',
    paymentStatus: 'paid',
    allocationState: 'sold',
    actions: [],
  }),
  Object.freeze({
    key: 'logistics_incident',
    label: 'Incidencia logística abierta',
    status: 'paid',
    paymentStatus: 'paid',
    allocationState: 'sold',
    actions: ['report_incident'],
  }),
  Object.freeze({
    key: 'in_transit',
    label: 'Envío despachado y en tránsito',
    status: 'paid',
    paymentStatus: 'paid',
    allocationState: 'sold',
    actions: [
      'start_picking',
      'complete_picking',
      'start_packing',
      'complete_packing',
      'dispatch',
      'mark_in_transit',
    ],
  }),
  Object.freeze({
    key: 'delivered',
    label: 'Entrega completada con evidencia',
    status: 'paid',
    paymentStatus: 'paid',
    allocationState: 'sold',
    actions: [
      'start_picking',
      'complete_picking',
      'start_packing',
      'complete_packing',
      'dispatch',
      'mark_in_transit',
      'deliver',
    ],
  }),
]);

const MULTI_BRANCH_SCENARIO = Object.freeze({
  key: 'multi_branch_ready',
  label: 'Orden multisede lista para preparar',
  status: 'paid',
  paymentStatus: 'paid',
  allocationState: 'sold',
  actions: [],
  multiBranch: true,
});

const DEFAULT_OPTIONS = Object.freeze({
  stockLimit: 400,
  label: '',
  confirmPersist: false,
});

function cleanText(value, maxLength = 240) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function idValue(value) {
  return String(value?._id || value || '').trim();
}

function optionValue(argv, name) {
  const prefix = `--${name}=`;
  const entry = argv.find((value) => String(value).startsWith(prefix));
  return entry ? String(entry).slice(prefix.length) : undefined;
}

function boundedInteger(value, fallback, { name, min, max }) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max}.`);
  }
  return parsed;
}

function normalizeLabel(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  if (value && !normalized) {
    throw new Error('La etiqueta debe contener letras o números.');
  }
  return normalized;
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    stockLimit: boundedInteger(
      optionValue(argv, 'stock-limit'),
      DEFAULT_OPTIONS.stockLimit,
      { name: 'stock-limit', min: 20, max: 2000 }
    ),
    label: normalizeLabel(optionValue(argv, 'label')),
    confirmPersist: argv.includes('--confirm-persist'),
  };
}

function assertPersistentConfirmation(options) {
  if (options?.confirmPersist) return;
  const error = new Error(
    'Esta simulación conserva las órdenes. Repite el comando con --confirm-persist.'
  );
  error.code = 'ORDERS_TRACE_CONFIRMATION_REQUIRED';
  throw error;
}

function utcStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'z').toLowerCase();
}

function buildRunId({ now = new Date(), label = '', randomBytes = crypto.randomBytes } = {}) {
  return [
    'ord_trace',
    normalizeLabel(label),
    utcStamp(now),
    randomBytes(3).toString('hex'),
  ]
    .filter(Boolean)
    .join('_')
    .slice(0, 82);
}

function buildOrderNumber(runId, sequence) {
  const stamp = String(runId).match(/\d{8}t\d{6}z/)?.[0] || utcStamp();
  const suffix = String(runId).split('_').pop().slice(-6).toUpperCase();
  return `OTR-${stamp.replace(/[tz]/g, '').toUpperCase()}-${String(sequence).padStart(2, '0')}-${suffix}`;
}

function branchView(stock = {}) {
  const branch = stock.branch && typeof stock.branch === 'object' ? stock.branch : {};
  return {
    id: idValue(branch._id || stock.branch),
    name: cleanText(branch.name || stock.branchSnapshot?.name || 'Sede sin nombre', 160),
    code: cleanText(branch.code || stock.branchSnapshot?.code || 'SEDE', 40).toUpperCase(),
    type: cleanText(branch.type || stock.branchSnapshot?.type || 'store', 40).toLowerCase(),
    active: branch.active !== false && branch.status !== 'inactive' && !branch.deletedAt,
  };
}

function productView(stock = {}) {
  const product = stock.product && typeof stock.product === 'object' ? stock.product : {};
  const variant = stock.variant || {};
  const commercial = resolveVariantCommercialSnapshot(product, {
    variantKey: stock.variantKey,
    size: variant.size,
    color: variant.color,
    variantAttributes: variant.attributes || [],
  });
  const category = cleanText(
    product.category || stock.productSnapshot?.category || '',
    120
  );
  return {
    id: idValue(product._id || stock.product),
    title: cleanText(product.title || stock.productSnapshot?.title || 'Producto demostrativo', 220),
    sku: cleanText(commercial.sku || product.sku || stock.productSnapshot?.sku, 100).toUpperCase(),
    image: cleanText(commercial.image || product.image || stock.productSnapshot?.image, 1000),
    category,
    categories: Array.from(
      new Set([category, ...(Array.isArray(product.categories) ? product.categories : [])].filter(Boolean))
    ),
    price: Math.max(1000, Number(commercial.price || product.price || 0)),
    productType: cleanText(product.productType || 'physical', 40).toLowerCase(),
    active: product.active !== false && product.visible !== false && !product.archivedAt,
    variantKey: commercial.variantKey || stock.variantKey || 'default__default',
    variantLabel: cleanText(commercial.variantLabel || variant.label, 180),
    variantAttributes: commercial.variantAttributes || variant.attributes || [],
    variantSku: cleanText(commercial.sku || variant.sku || product.sku, 120).toUpperCase(),
    variantBarcode: cleanText(commercial.barcode || variant.barcode || product.barcode, 120),
    size: cleanText(variant.size, 80),
    color: cleanText(variant.color, 80),
  };
}

function buildCandidatePool(stocks = []) {
  const seen = new Set();
  return (Array.isArray(stocks) ? stocks : []).flatMap((stock) => {
    const stockId = idValue(stock?._id);
    const branch = branchView(stock);
    const product = productView(stock);
    if (
      !stockId ||
      !branch.id ||
      !product.id ||
      !branch.active ||
      !product.active ||
      stock.active === false ||
      stock.deletedAt ||
      Number(stock.availableStock ?? stock.stock ?? 0) <= 0 ||
      seen.has(stockId)
    ) {
      return [];
    }
    seen.add(stockId);
    return [{
      stockId,
      branch,
      product,
      warehouseLocation: cleanText(stock.warehouseLocation, 120),
    }];
  });
}

function selectDifferentBranches(candidates = []) {
  const selected = [];
  const branchIds = new Set();
  for (const candidate of candidates) {
    if (branchIds.has(candidate.branch.id)) continue;
    selected.push(candidate);
    branchIds.add(candidate.branch.id);
    if (selected.length === 2) break;
  }
  return selected;
}

function buildTracePlan({ runId, candidates, now = new Date() } = {}) {
  if (!runId) throw new Error('Falta el identificador de la ejecución.');
  if (!Array.isArray(candidates) || candidates.length < 1) {
    throw new Error('Se necesita al menos una existencia física elegible.');
  }

  const plan = BASE_SCENARIOS.map((scenario, index) => ({
    ...scenario,
    sequence: index + 1,
    candidates: [candidates[index % candidates.length]],
    activityAt: new Date(now.getTime() - index * 6 * 60 * 60 * 1000),
  }));
  const multiBranchCandidates = selectDifferentBranches(candidates);
  if (multiBranchCandidates.length === 2) {
    plan.push({
      ...MULTI_BRANCH_SCENARIO,
      sequence: plan.length + 1,
      candidates: multiBranchCandidates,
      activityAt: new Date(now.getTime() - 30 * 60 * 1000),
    });
  }
  return plan;
}

function itemFromCandidate(candidate) {
  const { product } = candidate;
  return {
    product: product.id,
    productId: product.id,
    title: product.title,
    image: product.image,
    color: product.color,
    colorLabel: product.color,
    size: product.size,
    qty: 1,
    quantity: 1,
    price: product.price,
    unitPrice: product.price,
    priceNumber: product.price,
    variantId: product.variantKey,
    variantKey: product.variantKey,
    variantLabel: product.variantLabel,
    variantAttributes: product.variantAttributes,
    variantSku: product.variantSku,
    variantBarcode: product.variantBarcode,
    category: product.category,
    categories: product.categories,
    productType: 'physical',
    requiresShipping: true,
    fulfillmentKind: 'shipment',
    fulfillmentSnapshot: {
      productType: 'physical',
      kind: 'shipment',
      requiresShipping: true,
    },
    lineSubtotal: product.price,
    taxableBase: product.price,
    lineTotal: product.price,
  };
}

function allocationFromCandidate(candidate, state, activityAt) {
  const sold = state === 'sold';
  const released = state === 'released';
  return {
    inventoryStock: candidate.stockId,
    branch: candidate.branch.id,
    branchSnapshot: {
      name: candidate.branch.name,
      code: candidate.branch.code,
      type: candidate.branch.type,
    },
    product: candidate.product.id,
    productSnapshot: {
      title: candidate.product.title,
      sku: candidate.product.variantSku || candidate.product.sku,
      image: candidate.product.image,
      category: candidate.product.category,
    },
    size: candidate.product.size,
    color: candidate.product.color,
    colorLabel: candidate.product.color,
    variantKey: candidate.product.variantKey,
    variantLabel: candidate.product.variantLabel,
    variantAttributes: candidate.product.variantAttributes,
    quantity: 1,
    reservedQuantity: 1,
    soldQuantity: sold ? 1 : 0,
    shippedQuantity: 0,
    deliveredQuantity: 0,
    returnedQuantity: 0,
    releasedQuantity: released ? 1 : 0,
    status: sold ? 'sold' : released ? 'released' : 'reserved',
    reservedAt: new Date(activityAt.getTime() - 15 * 60 * 1000),
    soldAt: sold ? activityAt : null,
    releasedAt: released ? activityAt : null,
  };
}

function buildOrderDraft(entry, runId) {
  const items = entry.candidates.map(itemFromCandidate);
  const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const paid = entry.paymentStatus === 'paid';
  const first = entry.candidates[0];
  const traceName = `DEMO ${entry.label} · ${runId}`;
  const reference = `DEMO-${runId}-${String(entry.sequence).padStart(2, '0')}`.toUpperCase();
  return {
    sessionId: `${runId}_${entry.key}`.slice(0, 120),
    orderNumber: buildOrderNumber(runId, entry.sequence),
    status: entry.status,
    fulfillmentStatus: paid ? 'reserved' : 'pending',
    branch: first.branch.id,
    branchSnapshot: {
      name: first.branch.name,
      code: first.branch.code,
      type: first.branch.type,
    },
    source: 'system',
    channel: 'system',
    saleType: 'system_order',
    tags: ['demo', 'orders-trace', entry.key.replace(/_/g, '-')],
    customer: {
      name: traceName,
      email: `orders-trace+${entry.sequence}@example.com`,
      emailOrPhone: `orders-trace+${entry.sequence}@example.com`,
      phone: '3000000000',
      address: 'Dirección demostrativa, no despachar',
      city: 'Bogotá',
      country: 'Colombia',
      countryCode: 'CO',
    },
    billing: {
      name: traceName,
      email: `orders-trace+${entry.sequence}@example.com`,
      address: 'Documento demostrativo, no facturar',
      city: 'Bogotá',
      country: 'Colombia',
      countryCode: 'CO',
    },
    items,
    cart: items.map((item) => ({
      productId: item.productId,
      title: item.title,
      image: item.image,
      color: item.color,
      colorLabel: item.colorLabel,
      size: item.size,
      variantId: item.variantId,
      variantKey: item.variantKey,
      variantLabel: item.variantLabel,
      variantAttributes: item.variantAttributes,
      quantity: item.quantity,
      price: item.price,
    })),
    inventoryAllocations: entry.candidates.map((candidate) =>
      allocationFromCandidate(candidate, entry.allocationState, entry.activityAt)
    ),
    summary: {
      itemsCount: items.length,
      totalItems: items.length,
      subtotal,
    },
    subtotal,
    shipping: 0,
    total: subtotal,
    payment: {
      active: true,
      provider: 'manual',
      providerLabel: 'Simulación interna',
      mode: 'sandbox',
      currency: 'COP',
      checkoutLabel: 'TRAZA DEMO — sin movimiento real de dinero',
      enableWebhook: false,
      status: entry.paymentStatus,
      methodType: 'demo',
      method: 'demo',
      methodLabel: 'Pago simulado',
      transactionId: paid ? reference : '',
      reference,
      amount: subtotal,
      amountInCents: Math.round(subtotal * 100),
      paidAt: paid ? entry.activityAt : null,
    },
    inventoryControl: {
      reservationRequired: false,
      reservationId: null,
      discountedAtCheckout: false,
      restockedOnFailure: false,
      restockedAt: null,
    },
    timeline: [{
      type: 'system',
      message: `Traza persistente creada: ${entry.label}. No afecta inventario, caja, pasarela ni DIAN.`,
      by: 'orders-trace-script',
      at: entry.activityAt,
    }],
    notes: [{
      text: `SIMULACIÓN PERSISTENTE ${runId}. Datos demostrativos; no facturar ni despachar físicamente.`,
      by: 'orders-trace-script',
      pinned: true,
      at: entry.activityAt,
    }],
    createdAt: entry.activityAt,
    updatedAt: entry.activityAt,
  };
}

function actionPayload(action, entry, runId) {
  const reference = `${runId}-${entry.key}`.toUpperCase();
  if (action === 'report_incident') {
    return {
      incidentType: 'delay',
      severity: 'high',
      description: `Incidencia DEMO persistente ${runId}: retraso simulado para validar la cola operativa.`,
      note: 'Incidencia de demostración; no corresponde a un envío real.',
    };
  }
  if (action === 'dispatch') {
    return {
      carrier: {
        code: 'DEMO',
        name: 'Transportadora DEMO',
        serviceLevel: 'Simulación',
        trackingNumber: reference,
        trackingUrl: '',
      },
      dispatchReference: `MANIFIESTO-DEMO-${reference}`,
      note: 'Despacho simulado sin entrega física.',
    };
  }
  if (action === 'deliver') {
    return {
      deliveryReference: `POD-DEMO-${reference}`,
      recipient: 'Cliente de demostración',
      note: 'Entrega simulada con evidencia ficticia.',
    };
  }
  return { note: `Transición DEMO ${action} para ${runId}.` };
}

async function loadCandidates(limit) {
  const stocks = await InventoryStock.find({
    active: { $ne: false },
    deletedAt: null,
    $or: [{ availableStock: { $gt: 0 } }, { stock: { $gt: 0 } }],
  })
    .sort({ availableStock: -1, updatedAt: -1, _id: -1 })
    .limit(limit)
    .populate('branch')
    .populate('product')
    .lean()
    .exec();
  return buildCandidatePool(stocks);
}

async function applyScenarioLogistics(order, entry, runId) {
  if (entry.paymentStatus !== 'paid') return order;
  const actor = {
    displayName: 'Simulador persistente de Órdenes',
    role: 'system',
    source: 'system',
  };
  let current = (
    await initializeOrderLogistics({
      orderFilter: { _id: order._id },
      actor,
      now: entry.activityAt,
      allowAllBranches: true,
    })
  ).order;

  for (const shipment of [...current.fulfillment.shipments]) {
    let shipmentId = shipment._id;
    let revision = Number(shipment.revision || 0);
    for (const [index, action] of entry.actions.entries()) {
      const result = await updateOrderShipment({
        orderFilter: { _id: order._id },
        shipmentId,
        action,
        expectedRevision: revision,
        payload: actionPayload(action, entry, runId),
        actor,
        now: new Date(entry.activityAt.getTime() + (index + 1) * 7 * 60 * 1000),
        allowAllBranches: true,
      });
      shipmentId = result.shipment._id;
      revision = Number(result.shipment.revision || 0);
      current = result.order;
    }
  }
  return current;
}

async function persistTraceEntry(entry, runId) {
  const order = new Order(buildOrderDraft(entry, runId));
  order.inventoryAllocations.forEach((allocation, index) => {
    allocation.orderItem = order.items[index]?._id || order.items[0]?._id || null;
  });
  order.inventoryAllocationSummary = summarizeInventoryAllocations(
    order.inventoryAllocations
  );
  await order.save();
  await applyScenarioLogistics(order, entry, runId);

  const persisted = await Order.findById(order._id).lean().exec();
  if (!persisted || persisted.sessionId !== `${runId}_${entry.key}`.slice(0, 120)) {
    throw new Error(`No se pudo verificar la orden ${entry.label}.`);
  }
  return persisted;
}

function money(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function shipmentSummary(order) {
  const shipments = order?.fulfillment?.shipments || [];
  if (!shipments.length) return 'sin envío operativo';
  const states = shipments.map((shipment) => shipment.status).join(', ');
  return `${shipments.length} envío(s): ${states}`;
}

async function run(options = parseArgs()) {
  assertPersistentConfirmation(options);
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI || '';
  if (!mongoUri) {
    throw new Error('Falta MONGODB_URI, MONGO_URI o DB_URI en backend/.env.');
  }

  await mongoose.connect(mongoUri);
  const now = new Date();
  const runId = buildRunId({ now, label: options.label });
  const beforeCount = await Order.countDocuments({}).exec();
  const candidates = await loadCandidates(options.stockLimit);
  if (!candidates.length) {
    throw new Error('No hay existencias activas con producto y sede válidos para la simulación.');
  }
  const plan = buildTracePlan({ runId, candidates, now });

  console.log('\n=== Simulación persistente de Órdenes ===');
  console.log(`Base: ${mongoose.connection.name}`);
  console.log(`Host: ${mongoose.connection.host}`);
  console.log(`Ejecución trazable: ${runId}`);
  console.log(`Existencias elegibles: ${candidates.length}`);
  console.log(`Sedes elegibles: ${new Set(candidates.map((item) => item.branch.id)).size}`);
  console.log('Seguridad: no modifica inventario, caja, pasarelas ni documentos fiscales.');
  console.log('Persistencia: no se ejecutará limpieza automática.\n');

  const created = [];
  for (const entry of plan) {
    const order = await persistTraceEntry(entry, runId);
    created.push(order);
    console.log(
      `OK ${String(entry.sequence).padStart(2, '0')} | ${entry.label}` +
        ` | ${money(order.total)} | ${shipmentSummary(order)} | ${order.orderNumber}`
    );
  }

  const ids = created.map((order) => order._id);
  const verified = await Order.countDocuments({ _id: { $in: ids } }).exec();
  const afterCount = await Order.countDocuments({}).exec();
  if (verified !== created.length || afterCount < beforeCount + created.length) {
    throw new Error('La verificación final de persistencia no coincide con la simulación.');
  }

  const hasMultiBranch = plan.some((entry) => entry.multiBranch);
  console.log('\n=== Resultado ===');
  console.log(`Órdenes creadas y verificadas: ${verified}`);
  console.log(`Documentos antes/después: ${beforeCount} -> ${afterCount}`);
  console.log(`Escenario multisede: ${hasMultiBranch ? 'CREADO con dos sedes existentes' : 'OMITIDO; solo había una sede elegible'}`);
  console.log(`Buscar en el panel: ${runId}`);
  console.log('Persistencia: CONSERVADA (sin limpieza).');

  return { runId, created: verified, beforeCount, afterCount, hasMultiBranch };
}

async function main() {
  try {
    await run(parseArgs());
  } catch (error) {
    console.error(`\nERROR: ${error.message}`);
    console.error('Toda orden que haya alcanzado a guardarse se conserva para trazabilidad.');
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

if (require.main === module) main();

module.exports = {
  BASE_SCENARIOS,
  DEFAULT_OPTIONS,
  MULTI_BRANCH_SCENARIO,
  actionPayload,
  applyScenarioLogistics,
  assertPersistentConfirmation,
  buildCandidatePool,
  buildOrderDraft,
  buildOrderNumber,
  buildRunId,
  buildTracePlan,
  loadCandidates,
  normalizeLabel,
  parseArgs,
  run,
  selectDifferentBranches,
};
