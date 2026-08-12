'use strict';

const {
  applyVerifiedPaidAt,
  isVerifiedPaymentApproval,
} = require('./verifiedPaymentApprovalService');
const {
  isInventoryReadyForBilling,
  isLegacyInventoryReady,
  resolveInitialInventoryStatus,
} = require('./orderInventoryBillingReadinessService');
const {
  asRetryablePaymentInventoryError,
  isPermanentPaymentInventoryError,
  isRetryablePaymentInventoryError,
} = require('./paymentInventoryFailureService');

const INVENTORY_EXCEPTION_PREFIX =
  'Pago aprobado pendiente de confirmacion de inventario';
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
  if (!ElectronicInvoiceModel || typeof ElectronicInvoiceModel.findOne !== 'function') {
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
  if (typeof query?.select === 'function') query = query.select('_id orderId status');
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
  // Carga diferida: conserva una sola normalizacion de identidad sin forzar los
  // modelos de reservas al importar la autoridad pura del webhook.
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
      identityComplete &&
      (verifiedPaymentFact || verifiedProcessingFact),
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

const isRetryableInventoryApprovalError = isRetryablePaymentInventoryError;

function asRetryableInventoryApprovalError(error) {
  if (isPermanentPaymentInventoryError(error)) return error;
  return asRetryablePaymentInventoryError(
    error,
    'INVENTORY_CONFIRMATION_ERROR'
  );
}

function ensurePaymentDocument(order, payments = {}) {
  if (!order.payment || typeof order.payment !== 'object') {
    order.payment = {};
  }

  order.payment.active = true;
  order.payment.provider = 'wompi';
  order.payment.providerLabel = order.payment.providerLabel || 'Wompi';
  order.payment.mode = payments.mode || order.payment.mode || 'sandbox';
  order.payment.currency = order.payment.currency || payments.currency || 'COP';
  order.payment.checkoutLabel = order.payment.checkoutLabel || 'Wompi';
  order.payment.enableWebhook = true;
  return order.payment;
}

function ensurePaymentProcessing(
  order,
  transaction = {},
  { wasApprovedBefore = false } = {}
) {
  const hadPaymentProcessingBefore = Boolean(order.paymentProcessing);
  if (!order.paymentProcessing || typeof order.paymentProcessing !== 'object') {
    order.paymentProcessing = {};
  }
  if (
    !order.paymentProcessing.inventory ||
    typeof order.paymentProcessing.inventory !== 'object'
  ) {
    order.paymentProcessing.inventory = {};
  }
  if (
    !order.paymentProcessing.invoice ||
    typeof order.paymentProcessing.invoice !== 'object'
  ) {
    order.paymentProcessing.invoice = {};
  }

  order.paymentProcessing.provider = 'wompi';
  if (!order.paymentProcessing.approvedTransactionId) {
    order.paymentProcessing.approvedTransactionId = cleanText(
      transaction?.id,
      120
    );
  }
  if (!order.paymentProcessing.inventory.status) {
    order.paymentProcessing.inventory.status =
      resolveInitialInventoryStatus(order, {
        wasApprovedBefore,
        hadPaymentProcessingBefore,
      });
  }
  if (!order.paymentProcessing.invoice.status) {
    order.paymentProcessing.invoice.status = 'pending';
  }

  return order.paymentProcessing;
}

function applyApprovedPaymentFact(
  order,
  transaction = {},
  payments = {},
  now = new Date(),
  { verified = false } = {}
) {
  const payment = ensurePaymentDocument(order, payments);
  // Compatibilidad de clasificacion exclusivamente durante un APPROVED ya
  // verificado: las ordenes antiguas pueden tener paidAt sin la identidad
  // moderna. Esta señal no se expone como autoridad para reconciliar.
  const legacyPaidBeforeVerifiedApproval =
    !order?.paymentProcessing &&
    cleanText(order?.payment?.status, 40).toLowerCase() === 'paid' &&
    Boolean(order?.payment?.paidAt);
  const wasApproved =
    hasPersistedWompiFinancialTerminality(order) ||
    legacyPaidBeforeVerifiedApproval;

  payment.status = 'paid';

  if (!wasApproved || !payment.transactionId) {
    payment.transactionId = cleanText(transaction?.id, 120);
  }
  if (!wasApproved || !payment.reference) {
    payment.reference = cleanText(transaction?.reference, 180);
  }
  if (!wasApproved || !payment.amountInCents) {
    payment.amountInCents = Math.max(
      0,
      Math.round(asNumber(transaction?.amount_in_cents))
    );
    payment.amount = payment.amountInCents / 100;
  }

  const paidAtResult = applyVerifiedPaidAt(order, {
    verified,
    providerStatus: transaction?.status,
    normalizedPaymentStatus: payment.status,
    providerPaidAt: transaction?.finalized_at,
    now,
  });

  if (!wasApproved || !payment.methodType) {
    payment.methodType = cleanText(transaction?.payment_method_type, 80);
  }
  if (!wasApproved || !payment.method) {
    payment.method = cleanText(transaction?.payment_method?.type, 80);
  }
  if (!wasApproved || !payment.methodLabel) {
    payment.methodLabel =
      cleanText(transaction?.payment_method_type, 80) ||
      cleanText(transaction?.payment_method?.type, 80);
  }
  if (
    !wasApproved ||
    !payment.rawMethod ||
    !Object.keys(payment.rawMethod).length
  ) {
    payment.rawMethod = transaction?.payment_method || {};
  }

  const processing = ensurePaymentProcessing(order, transaction, {
    wasApprovedBefore: wasApproved,
  });
  if (!processing.approvedAt) {
    processing.approvedAt = paidAtResult.paidAt || now;
  }

  return { wasApproved, payment, paidAtResult, processing };
}

function resolveMonotonicWompiTransition(
  order = {},
  mapped = {},
  approvalContext = {}
) {
  const currentApproved =
    isApprovedPayment(order, approvalContext) ||
    hasPersistedWompiFinancialTerminality(order);
  const incomingPaymentStatus = cleanText(
    mapped?.paymentStatus,
    40
  ).toLowerCase();

  if (currentApproved && incomingPaymentStatus !== 'paid') {
    return {
      ignored: true,
      reason: 'APPROVED_IS_TERMINAL',
      paymentStatus: 'paid',
      orderStatus: order?.status || 'paid',
    };
  }

  return {
    ignored: false,
    reason: '',
    paymentStatus: incomingPaymentStatus,
    orderStatus: mapped?.orderStatus || null,
  };
}

function markInventoryConfirmationException(order, error, now = new Date()) {
  const code = cleanText(error?.code || 'INVENTORY_CONFIRMATION_ERROR', 100);
  const message = cleanText(
    error?.message || 'No se pudo confirmar la reserva.',
    300
  );
  const operationalMessage = `${INVENTORY_EXCEPTION_PREFIX}: ${code} - ${message}`;
  const processing = ensurePaymentProcessing(order);
  const previousCode = cleanText(processing.inventory.errorCode, 100);
  const previousMessage = cleanText(processing.inventory.errorMessage, 300);

  order.status = 'pending';
  processing.inventory.status = 'failed';
  processing.inventory.lastAttemptAt = now;
  processing.inventory.errorCode = code;
  processing.inventory.errorMessage = message;
  order.fulfillment = order.fulfillment || {};
  order.fulfillment.status = 'action_required';
  order.fulfillment.notificationError = operationalMessage;
  order.inventoryControl = order.inventoryControl || {};
  if (order.inventoryControl.restockedOnFailure !== true) {
    order.inventoryControl.discountedAtCheckout = false;
    order.inventoryControl.restockedOnFailure = false;
    order.inventoryControl.restockedAt = null;
  }

  return {
    changed: previousCode !== code || previousMessage !== message,
    code,
    message,
    operationalMessage,
  };
}

function markInventoryConfirmed(order, now = new Date()) {
  const processing = ensurePaymentProcessing(order);
  processing.inventory.status =
    order?.inventoryControl?.reservationRequired === false
      ? 'not_required'
      : 'confirmed';
  processing.inventory.confirmedAt = now;
  processing.inventory.lastAttemptAt = now;
  processing.inventory.errorCode = '';
  processing.inventory.errorMessage = '';

  const currentError = cleanText(order?.fulfillment?.notificationError, 500);
  if (currentError.startsWith(INVENTORY_EXCEPTION_PREFIX)) {
    order.fulfillment.status = 'pending';
    order.fulfillment.notificationError = '';
  }
}

function createWompiWebhookIntegrityService(overrides = {}) {
  const withOrderTransaction = overrides.withOrderTransaction;
  const confirmReservation = overrides.confirmInventoryReservation;
  const applyReservation = overrides.applyReservationToOrderDocument;
  const createOrderEvent = overrides.createOrderEvent;
  const scheduleInvoiceOnce = overrides.scheduleInvoiceOnce;
  const reconcileFailureRecovery = overrides.reconcileFailureRecovery;
  const nowFactory = overrides.now || (() => new Date());

  if (typeof withOrderTransaction !== 'function') {
    throw new TypeError('withOrderTransaction es obligatorio.');
  }
  if (typeof confirmReservation !== 'function') {
    throw new TypeError('confirmInventoryReservation es obligatorio.');
  }
  if (typeof applyReservation !== 'function') {
    throw new TypeError('applyReservationToOrderDocument es obligatorio.');
  }
  if (typeof scheduleInvoiceOnce !== 'function') {
    throw new TypeError('scheduleInvoiceOnce es obligatorio.');
  }

  async function recordEvent(event, context) {
    if (typeof createOrderEvent === 'function') {
      await createOrderEvent(event, context);
    }
  }

  async function processApproved({
    orderNumber,
    transaction = {},
    payments = {},
    reference = '',
    verified = false,
  } = {}) {
    if (
      !isVerifiedPaymentApproval({
        verified,
        providerStatus: transaction?.status,
        normalizedPaymentStatus: 'paid',
      })
    ) {
      const error = Object.assign(
        new Error('El proveedor no confirmo un pago aprobado verificable.'),
        { code: 'UNVERIFIED_PAYMENT_APPROVAL' }
      );
      return {
        ok: false,
        ignored: true,
        retryable: false,
        inventoryReady: false,
        invoiceEligible: false,
        error,
      };
    }

    async function persistInventoryFailure(error) {
      const failure = await withOrderTransaction(
        orderNumber,
        async (order, context) => {
          if (isInventoryReadyForBilling(order)) {
            return {
              recoveredConcurrently: true,
              orderId: order._id,
              orderNumber: order.orderNumber,
            };
          }
          const exception = markInventoryConfirmationException(
            order,
            error,
            nowFactory()
          );
          if (exception.changed) {
            order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
            order.timeline.push({
              type: 'system',
              message: exception.operationalMessage,
              by: 'wompi_webhook',
              at: nowFactory(),
            });
            await recordEvent(
              {
                orderId: order._id,
                type: 'inventory_reservation_error',
                message:
                  'La aprobacion verificada requiere reintentar la confirmacion de inventario.',
                meta: {
                  provider: 'wompi',
                  orderNumber: order.orderNumber,
                  transactionId: cleanText(transaction?.id, 120),
                  reference: cleanText(
                    reference || transaction?.reference,
                    180
                  ),
                  error: exception.message,
                  code: exception.code,
                  retryable: true,
                },
              },
              context
            );
          }
          return {
            recoveredConcurrently: false,
            orderId: order._id,
            orderNumber: order.orderNumber,
            paymentStatus: cleanText(order?.payment?.status, 40).toLowerCase(),
          };
        }
      );

      if (failure.recoveredConcurrently) {
        const invoice = await scheduleInvoiceOnce({
          orderId: failure.orderId,
          transaction,
          payments,
          paymentProvider: 'wompi',
        });
        return {
          ok: true,
          inventoryReady: true,
          invoiceEligible: true,
          invoiceScheduled: invoice?.scheduled === true,
          recoveredConcurrently: true,
          orderId: failure.orderId,
          orderNumber: failure.orderNumber,
        };
      }
      return {
        ok: false,
        retryable: true,
        inventoryReady: false,
        invoiceEligible: false,
        orderId: failure.orderId,
        orderNumber: failure.orderNumber,
        paymentStatus: failure.paymentStatus,
        error,
      };
    }

    let initial;
    try {
      initial = await withOrderTransaction(
        orderNumber,
        async (order, context) => {
          const failureRecoveryRequired =
            order?.inventoryControl?.restockedOnFailure === true;
          if (failureRecoveryRequired) {
            if (typeof reconcileFailureRecovery !== 'function') {
              throw Object.assign(
                new Error(
                  'La aprobacion requiere reconciliar una recuperacion de inventario previa.'
                ),
                {
                  code: 'PAYMENT_FAILURE_RECONCILIATION_REQUIRED',
                  retryable: true,
                }
              );
            }

            const reconciliation = await reconcileFailureRecovery({
              order,
              provider: 'wompi',
              paymentReference: reference || transaction?.reference || '',
              paymentTransactionId: transaction?.id || '',
              session: context.session,
            });
            let reservation = reconciliation?.reservation || null;
            if (reconciliation?.action === 'reconcile_reservation') {
              try {
                reservation = await confirmReservation(
                  reservation?._id || order?.inventoryControl?.reservationId,
                  {
                    order: order._id,
                    orderNumber: order.orderNumber,
                    paymentReference: reference || transaction?.reference || '',
                    paymentTransactionId: transaction?.id || '',
                  },
                  { session: context.session, syncOrderAllocations: false }
                );
              } catch (error) {
                throw asRetryableInventoryApprovalError(error);
              }
              applyReservation(order, reservation);
              order.inventoryControl = order.inventoryControl || {};
              order.inventoryControl.discountedAtCheckout = true;
              const reservationConfirmed =
                cleanText(reservation?.status, 40).toLowerCase() === 'confirmed';
              if (!reservationConfirmed || !isLegacyInventoryReady(order)) {
                throw Object.assign(
                  new Error(
                    'La reserva reconciliada no quedo confirmada completamente.'
                  ),
                  {
                    code: 'PAYMENT_FAILURE_RECONCILIATION_INCONSISTENT',
                    retryable: true,
                  }
                );
              }
            }

            const beforeOrderStatus = cleanText(order.status, 40).toLowerCase();
            const beforePaymentStatus = cleanText(
              order?.payment?.status,
              40
            ).toLowerCase();
            const { wasApproved } = applyApprovedPaymentFact(
              order,
              transaction,
              payments,
              nowFactory(),
              { verified }
            );
            if (reconciliation?.action === 'reconcile_not_required') {
              order.inventoryControl.reservationRequired = false;
            }
            order.inventoryControl = order.inventoryControl || {};
            order.inventoryControl.restockedOnFailure = false;
            order.inventoryControl.restockedAt = null;
            if (reconciliation?.action !== 'reconcile_not_required') {
              order.inventoryControl.discountedAtCheckout = true;
            }
            markInventoryConfirmed(order, nowFactory());
            if (!isInventoryReadyForBilling(order)) {
              throw Object.assign(
                new Error('El inventario reconciliado no quedo listo para facturar.'),
                {
                  code: 'PAYMENT_FAILURE_RECONCILIATION_NOT_READY',
                  retryable: true,
                }
              );
            }
            order.status = 'paid';
            const afterOrderStatus = cleanText(order.status, 40).toLowerCase();
            const afterPaymentStatus = cleanText(
              order?.payment?.status,
              40
            ).toLowerCase();
            order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
            order.timeline.push({
              type: 'system',
              message: `Wompi webhook: Pago aprobado e inventario reconciliado${transaction?.id ? ` - TX ${transaction.id}` : ''}`,
              by: 'wompi_webhook',
              at: nowFactory(),
            });
            await recordEvent(
              {
                orderId: order._id,
                type: 'inventory_reservation_confirmed',
                message:
                  'Recuperacion de inventario reconciliada por pago aprobado.',
                meta: {
                  provider: 'wompi',
                  transactionId: cleanText(transaction?.id, 120),
                  reference: cleanText(
                    reference || transaction?.reference,
                    180
                  ),
                  reconciliationAction: reconciliation?.action || '',
                  fromOrderStatus: beforeOrderStatus || null,
                  toOrderStatus: afterOrderStatus || null,
                  fromPaymentStatus: beforePaymentStatus || null,
                  toPaymentStatus: afterPaymentStatus || null,
                },
              },
              context
            );
            return {
              orderId: order._id,
              orderNumber: order.orderNumber,
              inventoryReady: true,
              wasApproved,
              reconciledFailureRecovery: true,
            };
          }

          const beforeOrderStatus = cleanText(order.status, 40).toLowerCase();
          const beforePaymentStatus = cleanText(
            order?.payment?.status,
            40
          ).toLowerCase();
          const { wasApproved } = applyApprovedPaymentFact(
            order,
            transaction,
            payments,
            nowFactory(),
            { verified }
          );
          let inventoryReady = isInventoryReadyForBilling(order);
          if (!inventoryReady && wasApproved) {
            return {
              orderId: order._id,
              orderNumber: order.orderNumber,
              inventoryReady: false,
              wasApproved: true,
              needsInventoryRetry: true,
            };
          }
          if (!inventoryReady) {
            let reservation;
            try {
              reservation = await confirmReservation(
                order?.inventoryControl?.reservationId || orderNumber,
                {
                  order: order._id,
                  orderNumber: order.orderNumber,
                  paymentReference: reference || transaction?.reference || '',
                  paymentTransactionId: transaction?.id || '',
                },
                { session: context.session, syncOrderAllocations: false }
              );
            } catch (error) {
              throw asRetryableInventoryApprovalError(error);
            }
            applyReservation(order, reservation);
            order.inventoryControl = order.inventoryControl || {};
            order.inventoryControl.discountedAtCheckout = true;
            order.inventoryControl.restockedOnFailure = false;
            order.inventoryControl.restockedAt = null;
            if (
              cleanText(reservation?.status, 40).toLowerCase() !== 'confirmed' ||
              !isLegacyInventoryReady(order)
            ) {
              throw Object.assign(
                new Error(
                  'La reserva confirmada no dejo asignaciones facturables.'
                ),
                {
                  code: 'INVENTORY_CONFIRMATION_INCONSISTENT',
                  retryable: true,
                }
              );
            }
            markInventoryConfirmed(order, nowFactory());
            inventoryReady = isInventoryReadyForBilling(order);
            if (!inventoryReady) {
              throw Object.assign(
                new Error('El inventario confirmado no quedo listo.'),
                {
                  code: 'INVENTORY_CONFIRMATION_NOT_READY',
                  retryable: true,
                }
              );
            }
            await recordEvent(
              {
                orderId: order._id,
                type: 'inventory_reservation_confirmed',
                message: 'Reserva de inventario confirmada por pago aprobado.',
                meta: {
                  provider: 'wompi',
                  orderNumber: order.orderNumber,
                  reservationId: reservation?._id || null,
                  reservationCode: reservation?.reservationCode || '',
                  paymentReference: cleanText(
                    reference || transaction?.reference,
                    180
                  ),
                  paymentTransactionId: cleanText(transaction?.id, 120),
                },
              },
              context
            );
          }

          order.status = 'paid';
          const afterOrderStatus = cleanText(order.status, 40).toLowerCase();
          const afterPaymentStatus = cleanText(
            order?.payment?.status,
            40
          ).toLowerCase();
          if (
            beforeOrderStatus !== afterOrderStatus ||
            beforePaymentStatus !== afterPaymentStatus
          ) {
            order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
            order.timeline.push({
              type: 'system',
              message: `Wompi webhook: Pago aprobado${transaction?.id ? ` - TX ${transaction.id}` : ''}`,
              by: 'wompi_webhook',
              at: nowFactory(),
            });
            await recordEvent(
              {
                orderId: order._id,
                type: 'payment_updated',
                message: 'Wompi webhook: Pago aprobado.',
                meta: {
                  by: 'wompi_webhook',
                  provider: 'wompi',
                  transactionId: cleanText(transaction?.id, 120),
                  reference: cleanText(
                    reference || transaction?.reference,
                    180
                  ),
                  fromOrderStatus: beforeOrderStatus || null,
                  toOrderStatus: afterOrderStatus || null,
                  fromPaymentStatus: beforePaymentStatus || null,
                  toPaymentStatus: afterPaymentStatus || null,
                },
              },
              context
            );
          }
          return {
            orderId: order._id,
            orderNumber: order.orderNumber,
            inventoryReady,
            wasApproved,
          };
        }
      );
    } catch (error) {
      if (!isRetryableInventoryApprovalError(error)) throw error;
      return persistInventoryFailure(error);
    }

    if (initial.needsInventoryRetry) {
      let reservation;
      try {
        reservation = await confirmReservation(
          orderNumber,
          {
            order: initial.orderId,
            orderNumber: initial.orderNumber,
            paymentReference: reference || transaction?.reference || '',
            paymentTransactionId: transaction?.id || '',
          },
          { syncOrderAllocations: false }
        );
      } catch (error) {
        return persistInventoryFailure(asRetryableInventoryApprovalError(error));
      }

      try {
        initial = await withOrderTransaction(
          orderNumber,
          async (order, context) => {
            if (order?.inventoryControl?.restockedOnFailure === true) {
              throw Object.assign(
                new Error(
                  'La recuperacion por pago fallido debe reconciliarse antes de aprobar.'
                ),
                {
                  code: 'PAYMENT_FAILURE_RECONCILIATION_REQUIRED',
                  retryable: true,
                }
              );
            }
            const beforeOrderStatus = cleanText(order.status, 40).toLowerCase();
            const beforePaymentStatus = cleanText(
              order?.payment?.status,
              40
            ).toLowerCase();
            const { wasApproved } = applyApprovedPaymentFact(
              order,
              transaction,
              payments,
              nowFactory(),
              { verified }
            );
            applyReservation(order, reservation);
            order.inventoryControl = order.inventoryControl || {};
            order.inventoryControl.discountedAtCheckout = true;
            order.inventoryControl.restockedOnFailure = false;
            order.inventoryControl.restockedAt = null;
            if (
              cleanText(reservation?.status, 40).toLowerCase() !== 'confirmed' ||
              !isLegacyInventoryReady(order)
            ) {
              throw Object.assign(
                new Error(
                  'La reserva reintentada no dejo asignaciones facturables.'
                ),
                {
                  code: 'INVENTORY_CONFIRMATION_INCONSISTENT',
                  retryable: true,
                }
              );
            }
            markInventoryConfirmed(order, nowFactory());
            if (!isInventoryReadyForBilling(order)) {
              throw Object.assign(
                new Error('El inventario reintentado no quedo listo.'),
                {
                  code: 'INVENTORY_CONFIRMATION_NOT_READY',
                  retryable: true,
                }
              );
            }
            order.status = 'paid';
            const afterOrderStatus = cleanText(order.status, 40).toLowerCase();
            const afterPaymentStatus = cleanText(
              order?.payment?.status,
              40
            ).toLowerCase();
            order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
            order.timeline.push({
              type: 'system',
              message: `Wompi webhook: Inventario reintentado para pago aprobado${transaction?.id ? ` - TX ${transaction.id}` : ''}`,
              by: 'wompi_webhook',
              at: nowFactory(),
            });
            await recordEvent(
              {
                orderId: order._id,
                type: 'inventory_reservation_confirmed',
                message: 'Reserva confirmada al reintentar un pago ya aprobado.',
                meta: {
                  provider: 'wompi',
                  transactionId: cleanText(transaction?.id, 120),
                  reference: cleanText(
                    reference || transaction?.reference,
                    180
                  ),
                  fromOrderStatus: beforeOrderStatus || null,
                  toOrderStatus: afterOrderStatus || null,
                  fromPaymentStatus: beforePaymentStatus || null,
                  toPaymentStatus: afterPaymentStatus || null,
                },
              },
              context
            );
            return {
              orderId: order._id,
              orderNumber: order.orderNumber,
              inventoryReady: true,
              wasApproved,
            };
          }
        );
      } catch (error) {
        if (!isRetryableInventoryApprovalError(error)) throw error;
        return persistInventoryFailure(error);
      }
    }

    if (initial.inventoryReady) {
      const invoice = await scheduleInvoiceOnce({
        orderId: initial.orderId,
        transaction,
        payments,
        paymentProvider: 'wompi',
      });

      return {
        ok: true,
        inventoryReady: true,
        invoiceEligible: true,
        invoiceScheduled: invoice?.scheduled === true,
        duplicateApproved: initial.wasApproved,
        orderId: initial.orderId,
        orderNumber: initial.orderNumber,
      };
    }

    return persistInventoryFailure(
      Object.assign(new Error('La transaccion no confirmo el inventario.'), {
        code: 'INVENTORY_CONFIRMATION_NOT_READY',
        retryable: true,
      })
    );
  }

  return { processApproved };
}

module.exports = {
  CANONICAL_ELECTRONIC_INVOICE_STATUSES,
  INVENTORY_EXCEPTION_PREFIX,
  applyApprovedPaymentFact,
  createWompiWebhookIntegrityService,
  findCanonicalElectronicInvoice,
  getCanonicalPaymentApprovalEvidence,
  isApprovedPayment,
  isRetryableInventoryApprovalError,
  markInventoryConfirmationException,
  markInventoryConfirmed,
  resolveMonotonicWompiTransition,
};
