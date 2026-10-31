// Keep the capability and its cart identifier in one tab-scoped record. A shared
// localStorage identifier must never be paired with another tab's access token.
export const CART_ACCESS_KEY = 'cart_access';
export const LEGACY_CART_ACCESS_TOKEN_KEY = 'cart_access_token';

export function readCartSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(CART_ACCESS_KEY) || 'null');
    const sessionId =
      typeof value?.sessionId === 'string' ? value.sessionId.trim() : '';
    const token = typeof value?.token === 'string' ? value.token.trim() : '';
    return sessionId && token ? { sessionId, token } : null;
  } catch {
    return null;
  }
}
