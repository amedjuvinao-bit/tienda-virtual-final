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

const WOMPI_ENVIRONMENTS = {
  sandbox: 'https://sandbox.wompi.co/v1',
  production: 'https://production.wompi.co/v1',
};

const { generateCUFE } = require('../lib/dian/cufe');
const { generateInvoiceXML } = require('../lib/dian/xmlGenerator');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const { sendElectronicInvoiceToProvider } = require('../lib/dian/providerAdapter');
const {
  deleteFactusBillByReference,
  getFactusCredentials,
  getFactusAccessToken,
} = require('../lib/dian/providers/factusProvider');

const {
  sendCreditNoteToFactus,
} = require('../lib/dian/providers/factusProvider');

const {
  addCreditNoteCreatedEvent,
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

async function generateElectronicInvoiceAfterPayment({ orderId, transaction, payments }) {
  try {
    const order = await Order.findById(orderId).lean();

    if (!order) {
      console.warn('⚠️ DIAN omitida: orden no encontrada después del pago.', {
        orderId: String(orderId || ''),
      });
      return;
    }

    if (order.payment?.status !== 'paid') {
      console.log('ℹ️ DIAN omitida: la orden no está pagada.', {
        orderNumber: order.orderNumber,
        paymentStatus: order.payment?.status || '',
      });
      return;
    }

    const settingsDoc = await getSiteSettingsDoc();

    const billingConfig = settingsDoc?.billing || {};
    const dianConfig = billingConfig?.dian || {};
    const electronicProvider = billingConfig?.electronicProvider || {};

    const selectedProvider = String(electronicProvider?.provider || 'mock')
      .trim()
      .toLowerCase();

    const isElectronicBillingActive =
      dianConfig?.enabled === true &&
      String(dianConfig?.mode || 'internal') !== 'internal';

    if (!isElectronicBillingActive || selectedProvider === 'mock') {
      console.log('ℹ️ Facturación electrónica omitida: modo interno/mock activo.', {
        orderNumber: order.orderNumber,
        provider: selectedProvider,
        dianMode: dianConfig?.mode || 'internal',
      });
      return;
    }

    const existingInvoice = await ElectronicInvoice.findOne({ orderId: order._id }).lean();

    if (existingInvoice?.status === 'generated' && existingInvoice?.cufe) {
      console.log('ℹ️ DIAN omitida: factura ya generada.', {
        orderNumber: order.orderNumber,
        cufe: existingInvoice.cufe,
      });
      return;
    }

    const now = new Date();
    const issueDate = now.toISOString().slice(0, 10);
    const issueTime = now.toISOString().slice(11, 19);

    const cufeData = generateCUFE({
       invoiceNumber: order.orderNumber,
      issueDate,
      issueTime,
      grossAmount: order.subtotal,
      taxAmount: order.taxes?.iva?.amount || 0,
      totalAmount: order.total,
      companyNit: billingConfig?.fiscalInfo?.nit || '',
      customerDocument: order.customer?.id || '',
      technicalKey:
        billingConfig?.dianResolution?.technicalKey ||
        billingConfig?.dian?.technicalKey ||
        '',
      environment:
        billingConfig?.dianResolution?.environment ||
        billingConfig?.dian?.environment ||
        '2',
    });

    const xml = generateInvoiceXML({
      order,
      settings: settingsDoc,
      cufeData,
    });

    console.log(
      '🧾 CUSTOMER FOR FACTUS:',
      JSON.stringify(order.customer, null, 2)
    );

    const providerInvoiceData = {
      order: {
        ...order,
        payment: {
          ...(order.payment || {}),
          methodType:
            order.payment?.methodType ||
            transaction?.payment_method_type ||
            '',
          method:
            order.payment?.method ||
            transaction?.payment_method?.type ||
            transaction?.payment_method_type ||
            '',
          methodLabel:
            order.payment?.methodLabel ||
            transaction?.payment_method_type ||
            transaction?.payment_method?.type ||
            '',
          rawMethod:
            order.payment?.rawMethod ||
            transaction?.payment_method ||
            {},
        },
      },
      settings: settingsDoc,
      cufeData,
      xmlContent: xml,
      provider: selectedProvider,
      providerConfig: electronicProvider,
    };

    let providerResponse = null;
    let providerData = null;
    let providerInvoiceNumber = order.orderNumber;
    let providerCufe = cufeData.cufe;

    try {
      providerResponse = await sendElectronicInvoiceToProvider({
        provider: selectedProvider,
        invoiceData: providerInvoiceData,
      });

      console.log(
        '📡 RESPUESTA PROVIDER DIAN FULL:',
        JSON.stringify(providerResponse, null, 2)
      );
    } catch (err) {
      console.error('❌ ERROR EN ENVÍO A PROVIDER DIAN:', err.message);
    }

    if (providerResponse?.success === true) {
      providerData = providerResponse?.data?.data || providerResponse?.data || null;
      providerInvoiceNumber = providerData?.number || order.orderNumber;
      providerCufe = providerData?.cufe || cufeData.cufe;
    }

    await ElectronicInvoice.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          invoiceNumber: providerInvoiceNumber,
          required: true,
          status:
            providerResponse?.success === true
              ? 'generated'
              : 'provider_error',
          customer: order.customer || {},
          fiscalInfo: billingConfig?.fiscalInfo || {},
          dianResolution: billingConfig?.dianResolution || {},
          legalTexts: billingConfig?.legalTexts || {},
          cufe: providerCufe,
          xmlContent: xml,
          qrUrl: cufeData.qrUrl,

          pdfUrl:
            providerData?.links?.pdf ||
            providerData?.links?.pdf_url ||
            '',

          xmlUrl:
            providerData?.links?.xml ||
            providerData?.links?.xml_url ||
            '',

          provider: {
            name: selectedProvider,
            status: providerResponse?.data?.status || '',
            referenceCode: providerData?.reference_code || order.orderNumber,
            number: providerData?.number || providerInvoiceNumber,
            cufe: providerData?.cufe || providerCufe,
            isValidated: providerData?.is_validated === true,
            validatedAt: providerData?.validated_at || '',
            links: providerData?.links || {},
            raw: providerData || {},
          },
          generatedAt: now,
          dianResponse: {
            stage: 'generated_after_payment_approved_provider_ready',
            paymentProvider: 'wompi',
            transactionId: trimSafe(transaction?.id, 120),
            environment:
              billingConfig?.dianResolution?.environment ||
              billingConfig?.dian?.environment ||
              '2',
            issueDate,
            issueTime,
            paymentMode: payments?.mode || '',
            providerPrepared: selectedProvider,
            providerResponse: providerResponse || null,
          },
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    if (providerResponse?.success === true) {
      console.log('✅ FACTURA ELECTRÓNICA GENERADA', {
        orderNumber: order.orderNumber,
        cufe: providerCufe,
        provider: selectedProvider,
      });
    } else {
      console.log('⚠️ FACTURA ELECTRÓNICA PENDIENTE / ERROR PROVIDER', {
        orderNumber: order.orderNumber,
        cufe: cufeData.cufe,
        provider: selectedProvider,
        providerStatus: providerResponse?.status || null,
        providerError: providerResponse?.error || null,
      });
    }
  } catch (err) {
    console.error('❌ ERROR GENERANDO FACTURA ELECTRÓNICA FUERA DEL WEBHOOK CRÍTICO', err);
  }
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

    console.log('WOMPI SIGN DEBUG', {
      reference,
      amountInCents,
      currency,
      integrityKey: wompi.integrityKey,
      integrityKeyLength: String(wompi.integrityKey || '').length,
      signature,
    });

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
  console.log('🔥 WOMPI WEBHOOK HIT', new Date().toISOString());
  console.log('📦 BODY WEBHOOK:', JSON.stringify(req.body, null, 2));
  console.log(
    '🔐 HEADER CHECKSUM:',
    req.get('x-event-checksum') || req.get('X-Event-Checksum')
  );

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

    console.log('CHECKSUM Wompi');
    console.log('PROVIDED:', providedChecksum);
    console.log('CALCULATED:', calculatedChecksum);

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
        apiLogin: payu.apiLogin,
        apiKey: payu.apiKey,
        referenceCode,
        description: `Pago orden ${order.orderNumber || referenceCode}`,
        amount,
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
  async (req, res) => {
    try {
      const { orderId } = req.params;

      const {
        reason = '',
        reasonCode = '1',
        type = 'total',
        selectedItems = [],
        items = [],
      } = req.body || {};

      const creditNoteItems =
        Array.isArray(selectedItems) && selectedItems.length
          ? selectedItems
          : Array.isArray(items)
            ? items
            : [];

      const cleanReason = trimSafe(
        reason || 'Nota crédito generada desde el panel administrativo.',
        500
      );
      const order = await Order.findById(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Orden no encontrada.',
        });
      }

      const invoice = await ElectronicInvoice.findOne({
        orderId,
      });

      

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Factura electrónica no encontrada.',
        });
      }

      const existingTotalCreditNote =
        Array.isArray(invoice.creditNotes) &&
        invoice.creditNotes.some(
          (note) =>
            note.type === 'total' &&
            ['validated', 'sent'].includes(note.status)
        );

      if (type === 'total' && existingTotalCreditNote) {
        return res.status(409).json({
          success: false,
          error:
            'Esta factura ya tiene una nota crédito total registrada.',
        });
      }
      const invoiceTotalAmount =
        Number(invoice?.provider?.raw?.totals?.total || 0) ||
        Number(order?.total || 0);

      const currentValidatedCreditTotal = Array.isArray(invoice.creditNotes)
        ? invoice.creditNotes
            .filter(
              (note) =>
                note.type === 'partial' &&
                ['validated', 'sent'].includes(note.status)
            )
            .reduce(
              (sum, note) => sum + Number(note.totalAmount || 0),
              0
            )
        : 0;

      const requestedPartialTotal =
        type === 'partial'
          ? creditNoteItems.reduce(
              (sum, item) =>
                sum +
                Number(item.price || 0) *
                  Number(item.quantity || 0),
              0
            )
          : 0;

      if (
        type === 'partial' &&
        invoiceTotalAmount > 0 &&
        currentValidatedCreditTotal + requestedPartialTotal >
          invoiceTotalAmount
      ) {
        return res.status(409).json({
          success: false,
          error:
            'El valor acumulado de las notas crédito supera el total de la factura.',
        });
      }

      const billNumber =
        invoice?.provider?.number ||
        invoice?.invoiceNumber ||
        invoice?.provider?.raw?.number ||
        '';

      if (!billNumber) {
        return res.status(400).json({
          success: false,
          error: 'La factura no tiene número Factus.',
        });
      }

      const settings = await SiteSettings.findOne();
      const electronicProvider =
        settings?.billing?.electronicProvider || {};


      
      const creditNoteResult = await sendCreditNoteToFactus({
        electronicInvoice: invoice,
        invoice,
        order,
        settings,
        type,
        reasonCode,
        reasonText: cleanReason,
        selectedItems: creditNoteItems,
        billNumber,
        providerConfig: electronicProvider,
      });

      if (!creditNoteResult.success) {
        return res.status(400).json({
          success: false,
          error:
            creditNoteResult.error ||
            'No se pudo crear la nota crédito.',
          raw: creditNoteResult.raw || null,
        });
      }

      if (!Array.isArray(invoice.creditNotes)) {
        invoice.creditNotes = [];
      }

      const creditNoteData =
        creditNoteResult?.data?.data ||
        creditNoteResult?.data ||
        {};

      invoice.creditNotes.push({
        createdAt: new Date(),

        type,

        reasonCode,
        reasonText: cleanReason,

        referenceCode:
          creditNoteData?.reference_code || '',

        billNumber:
          creditNoteData?.bill?.number ||
          billNumber ||
          '',

        subtotal:
          Number(creditNoteData?.totals?.gross_amount || 0),

        taxAmount:
          Number(creditNoteData?.totals?.tax_amount || 0),

        totalAmount:
          Number(creditNoteData?.totals?.total || 0),

        status:
          creditNoteData?.is_validated === true
            ? 'validated'
            : 'sent',

        provider: {
          name: 'factus',

          status:
            creditNoteResult?.data?.status ||
            creditNoteData?.status ||
            '',

          number:
            creditNoteData?.number || '',

          cufe:
            creditNoteData?.cude ||
            creditNoteData?.cufe ||
            '',

          isValidated:
            creditNoteData?.is_validated === true,

          validatedAt:
            creditNoteData?.validated_at || '',

          links:
            creditNoteData?.links || {},

          raw:
            creditNoteResult?.data || {},
        },

        items:
          Array.isArray(creditNoteData?.items)
            ? creditNoteData.items.map((item) => ({
                productId: String(item?.code_reference || ''),
                codeReference: String(item?.code_reference || ''),
                name: String(item?.name || ''),
                quantity: Number(item?.quantity || 0),
                price: Number(item?.price || 0),
                taxRate: String(
                  item?.taxes?.[0]?.rates?.[0]?.rate || '0.00'
                ),
                isExcluded:
                  item?.taxes?.[0]?.is_excluded === true,
                raw: item,
              }))
            : [],
      });

      await invoice.save();

      await addCreditNoteCreatedEvent({
        order,
        creditNoteData,
        by: req.headers['x-admin-user'] || 'admin',
      });
      await OrderEvent.create({
        orderId,
        type: 'credit_note_created',
        message: `Nota crédito ${type} creada en Factus.`,
        meta: {
          type,
          reason,
          creditNoteNumber:
            creditNoteResult?.data?.number || '',
        },
        by: req.headers['x-admin-user'] || 'admin',
      });

      return res.json({
        success: true,
        message: 'Nota crédito creada correctamente.',
        data: creditNoteResult.data,
        invoice,
      });
    } catch (error) {
      console.error(
        '❌ ERROR CREANDO NOTA CRÉDITO:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          'Error interno creando nota crédito.',
      });
    }
  }
);

