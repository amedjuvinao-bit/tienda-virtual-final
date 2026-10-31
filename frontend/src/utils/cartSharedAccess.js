import {
  cartItemIdentity,
  normalizeCartSnapshot,
  isCartWriteConflict,
  writeVersionedCart,
} from './cartMutationConcurrency';
import { buildCartAccessHeaders } from './cartAccess';

// Older releases created one cart per tab. Unite those selections once, taking
// the larger quantity for a repeated variant rather than charging for duplicates.
export function mergeCartSelections(current, previous) {
  const rows = new Map(
    current.map((item) => [cartItemIdentity(item), { ...item }])
  );
  for (const item of previous) {
    const key = cartItemIdentity(item),
      existing = rows.get(key);
    const quantity = Math.max(
      Number(item.quantity ?? item.qty) || 0,
      Number(existing?.quantity ?? existing?.qty) || 0
    );
    rows.set(key, { ...item, ...existing, quantity, qty: quantity });
  }
  return [...rows.values()];
}

export async function readSharedCart({
  api,
  access,
  previousItems = [],
  previousSessionId,
  toBackendItem,
  normalizeItem = (item) => item,
}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await api.get(
      `/api/cart/${encodeURIComponent(access.sessionId)}`,
      { params: { populate: 1 }, headers: buildCartAccessHeaders(access) }
    );
    const current = normalizeCartSnapshot(response.data);
    if (!Array.isArray(response.data?.items) || !current.version)
      throw new Error('CART_SHARED_RESPONSE_INVALID');
    current.items = current.items.map(normalizeItem);
    if (
      !previousItems.length ||
      !previousSessionId ||
      previousSessionId === access.sessionId
    )
      return current;
    const merged = mergeCartSelections(current.items, previousItems);
    const quantities = new Map(
      current.items.map((item) => [
        cartItemIdentity(item),
        Number(item.quantity ?? item.qty),
      ])
    );
    const unchanged =
      merged.length === current.items.length &&
      merged.every(
        (item) =>
          quantities.get(cartItemIdentity(item)) ===
          Number(item.quantity ?? item.qty)
      );
    if (unchanged) return current;
    const { data } = await api.post('/api/cart/validate', {
      items: merged.map(toBackendItem),
      mode: 'soft',
    });
    if (!Array.isArray(data?.items))
      throw new Error('CART_SHARED_VALIDATION_INVALID');
    try {
      const written = await writeVersionedCart({
        api,
        access,
        version: current.version,
        items: data.items.filter(
          (item) => Number(item.qty ?? item.quantity) > 0
        ),
      });
      const snapshot = normalizeCartSnapshot(written.data);
      if (!Array.isArray(written.data?.cart?.items) || !snapshot.version)
        throw new Error('CART_SHARED_RESPONSE_INVALID');
      return snapshot;
    } catch (error) {
      if (!isCartWriteConflict(error) || attempt === 2) throw error;
    }
  }
}
