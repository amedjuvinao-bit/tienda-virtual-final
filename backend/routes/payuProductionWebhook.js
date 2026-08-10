// backend/routes/payuProductionWebhook.js

const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const {
  getActivePaymentsConfig,
} = require('../services/paymentConfigurationAuthorityService');

const Order = require('../models/Order');
const Product = require('../models/Product');
const {
  confirmInventoryReservation,
  releaseInventoryReservation,
} = require('../services/inventoryReservationService');
const {
  applyReservationToOrderDocument,
} = require('../services/orderInventoryAllocationService');
const {
  generateElectronicInvoiceAfterPayment,
} = require('../services/electronicInvoiceAfterPaymentService');

const router = express.Router();

const PAYU_CHECKOUT_URLS = {
  sandbox: 'https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/',
  production: 'https://checkout.payulatam.com/ppp-web-gateway-payu/',
};

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

function buildGatewayAttemptReference(order) {
  return `${buildOrderReference(order)}__TRY__${Date.now()}`;
}

function extractOrderNumberFromReference(reference) {
  const safe = trimSafe(reference, 200);
  if (!safe) return '';

  const normalized = safe.includes('__TRY__') ? safe.split('__TRY__')[0] : safe;
  const match = normalized.match(/^ORDER-(.+)$/i);

  return match?.[1] ? String(match[1]).trim() : '';
}

function buildRedirectUrl(req, order) {
  const base =
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_APP_URL ||
    'http://localhost:5173';
  const safeBase = String(base).replace(/\/+$/, '');
  const orderId = encodeURIComponent(String(order?._id || ''));
  const orderNumber = encodeURIComponent(String(order?.orderNumber || ''));

  return `${safeBase}/gracias?orderId=${orderId}&orderNumber=${orderNumber}`;
}

function buildPayUConfirmationUrl() {
  const backendBase =
    process.env.PAYU_WEBHOOK_BASE_URL ||
    process.env.BACKEND_URL ||
    process.env.PUBLIC_API_URL ||
    '';

  return `${String(backendBase).replace(/\/+$/, '')}/api/payments/payu/webhook`;
}

function buildCustomerData(order) {
  const customer = order?.customer || {};
  const billing = order?.billing || {};
  const fullName = [customer.name, customer.lastname].filter(Boolean).join(' ').trim();
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
    telephone: trimSafe(customer.phone || customer.emailOrPhone || billing.phone || '3000000000', 20),
    shippingAddress: trimSafe(customer.address || billing.address || 'Dirección no registrada', 255),
    shippingCity: trimSafe(customer.city || billing.city || 'Bogotá', 50),
    shippingCountry: 'CO',
  };
}

function parseAmount(value) {
  const raw = String(value || '').trim().replace(/,/g, '.');
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}

function formatPayUAmountForSignature(value) {
  const number = parseAmount(value);
  const fixed = number.toFixed(2);
  const decimals = fixed.split('.')[1] || '00';

  return decimals[1] === '0' ? number.toFixed(1) : fixed;
}

function hashHex(algorithm, value) {
  return crypto.createHash(algorithm).update(value).digest('hex');
}

