'use strict';

const crypto = require('crypto');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const BillingInvoiceRecoveryTask = require('../models/BillingInvoiceRecoveryTask');
const SiteSettings = require('../models/SiteSettings');
const {
  findInvoiceByReferenceFromFactus,
} = require('../lib/dian/providers/factusRangeAwareProvider');

const INVOICE_LOCK_MS = 5 * 60 * 1000;
const RECOVERY_LOCK_MS = 2 * 60 * 1000;
const MAX_NOT_FOUND_CONFIRMATIONS = 3;
const RECOVERY_DELAYS_MS = [30 * 1000, 2 * 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];

function cleanText(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function toPlain(value) {
  if (!value) return null;
  return typeof value.toObject === 'function'
    ? value.toObject({ depopulate: true })
    : value;
}

async function lean(query) {
  if (!query) return null;
  return typeof query.lean === 'function' ? query.lean() : query;
}

function invoiceReference(invoice = {}) {
  return cleanText(
    invoice?.provider?.referenceCode ||
      invoice?.orderNumber ||
      invoice?.orderId ||
      invoice?._id,
    180
  );
}

function isFinalInvoice(invoice = {}) {
  return ['accepted', 'sent', 'generated'].includes(
    cleanText(invoice.status, 40).toLowerCase()
  );
}

function isInvoiceInRecovery(invoice = {}) {
  const status = cleanText(invoice.status, 40).toLowerCase();
  const state = cleanText(invoice?.emission?.state, 40).toLowerCase();
  return (
    ['processing', 'reconciliation_pending'].includes(status) ||
    ['processing', 'reconciliation_pending'].includes(state)
  );
}

function invoiceLockDeadline(invoice = {}) {
  const explicit = invoice?.emission?.lockExpiresAt
    ? new Date(invoice.emission.lockExpiresAt)
    : null;
  if (explicit && !Number.isNaN(explicit.getTime())) return explicit;

  const base = invoice?.emission?.lastAttemptAt || invoice?.updatedAt || invoice?.createdAt;
  const date = base ? new Date(base) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + INVOICE_LOCK_MS);
}

function isInvoiceLockExpired(invoice = {}, now = new Date()) {
  if (!isInvoiceInRecovery(invoice)) return false;
  const deadline = invoiceLockDeadline(invoice);
  return !deadline || deadline.getTime() <= new Date(now).getTime();
}

function recoveryDelay(attempts = 0) {
  return RECOVERY_DELAYS_MS[
    Math.min(Math.max(0, Number(attempts || 0)), RECOVERY_DELAYS_MS.length - 1)
  ];
}

function normalizeRemoteInvoice(document = {}) {
  const links = document?.links && typeof document.links === 'object'
    ? document.links
    : {};
  const validated =
    document?.is_validated === true ||
    document?.validated === true ||
    Boolean(document?.validated_at || document?.validatedAt);

  return {
    id: Number(document?.id || 0) || null,
    number: cleanText(document?.number || document?.invoiceNumber, 160),
    cufe: cleanText(document?.cufe, 220),
    referenceCode: cleanText(
      document?.reference_code || document?.referenceCode,
      180
    ),
    validated,
    validatedAt: cleanText(
      document?.validated_at || document?.validatedAt,
      120
    ),
    links,
  };
}

