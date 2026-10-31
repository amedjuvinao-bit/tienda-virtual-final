import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Headphones,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
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
import { buildTermsPage, TERMS_TOPICS } from "./termsPageConfig";
import "./termsPage.css";

const icons = {
  terminos: ShoppingCart,
  envios: Truck,
  retracto: FileText,
  garantia: ShieldCheck,
  reversion: CreditCard,
  privacidad: UserRound,
};
const anchor = (id) => `condiciones-${id}`;
const hashTopic = () => {
  const match = window.location.hash.match(/^#condiciones-([a-z]+)$/);
  return match && Object.hasOwn(TERMS_TOPICS, match[1]) ? match[1] : "";
};
export default function TermsPageContent({
  page,
  config,
  data,
  error,
  retry,
  preview = false,
}) {
  const c = buildTermsPage(config.termsPage);
  const sections = Object.keys(TERMS_TOPICS).flatMap((id) => {
    const section = data?.sections?.find((item) => item.id === id);
    return section ? [section] : [];
  });
  const initial = preview ? "" : hashTopic();
  const [active, setActive] = useState(initial || "terminos");
  const [opened, setOpened] = useState(() => new Set([initial || "terminos"]));
  const [failedImage, setFailedImage] = useState("");
  const [failedTitle, setFailedTitle] = useState("");
  const [fits, setFits] = useState(false);
  const sidebar = useRef(null),
    targets = useRef({}),
    pendingFrame = useRef(null);
  const artwork =
    c.showArtwork && c.heroArtwork && failedImage !== c.heroArtwork;
  const blocked = preview ? (event) => event.preventDefault() : undefined;
  const signature = sections.map((section) => section.id).join(",");

  const reveal = (id, scroll = true) => {
    setActive(id);
    setOpened((current) => new Set([...current, id]));
    if (scroll) {
      cancelAnimationFrame(pendingFrame.current);
      pendingFrame.current = requestAnimationFrame(() => {
        const target = targets.current[id];
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "start", behavior: "auto" });
      });
    }
  };
  useEffect(() => {
    if (preview || !signature) return;
    const restore = () => {
      const id = hashTopic();
      if (id && signature.split(",").includes(id)) reveal(id);
      else setActive("terminos");
    };
    if (hashTopic()) restore();
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("hashchange", restore);
      window.removeEventListener("popstate", restore);
      cancelAnimationFrame(pendingFrame.current);
    };
  }, [signature, preview]);
  useEffect(() => {
    const node = sidebar.current;
    if (!node) return;
    const measure = () =>
      setFits(
        node.getBoundingClientRect().height + c.stickyOffsetPx + 20 <
          window.innerHeight,
      );
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [signature, config.showNavigation, c.stickyOffsetPx]);
  const navigate = (event, id) => {
    event.preventDefault();
    if (!preview && window.location.hash !== `#${anchor(id)}`)
      window.history.pushState(window.history.state, "", `#${anchor(id)}`);
    reveal(id, !preview);
  };
  const download = () => {
    if (preview || error || !data || !sections.length) return;
    downloadText(
      `${page.slug}.txt`,
      [
        page.name,
        documentReferenceText(data.version),
        ...Object.values(data.seller || {}),
        ...sections.flatMap((section) => [section.title, section.body]),
      ].join("\n\n"),
    );
  };
  const downloadButton = (
    <GlassButton
      config={config}
      disabled={preview || !data || !!error || !sections.length}
      onClick={download}
    >
      <Download size={22} aria-hidden="true" />
      <span>{c.downloadText || "Descargar condiciones"}</span>
    </GlassButton>
  );
  return (
    <div
      className="terms-page"
      data-editorial={c.editorialHeading}
      data-motion={c.motion}
      style={{
        "--terms-art-width": `${c.heroArtworkWidthPx}px`,
        "--terms-hero-height": `${c.heroMinHeightPx}px`,
        "--terms-nav-width": `${config.style.navigationWidthPx}px`,
        "--terms-sticky-top": `${c.stickyOffsetPx}px`,
        "--terms-body-size": `${config.style.bodyFontSizePx}px`,
        "--terms-section-size": `${config.style.sectionTitleSizePx}px`,
      }}
    >
      <Glass config={config} className="terms-hero" data-artwork={!!artwork}>
        <div>
          {config.showEyebrow && config.eyebrowText && (
            <p className="terms-eyebrow">
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
            <p className="terms-subtitle">{config.subtitleText}</p>
          )}
        </div>
        {artwork && (
          <img
            className="terms-hero__art"
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
          <div className="terms-layout" data-navigation={config.showNavigation}>
            {config.showNavigation && (
              <aside
                ref={sidebar}
                className="terms-index"
                data-sticky={c.stickyIndex && fits}
              >
                <Glass config={config}>
                  <nav aria-label={c.indexTitle || "Encuentra un tema"}>
                    <h2>
                      {c.indexTitle || "Encuentra un tema"}
                      <span aria-hidden="true" />
                    </h2>
                    <ol>
                      {sections.map((section, index) => {
                        const Icon = icons[section.id];
                        return (
                          <li key={section.id}>
                            <GlassButton
                              as={preview ? "button" : "a"}
                              config={config}
                              href={
                                preview ? undefined : `#${anchor(section.id)}`
                              }
                              aria-current={
                                active === section.id ? "location" : undefined
                              }
                              onClick={(event) => navigate(event, section.id)}
                            >
                              <span className="terms-number">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <Icon size={24} aria-hidden="true" />
                              <span>
                                {c.topics[section.id].label.trim() ||
                                  section.title}
                              </span>
                              <ChevronRight size={17} aria-hidden="true" />
                            </GlassButton>
                          </li>
                        );
                      })}
                    </ol>
                  </nav>
                  <div className="terms-download">
                    {downloadButton}
                    {c.downloadHint && <p>{c.downloadHint}</p>}
                  </div>
                  {c.showHelp && c.helpHref && (
                    <div className="terms-help">
                      <Headphones size={30} aria-hidden="true" />
                      <div>
                        {c.helpTitle && <h3>{c.helpTitle}</h3>}
                        <a href={c.helpHref} onClick={blocked}>
                          {c.helpText || "Peticiones y reclamos"}{" "}
                          <span aria-hidden="true">→</span>
                        </a>
                      </div>
                    </div>
                  )}
                </Glass>
              </aside>
            )}
            <div className="terms-sections">
              {sections.map((section, index) => {
                const Icon = icons[section.id];
                return (
                  <Glass
                    config={config}
                    className="terms-section"
                    key={section.id}
                  >
                    <details
                      open={opened.has(section.id)}
                      onToggle={(event) => {
                        const open = event.currentTarget.open;
                        setOpened((current) => {
                          if (current.has(section.id) === open) return current;
                          const next = new Set(current);
                          if (open) next.add(section.id);
                          else next.delete(section.id);
                          return next;
                        });
                        if (open) setActive(section.id);
                      }}
                    >
                      <summary
                        id={anchor(section.id)}
                        ref={(node) => {
                          targets.current[section.id] = node;
                        }}
                      >
                        <span className="terms-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <Icon size={28} aria-hidden="true" />
                        <span>
                          {index === 0 && c.firstEyebrow && (
                            <small>{c.firstEyebrow}</small>
                          )}
                          <h2>{section.title}</h2>
                        </span>
                        <ChevronDown size={23} aria-hidden="true" />
                      </summary>
                      <div className="terms-section__body">
                        {String(section.body || "")
                          .split(
                            section.id === "terminos"
                              ? /\n\s*\n|(?<=\.)\s+(?=Solo la|Conservamos las|Los derechos)/
                              : /\n\s*\n/,
                          )
                          .map((paragraph, n) => (
                            <p key={n}>{paragraph}</p>
                          ))}
                      </div>
                    </details>
                  </Glass>
                );
              })}
            </div>
          </div>
          {!config.showNavigation && (
            <div className="terms-standalone-actions">
              {downloadButton}
              {c.showHelp && c.helpHref && (
                <GlassButton
                  as="a"
                  config={config}
                  href={c.helpHref}
                  onClick={blocked}
                >
                  {c.helpText || "Peticiones y reclamos"}
                </GlassButton>
              )}
            </div>
          )}
          <Glass config={config} className="terms-seller">
            <details>
              <summary>
                <Store size={24} aria-hidden="true" />
                <span>
                  {c.sellerText || "Datos del vendedor y canales de contacto"}
                </span>
                <ChevronDown size={19} aria-hidden="true" />
              </summary>
              <div>
                <h2>{c.sellerTitle || "Identificación del vendedor"}</h2>
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
                  {c.contactText || "Canales de contacto"}
                </a>
              </div>
            </details>
          </Glass>
          <Glass config={config} className="terms-reference">
            <FileText size={28} aria-hidden="true" />
            <ConsumerDocumentReference version={data.version} purchase />
          </Glass>
          {data.authorityUrl && (
            <p className="terms-authority">
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
