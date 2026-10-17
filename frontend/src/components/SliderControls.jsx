import React from 'react';
import './sliderControls.css';

export const sliderControlColor = (value) => /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#ffffff';
export const sliderControlTheme = (value) => ['minimal', 'petal', 'orbit', 'editorial'].includes(value) ? value : 'minimal';
export const sliderControlPosition = (value) => ['right', 'left', 'bottom'].includes(value) ? value : 'right';
export const sliderControlSize = (value) => Number.isFinite(Number(value)) ? Math.max(80, Math.min(140, Number(value))) : 100;

export const sliderArrowPath = (theme, previous) => {
  if (theme === 'editorial') return previous ? 'M20 12H4m0 0 7-7m-7 7 7 7' : 'M4 12h16m0 0-7-7m7 7-7 7';
  if (theme === 'petal') return previous ? 'M17 4C14 7 10 10 8 12c2 2 6 5 9 8' : 'M7 4c3 3 7 6 9 8-2 2-6 5-9 8';
  if (theme === 'orbit') return previous ? 'M18 5 11 12l7 7M11 12H5' : 'm6 5 7 7-7 7m7-7h6';
  return previous ? 'm16 5-7 7 7 7' : 'm8 5 7 7-7 7';
};

export default function SliderControls({ count, current, progress = 0, color, theme, position, size, device, showCounter = false, showProgress, onPrevious, onNext }) {
  if (count < 2) return null;
  const selectedColor = sliderControlColor(color);
  const selectedTheme = sliderControlTheme(theme);
  return <nav className="rb-slider-controls" aria-label="Controles del slider" data-theme={selectedTheme} data-position={sliderControlPosition(position)} data-device={device} data-progress={showProgress ? 'true' : undefined} style={{ '--rb-slider-color': selectedColor, '--rb-slider-scale': sliderControlSize(size) / 100, '--rb-slider-progress': `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }}>
    <button type="button" className="rb-slider-controls__arrow rb-slider-controls__arrow--previous" aria-label="Imagen anterior" onClick={onPrevious}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={sliderArrowPath(selectedTheme, true)} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {showCounter && <span className="rb-slider-controls__counter" aria-label={`Imagen ${current + 1} de ${count}`}>
      <span>{String(current + 1).padStart(2, '0')}</span><span className="rb-slider-controls__separator">/</span><span>{String(count).padStart(2, '0')}</span>
    </span>}
    <button type="button" className="rb-slider-controls__arrow rb-slider-controls__arrow--next" aria-label="Imagen siguiente" onClick={onNext}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={sliderArrowPath(selectedTheme, false)} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  </nav>;
}
