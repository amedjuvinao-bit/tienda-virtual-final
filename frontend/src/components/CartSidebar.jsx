// src/components/CartSidebar.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { X, Plus, Minus, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || '').trim());
}

function hexToRgba(hex, alpha = 1) {
  const safe = String(hex || '').trim();

  if (!isHexColor(safe)) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  let normalized = safe.replace('#', '');

  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function money(value) {
  return `$${Number(value || 0).toLocaleString('es-CO')}`;
}

function getVariantDisplay(item = {}) {
  const explicitLabel = String(item.variantLabel || '').trim();
  if (explicitLabel) return explicitLabel;

  const attributes = Array.isArray(item.variantAttributes)
    ? item.variantAttributes
        .map((attribute) => String(attribute?.value || '').trim())
        .filter(Boolean)
    : [];

  return attributes.join(' / ') || [item.color, item.size].filter(Boolean).join(' / ');
}

function buildSafeCartSidebarConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {};

  return {
    titleImage: typeof cfg.titleImage === 'string' ? cfg.titleImage : '',
    titleImageAlt:
      typeof cfg.titleImageAlt === 'string' && cfg.titleImageAlt.trim()
        ? cfg.titleImageAlt
        : 'Carrito',
    checkoutButtonText:
      typeof cfg.checkoutButtonText === 'string' && cfg.checkoutButtonText.trim()
        ? cfg.checkoutButtonText
        : 'Check-out',
    subtotalLabelText:
      typeof cfg.subtotalLabelText === 'string' && cfg.subtotalLabelText.trim()
        ? cfg.subtotalLabelText
        : 'Subtotal:',
    continueShoppingText:
      typeof cfg.continueShoppingText === 'string' && cfg.continueShoppingText.trim()
        ? cfg.continueShoppingText
        : 'Ver carrito',
    removeButtonText:
      typeof cfg.removeButtonText === 'string' && cfg.removeButtonText.trim()
        ? cfg.removeButtonText
        : 'Eliminar',
    emptyStateText:
      typeof cfg.emptyStateText === 'string' && cfg.emptyStateText.trim()
        ? cfg.emptyStateText
        : 'El carrito está vacío.',
    colorLabelText:
      typeof cfg.colorLabelText === 'string' && cfg.colorLabelText.trim()
        ? cfg.colorLabelText
        : 'Color:',
    sizeLabelText:
      typeof cfg.sizeLabelText === 'string' && cfg.sizeLabelText.trim()
        ? cfg.sizeLabelText
        : 'Talla:',

    modal: {
      backdropColor:
        typeof cfg?.modal?.backdropColor === 'string'
          ? cfg.modal.backdropColor
          : '#000000',
      backdropOpacity: clampInt(cfg?.modal?.backdropOpacity, 0, 100, 50),
      panelBg:
        typeof cfg?.modal?.panelBg === 'string'
          ? cfg.modal.panelBg
          : '#FFE3EC',
      panelOpacity: clampInt(cfg?.modal?.panelOpacity, 0, 100, 100),
      textColor:
        typeof cfg?.modal?.textColor === 'string'
          ? cfg.modal.textColor
          : '#D4AF37',
      widthPx: clampInt(cfg?.modal?.widthPx, 280, 600, 400),
      checkoutBg:
        typeof cfg?.modal?.checkoutBg === 'string'
          ? cfg.modal.checkoutBg
          : '#D4AF37',
      checkoutText:
        typeof cfg?.modal?.checkoutText === 'string'
          ? cfg.modal.checkoutText
          : '#ffffff',
      linkColor:
        typeof cfg?.modal?.linkColor === 'string'
          ? cfg.modal.linkColor
          : '#D4AF37',
      closeIconColor:
        typeof cfg?.modal?.closeIconColor === 'string'
          ? cfg.modal.closeIconColor
          : '#D4AF37',
      emptyTextColor:
        typeof cfg?.modal?.emptyTextColor === 'string'
          ? cfg.modal.emptyTextColor
          : '#D4AF37',
      subtotalLabelColor:
        typeof cfg?.modal?.subtotalLabelColor === 'string'
          ? cfg.modal.subtotalLabelColor
          : '#D4AF37',
      subtotalValueColor:
        typeof cfg?.modal?.subtotalValueColor === 'string'
          ? cfg.modal.subtotalValueColor
          : '#D4AF37',
      quantityButtonBg:
        typeof cfg?.modal?.quantityButtonBg === 'string'
          ? cfg.modal.quantityButtonBg
          : '#fcdbe5',
      quantityButtonTextColor:
        typeof cfg?.modal?.quantityButtonTextColor === 'string'
          ? cfg.modal.quantityButtonTextColor
          : '#D4AF37',
      removeLinkColor:
        typeof cfg?.modal?.removeLinkColor === 'string'
          ? cfg.modal.removeLinkColor
          : '#D4AF37',
      titleImageWidthPx: clampInt(cfg?.modal?.titleImageWidthPx, 80, 260, 160),
      titleImageHeightPx: clampInt(cfg?.modal?.titleImageHeightPx, 40, 180, 80),
      productImageWidthPx: clampInt(cfg?.modal?.productImageWidthPx, 40, 180, 80),
      productImageHeightPx: clampInt(cfg?.modal?.productImageHeightPx, 60, 220, 112),
      panelPaddingPx: clampInt(cfg?.modal?.panelPaddingPx, 8, 40, 16),
      footerPaddingPx: clampInt(cfg?.modal?.footerPaddingPx, 8, 40, 16),
      itemRadiusPx: clampInt(cfg?.modal?.itemRadiusPx, 0, 30, 8),
      buttonRadiusPx: clampInt(cfg?.modal?.buttonRadiusPx, 0, 40, 8),
      panelRadiusPx: clampInt(cfg?.modal?.panelRadiusPx, 0, 40, 0),
      shadowStyle:
        cfg?.modal?.shadowStyle === 'none' ||
        cfg?.modal?.shadowStyle === 'soft' ||
        cfg?.modal?.shadowStyle === 'medium' ||
        cfg?.modal?.shadowStyle === 'strong'
          ? cfg.modal.shadowStyle
          : 'medium',
    },
  };
}

