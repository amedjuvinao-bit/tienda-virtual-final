import {
  getColorDisplayName,
  getColorVisualValue,
} from "../../utils/colorDisplay";
import variantKeyAuthority from "@shared/variant-key-authority";
const { buildVariantKey, canonicalizeVariantKey } = variantKeyAuthority;
export { buildVariantKey };

function clean(value) {
  return String(value || "").trim();
}

function cleanLower(value) {
  return clean(value).toLowerCase();
}

function normalizeAttributeKey(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueStrings(values = []) {
  const out = [];
  const seen = new Set();

  values.forEach((value) => {
    const text = clean(value);
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });

  return out;
}

function normalizeImages(product = {}) {
  const list = [];

  if (clean(product.image)) list.push(clean(product.image));

  if (Array.isArray(product.images)) {
    product.images.forEach((img) => {
      if (clean(img)) list.push(clean(img));
    });
  }

  if (clean(product?.images?.cover)) list.push(clean(product.images.cover));

  if (Array.isArray(product?.images?.gallery)) {
    product.images.gallery.forEach((img) => {
      if (clean(img)) list.push(clean(img));
    });
  }

  return uniqueStrings(list);
}

export function normalizeVariantAttributes(attributes = []) {
  const normalized = [];
  const seen = new Set();

  (Array.isArray(attributes) ? attributes : []).forEach((attribute) => {
    const label = clean(attribute?.label || attribute?.name || attribute?.key);
    const key = normalizeAttributeKey(
      attribute?.key || attribute?.name || label,
    );
    const value = clean(attribute?.value);
    if (!key || !value || seen.has(key) || normalized.length >= 4) return;
    seen.add(key);
    normalized.push({ key, label: label || key, value });
  });

  return normalized;
}

function normalizeVariantAxes(product = {}) {
  const axes = [];
  const seen = new Set();

  (Array.isArray(product.variantAxes) ? product.variantAxes : []).forEach(
    (axis) => {
      const label = clean(axis?.label || axis?.name || axis?.key);
      const key = normalizeAttributeKey(axis?.key || axis?.name || label);
      const values = uniqueStrings(
        Array.isArray(axis?.values) ? axis.values : [],
      );
      if (!key || !label || seen.has(key) || axes.length >= 4) return;
      seen.add(key);
      axes.push({ key, label, values });
    },
  );

  return axes;
}

function findAttributeValue(attributes = [], key = "") {
  const normalizedKey = normalizeAttributeKey(key);
  return clean(
    normalizeVariantAttributes(attributes).find(
      (attribute) => attribute.key === normalizedKey,
    )?.value,
  );
}

export function resolveCanonicalColor(product = {}, selectedColor = "") {
  const selectedKey = cleanLower(selectedColor);
  if (!selectedKey) return "";

  const rawColors = Array.isArray(product?.colors) ? product.colors : [];
  const match = rawColors.find((rawColor) => {
    return (
      cleanLower(rawColor) === selectedKey ||
      cleanLower(getColorDisplayName(rawColor)) === selectedKey
    );
  });

  return clean(match ? getColorVisualValue(match) : selectedColor);
}

function normalizeVariant(product = {}, variant = {}, index = 0, axes = []) {
  const size = clean(variant.size || variant.talla || variant.attribute || "");
  const rawColor = clean(
    getColorVisualValue(
      variant.color || variant.colour || variant.visualAttribute || "",
    ),
  );
  const colorLabel = getColorDisplayName(rawColor);
  const colorValue = getColorVisualValue(rawColor);
  let attributes = normalizeVariantAttributes(
    variant.attributes || variant.variantAttributes,
  );

  if (!attributes.length) {
    const legacyAttributes = [];
    axes.forEach((axis) => {
      if (["size", "talla", "presentacion"].includes(axis.key) && size) {
        legacyAttributes.push({
          key: axis.key,
          label: axis.label,
          value: size,
        });
      }
      if (["color", "colour", "tono"].includes(axis.key) && rawColor) {
        legacyAttributes.push({
          key: axis.key,
          label: axis.label,
          value: rawColor,
        });
      }
    });
    attributes = normalizeVariantAttributes(legacyAttributes);
  }

  const variantKey =
    canonicalizeVariantKey(variant.variantKey) ||
    buildVariantKey(size, rawColor, attributes);
  const images = uniqueStrings([
    clean(variant.image),
    ...(Array.isArray(variant.images) ? variant.images : []),
  ]);

  const price =
    variant.price === null ||
    variant.price === undefined ||
    variant.price === ""
      ? null
      : Number(variant.price);
  const cost =
    variant.cost === null || variant.cost === undefined || variant.cost === ""
      ? null
      : Number(variant.cost);
  const originalPrice =
    variant.originalPrice === null ||
    variant.originalPrice === undefined ||
    variant.originalPrice === ""
      ? null
      : Number(variant.originalPrice);
  const availableStock =
    variant.availableStock === null || variant.availableStock === undefined
      ? null
      : Math.max(0, Number(variant.availableStock) || 0);

  const labelParts = attributes.length
    ? attributes.map((attribute) =>
        ["color", "colour", "tono"].includes(attribute.key)
          ? getColorDisplayName(attribute.value)
          : attribute.value,
      )
    : [size, colorLabel].filter(Boolean);
  const explicitLabel = clean(variant.label);

  return {
    ...variant,
    attributes,
    variantAttributes: attributes,
    variantKey,
    variantId: clean(variant.variantId || variantKey),
    label:
      explicitLabel && explicitLabel !== "Variante general"
        ? explicitLabel
        : labelParts.length
          ? labelParts.join(" / ")
          : "Variante general",
    size,
    color: colorLabel || rawColor,
    colorLabel: colorLabel || rawColor,
    colorValue: colorValue || rawColor,
    rawColor,
    sku: clean(
      variant.sku || variant.variantSku || product.sku || "",
    ).toUpperCase(),
    barcode: clean(
      variant.barcode || variant.variantBarcode || product.barcode || "",
    ),
    price: Number.isFinite(price) && price >= 0 ? price : null,
    cost: Number.isFinite(cost) && cost >= 0 ? cost : null,
    originalPrice:
      Number.isFinite(originalPrice) && originalPrice > 0
        ? originalPrice
        : null,
    image: images[0] || "",
    images,
    active: variant.active !== false,
    availableStock,
    sortOrder: Number.isFinite(Number(variant.sortOrder))
      ? Number(variant.sortOrder)
      : index,
  };
}

export function decorateProductForPublic(product) {
  if (!product) return product;

  let variantAxes = normalizeVariantAxes(product);
  if (!variantAxes.length) {
    const fallbackAxes = [];
    if (
      (product.sizes || []).length ||
      (product.variants || []).some((variant) => clean(variant?.size))
    ) {
      fallbackAxes.push({ key: "size", label: "Talla", values: [] });
    }
    if (
      (product.colors || []).length ||
      (product.variants || []).some((variant) => clean(variant?.color))
    ) {
      fallbackAxes.push({ key: "color", label: "Color", values: [] });
    }
    variantAxes = fallbackAxes;
  }

  const variants = Array.isArray(product.variants)
    ? product.variants
        .map((variant, index) =>
          normalizeVariant(product, variant, index, variantAxes),
        )
        .filter((variant) => variant.active !== false)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    : [];

  variantAxes = variantAxes.map((axis) => ({
    ...axis,
    values: uniqueStrings([
      ...axis.values,
      ...variants.map((variant) =>
        findAttributeValue(variant.attributes, axis.key),
      ),
    ]),
  }));

  const baseSizes = Array.isArray(product.sizes) ? product.sizes : [];
  const variantSizes = variants.map((variant) => variant.size).filter(Boolean);
  const sizes = uniqueStrings([...baseSizes, ...variantSizes]);

  const rawColors = Array.isArray(product.colors) ? product.colors : [];
  const colorLabels = rawColors
    .map((color) => getColorDisplayName(color))
    .filter(Boolean);
  const variantColorLabels = variants
    .map((variant) => variant.colorLabel || variant.color)
    .filter(Boolean);
  const colors = uniqueStrings([...colorLabels, ...variantColorLabels]);

  const colorOptions = uniqueStrings([
    ...rawColors.map((color) => getColorDisplayName(color)),
    ...variantColorLabels,
  ]).map((label) => {
    const variant = variants.find(
      (item) => cleanLower(item.colorLabel || item.color) === cleanLower(label),
    );
    const raw = rawColors.find(
      (color) => cleanLower(getColorDisplayName(color)) === cleanLower(label),
    );
    return {
      value: label,
      label,
      visual: variant?.colorValue || getColorVisualValue(raw) || label,
    };
  });

  return {
    ...product,
    images: normalizeImages(product),
    sizes,
    colors,
    colorOptions,
    variantAxes,
    variants,
  };
}

export function findSelectedVariant(
  product,
  selectedSize,
  selectedColor,
  selectedVariantKey = "",
) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;

  const variantKey = cleanLower(selectedVariantKey);
  if (variantKey) {
    const byKey = variants.find(
      (variant) =>
        cleanLower(variant.variantKey) === variantKey ||
        cleanLower(variant.variantId) === variantKey,
    );
    if (byKey) return byKey;
  }

  const sizeKey = cleanLower(selectedSize);
  const colorKey = cleanLower(selectedColor);

  const exact = variants.find((variant) => {
    const sameSize = !sizeKey || cleanLower(variant.size) === sizeKey;
    const sameColor =
      !colorKey || cleanLower(variant.colorLabel || variant.color) === colorKey;
    return sameSize && sameColor;
  });

  if (exact) return exact;

  return (
    variants.find((variant) => cleanLower(variant.size) === sizeKey) ||
    variants.find(
      (variant) => cleanLower(variant.colorLabel || variant.color) === colorKey,
    ) ||
    variants[0] ||
    null
  );
}

