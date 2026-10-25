import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import api from "../../lib/api";
import CatalogEditorialCard from "../catalog/CatalogEditorialCard";
import { buildSafeCatalogConfig } from "../catalog/catalogConfig";
import { EDITORIAL_STYLE_VERSION } from "../catalog/catalogEditorialPreset";
import { CATALOG_GLASS_PALETTE_VERSION } from "../catalog/catalogGlassPalette";
import "../catalog/catalogPolishedGlass.css";

export default function ProductDetailRelatedProducts({ product, config }) {
  const [result, setResult] = useState({ key: "", products: [] });
  const presentation = config.presentation;
  const key = String(product._id || product.id || product.slug || "");
  const category =
    typeof product.category === "string"
      ? product.category
      : product.categories?.find((item) => typeof item === "string") || "";
  useEffect(() => {
    if (!presentation.showRelated || !key || key === "preview") return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      limit: String(presentation.relatedCount + 1),
      status: "published",
    });
    if (category) params.set("categories", category);
    api
      .get(`/api/products?${params}`, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            products: (Array.isArray(data?.products)
              ? data.products
              : []
            ).filter(
              (item) =>
                String(item._id || item.id || item.slug) !== key &&
                item.active !== false,
            ),
          });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [key, category, presentation.showRelated, presentation.relatedCount]);
  const cardConfig = useMemo(
    () =>
      buildSafeCatalogConfig({
        presentation: {
          styleVersion: EDITORIAL_STYLE_VERSION,
          glassPaletteVersion: CATALOG_GLASS_PALETTE_VERSION,
          headerVersion: 1,
          filterVersion: 1,
          layout: "glass-grid",
          rimStyle: "optical",
          rimColor: config.style.accentColor,
          rimOpacity: presentation.reflection,
        },
        cardUiConfig: {
          titleColor: config.style.primaryTextColor,
          priceColor: config.style.primaryTextColor,
          metaColor: config.style.secondaryTextColor,
          cardBg: config.style.cardBg,
          cardBorderColor: config.style.borderColor,
          cardBorderWidthPx: config.style.borderWidthPx,
          cardRadiusPx: config.style.radiusPx,
          cardPaddingPx: 0,
          favoriteIconName: config.favoriteIconName,
          favoriteIconColor: config.favoriteIconColor,
          favoriteActiveColor: config.favoriteActiveColor,
          cartIconName: config.addToCartIconName,
          cartIconColor: config.style.accentColor,
        },
      }),
    [config, presentation.reflection],
  );
  const rows =
    result.key === key
      ? result.products.slice(0, presentation.relatedCount)
      : [];
  if (!presentation.showRelated || !rows.length) return null;
  return (
    <section
      className="pd-related cpv-page"
      data-layout="glass-grid"
      data-motion="subtle"
      style={{ "--pd-related-count": presentation.relatedCount }}
      aria-label={presentation.relatedTitle}
    >
      <header>
        <h2>{presentation.relatedTitle}</h2>
        <Link to={presentation.catalogPath}>
          {presentation.catalogLabel}
          <ArrowRight size={16} />
        </Link>
      </header>
      <div className="pd-related-grid">
        {rows.map((item) => (
          <CatalogEditorialCard
            key={item._id || item.slug}
            product={item}
            config={cardConfig}
          />
        ))}
      </div>
    </section>
  );
}
