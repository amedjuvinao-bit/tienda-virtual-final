import GraciasImg from '../../assets/IMGPAGGRACIAS.jpg';

export default function GraciasVisualPanel({
  config, slides, currentSlide, setCurrentSlide, shadowClass,
}) {
  if (!config.showVisualPanel) return null;
  const style = config.style;
  const slide = slides[currentSlide] || slides[0];

  return <div className="gp-visual flex justify-center">
    <div className={`gp-visual-wrap ${shadowClass}`} style={{
      borderRadius: `${style.visualRadiusPx}px`,
      border: `4px solid ${style.visualBorderColor}`,
      maxWidth: `min(100%, ${style.visualWidthPx}px)`,
    }}>
      <div className="gp-visual-inner" style={{ '--gp-visual-h': `${style.visualHeightPx}px` }}>
        <img key={slide?.image} src={slide?.image || GraciasImg} alt={slide?.alt || 'Gracias por su compra'} className="gp-slide-img" />
        {slide?.badge && <div className="gp-badge" style={{ backgroundColor: style.badgeBg, color: style.badgeTextColor }}>{slide.badge}</div>}
        {slide?.caption && <div className="gp-caption" style={{ backgroundColor: style.captionBg, color: style.captionTextColor }}>{slide.caption}</div>}
        {slides.length > 1 && <div className="gp-dots">
          {slides.map((item, index) => <button
            key={item.id || index}
            type="button"
            onClick={() => setCurrentSlide(index)}
            className={`gp-dot ${index === currentSlide ? 'active' : ''}`}
            style={{ backgroundColor: index === currentSlide ? style.accentColor : '#ffffffcc' }}
            aria-label={`Slide ${index + 1}`}
          />)}
        </div>}
      </div>
    </div>
  </div>;
}
