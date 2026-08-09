// backend/routes/payments.js
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');

const router = express.Router();
console.log('🧪 PAYMENTS.JS VERSION CORREGIDA CARGADA - 2026-05-05');

const SiteSettings = require('../models/SiteSettings');
const Order = require('../models/Order');
const Product = require('../models/Product');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

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
const {
  issueElectronicInvoiceForOrder,
} = require('../services/electronicInvoiceIssuanceService');

const WOMPI_ENVIRONMENTS = {
  sandbox: 'https://sandbox.wompi.co/v1',
  production: 'https://production.wompi.co/v1',
};

const ElectronicInvoice = require('../models/ElectronicInvoice');
const {
  deleteFactusBillByReference,
  getFactusCredentials,
  getFactusAccessToken,
} = require('../lib/dian/providers/factusProvider');

const {
  createOfficialCreditNote,
} = require('../services/electronicCreditNoteService');

const {
  addInvoiceGeneratedEvent,
  addInvoiceValidatedEvent,
  addInvoiceFailedEvent,
  addInvoiceDeletedEvent,
  addInvoiceRetryEvent,
} = require('../lib/orders/orderTimeline');

const OrderEvent =
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
  );

function trimSafe(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function normalizePaymentsConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  const credentials =
    cfg.credentials && typeof cfg.credentials === 'object'
      ? cfg.credentials
      : {};

  const wompi =
    credentials.wompi && typeof credentials.wompi === 'object'
      ? credentials.wompi
      : {};

  const payu =
    credentials.payu && typeof credentials.payu === 'object'
      ? credentials.payu
      : {};

  return {
    active: cfg.active !== false,
    provider: trimSafe(cfg.provider, 40).toLowerCase(),
    mode:
      trimSafe(cfg.mode, 20).toLowerCase() === 'production'
        ? 'production'
        : 'sandbox',
    currency: trimSafe(cfg.currency || 'COP', 12).toUpperCase() || 'COP',
    checkoutLabel: trimSafe(cfg.checkoutLabel, 180),
    successMessage: trimSafe(cfg.successMessage, 300),
    enableWebhook: cfg.enableWebhook === true,
    credentials: {
      wompi: {
        publicKey: trimSafe(wompi.publicKey, 200),
        privateKey: trimSafe(wompi.privateKey, 200),
        integrityKey: trimSafe(wompi.integrityKey, 200),
        webhookSecret: trimSafe(wompi.webhookSecret, 200),
      },
      payu: {
        merchantId: trimSafe(payu.merchantId, 100),
        accountId: trimSafe(payu.accountId, 100),
        apiLogin: trimSafe(payu.apiLogin, 150),
        apiKey: trimSafe(payu.apiKey, 150),
      },
    },
  };
}

function resolveWompiBaseUrl(mode) {
  return mode === 'production'
    ? WOMPI_ENVIRONMENTS.production
    : WOMPI_ENVIRONMENTS.sandbox;
}

function buildOrderReference(order) {
  const safeOrderNumber =
    trimSafe(order?.orderNumber, 60) || String(order?._id || '').slice(-12);
  return `ORDER-${safeOrderNumber}`;
}

function buildGatewayAttemptReference(order) {
  const baseReference = buildOrderReference(order);
  return `${baseReference}__TRY__${Date.now()}`;
}

function buildWompiReference(order) {
  return buildGatewayAttemptReference(order);
}

function buildPayUReference(order) {
  return buildGatewayAttemptReference(order);
}

function amountToCents(amount) {
  const numeric = Number(amount || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric * 100);
}

