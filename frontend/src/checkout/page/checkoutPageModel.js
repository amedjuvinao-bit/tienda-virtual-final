export const EMPTY_STORE_CREDIT_PREVIEW = Object.freeze({
  status: 'idle',
  eligible: false,
  balance: 0,
  currency: 'COP',
  accessToken: '',
  message: '',
});

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function getFirstFiniteNumber(...values) {
  for (const value of values) {
    if (value == null || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function getItemQuantity(item) {
  return getFirstFiniteNumber(item?.quantity, item?.qty, item?.amount, 0);
}

export function getItemUnitPrice(item) {
  return getFirstFiniteNumber(
    item?.price,
    item?.unitPrice,
    item?.unit_price,
    item?.productPrice,
    item?.priceSnapshot,
    item?.salePrice,
    item?.finalPrice,
    item?.product?.price,
    item?.product?.unitPrice,
    0
  );
}

export function getItemLineTotal(item) {
  for (const value of [
    item?.lineTotal,
    item?.total,
    item?.subtotal,
    item?.amountTotal,
  ]) {
    if (value == null || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return getItemUnitPrice(item) * getItemQuantity(item);
}

export function getVariantDisplay(item = {}) {
  const explicitLabel = String(item.variantLabel || '').trim();
  if (explicitLabel) return explicitLabel;
  const attributes = Array.isArray(item.variantAttributes)
    ? item.variantAttributes
        .map((attribute) => String(attribute?.value || '').trim())
        .filter(Boolean)
    : [];
  return (
    attributes.join(' / ') ||
    [item.color, item.size].filter(Boolean).join(' / ')
  );
}

export function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizePaymentProvider(value) {
  const safe = String(value || '')
    .trim()
    .toLowerCase();
  const allowed = ['bold', 'wompi', 'mercado-pago', 'payu', 'manual'];
  return allowed.includes(safe) ? safe : '';
}

export function buildSafePaymentsConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  const provider = normalizePaymentProvider(cfg.provider);
  return {
    active: cfg.active !== false,
    provider,
    mode: cfg.mode === 'production' ? 'production' : 'sandbox',
    currency:
      typeof cfg.currency === 'string' && cfg.currency.trim()
        ? cfg.currency.trim().toUpperCase()
        : 'COP',
    checkoutLabel:
      typeof cfg.checkoutLabel === 'string' && cfg.checkoutLabel.trim()
        ? cfg.checkoutLabel.trim()
        : '',
    successMessage:
      typeof cfg.successMessage === 'string' && cfg.successMessage.trim()
        ? cfg.successMessage.trim()
        : '',
    enableWebhook: cfg.enableWebhook === true,
    credentials:
      cfg.credentials && typeof cfg.credentials === 'object'
        ? cfg.credentials
        : {},
  };
}

export function getPaymentProviderMeta(provider) {
  switch (provider) {
    case 'bold':
      return {
        label: 'Bold',
        checkoutMessage:
          'Después de hacer clic en el botón de pago, serás redirigido a Bold para completar tu compra de forma segura.',
      };
    case 'wompi':
      return {
        label: 'Wompi',
        checkoutMessage:
          'Después de hacer clic en el botón de pago, se abrirá Wompi para completar tu compra de forma segura.',
      };
    case 'mercado-pago':
      return {
        label: 'Mercado Pago',
        checkoutMessage:
          'Después de hacer clic en el botón de pago, serás redirigido a Mercado Pago para completar tu compra de forma segura.',
      };
    case 'payu':
      return {
        label: 'PayU',
        checkoutMessage:
          'Después de hacer clic en el botón de pago, serás redirigido a PayU para completar tu compra de forma segura.',
      };
    case 'manual':
      return {
        label: 'Pago manual',
        checkoutMessage:
          'Después de confirmar tu pedido, verás las instrucciones para completar el pago manualmente según la configuración de la tienda.',
      };
    default:
      return {
        label: 'Proveedor no configurado',
        checkoutMessage:
          'La tienda aún no tiene una pasarela de pago configurada correctamente.',
      };
  }
}

export { buildSafeCheckoutPageConfig } from './checkoutPageConfig';
