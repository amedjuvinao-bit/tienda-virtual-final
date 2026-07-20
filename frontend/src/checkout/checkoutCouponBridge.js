// frontend/src/checkout/checkoutCouponBridge.js
import api from '../lib/api';
import { getSessionId } from '../utils/getSessionId';

const STORAGE_KEY = 'rb_checkout_coupon_applied';

function moneySafe(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function readStoredCoupon() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredCoupon(value) {
  try {
    if (!value) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function readCart() {
  try {
    const rows = JSON.parse(localStorage.getItem('cart') || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function getItemQuantity(item = {}) {
  return moneySafe(item.quantity ?? item.qty ?? item.amount, 0);
}

function getItemUnitPrice(item = {}) {
  return moneySafe(
    item.price ??
      item.unitPrice ??
      item.priceNumber ??
      item.finalPrice ??
      item.product?.price,
    0
  );
}

function getItemLineTotal(item = {}) {
  const explicit = Number(item.lineTotal ?? item.total ?? item.subtotal ?? NaN);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return getItemQuantity(item) * getItemUnitPrice(item);
}

function normalizeCartItem(item = {}) {
  return {
    productId: String(item.productId || item._id || item.id || item.product?._id || '').trim(),
    title: item.title || item.product?.title || '',
    image: item.image || item.product?.image || '',
    color: item.color || '',
    size: item.size || '',
    quantity: getItemQuantity(item),
    price: getItemUnitPrice(item),
    category: item.category || item.product?.category || '',
    categories: Array.isArray(item.categories) ? item.categories : item.product?.categories || [],
  };
}

function getCartForCoupon() {
  return readCart()
    .map(normalizeCartItem)
    .filter((item) => item.productId && item.quantity > 0);
}

function getCartSubtotal(items = []) {
  return items.reduce((sum, item) => sum + getItemLineTotal(item), 0);
}

function parseMoneyFromText(text = '') {
  const clean = String(text || '')
    .replace(/COP/gi, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9.,-]/g, '');

  if (!clean || /^gratis$/i.test(clean)) return 0;

  const normalized = clean.includes(',') && clean.includes('.')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean.replace(/\./g, '');

  const number = Number(normalized);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function formatMoney(value) {
  return `$${Math.round(moneySafe(value, 0)).toLocaleString('es-CO')}`;
}

function findDiscountRow() {
  return document.querySelector('.co-discount-row');
}

function findDiscountInput() {
  const row = findDiscountRow();
  return row?.querySelector('input[name="discountCode"], input[type="text"]') || null;
}

function findShippingAmount() {
  const rows = Array.from(document.querySelectorAll('.co-totals-row'));
  const row = rows.find((item) => /env[ií]o/i.test(item.textContent || ''));
  if (!row) return 0;
  const spans = row.querySelectorAll('span');
  const valueText = spans[spans.length - 1]?.textContent || '';
  if (/gratis/i.test(valueText)) return 0;
  return parseMoneyFromText(valueText);
}

function removeCouponVisualRows() {
  document.querySelectorAll('.co-coupon-bridge-row, .co-coupon-bridge-message').forEach((node) => {
    node.remove();
  });
}

function renderMessage(message, type = 'info') {
  const row = findDiscountRow();
  if (!row) return;

  let box = document.querySelector('.co-coupon-bridge-message');
  if (!box) {
    box = document.createElement('div');
    box.className = 'co-coupon-bridge-message';
    row.insertAdjacentElement('afterend', box);
  }

  const isError = type === 'error';
  box.textContent = message;
  box.style.marginTop = '8px';
  box.style.fontSize = '12px';
  box.style.fontWeight = '600';
  box.style.color = isError ? '#be123c' : '#047857';
}

function renderCouponTotals(validation) {
  removeCouponVisualRows();

  const totals = validation?.totals || {};
  const coupon = validation?.coupon || {};
  const discountAmount = moneySafe(totals.discountAmount, 0);
  const shippingDiscountAmount = moneySafe(totals.shippingDiscountAmount, 0);
  const totalDiscountAmount = moneySafe(totals.totalDiscountAmount, 0);

  renderMessage(validation?.message || 'Cupón aplicado correctamente.', 'success');

  const totalsBox = document.querySelector('.co-totals');
  if (!totalsBox || totalDiscountAmount <= 0) return;

  const totalRow = Array.from(totalsBox.querySelectorAll('.co-totals-row'))
    .find((row) => row.classList.contains('co-totals-total'));

  const totalDivider = totalRow?.previousElementSibling?.classList?.contains('co-totals-divider')
    ? totalRow.previousElementSibling
    : totalRow;

  function insertRow(label, value) {
    if (!value || value <= 0 || !totalDivider) return;
    const row = document.createElement('div');
    row.className = 'co-totals-row co-coupon-bridge-row';
    row.innerHTML = `
      <span style="color:#047857">${label}</span>
      <span style="font-weight:600;color:#047857">-${formatMoney(value)}</span>
    `;
    totalsBox.insertBefore(row, totalDivider);
  }

  insertRow(`Cupón ${coupon.code || ''}`, discountAmount);
  insertRow('Descuento de envío', shippingDiscountAmount);

  const shippingRow = Array.from(totalsBox.querySelectorAll('.co-totals-row'))
    .find((row) => /env[ií]o/i.test(row.textContent || ''));

  if (shippingRow && shippingDiscountAmount > 0) {
    const spans = shippingRow.querySelectorAll('span');
    const last = spans[spans.length - 1];
    if (last) {
      const originalShipping = moneySafe(totals.shippingAmount, findShippingAmount());
      const finalShipping = Math.max(0, originalShipping - shippingDiscountAmount);
      last.textContent = finalShipping === 0 ? 'Gratis' : formatMoney(finalShipping);
    }
  }

  if (totalRow) {
    const spans = totalRow.querySelectorAll('span');
    const last = spans[spans.length - 1];
    if (last) {
      const currency = /COP/i.test(last.textContent || '') ? 'COP ' : '';
      last.textContent = `${currency}${formatMoney(totals.totalAfterDiscount)}`;
    }
  }
}

async function applyCouponFromCheckout() {
  const input = findDiscountInput();
  const code = String(input?.value || '').trim().toUpperCase();

  if (!code) {
    writeStoredCoupon(null);
    removeCouponVisualRows();
    renderMessage('Ingresa un código de descuento.', 'error');
    return;
  }

  const row = findDiscountRow();
  const button = row?.querySelector('.co-btn-secondary');
  const originalButtonText = button?.textContent || 'Aplicar';

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Aplicando...';
    }

    const items = getCartForCoupon();
    const subtotal = getCartSubtotal(items);
    const shippingAmount = findShippingAmount();

    const response = await api.post('/api/coupons/validate', {
      code,
      subtotal,
      shippingAmount,
      items,
      customerEmail: '',
      sessionId: getSessionId(),
    });

    const validation = response?.data?.data || response?.data || null;

    if (!validation?.valid) {
      writeStoredCoupon(null);
      removeCouponVisualRows();
      renderMessage(validation?.message || 'El cupón no es válido.', 'error');
      return;
    }

    writeStoredCoupon({
      code: validation.coupon?.code || code,
      couponId: validation.coupon?._id || validation.coupon?.id || '',
      validation,
    });

    if (input) input.value = validation.coupon?.code || code;
    renderCouponTotals(validation);
  } catch (error) {
    writeStoredCoupon(null);
    removeCouponVisualRows();
    renderMessage(
      error?.response?.data?.message ||
        error?.response?.data?.details?.message ||
        error?.userMessage ||
        'No se pudo validar el cupón.',
      'error'
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalButtonText;
    }
  }
}

function installCouponClickHandler() {
  if (typeof document === 'undefined') return;

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('.co-discount-row .co-btn-secondary');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    applyCouponFromCheckout();
  });

  document.addEventListener('input', (event) => {
    const input = event.target?.closest?.('.co-discount-row input[name="discountCode"]');
    if (!input) return;
    const stored = readStoredCoupon();
    if (stored && String(input.value || '').trim().toUpperCase() !== stored.code) {
      writeStoredCoupon(null);
      removeCouponVisualRows();
    }
  });
}

function installOrderRequestInterceptor() {
  api.interceptors.request.use((config) => {
    const method = String(config.method || 'get').toLowerCase();
    const url = String(config.url || '');

    if (method !== 'post') return config;
    if (!(url === '/api/orders' || url.endsWith('/api/orders') || url === '/orders' || url.endsWith('/orders'))) {
      return config;
    }

    const stored = readStoredCoupon();
    if (!stored?.code || !config.data || typeof config.data !== 'object') return config;

    config.data = {
      ...config.data,
      couponCode: stored.code,
      coupon: {
        code: stored.code,
        couponId: stored.couponId || '',
      },
    };

    return config;
  });
}

installCouponClickHandler();
installOrderRequestInterceptor();