function buildIntegritySignature({
  reference,
  amountInCents,
  currency,
  integrityKey,
}) {
  const raw = `${reference}${amountInCents}${currency}${integrityKey}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
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
    'https://legged-hacker-unworldly.ngrok-free.dev';

  return `${String(backendBase).replace(/\/+$/, '')}/api/payments/payu/webhook`;
}

function buildCustomerEmail(order) {
  return trimSafe(
    order?.customer?.email ||
      (String(order?.customer?.emailOrPhone || '').includes('@')
        ? order.customer.emailOrPhone
        : ''),
    120
  );
}

function buildCustomerData(order) {
  const customer = order?.customer || {};
  const fullName = [customer.name, customer.lastname].filter(Boolean).join(' ').trim();

  return {
    email: buildCustomerEmail(order) || undefined,
    full_name: fullName || undefined,
    phone_number: trimSafe(customer.phone, 40) || undefined,
    legal_id: trimSafe(customer.id, 40) || undefined,
    legal_id_type: 'CC',
  };
}

function extractOrderNumberFromReference(reference) {
  const safe = trimSafe(reference, 200);
  if (!safe) return '';

  let normalized = safe;

  if (normalized.includes('__TRY__')) {
    normalized = normalized.split('__TRY__')[0];
  }

  const match = normalized.match(/^ORDER-(.+)$/i);
  if (!match || !match[1]) return '';

  return String(match[1]).trim();
}

function extractOrderNumberFromPayUReference(reference) {
  return extractOrderNumberFromReference(reference);
}

function extractOrderNumberFromWompiReference(reference) {
  return extractOrderNumberFromReference(reference);
}

function parsePayUWebhookStatus(payload) {
  const rawStatePol = trimSafe(payload?.state_pol, 40);
  const rawTransactionState = trimSafe(payload?.transactionState, 40);
  const rawLapState = trimSafe(payload?.lapTransactionState, 80).toLowerCase();
  const rawStatus = trimSafe(payload?.status, 40).toLowerCase();

  const code = rawStatePol || rawTransactionState;

  if (
    code === '4' ||
    rawLapState.includes('aprob') ||
    rawStatus.includes('approved')
  ) {
    return {
      paymentStatus: 'paid',
      orderStatus: 'paid',
      label: 'Pago aprobado',
    };
  }

  if (
    code === '6' ||
    rawLapState.includes('rechaz') ||
    rawStatus.includes('declined') ||
    rawStatus.includes('failed')
  ) {
    return {
      paymentStatus: 'failed',
      orderStatus: 'failed',
      label: 'Pago rechazado',
    };
  }

  if (
    code === '7' ||
    rawLapState.includes('pend') ||
    rawStatus.includes('pending')
  ) {
    return {
      paymentStatus: 'pending_gateway',
      orderStatus: null,
      label: 'Pago pendiente',
    };
  }

  if (
    code === '5' ||
    rawLapState.includes('expir') ||
    rawStatus.includes('expired')
  ) {
    return {
      paymentStatus: 'cancelled',
      orderStatus: 'cancelled',
      label: 'Pago expirado/cancelado',
    };
  }

  return {
    paymentStatus: 'pending_gateway',
    orderStatus: null,
    label: 'Estado recibido sin mapeo exacto',
  };
}

function parseWompiTransactionStatus(status) {
  const safe = trimSafe(status, 40).toUpperCase();

  if (safe === 'APPROVED') {
    return {
      paymentStatus: 'paid',
      orderStatus: 'paid',
      label: 'Pago aprobado',
    };
  }

  if (safe === 'DECLINED') {
    return {
      paymentStatus: 'failed',
      orderStatus: 'failed',
      label: 'Pago rechazado',
    };
  }

  if (safe === 'ERROR') {
    return {
      paymentStatus: 'failed',
      orderStatus: 'failed',
      label: 'Pago con error',
    };
  }

  if (safe === 'VOIDED') {
    return {
      paymentStatus: 'cancelled',
      orderStatus: 'cancelled',
      label: 'Pago anulado',
    };
  }

  if (safe === 'PENDING') {
    return {
      paymentStatus: 'pending_gateway',
      orderStatus: null,
      label: 'Pago pendiente',
    };
  }

  return {
    paymentStatus: 'pending_gateway',
    orderStatus: null,
    label: `Estado Wompi ${safe || 'UNKNOWN'}`,
  };
}

function getNestedValue(obj, path) {
  const safePath = String(path || '').trim();
  if (!safePath) return '';

  return safePath.split('.').reduce((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return acc[key];
  }, obj);
}

function buildWompiEventChecksum(payload, eventSecret) {
  const signature =
    payload?.signature && typeof payload.signature === 'object'
      ? payload.signature
      : {};

  const properties = Array.isArray(signature.properties)
    ? signature.properties
    : [];

  const timestamp = payload?.timestamp;

  const propertiesConcat = properties
    .map((prop) => getNestedValue(payload?.data || {}, prop))
    .map((value) => (value === undefined || value === null ? '' : String(value)))
    .join('');

  const raw = `${propertiesConcat}${String(timestamp || '')}${String(eventSecret || '')}`;

  return crypto.createHash('sha256').update(raw).digest('hex');
}

function getWompiProvidedChecksum(req, payload) {
  const headerChecksum = trimSafe(
    req.get('X-Event-Checksum') || req.get('x-event-checksum'),
    200
  );

  if (headerChecksum) return headerChecksum.toLowerCase();

  const bodyChecksum = trimSafe(payload?.signature?.checksum, 200);
  return bodyChecksum.toLowerCase();
}

function normalizeVariantValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function resolveOrderItemProductId(item) {
  if (!item || typeof item !== 'object') return '';

  if (item.productId) return String(item.productId).trim();

  if (item.product && typeof item.product === 'object' && item.product._id) {
    return String(item.product._id).trim();
  }

  if (item.product && typeof item.product !== 'object') {
    return String(item.product).trim();
  }

  if (item._id) return String(item._id).trim();

  if (item.id) return String(item.id).trim();

  return '';
}

async function incrementStock(item, session) {
  const productId = resolveOrderItemProductId(item);

  if (!productId) {
    console.warn('⚠️ Restock omitido: item sin productId válido.', {
      title: item?.title || '',
      productId: item?.productId || '',
      product: item?.product || '',
      id: item?.id || '',
      _id: item?._id || '',
    });
    return false;
  }

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    console.warn('⚠️ Restock omitido: productId no es ObjectId válido.', {
      productId,
      title: item?.title || '',
    });
    return false;
  }

  const quantityValue = item?.quantity ?? item?.qty ?? 0;
  const quantity = Math.max(0, Number(quantityValue));

  if (!Number.isFinite(quantity) || quantity <= 0) {
    console.warn('⚠️ Restock omitido: cantidad inválida.', {
      productId,
      quantityValue,
      title: item?.title || '',
    });
    return false;
  }

  const size = normalizeVariantValue(item?.size || item?.talla);
  const color = normalizeVariantValue(item?.color);

  const product = await Product.findById(productId).session(session);

  if (!product) {
    console.warn('⚠️ Restock omitido: producto no encontrado.', {
      productId,
      title: item?.title || '',
    });
    return false;
  }

  const hasInventoryArray =
    Array.isArray(product.inventory) && product.inventory.length > 0;

  if (hasInventoryArray && (size || color)) {
    const row = product.inventory.find((entry) => {
      const sameSize = normalizeVariantValue(entry?.size || entry?.talla) === size;
      const entryColor = normalizeVariantValue(entry?.color);
      const sameColor = entryColor === color;

      if (size && color) return sameSize && sameColor;
      if (size) return sameSize;
      if (color) return sameColor;
      return false;
    });

    if (row) {
      row.stock = Math.max(0, Number(row.stock || 0)) + quantity;
    } else {
      product.inventory.push({
        size: item?.size || item?.talla || '',
        color: item?.color || '',
        stock: quantity,
      });
    }
  } else if (Array.isArray(product.inventory) && product.inventory.length === 0 && (size || color)) {
    product.inventory.push({
      size: item?.size || item?.talla || '',
      color: item?.color || '',
      stock: quantity,
    });
  }

  product.stock = Math.max(0, Number(product.stock || 0)) + quantity;

  await product.save({ session });

  console.log('✅ Stock repuesto correctamente.', {
    productId,
    title: item?.title || product.title || '',
    quantity,
    size,
    color,
    stock: product.stock,
  });

  return true;
}

async function restockOrderIfNeeded(order, session) {
  if (!order || typeof order !== 'object') return false;

  const inventoryControl =
    order.inventoryControl && typeof order.inventoryControl === 'object'
      ? order.inventoryControl
      : {};

  const discountedAtCheckout = inventoryControl.discountedAtCheckout === true;
  const restockedOnFailure = inventoryControl.restockedOnFailure === true;

  if (!discountedAtCheckout || restockedOnFailure) {
    console.log('ℹ️ Restock no requerido.', {
      orderNumber: order.orderNumber,
      discountedAtCheckout,
      restockedOnFailure,
    });
    return false;
  }

  const items = Array.isArray(order.items) && order.items.length
    ? order.items
    : Array.isArray(order.cart)
      ? order.cart
      : [];

  let restoredCount = 0;

  if (items.length) {
    for (const item of items) {
      try {
        const restored = await incrementStock(item, session);
        if (restored) restoredCount += 1;
      } catch (err) {
        console.error('❌ Error reponiendo stock de un item. Se continúa con la orden.', {
          orderNumber: order.orderNumber,
          productId: resolveOrderItemProductId(item),
          title: item?.title || '',
          error: err.message,
        });
      }
    }
  }

  order.inventoryControl = {
    ...inventoryControl,
    discountedAtCheckout: true,
    restockedOnFailure: true,
    restockedAt: new Date(),
  };

  console.log('✅ Restock procesado para la orden.', {
    orderNumber: order.orderNumber,
    totalItems: items.length,
    restoredCount,
  });

  return true;
}

async function handleInventoryReservationAfterPayment({
  order,
  mapped,
  transaction = {},
  reference = '',
  provider = '',
  session,
}) {
  if (!order || !mapped) return null;
  if (order.inventoryControl?.reservationRequired === false) {
    order.inventoryControl = {
      ...(order.inventoryControl || {}),
      discountedAtCheckout: false,
      restockedOnFailure: false,
      restockedAt: null,
    };
    return null;
  }

  const paymentStatus = String(mapped.paymentStatus || '').trim().toLowerCase();
  const orderNumber = String(order.orderNumber || '').trim();

  if (!orderNumber) return null;

  try {
    if (paymentStatus === 'paid') {
      const reservation = await confirmInventoryReservation(
        orderNumber,
        {
          order: order._id,
          orderNumber: order.orderNumber,
          paymentReference: reference || order.payment?.reference || '',
          paymentTransactionId:
            transaction?.id ||
            order.payment?.transactionId ||
            '',
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

      await OrderEvent.create(
        [
          {
            orderId: order._id,
            type: 'inventory_reservation_confirmed',
            message: 'Reserva de inventario confirmada por pago aprobado.',
            meta: {
              provider,
              orderNumber: order.orderNumber,
              reservationId: reservation?._id || null,
              reservationCode: reservation?.reservationCode || '',
              paymentReference: reference || '',
              paymentTransactionId: transaction?.id || '',
            },
          },
        ],
        { session }
      );

      return reservation;
    }

    if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
      const reservation = await releaseInventoryReservation(
        orderNumber,
        {
          status: paymentStatus === 'cancelled' ? 'cancelled' : 'failed',
          releaseReason: `Pago ${paymentStatus} desde ${provider || 'pasarela'}`,
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

      await OrderEvent.create(
        [
          {
            orderId: order._id,
            type: 'inventory_reservation_released',
            message: 'Reserva de inventario liberada porque el pago no fue aprobado.',
            meta: {
              provider,
              orderNumber: order.orderNumber,
              reservationId: reservation?._id || null,
              reservationCode: reservation?.reservationCode || '',
              paymentStatus,
              paymentReference: reference || '',
              paymentTransactionId: transaction?.id || '',
            },
          },
        ],
        { session }
      );

      return reservation;
    }

    return null;
  } catch (error) {
    console.error('❌ Error procesando reserva de inventario después del pago:', {
      orderNumber: order.orderNumber,
      paymentStatus,
      provider,
      error: error.message,
      code: error.code,
    });

    await OrderEvent.create(
      [
        {
          orderId: order._id,
          type: 'inventory_reservation_error',
          message: 'No se pudo procesar la reserva de inventario después del pago.',
          meta: {
            provider,
            orderNumber: order.orderNumber,
            paymentStatus,
            error: error.message,
            code: error.code || '',
          },
        },
      ],
      { session }
    );

    return null;
  }
}


async function getSiteSettingsDoc() {
  const doc = await SiteSettings.findOne().lean();
  return doc || null;
}

async function getActivePaymentsConfig() {
  const doc = await getSiteSettingsDoc();
  const payments = doc?.theme?.global?.payments || {};
  return normalizePaymentsConfig(payments);
}

async function fetchWompiMerchantData({ baseUrl, publicKey }) {
  const response = await fetch(
    `${baseUrl}/merchants/${encodeURIComponent(publicKey)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason =
      data?.error?.reason ||
      data?.error?.messages ||
      data?.message ||
      `HTTP ${response.status}`;
    throw new Error(`Wompi merchant error: ${reason}`);
  }

  return data?.data || {};
}

