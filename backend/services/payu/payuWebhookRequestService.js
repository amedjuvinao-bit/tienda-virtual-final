'use strict';

function response(status, body) {
  return { status, body };
}

async function preparePayUWebhookRequest({
  req,
  OrderModel,
  loadPayments,
  verifyPayUWebhookConfig,
  validatePayUIpIfEnabled,
  trimSafe,
  parseBoolean,
  validatePayUSignature,
  extractOrderNumberFromReference,
  parseAmount,
  parsePayUWebhookStatus,
}) {
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const payments = await loadPayments();
  const configCheck = verifyPayUWebhookConfig(payments);

  if (!configCheck.ok) {
    return {
      earlyResponse: response(configCheck.status, {
        ok: false,
        error: configCheck.error,
        message:
          'La configuración de PayU no está lista para recibir confirmaciones.',
      }),
    };
  }

  const ipCheck = validatePayUIpIfEnabled(req, payments.mode);

  if (!ipCheck.ok) {
    return {
      earlyResponse: response(403, {
        ok: false,
        error: 'PAYU_IP_NOT_ALLOWED',
        message: 'La IP origen no está autorizada para confirmaciones de PayU.',
      }),
    };
  }

  const payu = payments.credentials.payu;
  const merchantId = trimSafe(payload.merchant_id || payload.merchantId, 100);

  if (merchantId !== payu.merchantId) {
    return {
      earlyResponse: response(400, {
        ok: false,
        error: 'PAYU_MERCHANT_MISMATCH',
        message:
          'El merchant_id recibido no coincide con la configuración local.',
      }),
    };
  }

  if (payments.mode === 'production' && parseBoolean(payload.test)) {
    return {
      earlyResponse: response(400, {
        ok: false,
        error: 'PAYU_TEST_EVENT_IN_PRODUCTION',
        message:
          'PayU envió una confirmación de prueba mientras la tienda está en producción.',
      }),
    };
  }

  const signatureCheck = validatePayUSignature({ payload, payu });

  if (!signatureCheck.ok) {
    return {
      earlyResponse: response(400, {
        ok: false,
        error: signatureCheck.error,
        message: 'La firma de confirmación PayU no es válida.',
      }),
    };
  }

  const reference = trimSafe(
    payload.reference_sale || payload.referenceCode,
    255
  );
  const orderNumber = extractOrderNumberFromReference(reference);

  if (!orderNumber) {
    return {
      earlyResponse: response(400, {
        ok: false,
        error: 'ORDER_REFERENCE_NOT_FOUND',
        message:
          'No se pudo extraer el número de orden desde la referencia de PayU.',
      }),
    };
  }

  const order = await OrderModel.findOne({ orderNumber });

  if (!order) {
    return {
      earlyResponse: response(404, {
        ok: false,
        error: 'ORDER_NOT_FOUND',
        message: `No se encontró la orden ${orderNumber}.`,
      }),
    };
  }

  const webhookAmount = parseAmount(payload.value || payload.TX_VALUE);

  if (!Number.isFinite(webhookAmount) || webhookAmount <= 0) {
    return {
      earlyResponse: response(409, {
        ok: false,
        error: 'PAYU_PAYMENT_AMOUNT_INVALID',
        message: 'PayU no confirmó un importe externo positivo y verificable.',
      }),
    };
  }

  const webhookCurrency = trimSafe(payload.currency, 12).toUpperCase();
  const mapped = parsePayUWebhookStatus(payload);
  const transactionId =
    trimSafe(payload.transaction_id, 120) ||
    trimSafe(payload.transactionId, 120) ||
    trimSafe(payload.polTransactionId, 120) ||
    trimSafe(payload.reference_pol, 120);
  const currentPaymentStatus = String(order.payment?.status || '')
    .trim()
    .toLowerCase();

  if (currentPaymentStatus === 'paid' && mapped.paymentStatus !== 'paid') {
    return {
      earlyResponse: response(200, {
        ok: true,
        ignored: true,
        reason: 'ORDER_ALREADY_PAID',
        orderNumber: order.orderNumber,
        paymentStatus: currentPaymentStatus,
      }),
    };
  }

  return {
    context: {
      payload,
      payments,
      payu,
      reference,
      orderNumber,
      webhookAmount,
      webhookCurrency,
      mapped,
      transactionId,
      signatureAlgorithm: signatureCheck.algorithm,
      trimSafe,
    },
  };
}

module.exports = {
  preparePayUWebhookRequest,
};
