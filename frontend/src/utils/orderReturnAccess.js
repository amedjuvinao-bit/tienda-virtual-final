const ORDER_RETURN_ACCESS_KEY = 'order_return_access_v1';

function clean(value) {
  return String(value || '').trim();
}

function normalize(value) {
  const source = value && typeof value === 'object' ? value : {};
  const orderId = clean(source.orderId);
  const token = clean(source.token);
  const expiresAt = clean(source.expiresAt);
  const expiry = new Date(expiresAt).getTime();
  if (!orderId || !token || !Number.isFinite(expiry)) return null;
  return { orderId, token, expiresAt };
}

export function storeOrderReturnAccess(value) {
  const access = normalize(value);
  if (!access || new Date(access.expiresAt).getTime() <= Date.now()) return false;
  try {
    localStorage.setItem(ORDER_RETURN_ACCESS_KEY, JSON.stringify(access));
    return true;
  } catch {
    return false;
  }
}

export function getOrderReturnAccess(orderId) {
  const requestedOrderId = clean(orderId);
  if (!requestedOrderId) return null;
  try {
    const access = normalize(
      JSON.parse(localStorage.getItem(ORDER_RETURN_ACCESS_KEY) || 'null')
    );
    if (
      !access ||
      access.orderId !== requestedOrderId ||
      new Date(access.expiresAt).getTime() <= Date.now()
    ) {
      if (access && new Date(access.expiresAt).getTime() <= Date.now()) {
        localStorage.removeItem(ORDER_RETURN_ACCESS_KEY);
      }
      return null;
    }
    return access;
  } catch {
    return null;
  }
}

export function buildOrderReturnAccessHeaders(access) {
  const safe = normalize(access);
  if (!safe || new Date(safe.expiresAt).getTime() <= Date.now()) return {};
  return { 'X-Order-Return-Token': safe.token };
}

export function clearOrderReturnAccess(orderId = '') {
  try {
    const requestedOrderId = clean(orderId);
    const current = normalize(
      JSON.parse(localStorage.getItem(ORDER_RETURN_ACCESS_KEY) || 'null')
    );
    if (!requestedOrderId || !current || current.orderId === requestedOrderId) {
      localStorage.removeItem(ORDER_RETURN_ACCESS_KEY);
    }
  } catch {
    try { localStorage.removeItem(ORDER_RETURN_ACCESS_KEY); } catch { /* ignore */ }
  }
}
