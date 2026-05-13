// src/pages/ProductDetail.jsx

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import ProductDetailView from "../components/product-detail/ProductDetailView";

export default function ProductDetail() {
  const { id, slug } = useParams();

  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  const [config, setConfig] = useState(null);

  // estados UI
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);

  // reseñas
  const [reviewName, setReviewName] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  // ===============================
  // 🔥 CARGAR PRODUCTO
  // ===============================
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);

        const productKey = id || slug;
        const res = await api.get(`/api/products/${productKey}`);
        const data = res.data?.product || res.data?.data || res.data;

        setProduct(data);

        // valores por defecto
        if (data?.sizes?.length) {
          setSelectedSize(data.sizes[0]);
        } else {
          setSelectedSize("");
        }

        if (data?.colors?.length) {
          const firstColor = data.colors[0];
          if (typeof firstColor === "string") {
            setSelectedColor(firstColor);
          } else {
            setSelectedColor(
              firstColor?.name ||
                firstColor?.label ||
                firstColor?.value ||
                firstColor?.hex ||
                ""
            );
          }
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

  // ===============================
  // 🔥 CARGAR CONFIG DEL ADMIN
  // ===============================
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

  // ===============================
  // 🔥 ACCIONES
  // ===============================
  const handleAddToCart = () => {
    if (!product) return;

    addToCart({
      ...product,
      size: selectedSize,
      color: selectedColor,
      quantity,
    });
  };

  const handleFavorite = () => {
    if (!product) return;
    toggleFavorite(product);
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

  // ===============================
  // 🔥 VALIDACIÓN
  // ===============================
  if (loading) {
    return <div className="p-10 text-center">Cargando producto...</div>;
  }

  if (!product) {
    return <div className="p-10 text-center">Producto no encontrado</div>;
  }

  // ===============================
  // 🔥 RENDER
  // ===============================
  return (
    <ProductDetailView
      product={product}
      config={config}
      isFavorite={isFavorite(product)}
      onToggleFavorite={handleFavorite}
      onAddToCart={handleAddToCart}
      selectedSize={selectedSize}
      setSelectedSize={setSelectedSize}
      selectedColor={selectedColor}
      setSelectedColor={setSelectedColor}
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