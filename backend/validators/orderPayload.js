// backend/validators/orderPayload.js
/**
 * Valida y “limpia” el payload de creación de orden.
 * Devuelve: { ok, errors, cleaned }
 *
 * Mejoras:
 * - Qty entero positivo, precio >= 0
 * - Recalcula subtotal del carrito y fuerza total = subtotal + shipping (con tolerancia)
 * - Saneado y límites de longitud en strings
 * - Validación de productId (ObjectId-like o string no vacío)
 * - Normalización y límites de tags (únicos, máx. 20; cada uno máx. 24 chars)
 * - shipping >= 0, límites de tamaño del carrito
 * - ✅ Validación del bloque payment
 * - ✅ Conserva municipalityId para facturación electrónica
 */

const {
  normalizeAttributes,
} = require('../lib/products/productVariantConfig');

const MAX_CART_ITEMS = 200;
const MAX_TAGS = 20;
const PAYMENT_PROVIDERS = ['bold', 'wompi', 'mercado-pago', 'payu', 'manual'];
const PAYMENT_MODES = ['sandbox', 'production'];
const PAYMENT_STATUSES = ['pending_gateway', 'pending_manual', 'paid', 'failed', 'cancelled'];
const BILLING_PERSON_TYPES = ['natural', 'juridica'];
const BILLING_DOCUMENT_TYPES = [
  'RC',
  'TI',
  'CC',
  'TE',
  'CE',
  'NIT',
  'PP',
  'DIE',
  'PEP',
  'PPT',
  'NIT_EXTRANJERO',
  'NUIP',
];

const MAX_LEN = {
  name: 80,
  lastname: 80,
  id: 40,
  emailOrPhone: 120,
  phone: 40,
  address: 160,
  city: 80,
  municipalityId: 30,
  postalCode: 20,
  country: 80,
  department: 80,
  billingExtra: 120,
  businessName: 180,
  email: 180,
  countryCode: 3,
  departmentCode: 20,
  tributeCode: 10,
  tag: 24,
  idempotencyKey: 120,
  title: 160,
  variantKey: 180,
  couponCode: 40,
  paymentProviderLabel: 80,
  paymentCurrency: 12,
  paymentCheckoutLabel: 180,
  paymentStatus: 40,
  storeCreditAccessToken: 2000,
};

function isBlank(v) {
  return v == null || String(v).trim() === '';
}

function trimTo(str, n) {
  const s = String(str || '').trim();
  return n ? s.slice(0, n) : s;
}

function toNumber(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function isPositiveInt(n) {
  return Number.isInteger(n) && n > 0;
}

function isNonNegative(n) {
  return Number.isFinite(n) && n >= 0;
}

function qtyOf(it) {
  const q = Number(it?.quantity ?? it?.qty ?? 0);
  return Number.isInteger(q) ? q : Math.floor(q);
}

function looksLikeObjectId(v) {
  const s = String(v || '');
  return /^[0-9a-fA-F]{24}$/.test(s);
}

function normalizeTags(arr) {
  const list = Array.isArray(arr) ? arr : String(arr || '').split(',');
  const norm = list
    .map((t) => trimTo(t, MAX_LEN.tag).toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean);

  return Array.from(new Set(norm)).slice(0, MAX_TAGS);
}

function normalizeCart(cart) {
  if (!Array.isArray(cart)) return [];

  const out = [];
  for (const raw of cart) {
    const pid = raw.productId || raw._id || raw.id;
    const quantity = qtyOf(raw);
    const price = toNumber(raw.price ?? raw.unitPrice ?? raw.priceNumber, 0);
    const title = trimTo(raw.title, MAX_LEN.title);

    out.push({
      productId: pid,
      title: title || undefined,
      price: isNonNegative(price) ? price : 0,
      quantity: isPositiveInt(quantity) ? quantity : 0,
      color: trimTo(raw.color, 40) || undefined,
      size: trimTo(raw.size, 40) || undefined,
      variantId:
        trimTo(
          raw.variantId || raw.variantKey || raw.selectedVariantId || raw.selectedVariantKey,
          MAX_LEN.variantKey
        ) || undefined,
      variantKey:
        trimTo(
          raw.variantKey || raw.variantId || raw.selectedVariantKey || raw.selectedVariantId,
          MAX_LEN.variantKey
        ) || undefined,
      variantLabel:
        trimTo(raw.variantLabel, 180) || undefined,
      variantAttributes: normalizeAttributes(
        raw.variantAttributes ||
          raw.attributes ||
          raw.selectedAttributes ||
          []
      ),
      image: trimTo(raw.image, 300) || undefined,
    });
  }

  return out.slice(0, MAX_CART_ITEMS);
}

function calcSubtotalFromCart(items) {
  let sub = 0;
  for (const it of items) {
    sub += (Number(it.price) || 0) * (Number(it.quantity) || 0);
  }
  return sub;
}

function normalizePayment(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};

  const provider = trimTo(p.provider, 40).toLowerCase();
  const mode = trimTo(p.mode, 20).toLowerCase();
  const status = trimTo(p.status, MAX_LEN.paymentStatus).toLowerCase();
  const currency = trimTo(p.currency, MAX_LEN.paymentCurrency).toUpperCase();

  return {
    active: p.active !== false,
    provider: PAYMENT_PROVIDERS.includes(provider) ? provider : '',
    providerLabel: trimTo(p.providerLabel, MAX_LEN.paymentProviderLabel) || undefined,
    mode: PAYMENT_MODES.includes(mode) ? mode : 'sandbox',
    currency: currency || 'COP',
    checkoutLabel: trimTo(p.checkoutLabel, MAX_LEN.paymentCheckoutLabel) || undefined,
    enableWebhook: !!p.enableWebhook,
    status: PAYMENT_STATUSES.includes(status) ? status : undefined,
  };
}

