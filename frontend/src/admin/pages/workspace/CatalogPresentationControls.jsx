import React, { useId, useState } from 'react';
import { adminFetch } from '../../../lib/api';
import { API_BASE_URL } from '../../../config/apiBaseUrl';
import { CATALOG_GLASS_PALETTE } from '../../../components/catalog/catalogGlassPalette';
import { catalogImageUrl } from '../../../components/catalog/catalogPresentation';

const fieldClass = 'w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800';
const groups = [
  { title: 'Composición', fields: [
    ['layout', 'Composición del catálogo', [['glass-grid', 'Cuadrícula con cristal'], ['grid', 'Cuadrícula clásica']]],
    ['showPhotoCount', 'Mostrar cantidad de fotos', 'boolean'],
    ['filterSectionBorders', 'Separar filtros en paneles con borde', 'boolean'],
    ['rimStyle', 'Borde de las tarjetas', [['optical', 'Cristal óptico de Inicio'], ['fine', 'Línea fina'], ['none', 'Sin borde']]],
    ['rimColor', 'Reflejo del borde de cristal', 'color'],
    ['rimOpacity', 'Intensidad del borde de cristal (0 a 1)', [0, 1, .05]],
    ['imageRatio', 'Proporción de las fotografías', [['square', 'Cuadrada'], ['portrait', 'Vertical'], ['landscape', 'Horizontal']]],
    ['maxWidth', 'Ancho máximo de la escena (px)', [960, 1920, 10]],
    ['topSpacing', 'Espacio superior bajo el encabezado (px)', [0, 240, 1]],
    ['gap', 'Separación entre productos (px)', [8, 48, 1]],
  ]},
  { title: 'Fondo y cristal', fields: [
    ['backgroundColor', 'Color de fondo de la escena', 'color'],
    ['backgroundOpacity', 'Intensidad de la imagen de fondo (0 a 1)', [0, 1, .05]],
    ['textColor', 'Color de títulos y controles', 'color'],
    ['accentColor', 'Color de acento de la escena', 'color'],
    ['glassColor', 'Tinte del cristal', 'color'],
    ['glassOpacity', 'Opacidad del cristal (0 a 1)', [0, 1, .05]],
    ['glassBlur', 'Desenfoque del cristal (px)', [0, 32, 1]],
    ['radius', 'Radio del cristal (px)', [0, 40, 1]],
  ]},
  { title: 'Encabezado de cristal', fields: [
    ['headerTint', 'Color del cristal del encabezado', 'color'],
    ['headerOpacity', 'Opacidad del encabezado (0 a 1)', [0, 1, .05]],
    ['headerContrastColor', 'Color detrás del cristal', 'color'],
    ['headerContrast', 'Contraste detrás del cristal (0 a 1)', [0, 1, .05]],
    ['headerEdgeColor', 'Color del borde del encabezado', 'color'],
    ['headerEdgeWidth', 'Grosor del borde del encabezado (px)', [0, 6, .5]],
    ['headerReflectionColor', 'Color de los reflejos', 'color'],
    ['headerReflection', 'Intensidad de los reflejos (0 a 1)', [0, 1, .05]],
    ['headerShadowColor', 'Color de la sombra del encabezado', 'color'],
    ['headerShadow', 'Intensidad de la sombra (0 a 1)', [0, 1, .05]],
    ['headerMaterialOpacity', 'Intensidad del acabado de cristal (0 a 1)', [0, 1, .05]],
    ['headerBlur', 'Desenfoque del encabezado (px)', [0, 32, 1]],
    ['headerRadius', 'Esquinas del encabezado (px)', [0, 40, 1]],
    ['headerHeight', 'Altura mínima del encabezado (px)', [80, 240, 1]],
    ['headerPadding', 'Espacio interior del encabezado (px)', [8, 40, 1]],
    ['headerLayers', 'Mostrar segunda capa de cristal', 'boolean'],
    ['headerTextColor', 'Color del texto del encabezado', 'color'],
    ['headerBadgeColor', 'Color del texto de la etiqueta', 'color'],
    ['headerBadgeTint', 'Color del cristal de la etiqueta', 'color'],
    ['headerIcon', 'Adorno del encabezado', [['bags', 'Bolsas de cristal'], ['none', 'Sin adorno']]],
    ['headerIconColor', 'Color de las bolsas de cristal', 'color'],
    ['headerIconSize', 'Tamaño de las bolsas (px)', [80, 240, 1]],
    ['headerIconOpacity', 'Opacidad de las bolsas (0 a 1)', [0, 1, .05]],
  ]},
  { title: 'Tipografía y movimiento', fields: [
    ['titleFont', 'Tipografía del título de catálogo', [['serif', 'Editorial'], ['sans', 'Contemporánea'], ['inherit', 'Heredar de la tienda']]],
    ['titleSize', 'Tamaño del título de catálogo (px)', [24, 80, 1]],
    ['cardTitleSize', 'Tamaño del nombre del producto (px)', [11, 24, 1]],
    ['cardPriceSize', 'Tamaño del precio del producto (px)', [11, 24, 1]],
    ['showDescription', 'Mostrar descripción en las tarjetas', 'boolean'],
    ['showOptions', 'Mostrar colores disponibles en las tarjetas', 'boolean'],
    ['motion', 'Movimiento de la escena', [['parallax', 'Capas con parallax'], ['reveal', 'Entrada suave'], ['none', 'Sin movimiento']]],
    ['motionStrength', 'Profundidad del parallax (px)', [0, 40, 1]],
  ]},
];
const fields = new Map(groups.flatMap(group => group.fields).map(field => [field[0], field]));
const topics = [
  { id:'layout', title:'Distribución', keys:['layout','maxWidth','topSpacing','gap','filterSectionBorders'] },
  { id:'background', title:'Fondo', keys:['backgroundColor','backgroundOpacity','textColor','accentColor','glassColor','glassOpacity','glassBlur','radius'] },
  { id:'header', title:'Encabezado', sections:[
    { id:'material', title:'Cristal', keys:['headerTint','headerOpacity','headerContrastColor','headerContrast','headerMaterialOpacity','headerBlur','headerLayers'] },
    { id:'light', title:'Bordes y luz', keys:['headerEdgeColor','headerEdgeWidth','headerReflectionColor','headerReflection','headerShadowColor','headerShadow'] },
    { id:'text', title:'Texto', keys:['titleFont','titleSize','headerTextColor','headerBadgeColor','headerBadgeTint'] },
    { id:'size', title:'Medidas', keys:['headerRadius','headerHeight','headerPadding'] },
    { id:'icon', title:'Bolsas', keys:['headerIcon','headerIconColor','headerIconSize','headerIconOpacity'] },
  ] },
  { id:'products', title:'Productos', keys:['rimStyle','rimColor','rimOpacity','imageRatio','cardTitleSize','cardPriceSize','showPhotoCount','showDescription','showOptions'] },
  { id:'motion', title:'Movimiento', keys:['motion','motionStrength'] },
];
function TopicTabs({ items, selected, onSelect, id, label }) {
  return <div className="catalog-settings-tabs" role="tablist" aria-label={label}>
    {items.map((item, index) => <button key={item.id} type="button" role="tab" id={`${id}-tab-${item.id}`} aria-selected={selected === item.id} aria-controls={`${id}-panel-${item.id}`} tabIndex={selected === item.id ? 0 : -1}
      onClick={() => onSelect(item.id)} onKeyDown={event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % items.length;
        if (event.key === 'ArrowLeft') next = (index + items.length - 1) % items.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = items.length - 1;
        if (next !== undefined) { event.preventDefault(); onSelect(items[next].id); document.getElementById(`${id}-tab-${items[next].id}`)?.focus(); }
      }}>{item.title}</button>)}
  </div>;
}
export default function CatalogPresentationControls({ value, onChange }) {
  const id = useId();
  const [topic, setTopic] = useState('layout');
  const [headerSection, setHeaderSection] = useState('material');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [paletteApplied, setPaletteApplied] = useState(false);
  const patch = (key, next) => { setPaletteApplied(false); onChange({ [key]: next }); };
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 12 * 1024 * 1024) {
      setMessage('Usa una imagen JPG, PNG, WebP o AVIF de hasta 12 MB.'); return;
    }
    setUploading(true); setMessage('');
    try {
      const body = new FormData(); body.append('file', file);
      const response = await adminFetch(`${API_BASE_URL}/api/uploads`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok || !catalogImageUrl(data.url)) throw new Error('No se pudo subir la imagen. Intenta otra vez.');
      // Patch against the editor's current state so in-flight uploads never overwrite other edits.
      onChange({ backgroundImage: data.url });
      setMessage('Imagen subida. Guarda los cambios para publicarla.');
    } catch (error) { setMessage(error.message || 'No se pudo subir la imagen.'); }
    finally { setUploading(false); }
  }
  return <div className="catalog-presentation-controls mt-6 space-y-4 border-t border-gray-200 pt-5">
    <p className="text-sm text-gray-600">Elige un tema. Los cambios se muestran en la vista previa y se publican al guardar.</p>
    {value.layout === 'glass-grid' && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pink-100 bg-pink-50/50 p-3">
      <div><p className="text-sm font-semibold text-gray-800">Cristal luminoso</p><p className="text-xs text-gray-600">Color cálido, luz suave y textos con contraste. Puedes ajustar cada valor después.</p></div>
      <button type="button" className="shrink-0 rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm text-pink-900 transition hover:bg-pink-50 hover:shadow-sm active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-700 motion-reduce:transition-none" onClick={() => { onChange({ ...CATALOG_GLASS_PALETTE }); setPaletteApplied(true); }}>Aplicar paleta de cristal</button>
      {paletteApplied && <p className="w-full text-xs text-gray-600" role="status">Paleta aplicada a la vista previa. Guarda los cambios para conservarla.</p>}
    </div>}
    <TopicTabs items={topics} selected={topic} onSelect={setTopic} id={id} label="Temas de diseño del catálogo"/>
    {topics.map(group => <div key={group.id} role="tabpanel" id={`${id}-panel-${group.id}`} aria-labelledby={`${id}-tab-${group.id}`} hidden={topic !== group.id}>
      {group.sections && <TopicTabs items={group.sections} selected={headerSection} onSelect={setHeaderSection} id={`${id}-header`} label="Ajustes del encabezado"/>}
      {(group.sections || [group]).map(section => <div key={section.id} role={group.sections ? 'tabpanel' : undefined} id={`${id}-header-panel-${section.id}`} aria-labelledby={group.sections ? `${id}-header-tab-${section.id}` : undefined} hidden={!!group.sections && headerSection !== section.id}>
      <div className="grid gap-3 md:grid-cols-2">{section.keys.map(key => fields.get(key)).map(([key, label, type]) => <label key={key} className={`block min-w-0 text-sm text-gray-700 ${type === 'boolean' ? 'flex items-center justify-between gap-3 rounded-xl border p-3' : ''}`}>
        <span id={`${id}-${key}`} className="mb-1 block">{label}</span>
        {type === 'boolean' ? <input aria-labelledby={`${id}-${key}`} type="checkbox" checked={value[key]} onChange={event => patch(key, event.target.checked)} className="h-4 w-4 accent-pink-600"/> :
          Array.isArray(type) && Array.isArray(type[0]) ? <select aria-labelledby={`${id}-${key}`} className={fieldClass} value={value[key]} onChange={event => patch(key, event.target.value)}>{type.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select> :
          type === 'color' ? <input aria-labelledby={`${id}-${key}`} type="color" className={`${fieldClass} h-10`} value={value[key]} onChange={event => patch(key, event.target.value)}/> :
          <input aria-labelledby={`${id}-${key}`} type="number" className={fieldClass} value={value[key]} min={type[0]} max={type[1]} step={type[2]} onChange={event => patch(key, event.target.value === '' ? '' : Number(event.target.value))}/>}
      </label>)}</div>
    </div>)}
    </div>)}
    <fieldset hidden={topic !== 'background'} className="space-y-3"><legend className="mb-2 text-sm font-semibold text-gray-800">Imagen de fondo</legend>
      <label className="block text-sm text-gray-700">Dirección de la imagen de fondo<input className={fieldClass} value={value.backgroundImage} onChange={event => patch('backgroundImage', event.target.value)} placeholder="https://… o /imagen.webp"/></label>
      <label className="block text-sm text-gray-700">Subir imagen de fondo<input className={`${fieldClass} mt-1`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={upload}/></label>
      <button type="button" className="rounded-xl border px-3 py-2 text-sm" disabled={uploading || !value.backgroundImage} onClick={() => patch('backgroundImage', '')}>Quitar imagen de fondo</button>
      {(uploading || message) && <p className="text-sm" role="status">{uploading ? 'Subiendo imagen…' : message}</p>}
    </fieldset>
    <p className="text-xs text-gray-600">Los colores, iconos, bordes y esquinas de los productos se ajustan en Tarjetas de producto. Los filtros conservan sus controles de estilo. El encabezado y pie corresponden a los configurados para la tienda.</p>
  </div>;
}
