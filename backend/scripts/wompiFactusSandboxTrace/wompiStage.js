'use strict';

const assert = require('node:assert/strict');

const Order = require('../../models/Order');
const OrderRefund = require('../../models/OrderRefund');
const PaymentAttempt = require('../../models/PaymentAttempt');
const {
  isWompiTransactionOwnedByOrder,
} = require('../../services/publicPaymentAccessService');
const {
  createWompiPublicGatewayService,
} = require('../../services/wompiPublicGatewayService');
const {
  createWompiWebhookRuntimeService,
} = require('../../services/wompiWebhookRuntimeService');
const { clean } = require('./config');

const gateway = createWompiPublicGatewayService({ fetchImpl: global.fetch });

function transactionMethod(transaction = {}) {
  return clean(
    transaction.payment_method_type || transaction.payment_method?.type,
    40
  ).toUpperCase();
}

async function loadVerifiedTransaction({
  orderNumber,
  transactionId,
  payments,
  baseUrl,
}) {
  const order = await Order.findOne({ orderNumber });
  assert(order, `No existe la orden ${orderNumber}.`);
  assert.notStrictEqual(order?.storeCredit?.applied, true, 'La prueba no admite pagos mixtos.');

  const transaction = await gateway.fetchTransactionById({
    baseUrl,
    transactionId,
    privateKey: payments.credentials.wompi.privateKey,
    publicKey: payments.credentials.wompi.publicKey,
  });
  const status = clean(transaction?.status, 40).toUpperCase();
  assert(
    ['APPROVED', 'VOIDED'].includes(status),
    `Wompi devolvió ${status || 'un estado desconocido'}; se exige APPROVED.`
  );
  assert.strictEqual(
    transactionMethod(transaction),
    'CARD',
    'La anulación automática solo se prueba con tarjeta.'
  );

  const attempt = await PaymentAttempt.findOne({
    provider: 'wompi',
    reference: clean(transaction.reference, 220),
  });
  assert(
    isWompiTransactionOwnedByOrder({
      order,
      attempt,
      transaction,
      requestedTransactionId: transactionId,
    }),
    'La transacción no coincide exactamente con la orden y el intento emitido.'
  );

  if (status === 'VOIDED') {
    const recoverableRefund = await OrderRefund.findOne({
      order: order._id,
      status: 'processed',
    });
    assert(
      recoverableRefund,
      'Wompi está VOIDED, pero no existe un reembolso local recuperable.'
    );
  }
  return { attempt, order, status, transaction };
}

async function applyVerifiedApproval({ order, status, transaction, payments }) {
  const storedId = clean(order?.payment?.transactionId, 160);
  const alreadyApplied =
    clean(order?.payment?.status, 40).toLowerCase() === 'paid' &&
    storedId === clean(transaction.id, 160);
  if (alreadyApplied || status === 'VOIDED') return Order.findById(order._id);

  const runtime = createWompiWebhookRuntimeService();
  const result = await runtime.orderService.processApproved({
    orderNumber: order.orderNumber,
    transaction,
    payments,
    reference: transaction.reference,
    verified: true,
  });
  assert.notStrictEqual(result?.reconciliationRequired, true, result?.reconciliationMessage);
  assert.strictEqual(result?.ok, true, result?.error?.message || 'No se aplicó el pago.');

  const paidOrder = await Order.findById(order._id);
  assert.strictEqual(paidOrder?.payment?.status, 'paid');
  assert.strictEqual(clean(paidOrder?.payment?.transactionId, 160), clean(transaction.id, 160));
  paidOrder.tags = Array.from(
    new Set([...(paidOrder.tags || []), 'sandbox-external-trace', 'wompi-factus-refund'])
  );
  paidOrder.timeline.push({
    type: 'system',
    message: 'Transacción auténtica verificada directamente en Wompi Sandbox.',
    by: 'wompi-factus-sandbox-trace',
    at: new Date(),
  });
  await paidOrder.save();
  return paidOrder;
}

module.exports = { applyVerifiedApproval, loadVerifiedTransaction, transactionMethod };
