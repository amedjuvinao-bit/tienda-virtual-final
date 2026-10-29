import ConsumerPageContent from "../consumer/ConsumerPageContent";
import MemoryTable from "./MemoryTable";
import ContactPageContent from "./ContactPageContent";
import HelpPageContent from "./HelpPageContent";
import { useState } from "react";
import { ArrowUpRight, BookOpen } from "lucide-react";
import ServicePageFrame, {
  ServiceButton,
  ServiceHeading,
} from "../service-pages/ServicePageFrame";
import { CartGlass } from "../cart/CartMaterial";
import { informationConfigForPage } from "./informationPageConfig";
import "./informationPage.css";
function ContentSection({ section, config }) {
  const [failedImage, setFailedImage] = useState("");
  const image = section.image && failedImage !== section.image;
  const items = section.items.filter(
    (item) => item.title.trim() || item.body.trim(),
  );
  return (
    <CartGlass
      config={config}
      className="information-section"
      id={`info-${section.id}`}
    >
      {section.title && <h2>{section.title}</h2>}
      {section.type === "faq" ? (
        <div className="information-faq">
          {items.map((item, index) => (
            <details key={index}>
              <summary>{item.title || section.title}</summary>
              <p>{item.body}</p>
            </details>
          ))}
        </div>
      ) : section.type === "values" ? (
        <div className="information-values">
          {items.map((item, index) => (
            <article key={index}>
              {item.title && <h3>{item.title}</h3>}
              {item.body && <p>{item.body}</p>}
            </article>
          ))}
        </div>
      ) : (
        <div
          className="information-story"
          data-image={!!image}
          data-position={section.imagePosition}
        >
          {section.body && <p>{section.body}</p>}
          {image && (
            <img
              src={section.image}
              alt={section.imageAlt}
              loading="lazy"
              onError={() => setFailedImage(section.image)}
            />
          )}
        </div>
      )}
    </CartGlass>
  );
}
export default function InformationPageView({ page, theme, preview = false }) {
  const config = informationConfigForPage(page);
  const sections = config.sections.filter(
    (s) =>
      s.enabled &&
      (s.title.trim() ||
        s.body.trim() ||
        s.image ||
        s.items.some((i) => i.title || i.body)),
  );
  const consumer = String(page.systemRole || "").startsWith("consumer-");
  const memory = config.layout === "memory-table";
  const contact = config.layout === "contact";
  const help = config.layout === "help";
  const shipping = page.systemRole === "consumer-shipping";
  const returns = page.systemRole === "consumer-returns";
  const extra = returns
    ? config.returnsGuide
    : shipping
      ? config.shipping
      : memory
        ? config.journal
        : contact
          ? config.contact
          : help
            ? config.help
            : null;
  const showSections = extra ? extra.showSections : true;
  const showFooterAction = extra ? extra.showFooterAction : true;
  const navigation =
    config.showNavigation && sections.some((s) => s.title.trim());
  return (
    <ServicePageFrame
      page={page}
      config={config}
      theme={theme}
      preview={preview}
      className={`information-page${returns ? " information-page--returns" : ""}${shipping ? " information-page--shipping" : ""}${consumer ? " information-page--consumer" : memory ? " information-page--memory" : contact ? " information-page--contact" : help ? " information-page--help" : ""}`}
    >
      {consumer ? (
        <ConsumerPageContent page={page} config={config} preview={preview} />
      ) : help ? (
        <HelpPageContent config={config} name={page.name} preview={preview} />
      ) : contact ? (
        <ContactPageContent
          config={config}
          name={page.name}
          theme={theme}
          preview={preview}
        />
      ) : memory ? (
        <MemoryTable config={config} name={page.name} preview={preview} />
      ) : (
        <ServiceHeading
          config={config}
          title={config.titleText || page.name || "Información"}
          icon={BookOpen}
        />
      )}
      {showSections && sections.length > 0 && (
        <div
          className="information-layout"
          data-navigation={navigation}
          style={{
            "--info-body-size": `${config.style.bodyFontSizePx}px`,
            "--info-heading-size": `${config.style.sectionTitleSizePx}px`,
            "--info-nav-width": `${config.style.navigationWidthPx}px`,
          }}
        >
          {navigation && (
            <CartGlass config={config} className="information-navigation">
              <nav aria-label={config.navigationTitle || "Secciones"}>
                {config.navigationTitle && <h2>{config.navigationTitle}</h2>}
                {sections
                  .filter((s) => s.title.trim())
                  .map((s) => (
                    <a href={`#info-${s.id}`} key={s.id}>
                      {s.title}
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  ))}
              </nav>
            </CartGlass>
          )}
          <div className="information-content">
            {sections.map((section) => (
              <ContentSection
                key={section.id}
                section={section}
                config={config}
              />
            ))}
          </div>
        </div>
      )}
      {showFooterAction && config.actionText && config.actionHref && (
        <div className="information-actions">
          <ServiceButton as="a" config={config} href={config.actionHref}>
            {config.actionText}
            <ArrowUpRight size={16} aria-hidden="true" />
          </ServiceButton>
        </div>
      )}
    </ServicePageFrame>
  );
}
