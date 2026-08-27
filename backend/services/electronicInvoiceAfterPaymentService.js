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

async function executeElectronicInvoiceAfterPayment({
  orderId,
  transaction = {},
  payments = {},
  paymentProvider = '',
  allowRetry = false,
  processFulfillment = true,
} = {}) {
  const source = trimSafe(
    paymentProvider || transaction?.provider || transaction?.payment_provider || 'payment',
    60
  ).toLowerCase();

  if (processFulfillment) {
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
  }

  try {
    const result = await issueElectronicInvoiceForOrder({
      orderId,
      source,
      initiatedBy: `${source || 'payment'}-webhook`,
      transaction,
      payments,
      skipWhenElectronicBillingIsInactive: true,
      allowRetry,
    });

    if (result.skipped) {
      console.log('ℹ️ Facturación electrónica omitida después del pago.', {
        orderId: String(orderId || ''),
        paymentProvider: source,
        reason: result.message,
      });
      return {
        outcome: 'skipped',
        performed: false,
        terminal: true,
        reasonCode: 'ELECTRONIC_BILLING_INACTIVE',
        message: trimSafe(result.message, 300),
        invoice: result.invoice || null,
        reused: result.reused === true,
      };
    }

    if (result.reused) {
      console.log('ℹ️ Facturación electrónica reutilizada de forma idempotente.', {
        orderId: String(orderId || ''),
        paymentProvider: source,
        inProgress: result.inProgress === true,
      });
      if (result.inProgress === true) {
        return {
          outcome: 'pending',
          performed: false,
          terminal: false,
          reasonCode: 'INVOICE_IN_PROGRESS',
          invoice: result.invoice || null,
          reused: true,
          inProgress: true,
        };
      }

      if (result.retryable === true && result.inProgress !== true) {
        return {
          outcome: 'pending',
          performed: false,
          terminal: false,
          reasonCode: 'INVOICE_RETRY_REQUIRED',
          invoice: result.invoice || null,
          reused: true,
          inProgress: false,
        };
      }

      return {
        outcome: 'performed',
        performed: true,
        terminal: true,
        reasonCode: 'INVOICE_REUSED',
        invoice: result.invoice || null,
        reused: true,
        inProgress: result.inProgress === true,
      };
    }

    console.log('✅ Factura electrónica generada después del pago.', {
      orderId: String(orderId || ''),
      paymentProvider: source,
      invoiceNumber: result.invoice?.invoiceNumber || result.invoice?.provider?.number || '',
      status: result.invoice?.status || '',
    });

    return {
      outcome: 'performed',
      performed: true,
      terminal: true,
      reasonCode: 'INVOICE_PROCESSED',
      invoice: result.invoice || null,
      reused: false,
    };
  } catch (error) {
    console.error('❌ Error generando factura electrónica post pago:', {
      orderId: String(orderId || ''),
      paymentProvider: source,
      code: error.code || '',
      error: error.message,
    });
    throw error;
  }
}

async function generateElectronicInvoiceAfterPayment(options = {}) {
  try {
    const result = await executeElectronicInvoiceAfterPayment(options);
    return result.invoice || null;
  } catch (error) {
    return error.invoice || null;
  }
}

module.exports = {
  executeElectronicInvoiceAfterPayment,
  generateElectronicInvoiceAfterPayment,
};
