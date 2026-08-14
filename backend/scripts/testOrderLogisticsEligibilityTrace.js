/* eslint-disable no-console */
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');

const Order = require('../models/Order');
const {
  logisticsEligibility,
} = require('../services/orderLogisticsService');
const {
  summarizeInventoryAllocations,
} = require('../services/orderInventoryAllocationService');
const {
  assertPersistentConfirmation,
  buildCandidatePool,
} = require('./seedPersistentOrdersTrace');
const {
  BLOCKED_MESSAGE,
  ELIGIBILITY_SCENARIOS,
  assertExpectedEligibility,
  buildEligibilityOrderDraft,
  buildEligibilityRunId,
  buildEligibilityTracePlan,
  prepareOrderDocument,
} = require('./seedOrderLogisticsEligibilityTrace');

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

function stockFixture() {
  return {
    _id: '66aa00000000000000000031',
    active: true,
    deletedAt: null,
    availableStock: 8,
    branch: {
      _id: '66bb00000000000000000031',
      name: 'Sede de prueba',
      code: 'QA',
      type: 'store',
      active: true,
      status: 'active',
    },
    product: {
      _id: '66cc00000000000000000031',
      title: 'Producto físico de prueba',
      price: 125000,
      sku: 'SKU-QA-LOGISTICA',
      image: 'https://example.com/producto-qa.jpg',
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

function buildFixturePlan() {
  const candidates = buildCandidatePool([stockFixture()]);
  return buildEligibilityTracePlan({
    runId: 'ord_elig_control_20260814t041500z_090909',
    candidates,
    now: new Date('2026-08-14T04:15:00.000Z'),
  });
}

function orderFromEntry(entry) {
  return prepareOrderDocument(
    new Order(
      buildEligibilityOrderDraft(
        entry,
        'ord_elig_control_20260814t041500z_090909'
      )
    )
  );
}

async function main() {
  await test('exige confirmación explícita antes de conservar órdenes DEMO', () => {
    assert.throws(
      () => assertPersistentConfirmation({ confirmPersist: false }),
      /--confirm-persist/
    );
    assert.doesNotThrow(() =>
      assertPersistentConfirmation({ confirmPersist: true })
    );
  });

  await test('genera un identificador único y buscable para la prueba visual', () => {
    const runId = buildEligibilityRunId({
      now: new Date('2026-08-14T04:15:00.000Z'),
      label: 'Validación Logística',
      randomBytes: (size) => Buffer.alloc(size, 9),
    });
    assert.match(
      runId,
      /^ord_elig_validacion-logistica_20260814t041500z_090909$/
    );
  });

  await test('registra sedes y productos antes de poblar existencias', () => {
    assert(mongoose.modelNames().includes('Branch'));
    assert(mongoose.modelNames().includes('Product'));
    assert(mongoose.modelNames().includes('InventoryStock'));
  });

  await test('crea exactamente los escenarios bloqueado y habilitado', () => {
    const plan = buildFixturePlan();
    assert.equal(plan.length, 2);
    assert.deepEqual(
      plan.map((entry) => entry.key),
      ['eligibility_blocked', 'eligibility_ready']
    );
    assert.equal(plan[0].allocationState, 'released');
    assert.equal(plan[1].allocationState, 'sold');
    const digitalStock = stockFixture();
    digitalStock.product.productType = 'digital';
    assert.throws(
      () =>
        buildEligibilityTracePlan({
          runId: 'ord_elig_digital_20260814t041500z_090909',
          candidates: buildCandidatePool([digitalStock]),
        }),
      /existencia física elegible/
    );
  });

  await test('el escenario con pago pendiente queda bloqueado con el mensaje exacto', () => {
    const entry = buildFixturePlan()[0];
    const order = orderFromEntry(entry);
    const eligibility = assertExpectedEligibility(order, entry);
    assert.equal(eligibility.canInitialize, false);
    assert.equal(
      eligibility.code,
      'ORDER_PAYMENT_REQUIRED_FOR_LOGISTICS'
    );
    assert.equal(eligibility.message, BLOCKED_MESSAGE);
    assert.equal(order.inventoryAllocations[0].soldQuantity, 0);
    assert.equal(order.inventoryAllocations[0].releasedQuantity, 1);
  });

  await test('el escenario pagado conserva inventario vendido y habilita la preparación', () => {
    const entry = buildFixturePlan()[1];
    const order = orderFromEntry(entry);
    const eligibility = logisticsEligibility(order);
    assert.equal(eligibility.canInitialize, true);
    assert.equal(eligibility.code, null);
    assert.equal(eligibility.branchCount, 1);
    assert.equal(eligibility.soldQuantity, 1);
    assert.equal(order.inventoryAllocations[0].soldQuantity, 1);
    assert.equal(order.fulfillment.shipments.length, 0);
  });

  await test('las dos órdenes cumplen el modelo real y quedan marcadas como DEMO', async () => {
    for (const entry of buildFixturePlan()) {
      const order = orderFromEntry(entry);
      order.inventoryAllocationSummary = summarizeInventoryAllocations(
        order.inventoryAllocations
      );
      await order.validate();
      assert(order.tags.includes('demo'));
      assert(order.tags.includes('logistics-eligibility'));
      assert.match(order.notes[0].text, /no facturar ni despachar/i);
      assert.equal(order.payment.mode, 'sandbox');
      assert.equal(order.payment.provider, 'manual');
      assert.equal(order.inventoryControl.discountedAtCheckout, false);
    }
  });

  await test('el simulador no borra ni llama sistemas externos o transiciones logísticas', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'seedOrderLogisticsEligibilityTrace.js'),
      'utf8'
    );
    assert.doesNotMatch(
      source,
      /\.(?:deleteOne|deleteMany|findOneAndDelete|findByIdAndDelete|drop)\s*\(/
    );
    assert.doesNotMatch(
      source,
      /(?:initializeOrderLogistics|updateOrderShipment|wompi|payu|factus|axios|fetch\s*\()/i
    );
    assert.doesNotMatch(
      source,
      /(?:InventoryStock|Product|Branch|CashSession|CashRegister|ElectronicInvoice)\.(?:create|insertMany|updateOne|updateMany|findOneAndUpdate|bulkWrite)\s*\(/
    );
  });

  await test('el comando, la guía y CI conservan el contrato profesional', () => {
    const root = path.join(__dirname, '..', '..');
    const packageSource = fs.readFileSync(
      path.join(root, 'backend', 'package.json'),
      'utf8'
    );
    const workflowSource = fs.readFileSync(
      path.join(root, '.github', 'workflows', 'products-ci.yml'),
      'utf8'
    );
    const scriptSource = fs.readFileSync(
      path.join(__dirname, 'seedOrderLogisticsEligibilityTrace.js'),
      'utf8'
    );
    assert(packageSource.includes('demo:orders-logistics-eligibility'));
    assert(packageSource.includes('test:orders-logistics-eligibility-trace'));
    assert(workflowSource.includes('test:orders-logistics-eligibility-trace'));
    assert(scriptSource.includes('Abre Administración > Órdenes'));
    assert(scriptSource.includes('Pulsa "Preparar logística"'));
    assert(scriptSource.includes('assertPersistentConfirmation(options)'));
  });

  assert.equal(ELIGIBILITY_SCENARIOS.length, 2);
  console.log(
    `\nPrueba visual de elegibilidad logística: ${results.ok}/${results.ok + results.fail} controles superados.`
  );
  if (results.fail) process.exitCode = 1;
}

main();
