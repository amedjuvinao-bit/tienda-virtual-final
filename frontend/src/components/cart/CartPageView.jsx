import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShoppingBag, RefreshCw } from "lucide-react";
import Header from "../Header";
import FooterSection from "../FooterSection";
import WhatsAppButton from "../WhatsAppButton";
import CartCheckoutButton from "./CartCheckoutButton";
import useStorefrontBackdrop from "../useStorefrontBackdrop";
import { buildSafeCartPageConfig } from "./cartPageConfig";
import { canCheckout, cartSubtotal, money } from "./cartModel";
import CartItems from "./CartItems";
import "./cartPage.css";
import "../catalog/catalogFooterGlass.css";
import { cartVariables, CartGlass } from "./CartMaterial";
export default function CartPageView({
  page = {},
  cartState = {},
  preview = false,
  loading = false,
  configError = "",
}) {
  const config = buildSafeCartPageConfig(page.cartPageConfig);
  const {
    cart = [],
    loading: busy = false,
    cartMessage = "",
    syncCart,
    ...actions
  } = cartState;
  const { image, color, settings } = useStorefrontBackdrop(
    config.presentation,
    config.style.pageBg,
  );
  const [failedTitle, setFailedTitle] = useState("");
  const s = config.style;
  const header = page.useHeader !== false && config.showHeader;
  const footer = page.useFooter !== false && config.showFooter;
  const buttonRadius =
    s.checkoutButtonStyle === "pill"
      ? 999
      : s.checkoutButtonStyle === "rounded"
        ? s.checkoutButtonRadiusPx
        : 8;
  const ready = !busy && !cartState.syncError && canCheckout(cart);
  return (
    <div
      className="cart-storefront"
      data-chrome={!loading && header}
      style={{
        ...cartVariables(config),
        backgroundColor: color,
        backgroundImage: image ? `url(${JSON.stringify(image)})` : "none",
        color: s.textPrimaryColor,
      }}
    >
      {!loading && header && <Header />}
      <main
        className="cart-scene"
        style={{
          maxWidth: s.contentMaxWidthPx,
          "--cart-top": `${s.contentTopPaddingPx}px`,
        }}
      >
        {loading ? (
          <div className="cart-loading" role="status">
            Cargando carrito…
          </div>
        ) : page.enabled === false && !preview ? (
          <CartGlass config={config}>
            <p>El carrito no está disponible en este momento.</p>
          </CartGlass>
        ) : (
          <>
            {config.showBreadcrumb && (
              <nav
                className="cart-breadcrumb"
                aria-label="Ruta del carrito"
                style={{ color: s.breadcrumbTextColor }}
              >
                <Link to="/" style={{ color: s.breadcrumbLinkColor }}>
                  {config.breadcrumbHomeText}
                </Link>
                <span aria-hidden="true">/</span>
                <span>{config.breadcrumbCurrentText}</span>
              </nav>
            )}
            <header className="cart-heading">
              <div>
                {config.titleMode === "image" &&
                config.titleImage &&
                failedTitle !== config.titleImage ? (
                  <h1>
                    <img
                      src={config.titleImage}
                      alt={config.titleImageAlt}
                      style={{ maxHeight: s.titleImageHeightPx }}
                      onError={() => setFailedTitle(config.titleImage)}
                    />
                  </h1>
                ) : (
                  <h1
                    style={{
                      fontSize: `min(${s.titleFontSizePx}px, max(24px, 4vw))`,
                      color: s.titleTextColor,
                    }}
                  >
                    {config.titleText}
                  </h1>
                )}
                <p aria-live="polite">
                  {cart.reduce((n, item) => n + Number(item.quantity || 0), 0)}{" "}
                  {cart.reduce(
                    (n, item) => n + Number(item.quantity || 0),
                    0,
                  ) === 1
                    ? config.countSingularText
                    : config.countLabelText}
                </p>
              </div>
              <ShoppingBag size={40} aria-hidden="true" />
            </header>
            {(cartMessage || configError) && (
              <div className="cart-notice" role="alert">
                <span>{cartMessage || configError}</span>
                {cartMessage && syncCart && (
                  <button type="button" disabled={busy} onClick={syncCart}>
                    <RefreshCw size={14} />
                    Actualizar carrito
                  </button>
                )}
              </div>
            )}
            {busy && (
              <p className="cart-sync-state" role="status">
                Actualizando carrito…
              </p>
            )}
            {!cart.length ? (
              config.showEmptyState && (
                <CartGlass config={config} className="cart-empty">
                  <ShoppingBag size={42} aria-hidden="true" />
                  <h2>{config.emptyStateTitle}</h2>
                  <p>{config.emptyStateText}</p>
                  <Link
                    className="cart-continue"
                    to={config.continueShoppingPath}
                  >
                    <ArrowLeft size={16} />
                    {config.continueShoppingText}
                  </Link>
                </CartGlass>
              )
            ) : (
              <div className="cart-layout">
                <CartGlass config={config} className="cart-products">
                  <CartItems
                    items={cart}
                    config={config}
                    actions={actions}
                    busy={busy}
                    preview={preview}
                  />
                  <Link
                    className="cart-continue"
                    to={config.continueShoppingPath}
                  >
                    <ArrowLeft size={16} />
                    {config.continueShoppingText}
                  </Link>
                </CartGlass>
                <CartGlass
                  config={config}
                  className="cart-summary"
                  aria-label={config.summaryTitle}
                >
                  <h2>{config.summaryTitle}</h2>
                  {config.showSubtotal && (
                    <div
                      className="cart-summary__subtotal"
                      style={{ color: s.subtotalTextColor }}
                    >
                      <span>{config.subtotalLabelText}</span>
                      <strong style={{ color: s.subtotalValueColor }}>
                        {money(cartSubtotal(cart))}
                      </strong>
                    </div>
                  )}
                  {config.showShippingMessage && (
                    <p>{config.shippingMessageText}</p>
                  )}
                  {config.showCheckoutButton && (
                    <CartCheckoutButton
                      config={config}
                      tint={s.checkoutButtonBg}
                      textColor={s.checkoutButtonTextColor}
                      radius={buttonRadius}
                      disabled={!ready}
                    />
                  )}
                  {!busy && !canCheckout(cart) && (
                    <p role="status">
                      Revisa los productos no disponibles antes de continuar.
                    </p>
                  )}
                </CartGlass>
              </div>
            )}
          </>
        )}
      </main>
      {!loading && footer && (
        <div className="cart-footer cpv-page" data-background="continuity">
          <div className="cpv-footer">
            <FooterSection
              theme={settings?.theme}
              store={settings?.store}
              polishedGlass
              preview={preview}
            />
          </div>
        </div>
      )}
      {!loading && !preview && config.showWhatsAppButton && <WhatsAppButton />}
    </div>
  );
}
