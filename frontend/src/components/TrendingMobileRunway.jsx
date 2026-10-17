import { ArrowRight, Heart, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useKeenSlider } from "keen-slider/react";
import { trendingMobileColorsVars } from "./trendingPresentation";
import "keen-slider/keen-slider.min.css";
import "./trendingMobileRunway.css";

const money = (value) => `$${Math.round(Number(value) || 0).toLocaleString("es-CO")}`;
const unique = (values) => [...new Set(values.filter(Boolean).map(String))];
const colorHex = (color) => {
  const value = typeof color === "string" ? color : color?.hex || color?.value || color?.color || "";
  return /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value) ? value : "";
};

export default function TrendingMobileRunway({ products, title, titleImage, presentation, fields,
  favoriteEnabled, isFavorite, onFavorite }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() =>
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches));
  const count = products.length;
  // Enough physical slides keep both side previews filled even with only two products.
  const copies = count > 1 ? Math.ceil(5 / count) : 1;
  const slides = Array.from({ length: copies }, () => products).flat();
  const options = useMemo(() => ({
    loop: count > 1,
    drag: count > 1,
    slides: { origin: "center", perView: 1.6, spacing: 12 },
    defaultAnimation: { duration: reducedMotion ? 0 : 460, easing: (value) => 1 - (1 - value) ** 3 },
    slideChanged(slider) { setSlideIndex(slider.track.details.rel); },
  }), [count, reducedMotion]);
  const [sliderRef, slider] = useKeenSlider(options);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return undefined;
    const update = () => setReducedMotion(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const activeIndex = slideIndex % count;
  const active = products[activeIndex];
  const sizes = unique(Array.isArray(active.sizes) ? active.sizes : []);
  const colors = unique((Array.isArray(active.colors) ? active.colors : []).map(colorHex));
  const visibleSizes = sizes.slice(0, fields.maxSizesToShow);
  const visibleColors = colors.slice(0, 6);
  const heading = !title || title.trim().toLocaleUpperCase("es-CO") === "EN TENDENCIA" ? "En tendencia" : title;
  const showProduct = (index) => {
    const absolute = slider.current?.track.details.abs || 0;
    let distance = index - activeIndex;
    if (distance > count / 2) distance -= count;
    if (distance < -count / 2) distance += count;
    slider.current?.moveToIdx(absolute + distance, true);
  };

  return <div className="trending-runway" style={{ ...trendingMobileColorsVars(presentation), "--runway-heading-font": presentation.titleFontFamily }}>
    <header className="trending-runway__heading">
      {presentation.titleMode === "image"
        ? <img className="trending-runway__title-image" src={titleImage} alt={heading} />
        : <h2>{heading}</h2>}
      {count > 1 && <button className="trending-runway__hint" type="button" aria-label="Producto siguiente"
        onClick={() => slider.current?.next()}><span>Desliza</span><ArrowRight size={17} aria-hidden="true" /></button>}
    </header>

    <div className="trending-runway__gallery" role="region" aria-roledescription="carrusel" aria-label="Productos en tendencia"
      tabIndex={count > 1 ? 0 : undefined} onKeyDown={(event) => {
        if (count < 2) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          if (event.key === "ArrowLeft") slider.current?.prev();
          else slider.current?.next();
        }
      }}>
      <div ref={sliderRef} className="keen-slider trending-runway__track">
        {slides.map((product, index) => {
          const selected = index === slideIndex;
          const favorite = selected && isFavorite(product);
          return <article key={`${product.id}-${index}`}
            className={`keen-slider__slide trending-runway__slide ${selected ? "is-active" : ""}`}
            aria-hidden={!selected}>
            <div className="trending-runway__photo">
              <button type="button" className="trending-runway__select" tabIndex={selected ? 0 : -1}
                aria-label={`Mostrar ${product.name}`} onClick={() => slider.current?.moveToIdx(index)}>
                <img src={product.image1} alt={selected ? product.name : ""} draggable={false}
                  loading={index < 2 || index === slides.length - 1 ? "eager" : "lazy"} />
              </button>
              {selected && favoriteEnabled && <button type="button" className="trending-runway__favorite" data-keen-slider-clickable="true"
                aria-label={`${favorite ? "Quitar de" : "Agregar a"} favoritos: ${product.name}`}
                aria-pressed={favorite} onClick={() => onFavorite(product)}>
                <Heart size={21} strokeWidth={1.6} fill={favorite ? "currentColor" : "none"} aria-hidden="true" />
              </button>}
              {selected && product.hasDiscount && <span className="trending-runway__discount">−{product.discountPercent}%</span>}
            </div>
          </article>;
        })}
      </div>
    </div>

    {count > 1 && <nav className="trending-runway__pagination" aria-label="Elegir producto en tendencia">
      {products.map((product, index) => <button key={product.id} type="button"
        aria-label={`Ver producto ${index + 1}: ${product.name}`} aria-current={activeIndex === index ? "true" : undefined}
        onClick={() => showProduct(index)}><span /></button>)}
    </nav>}

    <div className="trending-runway__details" aria-live="polite" aria-atomic="true">
      <h3 className="trending-runway__name">{active.name}</h3>
      <div className="trending-runway__pricing">
        <span className="trending-runway__price">{money(active.hasDiscount ? active.finalPrice : active.price)}</span>
        {active.hasDiscount && <del>{money(active.price)}</del>}
      </div>
      {((fields.showSizes && sizes.length > 0) || (fields.showColors && colors.length > 0)) &&
        <div className="trending-runway__metadata">
          {fields.showSizes && sizes.length > 0 && <div className="trending-runway__meta-group">
            <span className="trending-runway__meta-label">{sizes.length === 1 ? "Talla" : "Tallas"}</span>
            {visibleSizes.map((size) => <span className="trending-runway__size" key={size}>{size}</span>)}
            {sizes.length > visibleSizes.length && <span className="trending-runway__more">+{sizes.length - visibleSizes.length}</span>}
          </div>}
          {fields.showColors && colors.length > 0 && <div className="trending-runway__meta-group">
            <span className="trending-runway__meta-label">Colores</span>
            {visibleColors.map((color) => <span key={color} className="trending-runway__color"
              style={{ backgroundColor: color }} title={color} />)}
            {colors.length > visibleColors.length && <span className="trending-runway__more">+{colors.length - visibleColors.length}</span>}
          </div>}
        </div>}
      {presentation.showDescription && fields.showFeatures && active.features?.length > 0 &&
        <p className="trending-runway__description">{active.features.slice(0, 2).join(" · ")}</p>}
      {presentation.showDescription && fields.showDescription && !active.features?.length && active.description &&
        <p className="trending-runway__description">{active.description}</p>}
      <Link className="trending-runway__product-link" to={`/producto/${encodeURIComponent(active.id)}`}>
        <ShoppingBag size={21} strokeWidth={1.5} aria-hidden="true" /><span>Ver producto</span>
      </Link>
    </div>
  </div>;
}
