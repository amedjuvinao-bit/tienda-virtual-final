import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export default function CatalogIntro({ config: safeConfig, page }) {
  const title = safeConfig.title || page?.name || 'Catálogo';
  const subtitle = safeConfig.subtitle, description = safeConfig.description;
  const titleImage = safeConfig.titleImage.trim(), titleImageAlt = safeConfig.titleImageAlt.trim() || title;
  return <>
              {safeConfig.showBreadcrumb && (
                <nav className="cpv-breadcrumb">
                  <Link to="/">Inicio</Link>
                  <span>›</span>
                  <span className="cpv-bc-current">{title}</span>
                </nav>
              )}

              <section className="cpv-hero">
                <div className="cpv-hero-top">
                  {safeConfig.showHeroBadge && safeConfig.heroBadge && (
                    <div className="cpv-hero-badge">
                      <Sparkles size={14} />
                      {safeConfig.heroBadge}
                    </div>
                  )}

                  <div className="cpv-title-wrap">
                    {safeConfig.titleMode === "image" && titleImage ? (
                      <img
                        src={titleImage}
                        alt={titleImageAlt}
                        className="cpv-title-image"
                        draggable="false"
                      />
                    ) : (
                      <>
                        <h1 className="cpv-title">{title}</h1>
                        {subtitle ? (
                          <p className="cpv-subtitle">{subtitle}</p>
                        ) : null}
                      </>
                    )}

                    {description ? (
                      <p className="cpv-description">{description}</p>
                    ) : null}
                  </div>
                </div>
              </section>

  </>;
}
