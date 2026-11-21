import { useState } from "react";
import { ArrowLeft, ArrowRight, PackageCheck, Pause, Play } from "lucide-react";
import PolishedGlassRim from "../../components/PolishedGlassRim";
import { CartGlass } from "../../components/cart/CartMaterial";
export default function GraciasVisualPanel({
  config,
  slides,
  currentSlide,
  setCurrentSlide,
  paused,
  setPaused,
  material,
}) {
  const [failed, setFailed] = useState({});
  const style = config.style,
    slide = slides[currentSlide] || slides[0];
  const image = slide?.image && !failed[slide.image] ? slide.image : "";
  const change = (offset) =>
    setCurrentSlide((currentSlide + offset + slides.length) % slides.length);
  return (
    <CartGlass
      config={{
        ...material,
        style: { ...material.style, cardRadiusPx: style.visualRadiusPx },
      }}
      className="gp-visual"
      style={{
        "--cart-light": style.visualBorderColor,
        "--cart-radius": `${style.visualRadiusPx}px`,
        "--gp-visual-height": `${style.visualHeightPx}px`,
        maxWidth: style.visualWidthPx,
      }}
      aria-label="Galería de agradecimiento"
    >
      <div className="gp-visual-inner">
        {image ? (
          <img
            key={image}
            src={image}
            alt={slide.alt || "Imagen de agradecimiento"}
            className="gp-slide-img"
            data-animation={config.slider.animation}
            onError={() =>
              setFailed((current) => ({ ...current, [image]: true }))
            }
          />
        ) : (
          <div className="gp-visual-emblem" aria-hidden="true">
            <PackageCheck size={108} strokeWidth={0.7} />
            <span>✓</span>
          </div>
        )}
        {slide?.badge && (
          <div
            className="gp-badge"
            style={{
              backgroundColor: `color-mix(in srgb, ${style.badgeBg} ${config.presentation.glassOpacity * 100}%, transparent)`,
              color: style.badgeTextColor,
            }}
          >
            {slide.badge}
            <PolishedGlassRim
              radius={999}
              width={config.presentation.borderWidth}
              reflection={config.presentation.reflection}
            />
          </div>
        )}
        {slide?.caption && (
          <div
            className="gp-caption"
            style={{
              backgroundColor: `color-mix(in srgb, ${style.captionBg} ${config.presentation.glassOpacity * 100}%, transparent)`,
              color: style.captionTextColor,
            }}
          >
            {slide.caption}
            <PolishedGlassRim
              radius={14}
              width={config.presentation.borderWidth}
              reflection={config.presentation.reflection}
            />
          </div>
        )}
        {slides.length > 1 && (
          <div className="gp-slider-controls">
            <button
              type="button"
              onClick={() => change(-1)}
              aria-label="Imagen anterior"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="gp-dots">
              {slides.map((item, index) => (
                <button
                  key={`${item.id}-${index}`}
                  type="button"
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`Ver imagen ${index + 1}`}
                  aria-pressed={index === currentSlide}
                  className="gp-dot"
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => change(1)}
              aria-label="Imagen siguiente"
            >
              <ArrowRight size={16} />
            </button>
            {config.slider.autoplay && (
              <button
                type="button"
                onClick={() => setPaused(!paused)}
                aria-label={paused ? "Reanudar galería" : "Pausar galería"}
              >
                {paused ? <Play size={16} /> : <Pause size={16} />}
              </button>
            )}
          </div>
        )}
      </div>
    </CartGlass>
  );
}
