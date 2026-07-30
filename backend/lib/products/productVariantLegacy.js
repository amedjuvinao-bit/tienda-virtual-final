const {
  buildVariantKey,
  normalizeProductVariants,
} = require('./productVariantConfig');

function cleanText(value) {
  return String(value || '').trim();
}

function assertUniqueVariantCombinations(variants = []) {
  const seen = new Set();

  for (const variant of variants) {
    const key = buildVariantKey(
      variant?.size || variant?.talla || '',
      variant?.color || variant?.colour || '',
      variant?.attributes || variant?.variantAttributes || []
    );

    if (seen.has(key)) {
      const error = new Error(
        `Combinación de variante duplicada: ${key}`
      );
      error.name = 'ValidationError';
      throw error;
    }

    seen.add(key);
  }
}

function buildLegacyFromVariants(variants = [], product = {}) {
  assertUniqueVariantCombinations(variants);

  const normalizedVariants =
    Array.isArray(variants) && variants.length
      ? normalizeProductVariants(variants, product)
      : [];

  const sizes = [];
  const colors = [];
  const inventory = [];
  const seenSize = new Set();
  const seenColor = new Set();
  const inventoryByLegacyKey = new Map();

  normalizedVariants
    .filter((variant) => variant.active !== false)
    .forEach((variant) => {
      const size = cleanText(variant?.size);
      const color = cleanText(variant?.color);

      if (size && !seenSize.has(size.toLowerCase())) {
        seenSize.add(size.toLowerCase());
        sizes.push(size);
      }

      if (color && !seenColor.has(color.toLowerCase())) {
        seenColor.add(color.toLowerCase());
        colors.push(color);
      }

      const inventoryKey = `${size.toLowerCase()}|${color.toLowerCase()}`;
      if (size || color) {
        const previous = inventoryByLegacyKey.get(inventoryKey);
        const quantity = Math.max(
          0,
          Math.floor(Number(variant?.initialStock || 0))
        );

        if (previous) {
          previous.stock += quantity;
        } else {
          const row = { size, color, stock: quantity };
          inventoryByLegacyKey.set(inventoryKey, row);
          inventory.push(row);
        }
      }
    });

  return {
    variants: normalizedVariants,
    sizes,
    colors,
    inventory,
  };
}

module.exports = {
  buildLegacyFromVariants,
};
