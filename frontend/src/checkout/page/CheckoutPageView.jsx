import React, { useContext, useEffect } from "react";
import { StorefrontSettingsContext } from "../../context/StorefrontSettingsContext";
import StorefrontLoadingScreen from "../../components/StorefrontLoadingScreen";
import useStorefrontBackdrop from "../../components/useStorefrontBackdrop";
import { rememberPageLoadingAppearance } from "../../theme/storefrontLoadingAppearance";
import { cartVariables } from "../../components/cart/CartMaterial";
import { CheckoutMaterialContext, checkoutMaterial } from "./CheckoutMaterial";
import CheckoutHeading from "./CheckoutHeading";
import "../../components/cart/cartPage.css";
import "./checkoutPage.css";
import StorefrontFooter from "../../components/StorefrontFooter";
import Header from "../../components/Header";
import ModalContacto from "../../components/ModalContacto";
import ModalEnvio from "../../components/ModalEnvio";
import ModalPrivacidad from "../../components/ModalPrivacidad";
import ModalReembolso from "../../components/ModalReembolso";
import ModalTerminos from "../../components/ModalTerminos";
import WhatsAppButton from "../../components/WhatsAppButton";
import CheckoutContactSection from "./CheckoutContactSection";
import CheckoutDeliverySection from "./CheckoutDeliverySection";
import CheckoutFormActions from "./CheckoutFormActions";
import CheckoutOrderSummary from "./CheckoutOrderSummary";
import CheckoutPaymentSection from "./CheckoutPaymentSection";
function CheckoutModals({ state }) {
  return (
    <>
      {state.showModal && (
        <ModalReembolso
          visible={true}
          onClose={() => state.setShowModal(false)}
        />
      )}
      <ModalEnvio
        visible={state.showEnvioModal}
        onClose={() => state.setShowEnvioModal(false)}
      />
      <ModalPrivacidad
        visible={state.showPrivacidadModal}
        onClose={() => state.setShowPrivacidadModal(false)}
      />
      <ModalTerminos
        visible={state.showTerminosModal}
        onClose={() => state.setShowTerminosModal(false)}
      />
      <ModalContacto
        visible={state.showContactoModal}
        onClose={() => state.setShowContactoModal(false)}
      />
    </>
  );
}

export default function CheckoutPageView({
  state,
  derived,
  actions,
  preview = false,
}) {
  const { checkoutConfig: config } = state;
  const settings = useContext(StorefrontSettingsContext);
  const backdrop = useStorefrontBackdrop(
    config.presentation,
    config.style.pageBg,
  );
  const retry = () => state.setConfigurationAttempt((value) => value + 1);
  useEffect(() => {
    if (state.checkoutPageData && !preview)
      rememberPageLoadingAppearance(
        "/checkout",
        settings?.theme,
        config.presentation,
        config.style.pageBg,
      );
  }, [state.checkoutPageData, settings?.theme, config, preview]);
  if (state.checkoutConfigLoading)
    return (
      <StorefrontLoadingScreen
        message="Cargando finalización de compra"
        presentation={state.checkoutPageData ? config.presentation : undefined}
        pageBg={state.checkoutPageData ? config.style.pageBg : undefined}
      />
    );
  return (
    <CheckoutMaterialContext.Provider value={config}>
      <div
        className="cart-storefront co-page"
        data-chrome={config.showHeader}
        style={{
          ...derived.cssVars,
          ...cartVariables(checkoutMaterial(config)),
          backgroundColor: backdrop.color,
          backgroundImage: backdrop.image
            ? `url(${JSON.stringify(backdrop.image)})`
            : "none",
          "--co-input-alpha": `${config.presentation.glassOpacity * 100}%`,
          "--co-button-alpha": `${config.presentation.checkoutGlassOpacity * 100}%`,
          "--co-button-blur": `${config.presentation.checkoutGlassBlur}px`,
          "--co-line": config.style.lineColor,
          "--co-label": config.style.labelTextColor,
          "--co-placeholder": config.style.inputPlaceholderColor,
          "--co-button-bg": config.style.confirmButtonBg,
          "--co-button-ink": config.style.confirmButtonTextColor,
          "--co-button-radius":
            config.style.confirmButtonStyle === "pill"
              ? "999px"
              : config.style.confirmButtonStyle === "square"
                ? "8px"
                : `${config.style.confirmButtonRadiusPx}px`,
          "--co-input-radius":
            config.style.inputStyle === "pill"
              ? "999px"
              : config.style.inputStyle === "square"
                ? "4px"
                : `${config.style.inputRadiusPx}px`,
        }}
      >
        {config.showHeader && <Header />}
        <main
          className="cart-scene co-scene"
          style={{
            maxWidth: config.style.contentMaxWidthPx,
            "--cart-top": `${config.style.contentTopPaddingPx}px`,
          }}
        >
          <CheckoutHeading config={config} />
          {(state.checkoutConfigError || state.configurationError) && (
            <div className="cart-notice" role="alert">
              <span>
                {state.configurationError || state.checkoutConfigError}
              </span>
              <button type="button" onClick={retry}>
                Reintentar configuración
              </button>
            </div>
          )}
          {state.errors.length > 0 && (
            <div className="co-error-banner" role="alert" tabIndex={-1}>
              <strong>Revisa estos datos para continuar:</strong>
              <ul>
                {state.errors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          {state.geographyError && (
            <div className="cart-notice" role="alert">
              <span>{state.geographyError}</span>
              <button
                type="button"
                onClick={() => state.setGeographyAttempt((value) => value + 1)}
              >
                Reintentar ubicación
              </button>
            </div>
          )}
          {state.quoteError && (
            <div className="cart-notice" role="alert">
              <span>{state.quoteError}</span>
              <button
                type="button"
                disabled={state.quoteLoading}
                onClick={actions.retryCheckoutQuote}
              >
                Reintentar total
              </button>
            </div>
          )}
          {!derived.currentCart?.length && !state.cartLoading && (
            <div className="cart-notice" role="status">
              Tu carrito está vacío. <a href="/carrito">Volver al carrito</a>
            </div>
          )}
          <div className="co-layout" data-summary={config.showOrderSummary}>
            <div className="co-form-col">
              <fieldset disabled={state.isPlacing} className="co-fields">
                <CheckoutContactSection state={state} />
                <CheckoutDeliverySection state={state} derived={derived} />
                <CheckoutPaymentSection
                  state={state}
                  derived={derived}
                  onPreviewStoreCredit={actions.handlePreviewStoreCredit}
                />
                <CheckoutFormActions
                  state={state}
                  derived={derived}
                  onPlaceOrder={actions.handlePlaceOrder}
                />
              </fieldset>
            </div>
            <CheckoutOrderSummary
              state={state}
              derived={derived}
              onApplyCoupon={actions.handleApplyCoupon}
            />
          </div>
        </main>
        {!preview && <CheckoutModals state={state} />}
        {config.showFooter && (
          <StorefrontFooter
            theme={backdrop.settings?.theme}
            store={backdrop.settings?.store}
            preview={preview}
          />
        )}
        {config.showWhatsAppButton && <WhatsAppButton />}
      </div>
    </CheckoutMaterialContext.Provider>
  );
}
