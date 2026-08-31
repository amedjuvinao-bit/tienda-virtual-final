/* eslint-disable no-console */
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const {
  BASE_SCENARIOS,
  actionPayload,
  assertPersistentConfirmation,
  buildCandidatePool,
  buildOrderDraft,
  buildOrderNumber,
  buildRunId,
  buildTracePlan,
  parseArgs,
} = require('./seedPersistentOrdersTrace');
const Order = require('../models/Order');
const {
  summarizeInventoryAllocations,
} = require('../services/orderInventoryAllocationService');

const results = { ok: 0, fail: 0 };

async function test(name, callback) {
  try {
    await callback();
    results.ok += 1;
    console.log(`OK ${results.ok}: ${name}`);
  } catch (error) {
    results.fail += 1;
    console.error(`FAIL: ${name}`);
    console.error(`      ${error.message}`);
  }
}

function fixedBytes(size) {
  return Buffer.alloc(size, 9);
}

function stockFixture({ stockId, branchId, branchCode, productId, title, price }) {
  return {
    _id: stockId,
    active: true,
    deletedAt: null,
    availableStock: 8,
    branch: {
      _id: branchId,
      name: `Sede ${branchCode}`,
      code: branchCode,
      type: 'store',
      active: true,
      status: 'active',
    },
    product: {
      _id: productId,
      title,
      price,
      sku: `SKU-${productId}`,
      image: `https://example.com/${productId}.jpg`,
      category: 'Demo',
      productType: 'physical',
      active: true,
      visible: true,
      variants: [],
    },
    variantKey: 'default__default',
    variant: { size: '', color: '', attributes: [] },
  };
}

const STOCKS = [
  stockFixture({
    stockId: '66aa00000000000000000001',
    branchId: '66bb00000000000000000001',
    branchCode: 'NORTE',
    productId: '66cc00000000000000000001',
    title: 'Producto Norte',
    price: 120000,
  }),
  stockFixture({
    stockId: '66aa00000000000000000002',
    branchId: '66bb00000000000000000002',
    branchCode: 'SUR',
    productId: '66cc00000000000000000002',
    title: 'Producto Sur',
    price: 180000,
  }),
];

