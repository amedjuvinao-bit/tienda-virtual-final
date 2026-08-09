'use strict';

const {
  issueElectronicInvoiceForOrder,
} = require('./electronicInvoiceIssuanceService');
const {
  processOrderFulfillmentAfterPayment,
} = require('./orderFulfillmentService');

function trimSafe(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

async function generateElectronicInvoiceAfterPayment({
  orderId,
  transaction = {},
  payments = {},
  paymentProvider = '',
} = {}) {
  const source = trimSafe(
    paymentProvider || transaction?.provider || transaction?.payment_provider || 'payment',
    60
  ).toLowerCase();

  try {
    await processOrderFulfillmentAfterPayment({
      orderId,
      transaction,
      paymentProvider: source,
    });
  } catch (error) {
    console.error('❌ Error preparando entrega post pago:', {
      orderId: String(orderId || ''),
      paymentProvider: source,
      code: error.code || '',
      error: error.message,
    });
  }

  try {
    const result = await issueElectronicInvoiceForOrder({
      orderId,
      source,
      initiatedBy: `${source || 'payment'}-webhook`,
      transaction,
      payments,
      skipWhenElectronicBillingIsInactive: true,
    });

    if (result.skipped) {
      console.log('ℹ️ Facturación electrónica omitida después del pago.', {
        orderId: String(orderId || ''),
        paymentProvider: source,
        reason: result.message,
      });
      return null;
    }

    if (result.reused) {
      console.log('ℹ️ Facturación electrónica reutilizada de forma idempotente.', {
        orderId: String(orderId || ''),
        paymentProvider: source,
        inProgress: result.inProgress === true,
      });
      return result.invoice || null;
    }

    console.log('✅ Factura electrónica generada después del pago.', {
      orderId: String(orderId || ''),
      paymentProvider: source,
      invoiceNumber: result.invoice?.invoiceNumber || result.invoice?.provider?.number || '',
      status: result.invoice?.status || '',
    });

    return result.invoice || null;
  } catch (error) {
    console.error('❌ Error generando factura electrónica post pago:', {
      orderId: String(orderId || ''),
      paymentProvider: source,
      code: error.code || '',
      error: error.message,
    });

    return error.invoice || null;
  }
}

module.exports = {
  generateElectronicInvoiceAfterPayment,
};
