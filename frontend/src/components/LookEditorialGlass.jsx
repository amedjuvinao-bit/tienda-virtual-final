import { ChevronLeft, ChevronRight, Heart, ShoppingCart } from "lucide-react";
import { useRef } from "react";
import "./lookEditorialGlass.css";

function moneyCOP(value) {
  return `$${Math.round(Number(value) || 0).toLocaleString("es-CO")}`;
}

export default function LookEditorialGlass({ config, style, products, mainImage, mainImageAlt, selectedId, onSelect,
  onCart, onFavorite, isFavorite, loading }) {
  const railRef = useRef(null);
  const hasCover = config.heroMode === "custom" && Boolean(config.heroImage);
  const options = [hasCover ? { id: "", image: config.heroImage } : null, ...products].filter(Boolean);
  const currentIndex = Math.max(0, options.findIndex((option) => option.id === selectedId));
  const depth = style.editorialDepth / 100;
  const css = {
    "--look-backdrop": `url("${config.editorialBackgroundImage || "/looks-editorial-background.webp"}")`,
    "--look-background": style.editorialBackgroundColor,
    "--look-glass": style.editorialGlassColor,
    "--look-glass-opacity": `${style.editorialGlassOpacity}%`,
    "--look-blur": `${style.editorialGlassBlurPx}px`,
    "--look-accent": style.editorialAccentColor,
    "--look-text": style.editorialTextColor,
    "--look-overlap": `${style.editorialOverlapPercent}%`,
    "--look-headline-size": `${style.editorialHeadlineSizePx}px`,
    "--look-description-size": `${style.editorialDescriptionSizePx}px`,
    "--look-cards-visible": style.editorialVisibleCards,
    "--look-card-gap": `${style.editorialCardGapPx}px`,
    "--look-hero-radius": `${style.mainImageRadiusPx}px`,
    "--look-card-radius": `${style.thumbRadiusPx}px`,
    "--look-hero-border": `${style.mainImageBorderPx}px`,
    "--look-hero-border-color": style.mainImageBorderColor,
    "--look-card-zoom": style.thumbHoverScale,
    "--look-button-bg": style.actionButtonBg,
    "--look-button-border": style.actionButtonBorderColor,
    "--look-favorite-color": style.actionFavoriteColor,
    "--look-cart-color": style.actionCartColor,
    "--look-hero-aspect": style.editorialHeroAspect.replace("/", " / "),
    "--look-shadow": `0 ${Math.round(12 + depth * 20)}px ${Math.round(32 + depth * 38)}px rgba(88, 37, 55, ${(.12 + depth * .21).toFixed(2)})`,
    "--look-hero-shadow": style.mainImageShadow ? `0 ${Math.round(12 + depth * 20)}px ${Math.round(32 + depth * 38)}px rgba(88, 37, 55, ${(.12 + depth * .21).toFixed(2)})` : "none",
    "--look-card-shadow": style.thumbShadow ? `0 7px 16px rgba(92,45,53,${(.07 + depth * .1).toFixed(2)})` : "none",
    "--look-padding-top": `${style.sectionPaddingTopPx}px`,
    "--look-padding-bottom": `${style.sectionPaddingBottomPx}px`,
    "--look-padding-x": `${style.sectionPaddingXPx}px`,
  };

  const moveHero = (step) => {
    if (!options.length) return;
    onSelect(options[(currentIndex + step + options.length) % options.length].id);
  };

  return <section className="look-editorial" style={css} aria-label="Looks">
    <div className="look-editorial__scene" style={{ maxWidth: style.editorialContentWidthPx }}>
      <div className="look-editorial__hero">
        {mainImage ? <img src={mainImage} alt={mainImageAlt || "Imagen principal de Looks"} />
          : <div className="look-editorial__empty">{loading ? "Cargando looks…" : "Selecciona una portada o un producto"}</div>}
        <div className="look-editorial__hero-controls">
          <button type="button" aria-label="Look anterior" onClick={() => moveHero(-1)} disabled={options.length < 2}><ChevronLeft size={21} /></button>
          <button type="button" aria-label="Look siguiente" onClick={() => moveHero(1)} disabled={options.length < 2}><ChevronRight size={21} /></button>
        </div>
      </div>

      <div className="look-editorial__intro">
        {config.editorialEyebrow && <span className="look-editorial__eyebrow">{config.editorialEyebrow}</span>}
        {config.editorialHeadline && <h2 style={{ color: style.editorialTextColor, fontFamily: style.titleFontFamily || undefined,
          fontWeight: style.editorialTitleWeight,
          fontStyle: style.titleItalic ? "italic" : undefined }}>{config.editorialHeadline}</h2>}
        {config.description && <p style={{ color: style.editorialTextColor,
          fontFamily: style.descFontFamily || undefined,
          fontWeight: style.descWeight }}>{config.description}</p>}
      </div>

      <div className="look-editorial__rail" aria-label="Productos del look">
        <div ref={railRef} className="look-editorial__cards">
          {hasCover && <article className={`look-editorial__card ${!selectedId ? "is-selected" : ""}`}>
            <button type="button" className="look-editorial__card-image" aria-label="Mostrar imagen principal" onClick={() => onSelect("")}>
              <img src={config.heroImage} alt="Portada de Looks" loading="lazy" />
            </button><span className="look-editorial__card-name">Imagen principal</span>
          </article>}
          {products.map((product) => <article key={product.id} className={`look-editorial__card ${selectedId === product.id ? "is-selected" : ""}`}>
            <button type="button" className="look-editorial__card-image" onClick={() => onSelect(product.id)} aria-label={`Mostrar ${product.subtitle}`}>
              <img src={product.image} alt={product.subtitle} loading="lazy" />
            </button>
            {config.actions?.favorite?.enabled !== false && <button type="button" className="look-editorial__favorite"
              aria-label={`${isFavorite(product) ? "Quitar de" : "Agregar a"} favoritos: ${product.subtitle}`}
              onClick={() => onFavorite(product)}><Heart size={18} fill={isFavorite(product) ? "currentColor" : "none"} /></button>}
            <a href={`/producto/${encodeURIComponent(product.id)}`} className="look-editorial__card-name" style={{ color: style.thumbTitleColor,
              fontFamily: style.thumbTitleFontFamily || undefined, fontSize: style.thumbTitleSizePx }}>
              {product.subtitle}</a>
            <div className="look-editorial__card-foot">
              <span style={{ color: style.thumbPriceColor, fontFamily: style.thumbPriceFontFamily || undefined,
                fontSize: style.thumbPriceSizePx }}>{moneyCOP(product.price)}</span>
              {config.actions?.cart?.enabled !== false && <button type="button" aria-label={`Agregar al carrito: ${product.subtitle}`} onClick={() => onCart(product)}>
                <ShoppingCart size={17} /></button>}
            </div>
          </article>)}
        </div>
        {products.length + Number(hasCover) > 4 && <div className="look-editorial__rail-controls">
          <button type="button" aria-label="Desplazar tarjetas a la izquierda" onClick={() => railRef.current?.scrollBy({ left: -railRef.current.clientWidth * .65, behavior: "smooth" })}><ChevronLeft size={16} /></button>
          <button type="button" aria-label="Desplazar tarjetas a la derecha" onClick={() => railRef.current?.scrollBy({ left: railRef.current.clientWidth * .65, behavior: "smooth" })}><ChevronRight size={16} /></button>
        </div>}
      </div>
    </div>
  </section>;
}
