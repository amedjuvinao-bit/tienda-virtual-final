// backend/scripts/testAdminPosServiceCalculations.js

const {
  calculatePosTotals,
  normalizePaymentPayload,
  normalizePosPayload,
} = require('../services/adminPosService');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  console.log('🧪 Test cálculos base servicio POS');

  const totals = calculatePosTotals({
    items: [
      {
        productId: '64a7f9f0f0f0f0f0f0f0f0f1',
        title: 'Vestido POS',
        size: '8',
        color: 'Lila',
        quantity: 2,
        price: 50000,
      },
      {
        productId: '64a7f9f0f0f0f0f0f0f0f0f2',
        title: 'Moño POS',
        size: 'Única',
        color: 'Rosado',
        quantity: 1,
        price: 20000,
      },
    ],
    discount: {
      type: 'amount',
      value: 10000,
      reason: 'Promoción mostrador',
    },
    taxes: {
      iva: {
        enabled: false,
      },
    },
  });

  assert(totals.subtotal === 120000, 'Subtotal esperado: 120000.');
  assert(totals.discount.amount === 10000, 'Descuento esperado: 10000.');
  assert(totals.total === 110000, 'Total esperado: 110000.');
  assert(totals.summary.totalItems === 3, 'Cantidad total esperada: 3.');
  assert(totals.items[0].variantKey === '8__lila', 'variantKey esperado: 8__lila.');

  const cashPayment = normalizePaymentPayload(
    {
      method: 'cash',
      receivedAmount: 120000,
    },
    totals.total
  );

  assert(cashPayment.method === 'cash', 'Método esperado: cash.');
  assert(cashPayment.changeAmount === 10000, 'Cambio esperado: 10000.');

  const mixedPayment = normalizePaymentPayload(
    {
      method: 'mixed',
      splitPayments: [
        { method: 'cash', amount: 60000 },
        { method: 'transfer', amount: 50000, reference: 'TRX-TEST' },
      ],
    },
    totals.total
  );

  assert(mixedPayment.method === 'mixed', 'Método esperado: mixed.');
  assert(mixedPayment.amount === 110000, 'Pago mixto esperado: 110000.');
  assert(mixedPayment.splitPayments.length === 2, 'Pago mixto debe tener 2 partes.');

  const normalizedPayload = normalizePosPayload({
    branchId: '64a7f9f0f0f0f0f0f0f0f0aa',
    registerCode: 'caja 1',
    items: totals.items,
    discount: {
      type: 'amount',
      value: 10000,
    },
    payment: {
      method: 'cash',
      receivedAmount: 120000,
    },
  });

  assert(normalizedPayload.branchId === '64a7f9f0f0f0f0f0f0f0f0aa', 'branchId no coincide.');
  assert(normalizedPayload.registerCode === 'CAJA 1', 'registerCode debe normalizarse a mayúsculas.');
  assert(normalizedPayload.payment.changeAmount === 10000, 'Cambio normalizado esperado: 10000.');

  console.log('✅ Cálculos base del servicio POS correctos.');
}

try {
  main();
} catch (error) {
  console.error('❌ Error validando cálculos POS:', error.message);
  process.exitCode = 1;
}
