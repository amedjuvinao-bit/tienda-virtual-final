import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Database,
  Download,
  Eye,
  FileText,
  Hand,
  Headphones,
  HelpCircle,
  LockKeyhole,
  MessagesSquare,
  Package,
  ShieldCheck,
  SquarePen,
  Store,
  UserRound,
} from "lucide-react";
import {
  ContactGlass as Glass,
  ContactButton as GlassButton,
} from "../information-page/ContactMaterial";
import ConsumerDocumentReference, {
  documentReferenceText,
} from "./ConsumerDocumentReference";
import { downloadText } from "./ConsumerReceipt";
import { buildPrivacyPage } from "./privacyPageConfig";
import { privacyPolicySections } from "./privacyPolicySections";
import "./privacyPage.css";

const icons = {
  user: UserRound,
  package: Package,
  hand: Hand,
  eye: Eye,
  edit: SquarePen,
  shield: ShieldCheck,
  file: FileText,
  messages: MessagesSquare,
  database: Database,
};
const topicIcons = {
  datos: FileText,
  autorizacion: MessagesSquare,
  conservacion: Database,
  consultas: HelpCircle,
};
function PolicySection({ section, index, config, c }) {
  const [open, setOpen] = useState(index === 0);
  const Icon = topicIcons[section.id] || FileText;
  return (
    <Glass config={config} className="privacy-policy-section">
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>
          <span className="privacy-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <Icon size={28} aria-hidden="true" />
          <h2>
            {c.topics[section.id]?.label.trim() ||
              (section.id === "privacidad"
                ? c.fullPolicyTitle || section.title
                : section.title)}
          </h2>
          <ChevronDown size={22} aria-hidden="true" />
        </summary>
        <div className="privacy-policy-body">
          {section.paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          {section.note && (
            <div className="privacy-safety">
              <LockKeyhole size={24} aria-hidden="true" />
              <p>{section.note}</p>
            </div>
          )}
        </div>
      </details>
    </Glass>
  );
}
export default function PrivacyPageContent({
  page,
  config,
  data,
  error,
  retry,
  preview = false,
}) {
  const c = buildPrivacyPage(config.privacyPage);
  const sections = privacyPolicySections(data);
  const policy = data?.sections?.find((section) => section.id === "privacidad");
  const summaries = c.summaries.filter((item) => item.enabled),
    rights = c.rights.filter((item) => item.enabled);
  const [failedImage, setFailedImage] = useState(""),
    [failedTitle, setFailedTitle] = useState("");
  const artwork =
    c.showArtwork && c.heroArtwork && failedImage !== c.heroArtwork;
  const blocked = preview ? (event) => event.preventDefault() : undefined;
  const rightsAction = (
    <GlassButton
      as="a"
      config={config}
      href={c.rightsHref || "/pqr?tipo=privacy_query"}
      onClick={blocked}
    >
      <span>{c.rightsText || "Ejercer mis derechos"}</span>
      <ArrowRight size={20} aria-hidden="true" />
    </GlassButton>
  );
  return (
    <div
      className="privacy-page"
      data-editorial={c.editorialHeading}
      data-motion={c.motion}
      style={{
        "--privacy-art-width": `${c.heroArtworkWidthPx}px`,
        "--privacy-hero-height": `${c.heroMinHeightPx}px`,
        "--privacy-sidebar-width": `${c.sidebarWidthPx}px`,
        "--privacy-body-size": `${config.style.bodyFontSizePx}px`,
        "--privacy-heading-size": `${config.style.sectionTitleSizePx}px`,
      }}
    >
      <Glass config={config} className="privacy-hero" data-artwork={!!artwork}>
        <div>
          {config.showEyebrow && config.eyebrowText && (
            <p className="privacy-eyebrow">
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
            <p className="privacy-subtitle">{config.subtitleText}</p>
          )}
        </div>
        {artwork && (
          <img
            className="privacy-hero__art"
            src={c.heroArtwork}
            alt={c.heroArtworkAlt}
            onError={() => setFailedImage(c.heroArtwork)}
          />
        )}
      </Glass>
      {error ? (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={retry}>
            {c.retryText || "Reintentar"}
          </button>
        </p>
      ) : !data ? (
        <p role="status">{c.loadingText}</p>
      ) : (
        <>
          {c.showSummary && summaries.length > 0 && (
            <Glass config={config} className="privacy-overview">
              <ul>
                {summaries.map((item) => {
                  const Icon = icons[item.icon] || FileText;
                  return (
                    <li key={item.id}>
                      <Icon size={36} strokeWidth={1.5} aria-hidden="true" />
                      <div>
                        <h2>{item.title}</h2>
                        <p>{item.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Glass>
          )}
          <div className="privacy-layout" data-rights={c.showRights}>
            <div className="privacy-policy">
              {sections.map((section, index) => (
                <PolicySection
                  key={section.id}
                  section={section}
                  index={index}
                  config={config}
                  c={c}
                />
              ))}
            </div>
            {c.showRights && (
              <Glass config={config} className="privacy-rights">
                {c.rightsEyebrow && (
                  <p className="privacy-eyebrow">
                    {c.rightsEyebrow}
                    <span aria-hidden="true" />
                  </p>
                )}
                <h2>{c.rightsTitle || "Conoce tus derechos"}</h2>
                {rights.length > 0 && (
                  <ul>
                    {rights.map((item) => {
                      const Icon = icons[item.icon] || ShieldCheck;
                      return (
                        <li key={item.id}>
                          <Icon
                            size={30}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                          <div>
                            <h3>{item.title}</h3>
                            <p>{item.body}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {rightsAction}
                {c.rightsHint && (
                  <p className="privacy-rights-hint">{c.rightsHint}</p>
                )}
                {c.contactHref && (
                  <div className="privacy-contact">
                    <Headphones size={28} aria-hidden="true" />
                    <a href={c.contactHref} onClick={blocked}>
                      {c.contactText || "Contactar tienda"}{" "}
                      <ArrowRight size={16} aria-hidden="true" />
                    </a>
                  </div>
                )}
              </Glass>
            )}
          </div>
          <Glass config={config} className="privacy-download">
            <FileText size={32} aria-hidden="true" />
            <div>
              <h2>{c.downloadTitle}</h2>
              {c.downloadHint && <p>{c.downloadHint}</p>}
            </div>
            <GlassButton
              config={config}
              disabled={preview || !policy}
              onClick={() => {
                if (!preview && policy)
                  downloadText(
                    `${page.slug}.txt`,
                    [
                      page.name,
                      documentReferenceText(data.version),
                      ...Object.values(data.seller || {}),
                      policy.title,
                      policy.body,
                    ].join("\n\n"),
                  );
              }}
            >
              <Download size={20} aria-hidden="true" />
              <span>{c.downloadText || "Descargar política"}</span>
            </GlassButton>
            {!c.showRights && rightsAction}
          </Glass>
          <Glass config={config} className="privacy-seller">
            <details>
              <summary>
                <Store size={24} aria-hidden="true" />
                <span>
                  {c.sellerText || "Responsable y canales de contacto"}
                </span>
                <ChevronDown size={20} aria-hidden="true" />
              </summary>
              <div>
                <h2>{c.sellerTitle || "Identificación del responsable"}</h2>
                <p>
                  {data.seller?.legalName ||
                    "Identificación pendiente de completar"}
                  {data.seller?.nit && ` · NIT ${data.seller.nit}`}
                </p>
                <p>{data.seller?.notificationAddress}</p>
                <p>
                  {data.seller?.email}
                  {data.seller?.phone && ` · ${data.seller.phone}`}
                </p>
                <a href="/contacto" onClick={blocked}>
                  {c.sellerContactText || "Canales de contacto"}
                </a>
              </div>
            </details>
          </Glass>
          <ConsumerDocumentReference version={data.version} />
          {data.authorityUrl && (
            <p className="privacy-authority">
              <a
                href={data.authorityUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={blocked}
              >
                Superintendencia de Industria y Comercio · Protección al
                consumidor
              </a>
            </p>
          )}
        </>
      )}
    </div>
  );
}
