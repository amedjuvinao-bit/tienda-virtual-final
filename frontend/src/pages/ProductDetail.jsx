// src/pages/ProductDetail.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import ProductDetailView from "../components/product-detail/ProductDetailView";
import { getColorDisplayName, getColorVisualValue } from "../utils/colorDisplay";
import { applyProductSeo } from "../lib/productSeo";
import variantKeyAuthority from '@shared/variant-key-authority';

const { buildVariantKey, normalizeVariantKey } = variantKeyAuthority;

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

function normalizeVariantAttributes(attributes = []) {
  const normalized = [];
  const seen = new Set();

  (Array.isArray(attributes) ? attributes : []).forEach((attribute) => {
    const label = clean(attribute?.label || attribute?.name || attribute?.key);
    const key = normalizeAttributeKey(attribute?.key || attribute?.name || label);
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

  (Array.isArray(product.variantAxes) ? product.variantAxes : []).forEach((axis) => {
    const label = clean(axis?.label || axis?.name || axis?.key);
    const key = normalizeAttributeKey(axis?.key || axis?.name || label);
    const values = uniqueStrings(Array.isArray(axis?.values) ? axis.values : []);
    if (!key || !label || seen.has(key) || axes.length >= 4) return;
    seen.add(key);
    axes.push({ key, label, values });
  });

  return axes;
}

function findAttributeValue(attributes = [], key = "") {
  const normalizedKey = normalizeAttributeKey(key);
  return clean(
    normalizeVariantAttributes(attributes).find(
      (attribute) => attribute.key === normalizedKey
    )?.value
  );
}

function resolveCanonicalColor(product = {}, selectedColor = "") {
  const selectedKey = cleanLower(selectedColor);
  if (!selectedKey) return "";

  const rawColors = Array.isArray(product?.colors) ? product.colors : [];
  const match = rawColors.find((rawColor) => {
    return (
      cleanLower(rawColor) === selectedKey ||
      cleanLower(getColorDisplayName(rawColor)) === selectedKey
    );
  });

  return clean(match || selectedColor);
}

function normalizeVariant(product = {}, variant = {}, index = 0, axes = []) {
  const size = clean(variant.size || variant.talla || variant.attribute || "");
  const rawColor = clean(variant.color || variant.colour || variant.visualAttribute || "");
  const colorLabel = getColorDisplayName(rawColor);
  const colorValue = getColorVisualValue(rawColor);
  let attributes = normalizeVariantAttributes(
    variant.attributes || variant.variantAttributes
  );

  if (!attributes.length) {
    const legacyAttributes = [];
    axes.forEach((axis) => {
      if (["size", "talla", "presentacion"].includes(axis.key) && size) {
        legacyAttributes.push({ key: axis.key, label: axis.label, value: size });
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

  const variantKey = normalizeVariantKey(variant.variantKey) ||
    buildVariantKey(size, rawColor, attributes);
  const images = uniqueStrings([
    clean(variant.image),
    ...(Array.isArray(variant.images) ? variant.images : []),
  ]);

  const price = variant.price === null || variant.price === undefined || variant.price === ""
    ? null
    : Number(variant.price);
  const cost = variant.cost === null || variant.cost === undefined || variant.cost === ""
    ? null
    : Number(variant.cost);
  const originalPrice = variant.originalPrice === null || variant.originalPrice === undefined || variant.originalPrice === ""
    ? null
    : Number(variant.originalPrice);

  const labelParts = attributes.length
    ? attributes.map((attribute) =>
        ["color", "colour", "tono"].includes(attribute.key)
          ? getColorDisplayName(attribute.value)
          : attribute.value
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
    sku: clean(variant.sku || variant.variantSku || product.sku || "").toUpperCase(),
    barcode: clean(variant.barcode || variant.variantBarcode || product.barcode || ""),
    price: Number.isFinite(price) && price >= 0 ? price : null,
    cost: Number.isFinite(cost) && cost >= 0 ? cost : null,
    originalPrice: Number.isFinite(originalPrice) && originalPrice > 0 ? originalPrice : null,
    image: images[0] || "",
    images,
    active: variant.active !== false,
    sortOrder: Number.isFinite(Number(variant.sortOrder)) ? Number(variant.sortOrder) : index,
  };
}

function decorateProductForPublic(product) {
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
        .map((variant, index) => normalizeVariant(product, variant, index, variantAxes))
        .filter((variant) => variant.active !== false)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    : [];

  variantAxes = variantAxes.map((axis) => ({
    ...axis,
    values: uniqueStrings([
      ...axis.values,
      ...variants.map((variant) =>
        findAttributeValue(variant.attributes, axis.key)
      ),
    ]),
  }));

  const baseSizes = Array.isArray(product.sizes) ? product.sizes : [];
  const variantSizes = variants.map((variant) => variant.size).filter(Boolean);
  const sizes = uniqueStrings([...baseSizes, ...variantSizes]);

  const rawColors = Array.isArray(product.colors) ? product.colors : [];
  const colorLabels = rawColors.map((color) => getColorDisplayName(color)).filter(Boolean);
  const variantColorLabels = variants.map((variant) => variant.colorLabel || variant.color).filter(Boolean);
  const colors = uniqueStrings([...colorLabels, ...variantColorLabels]);

  const colorOptions = uniqueStrings([
    ...rawColors.map((color) => getColorDisplayName(color)),
    ...variantColorLabels,
  ]).map((label) => {
    const variant = variants.find((item) => cleanLower(item.colorLabel || item.color) === cleanLower(label));
    const raw = rawColors.find((color) => cleanLower(getColorDisplayName(color)) === cleanLower(label));
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

function findSelectedVariant(
  product,
  selectedSize,
  selectedColor,
  selectedVariantKey = ""
) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;

  const variantKey = cleanLower(selectedVariantKey);
  if (variantKey) {
    const byKey = variants.find(
      (variant) =>
        cleanLower(variant.variantKey) === variantKey ||
        cleanLower(variant.variantId) === variantKey
    );
    if (byKey) return byKey;
  }

  const sizeKey = cleanLower(selectedSize);
  const colorKey = cleanLower(selectedColor);

  const exact = variants.find((variant) => {
    const sameSize = !sizeKey || cleanLower(variant.size) === sizeKey;
    const sameColor = !colorKey || cleanLower(variant.colorLabel || variant.color) === colorKey;
    return sameSize && sameColor;
  });

  if (exact) return exact;

  return variants.find((variant) => cleanLower(variant.size) === sizeKey)
    || variants.find((variant) => cleanLower(variant.colorLabel || variant.color) === colorKey)
    || variants[0]
    || null;
}

function findVariantForChangedAttribute(
  product,
  axisKey,
  nextValue,
  currentVariant
) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const key = normalizeAttributeKey(axisKey);
  const valueKey = cleanLower(nextValue);
  if (!variants.length || !key || !valueKey) return null;

  const candidates = variants.filter(
    (variant) =>
      cleanLower(findAttributeValue(variant.attributes, key)) === valueKey
  );
  if (!candidates.length) return null;

  const currentAttributes = normalizeVariantAttributes(currentVariant?.attributes);
  const score = (variant) =>
    currentAttributes.reduce((total, attribute) => {
      if (attribute.key === key) return total;
      return total + (
        cleanLower(findAttributeValue(variant.attributes, attribute.key)) ===
        cleanLower(attribute.value)
          ? 1
          : 0
      );
    }, 0);

  return [...candidates].sort(
    (left, right) => score(right) - score(left)
  )[0];
}

function findVariantForChangedOption(
  product,
  changedOption,
  nextValue,
  currentOtherValue
) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;

  const nextKey = cleanLower(nextValue);
  const otherKey = cleanLower(currentOtherValue);

  if (changedOption === "color") {
    const exact = variants.find(
      (variant) =>
        cleanLower(variant.colorLabel || variant.color) === nextKey &&
        (!otherKey || cleanLower(variant.size) === otherKey)
    );

    return exact
      || variants.find(
        (variant) =>
          cleanLower(variant.colorLabel || variant.color) === nextKey
      )
      || null;
  }

  const exact = variants.find(
    (variant) =>
      cleanLower(variant.size) === nextKey &&
      (!otherKey ||
        cleanLower(variant.colorLabel || variant.color) === otherKey)
  );

  return exact
    || variants.find(
      (variant) => cleanLower(variant.size) === nextKey
    )
    || null;
}

function buildVariantAwareProduct(product, selectedVariant) {
  if (!product) return product;
  if (!selectedVariant) return product;

  const baseImages = normalizeImages(product);
  const variantImages = uniqueStrings([
    selectedVariant.image,
    ...(Array.isArray(selectedVariant.images) ? selectedVariant.images : []),
  ]);
  const finalImages = variantImages.length ? variantImages : baseImages;
  const finalImage = finalImages[0] || product.image || "";
  const variantPrice = Number(selectedVariant.price);
  const variantOriginalPrice = Number(selectedVariant.originalPrice);

  return {
    ...product,
    selectedVariant,
    selectedVariantKey: selectedVariant.variantKey,
    selectedVariantId: selectedVariant.variantId || selectedVariant.variantKey,
    image: finalImage,
    images: finalImages,
    price: Number.isFinite(variantPrice) && variantPrice >= 0 ? variantPrice : product.price,
    originalPrice: Number.isFinite(variantOriginalPrice) && variantOriginalPrice > 0
      ? variantOriginalPrice
      : product.originalPrice,
    sku: selectedVariant.sku || product.sku,
    barcode: selectedVariant.barcode || product.barcode,
  };
}

export default function ProductDetail() {
  const { id, slug } = useParams();

  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  const [config, setConfig] = useState(null);

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedVariantKey, setSelectedVariantKey] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [reviewName, setReviewName] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  const publicProduct = useMemo(() => decorateProductForPublic(product), [product]);
  const selectedVariant = useMemo(
    () =>
      findSelectedVariant(
        publicProduct,
        selectedSize,
        selectedColor,
        selectedVariantKey
      ),
    [publicProduct, selectedSize, selectedColor, selectedVariantKey]
  );
  const selectedAttributes = useMemo(
    () =>
      normalizeVariantAttributes(selectedVariant?.attributes).reduce(
        (result, attribute) => ({
          ...result,
          [attribute.key]: attribute.value,
        }),
        {}
      ),
    [selectedVariant]
  );
  const variantAwareProduct = useMemo(
    () => buildVariantAwareProduct(publicProduct, selectedVariant),
    [publicProduct, selectedVariant]
  );

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);

        const productKey = id || slug;
        const res = await api.get(`/api/products/${productKey}`);
        const data = res.data?.product || res.data?.data || res.data;
        const decorated = decorateProductForPublic(data);
        const initialVariant = decorated?.variants?.[0] || null;

        setProduct(data);
        setSelectedVariantKey(initialVariant?.variantKey || "");

        if (initialVariant?.size || decorated?.sizes?.length) {
          setSelectedSize(initialVariant?.size || decorated.sizes[0]);
        } else {
          setSelectedSize("");
        }

        if (
          initialVariant?.colorLabel ||
          initialVariant?.color ||
          decorated?.colors?.length
        ) {
          setSelectedColor(
            initialVariant?.colorLabel ||
            initialVariant?.color ||
            decorated.colors[0]
          );
        } else {
          setSelectedColor("");
        }

        setQuantity(1);
      } catch (err) {
        console.error("❌ Error cargando producto:", err);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, slug]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get(`/api/pages`);
        const pages = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.pages)
          ? res.data.pages
          : [];

        const detailPage = pages.find((p) => {
          const pageType = p?.pageType || p?.type || "";
          const isEnabled =
            p?.enabled !== false &&
            p?.active !== false &&
            p?.isActive !== false;
          return pageType === "product-detail" && isEnabled;
        });

        const detailConfig =
          detailPage?.productDetailConfig ||
          detailPage?.config?.productDetailConfig ||
          null;

        setConfig(detailConfig);
      } catch (err) {
        console.error("❌ Error cargando config:", err);
        setConfig(null);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    if (!publicProduct) return;

    if (publicProduct.sizes?.length && selectedSize) {
      const exists = publicProduct.sizes.some((size) => cleanLower(size) === cleanLower(selectedSize));
      if (!exists) setSelectedSize(publicProduct.sizes[0]);
    }

    if (publicProduct.colors?.length && selectedColor) {
      const exists = publicProduct.colors.some((color) => cleanLower(color) === cleanLower(selectedColor));
      if (!exists) setSelectedColor(publicProduct.colors[0]);
    }
  }, [publicProduct, selectedSize, selectedColor]);

  useEffect(() => {
    if (!variantAwareProduct) return undefined;

    return applyProductSeo(variantAwareProduct);
  }, [variantAwareProduct]);

  const handleSizeChange = (nextSize) => {
    const matchingVariant = findVariantForChangedOption(
      publicProduct,
      "size",
      nextSize,
      selectedColor
    );

    setSelectedSize(matchingVariant?.size || nextSize);
    setSelectedVariantKey(matchingVariant?.variantKey || "");

    if (matchingVariant?.colorLabel || matchingVariant?.color) {
      setSelectedColor(
        matchingVariant.colorLabel || matchingVariant.color
      );
    }
  };

  const handleColorChange = (nextColor) => {
    const matchingVariant = findVariantForChangedOption(
      publicProduct,
      "color",
      nextColor,
      selectedSize
    );

    setSelectedColor(
      matchingVariant?.colorLabel ||
      matchingVariant?.color ||
      nextColor
    );
    setSelectedVariantKey(matchingVariant?.variantKey || "");

    if (matchingVariant?.size) {
      setSelectedSize(matchingVariant.size);
    }
  };

  const handleVariantAttributeChange = (axisKey, nextValue) => {
    const matchingVariant = findVariantForChangedAttribute(
      publicProduct,
      axisKey,
      nextValue,
      selectedVariant
    );
    if (!matchingVariant) return;

    setSelectedVariantKey(matchingVariant.variantKey);
    setSelectedSize(matchingVariant.size || "");
    setSelectedColor(
      matchingVariant.colorLabel || matchingVariant.color || ""
    );
  };

  const handleAddToCart = () => {
    if (!variantAwareProduct) return;

    const size = selectedVariant?.size || selectedSize;
    const displayColor = selectedVariant?.colorLabel || selectedColor;
    const canonicalColor =
      selectedVariant?.rawColor ||
      resolveCanonicalColor(product, displayColor);
    const variantKey =
      selectedVariant?.variantKey ||
      buildVariantKey(size, canonicalColor);
    const variantLabel =
      selectedVariant?.label ||
      [size, displayColor].filter(Boolean).join(" / ");

    addToCart({
      ...variantAwareProduct,
      _id: variantAwareProduct._id || variantAwareProduct.id,
      size,
      color: displayColor,
      colorValue: canonicalColor,
      variantId: selectedVariant?.variantId || variantKey,
      variantKey,
      variantLabel,
      variantAttributes: selectedVariant?.attributes || [],
      variantSku: selectedVariant?.sku || variantAwareProduct.sku || "",
      variantBarcode: selectedVariant?.barcode || variantAwareProduct.barcode || "",
      image: variantAwareProduct.image,
      price: variantAwareProduct.price,
      unitPrice: variantAwareProduct.price,
      quantity,
    });
  };

  const handleFavorite = () => {
    if (!variantAwareProduct) return;
    toggleFavorite(variantAwareProduct);
  };

  const handleSubmitReview = async () => {
    if (!product) return;

    try {
      setReviewLoading(true);
      setReviewError("");
      setReviewSuccess("");

      const productKey = product?._id || product?.slug || id || slug;

      const payload = {
        name: reviewName,
        comment: reviewComment,
        rating: Number(reviewRating),
      };

      const res = await api.post(
        `/api/products/${encodeURIComponent(productKey)}/reviews`,
        payload
      );

      const updatedReviews = Array.isArray(res.data?.reviews)
        ? res.data.reviews
        : [];

      setProduct((prev) =>
        prev
          ? {
              ...prev,
              reviews: updatedReviews,
            }
          : prev
      );

      setReviewName("");
      setReviewComment("");
      setReviewRating(5);
      setReviewSuccess("Reseña enviada correctamente");
    } catch (err) {
      console.error("❌ Error guardando reseña:", err);
      setReviewError(
        err?.response?.data?.message || "No se pudo guardar la reseña"
      );
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center">Cargando producto...</div>;
  }

  if (!variantAwareProduct) {
    return <div className="p-10 text-center">Producto no encontrado</div>;
  }

  return (
    <ProductDetailView
      product={variantAwareProduct}
      config={config}
      isFavorite={isFavorite(variantAwareProduct)}
      onToggleFavorite={handleFavorite}
      onAddToCart={handleAddToCart}
      selectedSize={selectedSize}
      setSelectedSize={handleSizeChange}
      selectedColor={selectedColor}
      setSelectedColor={handleColorChange}
      variantAxes={publicProduct?.variantAxes || []}
      selectedAttributes={selectedAttributes}
      onVariantAttributeChange={handleVariantAttributeChange}
      quantity={quantity}
      setQuantity={setQuantity}
      reviewName={reviewName}
      setReviewName={setReviewName}
      reviewComment={reviewComment}
      setReviewComment={setReviewComment}
      reviewRating={reviewRating}
      setReviewRating={setReviewRating}
      reviewLoading={reviewLoading}
      reviewError={reviewError}
      reviewSuccess={reviewSuccess}
      onSubmitReview={handleSubmitReview}
    />
  );
}
