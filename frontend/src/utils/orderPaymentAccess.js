const ORDER_PAYMENT_ACCESS_KEY = 'order_payment_access_v1';

function clean(value) {
  return String(value || '').trim();
}

function normalize(value) {
  const source = value && typeof value === 'object' ? value : {};
  const orderId = clean(source.orderId);
  const sessionId = clean(source.sessionId);
  const token = clean(source.token);
  const expiresAt = clean(source.expiresAt);
  const expiry = new Date(expiresAt).getTime();
  if (!orderId || !sessionId || !token || !Number.isFinite(expiry)) return null;
  return { orderId, sessionId, token, expiresAt };
}

export function storeOrderPaymentAccess(value) {
  const access = normalize(value);
  if (!access || new Date(access.expiresAt).getTime() <= Date.now()) return false;
  try {
    sessionStorage.setItem(ORDER_PAYMENT_ACCESS_KEY, JSON.stringify(access));
    return true;
  } catch {
    return false;
  }
}

export function getOrderPaymentAccess(orderId) {
  const requestedOrderId = clean(orderId);
  if (!requestedOrderId) return null;
  try {
    const access = normalize(
      JSON.parse(sessionStorage.getItem(ORDER_PAYMENT_ACCESS_KEY) || 'null')
    );
    if (
      !access ||
      access.orderId !== requestedOrderId ||
      new Date(access.expiresAt).getTime() <= Date.now()
    ) {
      if (access && new Date(access.expiresAt).getTime() <= Date.now()) {
        sessionStorage.removeItem(ORDER_PAYMENT_ACCESS_KEY);
      }
      return null;
    }
    return access;
  } catch {
    return null;
  }
}

export function buildOrderPaymentAccessHeaders(access) {
  const safe = normalize(access);
  if (!safe || new Date(safe.expiresAt).getTime() <= Date.now()) return {};
  return {
    'X-Session-Id': safe.sessionId,
    'X-Order-Access-Token': safe.token,
  };
}

export function clearOrderPaymentAccess(orderId = '') {
  try {
    const requestedOrderId = clean(orderId);
    const current = normalize(
      JSON.parse(sessionStorage.getItem(ORDER_PAYMENT_ACCESS_KEY) || 'null')
    );
    if (!requestedOrderId || !current || current.orderId === requestedOrderId) {
      sessionStorage.removeItem(ORDER_PAYMENT_ACCESS_KEY);
    }
  } catch {
    try { sessionStorage.removeItem(ORDER_PAYMENT_ACCESS_KEY); } catch { /* ignore */ }
  }
}
