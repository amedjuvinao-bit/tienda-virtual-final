const FAVORITE_SESSION_KEY = 'favorite_session_id';
const FAVORITE_ACCESS_TOKEN_KEY = 'favorite_access_token';

function clean(value) {
  return String(value || '').trim();
}

export function getFavoriteAccess() {
  try {
    const sessionId = clean(localStorage.getItem(FAVORITE_SESSION_KEY));
    const token = clean(localStorage.getItem(FAVORITE_ACCESS_TOKEN_KEY));
    return sessionId && token ? { sessionId, token } : null;
  } catch {
    return null;
  }
}

export function storeFavoriteAccess(sessionId, token) {
  const safeSessionId = clean(sessionId);
  const safeToken = clean(token);
  if (!safeSessionId || !safeToken) return false;
  try {
    localStorage.setItem(FAVORITE_SESSION_KEY, safeSessionId);
    localStorage.setItem(FAVORITE_ACCESS_TOKEN_KEY, safeToken);
    return true;
  } catch {
    return false;
  }
}

export function clearFavoriteAccess() {
  try {
    localStorage.removeItem(FAVORITE_SESSION_KEY);
    localStorage.removeItem(FAVORITE_ACCESS_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function buildFavoriteAccessHeaders(access = getFavoriteAccess()) {
  if (!access?.sessionId || !access?.token) return {};
  return {
    'X-Favorite-Session-Id': access.sessionId,
    'X-Favorite-Access-Token': access.token,
  };
}

export async function ensureFavoriteAccess(api) {
  const existing = getFavoriteAccess();
  if (existing) return existing;
  const { data } = await api.post('/api/favorites/access');
  const access = {
    sessionId: clean(data?.sessionId),
    token: clean(data?.favoriteAccessToken),
  };
  if (!storeFavoriteAccess(access.sessionId, access.token)) {
    throw new Error('No fue posible conservar el acceso seguro a favoritos.');
  }
  return access;
}
