import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ShoppingBag, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { buildSafeCartPageConfig } from "./cartPageConfig";
import { cartVariables } from "./CartMaterial";
import { canCheckout, cartSubtotal, money } from "./cartModel";
import CartItems from "./CartItems";
import CartCheckoutButton from "./CartCheckoutButton";
import PolishedGlassRim from "../PolishedGlassRim";
import "./cartPage.css";
import "./cartDrawer.css";
export default function CartDrawer({
  isOpen,
  onClose,
  page = {},
  cartState = {},
  loading = false,
  preview = false,
}) {
  const config = buildSafeCartPageConfig(page.cartPageConfig),
    m = config.modal;
  const {
    cart = [],
    loading: busy = false,
    cartMessage = "",
    syncCart,
    ...actions
  } = cartState;
  const [failedTitle, setFailedTitle] = useState("");
  const id = useId(),
    panel = useRef(null),
    close = useRef(onClose),
    host = useRef(null);
  close.current = onClose;
  if (!host.current && typeof document !== "undefined")
    host.current = document.createElement("div");
  useEffect(() => {
    if (!isOpen || preview) return;
    const node = host.current;
    document.body.appendChild(node);
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    const siblings = [...document.body.children].filter(
      (child) => child !== node,
    );
    const old = siblings.map((child) => [child, child.inert]);
    siblings.forEach((child) => {
      child.inert = true;
    });
    document.body.style.overflow = "hidden";
    panel.current?.querySelector("[data-close-cart]")?.focus();
    const key = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current?.();
      }
      if (event.key === "Tab") {
        const nodes = [
          ...panel.current.querySelectorAll(
            'button:not(:disabled),a[href],[tabindex="0"]',
          ),
        ].filter((n) => n.getClientRects().length);
        if (!nodes.length) {
          event.preventDefault();
          panel.current.focus();
          return;
        }
        const first = nodes[0],
          last = nodes.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !panel.current.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !panel.current.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      old.forEach(([child, inert]) => (child.inert = inert));
      document.body.style.overflow = overflow;
      node.remove();
      if (previous?.isConnected) previous.focus();
    };
  }, [isOpen, preview]);
  if (!isOpen) return null;
  const itemsConfig = {
    ...config,
    style: {
      ...config.style,
      textPrimaryColor: m.textColor,
      textSecondaryColor: m.textColor,
      accentColor: m.removeLinkColor,
      quantityButtonBg: m.quantityButtonBg,
      shadowStyle: m.shadowStyle,
      imageWidthPx: m.productImageWidthPx,
      imageHeightPx: m.productImageHeightPx,
      quantityRadiusPx: m.buttonRadiusPx,
      quantityTextColor: m.quantityButtonTextColor,
      quantityBorderColor: m.quantityButtonTextColor,
    },
  };
  const content = (
    <div className="cart-drawer-layer" data-preview={preview}>
      {!preview && (
        <div
          className="cart-drawer-backdrop"
          onClick={onClose}
          style={{
            background: `color-mix(in srgb, ${m.backdropColor} ${m.backdropOpacity}%, transparent)`,
          }}
          aria-hidden="true"
        />
      )}
      <aside
        ref={panel}
        className="cart-drawer"
        role={preview ? "region" : "dialog"}
        aria-modal={preview ? undefined : true}
        aria-labelledby={id}
        tabIndex={-1}
        style={{
          ...cartVariables(itemsConfig),
          "--drawer-separator": m.separatorColor,
          "--drawer-item-radius": `${m.itemRadiusPx}px`,
          "--drawer-width": `${m.widthPx}px`,
          "--drawer-padding": `${m.panelPaddingPx}px`,
          "--drawer-footer-padding": `${m.footerPaddingPx}px`,
          "--drawer-image-w": `${m.titleImageWidthPx}px`,
          "--drawer-image-h": `${m.titleImageHeightPx}px`,
          borderRadius: `${m.panelRadiusPx}px 0 0 ${m.panelRadiusPx}px`,
          color: m.textColor,
          background: `color-mix(in srgb, ${m.panelBg} ${m.panelOpacity * config.presentation.glassOpacity}%, transparent)`,
        }}
      >
        <PolishedGlassRim
          radius={m.panelRadiusPx}
          width={config.presentation.borderWidth}
          reflection={config.presentation.reflection}
        />
        <header className="cart-drawer__header">
          <div>
            <h2 id={id}>
              {config.titleMode === "image" &&
              config.titleImage &&
              failedTitle !== config.titleImage ? (
                <img
                  src={config.titleImage}
                  alt={config.titleImageAlt}
                  onError={() => setFailedTitle(config.titleImage)}
                />
              ) : (
                config.sidebarTitleText
              )}
            </h2>
            <p>
              {cart.reduce(
                (total, item) => total + Number(item.quantity || 0),
                0,
              )}{" "}
              {cart.reduce((n, item) => n + Number(item.quantity || 0), 0) === 1
                ? config.countSingularText
                : config.countLabelText}
            </p>
          </div>
          {!preview && (
            <button
              data-close-cart
              type="button"
              aria-label="Cerrar carrito"
              onClick={onClose}
              style={{ color: m.closeIconColor }}
            >
              <X size={20} />
            </button>
          )}
        </header>
        <div className="cart-drawer__content">
          {loading ? (
            <p role="status">Cargando carrito…</p>
          ) : (
            <>
              {cartMessage && (
                <div className="cart-notice" role="alert">
                  <span>{cartMessage}</span>
                  {syncCart && (
                    <button type="button" disabled={busy} onClick={syncCart}>
                      <RefreshCw size={14} />
                      Actualizar carrito
                    </button>
                  )}
                </div>
              )}
              {busy && (
                <p role="status" className="cart-sync-state">
                  Actualizando carrito…
                </p>
              )}
              {cart.length ? (
                <CartItems
                  items={cart}
                  config={itemsConfig}
                  actions={actions}
                  busy={busy}
                  compact
                  preview={preview}
                />
              ) : (
                <div
                  className="cart-drawer__empty"
                  style={{ color: m.emptyTextColor }}
                >
                  <ShoppingBag size={38} />
                  <p>{config.emptyStateText}</p>
                </div>
              )}
            </>
          )}
        </div>
        <footer className="cart-drawer__footer">
          {config.showSubtotal && (
            <div className="cart-summary__subtotal">
              <span style={{ color: m.subtotalLabelColor }}>
                {config.subtotalLabelText}
              </span>
              <strong style={{ color: m.subtotalValueColor }}>
                {money(cartSubtotal(cart))}
              </strong>
            </div>
          )}
          {config.showCheckoutButton && (
            <CartCheckoutButton
              config={config}
              tint={m.checkoutBg}
              textColor={m.checkoutText}
              radius={m.buttonRadiusPx}
              disabled={!canCheckout(cart) || busy || cartState.syncError}
              onClick={onClose}
            />
          )}
          <Link
            to="/carrito"
            onClick={onClose}
            className="cart-drawer__view"
            style={{ color: m.linkColor }}
          >
            {config.viewCartText}
          </Link>
        </footer>
      </aside>
    </div>
  );
  return preview ? content : createPortal(content, host.current);
}
