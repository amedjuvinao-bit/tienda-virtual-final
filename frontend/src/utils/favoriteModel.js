import variantKeyAuthority from '@shared/variant-key-authority';
const clean = (value) =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
export function normalizeFavoriteItem(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { productId: '', variantKey: '', variantAttributes: [] };
  const product =
    typeof raw.productId === 'object'
      ? raw.productId
      : typeof raw.product === 'object'
        ? raw.product
        : {};
  const productId = clean(
    product?._id ||
      raw.productId ||
      raw.product?._id ||
      raw.product ||
      raw._id ||
      raw.id
  );
  let identity;
  try {
    identity = variantKeyAuthority.resolveVariantIdentity({
      variantKey:
        raw.variantKey ||
        raw.variantId ||
        raw.selectedVariantKey ||
        raw.selectedVariantId,
      size: raw.size,
      color: raw.colorValue || raw.color,
      attributes:
        raw.variantAttributes || raw.attributes || raw.selectedAttributes || [],
    });
  } catch {
    return { productId: '', variantKey: '', variantAttributes: [] };
  }
  const image = [
    raw.image,
    raw.img,
    raw.cover,
    raw.images?.[0],
    product?.image,
  ].find((value) => typeof value === 'string' && value.trim());
  return {
    productId,
    variantKey: identity.variantKey,
    variantAttributes: identity.attributes,
    color: identity.color,
    size: identity.size,
    variantLabel: clean(raw.variantLabel || raw.selectedVariant?.label),
    title: clean(raw.title || raw.name || product?.title) || 'Producto',
    image: clean(image),
    price: Math.max(0, Number(raw.price ?? product?.price) || 0),
    slug: clean(raw.slug || product?.slug),
    sku: clean(raw.sku || product?.sku),
    category: clean(raw.category || product?.category),
    ...(raw.current ? { current: raw.current } : {}),
    ...(Array.isArray(raw.alerts) ? { alerts: raw.alerts } : {}),
  };
}
export const favoriteKey = (raw) => {
  const item = normalizeFavoriteItem(raw);
  return `${item.productId}|${item.variantKey}`;
};
export function normalizeFavorites(list) {
  const result = new Map();
  for (const raw of Array.isArray(list) ? list.slice(0, 200) : []) {
    const item = normalizeFavoriteItem(raw);
    if (item.productId && !result.has(favoriteKey(item)))
      result.set(favoriteKey(item), item);
  }
  return [...result.values()];
}
export function applyFavoriteOperation(items, operation) {
  const key = favoriteKey(operation.item);
  if (operation.type === 'remove')
    return items.filter((item) => favoriteKey(item) !== key);
  return items.some((item) => favoriteKey(item) === key)
    ? items
    : [...items, operation.item];
}
export const applyFavoriteOperations = (items, operations) =>
  operations.reduce(applyFavoriteOperation, normalizeFavorites(items));
