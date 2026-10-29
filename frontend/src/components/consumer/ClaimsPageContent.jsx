import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import {
  ContactGlass as Glass,
  ContactButton as GlassButton,
} from "../information-page/ContactMaterial";
import ConsumerCaseForm from "./ConsumerCaseForm";
import ConsumerDocumentReference, {
  documentReferenceText,
} from "./ConsumerDocumentReference";
import { downloadText } from "./ConsumerReceipt";
import "./claimsPage.css";
export default function ClaimsPageContent({
  page,
  config,
  data,
  error,
  retry,
  preview = false,
}) {
  const c = config.claimsPage;
  const [failedImage, setFailedImage] = useState("");
  const [failedTitle, setFailedTitle] = useState("");
  const artwork =
    c.showArtwork && c.heroArtwork && failedImage !== c.heroArtwork;
  const privacy =
    data?.sections?.filter((section) => section.id === "privacidad") || [];
  return (
    <div
      className="claims-page"
      data-editorial={c.editorialHeading}
      data-motion={c.motion}
      style={{
        "--claims-art-width": `${c.heroArtworkWidthPx}px`,
        "--claims-hero-height": `${c.heroMinHeightPx}px`,
        "--claims-sidebar-width": `${c.sidebarWidthPx}px`,
        "--claims-field-radius": `${c.fieldRadiusPx}px`,
        "--claims-field-opacity": `${c.fieldOpacity * 100}%`,
        "--claims-field-blur": `${c.fieldBlur}px`,
        "--claims-textarea-height": `${c.textareaHeightPx}px`,
        "--claims-body-size": `${config.style.bodyFontSizePx}px`,
        "--claims-heading-size": `${config.style.sectionTitleSizePx}px`,
        "--claims-field-tint": config.style.inputBg || config.style.cardBg,
        "--claims-field-ink":
          config.style.inputTextColor || config.style.textPrimaryColor,
        "--claims-field-edge":
          config.style.inputBorderColor || config.style.cardBorderColor,
      }}
    >
      <Glass config={config} className="claims-hero" data-artwork={!!artwork}>
        <div>
          {config.showEyebrow && config.eyebrowText && (
            <p className="claims-eyebrow">
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
            <p className="claims-subtitle">{config.subtitleText}</p>
          )}
        </div>
        {artwork && (
          <img
            className="claims-hero__art"
            src={c.heroArtwork}
            alt={c.heroArtworkAlt}
            onError={() => setFailedImage(c.heroArtwork)}
          />
        )}
      </Glass>
      {error ? (
        <p role="alert" className="claims-load-notice">
          {error}{" "}
          <button type="button" onClick={retry}>
            {c.retryText || "Reintentar"}
          </button>
        </p>
      ) : !data ? (
        <p role="status">{c.loadingText}</p>
      ) : (
        <ConsumerCaseForm config={config} document={data} preview={preview} />
      )}
      <Glass config={config} className="claims-seller-shell">
        <details className="claims-seller">
          <summary>
            <FileText size={23} aria-hidden="true" />
            <span>
              {c.sellerText.trim() ||
                "Datos del vendedor y atención al consumidor"}
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div>
            {error ? (
              <p>{error}</p>
            ) : !data ? (
              <p role="status">{c.loadingText}</p>
            ) : (
              <>
                <section>
                  <h2>Identificación del vendedor</h2>
                  <p>
                    {data.seller.legalName ||
                      "Identificación pendiente de completar"}
                    {data.seller.nit && ` · NIT ${data.seller.nit}`}
                  </p>
                  <p>{data.seller.notificationAddress}</p>
                  <p>
                    {data.seller.email}
                    {data.seller.phone && ` · ${data.seller.phone}`}
                  </p>
                  <a
                    href="/contacto"
                    onClick={
                      preview ? (event) => event.preventDefault() : undefined
                    }
                  >
                    Canales de contacto
                  </a>
                </section>
                {privacy.map((section) => (
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
                        documentReferenceText(data.version),
                        ...Object.values(data.seller),
                        ...privacy.flatMap((section) => [
                          section.title,
                          section.body,
                        ]),
                      ].join("\n\n"),
                    )
                  }
                >
                  {c.downloadText || "Descargar esta información"}
                </GlassButton>
              </>
            )}
          </div>
        </details>
      </Glass>
      {!error && <ConsumerDocumentReference version={data?.version} />}
      {data?.authorityUrl && (
        <p className="claims-authority">
          <a
            href={data.authorityUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={preview ? (event) => event.preventDefault() : undefined}
          >
            Superintendencia de Industria y Comercio · Protección al consumidor
          </a>
        </p>
      )}
    </div>
  );
}
