'use strict';

const ElectronicInvoice = require('../models/ElectronicInvoice');
const issuanceService = require('./electronicInvoiceIssuanceService');
const {
  isInvoiceInRecovery,
  isInvoiceLockExpired,
  markInvoiceForReconciliation,
  reconcileInvoiceByReference,
} = require('./billingInvoiceRecoveryService');

const baseIssueElectronicInvoiceForOrder =
  issuanceService.issueElectronicInvoiceForOrder;

function cleanText(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

async function lean(query) {
  if (!query) return null;
  return typeof query.lean === 'function' ? query.lean() : query;
}

async function findInvoiceForOrder(orderId) {
  if (!orderId) return null;
  return lean(
    ElectronicInvoice.findOne({
      $or: [
        { orderId },
        { idempotencyKey: `electronic-invoice:order:${String(orderId)}` },
      ],
    })
  );
}

function reconciliationResponse(result, fallbackInvoice, message) {
  const invoice = result?.invoice || fallbackInvoice || null;
  return {
    created: false,
    reused: true,
    retried: false,
    inProgress: false,
    reconciliationPending: result?.resolved !== true,
    reconciled: result?.resolved === true,
    retryable: result?.retryable === true,
    invoice,
    message:
      result?.resolved === true
        ? 'La factura fue recuperada y conciliada con Factus sin volver a emitirla.'
        : message ||
          'La factura está pendiente de conciliación. No se volverá a emitir hasta confirmar el resultado en Factus.',
  };
}

async function reconcileExisting(invoice, source, reason, lastError = '') {
  const marked = await markInvoiceForReconciliation({
    invoice,
    reason,
    source,
    lastError,
  });
  const result = await reconcileInvoiceByReference({
    invoiceId: invoice._id,
    taskId: marked.task?._id,
    source,
  });
  return reconciliationResponse(result, marked.invoice || invoice);
}

async function issueElectronicInvoiceForOrderResilient(args = {}) {
  const source = cleanText(args.source || 'system', 80) || 'system';
  const existingBefore = await findInvoiceForOrder(args.orderId);

  if (existingBefore && isInvoiceInRecovery(existingBefore)) {
    if (
      cleanText(existingBefore.status, 40) === 'reconciliation_pending' ||
      isInvoiceLockExpired(existingBefore)
    ) {
      return reconcileExisting(
        existingBefore,
        source,
        cleanText(existingBefore.status, 40) === 'reconciliation_pending'
          ? 'reconciliation_retry'
          : 'stale_processing_lock'
      );
    }
  }

  try {
    const result = await baseIssueElectronicInvoiceForOrder(args);
    const invoice = result?.invoice || null;
    const finalWriteWasLost =
      result?.inProgress === true &&
      cleanText(result?.message, 300).includes(
        'La emisión fue finalizada por otro proceso.'
      );

    if (
      invoice &&
      isInvoiceInRecovery(invoice) &&
      (finalWriteWasLost || isInvoiceLockExpired(invoice))
    ) {
      return reconcileExisting(
        invoice,
        source,
        finalWriteWasLost
          ? 'provider_success_local_write_lost'
          : 'stale_processing_lock'
      );
    }

    return result;
  } catch (error) {
    const invoice = error?.invoice || (await findInvoiceForOrder(args.orderId));

    if (!invoice || !isInvoiceInRecovery(invoice)) throw error;

    try {
      const recovered = await reconcileExisting(
        invoice,
        source,
        'issuance_exception_after_reservation',
        error?.message || ''
      );

      if (recovered.reconciled) return recovered;

      const pendingError = Object.assign(
        new Error(
          'La emisión quedó pendiente de conciliación automática con Factus. El sistema no volverá a emitir la factura hasta resolver el resultado remoto.'
        ),
        {
          status: 503,
          code: 'BILLING_RECONCILIATION_PENDING',
          invoice: recovered.invoice || invoice,
          causeCode: error?.code || '',
        }
      );
      throw pendingError;
    } catch (recoveryError) {
      if (recoveryError?.code === 'BILLING_RECONCILIATION_PENDING') {
        throw recoveryError;
      }

      throw Object.assign(
        new Error(
          'La emisión tuvo un resultado incierto y no fue posible completar la conciliación inmediata. Quedó registrada para recuperación automática.'
        ),
        {
          status: 503,
          code: 'BILLING_RECONCILIATION_PENDING',
          invoice,
          causeCode: error?.code || '',
          recoveryError: cleanText(recoveryError?.message, 500),
        }
      );
    }
  }
}

issuanceService.issueElectronicInvoiceForOrder =
  issueElectronicInvoiceForOrderResilient;

module.exports = {
  issueElectronicInvoiceForOrder: issueElectronicInvoiceForOrderResilient,
};
