'use strict';

const CANONICAL_ELECTRONIC_INVOICE_STATUSES = Object.freeze([
  'generated',
  'sent',
  'accepted',
]);

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function asNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

async function findCanonicalElectronicInvoice({
  ElectronicInvoiceModel,
  orderId,
  session,
} = {}) {
  if (
    !ElectronicInvoiceModel ||
    typeof ElectronicInvoiceModel.findOne !== 'function'
  ) {
    throw new TypeError('ElectronicInvoiceModel es obligatorio.');
  }
  if (!orderId || !session) {
    throw new TypeError('orderId y session son obligatorios.');
  }

  let query = ElectronicInvoiceModel.findOne(
    {
      orderId,
      status: { $in: [...CANONICAL_ELECTRONIC_INVOICE_STATUSES] },
    },
    '_id orderId status',
    { session }
  );
  if (typeof query?.session === 'function') query = query.session(session);
  if (typeof query?.select === 'function') {
    query = query.select('_id orderId status');
  }
  if (typeof query?.lean === 'function') query = query.lean();
  return query;
}

function getCanonicalPaymentApprovalEvidence(
  order = {},
  {
    electronicInvoice = null,
    orderId = null,
    provider = '',
    paymentReference = '',
    paymentTransactionId = '',
  } = {}
) {
  const { normalizePaymentReferenceIdentity } = require('./inventoryReservationService');
  const persistedOrderId = cleanText(order?._id, 120);
  const persistedOrderNumber = cleanText(order?.orderNumber, 80);
  const paymentStatus = cleanText(order?.payment?.status, 40).toLowerCase();
  const orderStatus = cleanText(order?.status, 40).toLowerCase();
  const invoiceProcessingStatus = cleanText(
    order?.paymentProcessing?.invoice?.status,
    40
  ).toLowerCase();
  const electronicInvoiceStatus = cleanText(
    electronicInvoice?.status,
    40
  ).toLowerCase();
  const paymentProvider = cleanText(order?.payment?.provider, 40).toLowerCase();
  const processingProvider = cleanText(
    order?.paymentProcessing?.provider,
    40
  ).toLowerCase();
  const persistedProvider = processingProvider || paymentProvider;
  const persistedReference = cleanText(order?.payment?.reference, 180);
  const persistedCanonicalReference = normalizePaymentReferenceIdentity(
    persistedReference
  );
  const expectedCanonicalReference = normalizePaymentReferenceIdentity(
    `ORDER-${persistedOrderNumber}`
  );
  const persistedPaymentTransactionId = cleanText(
    order?.payment?.transactionId,
    120
  );
  const persistedApprovedTransactionId = cleanText(
    order?.paymentProcessing?.approvedTransactionId,
    120
  );
  const persistedApprovedAt = order?.paymentProcessing?.approvedAt || null;
  const contextualOrderId = cleanText(orderId, 120);
  const contextualProvider = cleanText(provider, 40).toLowerCase();
  const contextualReference = cleanText(paymentReference, 180);
  const contextualCanonicalReference = normalizePaymentReferenceIdentity(
    contextualReference
  );
  const contextualTransactionId = cleanText(paymentTransactionId, 120);

  const samePersistedProvider =
    persistedProvider === 'wompi' &&
    (!paymentProvider || paymentProvider === 'wompi') &&
    (!processingProvider || processingProvider === 'wompi');
  const samePersistedPurchase = Boolean(
    persistedOrderId &&
      persistedOrderNumber &&
      persistedReference &&
      persistedCanonicalReference &&
      persistedCanonicalReference === expectedCanonicalReference
  );
  const sameContextualPurchase = Boolean(
    (!contextualOrderId || contextualOrderId === persistedOrderId) &&
      (!contextualProvider || contextualProvider === 'wompi') &&
      (!contextualReference ||
        contextualCanonicalReference === expectedCanonicalReference) &&
      (!contextualReference || contextualTransactionId) &&
      (!contextualTransactionId ||
        contextualTransactionId === persistedPaymentTransactionId ||
        contextualTransactionId === persistedApprovedTransactionId)
  );
  const transactionIdentityComplete = Boolean(
    persistedPaymentTransactionId &&
      (!persistedApprovedTransactionId ||
        persistedApprovedTransactionId === persistedPaymentTransactionId)
  );
  const verifiedPaymentFact = Boolean(
    paymentStatus === 'paid' &&
      order?.payment?.paidAt &&
      transactionIdentityComplete
  );
  const verifiedProcessingFact = Boolean(
    persistedApprovedAt &&
      persistedApprovedTransactionId &&
      persistedPaymentTransactionId &&
      persistedApprovedTransactionId === persistedPaymentTransactionId
  );
  const identityComplete = Boolean(
    samePersistedProvider &&
      samePersistedPurchase &&
      sameContextualPurchase &&
      transactionIdentityComplete
  );
  const evidence = {
    paymentStatus: verifiedPaymentFact,
    paidAt: verifiedPaymentFact,
    orderStatus: orderStatus === 'paid' && verifiedPaymentFact,
    approvedProcessing: verifiedProcessingFact,
    invoiceProcessing: false,
    electronicInvoice: false,
    identityComplete,
    persistedProvider: samePersistedProvider,
    persistedPurchase: samePersistedPurchase,
    contextualPurchase: sameContextualPurchase,
    fiscalStatusObserved:
      invoiceProcessingStatus === 'scheduled' ||
      [
        'generated',
        'sent',
        'accepted',
        'pending',
        'processing',
        'reconciliation_pending',
        'failed',
        'error',
        'rejected',
      ].includes(electronicInvoiceStatus),
  };

  return {
    approved:
      identityComplete && (verifiedPaymentFact || verifiedProcessingFact),
    evidence,
    identity: {
      orderId: persistedOrderId,
      orderNumber: persistedOrderNumber,
      provider: persistedProvider,
      canonicalReference: persistedCanonicalReference,
      approvedTransactionId:
        persistedApprovedTransactionId || persistedPaymentTransactionId,
    },
  };
}

function isApprovedPayment(order = {}, context = {}) {
  return getCanonicalPaymentApprovalEvidence(order, context).approved;
}

function hasPersistedWompiFinancialTerminality(order = {}) {
  const provider = cleanText(
    order?.paymentProcessing?.provider || order?.payment?.provider,
    40
  ).toLowerCase();
  const paymentTransactionId = cleanText(order?.payment?.transactionId, 120);
  const approvedTransactionId = cleanText(
    order?.paymentProcessing?.approvedTransactionId,
    120
  );
  const approvedPayment =
    cleanText(order?.payment?.status, 40).toLowerCase() === 'paid' &&
    Boolean(order?.payment?.paidAt) &&
    Boolean(paymentTransactionId);
  const approvedProcessing =
    Boolean(order?.paymentProcessing?.approvedAt) &&
    Boolean(approvedTransactionId) &&
    (!paymentTransactionId || approvedTransactionId === paymentTransactionId);

  return provider === 'wompi' && (approvedPayment || approvedProcessing);
}

module.exports = {
  CANONICAL_ELECTRONIC_INVOICE_STATUSES,
  asNumber,
  cleanText,
  findCanonicalElectronicInvoice,
  getCanonicalPaymentApprovalEvidence,
  hasPersistedWompiFinancialTerminality,
  isApprovedPayment,
};
