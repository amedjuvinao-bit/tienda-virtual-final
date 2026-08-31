'use strict';

const {
  getActivePaymentsConfig,
} = require('./paymentConfigurationAuthorityService');
const {
  resolveRefundableOrderTotal,
} = require('./orderRefunds/refundPaymentIntegrity');

const WOMPI_ENVIRONMENTS = Object.freeze({
  sandbox: 'https://sandbox.wompi.co/v1',
  production: 'https://production.wompi.co/v1',
});

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 500) {
  return cleanText(value, max).toLowerCase();
}

function cleanUpper(value, max = 500) {
  return cleanText(value, max).toUpperCase();
}

function toMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

function createGatewayError(message, code, statusCode = 409, details = {}) {
  return Object.assign(new Error(message), { code, statusCode, details });
}

function orderTotal(order = {}) {
  return resolveRefundableOrderTotal(order);
}

function paymentMethodType(order = {}) {
  return cleanUpper(
    order?.payment?.methodType ||
      order?.payment?.rawMethod?.type ||
      order?.payment?.method,
    40
  );
}

function resolveWompiRefundCapability({ order = {}, refund = {}, config = {} } = {}) {
  if (
    order?.storeCredit?.applied === true &&
    cleanLower(order?.storeCredit?.status, 40) !== 'released' &&
    toMoney(order?.storeCredit?.amount) > 0
  ) {
    return {
      automatic: false,
      code: 'STORE_CREDIT_REFUND_MANUAL_REVIEW_REQUIRED',
      message: 'La orden usó saldo a favor. La devolución requiere distribuir y restaurar cada fuente antes de operar la pasarela.',
    };
  }

  const provider = cleanLower(
    refund?.reconciliation?.paymentProvider || order?.payment?.provider,
    40
  );
  if (provider !== 'wompi') {
    return {
      automatic: false,
      code: 'PAYMENT_AUTOMATION_PROVIDER_UNSUPPORTED',
      message: 'El medio de pago de esta orden requiere confirmar manualmente la devolución del dinero.',
    };
  }

  if (config?.active !== true || cleanLower(config?.provider, 40) !== 'wompi') {
    return {
      automatic: false,
      code: 'WOMPI_AUTOMATION_NOT_CONFIGURED',
      message: 'Wompi no está configurado como pasarela activa; conserva el comprobante del reintegro manual.',
    };
  }

  const transactionId = cleanText(
    refund?.reconciliation?.paymentTransactionId || order?.payment?.transactionId,
    220
  );
  if (!transactionId) {
    return {
      automatic: false,
      code: 'WOMPI_TRANSACTION_ID_MISSING',
      message: 'La orden no conserva el identificador de transacción necesario para solicitar el reverso en Wompi.',
    };
  }

  const total = orderTotal(order);
  const amount = toMoney(refund?.amount);
  const transactionCount = Number(order?.refundControl?.transactionCount || 0);
  if (!total || amount !== total || transactionCount > 1) {
    return {
      automatic: false,
      code: 'WOMPI_PARTIAL_REFUND_MANUAL_REQUIRED',
      message: 'Wompi solo permite automatizar aquí la anulación total elegible; los reembolsos parciales requieren devolución manual verificable.',
    };
  }

  const methodType = paymentMethodType(order);
  if (methodType !== 'CARD') {
    return {
      automatic: false,
      code: 'WOMPI_PAYMENT_METHOD_MANUAL_REQUIRED',
      message: `El método ${methodType || 'registrado'} no admite anulación automática por la API disponible de Wompi. Registra la referencia del reintegro manual.`,
    };
  }

  const orderMode = cleanLower(order?.payment?.mode, 20) === 'production'
    ? 'production'
    : 'sandbox';
  const configMode = cleanLower(config?.mode, 20) === 'production'
    ? 'production'
    : 'sandbox';
  if (orderMode !== configMode) {
    return {
      automatic: false,
      code: 'WOMPI_ENVIRONMENT_MISMATCH',
      message: 'La orden pertenece a un ambiente de Wompi diferente al configurado actualmente. Debe conciliarse manualmente.',
    };
  }

  const privateKey = cleanText(config?.credentials?.wompi?.privateKey, 300);
  if (!privateKey) {
    return {
      automatic: false,
      code: 'WOMPI_PRIVATE_KEY_MISSING',
      message: 'Falta la llave privada de Wompi para solicitar la anulación automática.',
    };
  }

  return {
    automatic: true,
    code: 'WOMPI_VOID_AVAILABLE',
    message: 'La transacción es elegible para solicitar anulación automática en Wompi.',
    transactionId,
    methodType,
    mode: orderMode,
    privateKey,
    baseUrl: WOMPI_ENVIRONMENTS[orderMode],
  };
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {};
  }
}

