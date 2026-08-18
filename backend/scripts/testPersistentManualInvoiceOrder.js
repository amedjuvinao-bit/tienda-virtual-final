/* eslint-disable no-console */
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const Order = require('../models/Order');
const {
  buildOrderDraft,
  buildTraceIdentity,
  parseArgs,
} = require('./seedPersistentManualInvoiceOrder');

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
  return Buffer.alloc(size, 7);
}

function candidateFixture() {
  return {
    stockId: '66aa00000000000000000001',
    branch: {
      id: '66bb00000000000000000001',
      name: 'Sede Principal',
      code: 'PRINCIPAL',
      type: 'store',
    },
    product: {
      id: '66cc00000000000000000001',
      title: 'Producto para factura manual',
      sku: 'SKU-MANUAL',
      price: 161600,
      productType: 'physical',
      variantKey: 'default__default',
      variantAttributes: [],
      categories: ['Pruebas'],
    },
  };
}

async function main() {
  await test('exige confirmación porque la orden no se elimina', () => {
    assert.equal(parseArgs([]).confirmPersist, false);
    assert.equal(parseArgs(['--confirm-persist']).confirmPersist, true);
    assert.equal(
      parseArgs(['--resume-order=FM-20260818014330-4C50A0']).resumeOrder,
      'FM-20260818014330-4C50A0'
    );
    assert.throws(() => parseArgs(['--stock-limit=3']), /stock-limit/);
    assert.throws(() => parseArgs(['--resume-order=orden con espacios']), /resume-order/);
  });

  await test('genera un número único y fácil de buscar en el panel', () => {
    const identity = buildTraceIdentity({
      now: new Date('2026-08-17T22:30:27.000Z'),
      randomBytes: fixedBytes,
    });
    assert.equal(identity.orderNumber, 'FM-20260817223027-070707');
    assert.match(identity.runId, /^manual_invoice_20260817t223027z_070707$/);
  });

  await test('construye una orden pagada, fiscalmente completa y sin factura', () => {
    const identity = buildTraceIdentity({
      now: new Date('2026-08-17T22:30:27.000Z'),
      randomBytes: fixedBytes,
    });
    const draft = buildOrderDraft({
      candidate: candidateFixture(),
      now: new Date('2026-08-17T22:30:27.000Z'),
      identity,
    });

    assert.equal(draft.status, 'paid');
    assert.equal(draft.payment.status, 'paid');
    assert(draft.payment.paidAt instanceof Date);
    assert.equal(draft.paymentProcessing.inventory.status, 'pending');
    assert.equal(draft.paymentProcessing.invoice.status, 'pending');
    assert.equal(draft.inventoryControl.reservationRequired, true);
    assert.equal(draft.inventoryControl.discountedAtCheckout, false);
    assert.equal(draft.items[0].requiresShipping, true);
    assert.equal(draft.items[0].fulfillmentKind, 'shipment');
    assert.equal(draft.billing.personType, 'natural');
    assert.equal(draft.billing.documentType, 'CC');
    assert.equal(draft.billing.municipalityCode, '11001');
    assert.equal(draft.total, 161600);
    assert.equal(draft.electronicInvoice, undefined);
    assert.equal(draft.invoiceNumber, undefined);
    assert(draft.tags.includes('sin-factura'));
  });

  await test('cumple el esquema real de Orden antes de tocar MongoDB', async () => {
    const identity = buildTraceIdentity({
      now: new Date('2026-08-17T22:30:27.000Z'),
      randomBytes: fixedBytes,
    });
    const order = new Order(buildOrderDraft({
      candidate: candidateFixture(),
      now: new Date('2026-08-17T22:30:27.000Z'),
      identity,
    }));
    await order.validate();
    assert.equal(order.items.length, 1);
    assert.equal(order.total, 161600);
  });

  await test('usa la autoridad real de inventario y logística sin emitir Factus ni borrar datos', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'seedPersistentManualInvoiceOrder.js'),
      'utf8'
    );
    assert.doesNotMatch(
      source,
      /\.(?:deleteOne|deleteMany|findOneAndDelete|findByIdAndDelete|drop)\s*\(/
    );
    assert.doesNotMatch(source, /sendElectronicInvoiceToProvider|issueElectronicInvoiceForOrder\s*\(/);
    assert.match(source, /createInventoryReservation/);
    assert.match(source, /confirmInventoryReservation/);
    assert.match(source, /applyReservationToOrderDocument/);
    assert.match(source, /initializeOrderLogistics/);
    assert.match(source, /session\.withTransaction/);
    assert.match(source, /ElectronicInvoice\.countDocuments/);
    assert.match(source, /listPendingBillableOrders/);
  });

  await test('package.json registra el comando de creación y su prueba', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
    );
    assert.equal(
      packageJson.scripts['demo:orders-manual-invoice'],
      'node scripts/seedPersistentManualInvoiceOrder.js'
    );
    assert.equal(
      packageJson.scripts['test:orders-manual-invoice'],
      'node scripts/testPersistentManualInvoiceOrder.js'
    );
  });

  console.log(`\nFactura manual persistente: ${results.ok} controles superados.`);
  if (results.fail) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
