export function cartVariantLabel(item = {}, config = {}) {
  if (String(item.variantLabel || "").trim()) return item.variantLabel;
  const attributes = (
    Array.isArray(item.variantAttributes) ? item.variantAttributes : []
  ).map((attribute) =>
    [attribute.label || attribute.key, attribute.value]
      .filter(Boolean)
      .join(": "),
  );
  return (
    attributes.join(" · ") ||
    [item.color, item.size].filter(Boolean).join(" / ") ||
    config.generalVariantText
  );
}
export const money = (value) =>
  `$${(Number.isFinite(Number(value)) ? Number(value) : 0).toLocaleString("es-CO")}`;
export const cartItemKey = (item) =>
  `${item._id || item.productId}|${item.variantKey || item.variantId || `${item.color || ""}|${item.size || ""}`}`;
export const cartSubtotal = (items) =>
  items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0,
  );
export const canCheckout = (items) =>
  items.length > 0 &&
  items.every(
    (item) => Number(item.quantity) > 0 && item.purchasable !== false,
  );
