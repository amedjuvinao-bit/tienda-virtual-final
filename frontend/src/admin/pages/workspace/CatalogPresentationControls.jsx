import React, { useId, useState } from 'react';
import { adminFetch } from '../../../lib/api';
import { API_BASE_URL } from '../../../config/apiBaseUrl';
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
export default function CatalogPresentationControls({ value, onChange }) {
  const id = useId();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const patch = (key, next) => onChange({ [key]: next });
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
  return <div className="mt-6 space-y-6 border-t border-gray-200 pt-5">
    <p className="text-sm text-gray-600">Todos los productos comparten una cuadrícula uniforme. Los bordes ópticos usan el mismo acabado de Inicio y se adaptan al tamaño de cada tarjeta. El fondo puede funcionar únicamente con color; la imagen es opcional.</p>
    {groups.map(group => <fieldset key={group.title} className="min-w-0">
      <legend className="mb-3 text-sm font-semibold text-gray-800">{group.title}</legend>
      <div className="grid gap-3 md:grid-cols-2">{group.fields.map(([key, label, type]) => <label key={key} className={`block min-w-0 text-sm text-gray-700 ${type === 'boolean' ? 'flex items-center justify-between gap-3 rounded-xl border p-3' : ''}`}>
        <span id={`${id}-${key}`} className="mb-1 block">{label}</span>
        {type === 'boolean' ? <input aria-labelledby={`${id}-${key}`} type="checkbox" checked={value[key]} onChange={event => patch(key, event.target.checked)} className="h-4 w-4 accent-pink-600"/> :
          Array.isArray(type) && Array.isArray(type[0]) ? <select aria-labelledby={`${id}-${key}`} className={fieldClass} value={value[key]} onChange={event => patch(key, event.target.value)}>{type.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select> :
          type === 'color' ? <input aria-labelledby={`${id}-${key}`} type="color" className={`${fieldClass} h-10`} value={value[key]} onChange={event => patch(key, event.target.value)}/> :
          <input aria-labelledby={`${id}-${key}`} type="number" className={fieldClass} value={value[key]} min={type[0]} max={type[1]} step={type[2]} onChange={event => patch(key, event.target.value === '' ? '' : Number(event.target.value))}/>}
      </label>)}</div>
    </fieldset>)}
    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold text-gray-800">Imagen de fondo</legend>
      <label className="block text-sm text-gray-700">Dirección de la imagen de fondo<input className={fieldClass} value={value.backgroundImage} onChange={event => patch('backgroundImage', event.target.value)} placeholder="https://… o /imagen.webp"/></label>
      <label className="block text-sm text-gray-700">Subir imagen de fondo<input className={`${fieldClass} mt-1`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={upload}/></label>
      <button type="button" className="rounded-xl border px-3 py-2 text-sm" disabled={uploading || !value.backgroundImage} onClick={() => patch('backgroundImage', '')}>Quitar imagen de fondo</button>
      {(uploading || message) && <p className="text-sm" role="status">{uploading ? 'Subiendo imagen…' : message}</p>}
    </fieldset>
    <p className="text-xs text-gray-600">Los colores, iconos, bordes y esquinas de los productos se ajustan en Tarjetas de producto. Los filtros conservan sus controles de estilo. El encabezado y pie corresponden a los configurados para la tienda.</p>
  </div>;
}
