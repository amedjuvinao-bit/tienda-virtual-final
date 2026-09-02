'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizePaymentPayload,
  normalizeDiscountPayload,
  validateDiscountAuthorization,
} = require('../services/adminPosService');

let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code);
  return true;
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function main() {
  ok(
    'el efectivo insuficiente se rechaza antes de crear la orden',
    throwsCode(
      () => normalizePaymentPayload({ method: 'cash', amount: 28500, receivedAmount: 20000 }, 28500),
      'POS_PAYMENT_RECEIVED_TOO_LOW'
    )
  );

  const cash = normalizePaymentPayload({ method: 'cash', amount: 28500, receivedAmount: 30000 }, 28500);
  ok('el cambio se calcula en servidor', cash.changeAmount === 1500 && cash.amount === 28500);

  ok(
    'la tarjeta exige autorización o referencia',
    throwsCode(
      () => normalizePaymentPayload({ method: 'card', amount: 28500 }, 28500),
      'POS_PAYMENT_REFERENCE_REQUIRED'
    )
  );

  ok(
    'la transferencia exige soporte verificable',
    throwsCode(
      () => normalizePaymentPayload({ method: 'transfer', amount: 28500, reference: '' }, 28500),
      'POS_PAYMENT_REFERENCE_REQUIRED'
    )
  );

  ok(
    'los pagos electrónicos deben coincidir exactamente con el total',
    throwsCode(
      () => normalizePaymentPayload({ method: 'card', amount: 30000, reference: 'AUTH-1' }, 28500),
      'POS_PAYMENT_AMOUNT_MISMATCH'
    )
  );

  ok(
    'un pago mixto necesita al menos dos medios',
    throwsCode(
      () => normalizePaymentPayload({ method: 'mixed', splitPayments: [{ method: 'cash', amount: 28500 }] }, 28500),
      'POS_SPLIT_PAYMENT_METHODS_REQUIRED'
    )
  );

  ok(
    'un pago mixto no admite otro pago mixto anidado',
    throwsCode(
      () => normalizePaymentPayload({
        method: 'mixed',
        splitPayments: [
          { method: 'mixed', amount: 10000 },
          { method: 'cash', amount: 18500 },
        ],
      }, 28500),
      'POS_SPLIT_PAYMENT_METHOD_INVALID'
    )
  );

  ok(
    'el pago mixto rechaza distribuciones incompletas',
    throwsCode(
      () => normalizePaymentPayload({
        method: 'mixed',
        splitPayments: [
          { method: 'cash', amount: 10000 },
          { method: 'card', amount: 10000, reference: 'AUTH-2' },
        ],
      }, 28500),
      'POS_INVALID_SPLIT_PAYMENT_TOTAL'
    )
  );

  ok(
    'cada medio electrónico mixto exige referencia',
    throwsCode(
      () => normalizePaymentPayload({
        method: 'mixed',
        splitPayments: [
          { method: 'cash', amount: 10000 },
          { method: 'transfer', amount: 18500 },
        ],
      }, 28500),
      'POS_SPLIT_PAYMENT_REFERENCE_REQUIRED'
    )
  );

  const mixed = normalizePaymentPayload({
    method: 'mixed',
    splitPayments: [
      { method: 'cash', amount: 10000, receivedAmount: 12000 },
      { method: 'transfer', amount: 18500, reference: 'TRX-300' },
    ],
  }, 28500);
  ok(
    'el pago mixto válido conserva distribución, soporte y cambio',
    mixed.amount === 28500 &&
      mixed.splitPayments.length === 2 &&
      mixed.splitPayments[0].changeAmount === 2000 &&
      mixed.splitPayments[1].reference === 'TRX-300'
  );

  const normalizedDiscount = normalizeDiscountPayload({
    type: 'percent',
    value: 10,
    reason: 'Fidelización',
  }, 100000);
  ok('el descuento porcentual queda normalizado en COP', normalizedDiscount.amount === 10000);

  const discountPayload = { subtotal: 100000, discount: normalizedDiscount };
  ok(
    'aplicar descuentos exige permiso sensible',
    throwsCode(
      () => validateDiscountAuthorization({ normalizedPayload: discountPayload, admin: {} }),
      'POS_DISCOUNT_PERMISSION_REQUIRED'
    )
  );

  ok(
    'todo descuento exige motivo comercial',
    throwsCode(
      () => validateDiscountAuthorization({
        normalizedPayload: {
          subtotal: 100000,
          discount: normalizeDiscountPayload({ type: 'percent', value: 10 }, 100000),
        },
        admin: { canApplyPosDiscount: true },
      }),
      'POS_DISCOUNT_REASON_REQUIRED'
    )
  );

  ok(
    'el cajero no puede superar el límite sin aprobación',
    throwsCode(
      () => validateDiscountAuthorization({
        normalizedPayload: {
          subtotal: 100000,
          discount: normalizeDiscountPayload({ type: 'percent', value: 25, reason: 'Caso especial' }, 100000),
        },
        admin: { canApplyPosDiscount: true, canApprovePosDiscount: false },
      }),
      'POS_DISCOUNT_NOT_ALLOWED'
    )
  );

  validateDiscountAuthorization({
    normalizedPayload: {
      subtotal: 100000,
      discount: normalizeDiscountPayload({ type: 'percent', value: 25, reason: 'Gerencia' }, 100000),
    },
    admin: { canApplyPosDiscount: true, canApprovePosDiscount: true },
  });
  ok('un perfil aprobador puede autorizar un descuento superior al límite');

  const posUi = read('frontend/src/admin/pos/PosSalesPageSafe.jsx');
  const checkoutUi = read('frontend/src/admin/pos/PosCheckoutPanel.jsx');
  const reviewUi = read('frontend/src/admin/pos/PosSaleReviewModal.jsx');
  const receiptService = read('backend/services/posReceiptService.js');
  const posRoute = read('backend/routes/adminPos.js');
  const posService = read('backend/services/adminPosService.js');

  ok(
    'la interfaz usa la previsualización del servidor antes de confirmar',
    posUi.includes('previewPosSale(payload)') &&
      posUi.includes('<PosSaleReviewModal') &&
      reviewUi.includes('La venta aún no ha sido creada')
  );
  ok(
    'la interfaz expone efectivo, pago mixto y descuentos sin duplicar la página POS',
    checkoutUi.includes('Efectivo recibido') &&
      checkoutUi.includes('MixedPaymentEditor') &&
      checkoutUi.includes('Descuento comercial')
  );
  ok(
    'el comprobante conserva referencias y desglose del pago mixto',
    receiptService.includes('splitPayments:') && receiptService.includes('reference: cleanText')
  );
  ok(
    'la previsualización y la venta validan permiso de descuento',
    (posRoute.match(/validateDiscountAuthorization/g) || []).length >= 3 &&
      posRoute.includes("hasPermission(req, 'pos:discount')")
  );
  ok(
    'la orden conserva quién autorizó el descuento',
    posService.includes('authorizedBy: adminId') &&
      posService.includes('authorizedBySnapshot: adminSnapshot')
  );

  console.log(`\nEtapa 2 POS validada: ${controls} controles superados.`);
}

try {
  main();
} catch (error) {
  console.error('Fallo en Etapa 2 POS:', error);
  process.exitCode = 1;
}
