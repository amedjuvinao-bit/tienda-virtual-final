import { isStorefrontSectionVisible } from '../../../lib/storefrontSectionVisibility';
import { CATEGORIAS_SECTION_DEFAULTS } from './categorias/categoriasSectionHelpers';
import { INFO_SECTION_DEFAULTS } from './info/infoSectionHelpers';

export const SECTION_LABELS = {
  tendencia: 'En tendencia',
  look: 'Looks',
  complementos: 'Complementos',
  categorias: 'Categorías',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  informacion: 'Información',
};

const count = (value, valid) => Array.isArray(value) ? value.filter(valid).length : 0;
const validProduct = (product) => String(typeof product === 'string' ? product : product?.productId || '').trim();

export function getSectionOverview(section, sections) {
  const id = section?.id;
  if (!Object.prototype.hasOwnProperty.call(SECTION_LABELS, id)) {
    return { id, label: section?.name || id || 'Sección', status: 'unsupported', detail: 'Sin editor disponible' };
  }

  const config = section?.config || {};
  let detail = '';
  if (id === 'tendencia' || id === 'look') {
    const total = count(config.products, validProduct);
    detail = `${total} ${total === 1 ? 'producto seleccionado' : 'productos seleccionados'}`;
  } else if (id === 'categorias') {
    const slides = Array.isArray(config.slides) ? config.slides : CATEGORIAS_SECTION_DEFAULTS.config.slides;
    const total = count(slides, (slide) => slide?.enabled !== false);
    detail = `${total} ${total === 1 ? 'categoría activa' : 'categorías activas'}`;
  } else if (id === 'instagram' || id === 'tiktok') {
    const total = count(config.posts, (post) => post?.enabled !== false &&
      (id === 'instagram' ? post?.image : post?.image || post?.thumb));
    detail = id === 'instagram' && config.journalSource === 'connected'
      ? 'Publicaciones de la cuenta conectada' : `${total} ${total === 1 ? 'publicación lista' : 'publicaciones listas'}`;
  } else if (id === 'informacion') {
    const cards = Array.isArray(config.cards) ? config.cards : INFO_SECTION_DEFAULTS.config.cards;
    detail = `${cards.length} ${cards.length === 1 ? 'bloque informativo' : 'bloques informativos'}`;
  } else {
    detail = 'Imagen y enlace principal';
  }

  const status = section.enabled === false
    ? 'hidden'
    : isStorefrontSectionVisible({ sections }, id) ? 'ready' : 'needs-content';

  return { id, label: SECTION_LABELS[id], status, detail };
}