function remoteTransaction(payload = {}) {
  return payload?.data && typeof payload.data === 'object'
    ? payload.data
    : payload;
}

function providerMessage(payload = {}, fallback = '') {
  const errors = payload?.error?.messages || payload?.errors || {};
  const firstError = Array.isArray(errors)
    ? errors[0]
    : Object.values(errors || {}).flat?.()[0];
  return cleanText(
    payload?.error?.reason ||
      payload?.error?.message ||
      payload?.message ||
      firstError ||
      fallback,
    500
  );
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getWompiTransaction(capability, { fetchImpl = global.fetch } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw createGatewayError(
      'El servidor no dispone del cliente HTTP necesario para consultar Wompi.',
      'WOMPI_HTTP_CLIENT_UNAVAILABLE',
      500
    );
  }
  const response = await fetchWithTimeout(
    fetchImpl,
    `${capability.baseUrl}/transactions/${encodeURIComponent(capability.transactionId)}`,
    {
      headers: {
        Authorization: `Bearer ${capability.privateKey}`,
        Accept: 'application/json',
      },
    }
  );
  const payload = await readJson(response);
  if (!response.ok) {
    throw createGatewayError(
      providerMessage(payload, 'Wompi no permitió consultar la transacción original.'),
      'WOMPI_TRANSACTION_LOOKUP_FAILED',
      502,
      { httpStatus: response.status }
    );
  }
  const transaction = remoteTransaction(payload);
  if (cleanText(transaction?.id, 220) !== capability.transactionId) {
    throw createGatewayError(
      'Wompi devolvió una transacción diferente a la solicitada.',
      'WOMPI_TRANSACTION_IDENTITY_MISMATCH',
      502
    );
  }
  return transaction;
}

async function requestWompiVoid(capability, { fetchImpl = global.fetch } = {}) {
  const response = await fetchWithTimeout(
    fetchImpl,
    `${capability.baseUrl}/transactions/${encodeURIComponent(capability.transactionId)}/void`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${capability.privateKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }
  );
  const payload = await readJson(response);
  return { response, payload };
}

async function executeWompiAutomaticRefund(
  { order = {}, refund = {} } = {},
  {
    fetchImpl = global.fetch,
    getConfig = getActivePaymentsConfig,
  } = {}
) {
  const config = await getConfig();
  const capability = resolveWompiRefundCapability({ order, refund, config });
  if (!capability.automatic) {
    return { completed: false, manualRequired: true, capability };
  }

  const before = await getWompiTransaction(capability, { fetchImpl });
  const beforeStatus = cleanUpper(before?.status, 40);
  if (beforeStatus === 'VOIDED') {
    return {
      completed: true,
      idempotent: true,
      reference: `WOMPI-VOID-${capability.transactionId}`,
      providerStatus: beforeStatus,
    };
  }
  if (beforeStatus !== 'APPROVED') {
    throw createGatewayError(
      `La transacción Wompi está en estado ${beforeStatus || 'desconocido'} y no puede anularse automáticamente.`,
      'WOMPI_TRANSACTION_NOT_VOIDABLE',
      409,
      { providerStatus: beforeStatus }
    );
  }

  let voidResult;
  try {
    voidResult = await requestWompiVoid(capability, { fetchImpl });
  } catch (error) {
    if (error?.name !== 'AbortError') throw error;
  }

  const immediateStatus = cleanUpper(
    remoteTransaction(voidResult?.payload || {})?.status,
    40
  );
  if (voidResult?.response?.ok && immediateStatus === 'VOIDED') {
    return {
      completed: true,
      idempotent: false,
      reference: `WOMPI-VOID-${capability.transactionId}`,
      providerStatus: immediateStatus,
    };
  }

  const verified = await getWompiTransaction(capability, { fetchImpl });
  const verifiedStatus = cleanUpper(verified?.status, 40);
  if (verifiedStatus === 'VOIDED') {
    return {
      completed: true,
      idempotent: false,
      reference: `WOMPI-VOID-${capability.transactionId}`,
      providerStatus: verifiedStatus,
    };
  }

  const failedMessage = providerMessage(
    voidResult?.payload || {},
    'Wompi no confirmó la anulación de la transacción.'
  );
  throw createGatewayError(
    failedMessage,
    voidResult?.response?.ok
      ? 'WOMPI_VOID_RESULT_UNCERTAIN'
      : 'WOMPI_VOID_REJECTED',
    voidResult?.response?.ok ? 502 : 409,
    {
      httpStatus: voidResult?.response?.status || null,
      providerStatus: verifiedStatus,
    }
  );
}

module.exports = {
  WOMPI_ENVIRONMENTS,
  createGatewayError,
  executeWompiAutomaticRefund,
  getWompiTransaction,
  orderTotal,
  paymentMethodType,
  resolveWompiRefundCapability,
};
