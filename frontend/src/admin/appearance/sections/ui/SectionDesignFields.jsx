import React, { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button, Input } from './UiComponents';
import './sectionDesignFields.css';
export function DesignCard({ title, hint, children }) {
  return <section className="section-design-card"><h3>{title}</h3>{hint && <p className="section-design-hint">{hint}</p>}<div className="section-design-fields">{children}</div></section>;
}
export function DesignText({ label, ...props }) { return <label className="section-design-field">{label}<Input {...props} /></label>; }
export function DesignSlider({ label, value, onChange, min = 0, max = 100, step = 1 }) {
  return <div className="section-design-field"><span>{label}</span><div className="section-design-range"><input type="range" aria-label={label} value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} /><input type="number" aria-label={`${label} (valor)`} value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} /></div></div>;
}
export function DesignChoice({ label, value, options, onChange }) {
  return <div className="section-design-field"><span>{label}</span><div className="section-design-choices" role="group" aria-label={label}>{options.map(([id, name]) => <button type="button" aria-pressed={value === id} key={String(id)} onClick={() => onChange(id)}>{name}</button>)}</div></div>;
}
export function SectionImageUpload({ label, value, onChange, uploadToCloudinary, fallback, hint, onBusyChange }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);
  async function upload(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) { setError('Elige una imagen JPG, PNG, WebP o AVIF.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('La imagen debe pesar máximo 10 MB.'); return; }
    if (!uploadToCloudinary) { setError('La carga no está disponible. Recarga la página e inténtalo de nuevo.'); return; }
    const id = ++request.current; setBusy(true); onBusyChange?.(true);
    try {
      const url = await uploadToCloudinary(file);
      if (id !== request.current) return;
      if (typeof url !== 'string' || !url.trim()) throw new Error('empty');
      onChange(url);
    } catch { if (id === request.current) setError('No se pudo cargar la imagen. Intenta nuevamente.'); }
    finally { if (id === request.current) { setBusy(false); onBusyChange?.(false); } }
  }
  return <div className="section-design-upload">
    <strong>{label}</strong>
    {fallback && <div className="section-design-upload__preview">{fallback}</div>}
    {hint && <p className="section-design-hint">{hint}</p>}
    <label className="section-design-upload__button"><Upload size={16} aria-hidden="true" />{busy ? 'Cargando…' : 'Cargar o cambiar imagen'}<input type="file" aria-label={`Cargar ${label.toLowerCase()}`} accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={upload} /></label>
    {value && <Button kind="ghost" disabled={busy} onClick={() => onChange('')}>Quitar imagen</Button>}
    {busy && <p role="status">Espera a que termine la carga antes de guardar.</p>}
    {error && <p role="alert" className="section-design-error">{error}</p>}
  </div>;
}
