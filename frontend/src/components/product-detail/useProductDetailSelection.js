import { useMemo, useState } from "react";
import {
  decorateProductForPublic,
  findSelectedVariant,
  findVariantForChangedAttribute,
  findVariantForChangedOption,
  buildVariantAwareProduct,
} from "./productDetailModel";
const clampQuantity = (value, stock) =>
  Math.max(
    1,
    Math.min(
      stock == null ? Number.MAX_SAFE_INTEGER : Math.max(1, stock),
      Math.floor(Number(value) || 1),
    ),
  );
export default function useProductDetailSelection(product) {
  const publicProduct = useMemo(
    () => decorateProductForPublic(product),
    [product],
  );
  const [selection, setSelection] = useState(null);
  const productKey = String(product?._id || product?.id || product?.slug || "");
  const inventoryTracked = publicProduct?.inventoryTracked === true;
  const variants = publicProduct?.variants || [];
  const requiresVariant =
    Array.isArray(product?.variants) && product.variants.length > 0;
  const first =
    variants.find(
      (variant) => !inventoryTracked || Number(variant.availableStock) > 0,
    ) || variants[0];
  const current =
    selection?.productKey === productKey
      ? selection
      : {
          productKey,
          key: first?.variantKey || "",
          size: first?.size || publicProduct?.sizes?.[0] || "",
          color:
            first?.colorLabel ||
            first?.color ||
            publicProduct?.colors?.[0] ||
            "",
          quantity: 1,
        };
  const selectedVariant = findSelectedVariant(
    publicProduct,
    current.size,
    current.color,
    current.key,
  );
  const selectedAvailableStock = inventoryTracked
    ? Math.max(
        0,
        Number(
          selectedVariant?.availableStock ??
            (requiresVariant ? 0 : publicProduct?.availableStock),
        ) || 0,
      )
    : null;
  const purchaseUnavailable =
    !!publicProduct &&
    ((requiresVariant && !selectedVariant) ||
      (inventoryTracked && selectedAvailableStock <= 0));
  const quantity = clampQuantity(current.quantity, selectedAvailableStock);
  const variantAwareProduct = useMemo(
    () => buildVariantAwareProduct(publicProduct, selectedVariant),
    [publicProduct, selectedVariant],
  );
  const selectedAttributes = useMemo(
    () =>
      Object.fromEntries(
        (selectedVariant?.attributes || []).map((attribute) => [
          attribute.key,
          attribute.value,
        ]),
      ),
    [selectedVariant],
  );
  const choose = (variant, fallback = {}) =>
    setSelection({
      ...current,
      ...fallback,
      key: variant?.variantKey || "",
      size: variant?.size || fallback.size || current.size,
      color:
        variant?.colorLabel ||
        variant?.color ||
        fallback.color ||
        current.color,
      quantity: clampQuantity(
        quantity,
        inventoryTracked
          ? (variant?.availableStock ?? selectedAvailableStock)
          : null,
      ),
    });
  const handleSizeChange = (value) =>
    choose(
      findVariantForChangedOption(publicProduct, "size", value, current.color),
      { size: value },
    );
  const handleColorChange = (value) =>
    choose(
      findVariantForChangedOption(publicProduct, "color", value, current.size),
      { color: value },
    );
  const handleVariantAttributeChange = (key, value) => {
    const variant = findVariantForChangedAttribute(
      publicProduct,
      key,
      value,
      selectedVariant,
    );
    if (variant) choose(variant);
  };
  const isVariantOptionAvailable = (key, value) => {
    if (!requiresVariant)
      return !inventoryTracked || selectedAvailableStock > 0;
    return variants.some(
      (variant) =>
        (!inventoryTracked || Number(variant.availableStock) > 0) &&
        (variant.attributes || []).some(
          (attribute) =>
            attribute.key === key &&
            String(attribute.value).toLowerCase() ===
              String(value).toLowerCase(),
        ),
    );
  };
  const setQuantity = (value) =>
    setSelection((previous) => {
      const base = previous?.productKey === productKey ? previous : current;
      return {
        ...base,
        quantity: clampQuantity(
          typeof value === "function"
            ? value(clampQuantity(base.quantity, selectedAvailableStock))
            : value,
          selectedAvailableStock,
        ),
      };
    });
  return {
    publicProduct,
    selectedVariant,
    variantAwareProduct,
    selectedSize: current.size,
    selectedColor: current.color,
    selectedAttributes,
    inventoryTracked,
    selectedAvailableStock,
    purchaseUnavailable,
    quantity,
    setQuantity,
    handleSizeChange,
    handleColorChange,
    handleVariantAttributeChange,
    isVariantOptionAvailable,
  };
}
