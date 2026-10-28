import { useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Coins,
  FileText,
  Gift,
  Headphones,
  House,
  MapPin,
  MessageCircle,
  Package,
  ShoppingCart,
  Truck,
} from "lucide-react";
import {
  ContactGlass as Glass,
  ContactButton as GlassButton,
} from "../information-page/ContactMaterial";
import ContactGlassRim from "../information-page/ContactGlassRim";
import { downloadText } from "../consumer/ConsumerReceipt";
import "./shippingPage.css";
const icons = {
  cart: ShoppingCart,
  package: Gift,
  truck: Truck,
  home: House,
  pin: MapPin,
  clock: Clock3,
  check: Check,
};
function Medallion({ config, icon: Icon, className = "" }) {
  return (
    <span className={`shipping-medallion ${className}`} aria-hidden="true">
      <Icon strokeWidth={1.55} />
      <ContactGlassRim config={config} radius={999} />
    </span>
  );
}
export default function ShippingPageContent({
  page,
  config,
  data,
  error,
  retry,
  preview = false,
}) {
  const s = config.shipping,
    [failedImage, setFailedImage] = useState("");
  const [failedTitle, setFailedTitle] = useState("");
  const [failedCoverage, setFailedCoverage] = useState("");
  const steps = s.steps.filter(
    (step) => step.enabled && step.title.trim() && step.body.trim(),
  );
  const shipment =
    data?.sections?.filter((section) => section.id === "envios") || [];
  const artwork =
    s.showArtwork && s.heroArtwork && failedImage !== s.heroArtwork;
  const stopPreview = (event) => {
    if (preview) event.preventDefault();
  };
  return (
    <div
      className="shipping-content"
      data-editorial={s.editorialHeading}
      data-motion={s.motion}
      style={{
        "--shipping-art-width": `${s.heroArtworkWidthPx}px`,
        "--shipping-hero-height": `${s.heroMinHeightPx}px`,
        "--shipping-icon-size": `${s.iconSizePx}px`,
        "--shipping-body-size": `${config.style.bodyFontSizePx}px`,
        "--shipping-section-size": `${config.style.sectionTitleSizePx}px`,
      }}
    >
      <Glass config={config} className="shipping-hero" data-artwork={!!artwork}>
        <div className="shipping-hero__copy">
          {config.showEyebrow && config.eyebrowText && (
            <p className="shipping-eyebrow">
              {config.eyebrowText}
              <span aria-hidden="true" />
            </p>
          )}
          <h1 className={config.showTitle ? "" : "sr-only"}>
            {config.titleMode === "image" &&
            config.titleImage &&
            failedTitle !== config.titleImage ? (
              <img
                src={config.titleImage}
                alt={config.titleImageAlt || config.titleText || page.name}
                style={{ maxHeight: config.titleImageHeightPx }}
                onError={() => setFailedTitle(config.titleImage)}
              />
            ) : (
              config.titleText || page.name
            )}
          </h1>
          {config.showSubtitle && config.subtitleText && (
            <p className="shipping-subtitle">{config.subtitleText}</p>
          )}
        </div>
        {artwork && (
          <img
            className="shipping-hero__art"
            src={s.heroArtwork}
            alt={s.heroArtworkAlt}
            fetchPriority="high"
            onError={() => setFailedImage(s.heroArtwork)}
          />
        )}
      </Glass>
      {s.showJourney && steps.length > 0 && (
        <Glass
          config={config}
          className="shipping-journey"
          aria-label={s.journeyLabel || "El recorrido de tu pedido"}
        >
          <ol style={{ "--shipping-steps": steps.length }}>
            {steps.map((step) => (
              <li key={step.id}>
                <Medallion config={config} icon={icons[step.icon] || Package} />
                <h2>{step.title}</h2>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </Glass>
      )}
      {(s.showDetails || s.showCoverage) && (
        <div
          className="shipping-information"
          data-pair={s.showDetails && s.showCoverage}
        >
          {s.showDetails && (
            <Glass config={config} className="shipping-details">
              <h2 className="shipping-section-title">
                <Truck aria-hidden="true" strokeWidth={1.5} />
                {s.detailsTitle}
              </h2>
              <dl>
                <div>
                  <Medallion config={config} icon={Coins} />
                  <div>
                    <dt>{s.costTitle}</dt>
                    <dd>{s.costText}</dd>
                  </div>
                </div>
                <div>
                  <Medallion config={config} icon={Clock3} />
                  <div>
                    <dt>{s.deliveryTitle}</dt>
                    <dd>{s.deliveryText}</dd>
                  </div>
                </div>
                {data?.pickupEnabled && data.pickupInstructions && (
                  <div>
                    <Medallion config={config} icon={House} />
                    <div>
                      <dt>{s.pickupTitle}</dt>
                      <dd>{data.pickupInstructions}</dd>
                    </div>
                  </div>
                )}
              </dl>
            </Glass>
          )}
          {s.showCoverage && (
            <Glass
              config={config}
              className="shipping-coverage"
              data-artwork={s.showCoverageArtwork}
            >
              <h2 className="shipping-section-title">
                <MapPin aria-hidden="true" strokeWidth={1.5} />
                {s.coverageTitle}
              </h2>
              <p>{s.coverageText}</p>
              {s.showCoverageArtwork && (
                <div className="shipping-location-art" aria-hidden="true">
                  {s.coverageArtwork && s.coverageArtwork !== failedCoverage ? (
                    <img
                      src={s.coverageArtwork}
                      alt=""
                      loading="lazy"
                      onError={() => setFailedCoverage(s.coverageArtwork)}
                    />
                  ) : (
                    <>
                      <MapPin />
                      <span />
                    </>
                  )}
                </div>
              )}
            </Glass>
          )}
        </div>
      )}
      {s.showSupport && (
        <Glass config={config} className="shipping-support">
          <Headphones
            className="shipping-support__icon"
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <div>
            <h2>{s.supportTitle}</h2>
            <p>{s.supportText}</p>
          </div>
          <div className="shipping-support__actions">
            {s.contactText.trim() && s.contactHref && (
              <GlassButton
                config={config}
                as="a"
                href={s.contactHref}
                onClick={stopPreview}
              >
                <MessageCircle size={20} aria-hidden="true" />
                {s.contactText}
                <ArrowRight size={16} aria-hidden="true" />
              </GlassButton>
            )}
            {s.claimsText.trim() && s.claimsHref && (
              <GlassButton
                config={config}
                as="a"
                href={s.claimsHref}
                onClick={stopPreview}
              >
                <FileText size={20} aria-hidden="true" />
                {s.claimsText}
                <ArrowRight size={16} aria-hidden="true" />
              </GlassButton>
            )}
          </div>
        </Glass>
      )}
      {error && (
        <p className="shipping-load-error" role="alert">
          {error}{" "}
          <button type="button" onClick={retry}>
            {s.retryText || "Reintentar"}
          </button>
        </p>
      )}
      <details className="shipping-conditions">
        <summary>
          {s.conditionsText.trim() ||
            "Condiciones completas de entrega y datos del vendedor"}
        </summary>
        {error ? (
          <p>{error}</p>
        ) : !data ? (
          <p role="status">{s.loadingText}</p>
        ) : (
          <>
            <section aria-label="Identificación del vendedor">
              <h2>
                {data.seller.legalName ||
                  "Identificación del vendedor pendiente de completar"}
                {data.seller.nit ? ` · NIT ${data.seller.nit}` : ""}
              </h2>
              <p>{data.seller.notificationAddress}</p>
              <p>
                {data.seller.email}
                {data.seller.phone ? ` · ${data.seller.phone}` : ""}
              </p>
            </section>
            {shipment.map((section) => (
              <section key={section.id}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </section>
            ))}
            <GlassButton
              config={config}
              disabled={preview}
              onClick={() =>
                downloadText(
                  `${page.slug}.txt`,
                  [
                    page.name,
                    `Versión ${data.version}`,
                    ...Object.values(data.seller),
                    ...shipment.flatMap((section) => [
                      section.title,
                      section.body,
                    ]),
                  ].join("\n\n"),
                )
              }
            >
              {s.downloadText || "Descargar esta información"}
            </GlassButton>
          </>
        )}
      </details>
      {data?.authorityUrl && (
        <p className="shipping-authority">
          <a
            href={data.authorityUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stopPreview}
          >
            Superintendencia de Industria y Comercio · Protección al consumidor
          </a>
        </p>
      )}
    </div>
  );
}
