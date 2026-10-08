export const BANNER_TEMPLATE_IDS = ['discovery', 'editorial', 'atelier'];

export const BANNER_TEMPLATE_META = {
  discovery: { name: 'Descubrimiento', description: 'Mensaje protagonista y accesos a tus categorías.' },
  editorial: { name: 'Editorial', description: 'Composición de revista y accesos discretos.' },
  atelier: { name: 'Vitrina de cristal', description: 'Productos y categorías con puntos interactivos.' },
};

const action = (text) => ({ enabled: true, text, link: '' });

export const BANNER_TEMPLATE_DEFAULTS = {
  discovery: {
    eyebrow: 'DESCUBRE TU TIENDA', title: 'Tu próximo favorito',
    description: 'Explora nuestra selección y encuentra algo especial.', footerText: 'Explora por categorías',
    primary: action('Explorar'), secondary: action('Conocer más'),
    textColor: '#fffaf5', accentColor: '#f3d7c5', glassColor: '#ffffff', overlayOpacity: 38,
  },
  editorial: {
    eyebrow: 'UNA NUEVA MIRADA', title: 'Lo nuevo empieza aquí',
    description: 'Selecciones que invitan a descubrir.', footerText: 'Una selección para ti',
    primary: action('Ver novedades'), secondary: action('Descubrir'),
    textColor: '#fffaf5', accentColor: '#f7d9d5', glassColor: '#ffffff', overlayOpacity: 42,
  },
  atelier: {
    eyebrow: 'EXPLORA CADA DETALLE', title: 'Objetos para descubrir',
    description: 'Encuentra aquello que conecta contigo.', footerText: '',
    primary: action('Explorar piezas'), secondary: action('Ver todo'),
    textColor: '#fffaf5', accentColor: '#ffe0d4', glassColor: '#ffffff', overlayOpacity: 44,
  },
};

export function getExistingBannerCategories(sections) {
  const source = (Array.isArray(sections) ? sections : []).find((section) =>
    [section?.id, section?.type].some((value) => String(value || '').toLowerCase() === 'categorias'));
  const configured = normalizeCategoriasSection(source || CATEGORIAS_SECTION_DEFAULTS);
  return (Array.isArray(configured?.config?.slides) ? configured.config.slides : [])
    .filter((entry) => entry?.enabled !== false && entry?.title)
    .map((entry, index) => ({ id: String(entry.id || `category-${index}`), title: entry.title, image: entry.image || '', link: entry.href || '' }));
}

export function getBannerTemplate(banner, sections) {
  const id = BANNER_TEMPLATE_IDS.includes(banner?.templateId) ? banner.templateId : 'discovery';
  const raw = banner?.templateConfigs?.[id] || {};
  const defaults = BANNER_TEMPLATE_DEFAULTS[id];
  const existing = getExistingBannerCategories(sections);
  const saved = Array.isArray(raw.cards) && raw.cards.length ? raw.cards : existing.slice(0, id === 'atelier' ? 2 : 3).map((entry, index) => ({
    categoryId: entry.id, x: id === 'atelier' ? 45 + index * 29 : 68 + index * 13, y: id === 'atelier' ? 28 + index * 24 : 42 + index * 26,
  }));
  return {
    id,
    categories: existing,
    config: {
      ...defaults, ...raw,
      primary: { ...defaults.primary, ...raw.primary },
      secondary: { ...defaults.secondary, ...raw.secondary },
      cards: saved.map((item) => {
        const category = existing.find((entry) => entry.id === item.categoryId);
        return category ? {
          ...item, label: item.label || category.title, text: item.text || category.title,
          image: item.image || category.image, link: item.link || category.link,
        } : null;
      }).filter(Boolean),
    },
  };
}

export function safeBannerLink(value) {
  const link = String(value || '').trim();
  if (/^\/(?!\/)/.test(link) || /^https?:\/\//i.test(link) || /^mailto:/i.test(link)) return link;
  return '';
}
import { CATEGORIAS_SECTION_DEFAULTS, normalizeCategoriasSection } from '../admin/appearance/sections/categorias/categoriasSectionHelpers';