function hmacHex(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function buildPayUPaymentSignature({ apiKey, merchantId, referenceCode, amount, currency }) {
  const base = `${apiKey}~${merchantId}~${referenceCode}~${amount}~${currency}`;

  return {
    base,
    algorithm: 'MD5',
    signature: hashHex('md5', base),
  };
}

function buildPayUConfirmationSignatureCandidates({
  apiKey,
  merchantId,
  referenceSale,
  value,
  currency,
  statePol,
  signatureSecret = '',
}) {
  const normalizedValue = formatPayUAmountForSignature(value);
  const base = `${apiKey}~${merchantId}~${referenceSale}~${normalizedValue}~${currency}~${statePol}`;
  const candidates = [
    { algorithm: 'MD5', signature: hashHex('md5', base) },
    { algorithm: 'SHA1', signature: hashHex('sha1', base) },
    { algorithm: 'SHA256', signature: hashHex('sha256', base) },
    { algorithm: 'HMAC-SHA256-APIKEY', signature: hmacHex(apiKey, base) },
  ];

  if (signatureSecret) {
    candidates.push({
      algorithm: 'HMAC-SHA256-SECRET',
      signature: hmacHex(signatureSecret, base),
    });
  }

  return {
    base,
    normalizedValue,
    candidates,
  };
}

function safeCompareHex(left, right) {
  const a = Buffer.from(String(left || '').trim().toLowerCase(), 'utf8');
  const b = Buffer.from(String(right || '').trim().toLowerCase(), 'utf8');

  if (!a.length || !b.length || a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

function validatePayUSignature({ payload, payu }) {
  const providedSign = trimSafe(payload.sign || payload.signature, 300).toLowerCase();
  const merchantId = trimSafe(payload.merchant_id || payload.merchantId, 100);
  const referenceSale = trimSafe(payload.reference_sale || payload.referenceCode, 255);
  const value = trimSafe(payload.value || payload.TX_VALUE, 80);
  const currency = trimSafe(payload.currency, 12).toUpperCase();
  const statePol = trimSafe(payload.state_pol || payload.transactionState, 40);

  if (!providedSign) return { ok: false, error: 'PAYU_SIGN_MISSING' };
  if (!payu.apiKey) return { ok: false, error: 'PAYU_API_KEY_MISSING' };

  if (!merchantId || !referenceSale || !value || !currency || !statePol) {
    return { ok: false, error: 'PAYU_SIGNATURE_FIELDS_MISSING' };
  }

  const built = buildPayUConfirmationSignatureCandidates({
    apiKey: payu.apiKey,
    merchantId,
    referenceSale,
    value,
    currency,
    statePol,
    signatureSecret: payu.signatureSecret,
  });

  const matched = built.candidates.find((candidate) =>
    safeCompareHex(candidate.signature, providedSign)
  );

  if (!matched) {
    return {
      ok: false,
      error: 'INVALID_PAYU_SIGNATURE',
      normalizedValue: built.normalizedValue,
    };
  }

  return {
    ok: true,
    algorithm: matched.algorithm,
    normalizedValue: built.normalizedValue,
  };
}

function parseBoolean(value) {
  const safe = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on', 'si', 'sí'].includes(safe);
}

function getClientIps(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  const direct = [req.ip, req.connection?.remoteAddress, req.socket?.remoteAddress]
    .filter(Boolean)
    .map((ip) => String(ip).replace(/^::ffff:/, '').trim());

  return [...new Set([...forwarded, ...direct].filter(Boolean))];
}

function validatePayUIpIfEnabled(req, mode) {
  const enabled =
    String(process.env.PAYU_IP_ALLOWLIST_ENABLED || 'false')
      .trim()
      .toLowerCase() === 'true';

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

function resolveOrderItemProductId(item) {
  if (!item || typeof item !== 'object') return '';
  if (item.productId) return String(item.productId).trim();
  if (item.product && typeof item.product === 'object' && item.product._id) {
    return String(item.product._id).trim();
  }
  if (item.product && typeof item.product !== 'object') return String(item.product).trim();
  if (item._id) return String(item._id).trim();
  if (item.id) return String(item.id).trim();
  return '';
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function incrementLegacyStock(item, session) {
  const productId = resolveOrderItemProductId(item);
  const quantity = Number(item?.quantity ?? item?.qty ?? 0) || 0;
  const color = String(item?.color || '');
  const size = String(item?.size || '');

  if (!productId || !quantity) return false;
  if (!mongoose.Types.ObjectId.isValid(productId)) return false;

  const product = await Product.findById(productId).session(session).lean();
  if (!product) return false;

  if (Array.isArray(product.inventory) && product.inventory.length) {
    const result = await Product.updateOne(
      {
        _id: productId,
        inventory: {
          $elemMatch: {
            color: { $regex: `^${escapeRegex(color)}$`, $options: 'i' },
            size: { $regex: `^${escapeRegex(size)}$`, $options: 'i' },
          },
        },
      },
      { $inc: { 'inventory.$.stock': quantity } },
      { session }
    );

    if (result.matchedCount || result.modifiedCount) {
      const updated = await Product.findById(productId).session(session).lean();
      const total = Array.isArray(updated?.inventory)
        ? updated.inventory.reduce((sum, row) => sum + Math.max(0, Number(row?.stock || 0)), 0)
        : Number(updated?.stock || 0);

      await Product.updateOne({ _id: productId }, { $set: { stock: total } }, { session });
      return true;
    }

    return false;
  }

  const result = await Product.updateOne(
    { _id: productId },
    { $inc: { stock: quantity } },
    { session }
  );

  return Boolean(result.matchedCount || result.modifiedCount);
}

async function restockLegacyOrderIfNeeded(order, session) {
  const inventoryControl = order.inventoryControl || {};

  if (
    inventoryControl.discountedAtCheckout !== true ||
    inventoryControl.restockedOnFailure === true
  ) {
    return false;
  }

  const items = Array.isArray(order.items) && order.items.length
    ? order.items
    : Array.isArray(order.cart)
      ? order.cart
      : [];

  for (const item of items) {
    await incrementLegacyStock(item, session);
  }

  order.inventoryControl = {
    ...inventoryControl,
    discountedAtCheckout: true,
    restockedOnFailure: true,
    restockedAt: new Date(),
  };

  return true;
}

async function syncReservationAfterPayU({ order, mapped, reference, transactionId, session }) {
  const paymentStatus = String(mapped.paymentStatus || '').trim().toLowerCase();

  if (order.inventoryControl?.reservationRequired === false) {
    order.inventoryControl = {
      ...(order.inventoryControl || {}),
      discountedAtCheckout: false,
      restockedOnFailure: false,
      restockedAt: null,
    };
    return null;
  }

  try {
    if (paymentStatus === 'paid') {
      const reservation = await confirmInventoryReservation(
        order.orderNumber,
        {
          order: order._id,
          orderNumber: order.orderNumber,
          paymentReference: reference || order.payment?.reference || '',
          paymentTransactionId: transactionId || order.payment?.transactionId || '',
        },
        {
          session,
          syncOrderAllocations: false,
        }
      );

      applyReservationToOrderDocument(order, reservation);
      order.inventoryControl = {
        ...(order.inventoryControl && typeof order.inventoryControl === 'object'
          ? order.inventoryControl
          : {}),
        discountedAtCheckout: true,
        restockedOnFailure: false,
        restockedAt: null,
      };

      return reservation;
    }

    if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
      const reservation = await releaseInventoryReservation(
        order.orderNumber,
        {
          status: paymentStatus === 'cancelled' ? 'cancelled' : 'failed',
          releaseReason: `Pago ${paymentStatus} desde PayU`,
        },
        {
          session,
          syncOrderAllocations: false,
        }
      );

      applyReservationToOrderDocument(order, reservation);
      order.inventoryControl = {
        ...(order.inventoryControl && typeof order.inventoryControl === 'object'
          ? order.inventoryControl
          : {}),
        discountedAtCheckout: false,
        restockedOnFailure: true,
        restockedAt: new Date(),
      };

      return reservation;
    }
  } catch (error) {
    if (error.code === 'RESERVATION_NOT_FOUND') {
      if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
        await restockLegacyOrderIfNeeded(order, session);
      }

      return null;
    }

    throw error;
  }

  return null;
}

function buildOrderEventModel() {
  return (
    mongoose.models.OrderEvent ||
    mongoose.model(
      'OrderEvent',
      new mongoose.Schema(
        {
          orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            index: true,
            required: true,
          },
          type: { type: String, required: true },
          message: { type: String },
          meta: { type: Object },
        },
        { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
      ),
      'order_events'
    )
  );
}

function verifyPayUProductionConfig(payments) {
  const payu = payments.credentials?.payu || {};

  if (payments.active === false) {
    return { ok: false, status: 409, error: 'PAYMENTS_DISABLED' };
  }

  if (payments.provider !== 'payu') {
    return { ok: false, status: 409, error: 'PAYMENT_PROVIDER_MISMATCH' };
  }

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
    paymentMethod: trimSafe(payload.payment_method_name || payload.payment_method, 120),
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

router.post('/payu/checkout-data', async (req, res) => {
  try {
    const orderId = trimSafe(req.body?.orderId, 100);

    if (!orderId) {
      return res.status(400).json({
        error: 'ORDER_ID_REQUIRED',
        message: 'Debes enviar orderId.',
      });
    }

    const payments = await getActivePaymentsConfig();
    const configCheck = verifyPayUProductionConfig(payments);

    if (!configCheck.ok) {
      return res.status(configCheck.status).json({
        error: configCheck.error,
        message: 'La configuración de PayU no está lista para operar.',
      });
    }

    const order = await Order.findById(orderId).lean();

    if (!order) {
      return res.status(404).json({
        error: 'ORDER_NOT_FOUND',
        message: 'Orden no encontrada.',
      });
    }

    const amount = Number(order.total || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(422).json({
        error: 'INVALID_ORDER_TOTAL',
        message: 'La orden no tiene un total válido para iniciar el pago.',
      });
    }

    const payu = payments.credentials.payu;
    const referenceCode = buildGatewayAttemptReference(order);
    const currency = payments.currency || 'COP';
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
      actionUrl: PAYU_CHECKOUT_URLS[payments.mode] || PAYU_CHECKOUT_URLS.sandbox,
      order: {
        id: String(order._id),
        orderNumber: order.orderNumber || '',
        total: amount,
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
    console.error('POST /payments/payu/checkout-data secure', error);
    return res.status(500).json({
      error: 'PAYU_CHECKOUT_DATA_ERROR',
      message: error.message || 'No se pudo preparar el checkout de PayU.',
    });
  }
});

router.post('/payu/webhook', express.urlencoded({ extended: true }), async (req, res) => {
  let session = null;
  let shouldGenerateDian = false;
  let dianOrderId = null;
  let dianTransaction = null;
  let dianPayments = null;

  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const payments = await getActivePaymentsConfig();
    const configCheck = verifyPayUProductionConfig(payments);

    if (!configCheck.ok) {
      return res.status(configCheck.status).json({
        ok: false,
        error: configCheck.error,
        message: 'La configuración de PayU no está lista para recibir confirmaciones.',
      });
    }

    const ipCheck = validatePayUIpIfEnabled(req, payments.mode);

    if (!ipCheck.ok) {
      return res.status(403).json({
        ok: false,
        error: 'PAYU_IP_NOT_ALLOWED',
        message: 'La IP origen no está autorizada para confirmaciones de PayU.',
      });
    }

    const payu = payments.credentials.payu;
    const merchantId = trimSafe(payload.merchant_id || payload.merchantId, 100);

    if (merchantId !== payu.merchantId) {
      return res.status(400).json({
        ok: false,
        error: 'PAYU_MERCHANT_MISMATCH',
        message: 'El merchant_id recibido no coincide con la configuración local.',
      });
    }

    if (payments.mode === 'production' && parseBoolean(payload.test)) {
      return res.status(400).json({
        ok: false,
        error: 'PAYU_TEST_EVENT_IN_PRODUCTION',
        message: 'PayU envió una confirmación de prueba mientras la tienda está en producción.',
      });
    }

    const signatureCheck = validatePayUSignature({ payload, payu });

    if (!signatureCheck.ok) {
      return res.status(400).json({
        ok: false,
        error: signatureCheck.error,
        message: 'La firma de confirmación PayU no es válida.',
      });
    }

    const reference = trimSafe(payload.reference_sale || payload.referenceCode, 255);
    const orderNumber = extractOrderNumberFromReference(reference);

    if (!orderNumber) {
      return res.status(400).json({
        ok: false,
        error: 'ORDER_REFERENCE_NOT_FOUND',
        message: 'No se pudo extraer el número de orden desde la referencia de PayU.',
      });
    }

    const order = await Order.findOne({ orderNumber });

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: 'ORDER_NOT_FOUND',
        message: `No se encontró la orden ${orderNumber}.`,
      });
    }

    const webhookAmount = parseAmount(payload.value || payload.TX_VALUE);
    const orderAmount = Number(order.total || 0);

    if (Math.abs(webhookAmount - orderAmount) > 0.01) {
      return res.status(409).json({
        ok: false,
        error: 'PAYU_AMOUNT_MISMATCH',
        message: 'El valor confirmado por PayU no coincide con el total de la orden.',
      });
    }

    const webhookCurrency = trimSafe(payload.currency, 12).toUpperCase();
    const expectedCurrency = trimSafe(order.payment?.currency || payments.currency || 'COP', 12).toUpperCase();

    if (webhookCurrency && expectedCurrency && webhookCurrency !== expectedCurrency) {
      return res.status(409).json({
        ok: false,
        error: 'PAYU_CURRENCY_MISMATCH',
        message: 'La moneda confirmada por PayU no coincide con la orden.',
      });
    }

    const mapped = parsePayUWebhookStatus(payload);
    const transactionId =
      trimSafe(payload.transaction_id, 120) ||
      trimSafe(payload.transactionId, 120) ||
      trimSafe(payload.polTransactionId, 120) ||
      trimSafe(payload.reference_pol, 120);

    const currentPaymentStatus = String(order.payment?.status || '').trim().toLowerCase();

    if (currentPaymentStatus === 'paid' && mapped.paymentStatus !== 'paid') {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: 'ORDER_ALREADY_PAID',
        orderNumber: order.orderNumber,
        paymentStatus: currentPaymentStatus,
      });
    }

    session = await mongoose.startSession();
    let responsePayload = null;

    await session.withTransaction(async () => {
      const freshOrder = await Order.findOne({ orderNumber }).session(session);

      if (!freshOrder) {
        throw new Error(`ORDER_NOT_FOUND_TX_${orderNumber}`);
      }

      const beforeOrderStatus = String(freshOrder.status || '').trim().toLowerCase();
      const beforePaymentStatus = String(freshOrder.payment?.status || '').trim().toLowerCase();

      if (beforePaymentStatus === 'paid' && mapped.paymentStatus !== 'paid') {
        responsePayload = {
          ok: true,
          ignored: true,
          reason: 'ORDER_ALREADY_PAID_TX',
          orderNumber: freshOrder.orderNumber,
          paymentStatus: beforePaymentStatus,
        };
        return;
      }

      if (!freshOrder.payment || typeof freshOrder.payment !== 'object') {
        freshOrder.payment = {
          active: true,
          provider: 'payu',
          providerLabel: 'PayU',
          mode: payments.mode || 'sandbox',
          currency: webhookCurrency || payments.currency || 'COP',
          checkoutLabel: 'PayU',
          enableWebhook: true,
          status: 'pending_gateway',
        };
      }

      freshOrder.payment.provider = 'payu';
      freshOrder.payment.providerLabel = freshOrder.payment.providerLabel || 'PayU';
      freshOrder.payment.mode = payments.mode || freshOrder.payment.mode || 'sandbox';
      freshOrder.payment.currency = webhookCurrency || freshOrder.payment.currency || 'COP';
      freshOrder.payment.enableWebhook = true;
      freshOrder.payment.status = mapped.paymentStatus;
      freshOrder.payment.methodType = trimSafe(payload.payment_method_type, 80);
      freshOrder.payment.method =
        trimSafe(payload.payment_method_name, 120) ||
        trimSafe(payload.payment_method, 120) ||
        trimSafe(payload.payment_method_id, 120);
      freshOrder.payment.methodLabel =
        trimSafe(payload.payment_method_name, 120) ||
        trimSafe(payload.payment_method, 120) ||
        '';
      freshOrder.payment.transactionId = transactionId;
      freshOrder.payment.reference = reference;
      freshOrder.payment.amount = webhookAmount;
      freshOrder.payment.amountInCents = Math.round(webhookAmount * 100);
      freshOrder.payment.paidAt = mapped.paymentStatus === 'paid'
        ? new Date(trimSafe(payload.transaction_date || payload.date, 80) || Date.now())
        : null;
      freshOrder.payment.rawMethod = {
        state_pol: trimSafe(payload.state_pol, 40),
        response_code_pol: trimSafe(payload.response_code_pol, 120),
        response_message_pol: trimSafe(payload.response_message_pol, 180),
        reference_pol: trimSafe(payload.reference_pol, 120),
        transaction_id: transactionId,
        payment_method: trimSafe(payload.payment_method, 80),
        payment_method_type: trimSafe(payload.payment_method_type, 80),
        payment_method_name: trimSafe(payload.payment_method_name, 120),
        test: trimSafe(payload.test, 20),
        signatureAlgorithm: signatureCheck.algorithm,
      };

      if (mapped.orderStatus) {
        freshOrder.status = mapped.orderStatus;
      }

      await syncReservationAfterPayU({
        order: freshOrder,
        mapped,
        reference,
        transactionId,
        session,
      });

      const afterOrderStatus = String(freshOrder.status || '').trim().toLowerCase();
      const afterPaymentStatus = String(freshOrder.payment?.status || '').trim().toLowerCase();

      freshOrder.timeline = Array.isArray(freshOrder.timeline) ? freshOrder.timeline : [];

      if (beforeOrderStatus !== afterOrderStatus || beforePaymentStatus !== afterPaymentStatus) {
        freshOrder.timeline.push({
          type: 'system',
          message: `PayU webhook validado: ${mapped.label}${transactionId ? ` · TX ${transactionId}` : ''}${webhookAmount ? ` · Valor ${webhookAmount}` : ''}`,
          by: 'payu_webhook',
          at: new Date(),
        });

        const OrderEvent = buildOrderEventModel();

        await OrderEvent.create(
          [
            {
              orderId: freshOrder._id,
              type: 'payment_updated',
              message: `PayU webhook validado: ${mapped.label}`,
              meta: {
                by: 'payu_webhook',
                provider: 'payu',
                transactionId,
                reference,
                signatureAlgorithm: signatureCheck.algorithm,
                fromOrderStatus: beforeOrderStatus || null,
                toOrderStatus: afterOrderStatus || null,
                fromPaymentStatus: beforePaymentStatus || null,
                toPaymentStatus: afterPaymentStatus || null,
              },
            },
          ],
          { session }
        );
      }

      await freshOrder.save({ session });

      if (mapped.paymentStatus === 'paid') {
        shouldGenerateDian = true;
        dianOrderId = freshOrder._id;
        dianTransaction = buildPayUInvoiceTransaction({
          payload,
          transactionId,
          signatureAlgorithm: signatureCheck.algorithm,
        });
        dianPayments = payments;
      }

      responsePayload = {
        ok: true,
        received: true,
        provider: 'payu',
        orderNumber: freshOrder.orderNumber,
        orderStatus: freshOrder.status,
        paymentStatus: freshOrder.payment?.status || '',
        transactionId,
        reference,
        signatureAlgorithm: signatureCheck.algorithm,
      };
    });

    if (shouldGenerateDian && dianOrderId) {
      generateElectronicInvoiceAfterPayment({
        orderId: dianOrderId,
        transaction: dianTransaction,
        payments: dianPayments,
        paymentProvider: 'payu',
      });
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('POST /payments/payu/webhook secure', error);
    return res.status(500).json({
      ok: false,
      error: 'PAYU_WEBHOOK_ERROR',
      message: error.message || 'No se pudo procesar la confirmación de PayU.',
    });
  } finally {
    if (session) await session.endSession();
  }
});

module.exports = router;
