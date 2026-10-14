import React from 'react';
import './sliderControls.css';

export const sliderControlColor = (value) => /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#ffffff';

export default function SliderControls({ count, current, progress, color, showProgress, onPrevious, onNext, onChoose }) {
  if (count < 2) return null;
  const selectedColor = sliderControlColor(color);
  return <nav className="rb-slider-controls" aria-label="Controles del slider" style={{ '--rb-slider-color': selectedColor }}>
    <button type="button" className="rb-slider-controls__arrow" aria-label="Imagen anterior" onClick={onPrevious}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14.5 5.5-6.5 6.5 6.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <div className="rb-slider-controls__pages" aria-label={`Imagen ${current + 1} de ${count}`}>
      {Array.from({ length: count }, (_, index) => <button key={index} type="button" className="rb-slider-controls__page" aria-label={`Ir a la imagen ${index + 1}`} aria-current={index === current ? 'true' : undefined} onClick={() => onChoose(index)}>
        <span className="rb-slider-controls__dot" style={index === current && showProgress ? { backgroundImage: `conic-gradient(${selectedColor} ${Math.round(Math.max(0, Math.min(1, progress)) * 360)}deg, transparent 0deg)` } : undefined} />
      </button>)}
    </div>
    <button type="button" className="rb-slider-controls__arrow" aria-label="Imagen siguiente" onClick={onNext}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9.5 5.5 6.5 6.5-6.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  </nav>;
}
