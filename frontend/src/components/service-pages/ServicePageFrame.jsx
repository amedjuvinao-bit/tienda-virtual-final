import { useState } from "react";
import Header from "../Header";
import StorefrontFooter from "../StorefrontFooter";
import WhatsAppButton from "../WhatsAppButton";
import PolishedGlassRim from "../PolishedGlassRim";
import useStorefrontBackdrop from "../useStorefrontBackdrop";
import { CartGlass, cartVariables } from "../cart/CartMaterial";
import "../cart/cartPage.css";
import "./servicePages.css";
export function ServiceButton({
  as: Component = "button",
  config,
  children,
  className = "",
  ...props
}) {
  return (
    <Component
      type={Component === "button" ? "button" : undefined}
      {...props}
      className={`service-button ${className}`}
    >
      {children}
      <PolishedGlassRim
        radius={config.style.buttonRadiusPx}
        width={config.presentation.borderWidth}
        reflection={config.presentation.reflection}
      />
    </Component>
  );
}
export function ServiceHeading({ config, title, children, icon: Icon }) {
  const [failedImage, setFailedImage] = useState("");
  return (
    <CartGlass config={config} className="service-heading">
      <div>
        {config.showEyebrow && (
          <p className="service-eyebrow">{config.eyebrowText}</p>
        )}
        <h1 className={config.showTitle ? "" : "sr-only"}>
          {config.titleMode === "image" &&
          config.titleImage &&
          failedImage !== config.titleImage ? (
            <img
              src={config.titleImage}
              alt={config.titleImageAlt || config.titleText}
              style={{ maxHeight: config.titleImageHeightPx }}
              onError={() => setFailedImage(config.titleImage)}
            />
          ) : (
            title || config.titleText
          )}
        </h1>
        {config.showSubtitle && <p>{config.subtitleText}</p>}
        {children}
      </div>
      {Icon && (
        <Icon
          className="service-heading-icon"
          size={42}
          strokeWidth={1}
          aria-hidden="true"
        />
      )}
    </CartGlass>
  );
}
export default function ServicePageFrame({
  page = {},
  config,
  children,
  preview = false,
  className = "",
  theme,
}) {
  const backdrop = useStorefrontBackdrop(
      config.presentation,
      config.style.pageBg,
      theme,
    ),
    s = config.style,
    p = config.presentation;
  const header = page.useHeader !== false && config.showHeader;
  return (
    <div
      className={`cart-storefront service-storefront ${className}`}
      data-chrome={header}
      style={{
        ...cartVariables(config),
        backgroundColor: backdrop.color,
        backgroundImage: backdrop.image
          ? `url(${JSON.stringify(backdrop.image)})`
          : "none",
        "--service-title-size": `${config.titleFontSizePx}px`,
        "--service-gap": `${config.gapPx}px`,
        "--service-title-color": s.titleTextColor,
        "--service-line": s.lineColor,
        "--service-button-bg": s.buttonBg,
        "--service-button-ink": s.buttonTextColor,
        "--service-button-edge": s.buttonBorderColor,
        "--service-button-radius": `${s.buttonRadiusPx}px`,
        "--service-button-alpha": `${p.checkoutGlassOpacity * 100}%`,
        "--service-button-blur": `${p.checkoutGlassBlur}px`,
        "--service-input-bg": s.inputBg,
        "--service-input-ink": s.inputTextColor,
        "--service-input-edge": s.inputBorderColor,
      }}
    >
      {header && <Header />}
      <main
        className="cart-scene service-scene"
        style={{
          maxWidth: config.contentMaxWidthPx,
          "--cart-top": `${config.contentTopPaddingPx}px`,
          paddingBottom: config.contentBottomPaddingPx,
        }}
      >
        {children}
      </main>
      {page.useFooter !== false && config.showFooter && (
        <StorefrontFooter
          theme={theme || backdrop.settings?.theme}
          store={backdrop.settings?.store}
          preview={preview}
        />
      )}
      {config.showWhatsapp && <WhatsAppButton />}
    </div>
  );
}
