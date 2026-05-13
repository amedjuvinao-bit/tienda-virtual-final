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

const MAX_CART_ITEMS = 200;
const MAX_TAGS = 20;
const PAYMENT_PROVIDERS = ['bold', 'wompi', 'mercado-pago', 'payu', 'manual'];
const PAYMENT_MODES = ['sandbox', 'production'];
const PAYMENT_STATUSES = ['pending_gateway', 'pending_manual', 'paid', 'failed', 'cancelled'];

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
  tag: 24,
  idempotencyKey: 120,
  title: 160,
  paymentProviderLabel: 80,
  paymentCurrency: 12,
  paymentCheckoutLabel: 180,
  paymentStatus: 40,
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
    emailOrPhone: trimTo(c.emailOrPhone || c.email || c.phone, MAX_LEN.emailOrPhone),
    phone: trimTo(c.phone, MAX_LEN.phone) || undefined,
    address: trimTo(c.address, MAX_LEN.address),
    city: trimTo(c.city, MAX_LEN.city),
    municipalityId: trimTo(c.municipalityId || c.municipality_id, MAX_LEN.municipalityId) || undefined,
    postalCode: trimTo(c.postalCode, MAX_LEN.postalCode) || undefined,
    country: trimTo(c.country, MAX_LEN.country),
    department: trimTo(c.department, MAX_LEN.department) || undefined,
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
  const b = body.billing || {};
  cleaned.billing = {
    useSameAddress: !!b.useSameAddress,
    name: trimTo(b.name, MAX_LEN.name) || undefined,
    lastname: trimTo(b.lastname, MAX_LEN.lastname) || undefined,
    id: trimTo(b.id, MAX_LEN.id) || undefined,
    address: trimTo(b.address, MAX_LEN.address) || undefined,
    extra: trimTo(b.extra, MAX_LEN.billingExtra) || undefined,
    city: trimTo(b.city, MAX_LEN.city) || undefined,
    department: trimTo(b.department, MAX_LEN.department) || undefined,
    postalCode: trimTo(b.postalCode, MAX_LEN.postalCode) || undefined,
    phone: trimTo(b.phone, MAX_LEN.phone) || undefined,
    country: trimTo(b.country, MAX_LEN.country) || undefined,
  };

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

  // ---- tags (opcional)
  cleaned.tags = normalizeTags(body.tags);

  // ---- idempotency (opcional)
  cleaned.idempotencyKey = trimTo(body.idempotencyKey, MAX_LEN.idempotencyKey) || undefined;

  return { ok: errors.length === 0, errors, cleaned };
};