export const FAVORITE_ACCESS_KEY = 'favorite_access';
const FAVORITE_SESSION_KEY = 'favorite_session_id';
const FAVORITE_ACCESS_TOKEN_KEY = 'favorite_access_token';
const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const safeAccess = (value) =>
  clean(value?.sessionId) && clean(value?.token)
    ? { sessionId: clean(value.sessionId), token: clean(value.token) }
    : null;
export function getFavoriteAccess() {
  try {
    const atomic = safeAccess(
      JSON.parse(localStorage.getItem(FAVORITE_ACCESS_KEY) || 'null')
    );
    if (atomic) return atomic;
    const legacy = safeAccess({
      sessionId: localStorage.getItem(FAVORITE_SESSION_KEY),
      token: localStorage.getItem(FAVORITE_ACCESS_TOKEN_KEY),
    });
    if (legacy && storeFavoriteAccess(legacy.sessionId, legacy.token))
      return legacy;
    return null;
  } catch {
    return null;
  }
}
export function storeFavoriteAccess(sessionId, token) {
  const access = safeAccess({ sessionId, token });
  if (!access) return false;
  try {
    localStorage.setItem(FAVORITE_ACCESS_KEY, JSON.stringify(access));
    try {
      localStorage.removeItem(FAVORITE_SESSION_KEY);
      localStorage.removeItem(FAVORITE_ACCESS_TOKEN_KEY);
    } catch {
      /* Atomic pair is already committed. */
    }
    return true;
  } catch {
    return false;
  }
}
export function clearFavoriteAccess() {
  try {
    localStorage.removeItem(FAVORITE_ACCESS_KEY);
    localStorage.removeItem(FAVORITE_SESSION_KEY);
    localStorage.removeItem(FAVORITE_ACCESS_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
export function buildFavoriteAccessHeaders(access = getFavoriteAccess()) {
  if (!access?.sessionId || !access?.token) return {};
  return {
    'X-Favorite-Session-Id': access.sessionId,
    'X-Favorite-Access-Token': access.token,
  };
}
export async function issueFavoriteAccess(api) {
  const { data } = await api.post('/api/favorites/access');
  const access = safeAccess({
    sessionId: data?.sessionId,
    token: data?.favoriteAccessToken,
  });
  if (!access) throw new Error('No fue posible iniciar favoritos.');
  return access;
}
let issuing;
export function withFavoriteLock(task) {
  return typeof navigator !== 'undefined' &&
    typeof navigator.locks?.request === 'function'
    ? navigator.locks.request('storefront-favorites', task)
    : task();
}
export async function ensureFavoriteAccess(api) {
  const existing = getFavoriteAccess();
  if (existing) return existing;
  if (!issuing)
    issuing = withFavoriteLock(async () => {
      const current = getFavoriteAccess();
      if (current) return current;
      const access = await issueFavoriteAccess(api);
      if (!storeFavoriteAccess(access.sessionId, access.token))
        throw new Error(
          'No fue posible conservar el acceso seguro a favoritos.'
        );
      return access;
    }).finally(() => {
      issuing = null;
    });
  return issuing;
}
