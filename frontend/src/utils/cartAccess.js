import { setSessionId } from '../lib/api';
import { getSessionId } from './getSessionId';

const CART_ACCESS_TOKEN_KEY = 'cart_access_token';

function clean(value) {
  return String(value || '').trim();
}

export function getCartAccess() {
  try {
    const sessionId = clean(getSessionId());
    const token = clean(sessionStorage.getItem(CART_ACCESS_TOKEN_KEY));
    if (!sessionId || !token) return null;
    return { sessionId, token };
  } catch {
    return null;
  }
}

export function storeCartAccess(sessionId, token) {
  const safeSessionId = clean(sessionId);
  const safeToken = clean(token);
  if (!safeSessionId || !safeToken) return false;
  try {
    sessionStorage.setItem(CART_ACCESS_TOKEN_KEY, safeToken);
    setSessionId(safeSessionId);
    return true;
  } catch {
    return false;
  }
}

export function clearCartAccess({ preserveSessionId = false } = {}) {
  try {
    sessionStorage.removeItem(CART_ACCESS_TOKEN_KEY);
  } catch { /* ignore */ }
  if (!preserveSessionId) setSessionId('');
}

export function buildCartAccessHeaders(access = getCartAccess()) {
  if (!access?.sessionId || !access?.token) return {};
  return {
    'X-Session-Id': access.sessionId,
    'X-Cart-Access-Token': access.token,
  };
}
