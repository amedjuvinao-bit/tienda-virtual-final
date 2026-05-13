// src/pages/Carrito.jsx
import React, { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import FooterSection from "../components/FooterSection";
import WhatsAppButton from "../components/WhatsAppButton";
import { useCart } from "../context/CartContext";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function buildSafeCartPageConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};

  return {
    titleMode:
      cfg.titleMode === "text" || cfg.titleMode === "image" ? cfg.titleMode : "image",
    titleText:
      typeof cfg.titleText === "string" && cfg.titleText.trim()
        ? cfg.titleText
        : "Tu carrito",
    titleImage: typeof cfg.titleImage === "string" ? cfg.titleImage : "",
    titleImageAlt:
      typeof cfg.titleImageAlt === "string" && cfg.titleImageAlt.trim()
        ? cfg.titleImageAlt
        : "Título Carrito",

    showHeader: cfg.showHeader !== false,
    showFooter: cfg.showFooter !== false,
    showWhatsAppButton: cfg.showWhatsAppButton !== false,
    showBreadcrumb: cfg.showBreadcrumb !== false,
    showTableHeader: cfg.showTableHeader !== false,
    showRemoveButton: cfg.showRemoveButton !== false,
    showQuantityControls: cfg.showQuantityControls !== false,
    showSubtotal: cfg.showSubtotal !== false,
    showShippingMessage: cfg.showShippingMessage !== false,
    showCheckoutButton: cfg.showCheckoutButton !== false,
    showEmptyState: cfg.showEmptyState !== false,

    breadcrumbHomeText:
      typeof cfg.breadcrumbHomeText === "string" && cfg.breadcrumbHomeText.trim()
        ? cfg.breadcrumbHomeText
        : "Home",
    breadcrumbCurrentText:
      typeof cfg.breadcrumbCurrentText === "string" && cfg.breadcrumbCurrentText.trim()
        ? cfg.breadcrumbCurrentText
        : "Tu carrito",
    tableProductText:
      typeof cfg.tableProductText === "string" && cfg.tableProductText.trim()
        ? cfg.tableProductText
        : "Producto",
    tablePriceText:
      typeof cfg.tablePriceText === "string" && cfg.tablePriceText.trim()
        ? cfg.tablePriceText
        : "Precio",
    tableQuantityText:
      typeof cfg.tableQuantityText === "string" && cfg.tableQuantityText.trim()
        ? cfg.tableQuantityText
        : "Cantidad",
    tableTotalText:
      typeof cfg.tableTotalText === "string" && cfg.tableTotalText.trim()
        ? cfg.tableTotalText
        : "Total",
    removeButtonText:
      typeof cfg.removeButtonText === "string" && cfg.removeButtonText.trim()
        ? cfg.removeButtonText
        : "Eliminar",
    colorLabelText:
      typeof cfg.colorLabelText === "string" && cfg.colorLabelText.trim()
        ? cfg.colorLabelText
        : "Color:",
    sizeLabelText:
      typeof cfg.sizeLabelText === "string" && cfg.sizeLabelText.trim()
        ? cfg.sizeLabelText
        : "Talla:",
    subtotalLabelText:
      typeof cfg.subtotalLabelText === "string" && cfg.subtotalLabelText.trim()
        ? cfg.subtotalLabelText
        : "Subtotal:",
    shippingMessageText:
      typeof cfg.shippingMessageText === "string" && cfg.shippingMessageText.trim()
        ? cfg.shippingMessageText
        : "Impuestos y envío calculado al finalizar la compra",
    checkoutButtonText:
      typeof cfg.checkoutButtonText === "string" && cfg.checkoutButtonText.trim()
        ? cfg.checkoutButtonText
        : "CHECK-OUT",
    emptyStateTitle:
      typeof cfg.emptyStateTitle === "string" && cfg.emptyStateTitle.trim()
        ? cfg.emptyStateTitle
        : "Tu carrito está vacío",
    emptyStateText:
      typeof cfg.emptyStateText === "string" && cfg.emptyStateText.trim()
        ? cfg.emptyStateText
        : "Aún no has agregado productos a tu carrito.",
    continueShoppingText:
      typeof cfg.continueShoppingText === "string" && cfg.continueShoppingText.trim()
        ? cfg.continueShoppingText
        : "Seguir comprando",

    style: {
      pageBg: typeof cfg?.style?.pageBg === "string" ? cfg.style.pageBg : "#fdf2f8",
      contentMaxWidthPx: clampInt(cfg?.style?.contentMaxWidthPx, 900, 1800, 1152),
      contentTopPaddingPx: clampInt(cfg?.style?.contentTopPaddingPx, 0, 240, 100),

      breadcrumbTextColor:
        typeof cfg?.style?.breadcrumbTextColor === "string"
          ? cfg.style.breadcrumbTextColor
          : "#d4af37",
      breadcrumbLinkColor:
        typeof cfg?.style?.breadcrumbLinkColor === "string"
          ? cfg.style.breadcrumbLinkColor
          : "#db2777",

      titleTextColor:
        typeof cfg?.style?.titleTextColor === "string"
          ? cfg.style.titleTextColor
          : "#111827",
      titleFontSizePx: clampInt(cfg?.style?.titleFontSizePx, 18, 72, 34),
      titleImageHeightPx: clampInt(cfg?.style?.titleImageHeightPx, 24, 220, 80),

      cardBg: typeof cfg?.style?.cardBg === "string" ? cfg.style.cardBg : "#ffffff",
      cardBorderColor:
        typeof cfg?.style?.cardBorderColor === "string"
          ? cfg.style.cardBorderColor
          : "#d4af37",
      cardRadiusPx: clampInt(cfg?.style?.cardRadiusPx, 0, 40, 16),
      cardPaddingPx: clampInt(cfg?.style?.cardPaddingPx, 8, 48, 24),

      shadowStyle:
        cfg?.style?.shadowStyle === "none" ||
        cfg?.style?.shadowStyle === "soft" ||
        cfg?.style?.shadowStyle === "medium" ||
        cfg?.style?.shadowStyle === "strong"
          ? cfg.style.shadowStyle
          : "soft",

      textPrimaryColor:
        typeof cfg?.style?.textPrimaryColor === "string"
          ? cfg.style.textPrimaryColor
          : "#111827",
      textSecondaryColor:
        typeof cfg?.style?.textSecondaryColor === "string"
          ? cfg.style.textSecondaryColor
          : "#4b5563",
      accentColor:
        typeof cfg?.style?.accentColor === "string"
          ? cfg.style.accentColor
          : "#ec4899",
      goldColor:
        typeof cfg?.style?.goldColor === "string"
          ? cfg.style.goldColor
          : "#d4af37",

      tableHeaderTextColor:
        typeof cfg?.style?.tableHeaderTextColor === "string"
          ? cfg.style.tableHeaderTextColor
          : "#d4af37",
      tableLineColor:
        typeof cfg?.style?.tableLineColor === "string"
          ? cfg.style.tableLineColor
          : "#d4af37",

      quantityBorderColor:
        typeof cfg?.style?.quantityBorderColor === "string"
          ? cfg.style.quantityBorderColor
          : "#d4af37",
      quantityTextColor:
        typeof cfg?.style?.quantityTextColor === "string"
          ? cfg.style.quantityTextColor
          : "#ec4899",
      quantityRadiusPx: clampInt(cfg?.style?.quantityRadiusPx, 0, 30, 8),

      checkoutButtonBg:
        typeof cfg?.style?.checkoutButtonBg === "string"
          ? cfg.style.checkoutButtonBg
          : "#f472b6",
      checkoutButtonTextColor:
        typeof cfg?.style?.checkoutButtonTextColor === "string"
          ? cfg.style.checkoutButtonTextColor
          : "#ffffff",
      checkoutButtonRadiusPx: clampInt(cfg?.style?.checkoutButtonRadiusPx, 0, 40, 999),
      checkoutButtonStyle:
        cfg?.style?.checkoutButtonStyle === "pill" ||
        cfg?.style?.checkoutButtonStyle === "rounded" ||
        cfg?.style?.checkoutButtonStyle === "square"
          ? cfg.style.checkoutButtonStyle
          : "pill",

      subtotalTextColor:
        typeof cfg?.style?.subtotalTextColor === "string"
          ? cfg.style.subtotalTextColor
          : "#111827",
      subtotalValueColor:
        typeof cfg?.style?.subtotalValueColor === "string"
          ? cfg.style.subtotalValueColor
          : "#ec4899",

      imageRadiusPx: clampInt(cfg?.style?.imageRadiusPx, 0, 30, 12),
      imageWidthPx: clampInt(cfg?.style?.imageWidthPx, 40, 220, 80),
      imageHeightPx: clampInt(cfg?.style?.imageHeightPx, 40, 220, 80),
    },
  };
}

