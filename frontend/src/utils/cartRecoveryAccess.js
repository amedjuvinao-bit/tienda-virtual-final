function clean(value) {
  return String(value || '').trim();
}

export function readCartRecoveryFragment(locationLike = window.location) {
  const raw = clean(locationLike?.hash).replace(/^#/, '');
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const sessionId = clean(params.get('cart'));
  const recoveryToken = clean(params.get('recovery'));
  if (!/^cart_[A-Za-z0-9_-]{32,100}$/.test(sessionId)) return null;
  if (!/^cr1_[A-Za-z0-9_-]{40,100}\.[A-Za-z0-9_-]{40,100}$/.test(recoveryToken)) {
    return null;
  }
  return { sessionId, recoveryToken };
}

export function clearCartRecoveryFragment(
  locationLike = window.location,
  historyLike = window.history
) {
  const cleanUrl = `${locationLike.pathname || '/carrito'}${locationLike.search || ''}`;
  historyLike.replaceState(null, '', cleanUrl);
}

export function buildCartRecoveryHeaders(access) {
  return {
    'X-Session-Id': clean(access?.sessionId),
    'X-Cart-Recovery-Token': clean(access?.recoveryToken),
  };
}
