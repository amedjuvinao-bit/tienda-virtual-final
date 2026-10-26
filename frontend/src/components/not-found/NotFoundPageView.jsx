import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass, RefreshCw } from "lucide-react";
import Header from "../Header";
import FooterSection from "../FooterSection";
import WhatsAppButton from "../WhatsAppButton";
import PolishedGlassRim from "../PolishedGlassRim";
import useStorefrontBackdrop from "../useStorefrontBackdrop";
import { CartGlass, cartVariables } from "../cart/CartMaterial";
import {
  buildSafeNotFoundPageConfig,
  notFoundMaterialConfig,
} from "./notFoundPageConfig";
import "../cart/cartPage.css";
import "./notFoundPage.css";
export default function NotFoundPageView({
  page = {},
  preview = false,
  configError = "",
  onRetry,
}) {
  // A missing-route fallback must remain usable even when its custom design is disabled.
  const config = buildSafeNotFoundPageConfig(
    page.enabled === false && !preview ? {} : page.notFoundPageConfig,
  );
  const material = notFoundMaterialConfig(config);
  const backdrop = useStorefrontBackdrop(config.presentation, config.pageBg);
  const [failedTitle, setFailedTitle] = useState(""),
    [failedImage, setFailedImage] = useState("");
  const hasImage =
    config.showImage && config.imageUrl && failedImage !== config.imageUrl;
  const hasArt = Boolean(hasImage || config.showCode);
  const header = page.useHeader !== false && config.showHeader;
  return (
    <div
      className="cart-storefront notfound-storefront"
      data-chrome={header}
      style={{
        ...cartVariables(material),
        backgroundColor: backdrop.color,
        backgroundImage: backdrop.image
          ? `url(${JSON.stringify(backdrop.image)})`
          : "none",
        "--nf-gap": `${config.gapPx}px`,
        "--nf-title-size": `${config.titleFontSizePx}px`,
        "--nf-code-size": `${config.codeFontSizePx}px`,
        "--nf-image-width": `${config.imageMaxWidthPx}px`,
        "--nf-button-bg": config.buttonBg,
        "--nf-button-ink": config.buttonTextColor,
        "--nf-button-edge": config.buttonBorderColor,
        "--nf-button-alpha": `${config.presentation.checkoutGlassOpacity * 100}%`,
        "--nf-button-blur": `${config.presentation.checkoutGlassBlur}px`,
        "--nf-button-radius": `${config.buttonRadiusPx}px`,
        "--nf-button-size": `${config.buttonFontSizePx}px`,
      }}
    >
      {header && <Header />}
      <main
        className="cart-scene notfound-scene"
        style={{
          maxWidth: config.contentMaxWidthPx,
          "--cart-top": `${config.contentTopPaddingPx}px`,
          paddingBottom: config.contentBottomPaddingPx,
        }}
      >
        {config.showBreadcrumb && (
          <nav
            className="cart-breadcrumb"
            aria-label="Ruta de navegación"
            style={{ color: config.breadcrumbColor }}
          >
            <Link to={config.breadcrumbRootLink}>
              {config.breadcrumbRootLabel}
            </Link>
            <span aria-hidden="true">/</span>
            <span>{config.breadcrumbText}</span>
          </nav>
        )}
        <CartGlass
          config={material}
          className="notfound-panel"
          data-has-art={hasArt}
        >
          <div className="notfound-copy">
            <h1
              className={config.showTitle ? "" : "sr-only"}
              style={{ color: config.titleTextColor }}
            >
              {config.titleMode === "image" &&
              config.titleImage &&
              failedTitle !== config.titleImage ? (
                <img
                  src={config.titleImage}
                  alt={config.titleImageAlt || config.titleText}
                  style={{ maxHeight: config.titleImageHeightPx }}
                  onError={() => setFailedTitle(config.titleImage)}
                />
              ) : (
                config.titleText
              )}
            </h1>
            {config.showMessage && (
              <p
                className="notfound-message"
                style={{
                  color: config.textSecondaryColor,
                  fontSize: config.messageFontSizePx,
                }}
              >
                {config.messageText}
              </p>
            )}
            <div className="notfound-actions">
              {config.showButton && (
                <Link
                  className="notfound-primary"
                  data-style={config.buttonStyle}
                  to={config.buttonLink}
                >
                  <span>{config.buttonText}</span>
                  <ArrowRight size={17} aria-hidden="true" />
                  {config.buttonStyle !== "ghost" && (
                    <PolishedGlassRim
                      radius={config.buttonRadiusPx}
                      width={config.presentation.borderWidth}
                      reflection={config.presentation.reflection}
                    />
                  )}
                </Link>
              )}
              {config.showSecondaryButton && (
                <Link
                  className="notfound-secondary"
                  style={{ color: config.secondaryButtonColor }}
                  to={config.secondaryButtonLink}
                >
                  {config.secondaryButtonText}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
          {hasArt && (
            <div className="notfound-art" style={{ color: config.codeColor }}>
              {hasImage ? (
                <img
                  src={config.imageUrl}
                  alt={config.imageAlt}
                  style={{ borderRadius: config.imageRadiusPx }}
                  onError={() => setFailedImage(config.imageUrl)}
                />
              ) : (
                <div className="notfound-emblem" aria-hidden="true">
                  <Compass size={48} strokeWidth={1} />
                  <span>{config.codeText}</span>
                </div>
              )}
            </div>
          )}
        </CartGlass>
        {configError && (
          <div className="cart-notice" role="alert">
            <span>{configError}</span>
            {onRetry && (
              <button type="button" onClick={onRetry}>
                <RefreshCw size={14} />
                Reintentar
              </button>
            )}
          </div>
        )}
      </main>
      {page.useFooter !== false && config.showFooter && (
        <div className="cart-footer">
          <FooterSection
            theme={backdrop.settings?.theme}
            store={backdrop.settings?.store}
            polishedGlass
          />
        </div>
      )}
      {config.showWhatsapp && <WhatsAppButton />}
    </div>
  );
}
