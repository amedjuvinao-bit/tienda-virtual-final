import { ChevronLeft, ChevronRight, Heart, ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import LookGlassRim from "./LookGlassRim";
import "./lookEditorialGlass.css";

function moneyCOP(value) {
  return `$${Math.round(Number(value) || 0).toLocaleString("es-CO")}`;
}

function displayProductName(value) {
  const name = String(value || "").trim();
  if (!name || name !== name.toLocaleUpperCase("es-CO")) return name;
  return name.toLocaleLowerCase("es-CO").replace(/(^|[\s/-])(\p{L})/gu,
    (_, separator, letter) => separator + letter.toLocaleUpperCase("es-CO"));
}

export default function LookEditorialGlass({ config, style, products, mainImage, mainImageAlt, selectedId, onSelect,
  onCart, onFavorite, isFavorite, loading }) {
  const pausedRef = useRef(false);
  const [loadedHero, setLoadedHero] = useState({ src: "", ratio: "" });
  const hasCover = config.heroMode === "custom" && Boolean(config.heroImage);
  const options = [hasCover ? { id: "", image: config.heroImage } : null, ...products].filter(Boolean);
  const cardCount = products.length + Number(hasCover);
  const canSlide = cardCount > 1;
  const visibleCards = Math.min(style.editorialVisibleCards === 2 ? 2 : 3, cardCount || 1);
  const [railRef, railInstanceRef] = useKeenSlider({
    loop: canSlide,
    drag: canSlide,
    slides: { perView: visibleCards || 1, spacing: 0 },
    breakpoints: {
      "(max-width: 699px)": { slides: { perView: Math.min(visibleCards, 1.55), spacing: 0 } },
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

  useEffect(() => { railInstanceRef.current?.update?.(); }, [cardCount, style.editorialVisibleCards, railInstanceRef]);
  const currentIndex = Math.max(0, options.findIndex((option) => option.id === selectedId));
  const depth = style.editorialDepth / 100;
  const position = style.editorialRailPositionPercent;
  const railLeft = (52 - style.editorialOverlapPercent * 2) * Math.min(position, 100) / 100
    + 12 * Math.max(0, position - 100) / 50;
  const css = {
    "--look-backdrop": `url("${config.editorialBackgroundImage || "/looks-editorial-background.webp"}")`,
    "--look-background": style.editorialBackgroundColor,
    "--look-glass": style.editorialGlassColor,
    "--look-glass-fill": `${style.editorialGlassOpacity * .2}%`,
    "--look-blur": `${Math.round(style.editorialGlassBlurPx * .2)}px`,
    "--look-accent": style.editorialAccentColor,
    "--look-text": style.editorialTextColor,
    "--look-overlap": `${style.editorialOverlapPercent}%`,
    "--look-rail-width": `${55 + style.editorialOverlapPercent}%`,
    "--look-rail-left": `${railLeft}%`,
    "--look-headline-size": `${style.editorialHeadlineSizePx}px`,
    "--look-description-size": `${style.editorialDescriptionSizePx}px`,
    "--look-cards-visible": style.editorialVisibleCards,
    "--look-hero-radius": `${style.mainImageRadiusPx}px`,
    "--look-rail-radius": `${style.thumbRadiusPx + 11}px`,
    "--look-card-zoom": style.thumbHoverScale,
    "--look-product-scale": Math.max(.82, 1 - (style.editorialCardGapPx - 12) / 120),
    "--look-button-bg": style.actionButtonBg,
    "--look-button-border": style.actionButtonBorderColor,
    "--look-favorite-color": style.actionFavoriteColor,
    "--look-cart-color": style.actionCartColor,
    "--look-hero-aspect": style.editorialHeroFit !== "crop" && loadedHero.src === mainImage
      ? loadedHero.ratio : style.editorialHeroAspect.replace("/", " / "),
    "--look-shadow": style.thumbShadow ? `0 ${Math.round(16 + depth * 26)}px ${Math.round(28 + depth * 46)}px rgba(72, 29, 46, ${(.17 + depth * .22).toFixed(2)}), 0 ${Math.round(7 + depth * 10)}px ${Math.round(10 + depth * 15)}px rgba(94, 45, 44, ${(.11 + depth * .17).toFixed(2)})` : "none",
    "--look-hero-shadow": style.mainImageShadow ? `0 ${Math.round(16 + depth * 26)}px ${Math.round(28 + depth * 46)}px rgba(72, 29, 46, ${(.17 + depth * .22).toFixed(2)}), 0 9px 16px rgba(94,45,44,.16)` : "none",
    "--look-padding-top": `${style.sectionPaddingTopPx}px`,
    "--look-padding-bottom": `${style.sectionPaddingBottomPx}px`,
    "--look-padding-x": `${style.sectionPaddingXPx}px`,
  };

  const moveHero = (step) => {
    if (!options.length) return;
    onSelect(options[(currentIndex + step + options.length) % options.length].id);
  };

  const cardNameStyle = {
    color: style.thumbTitleColor,
    fontFamily: style.thumbTitleFontFamily || '"Cormorant Garamond", Georgia, serif',
    fontSize: style.thumbTitleSizePx,
    fontWeight: style.thumbTitleWeight,
    fontStyle: style.thumbTitleItalic ? "italic" : undefined,
    textDecoration: style.thumbTitleUnderline ? "underline" : undefined,
  };
  const cardPriceStyle = {
    color: style.thumbPriceColor,
    fontFamily: style.thumbPriceFontFamily || '"Manrope", system-ui, sans-serif',
    fontSize: style.thumbPriceSizePx,
    fontWeight: style.thumbPriceWeight,
    fontStyle: style.thumbPriceItalic ? "italic" : undefined,
    textDecoration: style.thumbPriceUnderline ? "underline" : undefined,
  };

  const selectCard = (event, id) => {
    onSelect(id);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    // Keen moves the slide itself. Animate its inner surface so the click never fights that movement.
    event.currentTarget.closest(".look-editorial__card-surface")?.animate?.([
      { transform: "perspective(850px) translateY(-3px) scale(1)" },
      { transform: "perspective(850px) translateY(1px) scale(.97)", offset: .18 },
      { transform: "perspective(850px) translateY(-12px) scale(1.045)", offset: .56 },
      { transform: "perspective(850px) translateY(-7px) scale(1.015)" },
    ], { duration: 520, easing: "cubic-bezier(.22, 1, .36, 1)" });
  };

  return <section className="look-editorial" style={css} aria-label="Looks">
    <div className="look-editorial__scene" style={{ maxWidth: style.editorialContentWidthPx }}>
      <div className={`look-editorial__hero ${style.editorialHeroFit === "crop" ? "look-editorial__hero--crop" : ""}`}>
        {mainImage ? <img className="look-editorial__hero-photo" src={mainImage} alt={mainImageAlt || "Imagen principal de Looks"}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth && naturalHeight) setLoadedHero({ src: mainImage, ratio: `${naturalWidth} / ${naturalHeight}` });
          }} />
          : <div className="look-editorial__empty">{loading ? "Cargando looks…" : "Selecciona una portada o un producto"}</div>}
        <div className="look-editorial__hero-controls">
          <button type="button" aria-label="Look anterior" onClick={() => moveHero(-1)} disabled={options.length < 2}><ChevronLeft size={21} /></button>
          <button type="button" aria-label="Look siguiente" onClick={() => moveHero(1)} disabled={options.length < 2}><ChevronRight size={21} /></button>
        </div>
        <LookGlassRim radius={style.mainImageRadiusPx} />
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
          {hasCover && <article className={`look-editorial__card look-editorial__card--cover keen-slider__slide ${!selectedId ? "is-selected" : ""}`}>
            <div className="look-editorial__card-surface">
              <button type="button" className="look-editorial__card-image" aria-label="Mostrar imagen principal" onClick={(event) => selectCard(event, "")}>
                <img src={config.heroImage} alt="Portada de Looks" loading="lazy" />
                <span className="look-editorial__cover-badge" aria-hidden="true">Portada</span>
              </button>
              <div className="look-editorial__card-details">
                <span className="look-editorial__card-name" style={cardNameStyle}>Imagen principal</span>
              </div>
            </div>
          </article>}
          {products.map((product) => <article key={product.id} className={`look-editorial__card keen-slider__slide ${selectedId === product.id ? "is-selected" : ""}`}>
            <div className="look-editorial__card-surface">
              <button type="button" className="look-editorial__card-image" onClick={(event) => selectCard(event, product.id)} aria-label={`Mostrar ${product.subtitle}`}>
                <img src={product.image} alt={product.subtitle} loading="lazy" />
              </button>
              {config.actions?.favorite?.enabled !== false && <button type="button" className="look-editorial__favorite"
                aria-label={`${isFavorite(product) ? "Quitar de" : "Agregar a"} favoritos: ${product.subtitle}`}
                onClick={() => onFavorite(product)}><Heart size={18} strokeWidth={1.5} fill={isFavorite(product) ? "currentColor" : "none"} /></button>}
              <div className="look-editorial__card-details">
                <a href={`/producto/${encodeURIComponent(product.id)}`} className="look-editorial__card-name" style={cardNameStyle}>
                  {displayProductName(product.subtitle)}</a>
                <div className="look-editorial__card-foot">
                  <span style={cardPriceStyle}>{moneyCOP(product.price)}</span>
                  {config.actions?.cart?.enabled !== false && <button type="button" aria-label={`Agregar al carrito: ${product.subtitle}`} onClick={() => onCart(product)}>
                    <ShoppingBag size={17} strokeWidth={1.5} /></button>}
                </div>
              </div>
            </div>
          </article>)}
        </div>
        {canSlide && <div className="look-editorial__rail-controls">
          <button type="button" aria-label="Tarjeta anterior" onClick={() => railInstanceRef.current?.prev()}><ChevronLeft size={17} /></button>
          <button type="button" aria-label="Tarjeta siguiente" onClick={() => railInstanceRef.current?.next()}><ChevronRight size={17} /></button>
        </div>}
        <LookGlassRim variant="rail" radius={style.thumbRadiusPx + 11} />
      </div>
    </div>
  </section>;
}
