'use strict';

const ElectronicInvoice = require('../models/ElectronicInvoice');
const issuanceService = require('./electronicInvoiceIssuanceService');
const recoveryService = require('./billingInvoiceRecoveryService');
const recoveryWorkerService = require('./billingInvoiceRecoveryWorkerService');

const {
  isInvoiceInRecovery,
  isInvoiceLockExpired,
  markInvoiceForReconciliation,
  reconcileInvoiceByReference,
} = recoveryService;

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

function pendingReconciliationError({ invoice, originalError, recoveryError = '' }) {
  return Object.assign(
    new Error(
      'La emisión tuvo un resultado incierto y quedó registrada para conciliación automática. El sistema no volverá a emitir la factura hasta confirmar el resultado en Factus.'
    ),
    {
      status: 503,
      code: 'BILLING_RECONCILIATION_PENDING',
      invoice: invoice || null,
      causeCode: originalError?.code || '',
      recoveryError: cleanText(recoveryError, 500),
    }
  );
}

async function issueElectronicInvoiceForOrderResilient(args = {}) {
  const source = cleanText(args.source || 'system', 80) || 'system';
  let existingBefore = null;

  try {
    existingBefore = await findInvoiceForOrder(args.orderId);
  } catch {
    // El motor base responderá el error real. Si ya existe una reserva, el
    // scanner duradero la recuperará cuando MongoDB vuelva a estar disponible.
  }

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
    let invoice = error?.invoice || null;

    if (!invoice) {
      try {
        invoice = await findInvoiceForOrder(args.orderId);
      } catch (lookupError) {
        throw pendingReconciliationError({
          invoice: null,
          originalError: error,
          recoveryError: lookupError?.message || '',
        });
      }
    }

    if (!invoice || !isInvoiceInRecovery(invoice)) throw error;

    try {
      const recovered = await reconcileExisting(
        invoice,
        source,
        'issuance_exception_after_reservation',
        error?.message || ''
      );

      if (recovered.reconciled) return recovered;

      throw pendingReconciliationError({
        invoice: recovered.invoice || invoice,
        originalError: error,
      });
    } catch (recoveryError) {
      if (recoveryError?.code === 'BILLING_RECONCILIATION_PENDING') {
        throw recoveryError;
      }

      throw pendingReconciliationError({
        invoice,
        originalError: error,
        recoveryError: recoveryError?.message || '',
      });
    }
  }
}

issuanceService.issueElectronicInvoiceForOrder =
  issueElectronicInvoiceForOrderResilient;

// El index requiere el mismo objeto de módulo después de este bootstrap. Al
// sustituir únicamente el scanner evitamos que una factura ya pendiente reinicie
// su backoff cada minuto.
recoveryService.scanStaleProcessingInvoices =
  recoveryWorkerService.scanStaleProcessingInvoices;

module.exports = {
  issueElectronicInvoiceForOrder: issueElectronicInvoiceForOrderResilient,
};
