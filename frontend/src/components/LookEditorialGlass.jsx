import { ChevronLeft, ChevronRight, Heart, ShoppingCart } from "lucide-react";
import { useEffect, useRef } from "react";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import "./lookEditorialGlass.css";

function moneyCOP(value) {
  return `$${Math.round(Number(value) || 0).toLocaleString("es-CO")}`;
}

export default function LookEditorialGlass({ config, style, products, mainImage, mainImageAlt, selectedId, onSelect,
  onCart, onFavorite, isFavorite, loading }) {
  const pausedRef = useRef(false);
  const hasCover = config.heroMode === "custom" && Boolean(config.heroImage);
  const options = [hasCover ? { id: "", image: config.heroImage } : null, ...products].filter(Boolean);
  const cardCount = products.length + Number(hasCover);
  const canSlide = cardCount > 1;
  const visibleCards = Math.min(style.editorialVisibleCards, canSlide ? cardCount - .5 : 1);
  const [railRef, railInstanceRef] = useKeenSlider({
    loop: canSlide,
    drag: canSlide,
    slides: { perView: visibleCards || 1, spacing: style.editorialCardGapPx },
    breakpoints: {
      "(max-width: 699px)": { slides: { perView: Math.min(visibleCards, 2.15), spacing: style.editorialCardGapPx } },
    },
  });

  useEffect(() => {
    if (!canSlide) return undefined;
    const interval = window.setInterval(() => {
      if (pausedRef.current || document.hidden || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      railInstanceRef.current?.next();
    }, 3600);
    return () => window.clearInterval(interval);
  }, [canSlide, railInstanceRef]);

  useEffect(() => { railInstanceRef.current?.update?.(); }, [cardCount, style.editorialVisibleCards, style.editorialCardGapPx, railInstanceRef]);
  const currentIndex = Math.max(0, options.findIndex((option) => option.id === selectedId));
  const depth = style.editorialDepth / 100;
  const css = {
    "--look-backdrop": `url("${config.editorialBackgroundImage || "/looks-editorial-background.webp"}")`,
    "--look-background": style.editorialBackgroundColor,
    "--look-glass": style.editorialGlassColor,
    "--look-glass-fill": `${style.editorialGlassOpacity * .48}%`,
    "--look-blur": `${style.editorialGlassBlurPx}px`,
    "--look-accent": style.editorialAccentColor,
    "--look-text": style.editorialTextColor,
    "--look-overlap": `${style.editorialOverlapPercent}%`,
    "--look-headline-size": `${style.editorialHeadlineSizePx}px`,
    "--look-description-size": `${style.editorialDescriptionSizePx}px`,
    "--look-cards-visible": style.editorialVisibleCards,
    "--look-hero-radius": `${style.mainImageRadiusPx}px`,
    "--look-card-radius": `${style.thumbRadiusPx}px`,
    "--look-card-zoom": style.thumbHoverScale,
    "--look-button-bg": style.actionButtonBg,
    "--look-button-border": style.actionButtonBorderColor,
    "--look-favorite-color": style.actionFavoriteColor,
    "--look-cart-color": style.actionCartColor,
    "--look-hero-aspect": style.editorialHeroAspect.replace("/", " / "),
    "--look-shadow": `0 ${Math.round(16 + depth * 26)}px ${Math.round(28 + depth * 46)}px rgba(72, 29, 46, ${(.17 + depth * .22).toFixed(2)}), 0 ${Math.round(7 + depth * 10)}px ${Math.round(10 + depth * 15)}px rgba(94, 45, 44, ${(.11 + depth * .17).toFixed(2)})`,
    "--look-hero-shadow": style.mainImageShadow ? `0 ${Math.round(16 + depth * 26)}px ${Math.round(28 + depth * 46)}px rgba(72, 29, 46, ${(.17 + depth * .22).toFixed(2)}), 0 9px 16px rgba(94,45,44,.16)` : "none",
    "--look-card-shadow": style.thumbShadow ? `0 ${Math.round(5 + depth * 7)}px ${Math.round(9 + depth * 15)}px rgba(83,37,45,${(.12 + depth * .17).toFixed(2)}), inset 0 1px rgba(255,255,255,.85)` : "none",
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
        {mainImage ? <>
          <img className="look-editorial__hero-backdrop" src={mainImage} alt="" aria-hidden="true" />
          <img className="look-editorial__hero-photo" src={mainImage} alt={mainImageAlt || "Imagen principal de Looks"} />
        </>
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

      <div className="look-editorial__rail" role="region" aria-roledescription="carrusel" aria-label="Productos del look" onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }} onFocusCapture={() => { pausedRef.current = true; }}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) pausedRef.current = false; }}>
        <div ref={railRef} className="look-editorial__cards keen-slider">
          {hasCover && <article className={`look-editorial__card keen-slider__slide ${!selectedId ? "is-selected" : ""}`}>
            <button type="button" className="look-editorial__card-image" aria-label="Mostrar imagen principal" onClick={() => onSelect("")}>
              <img src={config.heroImage} alt="Portada de Looks" loading="lazy" />
            </button><span className="look-editorial__card-name">Imagen principal</span>
          </article>}
          {products.map((product) => <article key={product.id} className={`look-editorial__card keen-slider__slide ${selectedId === product.id ? "is-selected" : ""}`}>
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
        {canSlide && <div className="look-editorial__rail-controls">
          <button type="button" aria-label="Tarjeta anterior" onClick={() => railInstanceRef.current?.prev()}><ChevronLeft size={17} /></button>
          <button type="button" aria-label="Tarjeta siguiente" onClick={() => railInstanceRef.current?.next()}><ChevronRight size={17} /></button>
        </div>}
      </div>
    </div>
  </section>;
}