function createBillingInvoiceRecoveryService(overrides = {}) {
  const InvoiceModel = overrides.ElectronicInvoice || ElectronicInvoice;
  const TaskModel = overrides.BillingInvoiceRecoveryTask || BillingInvoiceRecoveryTask;
  const SettingsModel = overrides.SiteSettings || SiteSettings;
  const lookupInvoice =
    overrides.findInvoiceByReferenceFromFactus ||
    findInvoiceByReferenceFromFactus;
  const nowFactory = overrides.now || (() => new Date());
  const tokenFactory = overrides.randomUUID || (() => crypto.randomUUID());

  async function findInvoice(invoiceId) {
    if (!invoiceId) return null;
    if (typeof InvoiceModel.findById === 'function') {
      return lean(InvoiceModel.findById(invoiceId));
    }
    return null;
  }

  async function upsertRecoveryTask({ invoice, reason, source, lastError }) {
    const now = nowFactory();
    const referenceCode = invoiceReference(invoice);
    if (!referenceCode) {
      throw Object.assign(
        new Error('No existe una referencia estable para conciliar la factura.'),
        { code: 'BILLING_RECONCILIATION_REFERENCE_MISSING' }
      );
    }

    const update = {
      $setOnInsert: {
        invoiceId: invoice._id,
        orderId: invoice.orderId || null,
        referenceCode,
        attempts: 0,
        confirmedNotFound: 0,
      },
      $set: {
        status: 'pending',
        reason: cleanText(reason, 180),
        source: cleanText(source || 'system', 80),
        lastError: cleanText(lastError, 500),
        nextAttemptAt: now,
        lockedAt: null,
        lockToken: '',
        resolvedAt: null,
      },
    };

    try {
      return await TaskModel.findOneAndUpdate(
        { invoiceId: invoice._id },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (String(error?.code || '') !== '11000') throw error;
      return TaskModel.findOne({ invoiceId: invoice._id });
    }
  }

  async function markInvoiceForReconciliation({
    invoiceId,
    invoice: suppliedInvoice,
    reason = 'unknown_outcome',
    source = 'system',
    lastError = '',
  } = {}) {
    const invoice = toPlain(suppliedInvoice) || (await findInvoice(invoiceId));
    if (!invoice?._id) {
      throw Object.assign(new Error('Factura local no encontrada para conciliación.'), {
        code: 'BILLING_RECONCILIATION_INVOICE_NOT_FOUND',
      });
    }

    const task = await upsertRecoveryTask({
      invoice,
      reason,
      source,
      lastError,
    });
    const now = nowFactory();

    let updated = invoice;
    if (typeof InvoiceModel.findByIdAndUpdate === 'function') {
      updated =
        (await InvoiceModel.findByIdAndUpdate(
          invoice._id,
          {
            $set: {
              status: 'reconciliation_pending',
              errorMessage:
                'El resultado fiscal está pendiente de conciliación automática con Factus.',
              'emission.state': 'reconciliation_pending',
              'emission.lastAttemptAt': now,
              'emission.lockExpiresAt': null,
              'emission.reconciliationRequestedAt': now,
              'dianResponse.stage': 'reconciliation_pending',
              'dianResponse.message':
                'La emisión no se repetirá hasta confirmar el resultado exacto en Factus.',
              'dianResponse.code': 'BILLING_RECONCILIATION_PENDING',
            },
          },
          { new: true, runValidators: true, strict: false }
        )) || invoice;
    }

    return { invoice: toPlain(updated), task: toPlain(task) };
  }

  async function claimTask({ invoiceId, taskId } = {}) {
    const now = nowFactory();
    const staleBefore = new Date(now.getTime() - RECOVERY_LOCK_MS);
    const lockToken = tokenFactory();
    const filter = {
      ...(taskId ? { _id: taskId } : {}),
      ...(invoiceId ? { invoiceId } : {}),
      status: { $in: ['pending', 'processing', 'failed'] },
      nextAttemptAt: { $lte: now },
      $or: [
        { status: { $ne: 'processing' } },
        { lockedAt: null },
        { lockedAt: { $lt: staleBefore } },
      ],
    };

    const task = await TaskModel.findOneAndUpdate(
      filter,
      {
        $set: {
          status: 'processing',
          lockToken,
          lockedAt: now,
          lastAttemptAt: now,
        },
        $inc: { attempts: 1 },
      },
      { new: true }
    );

    return task ? { task, lockToken } : null;
  }

  async function releaseTask(task, lockToken, values = {}) {
    if (!task?._id) return null;
    return TaskModel.findOneAndUpdate(
      { _id: task._id, lockToken },
      {
        $set: {
          ...values,
          lockToken: '',
          lockedAt: null,
        },
      },
      { new: true }
    );
  }

  async function resolveAlreadyFinal(task, lockToken, invoice) {
    await releaseTask(task, lockToken, {
      status: 'resolved',
      resolvedAt: nowFactory(),
      nextAttemptAt: null,
      lastError: '',
      providerNumber: cleanText(invoice.invoiceNumber || invoice?.provider?.number, 160),
      providerCufe: cleanText(invoice.cufe || invoice?.provider?.cufe, 220),
    });
    return { resolved: true, found: true, invoice };
  }

  async function reconcileInvoiceByReference({ invoiceId, taskId, source = 'worker' } = {}) {
    let claimed = await claimTask({ invoiceId, taskId });

    if (!claimed && invoiceId) {
      const invoice = await findInvoice(invoiceId);
      if (!invoice) return { resolved: false, skipped: true, reason: 'invoice_not_found' };
      const marked = await markInvoiceForReconciliation({
        invoice,
        reason: 'reconciliation_requested',
        source,
      });
      claimed = await claimTask({ taskId: marked.task?._id, invoiceId });
    }

    if (!claimed) {
      return { resolved: false, skipped: true, reason: 'task_not_available' };
    }

    const { task, lockToken } = claimed;
    const invoice = await findInvoice(task.invoiceId);
    if (!invoice) {
      await releaseTask(task, lockToken, {
        status: 'failed',
        lastError: 'La factura local ya no existe.',
        nextAttemptAt: null,
      });
      return { resolved: false, failed: true, reason: 'invoice_not_found' };
    }

    if (isFinalInvoice(invoice)) {
      return resolveAlreadyFinal(task, lockToken, invoice);
    }

    const settings = await lean(SettingsModel.findOne());
    const referenceCode = cleanText(task.referenceCode || invoiceReference(invoice), 180);
    const lookup = await lookupInvoice({ settings, referenceCode });

    if (!lookup?.success) {
      const delay = recoveryDelay(task.attempts);
      await releaseTask(task, lockToken, {
        status: 'pending',
        nextAttemptAt: new Date(nowFactory().getTime() + delay),
        lastError: cleanText(
          lookup?.error || 'No fue posible consultar Factus durante la conciliación.',
          500
        ),
      });
      return {
        resolved: false,
        pending: true,
        reason: 'provider_unavailable',
        error: lookup?.error || '',
      };
    }

    if (!lookup.found || !lookup.document) {
      const confirmations = Number(task.confirmedNotFound || 0) + 1;
      if (confirmations >= MAX_NOT_FOUND_CONFIRMATIONS) {
        const failedAt = nowFactory();
        const failedInvoice = await InvoiceModel.findByIdAndUpdate(
          invoice._id,
          {
            $set: {
              status: 'failed',
              errorMessage:
                'Factus confirmó en tres consultas separadas que no existe una factura con esta referencia. El documento puede reintentarse de forma controlada.',
              'emission.state': 'failed',
              'emission.failedAt': failedAt,
              'emission.lastAttemptAt': failedAt,
              'emission.lockExpiresAt': null,
              'dianResponse.stage': 'reconciliation_not_found',
              'dianResponse.message':
                'No se encontró documento remoto después de tres confirmaciones exactas.',
              'dianResponse.code': 'BILLING_RECONCILIATION_REMOTE_NOT_FOUND',
              failedAt,
            },
          },
          { new: true, runValidators: true, strict: false }
        );
        await releaseTask(task, lockToken, {
          status: 'resolved',
          confirmedNotFound: confirmations,
          resolvedAt: failedAt,
          nextAttemptAt: null,
          lastError: '',
        });
        return {
          resolved: true,
          found: false,
          retryable: true,
          invoice: toPlain(failedInvoice) || invoice,
        };
      }

      const delay = recoveryDelay(task.attempts);
      await releaseTask(task, lockToken, {
        status: 'pending',
        confirmedNotFound: confirmations,
        nextAttemptAt: new Date(nowFactory().getTime() + delay),
        lastError:
          `Factus no devolvió la referencia exacta. Confirmación ${confirmations} de ${MAX_NOT_FOUND_CONFIRMATIONS}.`,
      });
      return { resolved: false, pending: true, found: false, confirmations };
    }

    const remote = normalizeRemoteInvoice(lookup.document);
    if (!remote.number) {
      await releaseTask(task, lockToken, {
        status: 'pending',
        nextAttemptAt: new Date(nowFactory().getTime() + recoveryDelay(task.attempts)),
        lastError: 'Factus devolvió la referencia, pero todavía no informó número oficial.',
      });
      return { resolved: false, pending: true, reason: 'remote_number_missing' };
    }

    const completedAt = nowFactory();
    const nextStatus = remote.validated ? 'accepted' : 'sent';
    const updated = await InvoiceModel.findByIdAndUpdate(
      invoice._id,
      {
        $set: {
          status: nextStatus,
          invoiceNumber: remote.number,
          cufe: remote.cufe,
          qrUrl: remote.links.qr || remote.links.qr_url || '',
          pdfUrl:
            remote.links.pdf ||
            remote.links.pdf_url ||
            remote.links.public_url ||
            '',
          xmlUrl: remote.links.xml || remote.links.xml_url || '',
          provider: {
            name: 'factus',
            id: remote.id,
            status: remote.validated ? 'validated' : 'sent',
            referenceCode: remote.referenceCode || referenceCode,
            number: remote.number,
            cufe: remote.cufe,
            isValidated: remote.validated,
            validatedAt: remote.validatedAt,
            links: remote.links,
            raw: {
              id: remote.id,
              number: remote.number,
              reference_code: remote.referenceCode || referenceCode,
              cufe: remote.cufe,
              is_validated: remote.validated,
              validated_at: remote.validatedAt,
              links: remote.links,
              recoveredBy: source,
            },
          },
          providerErrors: {},
          errorMessage: '',
          'emission.state': 'completed',
          'emission.completedAt': completedAt,
          'emission.lastAttemptAt': completedAt,
          'emission.lockExpiresAt': null,
          'emission.reconciledAt': completedAt,
          'dianResponse.stage': remote.validated
            ? 'provider_reconciled_validated'
            : 'provider_reconciled_sent',
          'dianResponse.message':
            'Resultado fiscal recuperado mediante referencia exacta en Factus.',
          'dianResponse.code': remote.validated ? 'VALIDATED' : 'SENT',
          sentAt: completedAt,
          acceptedAt: remote.validated ? completedAt : null,
          failedAt: null,
        },
      },
      { new: true, runValidators: true, strict: false }
    );

    if (!updated) {
      await releaseTask(task, lockToken, {
        status: 'pending',
        nextAttemptAt: new Date(nowFactory().getTime() + recoveryDelay(task.attempts)),
        lastError:
          'Factus devolvió la factura, pero MongoDB no permitió guardar la conciliación.',
      });
      return { resolved: false, pending: true, reason: 'local_persistence_failed' };
    }

    await releaseTask(task, lockToken, {
      status: 'resolved',
      resolvedAt: completedAt,
      nextAttemptAt: null,
      lastError: '',
      providerNumber: remote.number,
      providerCufe: remote.cufe,
    });

    return { resolved: true, found: true, invoice: toPlain(updated) };
  }

  async function scanStaleProcessingInvoices({ limit = 25 } = {}) {
    const cutoff = new Date(nowFactory().getTime() - INVOICE_LOCK_MS);
    const stale = await InvoiceModel.find({
      $or: [
        {
          status: 'processing',
          'emission.lastAttemptAt': { $lte: cutoff },
        },
        {
          'emission.state': 'processing',
          'emission.lastAttemptAt': { $lte: cutoff },
        },
        {
          status: 'reconciliation_pending',
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

  async function processPendingInvoiceRecoveries({ limit = 10 } = {}) {
    const now = nowFactory();
    const tasks = await TaskModel.find({
      status: { $in: ['pending', 'processing', 'failed'] },
      nextAttemptAt: { $lte: now },
    })
      .sort({ nextAttemptAt: 1 })
      .limit(Math.max(1, Math.min(50, Number(limit || 10))))
      .lean();

    const summary = { processed: 0, resolved: 0, pending: 0, failed: 0 };
    for (const task of tasks) {
      try {
        const result = await reconcileInvoiceByReference({
          taskId: task._id,
          invoiceId: task.invoiceId,
          source: 'recovery-worker',
        });
        summary.processed += 1;
        if (result.resolved) summary.resolved += 1;
        else if (result.failed) summary.failed += 1;
        else summary.pending += 1;
      } catch (error) {
        summary.processed += 1;
        summary.failed += 1;
        console.error('[billing-recovery] Error procesando conciliación:', {
          taskId: String(task?._id || ''),
          error: error?.message || String(error),
        });
      }
    }

    return summary;
  }

  return {
    isInvoiceLockExpired,
    markInvoiceForReconciliation,
    processPendingInvoiceRecoveries,
    reconcileInvoiceByReference,
    scanStaleProcessingInvoices,
  };
}

const defaultService = createBillingInvoiceRecoveryService();

module.exports = {
  INVOICE_LOCK_MS,
  MAX_NOT_FOUND_CONFIRMATIONS,
  RECOVERY_LOCK_MS,
  createBillingInvoiceRecoveryService,
  invoiceReference,
  isInvoiceInRecovery,
  isInvoiceLockExpired,
  markInvoiceForReconciliation: defaultService.markInvoiceForReconciliation,
  processPendingInvoiceRecoveries:
    defaultService.processPendingInvoiceRecoveries,
  reconcileInvoiceByReference: defaultService.reconcileInvoiceByReference,
  scanStaleProcessingInvoices: defaultService.scanStaleProcessingInvoices,
};
