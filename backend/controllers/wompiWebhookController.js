'use strict';

const crypto = require('crypto');

function secureChecksumEquals(provided, expected) {
  const left = String(provided || '').trim().toLowerCase();
  const right = String(expected || '').trim().toLowerCase();

  if (
    !left ||
    !right ||
    left.length !== right.length ||
    left.length % 2 !== 0 ||
    !/^[a-f0-9]+$/.test(left) ||
    !/^[a-f0-9]+$/.test(right)
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(left, 'hex'),
    Buffer.from(right, 'hex')
  );
}

function requireFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`WOMPI_WEBHOOK_DEPENDENCY_REQUIRED:${name}`);
  }
  return value;
}

function createWompiWebhookController({
  OrderModel,
  getActivePaymentsConfig,
  wompiWebhookOrderService,
  amountToCents,
  buildWompiEventChecksum,
  extractOrderNumberFromWompiReference,
  getWompiProvidedChecksum,
  parseWompiTransactionStatus,
  trimSafe,
  isRetryablePaymentInventoryError,
  logger = console,
} = {}) {
  if (!OrderModel || typeof OrderModel.findOne !== 'function') {
    throw new TypeError('WOMPI_WEBHOOK_ORDER_MODEL_REQUIRED');
  }

  const loadPayments = requireFunction(
    getActivePaymentsConfig,
    'getActivePaymentsConfig'
  );
  const processApproved = requireFunction(
    wompiWebhookOrderService?.processApproved,
    'wompiWebhookOrderService.processApproved'
  );
  const processNonApproved = requireFunction(
    wompiWebhookOrderService?.processNonApproved,
    'wompiWebhookOrderService.processNonApproved'
  );
  const findPaymentAttempt = requireFunction(
    wompiWebhookOrderService?.findPaymentAttempt,
    'wompiWebhookOrderService.findPaymentAttempt'
  );
  const toCents = requireFunction(amountToCents, 'amountToCents');
  const calculateChecksum = requireFunction(
    buildWompiEventChecksum,
    'buildWompiEventChecksum'
  );
  const orderNumberFromReference = requireFunction(
    extractOrderNumberFromWompiReference,
    'extractOrderNumberFromWompiReference'
  );
  const providedChecksumFrom = requireFunction(
    getWompiProvidedChecksum,
    'getWompiProvidedChecksum'
  );
  const mapStatus = requireFunction(
    parseWompiTransactionStatus,
    'parseWompiTransactionStatus'
  );
  const clean = requireFunction(trimSafe, 'trimSafe');
  const isRetryableInventoryError = requireFunction(
    isRetryablePaymentInventoryError,
    'isRetryablePaymentInventoryError'
  );

  async function handleWompiWebhook(req, res) {
    try {
      const payload = req.body && typeof req.body === 'object' ? req.body : {};
      const payments = await loadPayments();
      const wompi = payments.credentials?.wompi || {};

      if (!wompi.webhookSecret) {
        return res.status(500).json({
          ok: false,
          error: 'WOMPI_WEBHOOK_SECRET_MISSING',
          message: 'No hay webhook secret configurado para Wompi.',
        });
      }

      const providedChecksum = providedChecksumFrom(req, payload);
      const calculatedChecksum = calculateChecksum(
        payload,
        wompi.webhookSecret
      ).toLowerCase();

      if (!secureChecksumEquals(providedChecksum, calculatedChecksum)) {
        return res.status(400).json({
          ok: false,
          error: 'INVALID_WOMPI_CHECKSUM',
          message: 'La firma del evento de Wompi no es válida.',
        });
      }

      const eventName = clean(payload?.event, 80);
      if (eventName !== 'transaction.updated') {
        return res.status(200).json({
          ok: true,
          ignored: true,
          event: eventName || null,
          message: 'Evento recibido sin acción requerida.',
        });
      }

      const transaction =
        payload?.data?.transaction &&
        typeof payload.data.transaction === 'object'
          ? payload.data.transaction
          : null;

      if (!transaction) {
        return res.status(400).json({
          ok: false,
          error: 'WOMPI_TRANSACTION_MISSING',
          message: 'El evento no contiene transaction.',
        });
      }

      const reference = clean(transaction.reference, 200);
      const orderNumber = orderNumberFromReference(reference);

      if (!orderNumber) {
        return res.status(400).json({
          ok: false,
          error: 'ORDER_REFERENCE_NOT_FOUND',
          message:
            'No se pudo extraer el número de orden desde la referencia de Wompi.',
        });
      }

      const existingOrder = await OrderModel.findOne({ orderNumber });

      if (!existingOrder) {
        return res.status(404).json({
          ok: false,
          error: 'ORDER_NOT_FOUND',
          message: `No se encontró la orden ${orderNumber}.`,
        });
      }

      const transactionAmountInCents = Math.round(
        Number(transaction.amount_in_cents || 0)
      );
      const transactionCurrency = clean(
        transaction.currency,
        12
      ).toUpperCase();
      const mapped = mapStatus(transaction.status);

      if (mapped.paymentStatus === 'paid') {
        const approvedResult = await processApproved({
          orderNumber,
          transaction,
          payments,
          reference,
          verified: true,
        });

        if (approvedResult.reconciliationRequired === true) {
          logger.error('Wompi reporto un cobro que requiere conciliacion.', {
            orderNumber,
            transactionId: clean(transaction.id, 120),
            reference,
            code: approvedResult.reconciliationCode || '',
          });
          return res.status(200).json({
            ok: true,
            received: true,
            applied: false,
            reconciliationRequired: true,
            error:
              approvedResult.reconciliationCode ||
              'PAYMENT_RECONCILIATION_REQUIRED',
            message:
              'El cobro fue registrado para conciliacion y no se aplico automaticamente a la orden.',
            event: eventName,
            orderNumber,
            orderStatus: existingOrder.status || 'pending',
            paymentStatus: existingOrder.payment?.status || 'pending_gateway',
            transactionId: clean(transaction.id, 120),
            reference,
          });
        }

        if (!approvedResult.ok) {
          const postCommitPending =
            approvedResult.postCommitPending === true;
          logger.error(
            postCommitPending
              ? 'Wompi aprobó el pago, pero sus efectos posteriores requieren reintento.'
              : 'Wompi aprobo el pago, pero la reserva de inventario requiere reintento.',
            {
              orderNumber,
              transactionId: clean(transaction.id, 120),
              code: approvedResult.error?.code || '',
            }
          );

          return res.status(503).json({
            ok: false,
            received: true,
            retryable: true,
            error: postCommitPending
              ? 'PAYMENT_POST_COMMIT_RETRY_REQUIRED'
              : 'INVENTORY_CONFIRMATION_PENDING',
            message: postCommitPending
              ? 'El pago quedó aprobado, pero la entrega o la facturación requieren un reintento durable.'
              : 'Wompi aprobo el pago, pero la orden local espera una confirmacion atomica de inventario.',
            event: eventName,
            orderNumber,
            orderStatus: postCommitPending ? 'paid' : 'pending',
            providerPaymentStatus: 'paid',
            paymentStatus: postCommitPending
              ? 'paid'
              : approvedResult.paymentStatus || 'pending_gateway',
            transactionId: clean(transaction.id, 120),
            reference,
          });
        }

        return res.status(200).json({
          ok: true,
          received: true,
          event: eventName,
          orderNumber: approvedResult.orderNumber || orderNumber,
          orderStatus: 'paid',
          paymentStatus: 'paid',
          inventoryConfirmed: approvedResult.inventoryReady === true,
          invoiceEligible: approvedResult.invoiceEligible === true,
          invoiceScheduled: approvedResult.invoiceScheduled === true,
          duplicateApproved: approvedResult.duplicateApproved === true,
          transactionId: clean(transaction.id, 120),
          reference,
        });
      }

      const attempt = await findPaymentAttempt({
        provider: 'wompi',
        reference,
      });
      const attemptAmountInCents = Math.round(
        Number(attempt?.amountInCents || 0)
      );
      const attemptCurrency = clean(attempt?.currency, 12).toUpperCase();
      const attemptIsActive = Boolean(
        attempt?.active === true &&
          clean(attempt?.state, 40).toLowerCase() === 'issued'
      );
      if (
        !attemptIsActive ||
        transactionAmountInCents <= 0 ||
        transactionAmountInCents !== attemptAmountInCents ||
        !transactionCurrency ||
        transactionCurrency !== attemptCurrency
      ) {
        return res.status(200).json({
          ok: true,
          received: true,
          ignored: true,
          reason: !attempt
            ? 'PAYMENT_ATTEMPT_UNKNOWN'
            : !attemptIsActive
              ? 'PAYMENT_ATTEMPT_NOT_ACTIVE'
              : 'PAYMENT_ATTEMPT_VALUE_MISMATCH',
          event: eventName,
          orderNumber,
          orderStatus: existingOrder.status,
          paymentStatus: existingOrder.payment?.status || 'pending_gateway',
          transactionId: clean(transaction.id, 120),
          reference,
        });
      }

      const responsePayload = await processNonApproved({
        existingOrder,
        mapped,
        orderNumber,
        transaction,
        payments,
        reference,
        eventName,
      });

      return res.status(200).json(responsePayload);
    } catch (error) {
      logger.error('POST /payments/wompi/webhook', error);
      if (isRetryableInventoryError(error)) {
        return res.status(503).json({
          ok: false,
          received: true,
          retryable: true,
          error: error.code || 'PAYMENT_INVENTORY_RECOVERY_RETRYABLE',
          message:
            'La recuperacion de inventario no termino y debe reintentarse.',
        });
      }
      return res.status(500).json({ error: 'WOMPI_WEBHOOK_ERROR' });
    }
  }

  return Object.freeze({ handleWompiWebhook });
}

module.exports = {
  createWompiWebhookController,
  secureChecksumEquals,
};