async function fetchWompiTransactionById({ baseUrl, transactionId, privateKey, publicKey }) {
  const authKey = trimSafe(privateKey, 300) || trimSafe(publicKey, 300);

  const headers = {
    'Content-Type': 'application/json',
  };

  if (authKey) {
    headers.Authorization = `Bearer ${authKey}`;
  }

  const response = await fetch(
    `${baseUrl}/transactions/${encodeURIComponent(transactionId)}`,
    {
      method: 'GET',
      headers,
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason =
      data?.error?.reason ||
      data?.error?.messages ||
      data?.message ||
      `HTTP ${response.status}`;
    throw new Error(`Wompi transaction error: ${reason}`);
  }

  return data?.data || {};
}

function extractAcceptanceInfo(merchantData) {
  const acceptance = merchantData?.presigned_acceptance || null;
  const personalDataAuth = merchantData?.presigned_personal_data_auth || null;

  return {
    acceptanceToken: acceptance?.acceptance_token || '',
    acceptancePermalink: acceptance?.permalink || '',
    personalDataAcceptanceToken: personalDataAuth?.acceptance_token || '',
    personalDataPermalink: personalDataAuth?.permalink || '',
  };
}

router.get('/public-config', async (_req, res) => {
  try {
    const payments = await getActivePaymentsConfig();

    return res.json({
      active: payments.active,
      provider: payments.provider,
      mode: payments.mode,
      currency: payments.currency,
      checkoutLabel: payments.checkoutLabel,
      successMessage: payments.successMessage,
      enableWebhook: payments.enableWebhook,
    });
  } catch (error) {
    console.error('GET /payments/public-config', error);
    return res
      .status(500)
      .json({ error: 'No se pudo cargar la configuración pública de pagos' });
  }
});

router.post('/wompi/checkout-data', async (req, res) => {
  try {
    const orderId = trimSafe(req.body?.orderId, 100);
    if (!orderId) {
      return res
        .status(400)
        .json({ error: 'ORDER_ID_REQUIRED', message: 'Debes enviar orderId.' });
    }

    const payments = await getActivePaymentsConfig();

    if (payments.active === false) {
      return res.status(409).json({
        error: 'PAYMENTS_DISABLED',
        message: 'Los pagos están desactivados en la tienda.',
      });
    }

    if (payments.provider !== 'wompi') {
      return res.status(409).json({
        error: 'PAYMENT_PROVIDER_MISMATCH',
        message: 'La pasarela activa no es Wompi.',
        provider: payments.provider || null,
      });
    }

    const wompi = payments.credentials.wompi || {};
    if (!wompi.publicKey || !wompi.integrityKey) {
      return res.status(422).json({
        error: 'WOMPI_CONFIG_INCOMPLETE',
        message:
          'Falta la configuración esencial de Wompi (publicKey o integrityKey).',
      });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res
        .status(404)
        .json({ error: 'ORDER_NOT_FOUND', message: 'Orden no encontrada.' });
    }

    const amountInCents = amountToCents(order.total);
    if (amountInCents <= 0) {
      return res.status(422).json({
        error: 'INVALID_ORDER_TOTAL',
        message: 'La orden no tiene un total válido para iniciar el pago.',
      });
    }

    const reference = buildWompiReference(order);
    const currency = payments.currency || 'COP';
    const redirectUrl = buildRedirectUrl(req, order);
    const signature = buildIntegritySignature({
      reference,
      amountInCents,
      currency,
      integrityKey: wompi.integrityKey,
    });

    const baseUrl = resolveWompiBaseUrl(payments.mode);
    const merchantData = await fetchWompiMerchantData({
      baseUrl,
      publicKey: wompi.publicKey,
    });

    const acceptance = extractAcceptanceInfo(merchantData);

    if (!acceptance.acceptanceToken) {
      return res.status(422).json({
        error: 'WOMPI_ACCEPTANCE_TOKEN_MISSING',
        message:
          'Wompi no devolvió el acceptance token. Revisa la public key configurada.',
      });
    }

    return res.json({
      ok: true,
      provider: 'wompi',
      mode: payments.mode,
      baseUrl,
      publicKey: wompi.publicKey,
      currency,
      amountInCents,
      reference,
      redirectUrl,
      signature,
      acceptanceToken: acceptance.acceptanceToken,
      acceptancePermalink: acceptance.acceptancePermalink,
      personalDataAcceptanceToken: acceptance.personalDataAcceptanceToken,
      personalDataPermalink: acceptance.personalDataPermalink,
      acceptance,
      order: {
        id: String(order._id),
        orderNumber: order.orderNumber || '',
        total: Number(order.total || 0),
      },
      customerData: buildCustomerData(order),
      checkoutLabel: payments.checkoutLabel || 'Wompi',
      successMessage: payments.successMessage || '',
    });
  } catch (error) {
    console.error('POST /payments/wompi/checkout-data', error);
    return res.status(500).json({
      error: 'WOMPI_CHECKOUT_DATA_ERROR',
      message: error.message || 'No se pudo preparar el checkout de Wompi.',
    });
  }
});

router.get('/wompi/transaction/:transactionId', async (req, res) => {
  try {
    const transactionId = trimSafe(req.params?.transactionId, 120);

    if (!transactionId) {
      return res.status(400).json({
        ok: false,
        error: 'TRANSACTION_ID_REQUIRED',
        message: 'Debes enviar transactionId.',
      });
    }

    const payments = await getActivePaymentsConfig();

    if (payments.provider !== 'wompi') {
      return res.status(409).json({
        ok: false,
        error: 'PAYMENT_PROVIDER_MISMATCH',
        message: 'La pasarela activa no es Wompi.',
        provider: payments.provider || null,
      });
    }

    const wompi = payments.credentials?.wompi || {};
    const baseUrl = resolveWompiBaseUrl(payments.mode);

    const transaction = await fetchWompiTransactionById({
      baseUrl,
      transactionId,
      privateKey: wompi.privateKey,
      publicKey: wompi.publicKey,
    });

    const reference = trimSafe(transaction?.reference, 200);
    const orderNumber = extractOrderNumberFromWompiReference(reference);

    let order = null;

    if (orderNumber) {
      order = await Order.findOne({ orderNumber }).lean();
    }

    if (!order && transactionId) {
      order = await Order.findOne({ 'payment.transactionId': transactionId }).lean();
    }

    const mapped = parseWompiTransactionStatus(transaction?.status);

    return res.json({
      ok: true,
      transactionId: trimSafe(transaction?.id, 120),
      reference,
      orderId: order ? String(order._id) : '',
      orderNumber: order?.orderNumber || orderNumber || '',
      orderStatus: order?.status || '',
      paymentStatus: order?.payment?.status || mapped.paymentStatus,
      wompiStatus: trimSafe(transaction?.status, 40).toUpperCase(),
      amountInCents: Number(transaction?.amount_in_cents || 0),
      currency: trimSafe(transaction?.currency, 12).toUpperCase() || payments.currency || 'COP',
      customerEmail: trimSafe(transaction?.customer_email, 120),
      paymentMethodType: trimSafe(transaction?.payment_method_type, 80),
      rawTransaction: transaction,
    });
  } catch (error) {
    console.error('GET /payments/wompi/transaction/:transactionId', error);
    return res.status(500).json({
      ok: false,
      error: 'WOMPI_TRANSACTION_LOOKUP_ERROR',
      message: error.message || 'No se pudo consultar la transacción de Wompi.',
    });
  }
});

router.post('/admin/wompi/test-merchant', requireAdmin, async (req, res) => {
  try {
    const payments = await getActivePaymentsConfig();
    const wompiCfg = payments.credentials.wompi || {};

    const mode =
      trimSafe(req.body?.mode, 20).toLowerCase() === 'production'
        ? 'production'
        : trimSafe(req.body?.mode, 20).toLowerCase() === 'sandbox'
          ? 'sandbox'
          : payments.mode;

    const publicKey = trimSafe(req.body?.publicKey, 200) || wompiCfg.publicKey;

    if (!publicKey) {
      return res.status(400).json({
        error: 'PUBLIC_KEY_REQUIRED',
        message:
          'Debes enviar una publicKey o tenerla guardada en configuración.',
      });
    }

    const baseUrl = resolveWompiBaseUrl(mode);
    const merchantData = await fetchWompiMerchantData({ baseUrl, publicKey });
    const acceptance = extractAcceptanceInfo(merchantData);

    return res.json({
      ok: true,
      mode,
      baseUrl,
      merchant: {
        name: merchantData?.name || '',
        email: merchantData?.email || '',
        contactName: merchantData?.contact_name || '',
        phoneNumber: merchantData?.phone_number || '',
      },
      acceptanceToken: acceptance.acceptanceToken,
      acceptancePermalink: acceptance.acceptancePermalink,
      personalDataAcceptanceToken: acceptance.personalDataAcceptanceToken,
      personalDataPermalink: acceptance.personalDataPermalink,
      acceptance,
    });
  } catch (error) {
    console.error('POST /payments/admin/wompi/test-merchant', error);
    return res.status(500).json({
      error: 'WOMPI_TEST_FAILED',
      message: error.message || 'No se pudo validar la configuración de Wompi.',
    });
  }
});

router.post('/wompi/webhook', async (req, res) => {
  let shouldGenerateDian = false;
  let dianOrderId = null;
  let dianTransaction = null;
  let dianPayments = null;

  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const payments = await getActivePaymentsConfig();
    const wompi = payments.credentials?.wompi || {};

    if (!wompi.webhookSecret) {
      return res.status(500).json({
        ok: false,
        error: 'WOMPI_WEBHOOK_SECRET_MISSING',
        message: 'No hay webhook secret configurado para Wompi.',
      });
    }

    const providedChecksum = getWompiProvidedChecksum(req, payload);
    const calculatedChecksum = buildWompiEventChecksum(
      payload,
      wompi.webhookSecret
    ).toLowerCase();

    if (!providedChecksum || providedChecksum !== calculatedChecksum) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_WOMPI_CHECKSUM',
        message: 'La firma del evento de Wompi no es válida.',
      });
    }

    const eventName = trimSafe(payload?.event, 80);
    if (eventName !== 'transaction.updated') {
      return res.status(200).json({
        ok: true,
        ignored: true,
        event: eventName || null,
        message: 'Evento recibido sin acción requerida.',
      });
    }

    const transaction =
      payload?.data?.transaction && typeof payload.data.transaction === 'object'
        ? payload.data.transaction
        : null;

    if (!transaction) {
      return res.status(400).json({
        ok: false,
        error: 'WOMPI_TRANSACTION_MISSING',
        message: 'El evento no contiene transaction.',
      });
    }

    const reference = trimSafe(transaction.reference, 200);
    const orderNumber = extractOrderNumberFromWompiReference(reference);

    if (!orderNumber) {
      return res.status(400).json({
        ok: false,
        error: 'ORDER_REFERENCE_NOT_FOUND',
        message: 'No se pudo extraer el número de orden desde la referencia de Wompi.',
      });
    }

    const existingOrder = await Order.findOne({ orderNumber });

    if (!existingOrder) {
      return res.status(404).json({
        ok: false,
        error: 'ORDER_NOT_FOUND',
        message: `No se encontró la orden ${orderNumber}.`,
      });
    }

    const transactionAmountInCents = Math.round(Number(transaction.amount_in_cents || 0));
    const expectedAmountInCents = amountToCents(existingOrder.total);

    if (
      transactionAmountInCents <= 0 ||
      expectedAmountInCents <= 0 ||
      transactionAmountInCents !== expectedAmountInCents
    ) {
      return res.status(409).json({
        ok: false,
        error: 'WOMPI_AMOUNT_MISMATCH',
        message: 'El valor confirmado por Wompi no coincide con el total de la orden.',
      });
    }

    const transactionCurrency = trimSafe(transaction.currency, 12).toUpperCase();
    const expectedCurrency = trimSafe(
      existingOrder.payment?.currency || payments.currency || 'COP',
      12
    ).toUpperCase();

    if (transactionCurrency && transactionCurrency !== expectedCurrency) {
      return res.status(409).json({
        ok: false,
        error: 'WOMPI_CURRENCY_MISMATCH',
        message: 'La moneda confirmada por Wompi no coincide con la orden.',
      });
    }

    const mapped = parseWompiTransactionStatus(transaction.status);
    const shouldRestock =
      mapped.paymentStatus === 'failed' || mapped.paymentStatus === 'cancelled';

    const session = await mongoose.startSession();

    try {
      let responsePayload = null;

      await session.withTransaction(async () => {
        const order = await Order.findOne({ orderNumber }).session(session);

        if (!order) {
          throw new Error(`ORDER_NOT_FOUND_TX_${orderNumber}`);
        }

        const beforeOrderStatus = String(order.status || '').trim().toLowerCase();
        const beforePaymentStatus = String(order.payment?.status || '').trim().toLowerCase();

        if (!order.payment || typeof order.payment !== 'object') {
          order.payment = {
            active: true,
            provider: 'wompi',
            providerLabel: 'Wompi',
            mode: payments.mode || 'sandbox',
            currency: payments.currency || 'COP',
            checkoutLabel: 'Wompi',
            enableWebhook: true,
            status: 'pending_gateway',
          };
        }

        order.payment.provider = 'wompi';
        order.payment.providerLabel = order.payment.providerLabel || 'Wompi';
        order.payment.mode = payments.mode || order.payment.mode || 'sandbox';
        order.payment.currency =
          trimSafe(transaction.currency, 12).toUpperCase() ||
          order.payment.currency ||
          'COP';
        order.payment.enableWebhook = true;
        order.payment.status = mapped.paymentStatus;

        order.payment.methodType = trimSafe(transaction.payment_method_type, 80);
        order.payment.method = trimSafe(transaction.payment_method?.type, 80);
        order.payment.methodLabel =
          trimSafe(transaction.payment_method_type, 80) ||
          trimSafe(transaction.payment_method?.type, 80) ||
          '';

        order.payment.transactionId = trimSafe(transaction.id, 120);
        order.payment.reference = trimSafe(transaction.reference || reference, 180);
        order.payment.amountInCents = Number(transaction.amount_in_cents || 0);
        order.payment.amount = Number(transaction.amount_in_cents || 0) / 100;
        order.payment.paidAt =
          transaction.finalized_at ||
          transaction.created_at ||
          new Date();

        order.payment.rawMethod = transaction.payment_method || {};

        if (mapped.orderStatus) {
          order.status = mapped.orderStatus;
        }

        const afterOrderStatus = String(order.status || '').trim().toLowerCase();
        const afterPaymentStatus = String(order.payment?.status || '').trim().toLowerCase();

        order.timeline = Array.isArray(order.timeline) ? order.timeline : [];

        if (
          beforeOrderStatus !== afterOrderStatus ||
          beforePaymentStatus !== afterPaymentStatus
        ) {
          order.timeline.push({
            type: 'system',
            message: `Wompi webhook: ${mapped.label}${transaction.id ? ` · TX ${transaction.id}` : ''}${transaction.amount_in_cents ? ` · Valor ${transaction.amount_in_cents}` : ''}`,
            by: 'wompi_webhook',
            at: new Date(),
          });

          await OrderEvent.create(
            [
              {
                orderId: order._id,
                type: 'payment_updated',
                message: `Wompi webhook: ${mapped.label}${transaction.id ? ` · TX ${transaction.id}` : ''}${transaction.amount_in_cents ? ` · Valor ${transaction.amount_in_cents}` : ''}`,
                meta: {
                  by: 'wompi_webhook',
                  provider: 'wompi',
                  transactionId: trimSafe(transaction.id, 120),
                  reference,
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
        await handleInventoryReservationAfterPayment({
          order,
          mapped,
          transaction,
          reference,
          provider: 'wompi',
          session,
        });

        if (shouldRestock) {
       
          await restockOrderIfNeeded(order, session);
        }

        await order.save({ session });

        console.log('✅ ORDEN GUARDADA DESDE WEBHOOK WOMPI', {
          orderNumber: order.orderNumber,
          orderStatus: order.status,
          paymentStatus: order.payment?.status || '',
          restockedOnFailure: order.inventoryControl?.restockedOnFailure,
        });

        if (mapped.paymentStatus === 'paid') {
          shouldGenerateDian = true;
          dianOrderId = order._id;
          dianTransaction = transaction;
          dianPayments = payments;
        }

        responsePayload = {
          ok: true,
          received: true,
          event: eventName,
          orderNumber: order.orderNumber,
          orderStatus: order.status,
          paymentStatus: order.payment?.status || '',
          transactionId: trimSafe(transaction.id, 120),
          reference,
        };
      });

      if (shouldGenerateDian && dianOrderId) {
        generateElectronicInvoiceAfterPayment({
          orderId: dianOrderId,
          transaction: dianTransaction,
          payments: dianPayments,
          paymentProvider: 'wompi',
        });
      }

      return res.status(200).json(responsePayload);
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('POST /payments/wompi/webhook', error);
    return res.status(500).json({ error: 'WOMPI_WEBHOOK_ERROR' });
  }
});

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

    if (payments.active === false) {
      return res.status(409).json({
        error: 'PAYMENTS_DISABLED',
        message: 'Los pagos están desactivados en la tienda.',
      });
    }

    if (payments.provider !== 'payu') {
      return res.status(409).json({
        error: 'PAYMENT_PROVIDER_MISMATCH',
        message: 'La pasarela activa no es PayU.',
        provider: payments.provider || null,
      });
    }

    const payu = payments.credentials?.payu || {};
    if (
      !payu.merchantId ||
      !payu.accountId ||
      !payu.apiLogin ||
      !payu.apiKey
    ) {
      return res.status(422).json({
        error: 'PAYU_CONFIG_INCOMPLETE',
        message:
          'Falta configuración esencial de PayU (merchantId, accountId, apiLogin o apiKey).',
      });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res
        .status(404)
        .json({ error: 'ORDER_NOT_FOUND', message: 'Orden no encontrada.' });
    }

    const amount = Number(order.total || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(422).json({
        error: 'INVALID_ORDER_TOTAL',
        message: 'La orden no tiene un total válido para iniciar el pago.',
      });
    }

    const referenceCode = buildPayUReference(order);
    const currency = payments.currency || 'COP';
    const redirectUrl = buildRedirectUrl(req, order);
    const confirmationUrl = buildPayUConfirmationUrl();

    return res.json({
      ok: true,
      provider: 'payu',
      mode: payments.mode,
      checkoutLabel: payments.checkoutLabel || 'PayU',
      successMessage: payments.successMessage || '',
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
        redirectUrl,
        confirmationUrl,
        test: payments.mode === 'sandbox',
      },
      customerData: buildCustomerData(order),
    });
  } catch (error) {
    console.error('POST /payments/payu/checkout-data', error);
    return res.status(500).json({
      error: 'PAYU_CHECKOUT_DATA_ERROR',
      message: error.message || 'No se pudo preparar el checkout de PayU.',
    });
  }
});