function shadowClassFromStyle(shadowStyle) {
  if (shadowStyle === "none") return "";
  if (shadowStyle === "medium") return "shadow-md";
  if (shadowStyle === "strong") return "shadow-xl";
  return "shadow";
}

function getCartItemId(item) {
  return item?._id || item?.id || "";
}

export default function CartPage() {
  const { cart, increaseQuantity, decreaseQuantity, removeFromCart } = useCart();

  const [config, setConfig] = useState(buildSafeCartPageConfig({}));
  const [pageEnabled, setPageEnabled] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchCartPageConfig = async () => {
      try {
        setLoadingConfig(true);

        const res = await fetch(`${API_BASE}/api/pages/carrito`);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.message || `HTTP ${res.status}`);
        }

        if (!isMounted) return;

        setConfig(buildSafeCartPageConfig(data?.cartPageConfig));
        setPageEnabled(data?.enabled !== false);
      } catch (error) {
        console.error("Error cargando configuración de carrito:", error);
        if (!isMounted) return;
        setConfig(buildSafeCartPageConfig({}));
        setPageEnabled(true);
      } finally {
        if (isMounted) {
          setLoadingConfig(false);
        }
      }
    };

    fetchCartPageConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );

  const style = config.style || {};
  const shadowClass = shadowClassFromStyle(style.shadowStyle);

  const checkoutButtonRadius =
    style.checkoutButtonStyle === "pill"
      ? 999
      : style.checkoutButtonStyle === "rounded"
      ? Math.min(style.checkoutButtonRadiusPx, 18)
      : 8;

  const titleImageSrc = config.titleImage || "PaginaCarrito/Titulotucarrito.png";

  const contentWrapperStyle = useMemo(
    () => ({
      maxWidth: `${style.contentMaxWidthPx}px`,
      paddingTop: `${style.contentTopPaddingPx}px`,
    }),
    [style.contentMaxWidthPx, style.contentTopPaddingPx]
  );

  if (!pageEnabled && !loadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center text-gray-500">La página carrito está inactiva.</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: style.pageBg,
      }}
    >
      {config.showHeader && <Header />}

      <div className="mx-auto px-4 max-[360px]:px-2 text-center" style={contentWrapperStyle}>
        {config.showBreadcrumb && (
          <div
            className="text-sm max-[360px]:text-xs text-left mb-4"
            style={{ color: style.breadcrumbTextColor }}
          >
            <Link
              to="/"
              className="hover:underline cursor-pointer"
              style={{ color: style.breadcrumbLinkColor }}
            >
              {config.breadcrumbHomeText}
            </Link>
            <span className="mx-2">›</span>
            <span
              className="font-semibold"
              style={{ color: style.breadcrumbTextColor }}
            >
              {config.breadcrumbCurrentText}
            </span>
          </div>
        )}

        <div className="flex justify-center mb-8 max-[360px]:mb-5">
          {config.titleMode === "text" ? (
            <h1
              className="font-semibold text-center max-[360px]:leading-tight"
              style={{
                color: style.titleTextColor,
                fontSize: `${style.titleFontSizePx}px`,
              }}
            >
              {config.titleText}
            </h1>
          ) : (
            <img
              src={titleImageSrc}
              alt={config.titleImageAlt}
              className="object-contain max-w-full max-[360px]:max-w-[82%]"
              style={{ height: `${style.titleImageHeightPx}px` }}
            />
          )}
        </div>

        {cart.length === 0 ? (
          config.showEmptyState ? (
            <div
              className={`w-full mx-auto ${shadowClass}`}
              style={{
                maxWidth: `${style.contentMaxWidthPx}px`,
                backgroundColor: style.cardBg,
                borderRadius: `${style.cardRadiusPx}px`,
                border: `1px solid ${style.cardBorderColor}`,
                padding: `${style.cardPaddingPx}px`,
              }}
            >
              <h2
                className="text-2xl font-bold mb-3"
                style={{ color: style.textPrimaryColor }}
              >
                {config.emptyStateTitle}
              </h2>
              <p
                className="text-sm mb-6"
                style={{ color: style.textSecondaryColor }}
              >
                {config.emptyStateText}
              </p>

              <Link to="/lo-nuevo">
                <button
                  className="font-bold py-2 px-6"
                  style={{
                    backgroundColor: style.checkoutButtonBg,
                    color: style.checkoutButtonTextColor,
                    borderRadius: `${checkoutButtonRadius}px`,
                  }}
                >
                  {config.continueShoppingText}
                </button>
              </Link>
            </div>
          ) : null
        ) : (
          <>
            <div
              className={`overflow-x-auto w-full mx-auto ${shadowClass}`}
              style={{
                maxWidth: `${style.contentMaxWidthPx}px`,
                backgroundColor: style.cardBg,
                borderRadius: `${style.cardRadiusPx}px`,
                border: `1px solid ${style.cardBorderColor}`,
                padding: `${style.cardPaddingPx}px`,
              }}
            >
              <table className="w-full text-left border-separate border-spacing-0">
                {config.showTableHeader && (
                  <thead className="hidden sm:table-header-group">
                    <tr>
                      <th
                        className="py-3 px-4 font-bold border-b"
                        style={{
                          color: style.tableHeaderTextColor,
                          borderColor: style.tableLineColor,
                        }}
                      >
                        {config.tableProductText}
                      </th>
                      <th
                        className="py-3 px-4 font-bold border-b"
                        style={{
                          color: style.tableHeaderTextColor,
                          borderColor: style.tableLineColor,
                        }}
                      >
                        {config.tablePriceText}
                      </th>
                      <th
                        className="py-3 px-4 font-bold border-b"
                        style={{
                          color: style.tableHeaderTextColor,
                          borderColor: style.tableLineColor,
                        }}
                      >
                        {config.tableQuantityText}
                      </th>
                      <th
                        className="py-3 px-4 font-bold border-b"
                        style={{
                          color: style.tableHeaderTextColor,
                          borderColor: style.tableLineColor,
                        }}
                      >
                        {config.tableTotalText}
                      </th>
                    </tr>
                  </thead>
                )}

                <tbody>
                  {cart.map((item) => {
                    const itemId = getCartItemId(item);

                    return (
                      <tr
                        key={`${itemId}-${item.color}-${item.size}`}
                        className="block sm:table-row py-4"
                        style={{
                          borderBottom: `1px solid ${style.tableLineColor}`,
                        }}
                      >
                        <td colSpan={4} className="block sm:hidden pb-4">
                          <div className="flex gap-3 max-[360px]:gap-2 items-start">
                            <img
                              src={item.image}
                              alt={item.title}
                              className="object-cover shrink-0 max-[360px]:w-[48px] max-[360px]:h-[48px]"
                              style={{
                                width: `${style.imageWidthPx}px`,
                                height: `${style.imageHeightPx}px`,
                                borderRadius: `${style.imageRadiusPx}px`,
                              }}
                            />
                            <div className="flex-1 min-w-0 text-left text-sm max-[360px]:text-xs">
                              <h4
                                className="font-bold leading-tight break-words mb-1"
                                style={{ color: style.textPrimaryColor }}
                              >
                                {item.title}
                              </h4>
                              <p
                                className="leading-tight break-words"
                                style={{ color: style.textSecondaryColor }}
                              >
                                {config.colorLabelText} {item.color}
                              </p>
                              <p
                                className="mb-1 leading-tight break-words"
                                style={{ color: style.textSecondaryColor }}
                              >
                                {config.sizeLabelText} {item.size}
                              </p>

                              {config.showRemoveButton && (
                                <button
                                  onClick={() =>
                                    removeFromCart(itemId, item.color, item.size)
                                  }
                                  className="text-sm max-[360px]:text-xs hover:underline"
                                  style={{ color: style.accentColor }}
                                >
                                  {config.removeButtonText}
                                </button>
                              )}

                              <div className="flex flex-col items-start gap-2 mt-3">
                                {config.showQuantityControls ? (
                                  <div
                                    className="grid grid-cols-3 items-center overflow-hidden text-center font-bold w-[92px] max-[360px]:w-[84px] sm:w-[110px] shrink-0"
                                    style={{
                                      border: `1px solid ${style.quantityBorderColor}`,
                                      borderRadius: `${style.quantityRadiusPx}px`,
                                      color: style.quantityTextColor,
                                    }}
                                  >
                                    <button
                                      onClick={() =>
                                        decreaseQuantity(itemId, item.color, item.size)
                                      }
                                      className="py-1 max-[360px]:py-[2px] leading-none"
                                    >
                                      −
                                    </button>
                                    <span
                                      className="py-1 max-[360px]:py-[2px] font-semibold leading-none"
                                      style={{ color: style.textPrimaryColor }}
                                    >
                                      {item.quantity}
                                    </span>
                                    <button
                                      onClick={() =>
                                        increaseQuantity(itemId, item.color, item.size)
                                      }
                                      className="py-1 max-[360px]:py-[2px] leading-none"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <p
                                    className="font-semibold"
                                    style={{ color: style.textPrimaryColor }}
                                  >
                                    {config.tableQuantityText}: {item.quantity}
                                  </p>
                                )}

                                <p
                                  className="font-semibold whitespace-nowrap leading-none text-[15px] max-[360px]:text-[13px]"
                                  style={{ color: style.accentColor }}
                                >
                                  $
                                  {(
                                    Number(item.price || 0) * Number(item.quantity || 0)
                                  ).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td
                          className="hidden sm:table-cell px-4 py-4 border-b"
                          style={{ borderColor: style.tableLineColor }}
                        >
                          <div className="flex gap-4 items-center">
                            <img
                              src={item.image}
                              alt={item.title}
                              className="object-cover"
                              style={{
                                width: `${style.imageWidthPx}px`,
                                height: `${style.imageHeightPx}px`,
                                borderRadius: `${style.imageRadiusPx}px`,
                              }}
                            />
                            <div className="text-left">
                              <h4
                                className="font-bold"
                                style={{ color: style.textPrimaryColor }}
                              >
                                {item.title}
                              </h4>
                              <p
                                className="text-sm"
                                style={{ color: style.textSecondaryColor }}
                              >
                                {config.colorLabelText} {item.color}
                              </p>
                              <p
                                className="text-sm"
                                style={{ color: style.textSecondaryColor }}
                              >
                                {config.sizeLabelText} {item.size}
                              </p>

                              {config.showRemoveButton && (
                                <button
                                  onClick={() =>
                                    removeFromCart(itemId, item.color, item.size)
                                  }
                                  className="text-sm hover:underline mt-1"
                                  style={{ color: style.accentColor }}
                                >
                                  {config.removeButtonText}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        <td
                          className="hidden sm:table-cell px-4 py-4 font-semibold border-b"
                          style={{
                            color: style.accentColor,
                            borderColor: style.tableLineColor,
                          }}
                        >
                          ${Number(item.price || 0).toLocaleString()}
                        </td>

                        <td
                          className="hidden sm:table-cell px-4 py-4 border-b"
                          style={{ borderColor: style.tableLineColor }}
                        >
                          {config.showQuantityControls ? (
                            <div
                              className="grid grid-cols-3 items-center overflow-hidden text-center font-bold max-w-[100px] mx-auto"
                              style={{
                                border: `1px solid ${style.quantityBorderColor}`,
                                borderRadius: `${style.quantityRadiusPx}px`,
                                color: style.quantityTextColor,
                              }}
                            >
                              <button
                                onClick={() =>
                                  decreaseQuantity(itemId, item.color, item.size)
                                }
                                className="py-1"
                              >
                                −
                              </button>
                              <span
                                className="py-1 font-semibold"
                                style={{ color: style.textPrimaryColor }}
                              >
                                {item.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  increaseQuantity(itemId, item.color, item.size)
                                }
                                className="py-1"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <div
                              className="text-center font-semibold"
                              style={{ color: style.textPrimaryColor }}
                            >
                              {item.quantity}
                            </div>
                          )}
                        </td>

                        <td
                          className="hidden sm:table-cell px-4 py-4 font-semibold border-b"
                          style={{
                            color: style.accentColor,
                            borderColor: style.tableLineColor,
                          }}
                        >
                          $
                          {(
                            Number(item.price || 0) * Number(item.quantity || 0)
                          ).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="mx-auto mt-6 px-4 max-[360px]:px-1 sm:text-right text-center"
              style={{ maxWidth: `${style.contentMaxWidthPx}px` }}
            >
              {config.showSubtotal && (
                <p
                  className="text-xl max-[360px]:text-lg font-bold"
                  style={{ color: style.subtotalTextColor }}
                >
                  {config.subtotalLabelText}{" "}
                  <span style={{ color: style.subtotalValueColor }}>
                    ${subtotal.toLocaleString()}
                  </span>
                </p>
              )}

              {config.showShippingMessage && (
                <p
                  className="text-sm max-[360px]:text-xs mt-1"
                  style={{ color: style.textSecondaryColor }}
                >
                  {config.shippingMessageText}
                </p>
              )}

              {config.showCheckoutButton && (
                <Link to="/checkout" className="block mt-6">
                  <button
                    className="mt-4 font-bold py-2 px-6 max-[360px]:w-full max-[360px]:px-3"
                    style={{
                      backgroundColor: style.checkoutButtonBg,
                      color: style.checkoutButtonTextColor,
                      borderRadius: `${checkoutButtonRadius}px`,
                    }}
                  >
                    {config.checkoutButtonText}
                  </button>
                </Link>
              )}
            </div>
          </>
        )}
      </div>

      {config.showFooter && <FooterSection />}
      {config.showWhatsAppButton && <WhatsAppButton />}
    </div>
  );
}