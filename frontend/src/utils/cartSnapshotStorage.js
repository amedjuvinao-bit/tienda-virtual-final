const CART_SNAPSHOT_KEY = 'cart_snapshot';
const itemsOf = (value) =>
  Array.isArray(value) ? value.filter((item) => item && item._id) : [];

export function readCartSnapshot(sessionId) {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(CART_SNAPSHOT_KEY) || 'null'
    );
    return sessionId &&
      saved?.sessionId === sessionId &&
      Array.isArray(saved.items)
      ? itemsOf(saved.items)
      : null;
  } catch {
    return null;
  }
}

export function storeCartSnapshot(sessionId, items) {
  if (!sessionId) return;
  try {
    sessionStorage.setItem(
      CART_SNAPSHOT_KEY,
      JSON.stringify({ sessionId, items: itemsOf(items) })
    );
  } catch {
    /* The live cart remains available if browser storage is full. */
  }
}