router.post(
  '/payu/webhook',
  express.urlencoded({ extended: true }),
  async (req, res) => {
    try {
      const payload = req.body && typeof req.body === 'object' ? req.body : {};

      const reference =
        trimSafe(payload.reference_sale, 160) ||
        trimSafe(payload.referenceCode, 160) ||
        trimSafe(payload.reference, 160);

      const orderNumber = extractOrderNumberFromPayUReference(reference);
      if (!orderNumber) {
        return res.status(400).json({
          ok: false,
          error: 'ORDER_REFERENCE_NOT_FOUND',
          message: 'No se pudo extraer el número de orden desde la referencia de PayU.',
        });
      }

      const existingOrder = await Order.findOne({ orderNumber });
      if (!existingOrder) {
        return res.status(404).json({
          ok: false,
          error: 'ORDER_NOT_FOUND',
          message: `No se encontró la orden ${orderNumber}.`,
        });
      }

      const mapped = parsePayUWebhookStatus(payload);
      const shouldRestock =
        mapped.paymentStatus === 'failed' || mapped.paymentStatus === 'cancelled';

      const txValue = trimSafe(payload.value, 60) || trimSafe(payload.TX_VALUE, 60);
      const txId =
        trimSafe(payload.transaction_id, 80) ||
        trimSafe(payload.transactionId, 80) ||
        trimSafe(payload.polTransactionId, 80);

      const session = await mongoose.startSession();

      try {
        let responsePayload = null;

        await session.withTransaction(async () => {
          const order = await Order.findOne({ orderNumber }).session(session);

          if (!order) {
            throw new Error(`ORDER_NOT_FOUND_TX_${orderNumber}`);
          }

          const beforeOrderStatus = String(order.status || '').trim().toLowerCase();
          const beforePaymentStatus = String(order.payment?.status || '').trim().toLowerCase();

          if (!order.payment || typeof order.payment !== 'object') {
            order.payment = {
              active: true,
              provider: 'payu',
              providerLabel: 'PayU',
              mode: 'sandbox',
              currency: 'COP',
              checkoutLabel: 'PayU',
              enableWebhook: true,
              status: 'pending_gateway',
            };
          }

          order.payment.provider = 'payu';
          order.payment.providerLabel = order.payment.providerLabel || 'PayU';
          order.payment.enableWebhook = true;
          order.payment.status = mapped.paymentStatus;

          if (mapped.orderStatus) {
            order.status = mapped.orderStatus;
          }

          order.timeline = Array.isArray(order.timeline) ? order.timeline : [];

          const afterOrderStatus = String(order.status || '').trim().toLowerCase();
          const afterPaymentStatus = String(order.payment?.status || '').trim().toLowerCase();

          if (
            beforeOrderStatus !== afterOrderStatus ||
            beforePaymentStatus !== afterPaymentStatus
          ) {
            order.timeline.push({
              type: 'system',
              message: `PayU webhook: ${mapped.label}${txId ? ` · TX ${txId}` : ''}${txValue ? ` · Valor ${txValue}` : ''}`,
              by: 'payu_webhook',
              at: new Date(),
            });
          }

          await handleInventoryReservationAfterPayment({
            order,
            mapped,
            transaction: {
              id: txId,
            },
            reference,
            provider: 'payu',
            session,
          });

          if (shouldRestock) {
            await restockOrderIfNeeded(order, session);
          }

          await order.save({ session });

          responsePayload = {
            ok: true,
            received: true,
            orderNumber: order.orderNumber,
            orderStatus: order.status,
            paymentStatus: order.payment?.status || '',
            reference,
          };
        });

        return res.status(200).json(responsePayload);
      } finally {
        await session.endSession();
      }
    } catch (error) {
      console.error('POST /payments/payu/webhook', error);
      return res.status(500).json({ error: 'PAYU_WEBHOOK_ERROR' });
    }
  }
);