export function findVariantForChangedAttribute(
  product,
  axisKey,
  nextValue,
  currentVariant,
) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const key = normalizeAttributeKey(axisKey);
  const valueKey = cleanLower(nextValue);
  if (!variants.length || !key || !valueKey) return null;

  const candidates = variants.filter(
    (variant) =>
      cleanLower(findAttributeValue(variant.attributes, key)) === valueKey,
  );
  if (!candidates.length) return null;

  const currentAttributes = normalizeVariantAttributes(
    currentVariant?.attributes,
  );
  const score = (variant) =>
    currentAttributes.reduce((total, attribute) => {
      if (attribute.key === key) return total;
      return (
        total +
        (cleanLower(findAttributeValue(variant.attributes, attribute.key)) ===
        cleanLower(attribute.value)
          ? 1
          : 0)
      );
    }, 0);

  return [...candidates].sort((left, right) => {
    const stockDifference =
      Number((right.availableStock ?? 1) > 0) -
      Number((left.availableStock ?? 1) > 0);
    return stockDifference || score(right) - score(left);
  })[0];
}

export function findVariantForChangedOption(
  product,
  changedOption,
  nextValue,
  currentOtherValue,
) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;

  const nextKey = cleanLower(nextValue);
  const otherKey = cleanLower(currentOtherValue);

  if (changedOption === "color") {
    const exact = variants.find(
      (variant) =>
        cleanLower(variant.colorLabel || variant.color) === nextKey &&
        (!otherKey || cleanLower(variant.size) === otherKey),
    );

    return (
      exact ||
      variants.find(
        (variant) =>
          cleanLower(variant.colorLabel || variant.color) === nextKey,
      ) ||
      null
    );
  }

  const exact = variants.find(
    (variant) =>
      cleanLower(variant.size) === nextKey &&
      (!otherKey ||
        cleanLower(variant.colorLabel || variant.color) === otherKey),
  );

  return (
    exact ||
    variants.find((variant) => cleanLower(variant.size) === nextKey) ||
    null
  );
}

export function buildVariantAwareProduct(product, selectedVariant) {
  if (!product) return product;
  if (!selectedVariant) return product;

  const baseImages = normalizeImages(product);
  const variantImages = uniqueStrings([
    selectedVariant.image,
    ...(Array.isArray(selectedVariant.images) ? selectedVariant.images : []),
  ]);
  const finalImages = variantImages.length ? variantImages : baseImages;
  const finalImage = finalImages[0] || product.image || "";
  const variantPrice =
    selectedVariant.price == null ? NaN : Number(selectedVariant.price);
  const variantOriginalPrice = Number(selectedVariant.originalPrice);

  return {
    ...product,
    selectedVariant,
    selectedVariantKey: selectedVariant.variantKey,
    selectedVariantId: selectedVariant.variantId || selectedVariant.variantKey,
    image: finalImage,
    images: finalImages,
    price:
      Number.isFinite(variantPrice) && variantPrice >= 0
        ? variantPrice
        : product.price,
    originalPrice:
      Number.isFinite(variantOriginalPrice) && variantOriginalPrice > 0
        ? variantOriginalPrice
        : product.originalPrice,
    sku: selectedVariant.sku || product.sku,
    barcode: selectedVariant.barcode || product.barcode,
  };
}
