// src/pages/ProductDetail.jsx

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import ProductDetailView from "../components/product-detail/ProductDetailView";
import { applyProductSeo } from "../lib/productSeo";
import {
  buildVariantKey,
  resolveCanonicalColor,
} from "../components/product-detail/productDetailModel";
import useProductDetailSelection from "../components/product-detail/useProductDetailSelection";
import { buildSafeProductDetailConfig } from "../components/product-detail/productDetailConfig";

import StorefrontLoadingScreen from "../components/StorefrontLoadingScreen";
import { StorefrontSettingsContext } from "../context/StorefrontSettingsContext";
import { rememberPageLoadingAppearance } from "../theme/storefrontLoadingAppearance";

export default function ProductDetail() {
  const { id, slug } = useParams();

  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0),
    reviewPending = useRef(false);

  const {
    publicProduct,
    selectedVariant,
    variantAwareProduct,
    selectedSize,
    selectedColor,
    selectedAttributes,
    inventoryTracked,
    selectedAvailableStock,
    quantity,
    setQuantity,
    handleSizeChange,
    handleColorChange,
    handleVariantAttributeChange,
    isVariantOptionAvailable,
    purchaseUnavailable,
  } = useProductDetailSelection(product);

  const [reviewName, setReviewName] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    generation.current++;
    reviewPending.current = false;
    setReviewLoading(false);
    setReviewError("");
    setReviewSuccess("");
    setReviewName("");
    setReviewComment("");
    setReviewRating(5);
    setLoading(true);
    setLoadError("");
    setProduct(null);
    api
      .get(`/api/products/${encodeURIComponent(id || slug || "")}`, {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (active) setProduct(data?.product || data?.data || data);
      })
      .catch((error) => {
        if (!active) return;
        if (error?.response?.status !== 404)
          setLoadError(
            "No pudimos cargar el producto. Comprueba tu conexión e inténtalo de nuevo.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      generation.current++;
      controller.abort();
    };
  }, [id, slug, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const fetchConfig = async () => {
      try {
        const res = await api.get(`/api/pages`, { signal: controller.signal });
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
          return (
            String(pageType).trim().toLowerCase() === "product-detail" &&
            isEnabled
          );
        });

        const detailConfig =
          detailPage?.productDetailConfig ||
          detailPage?.config?.productDetailConfig ||
          null;

        if (active) {
          const normalized = detailPage
            ? buildSafeProductDetailConfig(detailConfig)
            : null;
          setConfig(
            normalized
              ? {
                  ...normalized,
                  showHeader:
                    detailPage.useHeader !== false && normalized.showHeader,
                  showFooter:
                    detailPage.useFooter !== false && normalized.showFooter,
                }
              : null,
          );
        }
      } catch (err) {
        if (active) setConfig(null);
      } finally {
        if (active) setConfigLoading(false);
      }
    };

    fetchConfig();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!variantAwareProduct) return undefined;

    return applyProductSeo(variantAwareProduct);
  }, [variantAwareProduct]);

  const handleAddToCart = () => {
    if (!variantAwareProduct) return;
    if (purchaseUnavailable) return;

    const size = selectedVariant?.size || selectedSize;
    const displayColor = selectedVariant?.colorLabel || selectedColor;
    const canonicalColor =
      selectedVariant?.rawColor || resolveCanonicalColor(product, displayColor);
    const variantKey =
      selectedVariant?.variantKey || buildVariantKey(size, canonicalColor);
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
      variantBarcode:
        selectedVariant?.barcode || variantAwareProduct.barcode || "",
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
    if (!product || reviewPending.current) return;
    const name = reviewName.trim(),
      comment = reviewComment.trim(),
      rating = Number(reviewRating);
    if (
      !name ||
      !comment ||
      !Number.isFinite(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      setReviewSuccess("");
      setReviewError(
        !name
          ? "El nombre es obligatorio"
          : !comment
            ? "El comentario es obligatorio"
            : "La calificación debe estar entre 1 y 5",
      );
      return;
    }
    const requestGeneration = generation.current;
    reviewPending.current = true;
    try {
      setReviewLoading(true);
      setReviewError("");
      setReviewSuccess("");

      const productKey = product?._id || product?.slug || id || slug;

      const payload = {
        name,
        comment,
        rating,
      };

      const res = await api.post(
        `/api/products/${encodeURIComponent(productKey)}/reviews`,
        payload,
      );

      if (requestGeneration !== generation.current) return;
      const updatedReviews = Array.isArray(res.data?.reviews)
        ? res.data.reviews
        : product.reviews || [];

      setProduct((prev) =>
        prev
          ? {
              ...prev,
              reviews: updatedReviews,
            }
          : prev,
      );

      setReviewName("");
      setReviewComment("");
      setReviewRating(5);
      setReviewSuccess("Reseña enviada correctamente");
    } catch (err) {
      if (requestGeneration !== generation.current) return;
      setReviewError(
        err?.response?.data?.message || "No se pudo guardar la reseña",
      );
    } finally {
      if (requestGeneration === generation.current) {
        reviewPending.current = false;
        setReviewLoading(false);
      }
    }
  };

  const settings = React.useContext(StorefrontSettingsContext);
  useEffect(() => {
    if (!loading && !configLoading && product)
      rememberPageLoadingAppearance(
        `/producto/${id || slug}`,
        settings?.theme,
        config?.presentation,
        config?.style?.pageBg,
      );
  }, [loading, configLoading, product, id, slug, settings?.theme, config]);

  if (loading || configLoading) {
    return (
      <StorefrontLoadingScreen
        message="Cargando producto"
        presentation={config?.presentation}
        pageBg={config?.style?.pageBg}
      />
    );
  }

  if (loadError)
    return (
      <div className="p-10 text-center" role="alert">
        <p>{loadError}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Reintentar
        </button>
      </div>
    );

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
      isVariantOptionAvailable={isVariantOptionAvailable}
      purchaseUnavailable={purchaseUnavailable}
      inventoryTracked={inventoryTracked}
      selectedAvailableStock={selectedAvailableStock}
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
