import React, { useState } from 'react';
import { getBannerTemplate } from '../../../lib/bannerTemplates';

const Field = ({ label, ...props }) => <label className="banner-template-field"><span>{label}</span><input {...props} /></label>;

const COPY_PARTS = [
  { key: 'eyebrow', name: 'Texto superior', link: 'eyebrowLink' },
  { key: 'title', name: 'Título principal', link: 'titleLink' },
  { key: 'description', name: 'Descripción', link: 'descriptionLink' },
  { key: 'footerText', name: 'Texto de categorías', link: 'footerTextLink' },
];

export default function BannerTemplatePanel({ theme, setPath, uploading, setUploading, uploadToCloudinaryViaBackend, selection, onSelectionChange }) {
  const banner = theme?.banner || {};
  const { id, config, categories } = getBannerTemplate(banner, theme?.sections);
  const [localSelection, setLocalSelection] = useState('copy:title');
  const [error, setError] = useState('');
  const selected = selection || localSelection;
  const choose = onSelectionChange || setLocalSelection;
  const group = selected.startsWith('action:') ? 'actions' : selected.startsWith('card:') ? 'categories' : selected === 'style' ? 'style' : 'copy';
  const current = banner.templateConfigs?.[id] || {};
  const update = (patch) => setPath(`banner.templateConfigs.${id}`, { ...current, ...patch });
  const updateAction = (key, patch) => update({ [key]: { ...config[key], ...patch } });
  const maxCards = id === 'atelier' ? 2 : 3;
  const refs = Array.isArray(current.cards) && current.cards.length
    ? current.cards
    : categories.slice(0, maxCards).map((category, index) => ({ categoryId: category.id, enabled: true, x: id === 'atelier' ? 45 + index * 29 : 68 + index * 13, y: id === 'atelier' ? 28 + index * 24 : 42 + index * 26 }));
  const updateCard = (index, patch) => update({ cards: refs.map((card, i) => i === index ? { ...card, ...patch } : card) });
  const uploadCardImage = async (index, file) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadToCloudinaryViaBackend(file, 'image');
      updateCard(index, { image: url });
    } catch (cause) {
      setError(cause?.message || 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  };

  const copyParts = id === 'atelier' ? COPY_PARTS.slice(0, 3) : COPY_PARTS;
  const selectedCopy = copyParts.find((part) => selected === `copy:${part.key}`) || copyParts[1];
  const actionKey = selected === 'action:secondary' ? 'secondary' : 'primary';
  const index = Math.min(Math.max(Number(selected.split(':')[1]) || 0, 0), Math.max(0, refs.length - 1));
  const card = refs[index];
  const category = categories.find((entry) => entry.id === card?.categoryId);

  return <div className="banner-template-editor">
    <div className="banner-template-editor__intro"><strong>Personaliza el diseño</strong><span>Elige una parte o tócala en la vista previa. Se guarda junto con la portada.</span></div>
    <div className="banner-template-tabs" role="group" aria-label="Parte de la portada">
      <button type="button" aria-pressed={group === 'copy'} onClick={() => choose('copy:title')}>① Mensajes</button>
      <button type="button" aria-pressed={group === 'actions'} onClick={() => choose('action:primary')}>② Botones</button>
      <button type="button" aria-pressed={group === 'categories'} onClick={() => choose('card:0')}>③ Categorías</button>
      <button type="button" aria-pressed={group === 'style'} onClick={() => choose('style')}>④ Colores</button>
    </div>

    {group === 'copy' && <div className="banner-template-inspector">
      <div className="banner-template-parts" role="group" aria-label="Texto para editar">
        {copyParts.map((part) => <button key={part.key} type="button" aria-pressed={selectedCopy.key === part.key} onClick={() => choose(`copy:${part.key}`)}>
          <small>{part.name}</small><strong>{config[part.key] || 'Sin texto'}</strong>
        </button>)}
      </div>
      <div className="banner-template-inspector__fields">
        <strong>Editar {selectedCopy.name.toLowerCase()}</strong>
        {selectedCopy.key === 'description'
          ? <label className="banner-template-field"><span>Texto que verá el cliente</span><textarea rows="2" value={config.description || ''} onChange={(event) => update({ description: event.target.value })} /></label>
          : <Field label={selectedCopy.key === 'title' ? 'Título' : 'Texto que verá el cliente'} value={config[selectedCopy.key] || ''} onChange={(event) => update({ [selectedCopy.key]: event.target.value })} />}
        <details className="banner-template-more" open={!!config[selectedCopy.link]}><summary>Enlace de este texto <span>opcional</span></summary>
          <Field label="Al hacer clic, ir a" placeholder="/categoria/... o https://..." value={config[selectedCopy.link] || ''} onChange={(event) => update({ [selectedCopy.link]: event.target.value })} />
        </details>
      </div>
    </div>}

    {group === 'actions' && <div className="banner-template-inspector">
      <div className="banner-template-parts" role="group" aria-label="Botón para editar">
        {['primary', 'secondary'].map((key) => <button key={key} type="button" aria-pressed={actionKey === key} onClick={() => choose(`action:${key}`)}>
          <small>{key === 'primary' ? 'Botón principal' : 'Botón secundario'}</small><strong>{config[key].text || 'Sin texto'}</strong>
        </button>)}
      </div>
      <div className="banner-template-inspector__fields">
        <strong>{actionKey === 'primary' ? 'Botón principal' : 'Botón secundario'}</strong>
        <label className="banner-template-toggle"><input type="checkbox" checked={config[actionKey].enabled !== false} onChange={(event) => updateAction(actionKey, { enabled: event.target.checked })} /> Mostrar en la portada</label>
        <Field label="Texto del botón" value={config[actionKey].text || ''} onChange={(event) => updateAction(actionKey, { text: event.target.value })} />
        <Field label="Al hacer clic, ir a" placeholder="/categoria/... o https://..." value={config[actionKey].link || ''} onChange={(event) => updateAction(actionKey, { link: event.target.value })} />
        <p className="banner-template-help">Los botones tienen efecto de cristal y responden al clic en la tienda pública.</p>
      </div>
    </div>}

    {group === 'categories' && <div className="banner-template-inspector">
      {categories.length === 0 ? <p className="banner-template-help">Primero configura las categorías en Apariencia → Categorías.</p> : <>
        <div className="banner-template-parts" role="group" aria-label="Acceso de categoría para editar">
          {refs.map((entry, cardIndex) => {
            const linked = categories.find((item) => item.id === entry.categoryId);
            return <button key={cardIndex} type="button" aria-pressed={index === cardIndex} onClick={() => choose(`card:${cardIndex}`)}>
              <small>Acceso {cardIndex + 1}{entry.enabled === false ? ' · oculto' : ''}</small><strong>{entry.text || linked?.title || 'Elige una categoría'}</strong>
            </button>;
          })}
          {refs.length < maxCards && categories.length > refs.length && <button type="button" className="banner-template-parts__add" onClick={() => { update({ cards: [...refs, { categoryId: categories.find((item) => !refs.some((ref) => ref.categoryId === item.id))?.id || categories[0].id, enabled: true, x: 75, y: 68 }] }); choose(`card:${refs.length}`); }}>+ Añadir acceso</button>}
        </div>
        {card && <div className="banner-template-inspector__fields">
          <strong>Acceso {index + 1}</strong>
          {id === 'atelier' && <p className="banner-template-help">El anillo señala esta categoría sobre la imagen y se conecta con su tarjeta.</p>}
          <label className="banner-template-toggle"><input type="checkbox" checked={card.enabled !== false} onChange={(event) => updateCard(index, { enabled: event.target.checked })} /> Mostrar en la portada</label>
          <label className="banner-template-field"><span>Usar esta categoría</span><select value={card.categoryId} onChange={(event) => updateCard(index, { categoryId: event.target.value, label: '', text: '', link: '', image: '' })}>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label>
          <Field label="Texto visible" placeholder={category?.title || ''} value={card.text || ''} onChange={(event) => updateCard(index, { text: event.target.value })} />
          <Field label="Al hacer clic, ir a" placeholder={category?.link || '/categoria/...'} value={card.link || ''} onChange={(event) => updateCard(index, { link: event.target.value })} />
          <p className="banner-template-help">Si dejas el texto o el enlace vacío, se usa el de la categoría elegida.</p>
          <details className="banner-template-more" open={!!card.image || !!card.label}><summary>Imagen, etiqueta y posición <span>opcional</span></summary>
            <Field label="Etiqueta pequeña" placeholder={category?.title || ''} value={card.label || ''} onChange={(event) => updateCard(index, { label: event.target.value })} />
            <label className="banner-template-field"><span>Imagen propia</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => uploadCardImage(index, event.target.files?.[0])} /></label>
            {card.image && <button type="button" className="banner-btn" onClick={() => updateCard(index, { image: '' })}>Usar imagen de la categoría</button>}
            {id === 'atelier' && <div className="banner-template-position"><Field type="number" min="0" max="100" label="Horizontal %" value={card.x ?? 70} onChange={(event) => updateCard(index, { x: Number(event.target.value) })} /><Field type="number" min="0" max="100" label="Vertical %" value={card.y ?? 55} onChange={(event) => updateCard(index, { y: Number(event.target.value) })} /></div>}
          </details>
          {error && <p role="alert">{error}</p>}
        </div>}
      </>}
    </div>}

    {group === 'style' && <div className="banner-template-inspector__fields banner-template-inspector__fields--style">
      <strong>Colores y legibilidad</strong>
      <p className="banner-template-help">Prueba los colores sobre tu imagen o video en la vista previa.</p>
      <div className="banner-template-color-grid">
        <Field type="color" label="Texto" value={config.textColor || '#ffffff'} onChange={(event) => update({ textColor: event.target.value })} />
        <Field type="color" label="Acento" value={config.accentColor || '#ffffff'} onChange={(event) => update({ accentColor: event.target.value })} />
        <Field type="color" label="Cristal" value={config.glassColor || '#ffffff'} onChange={(event) => update({ glassColor: event.target.value })} />
      </div>
      <label className="banner-template-field"><span>Oscurecer imagen: {config.overlayOpacity ?? 38}%</span><input type="range" min="0" max="70" value={config.overlayOpacity ?? 38} onChange={(event) => update({ overlayOpacity: Number(event.target.value) })} /></label>
    </div>}
  </div>;
}