router.post(
  '/admin/delete-factus-invoice/:orderId',
  requireAdmin,
  requirePermission('billing:retry'),
  async (req, res) => {
    try {
      const orderId = trimSafe(req.params.orderId, 100);

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: 'ORDER_ID_REQUIRED',
          message: 'No se recibió el ID de la orden.',
        });
      }

      const invoice = await ElectronicInvoice.findOne({ orderId }).lean();

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'INVOICE_NOT_FOUND',
          message: 'No se encontró factura electrónica para esta orden.',
        });
      }

      if (
        invoice.status === 'accepted' ||
        invoice?.provider?.isValidated === true ||
        invoice?.provider?.raw?.is_validated === true
      ) {
        return res.status(409).json({
          success: false,
          error: 'INVOICE_ALREADY_VALIDATED',
          message: 'La factura ya está validada y no se puede eliminar en Factus.',
        });
      }

      const settingsDoc = await getSiteSettingsDoc();
      const electronicProvider = settingsDoc?.billing?.electronicProvider || {};

      const referenceCode =
        invoice?.provider?.referenceCode ||
        invoice?.provider?.raw?.reference_code ||
        invoice?.orderNumber ||
        '';

      const credentials = getFactusCredentials({
        providerConfig: electronicProvider,
      });

      const tokenResult = await getFactusAccessToken(credentials);

      if (!tokenResult.success) {
        return res.status(500).json({
          success: false,
          error: 'FACTUS_AUTH_ERROR',
          message: 'No se pudo autenticar con Factus.',
          detail: tokenResult.error || tokenResult.raw || null,
        });
      }

      const deleteResult = await deleteFactusBillByReference({
        credentials,
        tokenResult,
        referenceCode,
      });

      console.log(
        '🧹 DELETE FACTUS RESULT:',
        JSON.stringify(deleteResult, null, 2)
      );

      const deleteMessage = String(
        deleteResult?.error ||
        deleteResult?.data?.message ||
        ''
      ).toLowerCase();

      const factusDocumentNotFound =
        Number(deleteResult?.status) === 404 ||
        deleteMessage.includes('no se encontró') ||
        deleteMessage.includes('no se encontro') ||
        deleteMessage.includes('documento con código de referencia') ||
        deleteMessage.includes('codigo de referencia') ||
        deleteMessage.includes('not found');

      const deleteSucceeded =
        deleteResult.success || factusDocumentNotFound;

      await ElectronicInvoice.findOneAndUpdate(
        { orderId },
        {
          $set: {
            status: deleteResult.success ? 'pending' : 'failed',
            errorMessage: deleteResult.success
              ? ''
              : String(deleteResult.error || 'No se pudo eliminar en Factus.'),
            'dianResponse.stage': 'manual_delete_from_admin',
            'dianResponse.message': deleteResult.success
              ? 'Factura no validada eliminada en Factus.'
              : String(deleteResult.error || 'Error eliminando factura en Factus.'),
            'dianResponse.raw': deleteResult,
          },
        },
        { new: true }
      );

      await OrderEvent.create({
        orderId,
        type: 'electronic_invoice_deleted',
        message: deleteResult.success
          ? 'Factura no validada eliminada en Factus desde el panel admin.'
          : 'Intento fallido de eliminación de factura en Factus.',
        meta: {
          provider: 'factus',
          referenceCode,
          success: deleteSucceeded,
          status: deleteResult.status,
          by: req.headers['x-admin-user'] || 'admin',
        },
      });

      return res.json({
        success: deleteSucceeded,
        referenceCode,
        deleteResult,
      });
    } catch (error) {
      console.error('❌ DELETE FACTUS INVOICE ERROR:', error);

      return res.status(500).json({
        success: false,
        error: 'DELETE_FACTUS_INVOICE_ERROR',
        message: error.message || 'No se pudo eliminar la factura en Factus.',
      });
    }
  }
);

