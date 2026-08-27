'use strict';

function requireFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`PAYU_CHECKOUT_DEPENDENCY_REQUIRED:${name}`);
  }
  return value;
}

function createPayUCheckoutController({
  OrderModel,
  getActivePaymentsConfig,
  publicPaymentAccessService,
  configurationService,
  paymentAttemptService,
  paymentAmountService,
  fingerprintPaymentMerchant,
  signatureService,
  logger = console,
} = {}) {
  if (!OrderModel) {
    throw new TypeError('PAYU_CHECKOUT_DEPENDENCY_REQUIRED:OrderModel');
  }

  const loadPayments = requireFunction(
    getActivePaymentsConfig,
    'getActivePaymentsConfig'
  );
  const {
    SAFE_PAYMENT_ACCESS_ERROR,
    isValidObjectIdText,
    resolveAuthorizedPublicPaymentOrder,
  } = publicPaymentAccessService || {};
  const {
    PAYU_CHECKOUT_URLS,
    buildCustomerData,
    buildGatewayAttemptReference,
    buildPayUConfirmationUrl,
    buildRedirectUrl,
    trimSafe,
    verifyPayUProductionConfig,
  } = configurationService || {};
  const { resolvePayUExternalAmount } = paymentAmountService || {};
  const { issueAttempt } = paymentAttemptService || {};
  const { buildPayUPaymentSignature } = signatureService || {};

  [
    ['isValidObjectIdText', isValidObjectIdText],
    ['resolveAuthorizedPublicPaymentOrder', resolveAuthorizedPublicPaymentOrder],
    ['buildCustomerData', buildCustomerData],
    ['buildGatewayAttemptReference', buildGatewayAttemptReference],
    ['buildPayUConfirmationUrl', buildPayUConfirmationUrl],
    ['buildRedirectUrl', buildRedirectUrl],
    ['trimSafe', trimSafe],
    ['verifyPayUProductionConfig', verifyPayUProductionConfig],
    ['issueAttempt', issueAttempt],
    ['resolvePayUExternalAmount', resolvePayUExternalAmount],
    ['fingerprintPaymentMerchant', fingerprintPaymentMerchant],
    ['buildPayUPaymentSignature', buildPayUPaymentSignature],
  ].forEach(([name, dependency]) => requireFunction(dependency, name));

  if (!SAFE_PAYMENT_ACCESS_ERROR || !PAYU_CHECKOUT_URLS) {
    throw new TypeError('PAYU_CHECKOUT_DEPENDENCY_REQUIRED:constants');
  }

  return async function createPayUCheckoutData(req, res) {
    try {
      const orderId = trimSafe(req.body?.orderId, 100);

      if (!isValidObjectIdText(orderId)) {
        return res.status(404).json(SAFE_PAYMENT_ACCESS_ERROR);
      }

      const access = await resolveAuthorizedPublicPaymentOrder({
        req,
        OrderModel,
        orderId,
      });

      if (!access.allowed) {
        return res.status(404).json(SAFE_PAYMENT_ACCESS_ERROR);
      }

      const order = access.order;
      const paymentStatus = trimSafe(order.payment?.status, 40).toLowerCase();
      const orderStatus = trimSafe(order.status, 40).toLowerCase();

      if (
        ['paid', 'cancelled'].includes(paymentStatus) ||
        ['cancelled', 'canceled', 'refunded'].includes(orderStatus)
      ) {
        return res.status(409).json({
          ok: false,
          error: 'PAYMENT_CHECKOUT_NOT_AVAILABLE',
          message: 'Esta orden no admite un nuevo intento de pago.',
        });
      }

      const payments = await loadPayments();
      const configCheck = verifyPayUProductionConfig(payments);

      if (!configCheck.ok) {
        return res.status(configCheck.status).json({
          error: configCheck.error,
          message: 'La configuración de PayU no está lista para operar.',
        });
      }

      const amountResolution = resolvePayUExternalAmount(order);

      if (!amountResolution.ok) {
        return res.status(422).json({
          error: amountResolution.error,
          message:
            'La orden no tiene un importe externo pendiente válido para iniciar el pago.',
        });
      }

      const amount = amountResolution.amount;
      const payu = payments.credentials.payu;
      const currency = payments.currency || 'COP';
      const proposedReference = buildGatewayAttemptReference(order);
      const merchantFingerprint = fingerprintPaymentMerchant(
        'payu',
        `${payu.merchantId}:${payu.accountId}`
      );
      const attemptResult = await issueAttempt({
        orderId: order._id,
        provider: 'payu',
        reference: proposedReference,
        amountInCents: amountResolution.amountInCents,
        currency,
        merchantFingerprint,
      });
      const referenceCode = trimSafe(attemptResult?.attempt?.reference, 220);

      if (!referenceCode) {
        throw Object.assign(
          new Error('No fue posible registrar el intento de pago PayU.'),
          { code: 'PAYMENT_ATTEMPT_NOT_ISSUED', statusCode: 503, retryable: true }
        );
      }

      const signatureData = buildPayUPaymentSignature({
        apiKey: payu.apiKey,
        merchantId: payu.merchantId,
        referenceCode,
        amount,
        currency,
      });

      return res.json({
        ok: true,
        provider: 'payu',
        mode: payments.mode,
        checkoutLabel: payments.checkoutLabel || 'PayU',
        successMessage: payments.successMessage || '',
        actionUrl:
          PAYU_CHECKOUT_URLS[payments.mode] || PAYU_CHECKOUT_URLS.sandbox,
        order: {
          id: String(order._id),
          orderNumber: order.orderNumber || '',
          total: Number(order.total || 0),
          paymentAmount: amount,
        },
        payu: {
          merchantId: payu.merchantId,
          accountId: payu.accountId,
          referenceCode,
          description: `Pago orden ${order.orderNumber || referenceCode}`,
          amount,
          tax: Number(order.taxes?.iva?.amount || 0),
          taxReturnBase: Number(
            order.pricing?.taxableBase ??
              order.pricing?.subtotalAfterDiscount ??
              order.subtotal ??
              amount
          ),
          currency,
          signature: signatureData.signature,
          algorithmSignature: signatureData.algorithm,
          redirectUrl: buildRedirectUrl(req, order),
          responseUrl: buildRedirectUrl(req, order),
          confirmationUrl: buildPayUConfirmationUrl(),
          test: payments.mode === 'sandbox' ? 1 : 0,
        },
        customerData: buildCustomerData(order),
      });
    } catch (error) {
      logger.error('POST /payments/payu/checkout-data secure', error);

      if (error?.code === 'PAYMENT_ACCESS_SECRET_MISCONFIGURED') {
        return res.status(500).json({
          ok: false,
          error: 'PAYMENT_ACCESS_UNAVAILABLE',
          message: 'No fue posible validar el acceso al pago.',
        });
      }

      if (
        ['PAYMENT_ATTEMPT_ORDER_CLOSED', 'PAYMENT_ATTEMPT_ORDER_CHANGED'].includes(
          error?.code
        )
      ) {
        return res.status(409).json({
          ok: false,
          error: 'PAYMENT_CHECKOUT_NOT_AVAILABLE',
          message: 'Esta orden no admite un nuevo intento de pago.',
        });
      }

      return res.status(500).json({
        error: 'PAYU_CHECKOUT_DATA_ERROR',
        message: 'No se pudo preparar el checkout de PayU.',
      });
    }
  };
}

module.exports = {
  createPayUCheckoutController,
};
