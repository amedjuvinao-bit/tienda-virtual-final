import React, { useState } from 'react';
import { BANNER_TEMPLATE_IDS, BANNER_TEMPLATE_META, getBannerTemplate } from '../../../lib/bannerTemplates';

const Field = ({ label, ...props }) => <label className="banner-template-field"><span>{label}</span><input {...props} /></label>;

export default function BannerTemplatePanel({ theme, setPath, uploading, setUploading, uploadToCloudinaryViaBackend }) {
  const banner = theme?.banner || {};
  const { id, config, categories } = getBannerTemplate(banner, theme?.sections);
  const [tab, setTab] = useState('copy');
  const [error, setError] = useState('');
  const current = banner.templateConfigs?.[id] || {};
  const update = (patch) => setPath(`banner.templateConfigs.${id}`, { ...current, ...patch });
  const updateAction = (key, patch) => update({ [key]: { ...config[key], ...patch } });
  const maxCards = id === 'atelier' ? 2 : 3;
  const refs = Array.isArray(current.cards) && current.cards.length
    ? current.cards
    : categories.slice(0, maxCards).map((category, index) => ({ categoryId: category.id, enabled: true, x: 68 + index * 13, y: 42 + index * 26 }));
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

  return <div className="banner-template-editor">
    <div className="banner-template-choices" role="group" aria-label="Diseño de la portada">
      {BANNER_TEMPLATE_IDS.map((key) => <button key={key} type="button" aria-pressed={id === key} onClick={() => { setPath('banner.templateId', key); setTab('copy'); }}>
        <strong>{BANNER_TEMPLATE_META[key].name}</strong><small>{BANNER_TEMPLATE_META[key].description}</small>
      </button>)}
    </div>
    <p className="banner-template-tip">Este diseño usa las imágenes o el video configurados arriba. Los accesos toman las categorías actuales de la tienda.</p>
    <div className="banner-template-tabs" role="group" aria-label="Editar diseño">
      <button type="button" aria-pressed={tab === 'copy'} onClick={() => setTab('copy')}>Textos y enlaces</button>
      <button type="button" aria-pressed={tab === 'categories'} onClick={() => setTab('categories')}>Categorías</button>
      <button type="button" aria-pressed={tab === 'style'} onClick={() => setTab('style')}>Cristal y colores</button>
    </div>
    {tab === 'copy' && <div className="banner-template-fields">
      <Field label="Texto superior" value={config.eyebrow || ''} onChange={(e) => update({ eyebrow: e.target.value })} />
      <Field label="Enlace del texto superior (opcional)" value={config.eyebrowLink || ''} onChange={(e) => update({ eyebrowLink: e.target.value })} placeholder="/categoria/..." />
      <Field label="Título" value={config.title || ''} onChange={(e) => update({ title: e.target.value })} />
      <Field label="Enlace del título (opcional)" value={config.titleLink || ''} onChange={(e) => update({ titleLink: e.target.value })} placeholder="/categoria/..." />
      <label className="banner-template-field"><span>Descripción</span><textarea rows="2" value={config.description || ''} onChange={(e) => update({ description: e.target.value })} /></label>
      <Field label="Enlace de la descripción (opcional)" value={config.descriptionLink || ''} onChange={(e) => update({ descriptionLink: e.target.value })} placeholder="/categoria/..." />
      {id !== 'atelier' && <><Field label="Texto sobre las categorías" value={config.footerText || ''} onChange={(e) => update({ footerText: e.target.value })} /><Field label="Enlace de ese texto (opcional)" value={config.footerTextLink || ''} onChange={(e) => update({ footerTextLink: e.target.value })} placeholder="/categoria/..." /></>}
      {['primary', 'secondary'].map((key) => <fieldset key={key} className="banner-template-action"><legend>{key === 'primary' ? 'Botón principal' : 'Botón secundario'}</legend>
        <label><input type="checkbox" checked={config[key].enabled !== false} onChange={(e) => updateAction(key, { enabled: e.target.checked })} /> Mostrar</label>
        <Field label="Texto del botón" value={config[key].text || ''} onChange={(e) => updateAction(key, { text: e.target.value })} />
        <Field label="Enlace del botón" placeholder="/productos o https://..." value={config[key].link || ''} onChange={(e) => updateAction(key, { link: e.target.value })} />
      </fieldset>)}
    </div>}
    {tab === 'categories' && <div className="banner-template-fields">
      {categories.length === 0 && <p className="banner-template-tip">Configura primero las categorías en la sección Categorías de Apariencia.</p>}
      {refs.map((card, index) => {
        const category = categories.find((entry) => entry.id === card.categoryId);
        return <fieldset key={index} className="banner-template-action"><legend>Acceso {index + 1}</legend>
          <label><input type="checkbox" checked={card.enabled !== false} onChange={(e) => updateCard(index, { enabled: e.target.checked })} /> Mostrar</label>
          <label className="banner-template-field"><span>Categoría existente</span><select value={card.categoryId} onChange={(e) => updateCard(index, { categoryId: e.target.value, label: '', text: '', link: '', image: '' })}>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label>
          <Field label="Etiqueta pequeña (opcional)" placeholder={category?.title || ''} value={card.label || ''} onChange={(e) => updateCard(index, { label: e.target.value })} />
          <Field label="Texto visible (opcional)" placeholder={category?.title || ''} value={card.text || ''} onChange={(e) => updateCard(index, { text: e.target.value })} />
          <Field label="Enlace propio (opcional)" placeholder={category?.link || '/categoria/...'} value={card.link || ''} onChange={(e) => updateCard(index, { link: e.target.value })} />
          <label className="banner-template-field"><span>Imagen propia (opcional; si no, usa la de la categoría)</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(e) => uploadCardImage(index, e.target.files?.[0])} /></label>
          {card.image && <button type="button" className="banner-btn" onClick={() => updateCard(index, { image: '' })}>Usar imagen de la categoría</button>}
          {id === 'atelier' && <div className="banner-template-position"><Field type="number" min="0" max="100" label="Posición horizontal %" value={card.x ?? 70} onChange={(e) => updateCard(index, { x: Number(e.target.value) })} /><Field type="number" min="0" max="100" label="Posición vertical %" value={card.y ?? 55} onChange={(e) => updateCard(index, { y: Number(e.target.value) })} /></div>}
        </fieldset>;
      })}
      {refs.length < maxCards && categories.length > refs.length && <button type="button" className="banner-btn" onClick={() => update({ cards: [...refs, { categoryId: categories.find((category) => !refs.some((item) => item.categoryId === category.id))?.id || categories[0].id, enabled: true, x: 75, y: 68 }] })}>Añadir acceso existente</button>}
      {error && <p role="alert">{error}</p>}
    </div>}
    {tab === 'style' && <div className="banner-template-fields">
      <Field type="color" label="Color del texto" value={config.textColor || '#ffffff'} onChange={(e) => update({ textColor: e.target.value })} />
      <Field type="color" label="Color de acento" value={config.accentColor || '#ffffff'} onChange={(e) => update({ accentColor: e.target.value })} />
      <Field type="color" label="Tono del cristal" value={config.glassColor || '#ffffff'} onChange={(e) => update({ glassColor: e.target.value })} />
      <label className="banner-template-field"><span>Oscurecer la imagen para leer el texto: {config.overlayOpacity ?? 38}%</span><input type="range" min="0" max="70" value={config.overlayOpacity ?? 38} onChange={(e) => update({ overlayOpacity: Number(e.target.value) })} /></label>
    </div>}
  </div>;
}
