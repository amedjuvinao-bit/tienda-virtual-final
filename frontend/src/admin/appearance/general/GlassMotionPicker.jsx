import React from 'react';
import { CHROME_GLASS_MOTIONS, resolveChromeGlassMotion } from '../../../lib/chromeGlassMotion';
import { moveChromeGlassLight } from '../../../lib/chromeGlassMotion';
import '../../../components/storefrontChromeGlassHover.css';
import './glassMotionPicker.css';

export default function GlassMotionPicker({ label, value, inherited = 'prism', onChange }) {
  const selected = value || 'inherit';
  return <div className="appearance-glass-motion">
    <div className="appearance-glass-motion__intro"><strong>{label}</strong><small>Prueba cada muestra con el puntero. En la tienda, las flechas solo se mueven al hacer clic.</small></div>
    <div className="appearance-glass-motion__grid" role="group" aria-label={label}>
      {[{ id: 'inherit', name: 'Como en portada', description: 'Usa el estilo seleccionado para los botones del banner.' }, ...CHROME_GLASS_MOTIONS].map((item) =>
        <button type="button" key={item.id} className="appearance-glass-motion__choice storefront-liquid-icon"
          aria-pressed={selected === item.id} data-button-animation={item.id === 'inherit' ? resolveChromeGlassMotion(inherited) : item.id}
          onPointerMove={moveChromeGlassLight} onClick={() => onChange(item.id === 'inherit' ? '' : item.id)}>
          <span className="rb-chrome-hover__surface" aria-hidden="true" />
          <span className="appearance-glass-motion__gem" aria-hidden="true">✦</span>
          <strong>{item.name}</strong><small>{item.description}</small>
        </button>)}
    </div>
  </div>;
}
