'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;
const INVOICE_STALE_MS = 5 * 60 * 1000;
const RECOVERY_STALE_MS = 2 * 60 * 1000;
const EMAIL_STALE_MS = 10 * 60 * 1000;
const CREDIT_NOTE_STALE_MS = 5 * 60 * 1000;
const ACTIVATION_STALE_MS = 2 * 60 * 1000;

async function countDocuments(Model, filter) {
  const value = await Model.countDocuments(filter);
  return Math.max(0, Number(value || 0));
}

async function findOneLean(Model, filter, select, sort) {
  let query = Model.findOne(filter);
  if (select && typeof query?.select === 'function') query = query.select(select);
  if (sort && typeof query?.sort === 'function') query = query.sort(sort);
  if (typeof query?.lean === 'function') query = query.lean();
  return (await query) || null;
}

async function queryOperationalHealthData({
  InvoiceModel,
  RecoveryTaskModel,
  ActivationModel,
  now,
}) {
  const windowStartedAt = new Date(now.getTime() - DAY_MS);
  const invoiceStaleBefore = new Date(now.getTime() - INVOICE_STALE_MS);
  const recoveryStaleBefore = new Date(now.getTime() - RECOVERY_STALE_MS);
  const emailStaleBefore = new Date(now.getTime() - EMAIL_STALE_MS);
  const creditNoteStaleBefore = new Date(
    now.getTime() - CREDIT_NOTE_STALE_MS
  );
  const activationStaleBefore = new Date(
    now.getTime() - ACTIVATION_STALE_MS
  );

  const [
    staleInvoices,
    recentInvoiceFailures,
    emailErrors,
    stuckEmails,
    staleCreditNotes,
    recentCreditNoteFailures,
    activeRecoveries,
    overdueRecoveries,
    stuckRecoveries,
    failedRecoveries,
    oldestRecovery,
    activation,
  ] = await Promise.all([
    countDocuments(InvoiceModel, {
      $or: [
        {
          status: { $in: ['processing', 'reconciliation_pending'] },
          $or: [
            { 'emission.lastAttemptAt': { $lte: invoiceStaleBefore } },
            { 'emission.lastAttemptAt': null },
          ],
        },
        {
          'emission.state': { $in: ['processing', 'reconciliation_pending'] },
          $or: [
            { 'emission.lastAttemptAt': { $lte: invoiceStaleBefore } },
            { 'emission.lastAttemptAt': null },
          ],
        },
      ],
    }),
    countDocuments(InvoiceModel, {
      $or: [
        { status: 'failed', failedAt: { $gte: windowStartedAt } },
        { status: 'rejected', rejectedAt: { $gte: windowStartedAt } },
      ],
    }),
    countDocuments(InvoiceModel, {
      'emailDelivery.status': 'error',
      'emailDelivery.lastAttemptAt': { $gte: windowStartedAt },
    }),
    countDocuments(InvoiceModel, {
      'emailDelivery.status': 'sending',
      'emailDelivery.lastAttemptAt': { $lte: emailStaleBefore },
    }),
    countDocuments(InvoiceModel, {
      creditNotes: {
        $elemMatch: {
          $or: [
            {
              status: 'processing',
              $or: [
                {
                  'emission.lastAttemptAt': {
                    $lte: creditNoteStaleBefore,
                  },
                },
                { 'emission.lastAttemptAt': null },
              ],
            },
            {
              'emission.state': 'processing',
              $or: [
                {
                  'emission.lastAttemptAt': {
                    $lte: creditNoteStaleBefore,
                  },
                },
                { 'emission.lastAttemptAt': null },
              ],
            },
          ],
        },
      },
    }),
    countDocuments(InvoiceModel, {
      creditNotes: {
        $elemMatch: {
          status: { $in: ['failed', 'rejected'] },
          $or: [
            { failedAt: { $gte: windowStartedAt } },
            { rejectedAt: { $gte: windowStartedAt } },
          ],
        },
      },
    }),
    countDocuments(RecoveryTaskModel, {
      status: { $in: ['pending', 'processing', 'failed'] },
    }),
    countDocuments(RecoveryTaskModel, {
      status: { $in: ['pending', 'processing', 'failed'] },
      nextAttemptAt: { $lte: now },
    }),
    countDocuments(RecoveryTaskModel, {
      status: 'processing',
      lockedAt: { $lte: recoveryStaleBefore },
    }),
    countDocuments(RecoveryTaskModel, { status: 'failed' }),
    findOneLean(
      RecoveryTaskModel,
      { status: { $in: ['pending', 'processing', 'failed'] } },
      'invoiceId orderId referenceCode status reason attempts nextAttemptAt lastAttemptAt lockedAt lastError createdAt updatedAt',
      { nextAttemptAt: 1, createdAt: 1 }
    ),
    findOneLean(
      ActivationModel,
      { key: 'main' },
      'status provider environment activatedAt lastAttemptAt lastErrorCode lastErrorMessage updatedAt'
    ),
  ]);

  return {
    windowStartedAt,
    activationStaleBefore,
    staleInvoices,
    recentInvoiceFailures,
    emailErrors,
    stuckEmails,
    staleCreditNotes,
    recentCreditNoteFailures,
    activeRecoveries,
    overdueRecoveries,
    stuckRecoveries,
    failedRecoveries,
    oldestRecovery,
    activation,
  };
}

module.exports = {
  ACTIVATION_STALE_MS,
  CREDIT_NOTE_STALE_MS,
  DAY_MS,
  EMAIL_STALE_MS,
  INVOICE_STALE_MS,
  RECOVERY_STALE_MS,
  queryOperationalHealthData,
};
