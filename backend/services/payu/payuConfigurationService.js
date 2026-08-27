'use strict';

const PAYU_CHECKOUT_URLS = Object.freeze({
  sandbox: 'https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/',
  production: 'https://checkout.payulatam.com/ppp-web-gateway-payu/',
});

const PAYU_PRODUCTION_IPS = new Set([
  '34.233.144.154',
  '184.73.94.138',
  '52.73.124.136',
]);

const PAYU_SANDBOX_IPS = new Set(['54.158.171.129']);

function trimSafe(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function buildOrderReference(order) {
  const safeOrderNumber =
    trimSafe(order?.orderNumber, 60) || String(order?._id || '').slice(-12);
  return `ORDER-${safeOrderNumber}`;
}

function buildGatewayAttemptReference(order, now = Date.now()) {
  return `${buildOrderReference(order)}__TRY__${now}`;
}

function extractOrderNumberFromReference(reference) {
  const safe = trimSafe(reference, 200);
  if (!safe) return '';

  const normalized = safe.includes('__TRY__') ? safe.split('__TRY__')[0] : safe;
  const match = normalized.match(/^ORDER-(.+)$/i);

  return match?.[1] ? String(match[1]).trim() : '';
}

function buildRedirectUrl(_req, order, env = process.env) {
  const base = env.FRONTEND_URL || env.PUBLIC_APP_URL || 'http://localhost:5173';
  const safeBase = String(base).replace(/\/+$/, '');
  const orderId = encodeURIComponent(String(order?._id || ''));
  const orderNumber = encodeURIComponent(String(order?.orderNumber || ''));

  return `${safeBase}/gracias?orderId=${orderId}&orderNumber=${orderNumber}`;
}

function buildPayUConfirmationUrl(env = process.env) {
  const backendBase =
    env.PAYU_WEBHOOK_BASE_URL || env.BACKEND_URL || env.PUBLIC_API_URL || '';

  return `${String(backendBase).replace(/\/+$/, '')}/api/payments/payu/webhook`;
}

function buildCustomerData(order) {
  const customer = order?.customer || {};
  const billing = order?.billing || {};
  const fullName = [customer.name, customer.lastname]
    .filter(Boolean)
    .join(' ')
    .trim();
  const email =
    trimSafe(customer.email, 120) ||
    (String(customer.emailOrPhone || '').includes('@')
      ? trimSafe(customer.emailOrPhone, 120)
      : '');

  return {
    buyerFullName: fullName || 'Cliente tienda virtual',
    buyerEmail: email || 'cliente@example.com',
    buyerDocumentType: 'CC',
    buyerDocument: trimSafe(customer.id || billing.id || '222222222222', 25),
    telephone: trimSafe(
      customer.phone || customer.emailOrPhone || billing.phone || '3000000000',
      20
    ),
    shippingAddress: trimSafe(
      customer.address || billing.address || 'Dirección no registrada',
      255
    ),
    shippingCity: trimSafe(customer.city || billing.city || 'Bogotá', 50),
    shippingCountry: 'CO',
  };
}

function parseBoolean(value) {
  const safe = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on', 'si', 'sí'].includes(safe);
}

function getClientIps(req) {
  const normalizedByExpress = [
    req.ip,
    ...(Array.isArray(req.ips) ? req.ips : []),
  ]
    .filter(Boolean)
    .map((ip) => String(ip).replace(/^::ffff:/, '').trim());

  return [...new Set(normalizedByExpress.filter(Boolean))];
}

function validatePayUIpIfEnabled(req, mode, env = process.env) {
  const enabled =
    String(env.PAYU_IP_ALLOWLIST_ENABLED || 'false').trim().toLowerCase() ===
    'true';

  if (!enabled) return { ok: true, skipped: true };

  const allowed = mode === 'production' ? PAYU_PRODUCTION_IPS : PAYU_SANDBOX_IPS;
  const ips = getClientIps(req);
  const matchedIp = ips.find((ip) => allowed.has(ip));

  return matchedIp
    ? { ok: true, skipped: false, ip: matchedIp }
    : { ok: false, skipped: false, ips };
}

function parsePayUWebhookStatus(payload) {
  const statePol = trimSafe(payload?.state_pol, 40);
  const transactionState = trimSafe(payload?.transactionState, 40);
  const lapState = trimSafe(payload?.lapTransactionState, 80).toLowerCase();
  const status = trimSafe(payload?.status, 40).toLowerCase();
  const code = statePol || transactionState;

  if (code === '4' || lapState.includes('aprob') || status.includes('approved')) {
    return { paymentStatus: 'paid', orderStatus: 'paid', label: 'Pago aprobado' };
  }

  if (
    code === '6' ||
    lapState.includes('rechaz') ||
    status.includes('declined') ||
    status.includes('failed')
  ) {
    return { paymentStatus: 'failed', orderStatus: 'failed', label: 'Pago rechazado' };
  }

  if (code === '5' || lapState.includes('expir') || status.includes('expired')) {
    return {
      paymentStatus: 'cancelled',
      orderStatus: 'cancelled',
      label: 'Pago expirado/cancelado',
    };
  }

  if (code === '7' || lapState.includes('pend') || status.includes('pending')) {
    return { paymentStatus: 'pending_gateway', orderStatus: null, label: 'Pago pendiente' };
  }

  return {
    paymentStatus: 'pending_gateway',
    orderStatus: null,
    label: 'Estado PayU recibido sin mapeo exacto',
  };
}

function verifyPayUProductionConfig(payments) {
  const payu = payments?.credentials?.payu || {};

  if (payments?.active === false) {
    return { ok: false, status: 409, error: 'PAYMENTS_DISABLED' };
  }

  if (payments?.provider !== 'payu') {
    return { ok: false, status: 409, error: 'PAYMENT_PROVIDER_MISMATCH' };
  }

  if (!payu.merchantId || !payu.accountId || !payu.apiKey) {
    return { ok: false, status: 422, error: 'PAYU_CONFIG_INCOMPLETE' };
  }

  return { ok: true };
}

function verifyPayUWebhookConfig(payments) {
  const payu = payments?.credentials?.payu || {};

  if (!payu.merchantId || !payu.accountId || !payu.apiKey) {
    return { ok: false, status: 422, error: 'PAYU_CONFIG_INCOMPLETE' };
  }

  return { ok: true };
}

function buildPayUInvoiceTransaction({ payload, transactionId, signatureAlgorithm }) {
  return {
    id: transactionId,
    transaction_id: transactionId,
    transactionId,
    payment_method_type: trimSafe(payload.payment_method_type, 80),
    payment_method_name: trimSafe(payload.payment_method_name, 120),
    payment_method: trimSafe(payload.payment_method, 120),
    paymentMethodType: trimSafe(payload.payment_method_type, 80),
    paymentMethod: trimSafe(
      payload.payment_method_name || payload.payment_method,
      120
    ),
    rawMethod: {
      state_pol: trimSafe(payload.state_pol, 40),
      response_code_pol: trimSafe(payload.response_code_pol, 120),
      response_message_pol: trimSafe(payload.response_message_pol, 180),
      reference_pol: trimSafe(payload.reference_pol, 120),
      transaction_id: transactionId,
      payment_method: trimSafe(payload.payment_method, 80),
      payment_method_type: trimSafe(payload.payment_method_type, 80),
      payment_method_name: trimSafe(payload.payment_method_name, 120),
      test: trimSafe(payload.test, 20),
      signatureAlgorithm,
    },
  };
}

module.exports = {
  PAYU_CHECKOUT_URLS,
  PAYU_PRODUCTION_IPS,
  PAYU_SANDBOX_IPS,
  buildCustomerData,
  buildGatewayAttemptReference,
  buildOrderReference,
  buildPayUConfirmationUrl,
  buildPayUInvoiceTransaction,
  buildRedirectUrl,
  extractOrderNumberFromReference,
  getClientIps,
  parseBoolean,
  parsePayUWebhookStatus,
  trimSafe,
  validatePayUIpIfEnabled,
  verifyPayUProductionConfig,
  verifyPayUWebhookConfig,
};