function normalizeStoreCredit(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const amount = toNumber(value.amount, 0);
  return {
    apply: value.apply === true,
    amount: isNonNegative(amount) ? amount : 0,
    accessToken:
      trimTo(value.accessToken, MAX_LEN.storeCreditAccessToken) || undefined,
  };
}

function normalizeCountryCode(value, fallback = '') {
  const raw = trimTo(value, MAX_LEN.country).toUpperCase();

  if (raw === 'COLOMBIA') return 'CO';
  if (/^[A-Z]{2,3}$/.test(raw)) return raw;

  return trimTo(fallback, MAX_LEN.countryCode).toUpperCase();
}

function normalizeDocumentNumber(value, documentType = '', dv = '') {
  const raw = trimTo(value, MAX_LEN.id);
  let normalized = raw.replace(/[.\-\s]/g, '');
  const safeDv = trimTo(dv, 1);

  if (
    String(documentType || '').toUpperCase() === 'NIT' &&
    /^\d$/.test(safeDv) &&
    new RegExp(`[-\s]${safeDv}$`).test(raw) &&
    normalized.endsWith(safeDv)
  ) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

module.exports = function validateOrderPayload(body) {
  const errors = [];

  const cleaned = {};
  cleaned.sessionId = trimTo(body.sessionId, 120) || undefined;

  // ---- cart
  cleaned.cart = normalizeCart(body.cart);

  if (cleaned.cart.length === 0) {
    errors.push('El carrito está vacío.');
  }

  if (cleaned.cart.some((it) => isBlank(it.productId))) {
    errors.push('Falta productId en algún ítem.');
  }

  if (cleaned.cart.some((it) => !looksLikeObjectId(it.productId) && isBlank(it.productId))) {
    errors.push('Algún productId es inválido.');
  }

  if (cleaned.cart.some((it) => !isPositiveInt(it.quantity))) {
    errors.push('Todas las cantidades deben ser enteros mayores a 0.');
  }

  if (cleaned.cart.some((it) => !isNonNegative(it.price))) {
    errors.push('Todos los precios deben ser números válidos (>= 0).');
  }

  // ---- montos
  const clientSubtotal = toNumber(body.subtotal, 0);
  const clientShipping = toNumber(body.shipping, 0);

  if (!isNonNegative(clientShipping)) {
    errors.push('El costo de envío debe ser mayor o igual a 0.');
  }

  const computedSubtotal = calcSubtotalFromCart(cleaned.cart);
  cleaned.subtotal = computedSubtotal;

  const TOL = 1;
  if (clientSubtotal > 0 && Math.abs(clientSubtotal - computedSubtotal) > TOL) {
    errors.push('El subtotal enviado no coincide con el calculado. Se usará el subtotal calculado.');
  }

  cleaned.shipping = Math.max(0, clientShipping);
  cleaned.total = cleaned.subtotal + cleaned.shipping;

  if (cleaned.subtotal <= 0) errors.push('El subtotal debe ser mayor a 0.');
  if (cleaned.total <= 0) errors.push('El total debe ser mayor a 0.');

  // ---- customer
  const c = body.customer || {};
  const deliveryType = c.deliveryType === 'retiro' ? 'retiro' : 'envio';

  cleaned.customer = {
    name: trimTo(c.name, MAX_LEN.name),
    lastname: trimTo(c.lastname, MAX_LEN.lastname),
    id: trimTo(c.id, MAX_LEN.id),
    documentType: trimTo(c.documentType, 20).toUpperCase() || undefined,
    emailOrPhone: trimTo(c.emailOrPhone || c.email || c.phone, MAX_LEN.emailOrPhone),
    email: trimTo(c.email, MAX_LEN.email) || undefined,
    phone: trimTo(c.phone, MAX_LEN.phone) || undefined,
    address: trimTo(c.address, MAX_LEN.address),
    city: trimTo(c.city, MAX_LEN.city),
    municipalityId: trimTo(c.municipalityId || c.municipality_id, MAX_LEN.municipalityId) || undefined,
    postalCode: trimTo(c.postalCode, MAX_LEN.postalCode) || undefined,
    country: trimTo(c.country, MAX_LEN.country),
    countryCode: normalizeCountryCode(c.countryCode || c.country) || undefined,
    department: trimTo(c.department, MAX_LEN.department) || undefined,
    departmentCode: trimTo(c.departmentCode || c.department, MAX_LEN.departmentCode) || undefined,
    deliveryType,
    wantsNewsletter: !!c.wantsNewsletter,
  };

  if (isBlank(cleaned.customer.name)) errors.push('El nombre es obligatorio.');
  if (isBlank(cleaned.customer.lastname)) errors.push('El apellido es obligatorio.');
  if (isBlank(cleaned.customer.emailOrPhone)) errors.push('Email o teléfono es obligatorio.');
  if (isBlank(cleaned.customer.id)) errors.push('La cédula es obligatoria.');

  if (deliveryType === 'envio') {
    if (isBlank(cleaned.customer.address)) errors.push('La dirección de envío es obligatoria.');
    if (isBlank(cleaned.customer.country)) errors.push('El país es obligatorio.');
    if (isBlank(cleaned.customer.city)) errors.push('La ciudad es obligatoria.');
  }

  // ---- billing
  const hasBillingBlock = !!body.billing && typeof body.billing === 'object';
  const b = hasBillingBlock ? body.billing : {};
  const useSameAddress = b.useSameAddress !== false;
  const personType = trimTo(b.personType, 20).toLowerCase() || 'natural';
  const documentType = trimTo(b.documentType || c.documentType, 20).toUpperCase() || 'CC';
  const documentNumber = normalizeDocumentNumber(
    b.documentNumber || b.identification || b.id || c.id,
    documentType,
    b.dv
  );
  const firstName = trimTo(b.firstName || b.name || c.name, MAX_LEN.name);
  const lastName = trimTo(b.lastName || b.lastname || c.lastname, MAX_LEN.lastname);
  const emailFromCustomer = looksLikeEmail(c.email)
    ? c.email
    : looksLikeEmail(c.emailOrPhone)
      ? c.emailOrPhone
      : '';
  const countryCode = normalizeCountryCode(
    b.countryCode || b.country,
    normalizeCountryCode(c.country)
  );
  const municipalityCode = trimTo(
    useSameAddress
      ? c.municipalityId || c.municipality_id || b.municipalityCode || b.cityCode
      : b.municipalityCode || b.cityCode || b.municipalityId,
    MAX_LEN.municipalityId
  );

  cleaned.billing = {
    useSameAddress,
    personType: BILLING_PERSON_TYPES.includes(personType) ? personType : '',
    documentType: BILLING_DOCUMENT_TYPES.includes(documentType) ? documentType : '',
    documentNumber,
    id: documentNumber,
    dv: documentType === 'NIT' ? trimTo(b.dv, 1) : '',
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: firstName || undefined,
    lastname: lastName || undefined,
    businessName: trimTo(b.businessName || b.company, MAX_LEN.businessName) || undefined,
    email: trimTo(b.email || emailFromCustomer, MAX_LEN.email).toLowerCase() || undefined,
    address: trimTo(useSameAddress ? c.address : b.address, MAX_LEN.address) || undefined,
    extra: trimTo(b.extra, MAX_LEN.billingExtra) || undefined,
    city: trimTo(useSameAddress ? c.city : b.city, MAX_LEN.city) || undefined,
    cityCode: municipalityCode || undefined,
    municipalityCode: municipalityCode || undefined,
    department: trimTo(
      useSameAddress ? b.department || c.department : b.department,
      MAX_LEN.department
    ) || undefined,
    departmentCode: trimTo(
      useSameAddress ? b.departmentCode || c.departmentCode || c.department : b.departmentCode,
      MAX_LEN.departmentCode
    ) || undefined,
    postalCode: trimTo(useSameAddress ? c.postalCode : b.postalCode, MAX_LEN.postalCode) || undefined,
    phone: trimTo(b.phone || c.phone, MAX_LEN.phone) || undefined,
    country: trimTo(b.countryName || (useSameAddress ? c.country : b.country), MAX_LEN.country) || undefined,
    countryCode,
    tributeCode: trimTo(b.tributeCode || 'ZZ', MAX_LEN.tributeCode).toUpperCase() || 'ZZ',
  };

  if (hasBillingBlock) {
    if (!BILLING_PERSON_TYPES.includes(personType)) {
      errors.push('El tipo de persona para facturación es inválido.');
    }

    if (!BILLING_DOCUMENT_TYPES.includes(documentType)) {
      errors.push('El tipo de documento para facturación es inválido.');
    }

    if (isBlank(documentNumber)) {
      errors.push('El número de documento para facturación es obligatorio.');
    }

    if (personType === 'juridica' && documentType !== 'NIT') {
      errors.push('Una persona jurídica debe identificarse con NIT.');
    }

    if (documentType === 'NIT' && !/^\d$/.test(String(cleaned.billing.dv || ''))) {
      errors.push('El DV del NIT es obligatorio y debe contener un solo dígito.');
    }

    if (personType === 'juridica' && isBlank(cleaned.billing.businessName)) {
      errors.push('La razón social es obligatoria para persona jurídica.');
    }

    if (personType === 'natural') {
      if (isBlank(firstName)) errors.push('El nombre para facturación es obligatorio.');
      if (isBlank(lastName)) errors.push('El apellido para facturación es obligatorio.');
    }

    if (!looksLikeEmail(cleaned.billing.email)) {
      errors.push('El correo electrónico para facturación no es válido.');
    }

    if (isBlank(cleaned.billing.address)) {
      errors.push('La dirección para facturación es obligatoria.');
    }

    if (isBlank(countryCode)) {
      errors.push('El país para facturación es obligatorio.');
    }

    if (countryCode === 'CO') {
      if (isBlank(cleaned.billing.department)) {
        errors.push('El departamento para facturación es obligatorio.');
      }
      if (isBlank(cleaned.billing.city)) {
        errors.push('La ciudad para facturación es obligatoria.');
      }
      if (isBlank(municipalityCode)) {
        errors.push('La ciudad para facturación debe tener un código DIAN válido.');
      }
    }
  }

  // ---- payment
  cleaned.payment = normalizePayment(body.payment);

  if (body.payment && typeof body.payment === 'object') {
    if (isBlank(cleaned.payment.provider)) {
      errors.push('El proveedor de pago es obligatorio.');
    }

    if (!PAYMENT_MODES.includes(cleaned.payment.mode)) {
      errors.push('El modo de pago es inválido.');
    }

    if (isBlank(cleaned.payment.currency)) {
      errors.push('La moneda del pago es obligatoria.');
    }
  }

  // ---- saldo a favor (el servidor vuelve a validar identidad y saldo)
  cleaned.storeCredit = normalizeStoreCredit(body.storeCredit);
  if (cleaned.storeCredit.apply) {
    if (cleaned.storeCredit.amount <= 0) {
      errors.push('El valor de saldo a favor debe ser mayor a cero.');
    }
    if (!/^sc1_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cleaned.storeCredit.accessToken || '')) {
      errors.push('Vuelve a comprobar el saldo a favor antes de utilizarlo.');
    }
  }

  // ---- tags (opcional)
  cleaned.tags = normalizeTags(body.tags);

  // ---- cupón (el servidor volverá a validarlo con precios vigentes)
  cleaned.couponCode = trimTo(
    body.couponCode || body?.coupon?.code || body.discountCode,
    MAX_LEN.couponCode
  )
    .toUpperCase()
    .replace(/\s+/g, '') || undefined;

  // ---- idempotency (opcional)
  cleaned.idempotencyKey = trimTo(body.idempotencyKey, MAX_LEN.idempotencyKey) || undefined;

  return { ok: errors.length === 0, errors, cleaned };
};
