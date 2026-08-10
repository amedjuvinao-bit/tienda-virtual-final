// src/components/catalog/CatalogPageView.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import FilterSidebar from "../FilterSidebar";
import ProductCard from "../ProductCard";
import { normalizeProductPageResponse } from "../../utils/productPagination";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import {
  Filter,
  ChevronLeft,
  X,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

const API = API_BASE_URL;

// columnas -> clases tailwind
const colClasses = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

// precio por defecto
const DEFAULT_MIN = 0;
const DEFAULT_MAX = 10_000_000;

/* ─── Estilos visuales renovados ─── */
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,700&family=Jost:wght@300;400;500;600&display=swap');

  .cpv-page * { box-sizing: border-box; }

  .cpv-page {
    font-family: 'Jost', sans-serif;
    -webkit-font-smoothing: antialiased;
    background:
      radial-gradient(circle at top left, rgba(255, 214, 231, 0.45), transparent 26%),
      radial-gradient(circle at top right, rgba(255, 237, 181, 0.35), transparent 22%),
      linear-gradient(180deg, #fcfbf8 0%, #f8f5f1 48%, #f9f7f8 100%);
  }

  .cpv-shell {
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    padding-top: 84px;
    padding-left: 16px;
    padding-right: 16px;
  }

  .cpv-main-grid {
    display: flex;
    align-items: flex-start;
    gap: 0;
  }

  .cpv-breadcrumb {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding: 8px 14px;
    border-radius: 999px;
    font-size: 12px;
    color: #8b95a7;
    background: rgba(255,255,255,0.8);
    border: 1px solid rgba(233, 214, 170, 0.8);
    backdrop-filter: blur(8px);
    box-shadow: 0 10px 24px rgba(185, 158, 74, 0.08);
    margin-bottom: 18px;
  }

  .cpv-breadcrumb a {
    color: #ec4899;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .cpv-breadcrumb a:hover { color: #be185d; }

  .cpv-breadcrumb .cpv-bc-current {
    font-weight: 600;
    color: #b8962e;
    letter-spacing: 0.04em;
  }

  .cpv-sidebar {
    flex-shrink: 0;
    align-self: flex-start;
    background: rgba(255,255,255,0.88);
    border: 1.5px solid #f0e6c8;
    border-radius: 22px;
    box-shadow:
      0 10px 30px rgba(180,150,60,0.08),
      0 2px 10px rgba(236,72,153,0.05);
    overflow: hidden;
    backdrop-filter: blur(10px);
    transition: width 0.3s cubic-bezier(.4,0,.2,1),
                opacity 0.25s ease,
                margin 0.3s cubic-bezier(.4,0,.2,1),
                padding 0.3s cubic-bezier(.4,0,.2,1),
                transform 0.25s ease;
  }

  .cpv-sidebar.visible {
    width: 292px;
    padding: 18px;
    opacity: 1;
    margin-right: 28px;
    pointer-events: auto;
    transform: translateX(0);
  }

  .cpv-sidebar.hidden-side {
    width: 0;
    padding: 0;
    opacity: 0;
    margin-right: 0;
    pointer-events: none;
    transform: translateX(-10px);
  }

  @media (max-width: 767px) {
    .cpv-sidebar { display: none !important; }
    .cpv-shell {
      padding-left: 10px;
      padding-right: 10px;
      padding-top: 80px;
    }
  }

  .cpv-collapse-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 34px;
    height: 34px;
    border-radius: 999px;
    background: rgba(255,255,255,0.96);
    border: 1.5px solid #f0e6c8;
    box-shadow: 0 8px 18px rgba(0,0,0,0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    transition: background 0.18s, box-shadow 0.18s, transform 0.18s;
  }

  .cpv-collapse-btn:hover {
    background: #fff7ed;
    box-shadow: 0 10px 24px rgba(0,0,0,0.12);
    transform: translateY(-1px);
  }

  .cpv-sidebar-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 24px;
    font-weight: 700;
    color: #b8962e;
    margin: 0 0 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.02em;
    padding-right: 42px;
  }

  .cpv-content {
    flex: 1;
    min-width: 0;
    padding-top: 10px;
    padding-bottom: 64px;
  }

  .cpv-hero {
    position: relative;
    overflow: hidden;
    border-radius: 28px;
    padding: 20px 22px 22px;
    margin-bottom: 18px;
    background:
      linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,248,252,0.92) 42%, rgba(255,252,245,0.96) 100%);
    border: 1px solid rgba(233,214,170,0.8);
    box-shadow:
      0 14px 34px rgba(180,150,60,0.08),
      0 3px 14px rgba(236,72,153,0.05);
    backdrop-filter: blur(10px);
  }

  .cpv-hero::before {
    content: "";
    position: absolute;
    width: 260px;
    height: 260px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%);
    top: -100px;
    right: -80px;
    pointer-events: none;
  }

  .cpv-hero::after {
    content: "";
    position: absolute;
    width: 220px;
    height: 220px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(212,175,55,0.10) 0%, transparent 70%);
    bottom: -120px;
    left: -80px;
    pointer-events: none;
  }

  .cpv-hero-top {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .cpv-hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    padding: 8px 14px;
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(212,175,55,0.14), rgba(236,72,153,0.12));
    color: #a96c16;
    border: 1px solid rgba(233,214,170,0.9);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  .cpv-title-wrap {
    text-align: center;
  }

  .cpv-title {
    margin: 0;
    font-family: 'Cormorant Garamond', serif;
    font-size: 42px;
    line-height: 0.98;
    font-weight: 700;
    color: #2f3440;
    letter-spacing: 0.01em;
  }

  .cpv-subtitle {
    margin-top: 10px;
    font-size: 15px;
    font-weight: 500;
    color: #c09b2a;
    letter-spacing: 0.02em;
  }

  .cpv-description {
    margin: 14px auto 0;
    max-width: 760px;
    font-size: 14px;
    line-height: 1.8;
    color: #6b7280;
  }

  .cpv-title-image {
    max-width: 320px;
    max-height: 150px;
    width: auto;
    height: auto;
    user-select: none;
    display: inline-block;
    object-fit: contain;
    filter: drop-shadow(0 10px 18px rgba(236,72,153,0.08));
  }

  .cpv-active-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .cpv-filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px 7px 14px;
    background: rgba(255, 240, 246, 0.96);
    border: 1px solid #f8a3c7;
    border-radius: 999px;
    font-size: 12px;
    color: #be185d;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 6px 16px rgba(236,72,153,0.08);
  }

  .cpv-filter-chip:hover {
    background: #ffe4ef;
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(236,72,153,0.12);
  }

  .cpv-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 22px;
    padding: 14px 16px;
    background: rgba(255,255,255,0.92);
    border: 1.5px solid #f1ead7;
    border-radius: 20px;
    box-shadow:
      0 10px 26px rgba(180,150,60,0.07),
      0 2px 10px rgba(0,0,0,0.03);
    gap: 14px;
    flex-wrap: wrap;
    backdrop-filter: blur(8px);
  }

  .cpv-toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .cpv-result-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 13px;
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(255,247,237,0.95), rgba(255,255,255,0.96));
    border: 1px solid rgba(233,214,170,0.95);
    color: #6b7280;
    font-size: 13px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
  }

  .cpv-result-pill strong {
    color: #374151;
    font-weight: 700;
  }

  .cpv-col-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 6px;
    border-radius: 999px;
    background: rgba(250,250,250,0.8);
    border: 1px solid rgba(229,231,235,0.95);
  }

  .cpv-col-btn {
    width: 40px;
    height: 40px;
    border: 1.5px solid #e8e7eb;
    border-radius: 12px;
    background: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s, background 0.15s;
    position: relative;
    box-shadow: 0 3px 8px rgba(0,0,0,0.03);
  }

  .cpv-col-btn:hover {
    transform: translateY(-1px);
  }

  .cpv-col-btn.active {
    box-shadow: 0 8px 20px rgba(236,72,153,0.12);
  }

  .cpv-col-btn:active { transform: scale(0.95); }

  .cpv-tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: #1f2937;
    color: #fff;
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 8px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
  }

  .cpv-col-btn:hover .cpv-tooltip { opacity: 1; }

  .cpv-grid {
    display: grid;
    gap: 20px;
  }

  .cpv-empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 68px 20px;
    color: #9ca3af;
    background: rgba(255,255,255,0.92);
    border: 1px dashed #dfd7c8;
    border-radius: 24px;
    box-shadow: 0 12px 28px rgba(0,0,0,0.03);
  }

  .cpv-empty-icon {
    font-size: 48px;
    margin-bottom: 14px;
    opacity: 0.45;
  }

  .cpv-empty h3 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 28px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 8px;
  }

  .cpv-empty p {
    font-size: 14px;
    margin: 0;
    color: #6b7280;
  }

  .cpv-fab {
    position: fixed;
    bottom: 24px;
    left: 24px;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 13px 20px;
    border-radius: 999px;
    border: none;
    background: linear-gradient(135deg, #D4AF37 0%, #ec4899 100%);
    color: #fff;
    font-family: 'Jost', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow:
      0 12px 26px rgba(212,175,55,0.28),
      0 6px 18px rgba(236,72,153,0.16);
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .cpv-fab:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow:
      0 16px 32px rgba(212,175,55,0.32),
      0 10px 22px rgba(236,72,153,0.18);
  }

  .cpv-fab:active { transform: scale(0.97); }

  .cpv-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.24);
    backdrop-filter: blur(3px);
    z-index: 45;
    animation: cpvFadeIn 0.2s ease;
  }

  @keyframes cpvFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .cpv-drawer {
    position: fixed;
    left: 0;
    top: 0;
    height: 100%;
    width: min(86vw, 340px);
    background: rgba(255,255,255,0.97);
    box-shadow: 10px 0 36px rgba(0,0,0,0.16);
    border-radius: 0 24px 24px 0;
    padding: 24px 18px;
    overflow-y: auto;
    z-index: 50;
    animation: cpvSlideInLeft 0.22s cubic-bezier(.4,0,.2,1);
    backdrop-filter: blur(10px);
  }

  @keyframes cpvSlideInLeft {
    from { transform: translateX(-100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  .cpv-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1.5px solid #f0e6c8;
  }

  .cpv-drawer-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px;
    font-weight: 700;
    color: #b8962e;
    margin: 0;
  }

  .cpv-drawer-close {
    width: 38px;
    height: 38px;
    border-radius: 999px;
    border: 1.5px solid #e5e7eb;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
    box-shadow: 0 4px 10px rgba(0,0,0,0.05);
  }

  .cpv-drawer-close:hover {
    background: #fff0f6;
    border-color: #fda4af;
    transform: scale(1.04);
  }

  @keyframes cpvFadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .cpv-product-item {
    animation: cpvFadeUp 0.35s ease both;
    min-width: 0;
    width: 100%;
  }

  @media (max-width: 767px) {
    .cpv-content {
      padding-top: 4px;
      padding-bottom: 72px;
    }

    .cpv-hero {
      border-radius: 22px;
      padding: 16px 14px 18px;
      margin-bottom: 16px;
    }

    .cpv-hero-top {
      gap: 12px;
    }

    .cpv-hero-badge {
      padding: 7px 12px;
      font-size: 11px;
    }

    .cpv-title {
      font-size: 31px;
    }

    .cpv-subtitle {
      font-size: 13px;
      margin-top: 8px;
    }

    .cpv-description {
      font-size: 13px;
      line-height: 1.65;
      margin-top: 12px;
    }

    .cpv-title-image {
      max-width: 240px;
      max-height: 110px;
    }

    .cpv-active-filters {
      gap: 7px;
      margin-bottom: 14px;
    }

    .cpv-filter-chip {
      font-size: 11px;
      padding: 6px 10px 6px 12px;
    }

    .cpv-toolbar {
      padding: 12px;
      border-radius: 18px;
      gap: 12px;
    }

    .cpv-toolbar-left {
      width: 100%;
      justify-content: space-between;
    }

    .cpv-result-pill {
      padding: 8px 12px;
      font-size: 12px;
    }

    .cpv-col-controls {
      width: 100%;
      justify-content: flex-end;
      gap: 6px;
      padding: 6px;
    }

    .cpv-col-btn {
      width: 38px;
      height: 38px;
      border-radius: 11px;
    }

    .cpv-fab {
      bottom: 18px;
      left: 16px;
      padding: 12px 16px;
      font-size: 13px;
    }
  }
`;

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeCsvText(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function parseCsvArray(value) {
  return normalizeCsvText(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildSafeFilterUiConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};

  return {
    panelBg:
      typeof cfg.panelBg === "string" && cfg.panelBg.trim()
        ? cfg.panelBg
        : "#ffffff",

    panelBorderColor:
      typeof cfg.panelBorderColor === "string" && cfg.panelBorderColor.trim()
        ? cfg.panelBorderColor
        : "#ead7aa",

    panelTitleColor:
      typeof cfg.panelTitleColor === "string" && cfg.panelTitleColor.trim()
        ? cfg.panelTitleColor
        : "#111827",

    panelSubtitleColor:
      typeof cfg.panelSubtitleColor === "string" && cfg.panelSubtitleColor.trim()
        ? cfg.panelSubtitleColor
        : "#6b7280",

    sectionHeaderBg:
      typeof cfg.sectionHeaderBg === "string" && cfg.sectionHeaderBg.trim()
        ? cfg.sectionHeaderBg
        : "#fff8fb",

    sectionHeaderTextColor:
      typeof cfg.sectionHeaderTextColor === "string" &&
      cfg.sectionHeaderTextColor.trim()
        ? cfg.sectionHeaderTextColor
        : "#1f2937",

    accentColor:
      typeof cfg.accentColor === "string" && cfg.accentColor.trim()
        ? cfg.accentColor
        : "#ec4899",

    accentColor2:
      typeof cfg.accentColor2 === "string" && cfg.accentColor2.trim()
        ? cfg.accentColor2
        : "#d4af37",

    chipBg:
      typeof cfg.chipBg === "string" && cfg.chipBg.trim()
        ? cfg.chipBg
        : "#ffffff",

    chipTextColor:
      typeof cfg.chipTextColor === "string" && cfg.chipTextColor.trim()
        ? cfg.chipTextColor
        : "#374151",

    radiusPx: clampNumber(cfg.radiusPx, 8, 40, 22),
    sectionRadiusPx: clampNumber(cfg.sectionRadiusPx, 6, 32, 18),
    borderWidthPx: clampNumber(cfg.borderWidthPx, 1, 4, 1),

    shadowStyle:
      cfg.shadowStyle === "none" ||
      cfg.shadowStyle === "soft" ||
      cfg.shadowStyle === "medium" ||
      cfg.shadowStyle === "strong"
        ? cfg.shadowStyle
        : "soft",

    sectionGapPx: clampNumber(cfg.sectionGapPx, 8, 40, 20),
    colorDotSizePx: clampNumber(cfg.colorDotSizePx, 16, 40, 26),
    titleSizePx: clampNumber(cfg.titleSizePx, 16, 32, 22),
    sectionTitleSizePx: clampNumber(cfg.sectionTitleSizePx, 13, 24, 17),
    contentTextSizePx: clampNumber(cfg.contentTextSizePx, 11, 20, 14),

    animation:
      cfg.animation === "none" ||
      cfg.animation === "soft" ||
      cfg.animation === "fade" ||
      cfg.animation === "slide"
        ? cfg.animation
        : "soft",

    showSectionIcons: cfg.showSectionIcons !== false,
    showCounters: cfg.showCounters !== false,
    showSelectedSummary: cfg.showSelectedSummary !== false,
    categoriesSearchEnabled: cfg.categoriesSearchEnabled !== false,
    stickyHeader: cfg.stickyHeader === true,
  };
}

function buildSafeCardUiConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};

  const safeCardBorderColor =
    typeof cfg.cardBorderColor === "string" ? cfg.cardBorderColor : "#ecdcb6";

  const safeButtonBorderColor =
    typeof cfg.actionButtonBorderColor === "string"
      ? cfg.actionButtonBorderColor
      : typeof cfg.buttonBorderColor === "string"
        ? cfg.buttonBorderColor
        : safeCardBorderColor;

  return {
    // card base
    cardBg: typeof cfg.cardBg === "string" ? cfg.cardBg : "#ffffff",
    cardBorderColor: safeCardBorderColor,
    cardBorderWidthPx: clampInt(cfg.cardBorderWidthPx, 0, 6, 1),
    cardRadiusPx: clampInt(cfg.cardRadiusPx, 8, 40, 28),
    cardPaddingPx: clampInt(cfg.cardPaddingPx, 0, 40, 12),
    cardShadowStyle:
      cfg.cardShadowStyle === "none" ||
      cfg.cardShadowStyle === "soft" ||
      cfg.cardShadowStyle === "medium" ||
      cfg.cardShadowStyle === "strong"
        ? cfg.cardShadowStyle
        : "soft",

    // image
    imageBg: typeof cfg.imageBg === "string" ? cfg.imageBg : "#faf8f3",
    imageRadiusPx: clampInt(cfg.imageRadiusPx, 0, 40, 24),
    imageFit:
      cfg.imageFit === "cover" || cfg.imageFit === "contain"
        ? cfg.imageFit
        : "cover",

    // text
    titleColor: typeof cfg.titleColor === "string" ? cfg.titleColor : "#2f3440",
    priceColor: typeof cfg.priceColor === "string" ? cfg.priceColor : "#e54497",
    oldPriceColor:
      typeof cfg.oldPriceColor === "string" ? cfg.oldPriceColor : "#9ca3af",
    metaColor: typeof cfg.metaColor === "string" ? cfg.metaColor : "#6b7280",

    titleFontFamily:
      typeof cfg.titleFontFamily === "string" ? cfg.titleFontFamily : "",
    priceFontFamily:
      typeof cfg.priceFontFamily === "string" ? cfg.priceFontFamily : "",
    metaFontFamily:
      typeof cfg.metaFontFamily === "string" ? cfg.metaFontFamily : "",

    // buttons compatible with ProductCard.jsx actual
    favoriteButtonBg:
      typeof cfg.favoriteButtonBg === "string"
        ? cfg.favoriteButtonBg
        : typeof cfg.buttonBg === "string"
          ? cfg.buttonBg
          : "#ffffff",

    cartButtonBg:
      typeof cfg.cartButtonBg === "string"
        ? cfg.cartButtonBg
        : typeof cfg.buttonBg === "string"
          ? cfg.buttonBg
          : "#ffffff",

    favoriteButtonOpacity: clampNumber(cfg.favoriteButtonOpacity, 0, 1, 1),
    cartButtonOpacity: clampNumber(cfg.cartButtonOpacity, 0, 1, 1),

    actionButtonBorderColor: safeButtonBorderColor,
    actionButtonBorderWidthPx: clampInt(
      cfg.actionButtonBorderWidthPx ?? cfg.buttonBorderWidthPx,
      0,
      4,
      1
    ),

    favoriteIconColor:
      typeof cfg.favoriteIconColor === "string" ? cfg.favoriteIconColor : "#d946ef",

    favoriteActiveColor:
      typeof cfg.favoriteActiveColor === "string"
        ? cfg.favoriteActiveColor
        : "#D4AF37",

    cartIconColor:
      typeof cfg.cartIconColor === "string" ? cfg.cartIconColor : "#D4AF37",

    favoriteIconName:
      typeof cfg.favoriteIconName === "string" ? cfg.favoriteIconName : "star",
    cartIconName:
      typeof cfg.cartIconName === "string" ? cfg.cartIconName : "shopping-cart",

    showBorder: cfg.showBorder !== false,
    showShadow: cfg.showShadow !== false,
    showImageBg: cfg.showImageBg !== false,
  };
}

function buildSafeColumnControlsUiConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};

  return {
    buttonBgColor:
      typeof cfg.buttonBgColor === "string" ? cfg.buttonBgColor : "#ffffff",
    buttonBorderColor:
      typeof cfg.buttonBorderColor === "string" ? cfg.buttonBorderColor : "#e8e7eb",
    buttonIconColor:
      typeof cfg.buttonIconColor === "string" ? cfg.buttonIconColor : "#D4AF37",

    hoverButtonBgColor:
      typeof cfg.hoverButtonBgColor === "string"
        ? cfg.hoverButtonBgColor
        : "#ffffff",
    hoverButtonBorderColor:
      typeof cfg.hoverButtonBorderColor === "string"
        ? cfg.hoverButtonBorderColor
        : "#D4AF37",
    hoverButtonIconColor:
      typeof cfg.hoverButtonIconColor === "string"
        ? cfg.hoverButtonIconColor
        : "#D4AF37",

    activeButtonBgColor:
      typeof cfg.activeButtonBgColor === "string"
        ? cfg.activeButtonBgColor
        : "#fff5fa",
    activeButtonBorderColor:
      typeof cfg.activeButtonBorderColor === "string"
        ? cfg.activeButtonBorderColor
        : "#ec4899",
    activeButtonIconColor:
      typeof cfg.activeButtonIconColor === "string"
        ? cfg.activeButtonIconColor
        : "#ec4899",

    buttonRadiusPx: clampInt(cfg.buttonRadiusPx, 8, 24, 12),
    buttonBorderWidthPx: clampInt(cfg.buttonBorderWidthPx, 1, 4, 1),
  };
}

function buildSafeCatalogConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};

  const minPrice = clampNumber(cfg.initialMinPrice, 0, DEFAULT_MAX, DEFAULT_MIN);
  const maxPrice = clampNumber(cfg.initialMaxPrice, 0, DEFAULT_MAX, DEFAULT_MAX);
  const safeMinPrice = Math.min(minPrice, maxPrice);
  const safeMaxPrice = Math.max(minPrice, maxPrice);

  return {
    title: typeof cfg.title === "string" ? cfg.title : "",
    subtitle: typeof cfg.subtitle === "string" ? cfg.subtitle : "",
    description: typeof cfg.description === "string" ? cfg.description : "",
    titleMode:
      cfg.titleMode === "image" || cfg.titleMode === "text" ? cfg.titleMode : "text",
    titleImage: typeof cfg.titleImage === "string" ? cfg.titleImage : "",
    titleImageAlt: typeof cfg.titleImageAlt === "string" ? cfg.titleImageAlt : "",
    showBreadcrumb: cfg.showBreadcrumb !== false,
    showFilters: cfg.showFilters !== false,
    showToolbar: cfg.showToolbar !== false,
    showFilterFab: cfg.showFilterFab !== false,
    showResultCount: cfg.showResultCount !== false,
    columnsDesktop: clampInt(cfg.columnsDesktop, 1, 5, 4),
    columnsTablet: clampInt(cfg.columnsTablet, 1, 4, 3),
    columnsMobile: clampInt(cfg.columnsMobile, 1, 2, 2),
    defaultColsDesktop: clampInt(
      cfg.defaultColsDesktop ?? cfg.columnsDesktop,
      1,
      5,
      clampInt(cfg.columnsDesktop, 1, 5, 4)
    ),
    defaultColsMobile: clampInt(
      cfg.defaultColsMobile ?? cfg.columnsMobile,
      1,
      2,
      clampInt(cfg.columnsMobile, 1, 2, 2)
    ),
    limit: clampInt(cfg.limit, 0, 200, 0),

    sourceMode:
      cfg.sourceMode === "categories" || cfg.sourceMode === "manual"
        ? cfg.sourceMode
        : "all",

    allowedCategoriesText:
      typeof cfg.allowedCategoriesText === "string"
        ? normalizeCsvText(cfg.allowedCategoriesText)
        : "",

    manualProductIdsText:
      typeof cfg.manualProductIdsText === "string"
        ? normalizeCsvText(cfg.manualProductIdsText)
        : "",

    onlyActive: cfg.onlyActive !== false,

    initialCategoriesText:
      typeof cfg.initialCategoriesText === "string"
        ? normalizeCsvText(cfg.initialCategoriesText)
        : "",
    initialColorsText:
      typeof cfg.initialColorsText === "string"
        ? normalizeCsvText(cfg.initialColorsText)
        : "",
    initialMinPrice: safeMinPrice,
    initialMaxPrice: safeMaxPrice,
    emptyTitle:
      typeof cfg.emptyTitle === "string" && cfg.emptyTitle.trim()
        ? cfg.emptyTitle
        : "No se encontraron productos",
    emptyText:
      typeof cfg.emptyText === "string" && cfg.emptyText.trim()
        ? cfg.emptyText
        : "Intenta cambiar los filtros para ver más resultados.",
    filterUiConfig: buildSafeFilterUiConfig(cfg.filterUiConfig),
    cardUiConfig: buildSafeCardUiConfig(cfg.cardUiConfig),
    columnControlsUiConfig: buildSafeColumnControlsUiConfig(
      cfg.columnControlsUiConfig
    ),
  };
}

export default function CatalogPageView({
  page = null,
  catalogConfig = {},
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const safeConfig = useMemo(
    () => buildSafeCatalogConfig(catalogConfig),
    [catalogConfig]
  );

  const [products, setProducts] = useState([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [productPagination, setProductPagination] = useState({
    page: 1,
    limit: 24,
    totalProducts: 0,
    totalPages: 0,
    from: 0,
    to: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [productsLoading, setProductsLoading] = useState(false);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [priceRange, setPriceRange] = useState([
    safeConfig.initialMinPrice,
    safeConfig.initialMaxPrice,
  ]);

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [isNarrowMobile, setIsNarrowMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 390 : false
  );

  const desktopDefaultCols = clampInt(safeConfig.defaultColsDesktop, 1, 5, 4);
  const mobileDefaultCols = clampInt(safeConfig.defaultColsMobile, 1, 2, 2);
  const initialCols =
    typeof window !== "undefined" && window.innerWidth < 768
      ? mobileDefaultCols
      : desktopDefaultCols;

  const [cols, setCols] = useState(initialCols);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [hydratedFromURL, setHydratedFromURL] = useState(false);
  const [hoveredColButton, setHoveredColButton] = useState(null);

  useEffect(() => {
    const checkViewport = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsNarrowMobile(width < 390);
    };

    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  useEffect(() => {
    const nextDesktopDefaultCols = clampInt(
      safeConfig.defaultColsDesktop,
      1,
      5,
      4
    );
    const nextMobileDefaultCols = clampInt(
      safeConfig.defaultColsMobile,
      1,
      2,
      2
    );
    const nextDesktopMaxCols = clampInt(safeConfig.columnsDesktop, 1, 5, 4);
    const nextMobileMaxCols = clampInt(safeConfig.columnsMobile, 1, 2, 2);

    if (!hydratedFromURL) {
      setCols(isMobile ? nextMobileDefaultCols : nextDesktopDefaultCols);
      return;
    }

    if (isMobile) {
      setCols((prev) =>
        Math.max(
          1,
          Math.min(Number(prev || nextMobileDefaultCols), nextMobileMaxCols)
        )
      );
    } else {
      setCols((prev) =>
        Math.max(
          1,
          Math.min(Number(prev || nextDesktopDefaultCols), nextDesktopMaxCols)
        )
      );
    }
  }, [
    safeConfig.columnsDesktop,
    safeConfig.columnsMobile,
    safeConfig.defaultColsDesktop,
    safeConfig.defaultColsMobile,
    isMobile,
    hydratedFromURL,
  ]);

  useEffect(() => {
    if (hydratedFromURL) return;

    const initialCategories = parseCsvArray(safeConfig.initialCategoriesText);
    const initialColors = parseCsvArray(safeConfig.initialColorsText);

    const parseArray = (v) =>
      (v || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const urlColors = parseArray(searchParams.get("colors"));
    const urlCats = parseArray(searchParams.get("cats"));

    const urlMin = Number(searchParams.get("min"));
    const urlMax = Number(searchParams.get("max"));

    const hasValidMin = Number.isFinite(urlMin);
    const hasValidMax = Number.isFinite(urlMax);
    const isBrokenZeroRange = hasValidMin && hasValidMax && urlMin === 0 && urlMax === 0;

    const min = !isBrokenZeroRange && hasValidMin
      ? urlMin
      : safeConfig.initialMinPrice;

    const max = !isBrokenZeroRange && hasValidMax
      ? urlMax
      : safeConfig.initialMaxPrice;

const safeMin = Math.max(DEFAULT_MIN, Math.min(min, max));
const safeMax = Math.min(DEFAULT_MAX, Math.max(min, max));

    const urlCols = Number(searchParams.get("cols"));
    const maxDesktopCols = clampInt(safeConfig.columnsDesktop, 1, 5, 4);
    const maxMobileCols = clampInt(safeConfig.columnsMobile, 1, 2, 2);
    const defaultDesktopCols = clampInt(
      safeConfig.defaultColsDesktop,
      1,
      5,
      4
    );
    const defaultMobileCols = clampInt(safeConfig.defaultColsMobile, 1, 2, 2);

    const fallbackCols = isMobile ? defaultMobileCols : defaultDesktopCols;
    const parsedCols = Number.isFinite(urlCols) ? urlCols : fallbackCols;

    setSelectedColors(urlColors.length ? urlColors : initialColors);
    setSelectedCategories(urlCats.length ? urlCats : initialCategories);
    setPriceRange([safeMin, safeMax]);

    if (isMobile) {
      setCols(Math.max(1, Math.min(parsedCols, maxMobileCols)));
    } else {
      setCols(Math.max(1, Math.min(parsedCols, maxDesktopCols)));
    }

    setHydratedFromURL(true);
  }, [
    hydratedFromURL,
    isMobile,
    safeConfig.columnsDesktop,
    safeConfig.columnsMobile,
    safeConfig.defaultColsDesktop,
    safeConfig.defaultColsMobile,
    safeConfig.initialCategoriesText,
    safeConfig.initialColorsText,
    safeConfig.initialMinPrice,
    safeConfig.initialMaxPrice,
    searchParams,
  ]);

  useEffect(() => {
    if (!hydratedFromURL) return;

    const maxMobileCols = clampInt(safeConfig.columnsMobile, 1, 2, 2);
    const maxDesktopCols = clampInt(safeConfig.columnsDesktop, 1, 5, 4);

    const colsToSave = isMobile
      ? Math.min(cols, maxMobileCols)
      : Math.min(cols, maxDesktopCols);

    const params = new URLSearchParams();
    if (selectedColors.length) params.set("colors", selectedColors.join(","));
    if (selectedCategories.length)
      params.set("cats", selectedCategories.join(","));
    params.set("min", String(priceRange[0]));
    params.set("max", String(priceRange[1]));
    params.set("cols", String(colsToSave));

    const t = setTimeout(() => {
      setSearchParams(params, { replace: true });
    }, 200);

    return () => clearTimeout(t);
  }, [
    selectedColors,
    selectedCategories,
    priceRange,
    cols,
    isMobile,
    hydratedFromURL,
    setSearchParams,
    safeConfig.columnsDesktop,
    safeConfig.columnsMobile,
  ]);

  useEffect(() => {
    setCatalogPage(1);
  }, [
    selectedColors,
    selectedCategories,
    priceRange,
    safeConfig.limit,
    safeConfig.sourceMode,
    safeConfig.allowedCategoriesText,
    safeConfig.manualProductIdsText,
  ]);

  useEffect(() => {
    if (!hydratedFromURL) return undefined;
    const categoryScope = safeConfig.sourceMode === "categories"
      ? parseCsvArray(safeConfig.allowedCategoriesText)
      : [];
    const productKeys = safeConfig.sourceMode === "manual"
      ? parseCsvArray(safeConfig.manualProductIdsText)
      : [];
    if (
      (safeConfig.sourceMode === "categories" && categoryScope.length === 0) ||
      (safeConfig.sourceMode === "manual" && productKeys.length === 0)
    ) {
      setProducts([]);
      setProductPagination((current) => ({
        ...current,
        page: catalogPage,
        totalProducts: 0,
        totalPages: 0,
        from: 0,
        to: 0,
        hasPreviousPage: catalogPage > 1,
        hasNextPage: false,
      }));
      return undefined;
    }

    const controller = new AbortController();
    const pageLimit = safeConfig.limit > 0
      ? clampInt(safeConfig.limit, 1, 100, 24)
      : 24;
    const params = new URLSearchParams({
      page: String(catalogPage),
      limit: String(pageLimit),
      sort: "-createdAt",
      status: "published",
      minPrice: String(priceRange[0]),
      maxPrice: String(priceRange[1]),
    });
    if (selectedCategories.length) {
      selectedCategories.forEach((value) => params.append("category", value));
    }
    selectedColors.forEach((value) => params.append("color", value));
    categoryScope.forEach((value) => params.append("categoryScope", value));
    productKeys.forEach((value) => params.append("productKeys", value));

    setProductsLoading(true);
    fetch(`${API}/api/products?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        const pageResult = normalizeProductPageResponse(payload, pageLimit);
        if (
          pageResult.pagination.totalPages > 0 &&
          pageResult.pagination.page > pageResult.pagination.totalPages
        ) {
          setCatalogPage(pageResult.pagination.totalPages);
          return;
        }
        setProducts(pageResult.products);
        setProductPagination(pageResult.pagination);
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        console.error("Error al cargar productos del catálogo:", error);
        setProducts([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setProductsLoading(false);
      });

    return () => controller.abort();
  }, [
    catalogPage,
    hydratedFromURL,
    priceRange,
    safeConfig.allowedCategoriesText,
    safeConfig.limit,
    safeConfig.manualProductIdsText,
    safeConfig.sourceMode,
    selectedCategories,
    selectedColors,
  ]);

  const filteredProducts = products;

  const activeFilters = [
    ...selectedCategories.map((c) => ({ type: "cat", label: c })),
    ...selectedColors.map((c) => ({ type: "color", label: c })),
    ...(priceRange[0] > DEFAULT_MIN || priceRange[1] < DEFAULT_MAX
      ? [
          {
            type: "price",
            label: `$${(priceRange[0] / 1000).toFixed(0)}k – $${(
              priceRange[1] / 1000
            ).toFixed(0)}k`,
          },
        ]
      : []),
  ];

  const removeFilter = (filter) => {
    if (filter.type === "cat") {
      setSelectedCategories((prev) =>
        prev.filter((item) => item !== filter.label)
      );
    }
    if (filter.type === "color") {
      setSelectedColors((prev) => prev.filter((item) => item !== filter.label));
    }
    if (filter.type === "price") {
      setPriceRange([DEFAULT_MIN, DEFAULT_MAX]);
    }
  };

  const maxDesktopCols = clampInt(safeConfig.columnsDesktop, 1, 5, 4);
  const maxMobileCols = clampInt(safeConfig.columnsMobile, 1, 2, 2);

  const effectiveCols = isMobile
    ? Math.max(1, Math.min(cols, maxMobileCols))
    : Math.max(1, Math.min(cols, maxDesktopCols));

  const renderedCols = isMobile && isNarrowMobile ? 1 : effectiveCols;

  const title = safeConfig.title || page?.name || "Catálogo";
  const subtitle = safeConfig.subtitle || "";
  const description = safeConfig.description || "";
  const titleImage = String(safeConfig.titleImage || "").trim();
  const titleImageAlt = String(
    safeConfig.titleImageAlt || title || "Catálogo"
  ).trim();

  const gridStyle = {
    gap: isMobile ? "14px" : renderedCols === 1 ? "18px" : "22px",
    maxWidth: (() => {
      if (renderedCols === 1) {
        return isMobile ? "340px" : "720px";
      }
      return isMobile ? "470px" : "100%";
    })(),
    margin: renderedCols === 1 ? "0 auto" : undefined,
    width: "100%",
  };

  const columnControlsUi = safeConfig.columnControlsUiConfig || {};

  const normalButtonBgColor =
    typeof columnControlsUi.buttonBgColor === "string"
      ? columnControlsUi.buttonBgColor
      : "#ffffff";

  const normalButtonBorderColor =
    typeof columnControlsUi.buttonBorderColor === "string"
      ? columnControlsUi.buttonBorderColor
      : "#e8e7eb";

  const normalButtonIconColor =
    typeof columnControlsUi.buttonIconColor === "string"
      ? columnControlsUi.buttonIconColor
      : "#D4AF37";

  const activeButtonBgColor =
    typeof columnControlsUi.activeButtonBgColor === "string"
      ? columnControlsUi.activeButtonBgColor
      : "#fff5fa";

  const activeButtonBorderColor =
    typeof columnControlsUi.activeButtonBorderColor === "string"
      ? columnControlsUi.activeButtonBorderColor
      : "#ec4899";

  const activeButtonIconColor =
    typeof columnControlsUi.activeButtonIconColor === "string"
      ? columnControlsUi.activeButtonIconColor
      : "#ec4899";

  const hoverButtonBgColor =
    typeof columnControlsUi.hoverButtonBgColor === "string"
      ? columnControlsUi.hoverButtonBgColor
      : "#ffffff";

  const hoverButtonBorderColor =
    typeof columnControlsUi.hoverButtonBorderColor === "string"
      ? columnControlsUi.hoverButtonBorderColor
      : "#D4AF37";

  const hoverButtonIconColor =
    typeof columnControlsUi.hoverButtonIconColor === "string"
      ? columnControlsUi.hoverButtonIconColor
      : "#D4AF37";

  const columnButtonRadiusPx = clampInt(
    columnControlsUi.buttonRadiusPx,
    8,
    24,
    12
  );

  const columnButtonBorderWidthPx = clampInt(
    columnControlsUi.buttonBorderWidthPx,
    1,
    4,
    1
  );

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      <div className="cpv-page flex min-h-screen flex-col">
        <div className="cpv-shell">
          <div className="cpv-main-grid">
            {safeConfig.showFilters && (
              <aside
                className={`cpv-sidebar ${
                  sidebarVisible ? "visible" : "hidden-side"
                }`}
                style={{ position: "relative" }}
              >
                {sidebarVisible && (
                  <>
                    <button
                      className="cpv-collapse-btn"
                      onClick={() => setSidebarVisible(false)}
                      title="Ocultar filtros"
                      aria-label="Ocultar filtros"
                    >
                      <ChevronLeft size={16} color="#9ca3af" />
                    </button>

                    <div className="cpv-sidebar-title">
                      <SlidersHorizontal size={18} />
                      Filtros
                    </div>

                    <FilterSidebar
                      selectedCategories={selectedCategories}
                      onCategoryChange={setSelectedCategories}
                      selectedColors={selectedColors}
                      onColorChange={setSelectedColors}
                      priceRange={priceRange}
                      onPriceChange={setPriceRange}
                      filterUiConfig={safeConfig.filterUiConfig}
                    />
                  </>
                )}
              </aside>
            )}

            <main className="cpv-content">
              {safeConfig.showBreadcrumb && (
                <nav className="cpv-breadcrumb">
                  <Link to="/">Home</Link>
                  <span>›</span>
                  <span className="cpv-bc-current">{title}</span>
                </nav>
              )}

              <section className="cpv-hero">
                <div className="cpv-hero-top">
                  <div className="cpv-hero-badge">
                    <Sparkles size={14} />
                    Selección destacada
                  </div>

                  <div className="cpv-title-wrap">
                    {safeConfig.titleMode === "image" && titleImage ? (
                      <img
                        src={titleImage}
                        alt={titleImageAlt}
                        className="cpv-title-image"
                        draggable="false"
                      />
                    ) : (
                      <>
                        <h1 className="cpv-title">{title}</h1>
                        {subtitle ? (
                          <p className="cpv-subtitle">{subtitle}</p>
                        ) : null}
                      </>
                    )}

                    {description ? (
                      <p className="cpv-description">{description}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              {activeFilters.length > 0 && (
                <div className="cpv-active-filters">
                  {activeFilters.map((filter, index) => (
                    <button
                      key={`${filter.type}-${filter.label}-${index}`}
                      className="cpv-filter-chip"
                      onClick={() => removeFilter(filter)}
                    >
                      {filter.label}
                      <X size={12} />
                    </button>
                  ))}

                  <button
                    className="cpv-filter-chip"
                    style={{
                      background: "#f9fafb",
                      borderColor: "#e5e7eb",
                      color: "#6b7280",
                    }}
                    onClick={() => {
                      setSelectedCategories([]);
                      setSelectedColors([]);
                      setPriceRange([DEFAULT_MIN, DEFAULT_MAX]);
                    }}
                  >
                    Limpiar todo
                  </button>
                </div>
              )}

              {safeConfig.showToolbar && (
                <div className="cpv-toolbar">
                  <div className="cpv-toolbar-left">
                    <span className="cpv-result-pill">
                      <strong>{productPagination.totalProducts}</strong>
                      {productPagination.totalProducts === 1
                        ? " producto"
                        : " productos"}
                    </span>
                  </div>

                  <div className="cpv-col-controls">
                    {[1, 2, 3, 4, 5].map((n) => {
                      if (isMobile && n > maxMobileCols) return null;
                      if (!isMobile && n > maxDesktopCols) return null;

                      const isActive = effectiveCols === n;
                      const isHovered = hoveredColButton === n;

                      const currentButtonBg = isActive
                        ? activeButtonBgColor
                        : isHovered
                          ? hoverButtonBgColor
                          : normalButtonBgColor;

                      const currentButtonBorder = isActive
                        ? activeButtonBorderColor
                        : isHovered
                          ? hoverButtonBorderColor
                          : normalButtonBorderColor;

                      const currentIconColor = isActive
                        ? activeButtonIconColor
                        : isHovered
                          ? hoverButtonIconColor
                          : normalButtonIconColor;

                      return (
                        <div key={n} style={{ position: "relative" }}>
                          <button
                            className={`cpv-col-btn ${isActive ? "active" : ""}`}
                            onClick={() => setCols(n)}
                            onMouseEnter={() => setHoveredColButton(n)}
                            onMouseLeave={() => setHoveredColButton(null)}
                            aria-label={n === 1 ? "Vista lista" : `${n} columnas`}
                            style={{
                              background: currentButtonBg,
                              borderColor: currentButtonBorder,
                              borderWidth: `${columnButtonBorderWidthPx}px`,
                              borderRadius: `${columnButtonRadiusPx}px`,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: n === 1 ? 0 : "3px",
                                flexDirection: n === 1 ? "column" : "row",
                                width: "100%",
                                height: "100%",
                                padding: "6px",
                              }}
                            >
                              {n === 1
                                ? [...Array(3)].map((_, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        display: "block",
                                        width: "20px",
                                        height: "2px",
                                        background: currentIconColor,
                                        borderRadius: "2px",
                                        margin: "1.5px 0",
                                      }}
                                    />
                                  ))
                                : Array.from({ length: n }).map((_, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        display: "block",
                                        width: "2px",
                                        height: "16px",
                                        background: currentIconColor,
                                        borderRadius: "2px",
                                      }}
                                    />
                                  ))}
                            </div>

                            <span className="cpv-tooltip">
                              {n === 1 ? "Lista" : `${n} columnas`}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div
                className={`cpv-grid ${colClasses[renderedCols] || colClasses[4]}`}
                style={gridStyle}
              >
                {productsLoading ? (
                  <div className="cpv-empty">
                    <p>Cargando productos...</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="cpv-empty">
                    <div className="cpv-empty-icon">🔍</div>
                    <h3>{safeConfig.emptyTitle}</h3>
                    <p>{safeConfig.emptyText}</p>
                  </div>
                ) : (
                  filteredProducts.map((product, idx) => (
                    <div
                      key={product._id}
                      className="cpv-product-item"
                      style={{
                        animationDelay: `${Math.min(idx * 45, 420)}ms`,
                      }}
                    >
                      <ProductCard
                        product={product}
                        cols={renderedCols}
                        cardUiConfig={safeConfig.cardUiConfig}
                      />
                    </div>
                  ))
                )}
              </div>

              {productPagination.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    className="cpv-filter-chip"
                    disabled={!productPagination.hasPreviousPage || productsLoading}
                    onClick={() => setCatalogPage((current) => Math.max(1, current - 1))}
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-gray-600">
                    Página {productPagination.page} de {productPagination.totalPages}
                  </span>
                  <button
                    type="button"
                    className="cpv-filter-chip"
                    disabled={!productPagination.hasNextPage || productsLoading}
                    onClick={() => setCatalogPage((current) => current + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </main>
          </div>

          {safeConfig.showFilters && safeConfig.showFilterFab && (
            <button
              className="cpv-fab"
              onClick={() =>
                isMobile
                  ? setMobileDrawerOpen(true)
                  : setSidebarVisible((v) => !v)
              }
              title="Mostrar/ocultar filtros"
              aria-label="Mostrar/ocultar filtros"
            >
              <Filter className="h-5 w-5" />
              <span style={{ display: isMobile ? "none" : undefined }}>
                {sidebarVisible ? "Ocultar filtros" : "Filtros"}
              </span>

              {activeFilters.length > 0 && (
                <span
                  style={{
                    background: "rgba(255,255,255,0.26)",
                    borderRadius: "999px",
                    padding: "1px 8px",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  {activeFilters.length}
                </span>
              )}
            </button>
          )}

          {safeConfig.showFilters && mobileDrawerOpen && (
            <>
              <div
                className="cpv-overlay"
                onClick={() => setMobileDrawerOpen(false)}
              />

              <aside
                className="cpv-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Filtros"
              >
                <div className="cpv-drawer-header">
                  <h3 className="cpv-drawer-title">Filtros</h3>
                  <button
                    className="cpv-drawer-close"
                    onClick={() => setMobileDrawerOpen(false)}
                    title="Cerrar"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <FilterSidebar
                  selectedCategories={selectedCategories}
                  onCategoryChange={setSelectedCategories}
                  selectedColors={selectedColors}
                  onColorChange={setSelectedColors}
                  priceRange={priceRange}
                  onPriceChange={setPriceRange}
                  filterUiConfig={safeConfig.filterUiConfig}
                />
              </aside>
            </>
          )}
        </div>
      </div>
    </>
  );
}
