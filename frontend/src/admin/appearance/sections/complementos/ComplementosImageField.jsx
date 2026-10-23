import React, { useEffect, useRef, useState } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { Button, Input } from '../ui/UiComponents';

export default function ComplementosImageField({ label, value, fallback, onChange, uploadToCloudinary, mobile = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
      setError('Elige una imagen JPG, PNG, WebP o AVIF.'); return;
    }
    if (file.size > 10 * 1024 * 1024) { setError('La imagen debe pesar máximo 10 MB.'); return; }
    if (!uploadToCloudinary) { setError('La carga no está disponible. Puedes pegar la dirección de la imagen.'); return; }
    const id = ++request.current;
    setBusy(true);
    try {
      const url = await uploadToCloudinary(file);
      if (id !== request.current) return;
      if (typeof url !== 'string' || !url.trim()) throw new Error('empty');
      onChange(url);
    } catch {
      if (id === request.current) setError('No se pudo cargar la imagen. Intenta nuevamente.');
    } finally { if (id === request.current) setBusy(false); }
  }
  return <section className="comp-editor__image-card" aria-label={label}>
    <h4><ImageIcon size={18} aria-hidden="true" />{label}</h4>
    <div className={`comp-editor__thumbnail ${mobile ? 'comp-editor__thumbnail--mobile' : ''}`}>
      {(value || fallback) && <img src={value || fallback} alt={`Miniatura: ${label}`} />}
    </div>
    <p>{mobile ? 'Vertical: 1000 × 1500 px. Si la quitas, se usará la imagen de escritorio.' : 'Horizontal: 1800 × 600 px. Usa una fotografía sin textos ni botones para poder editarlos aquí.'}</p>
    <label className="comp-editor__upload"><Upload size={16} aria-hidden="true" />{busy ? 'Cargando imagen…' : value ? 'Cambiar imagen' : 'Cargar imagen'}
      <input type="file" aria-label={`Cargar ${label.toLowerCase()}`} accept="image/jpeg,image/png,image/webp,image/avif" onChange={upload} disabled={busy} />
    </label>
    <label className="comp-editor__field">Dirección de {label.toLowerCase()}<Input value={value} disabled={busy} placeholder="https://…" onChange={(e) => { setError(''); onChange(e.target.value); }} /></label>
    {mobile && value && <Button kind="ghost" disabled={busy} onClick={() => onChange('')}>Usar imagen de escritorio</Button>}
    {busy && <p role="status">Espera a que termine la carga antes de guardar.</p>}
    {error && <p role="alert" className="comp-editor__error">{error}</p>}
  </section>;
}