router.post(
  '/admin/retry-electronic-invoice/:orderId',
  requireAdmin,
  async (req, res) => {
    try {
      const orderId = trimSafe(req.params.orderId, 100);

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: 'ORDER_ID_REQUIRED',
        });
      }

      const order = await Order.findById(orderId).lean();

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'ORDER_NOT_FOUND',
        });
      }

      const settingsDoc = await getSiteSettingsDoc();

      const billingConfig = settingsDoc?.billing || {};
      const dianConfig = billingConfig?.dian || {};
      const electronicProvider = billingConfig?.electronicProvider || {};

      const selectedProvider = String(electronicProvider?.provider || 'mock')
        .trim()
        .toLowerCase();

      if (dianConfig?.enabled !== true || selectedProvider === 'mock') {
        return res.status(409).json({
          success: false,
          error: 'DIAN_DISABLED',
        });
      }

      const now = new Date();
      const issueDate = now.toISOString().slice(0, 10);
      const issueTime = now.toISOString().slice(11, 19);

      const cufeData = generateCUFE({
        invoiceNumber: order.orderNumber,
        issueDate,
        issueTime,
        grossAmount: order.subtotal,
        taxAmount: order.taxes?.iva?.amount || 0,
        totalAmount: order.total,
        companyNit: billingConfig?.fiscalInfo?.nit || '',
        customerDocument: order.customer?.id || '',
        technicalKey:
          billingConfig?.dianResolution?.technicalKey ||
          billingConfig?.dian?.technicalKey ||
          '',
        environment:
          billingConfig?.dianResolution?.environment ||
          billingConfig?.dian?.environment ||
          '2',
      });

      const xml = generateInvoiceXML({
        order,
        settings: settingsDoc,
        cufeData,
      });

      const providerResponse = await sendElectronicInvoiceToProvider({
        provider: selectedProvider,
        invoiceData: {
          order,
          settings: settingsDoc,
          cufeData,
          xmlContent: xml,
          provider: selectedProvider,
          providerConfig: electronicProvider,
        },
      });

      const providerData =
        providerResponse?.data?.data ||
        providerResponse?.data ||
        null;

      const providerInvoiceNumber =
        providerData?.number ||
        order.orderNumber;

      const providerCufe =
        providerData?.cufe ||
        cufeData.cufe;

      const isProviderSuccess = providerResponse?.success === true;
      const isValidated = providerData?.is_validated === true;

      const providerErrors =
        providerData?.errors ||
        providerResponse?.data?.errors ||
        providerResponse?.data?.data?.errors ||
        providerResponse?.raw?.errors ||
        providerResponse?.raw?.data?.errors ||
        providerResponse?.raw?.data?.data?.errors ||
        {};

      const hasProviderErrors =
        providerErrors &&
        typeof providerErrors === 'object' &&
        Object.keys(providerErrors).length > 0;

      let nextStatus = 'pending';

      if (isProviderSuccess && isValidated) {
        nextStatus = 'accepted';
      } else if (isProviderSuccess) {
        nextStatus = 'sent';
      } else if (hasProviderErrors) {
        nextStatus = 'rejected';
      } else {
        nextStatus = 'failed';
      }

      const updatedInvoice = await ElectronicInvoice.findOneAndUpdate(
        { orderId: order._id },
        {
          $set: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            invoiceNumber: providerInvoiceNumber,
            required: true,
            status: nextStatus,
            providerErrors,
            customer: order.customer || {},
            fiscalInfo: billingConfig?.fiscalInfo || {},
            dianResolution: billingConfig?.dianResolution || {},
            legalTexts: billingConfig?.legalTexts || {},
            cufe: providerCufe,
            xmlContent: xml,
            qrUrl: cufeData.qrUrl,

            pdfUrl:
              providerData?.links?.pdf ||
              providerData?.links?.pdf_url ||
              '',

            xmlUrl:
              providerData?.links?.xml ||
              providerData?.links?.xml_url ||
              '',

            provider: {
              name: selectedProvider,
              status: providerResponse?.data?.status || providerResponse?.status || '',
              referenceCode: providerData?.reference_code || order.orderNumber,
              number: providerData?.number || providerInvoiceNumber,
              cufe: providerData?.cufe || providerCufe,
              isValidated,
              validatedAt: providerData?.validated_at || '',
              links: providerData?.links || {},
              raw: providerData || {},
            },

            dianResponse: {
              stage: 'manual_retry_from_admin',
              environment:
                billingConfig?.dianResolution?.environment ||
                billingConfig?.dian?.environment ||
                '2',
              issueDate,
              issueTime,
              message: providerResponse?.error || '',
              code: String(providerResponse?.status || ''),
              raw: providerResponse || {},
            },

            errorMessage: isProviderSuccess
              ? ''
              : String(providerResponse?.error || 'Error reenviando factura.'),

            generatedAt: now,
            sentAt: now,
            acceptedAt: isValidated ? now : null,
            failedAt: isProviderSuccess ? null : now,
          },
        },
        {
          new: true,
          upsert: true,
        }
      );

      await OrderEvent.create({
        orderId: order._id,
        type: 'electronic_invoice_retry',
        message: isProviderSuccess
          ? 'Factura electrónica reenviada al proveedor desde el panel admin.'
          : 'Reintento de factura electrónica falló desde el panel admin.',
        meta: {
          provider: selectedProvider,
          status: nextStatus,
          providerSuccess: isProviderSuccess,
          invoiceNumber: providerInvoiceNumber,
          cufe: providerCufe,
          by: req.headers['x-admin-user'] || 'admin',
        },
      });

      return res.json({
        success: isProviderSuccess,
        status: nextStatus,
        invoice: updatedInvoice,
        providerResponse,
      });
    } catch (error) {
      console.error('❌ RETRY ELECTRONIC INVOICE ERROR:', error);

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

module.exports = router;