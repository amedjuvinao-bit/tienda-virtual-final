import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import CatalogGlassBags from './CatalogGlassBags';

export default function CatalogIntro({ config: safeConfig, page }) {
  const glass = safeConfig.presentation?.layout === 'glass-grid';
  const title = safeConfig.title || page?.name || 'Catálogo';
  const subtitle = safeConfig.subtitle, description = safeConfig.description;
  const titleImage = safeConfig.titleImage.trim(), titleImageAlt = safeConfig.titleImageAlt.trim() || title;
  return <>
              {safeConfig.showBreadcrumb && (
                <nav className="cpv-breadcrumb" aria-label="Ruta de navegación">
                  <Link to="/">Inicio</Link>
                  <span>›</span>
                  <span className="cpv-bc-current">{title}</span>
                </nav>
              )}

              <section className={`cpv-hero${glass ? ' cpv-hero-glass' : ''}`}>
                <div className="cpv-hero-top">
                  {safeConfig.showHeroBadge && safeConfig.heroBadge && (
                    <div className="cpv-hero-badge">
                      {!glass && <Sparkles size={14} />}
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
                {glass && <CatalogGlassBags />}
              </section>

  </>;
}
