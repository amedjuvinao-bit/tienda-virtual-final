import { setSessionId } from '../lib/api';
import {
  CART_ACCESS_KEY,
  LEGACY_CART_ACCESS_TOKEN_KEY,
  readCartSession,
} from './cartSessionStorage';

function clean(value) {
  return String(value || '').trim();
}

export function getCartAccess() {
  const current = readCartSession();
  if (current) return current;
  try {
    // Migrate previous sessions once, then pin both values to this tab.
    const sessionId = clean(localStorage.getItem('session_id'));
    const token = clean(sessionStorage.getItem(LEGACY_CART_ACCESS_TOKEN_KEY));
    if (!sessionId || !token) return null;
    const access = { sessionId, token };
    sessionStorage.setItem(CART_ACCESS_KEY, JSON.stringify(access));
    try {
      sessionStorage.removeItem(LEGACY_CART_ACCESS_TOKEN_KEY);
    } catch {
      /* ignore */
    }
    return access;
  } catch {
    return null;
  }
}

export function storeCartAccess(sessionId, token) {
  const safeSessionId = clean(sessionId),
    safeToken = clean(token);
  if (!safeSessionId || !safeToken) return false;
  try {
    sessionStorage.setItem(
      CART_ACCESS_KEY,
      JSON.stringify({ sessionId: safeSessionId, token: safeToken })
    );
    // The new pair is already committed; legacy cleanup is best effort.
    try {
      sessionStorage.removeItem(LEGACY_CART_ACCESS_TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setSessionId(safeSessionId);
    return true;
  } catch {
    return false;
  }
}

export function clearCartAccess({ preserveSessionId = false } = {}) {
  const access = getCartAccess();
  try {
    sessionStorage.removeItem(CART_ACCESS_KEY);
    sessionStorage.removeItem(LEGACY_CART_ACCESS_TOKEN_KEY);
    if (
      !preserveSessionId &&
      localStorage.getItem('session_id') === access?.sessionId
    )
      setSessionId('');
  } catch {
    /* ignore */
  }
}

export function buildCartAccessHeaders(access = getCartAccess()) {
  if (!access?.sessionId || !access?.token) return {};
  return {
    'X-Session-Id': access.sessionId,
    'X-Cart-Access-Token': access.token,
  };
}