function CartSkeleton({ modal, panelBackground }) {
  return (
    <div
      className="scroll-sin-barra cart-sidebar-content min-h-0 flex-1 overflow-y-auto"
      style={{ padding: `${modal.panelPaddingPx}px` }}
    >
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="rounded-xl border p-3 animate-pulse"
            style={{
              borderRadius: `${modal.itemRadiusPx}px`,
              borderColor: hexToRgba(modal.textColor, 0.12),
              backgroundColor: hexToRgba('#ffffff', 0.12),
            }}
          >
            <div className="cart-sidebar-item">
              <div
                className="rounded-md cart-sidebar-product-image"
                style={{
                  backgroundColor: hexToRgba(modal.textColor, 0.14),
                }}
              />
              <div className="min-w-0 space-y-2">
                <div
                  className="h-4 rounded-full"
                  style={{
                    width: '72%',
                    backgroundColor: hexToRgba(modal.textColor, 0.14),
                  }}
                />
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: '48%',
                    backgroundColor: hexToRgba(modal.textColor, 0.12),
                  }}
                />
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: '40%',
                    backgroundColor: hexToRgba(modal.textColor, 0.12),
                  }}
                />
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: '34%',
                    backgroundColor: hexToRgba(modal.textColor, 0.12),
                  }}
                />
                <div className="flex items-center gap-2 pt-1">
                  <div
                    className="h-8 rounded-lg"
                    style={{
                      width: '102px',
                      backgroundColor: hexToRgba(modal.textColor, 0.12),
                    }}
                  />
                  <div
                    className="h-3 rounded-full"
                    style={{
                      width: '60px',
                      backgroundColor: hexToRgba(modal.textColor, 0.12),
                    }}
                  />
                </div>
                <div
                  className="h-4 rounded-full"
                  style={{
                    width: '38%',
                    backgroundColor: hexToRgba(modal.textColor, 0.14),
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="cart-sidebar-footer shrink-0 border-t mt-4 pt-4"
        style={{
          backgroundColor: panelBackground,
          borderColor: hexToRgba(modal.textColor, 0.18),
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div
            className="h-4 rounded-full"
            style={{
              width: '90px',
              backgroundColor: hexToRgba(modal.textColor, 0.14),
            }}
          />
          <div
            className="h-4 rounded-full"
            style={{
              width: '72px',
              backgroundColor: hexToRgba(modal.textColor, 0.14),
            }}
          />
        </div>

        <div className="mt-4 space-y-2">
          <div
            className="w-full h-12 rounded-xl"
            style={{
              backgroundColor: hexToRgba(modal.checkoutBg, 0.35),
            }}
          />
          <div
            className="mx-auto h-3 rounded-full"
            style={{
              width: '92px',
              backgroundColor: hexToRgba(modal.textColor, 0.12),
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function CartSidebar({ isOpen, onClose }) {
  const { cart, increaseQuantity, decreaseQuantity, removeFromCart } = useCart();

  const [cartPageConfig, setCartPageConfig] = useState(buildSafeCartSidebarConfig({}));
  const [animatedQtyKey, setAnimatedQtyKey] = useState('');
  const [mounted, setMounted] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const qtyAnimationTimeoutRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const loadCartPageConfig = async () => {
      try {
        setLoadingConfig(true);

        const res = await fetch(`${API_BASE}/api/pages/carrito`);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.message || `HTTP ${res.status}`);
        }

        setCartPageConfig(buildSafeCartSidebarConfig(data?.cartPageConfig));
      } catch (error) {
        console.error('Error cargando configuración del modal carrito:', error);
      } finally {
        setLoadingConfig(false);
      }
    };

    loadCartPageConfig();
  }, []);

  useEffect(() => {
    return () => {
      if (qtyAnimationTimeoutRef.current) {
        window.clearTimeout(qtyAnimationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const modal = cartPageConfig.modal;

  const shadowClass = useMemo(() => {
    if (modal.shadowStyle === 'none') return '';
    if (modal.shadowStyle === 'soft') return 'shadow-sm';
    if (modal.shadowStyle === 'medium') return 'shadow-2xl';
    if (modal.shadowStyle === 'strong') return 'shadow-[0_24px_80px_rgba(0,0,0,0.28)]';
    return 'shadow-2xl';
  }, [modal.shadowStyle]);

  const backdropStyle = useMemo(() => {
    return {
      backgroundColor: hexToRgba(
        modal.backdropColor,
        clampInt(modal.backdropOpacity, 0, 100, 50) / 100
      ),
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
    };
  }, [modal.backdropColor, modal.backdropOpacity]);

  const panelBackground = useMemo(() => {
    return hexToRgba(
      modal.panelBg,
      clampInt(modal.panelOpacity, 0, 100, 100) / 100
    );
  }, [modal.panelBg, modal.panelOpacity]);

  const subtotal = useMemo(() => {
    return cart.reduce((total, item) => {
      return total + Number(item.price || 0) * Number(item.quantity || 0);
    }, 0);
  }, [cart]);

  const itemCount = useMemo(() => {
    return cart.reduce((total, item) => total + Number(item.quantity || 0), 0);
  }, [cart]);

  const handleQtyAnimation = (key) => {
    setAnimatedQtyKey(key);

    if (qtyAnimationTimeoutRef.current) {
      window.clearTimeout(qtyAnimationTimeoutRef.current);
    }

    qtyAnimationTimeoutRef.current = window.setTimeout(() => {
      setAnimatedQtyKey('');
    }, 260);
  };

  return (
    <>
      <style>
        {`
          .scroll-sin-barra::-webkit-scrollbar {
            width: 0;
            height: 0;
          }

          .scroll-sin-barra {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .cart-sidebar-panel {
            width: min(96vw, 430px);
            max-width: 100vw;
          }

          .cart-sidebar-header {
            transition: padding 180ms ease;
          }

          .cart-sidebar-content {
            transition: padding 180ms ease;
          }

          .cart-sidebar-footer {
            box-shadow: 0 -10px 30px rgba(0,0,0,0.06);
            transition: padding 180ms ease;
          }

          .cart-sidebar-title-image {
            max-width: 100%;
            transition: width 180ms ease, height 180ms ease;
          }

          .cart-sidebar-count {
            transition: font-size 180ms ease, margin-top 180ms ease;
          }

          .cart-sidebar-item {
            display: grid;
            grid-template-columns: 84px minmax(0, 1fr);
            gap: 12px;
            align-items: start;
          }

          .cart-sidebar-product-image {
            width: 84px;
            height: 104px;
            object-fit: cover;
            flex-shrink: 0;
            transition: transform 220ms ease, box-shadow 220ms ease, width 180ms ease, height 180ms ease;
          }

          .cart-sidebar-product-image:hover {
            transform: scale(1.025);
          }

          .cart-sidebar-title {
            font-size: 16px;
            line-height: 1.2;
            font-weight: 700;
            word-break: break-word;
            overflow-wrap: anywhere;
            transition: font-size 180ms ease;
          }

          .cart-sidebar-meta {
            font-size: 13px;
            line-height: 1.45;
            word-break: break-word;
            overflow-wrap: anywhere;
            transition: font-size 180ms ease, line-height 180ms ease;
          }

          .cart-sidebar-controls {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            margin-top: 10px;
            transition: gap 180ms ease, margin-top 180ms ease;
          }

          .cart-sidebar-qty {
            display: inline-grid;
            grid-template-columns: 32px minmax(34px, auto) 32px;
            align-items: center;
            overflow: hidden;
            transition: transform 180ms ease, box-shadow 180ms ease;
          }

          .cart-sidebar-qty-active {
            animation: cartQtyPulse 240ms ease;
          }

          .cart-sidebar-item-card {
            transition:
              transform 220ms ease,
              box-shadow 220ms ease,
              background-color 220ms ease,
              border-color 220ms ease,
              padding 180ms ease;
          }

          .cart-sidebar-item-card:hover {
            transform: translateY(-2px);
          }

          .cart-sidebar-total {
            margin-top: 8px;
            font-size: 14px;
            line-height: 1.3;
            font-weight: 700;
            word-break: break-word;
            transition: font-size 180ms ease, margin-top 180ms ease;
          }

          .cart-sidebar-enter {
            animation: cartSidebarFadeIn 260ms ease;
          }

          .cart-sidebar-item-enter {
            animation: cartSidebarItemIn 320ms ease both;
          }

          .cart-sidebar-checkout-btn {
            min-height: 48px;
            transition: min-height 180ms ease, padding 180ms ease, font-size 180ms ease;
          }

          .cart-sidebar-view-link {
            transition: font-size 180ms ease, margin-top 180ms ease;
          }

          @keyframes cartSidebarFadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes cartSidebarItemIn {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes cartQtyPulse {
            0% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.06);
            }
            100% {
              transform: scale(1);
            }
          }

          @media (max-width: 520px) {
            .cart-sidebar-panel {
              width: min(100vw, 390px);
            }
          }

          @media (max-width: 420px) {
            .cart-sidebar-panel {
              width: 100vw;
            }

            .cart-sidebar-item {
              grid-template-columns: 68px minmax(0, 1fr);
              gap: 10px;
            }

            .cart-sidebar-product-image {
              width: 68px;
              height: 88px;
            }

            .cart-sidebar-title {
              font-size: 14px;
            }

            .cart-sidebar-meta {
              font-size: 12px;
              line-height: 1.35;
            }

            .cart-sidebar-total {
              font-size: 13px;
            }
          }

          @media (max-width: 340px) {
            .cart-sidebar-item {
              grid-template-columns: 1fr;
            }

            .cart-sidebar-product-image {
              width: 72px;
              height: 90px;
            }
          }

          @media (max-height: 760px) {
            .cart-sidebar-header {
              padding-top: 12px !important;
              padding-bottom: 10px !important;
            }

            .cart-sidebar-content {
              padding-top: 10px !important;
              padding-bottom: 10px !important;
            }

            .cart-sidebar-footer {
              padding-top: 10px !important;
              padding-bottom: 10px !important;
            }

            .cart-sidebar-title-image {
              max-height: 56px !important;
              width: auto !important;
            }

            .cart-sidebar-count {
              margin-top: 2px !important;
              font-size: 12px !important;
            }

            .cart-sidebar-item {
              grid-template-columns: 72px minmax(0, 1fr);
              gap: 10px;
            }

            .cart-sidebar-product-image {
              width: 72px;
              height: 90px;
            }

            .cart-sidebar-item-card {
              padding: 10px !important;
            }

            .cart-sidebar-title {
              font-size: 14px;
            }

            .cart-sidebar-meta {
              font-size: 12px;
              line-height: 1.3;
            }

            .cart-sidebar-controls {
              gap: 6px;
              margin-top: 8px;
            }

            .cart-sidebar-total {
              margin-top: 6px;
              font-size: 13px;
            }

            .cart-sidebar-checkout-btn {
              min-height: 42px;
              font-size: 14px !important;
            }

            .cart-sidebar-view-link {
              font-size: 13px !important;
            }
          }

          @media (max-height: 680px) {
            .cart-sidebar-header {
              padding-top: 10px !important;
              padding-bottom: 8px !important;
            }

            .cart-sidebar-content {
              padding-top: 8px !important;
              padding-bottom: 8px !important;
            }

            .cart-sidebar-footer {
              padding-top: 8px !important;
              padding-bottom: 8px !important;
            }

            .cart-sidebar-title-image {
              max-height: 46px !important;
            }

            .cart-sidebar-count {
              font-size: 11px !important;
            }

            .cart-sidebar-item {
              grid-template-columns: 64px minmax(0, 1fr);
              gap: 8px;
            }

            .cart-sidebar-product-image {
              width: 64px;
              height: 78px;
            }

            .cart-sidebar-item-card {
              padding: 8px !important;
            }

            .cart-sidebar-title {
              font-size: 13px;
              line-height: 1.15;
            }

            .cart-sidebar-meta {
              font-size: 11px;
              line-height: 1.22;
            }

            .cart-sidebar-controls {
              gap: 6px;
              margin-top: 6px;
            }

            .cart-sidebar-qty {
              grid-template-columns: 28px minmax(28px, auto) 28px;
            }

            .cart-sidebar-qty button,
            .cart-sidebar-qty span {
              height: 28px !important;
            }

            .cart-sidebar-total {
              font-size: 12px;
              margin-top: 4px;
            }

            .cart-sidebar-checkout-btn {
              min-height: 38px;
              padding-top: 8px !important;
              padding-bottom: 8px !important;
              font-size: 13px !important;
            }

            .cart-sidebar-view-link {
              font-size: 12px !important;
            }
          }

          @media (max-height: 620px) {
            .cart-sidebar-header {
              padding-top: 8px !important;
              padding-bottom: 6px !important;
            }

            .cart-sidebar-content {
              padding-top: 6px !important;
              padding-bottom: 6px !important;
            }

            .cart-sidebar-footer {
              padding-top: 6px !important;
              padding-bottom: 6px !important;
            }

            .cart-sidebar-title-image {
              max-height: 40px !important;
            }

            .cart-sidebar-count {
              font-size: 10px !important;
            }

            .cart-sidebar-item {
              grid-template-columns: 56px minmax(0, 1fr);
              gap: 8px;
            }

            .cart-sidebar-product-image {
              width: 56px;
              height: 70px;
            }

            .cart-sidebar-title {
              font-size: 12px;
            }

            .cart-sidebar-meta {
              font-size: 10.5px;
              line-height: 1.18;
            }

            .cart-sidebar-controls {
              margin-top: 4px;
              gap: 5px;
            }

            .cart-sidebar-total {
              font-size: 11px;
              margin-top: 4px;
            }

            .cart-sidebar-checkout-btn {
              min-height: 34px;
              font-size: 12px !important;
            }

            .cart-sidebar-view-link {
              font-size: 11px !important;
            }
          }
        `}
      </style>

      {isOpen && (
        <div
          className={`fixed inset-0 z-40 transition-colors duration-300 ${mounted ? 'cart-sidebar-enter' : ''}`}
          onClick={onClose}
          style={backdropStyle}
        />
      )}

      <aside
        className={`cart-sidebar-panel fixed right-0 top-0 h-[100dvh] z-50 flex flex-col overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${shadowClass} ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          backgroundColor: panelBackground,
          color: modal.textColor,
          borderTopLeftRadius:
            modal.panelRadiusPx > 0 ? `${modal.panelRadiusPx}px` : '0px',
          borderBottomLeftRadius:
            modal.panelRadiusPx > 0 ? `${modal.panelRadiusPx}px` : '0px',
          borderLeft: `1px solid ${hexToRgba(modal.textColor, 0.14)}`,
        }}
        aria-hidden={!isOpen}
      >
        {/* Encabezado */}
        <div
          className="cart-sidebar-header relative shrink-0 border-b"
          style={{
            padding: `${modal.panelPaddingPx}px`,
            borderColor: hexToRgba(modal.textColor, 0.18),
            background:
              'linear-gradient(to bottom, rgba(255,255,255,0.10), rgba(255,255,255,0.03))',
          }}
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/20 active:scale-95"
            style={{ color: modal.closeIconColor }}
            aria-label="Cerrar carrito"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col items-center justify-center pr-10 pl-2 text-center">
            {cartPageConfig.titleImage ? (
              <img
                src={cartPageConfig.titleImage}
                alt={cartPageConfig.titleImageAlt}
                className="cart-sidebar-title-image object-contain"
                style={{
                  width: `${modal.titleImageWidthPx}px`,
                  height: `${modal.titleImageHeightPx}px`,
                }}
              />
            ) : (
              <div className="text-lg font-semibold">Carrito</div>
            )}

            <p
              className="cart-sidebar-count mt-1 text-xs sm:text-sm opacity-80"
              style={{ color: modal.textColor }}
            >
              {itemCount} producto{itemCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Contenido */}
        {loadingConfig ? (
          <CartSkeleton modal={modal} panelBackground={panelBackground} />
        ) : (
          <div
            className="scroll-sin-barra cart-sidebar-content min-h-0 flex-1 overflow-y-auto"
            style={{ padding: `${modal.panelPaddingPx}px` }}
          >
            {cart.length === 0 ? (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-5 text-center">
                <div
                  className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: hexToRgba(modal.textColor, 0.10),
                    color: modal.textColor,
                  }}
                >
                  <ShoppingBag size={28} />
                </div>

                <p
                  className="text-sm sm:text-base leading-6"
                  style={{ color: modal.emptyTextColor }}
                >
                  {cartPageConfig.emptyStateText}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, index) => {
                  const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
                  const itemKey = `${item._id}-${item.variantKey || item.variantId || `${item.color}-${item.size}`}-${index}`;
                  const isQtyAnimated = animatedQtyKey === itemKey;

                  return (
                    <div
                      key={itemKey}
                      className="cart-sidebar-item-card rounded-xl border p-3 cart-sidebar-item-enter"
                      style={{
                        borderRadius: `${modal.itemRadiusPx}px`,
                        borderColor: hexToRgba(modal.textColor, 0.14),
                        backgroundColor: hexToRgba('#ffffff', 0.14),
                        animationDelay: `${Math.min(index * 35, 180)}ms`,
                      }}
                    >
                      <div className="cart-sidebar-item">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="cart-sidebar-product-image rounded-md"
                        />

                        <div className="min-w-0">
                          <h3
                            className="cart-sidebar-title"
                            style={{ color: modal.textColor }}
                          >
                            {item.title}
                          </h3>

                          <div className="cart-sidebar-meta mt-1" style={{ color: modal.textColor }}>
                            <p>
                              Variante: {getVariantDisplay(item) || 'Presentación general'}
                            </p>
                            <p>Precio: {money(item.price)}</p>
                          </div>

                          <div className="cart-sidebar-controls">
                            <div
                              className={`cart-sidebar-qty ${isQtyAnimated ? 'cart-sidebar-qty-active' : ''}`}
                              style={{
                                borderRadius: `${modal.buttonRadiusPx}px`,
                                border: `1px solid ${hexToRgba(modal.quantityButtonTextColor, 0.22)}`,
                                backgroundColor: hexToRgba('#ffffff', 0.08),
                                boxShadow: isQtyAnimated
                                  ? `0 0 0 4px ${hexToRgba(modal.quantityButtonTextColor, 0.12)}`
                                  : 'none',
                              }}
                            >
                              <button
                                onClick={() => {
                                  decreaseQuantity(item._id, item.color, item.size, item.variantKey || item.variantId);
                                  handleQtyAnimation(itemKey);
                                }}
                                className="flex h-8 w-8 items-center justify-center transition hover:brightness-95 active:scale-95"
                                style={{
                                  backgroundColor: modal.quantityButtonBg,
                                  color: modal.quantityButtonTextColor,
                                }}
                                aria-label={`Disminuir cantidad de ${item.title}`}
                              >
                                <Minus size={14} />
                              </button>

                              <span
                                className="flex h-8 items-center justify-center px-2 text-sm font-semibold"
                                style={{ color: modal.textColor }}
                              >
                                {item.quantity}
                              </span>

                              <button
                                onClick={() => {
                                  increaseQuantity(item._id, item.color, item.size, item.variantKey || item.variantId);
                                  handleQtyAnimation(itemKey);
                                }}
                                className="flex h-8 w-8 items-center justify-center transition hover:brightness-95 active:scale-95"
                                style={{
                                  backgroundColor: modal.quantityButtonBg,
                                  color: modal.quantityButtonTextColor,
                                }}
                                aria-label={`Aumentar cantidad de ${item.title}`}
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <button
                              onClick={() =>
                                removeFromCart(item._id, item.color, item.size, item.variantKey || item.variantId)
                              }
                              className="text-xs sm:text-sm underline underline-offset-2 transition hover:text-red-500"
                              style={{ color: modal.removeLinkColor }}
                            >
                              {cartPageConfig.removeButtonText}
                            </button>
                          </div>

                          <p
                            className="cart-sidebar-total"
                            style={{ color: modal.subtotalValueColor }}
                          >
                            Total: {money(itemTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          className="cart-sidebar-footer shrink-0 border-t"
          style={{
            padding: `${modal.footerPaddingPx}px`,
            backgroundColor: panelBackground,
            borderColor: hexToRgba(modal.textColor, 0.18),
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span
              className="text-sm sm:text-base font-semibold"
              style={{ color: modal.subtotalLabelColor }}
            >
              {cartPageConfig.subtotalLabelText}
            </span>

            <span
              className="text-sm sm:text-base font-bold text-right"
              style={{ color: modal.subtotalValueColor }}
            >
              {money(subtotal)}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            <Link to="/checkout" className="block" onClick={onClose}>
              <button
                className="cart-sidebar-checkout-btn w-full py-3 px-4 text-sm sm:text-base font-semibold transition hover:opacity-90 active:scale-[0.985]"
                style={{
                  backgroundColor: modal.checkoutBg,
                  color: modal.checkoutText,
                  borderRadius: `${modal.buttonRadiusPx}px`,
                  boxShadow: `0 10px 24px ${hexToRgba(modal.checkoutBg, 0.22)}`,
                }}
              >
                {cartPageConfig.checkoutButtonText}
              </button>
            </Link>

            <Link
              to="/carrito"
              onClick={onClose}
              className="cart-sidebar-view-link block text-center text-sm underline underline-offset-2 transition hover:opacity-80"
              style={{ color: modal.linkColor }}
            >
              {cartPageConfig.continueShoppingText}
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
