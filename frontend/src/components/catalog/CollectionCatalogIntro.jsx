import { Children, cloneElement, useState } from "react";
import { Link } from "react-router-dom";
import CatalogLiquidGlass from "./CatalogLiquidGlass";
export default function CollectionCatalogIntro({
  config,
  page,
  children,
  resultCount,
}) {
  const c = config.collection,
    title = config.title || page?.name || "Catálogo";
  const [failed, setFailed] = useState(""),
    [failedTitle, setFailedTitle] = useState("");
  const artwork = c.showArtwork && c.heroArtwork && c.heroArtwork !== failed;
  const controls = children ? Children.toArray(children.props.children) : [];
  if (resultCount)
    controls.splice(1, 0, cloneElement(resultCount, { key: "count" }));
  return (
    <>
      {config.showBreadcrumb && (
        <nav className="cpv-breadcrumb" aria-label="Ruta de navegación">
          <Link to="/">Inicio</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{title}</span>
        </nav>
      )}
      <section
        className="cpv-hero-glass collection-catalog-hero"
        data-artwork={!!artwork}
        style={{ "--collection-art-width": `${c.artworkWidthPx}px` }}
      >
        <CatalogLiquidGlass presentation={config.presentation} />
        <div className="collection-catalog-copy">
          {config.showHeroBadge && config.heroBadge && (
            <p className="collection-catalog-eyebrow">
              {config.heroBadge}
              <span aria-hidden="true" />
            </p>
          )}
          <h1 className="cpv-title">
            {config.titleMode === "image" &&
            config.titleImage &&
            failedTitle !== config.titleImage ? (
              <img
                className="cpv-title-image"
                src={config.titleImage}
                alt={config.titleImageAlt || title}
                onError={() => setFailedTitle(config.titleImage)}
              />
            ) : (
              title
            )}
          </h1>
          {config.subtitle && <p className="cpv-subtitle">{config.subtitle}</p>}
          {config.description && (
            <p className="cpv-description">{config.description}</p>
          )}
        </div>
        {artwork && (
          <img
            className="collection-catalog-art"
            src={c.heroArtwork}
            alt={c.heroArtworkAlt}
            onError={() => setFailed(c.heroArtwork)}
          />
        )}
        {children && cloneElement(children, {}, controls)}
      </section>
    </>
  );
}
