import React from 'react';
import './sliderControls.css';

export const sliderControlColor = (value) => /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#ffffff';
export const sliderControlTheme = (value) => ['minimal', 'petal', 'orbit', 'editorial'].includes(value) ? value : 'minimal';
export const sliderControlPosition = (value) => ['right', 'left', 'bottom'].includes(value) ? value : 'right';
export const sliderControlSize = (value) => Number.isFinite(Number(value)) ? Math.max(80, Math.min(140, Number(value))) : 100;

export default function SliderControls({ count, current, progress = 0, color, theme, position, size, device, showProgress, onPrevious, onNext, onChoose }) {
  if (count < 2) return null;
  const selectedColor = sliderControlColor(color);
  const selectedTheme = sliderControlTheme(theme);
  return <nav className="rb-slider-controls" aria-label="Controles del slider" data-theme={selectedTheme} data-position={sliderControlPosition(position)} data-device={device} data-progress={showProgress ? 'true' : undefined} style={{ '--rb-slider-color': selectedColor, '--rb-slider-scale': sliderControlSize(size) / 100, '--rb-slider-progress': `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }}>
    <button type="button" className="rb-slider-controls__arrow" aria-label="Imagen anterior" onClick={onPrevious}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={selectedTheme === 'editorial' ? 'M20 12H4m0 0 7-7m-7 7 7 7' : 'm14.5 5.5-6.5 6.5 6.5 6.5'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <div className="rb-slider-controls__pages" aria-label={`Imagen ${current + 1} de ${count}`}>
      {Array.from({ length: count }, (_, index) => <button key={index} type="button" className="rb-slider-controls__page" aria-label={`Ir a la imagen ${index + 1}`} aria-current={index === current ? 'true' : undefined} onClick={() => onChoose(index)}>
        <span className="rb-slider-controls__dot" style={index === current && showProgress && selectedTheme === 'orbit' ? { backgroundImage: `conic-gradient(${selectedColor} ${Math.round(Math.max(0, Math.min(1, progress)) * 360)}deg, transparent 0deg)` } : undefined}>{selectedTheme === 'editorial' ? String(index + 1).padStart(2, '0') : null}</span>
      </button>)}
    </div>
    <button type="button" className="rb-slider-controls__arrow" aria-label="Imagen siguiente" onClick={onNext}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={selectedTheme === 'editorial' ? 'M4 12h16m0 0-7-7m7 7-7 7' : 'm9.5 5.5 6.5 6.5-6.5 6.5'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  </nav>;
}