router.post(
  '/admin/create-credit-note/:orderId',
  requireAdmin,
  requirePermission('billing:credit_note'),
  async (req, res) => {
    try {
      const invoice = await ElectronicInvoice.findOne({ orderId: req.params.orderId });
      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'BILLING_INVOICE_NOT_FOUND',
          message: 'Factura electrónica no encontrada.',
        });
      }

      const result = await createOfficialCreditNote(invoice._id, req.body || {}, {
        adminUser: req.headers['x-admin-user'] || 'admin',
      });

      return res.status(result.created ? 201 : 200).json({
        success: true,
        created: result.created,
        reused: result.reused,
        message: result.message,
        invoice: result.invoice,
      });
    } catch (error) {
      return res.status(Number(error?.status || 500)).json({
        success: false,
        error: error?.code || 'BILLING_CREDIT_NOTE_ERROR',
        message: error?.message || 'Error interno creando nota crédito.',
      });
    }
  }
);

router.post(
  '/admin/retry-electronic-invoice/:orderId',
  requireAdmin,
  requirePermission('billing:retry'),
  async (req, res) => {
    try {
      const orderId = trimSafe(req.params.orderId, 100);

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: 'ORDER_ID_REQUIRED',
        });
      }

      const result = await issueElectronicInvoiceForOrder({
        orderId,
        source: 'admin-retry',
        initiatedBy: req.headers['x-admin-user'] || 'admin',
        skipWhenElectronicBillingIsInactive: true,
        allowRetry: true,
      });

      if (!result.retried) {
        return res.status(409).json({
          success: false,
          error: result.inProgress
            ? 'BILLING_EMISSION_IN_PROGRESS'
            : 'BILLING_RETRY_NOT_ALLOWED',
          message: result.message,
          invoice: result.invoice || null,
        });
      }

      const updatedInvoice = result.invoice;
      const nextStatus = updatedInvoice?.status || 'sent';
      const providerInvoiceNumber =
        updatedInvoice?.provider?.number || updatedInvoice?.invoiceNumber || '';
      const providerCufe = updatedInvoice?.provider?.cufe || updatedInvoice?.cufe || '';

      await OrderEvent.create({
        orderId,
        type: 'electronic_invoice_retry',
        message: 'Factura electrónica reenviada al proveedor desde el panel admin.',
        meta: {
          provider: updatedInvoice?.provider?.name || '',
          status: nextStatus,
          providerSuccess: true,
          invoiceNumber: providerInvoiceNumber,
          cufe: providerCufe,
          by: req.headers['x-admin-user'] || 'admin',
        },
      });

      return res.json({
        success: true,
        status: nextStatus,
        invoice: updatedInvoice,
        message: result.message,
      });
    } catch (error) {
      console.error('❌ RETRY ELECTRONIC INVOICE ERROR:', error);

      return res.status(Number(error.status || 500)).json({
        success: false,
        error: error.message,
        code: error.code || 'BILLING_RETRY_ERROR',
        invoice: error.invoice || null,
      });
    }
  }
);

module.exports = router;
