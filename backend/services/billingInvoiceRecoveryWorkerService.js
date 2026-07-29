'use strict';

const ElectronicInvoice = require('../models/ElectronicInvoice');
const {
  INVOICE_LOCK_MS,
  markInvoiceForReconciliation,
  processPendingInvoiceRecoveries,
} = require('./billingInvoiceRecoveryService');

async function scanStaleProcessingInvoices({ limit = 25, now = new Date() } = {}) {
  const cutoff = new Date(new Date(now).getTime() - INVOICE_LOCK_MS);
  const stale = await ElectronicInvoice.find({
    $or: [
      {
        status: 'processing',
        'emission.lastAttemptAt': { $lte: cutoff },
      },
      {
        'emission.state': 'processing',
        'emission.lastAttemptAt': { $lte: cutoff },
      },
    ],
  })
    .sort({ 'emission.lastAttemptAt': 1 })
    .limit(Math.max(1, Math.min(100, Number(limit || 25))))
    .lean();

  let scheduled = 0;
  for (const invoice of stale) {
    try {
      await markInvoiceForReconciliation({
        invoice,
        reason: 'stale_processing_lock',
        source: 'recovery-scanner',
      });
      scheduled += 1;
    } catch (error) {
      console.error('[billing-recovery] No se pudo programar conciliación:', {
        invoiceId: String(invoice?._id || ''),
        error: error?.message || String(error),
      });
    }
  }

  return { scanned: stale.length, scheduled };
}

module.exports = {
  processPendingInvoiceRecoveries,
  scanStaleProcessingInvoices,
};
