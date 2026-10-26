import MemoryTable from "./MemoryTable";
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
  const memory = config.layout === "memory-table";
  const navigation =
    config.showNavigation && sections.some((s) => s.title.trim());
  return (
    <ServicePageFrame
      page={page}
      config={config}
      theme={theme}
      preview={preview}
      className={`information-page${memory ? " information-page--memory" : ""}`}
    >
      {memory ? (
        <MemoryTable config={config} name={page.name} preview={preview} />
      ) : (
        <ServiceHeading
          config={config}
          title={config.titleText || page.name || "Información"}
          icon={BookOpen}
        />
      )}
      {(!memory || config.journal.showSections) && sections.length > 0 && (
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
      {(!memory || config.journal.showFooterAction) &&
        config.actionText &&
        config.actionHref && (
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