async function main() {
  await test('exige confirmación explícita porque las órdenes se conservan', () => {
    assert.throws(
      () => assertPersistentConfirmation({ confirmPersist: false }),
      /--confirm-persist/
    );
    assert.doesNotThrow(() => assertPersistentConfirmation({ confirmPersist: true }));
  });

  await test('limita el catálogo y normaliza la etiqueta trazable', () => {
    const options = parseArgs([
      '--confirm-persist',
      '--stock-limit=650',
      '--label=Operación Agosto',
    ]);
    assert.equal(options.stockLimit, 650);
    assert.equal(options.label, 'operacion-agosto');
    assert.equal(options.confirmPersist, true);
    assert.throws(() => parseArgs(['--stock-limit=2']), /stock-limit/);
    assert.throws(() => parseArgs(['--stock-limit=9000']), /stock-limit/);
  });

  await test('produce identificadores únicos, buscables y estables', () => {
    const runId = buildRunId({
      now: new Date('2026-08-13T21:30:40.000Z'),
      label: 'QA Órdenes',
      randomBytes: fixedBytes,
    });
    assert.match(runId, /^ord_trace_qa-ordenes_20260813t213040z_/);
    const numbers = BASE_SCENARIOS.map((_, index) => buildOrderNumber(runId, index + 1));
    assert.equal(new Set(numbers).size, BASE_SCENARIOS.length);
    numbers.forEach((number) => assert.match(number, /^OTR-20260813213040-/));
  });

  await test('selecciona existencias válidas sin inventar sedes ni productos', () => {
    const pool = buildCandidatePool([
      ...STOCKS,
      { ...STOCKS[0], _id: 'inactivo', active: false },
      { ...STOCKS[0], _id: 'sin-stock', availableStock: 0, stock: 0 },
    ]);
    assert.equal(pool.length, 2);
    assert.deepEqual(pool.map((item) => item.branch.code), ['NORTE', 'SUR']);
    assert.deepEqual(pool.map((item) => item.product.price), [120000, 180000]);
  });

  await test('genera cinco recorridos y añade multisede solo con dos sedes reales', () => {
    const runId = 'ord_trace_control_20260813t213040z_090909';
    const twoBranches = buildCandidatePool(STOCKS);
    const fullPlan = buildTracePlan({
      runId,
      candidates: twoBranches,
      now: new Date('2026-08-13T21:30:40.000Z'),
    });
    assert.deepEqual(
      fullPlan.slice(0, 5).map((item) => item.key),
      BASE_SCENARIOS.map((item) => item.key)
    );
    assert.equal(fullPlan.length, 6);
    assert.equal(fullPlan.at(-1).multiBranch, true);
    assert.equal(new Set(fullPlan.at(-1).candidates.map((item) => item.branch.id)).size, 2);

    const oneBranchPlan = buildTracePlan({ runId, candidates: [twoBranches[0]] });
    assert.equal(oneBranchPlan.length, 5);
    assert.equal(oneBranchPlan.some((item) => item.multiBranch), false);
  });

  await test('construye órdenes DEMO sin simular dinero, caja, DIAN o descuento de inventario', () => {
    const runId = 'ord_trace_control_20260813t213040z_090909';
    const candidates = buildCandidatePool(STOCKS);
    const entry = buildTracePlan({ runId, candidates })[1];
    const draft = buildOrderDraft(entry, runId);
    assert.equal(draft.source, 'system');
    assert.equal(draft.channel, 'system');
    assert.equal(draft.saleType, 'system_order');
    assert.equal(draft.payment.mode, 'sandbox');
    assert.equal(draft.payment.provider, 'manual');
    assert.equal(draft.payment.enableWebhook, false);
    assert.equal(draft.inventoryControl.discountedAtCheckout, false);
    assert.match(draft.customer.name, new RegExp(runId));
    assert.match(draft.notes[0].text, /no facturar ni despachar/i);
    assert.equal(draft.inventoryAllocations[0].soldQuantity, 1);
  });

  await test('cada borrador cumple el modelo real de Orden y sus asignaciones', async () => {
    const runId = 'ord_trace_modelo_20260813t213040z_090909';
    const candidates = buildCandidatePool(STOCKS);
    const plan = buildTracePlan({ runId, candidates });
    for (const entry of plan) {
      const order = new Order(buildOrderDraft(entry, runId));
      order.inventoryAllocations.forEach((allocation, index) => {
        allocation.orderItem = order.items[index]?._id || order.items[0]?._id || null;
      });
      order.inventoryAllocationSummary = summarizeInventoryAllocations(
        order.inventoryAllocations
      );
      await order.validate();
      assert.equal(order.items.length, entry.candidates.length);
      assert.equal(order.inventoryAllocationSummary.branchCount, entry.candidates.length);
    }
  });

  await test('recorre picking, empaque, despacho, tránsito, entrega e incidencia con evidencia DEMO', () => {
    const transit = BASE_SCENARIOS.find((item) => item.key === 'in_transit');
    const delivered = BASE_SCENARIOS.find((item) => item.key === 'delivered');
    const incident = BASE_SCENARIOS.find((item) => item.key === 'logistics_incident');
    assert.deepEqual(transit.actions.slice(0, 4), [
      'start_picking',
      'complete_picking',
      'start_packing',
      'complete_packing',
    ]);
    assert(transit.actions.includes('dispatch'));
    assert(transit.actions.includes('mark_in_transit'));
    assert(delivered.actions.includes('deliver'));
    assert.deepEqual(incident.actions, ['report_incident']);
    assert.match(actionPayload('dispatch', transit, 'trace').dispatchReference, /DEMO/);
    assert.match(actionPayload('deliver', delivered, 'trace').deliveryReference, /DEMO/);
  });

  await test('el script no borra registros ni muta inventario, productos, sedes, caja o facturación', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'seedPersistentOrdersTrace.js'),
      'utf8'
    );
    assert.doesNotMatch(
      source,
      /\.(?:deleteOne|deleteMany|findOneAndDelete|findByIdAndDelete|drop)\s*\(/
    );
    assert.doesNotMatch(
      source,
      /(?:InventoryStock|Product|Branch|CashSession|CashRegister|ElectronicInvoice)\.(?:create|insertMany|updateOne|updateMany|findOneAndUpdate|bulkWrite)\s*\(/
    );
    assert.doesNotMatch(source, /(?:wompi|payu|factus).*(?:request|fetch|axios)/i);
  });

  console.log(`\nÓrdenes trazables: ${results.ok} controles superados.`);
  if (results.fail) process.exitCode = 1;
}

main();
