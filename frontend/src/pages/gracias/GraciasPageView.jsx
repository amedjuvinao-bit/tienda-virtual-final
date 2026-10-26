import Header from "../../components/Header";
import StorefrontFooter from "../../components/StorefrontFooter";
import WhatsAppButton from "../../components/WhatsAppButton";
import StorefrontLoadingScreen from "../../components/StorefrontLoadingScreen";
import useStorefrontBackdrop from "../../components/useStorefrontBackdrop";
import { cartVariables } from "../../components/cart/CartMaterial";
import { thanksMaterialConfig } from "./thanksPageConfig";
import GraciasSummaryPanel from "./GraciasSummaryPanel";
import GraciasVisualPanel from "./GraciasVisualPanel";
import "../../components/cart/cartPage.css";
import "./graciasPage.css";
export default function GraciasPageView(controller) {
  const {
    thanksConfig: config,
    viewModel: model,
    page = {},
    preview = false,
  } = controller;
  const style = config.style,
    material = thanksMaterialConfig(config);
  const backdrop = useStorefrontBackdrop(config.presentation, style.pageBg);
  const header = page.useHeader !== false && config.showHeader;
  const hasVisual = config.showVisualPanel && config.slider.enabled;
  if (controller.loading)
    return (
      <StorefrontLoadingScreen
        message="Cargando resultado del pedido"
        presentation={page.thanksPageConfig ? config.presentation : undefined}
        pageBg={page.thanksPageConfig ? style.pageBg : undefined}
      />
    );
  return (
    <div
      className="cart-storefront gp-page"
      data-chrome={header}
      style={{
        ...cartVariables(material),
        color: style.textPrimaryColor,
        backgroundColor: backdrop.color,
        backgroundImage: backdrop.image
          ? `url(${JSON.stringify(backdrop.image)})`
          : "none",
        "--gp-title-color": style.titleTextColor,
        "--gp-title-size": `${style.titleFontSizePx}px`,
        "--gp-button-tint": style.buttonBg,
        "--gp-button-ink": style.buttonTextColor,
        "--gp-button-alpha": `${config.presentation.checkoutGlassOpacity * 100}%`,
        "--gp-button-blur": `${config.presentation.checkoutGlassBlur}px`,
        "--gp-button-radius": `${controller.presentationStyle.buttonRadius}px`,
        "--gp-panel-width": `${style.panelWidthPx}px`,
      }}
    >
      {header && <Header />}
      <main
        className="cart-scene gp-scene"
        style={{
          maxWidth: style.contentMaxWidthPx,
          "--cart-top": `${style.contentTopPaddingPx}px`,
        }}
      >
        {controller.configError && (
          <div role="alert" className="cart-notice">
            <span>{controller.configError}</span>
            <button type="button" onClick={controller.retryConfig}>
              Reintentar apariencia
            </button>
          </div>
        )}
        <div className="gp-layout" data-visual={hasVisual}>
          {hasVisual && (
            <GraciasVisualPanel
              config={config}
              slides={controller.slides}
              currentSlide={controller.currentSlide}
              setCurrentSlide={controller.setCurrentSlide}
              paused={controller.paused}
              setPaused={controller.setPaused}
              material={material}
            />
          )}
          <GraciasSummaryPanel
            config={config}
            material={material}
            model={model}
            accessError={controller.thanksAccessError}
            retryVerification={controller.retryVerification}
            returnAccessEnabled={
              controller.thanksOrderData?.returnAccess?.enabled === true
            }
            openReturnsPortal={controller.openReturnsPortal}
            continueShopping={controller.continueShopping}
          />
        </div>
      </main>
      {page.useFooter !== false && config.showFooter && (
        <StorefrontFooter
          theme={backdrop.settings?.theme}
          store={backdrop.settings?.store}
          preview={preview}
        />
      )}
      {config.showWhatsAppButton && <WhatsAppButton />}
    </div>
  );
}
