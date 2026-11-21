import { useId, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  ChevronDown,
  FileText,
  Headphones,
  PackageOpen,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  ContactGlass as Glass,
  ContactButton as GlassButton,
} from "../information-page/ContactMaterial";
import ContactGlassRim from "../information-page/ContactGlassRim";
import ConsumerDocumentReference, {
  documentReferenceText,
} from "./ConsumerDocumentReference";
import { downloadText } from "./ConsumerReceipt";
import "./returnsGuide.css";

const icons = {
  exchange: ArrowRightLeft,
  shield: ShieldCheck,
  return: PackageOpen,
  help: Headphones,
  document: FileText,
};
const sectionIds = {
  change: ["garantia"],
  warranty: ["garantia"],
  withdrawal: ["retracto", "reversion"],
};
function Medallion({ config, children }) {
  return (
    <span className="returns-guide__medallion" aria-hidden="true">
      {children}
      <ContactGlassRim config={config} radius={999} />
    </span>
  );
}
function PolicySections({ sections }) {
  return sections.map((section) => (
    <section key={section.id}>
      <h3>{section.title}</h3>
      <p>{section.body}</p>
    </section>
  ));
}
export default function ReturnsGuideContent({
  page,
  config,
  data,
  error,
  retry,
  preview = false,
}) {
  const s = config.returnsGuide;
  const [failedArtwork, setFailedArtwork] = useState("");
  const [failedTitle, setFailedTitle] = useState("");
  const [selected, setSelected] = useState("");
  const panelId = useId();
  const choiceTrigger = useRef(null);
  const choices = s.choices.filter(
    (item) =>
      item.enabled &&
      item.title.trim() &&
      item.body.trim() &&
      item.actionText.trim(),
  );
  const active = choices.find((item) => item.id === selected);
  const sections =
    data?.sections?.filter((item) =>
      ["retracto", "garantia", "reversion"].includes(item.id),
    ) || [];
  const artwork =
    s.showArtwork && s.heroArtwork && s.heroArtwork !== failedArtwork;
  const stopPreview = (event) => {
    if (preview) event.preventDefault();
  };
  return (
    <div
      className="returns-guide"
      data-editorial={s.editorialHeading}
      data-motion={s.motion}
      style={{
        "--returns-art-width": `${s.heroArtworkWidthPx}px`,
        "--returns-hero-height": `${s.heroMinHeightPx}px`,
        "--returns-icon-size": `${s.iconSizePx}px`,
        "--returns-body-size": `${config.style.bodyFontSizePx}px`,
        "--returns-heading-size": `${config.style.sectionTitleSizePx}px`,
      }}
    >
      <Glass
        config={config}
        className="returns-guide__hero"
        data-artwork={!!artwork}
      >
        <div className="returns-guide__copy">
          {config.showEyebrow && config.eyebrowText && (
            <p className="returns-guide__eyebrow">
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
            <p className="returns-guide__subtitle">{config.subtitleText}</p>
          )}
        </div>
        {artwork && (
          <img
            className="returns-guide__art"
            src={s.heroArtwork}
            alt={s.heroArtworkAlt}
            onError={() => setFailedArtwork(s.heroArtwork)}
          />
        )}
      </Glass>
      {s.showChoices && choices.length > 0 && (
        <Glass config={config} className="returns-guide__choices">
          {s.choicesTitle && (
            <h2 className="returns-guide__section-title">
              <span aria-hidden="true" />
              {s.choicesTitle}
              <span aria-hidden="true" />
            </h2>
          )}
          <div
            className="returns-guide__grid"
            style={{ "--returns-columns": choices.length }}
          >
            {choices.map((item) => {
              const Icon = icons[item.icon] || ArrowRightLeft;
              return (
                <Glass
                  key={item.id}
                  config={config}
                  className="returns-guide__choice"
                  data-selected={active?.id === item.id}
                >
                  <Medallion config={config}>
                    <Icon strokeWidth={1.5} />
                  </Medallion>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <GlassButton
                    config={config}
                    aria-expanded={active?.id === item.id}
                    aria-controls={panelId}
                    onClick={(event) => {
                      choiceTrigger.current = event.currentTarget;
                      setSelected(active?.id === item.id ? "" : item.id);
                    }}
                  >
                    {item.actionText}
                    <ArrowRight size={16} aria-hidden="true" />
                  </GlassButton>
                </Glass>
              );
            })}
          </div>
          <div
            id={panelId}
            className="returns-guide__choice-details"
            hidden={!active}
          >
            {active && (
              <>
                <div className="returns-guide__detail-heading">
                  <h2>{active.title}</h2>
                  <button
                    type="button"
                    className="returns-guide__close"
                    onClick={() => {
                      setSelected("");
                      choiceTrigger.current?.focus();
                    }}
                    aria-label={s.closeText || "Cerrar información"}
                  >
                    <X size={20} />
                  </button>
                </div>
                {active.id === "change" && s.orderHelpText && (
                  <p>{s.orderHelpText}</p>
                )}
                {error ? (
                  <p>{error}</p>
                ) : !data ? (
                  <p role="status">{s.loadingText}</p>
                ) : (
                  <PolicySections
                    sections={sections.filter((item) =>
                      sectionIds[active.id].includes(item.id),
                    )}
                  />
                )}
                {active.requestHref && (
                  <GlassButton
                    config={config}
                    as="a"
                    href={active.requestHref}
                    onClick={stopPreview}
                  >
                    {s.requestText || "Iniciar solicitud de atención"}
                    <ArrowRight size={16} aria-hidden="true" />
                  </GlassButton>
                )}
              </>
            )}
          </div>
        </Glass>
      )}
      {s.showJourney && s.steps.length > 0 && (
        <Glass
          config={config}
          className="returns-guide__journey"
          aria-label={s.journeyLabel || "Cómo solicitar atención"}
        >
          <ol>
            {s.steps.map((step, index) => (
              <li key={index}>
                <Medallion config={config}>{index + 1}</Medallion>
                <div>
                  <h2>{step.title}</h2>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Glass>
      )}
      {s.showSupport && (
        <Glass config={config} className="returns-guide__support">
          <Headphones
            className="returns-guide__support-icon"
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <div>
            <h2>{s.supportTitle}</h2>
            <p>{s.supportText}</p>
          </div>
          <div className="returns-guide__actions">
            {s.claimsText && s.claimsHref && (
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
            {s.trackText && s.trackHref && (
              <GlassButton
                config={config}
                as="a"
                href={s.trackHref}
                onClick={stopPreview}
              >
                <Search size={20} aria-hidden="true" />
                {s.trackText}
                <ArrowRight size={16} aria-hidden="true" />
              </GlassButton>
            )}
          </div>
        </Glass>
      )}
      {error && (
        <p role="alert" className="returns-guide__error">
          {error}{" "}
          <button type="button" onClick={retry}>
            {s.retryText || "Reintentar"}
          </button>
        </p>
      )}
      <Glass config={config} className="returns-guide__conditions-shell">
        <details className="returns-guide__conditions">
          <summary>
            <FileText size={24} aria-hidden="true" />
            <span>
              {s.conditionsText.trim() ||
                "Condiciones completas y derechos del consumidor"}
            </span>
            <small>{s.conditionsHint}</small>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="returns-guide__legal">
            {error ? (
              <p>{error}</p>
            ) : !data ? (
              <p role="status">{s.loadingText}</p>
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
                  <a href="/contacto" onClick={stopPreview}>
                    Canales de contacto
                  </a>
                </section>
                <PolicySections sections={sections} />
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
                        ...sections.flatMap((item) => [item.title, item.body]),
                      ].join("\n\n"),
                    )
                  }
                >
                  {s.downloadText || "Descargar esta información"}
                </GlassButton>
              </>
            )}
          </div>
        </details>
      </Glass>
      {!error && <ConsumerDocumentReference version={data?.version} purchase />}
      {data?.authorityUrl && (
        <p className="returns-guide__authority">
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
