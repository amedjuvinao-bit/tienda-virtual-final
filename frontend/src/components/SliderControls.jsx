import React from 'react';
import './sliderControls.css';

export const sliderControlColor = (value) => /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#ffffff';
export const sliderControlTheme = (value) => ['minimal', 'petal', 'orbit', 'editorial'].includes(value) ? value : 'minimal';
export const sliderControlPosition = (value) => ['right', 'left', 'bottom'].includes(value) ? value : 'right';
export const sliderControlSize = (value) => Number.isFinite(Number(value)) ? Math.max(80, Math.min(140, Number(value))) : 100;

export const sliderArrowPath = (theme, previous) => {
  if (theme === 'editorial') return previous ? 'M21 12H3m0 0 8-8m-8 8 8 8' : 'M3 12h18m0 0-8-8m8 8-8 8';
  if (theme === 'petal') return previous ? 'M18 3C7 7 7 17 18 21' : 'M6 3c11 4 11 14 0 18';
  if (theme === 'orbit') return previous ? 'M19 3C8 5 6 16 17 21M17 21l-5-1' : 'M5 3c11 2 13 13 2 18M7 21l5-1';
  return previous ? 'm17 4-8 8 8 8' : 'm7 4 8 8-8 8';
};

export default function SliderControls({ count, current, progress = 0, color, theme, position, size, device, showProgress, onPrevious, onNext, onChoose }) {
  if (count < 2) return null;
  const selectedColor = sliderControlColor(color);
  const selectedTheme = sliderControlTheme(theme);
  return <nav className="rb-slider-controls" aria-label="Controles del slider" data-theme={selectedTheme} data-position={sliderControlPosition(position)} data-device={device} data-progress={showProgress ? 'true' : undefined} style={{ '--rb-slider-color': selectedColor, '--rb-slider-scale': sliderControlSize(size) / 100, '--rb-slider-progress': `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }}>
    <button type="button" className="rb-slider-controls__arrow rb-slider-controls__arrow--previous" aria-label="Imagen anterior" onClick={onPrevious}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={sliderArrowPath(selectedTheme, true)} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <div className="rb-slider-controls__pages" aria-label={`Imagen ${current + 1} de ${count}`}>
      {Array.from({ length: count }, (_, index) => <button key={index} type="button" className="rb-slider-controls__page" aria-label={`Ir a la imagen ${index + 1}`} aria-current={index === current ? 'true' : undefined} onClick={() => onChoose(index)}>
        <span className="rb-slider-controls__dot" style={index === current && showProgress && selectedTheme === 'orbit' ? { backgroundImage: `conic-gradient(${selectedColor} ${Math.round(Math.max(0, Math.min(1, progress)) * 360)}deg, transparent 0deg)` } : undefined}>{selectedTheme === 'editorial' ? String(index + 1).padStart(2, '0') : null}</span>
      </button>)}
    </div>
    <button type="button" className="rb-slider-controls__arrow rb-slider-controls__arrow--next" aria-label="Imagen siguiente" onClick={onNext}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={sliderArrowPath(selectedTheme, false)} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  </nav>;
}
