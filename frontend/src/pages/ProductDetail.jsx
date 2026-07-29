// src/pages/ProductDetail.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import ProductDetailView from "../components/product-detail/ProductDetailView";
import { getColorDisplayName, getColorVisualValue } from "../utils/colorDisplay";
import { applyProductSeo } from "../lib/productSeo";

function clean(value) {
  return String(value || "").trim();
}

function cleanLower(value) {
  return clean(value).toLowerCase();
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

function buildVariantKey(size = "", color = "") {
  const sizeKey = cleanLower(size);
  const colorKey = cleanLower(color);
  const key = `${sizeKey}__${colorKey}`;
  return !key || key === "__" ? "default__default" : key;
}

function normalizeVariant(product = {}, variant = {}, index = 0) {
  const size = clean(variant.size || variant.talla || variant.attribute || "");
  const rawColor = clean(variant.color || variant.colour || variant.visualAttribute || "");
  const colorLabel = getColorDisplayName(rawColor);
  const colorValue = getColorVisualValue(rawColor);
  const variantKey = cleanLower(variant.variantKey || buildVariantKey(size, rawColor));
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

  const labelParts = [size, colorLabel].filter(Boolean);

  return {
    ...variant,
    variantKey,
    variantId: clean(variant.variantId || variantKey),
    label: labelParts.length ? labelParts.join(" / ") : clean(variant.label) || "Variante general",
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

  const variants = Array.isArray(product.variants)
    ? product.variants
        .map((variant, index) => normalizeVariant(product, variant, index))
        .filter((variant) => variant.active !== false)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    : [];

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
    variants,
  };
}

function findSelectedVariant(product, selectedSize, selectedColor) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;

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
  const [quantity, setQuantity] = useState(1);

  const [reviewName, setReviewName] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  const publicProduct = useMemo(() => decorateProductForPublic(product), [product]);
  const selectedVariant = useMemo(
    () => findSelectedVariant(publicProduct, selectedSize, selectedColor),
    [publicProduct, selectedSize, selectedColor]
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

    if (matchingVariant?.size) {
      setSelectedSize(matchingVariant.size);
    }
  };

  const handleAddToCart = () => {
    if (!variantAwareProduct) return;

    addToCart({
      ...variantAwareProduct,
      _id: variantAwareProduct._id || variantAwareProduct.id,
      size: selectedVariant?.size || selectedSize,
      color: selectedVariant?.colorLabel || selectedColor,
      colorValue: selectedVariant?.colorValue || "",
      variantId: selectedVariant?.variantId || selectedVariant?.variantKey || "",
      variantKey: selectedVariant?.variantKey || "",
      variantLabel: selectedVariant?.label || "",
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
