import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import useRelatedProducts from "./useRelatedProducts";
import CatalogEditorialCard from "../catalog/CatalogEditorialCard";
import { buildSafeCatalogConfig } from "../catalog/catalogConfig";
import { EDITORIAL_STYLE_VERSION } from "../catalog/catalogEditorialPreset";
import { CATALOG_GLASS_PALETTE_VERSION } from "../catalog/catalogGlassPalette";
import "../catalog/catalogPolishedGlass.css";

export default function ProductDetailRelatedProducts({ product, config }) {
  const presentation = config.presentation;
  const {
    products: rows,
    loading,
    error,
    retry,
  } = useRelatedProducts(product, presentation);
  const track = useRef(null);
  const [position, setPosition] = useState({ previous: false, next: false });
  const updatePosition = () => {
    const node = track.current;
    if (!node) return;
    const next = {
      previous: node.scrollLeft > 1,
      next: node.scrollLeft + node.clientWidth < node.scrollWidth - 1,
    };
    setPosition((current) =>
      current.previous === next.previous && current.next === next.next
        ? current
        : next,
    );
  };
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    node.scrollLeft = 0;
    updatePosition();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updatePosition);
    observer?.observe(node);
    window.addEventListener("resize", updatePosition);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updatePosition);
    };
  }, [rows, presentation.relatedCount]);
  const move = (direction) => {
    const node = track.current;
    if (!node) return;
    node.scrollBy({
      left: direction * node.clientWidth,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
        ? "auto"
        : "smooth",
    });
  };
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
  if (!presentation.showRelated || (!loading && !error && !rows.length))
    return null;
  return (
    <section
      className="pd-related cpv-page"
      data-layout="glass-grid"
      data-motion="subtle"
      aria-roledescription="carrusel"
      style={{ "--pd-related-count": presentation.relatedCount }}
      aria-label={presentation.relatedTitle}
    >
      <header>
        <h2>{presentation.relatedTitle}</h2>
        <div className="pd-related-controls">
          <Link to={presentation.catalogPath}>
            {presentation.catalogLabel}
            <ArrowRight size={16} />
          </Link>
          {rows.length > 0 && (
            <div role="group" aria-label="Navegación de productos relacionados">
              <button
                type="button"
                aria-label="Productos anteriores"
                onClick={() => move(-1)}
                disabled={!position.previous}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                aria-label="Productos siguientes"
                onClick={() => move(1)}
                disabled={!position.next}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </header>
      {loading && (
        <p role="status" className="pd-related-message">
          Cargando productos…
        </p>
      )}
      {error && (
        <div role="alert" className="pd-related-message">
          <p>{error}</p>
          <button type="button" onClick={retry}>
            Reintentar
          </button>
        </div>
      )}
      {rows.length > 0 && (
        <div
          className="pd-related-track"
          ref={track}
          onScroll={updatePosition}
          role="list"
          aria-label={presentation.relatedTitle}
          tabIndex={0}
        >
          {rows.map((item) => (
            <div
              className="pd-related-slide"
              role="listitem"
              key={item._id || item.slug}
            >
              <CatalogEditorialCard product={item} config={cardConfig} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
