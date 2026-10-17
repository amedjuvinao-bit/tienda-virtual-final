import { CATEGORIAS_SECTION_DEFAULTS } from '../admin/appearance/sections/categorias/categoriasSectionHelpers';

const hasProduct = (value) => Boolean(
  String(typeof value === 'string' ? value : value?.productId || '').trim()
);

function getSection(theme, id) {
  const sections = Array.isArray(theme?.sections) ? theme.sections : [];
  return sections.find((section) => section?.id === id)
    || sections.find((section) => section?.type === id);
}

export function isStorefrontSectionVisible(theme, id) {
  const section = getSection(theme, id);
  if (section?.enabled === false) return false;
  const config = section?.config || {};

  if (id === 'tendencia' || id === 'look') {
    return Array.isArray(config.products)
      && config.products.some(hasProduct)
      && (id !== 'tendencia' || Number(config.maxItems ?? 4) > 0);
  }

  if (id === 'categorias') {
    const slides = Array.isArray(config.slides)
      ? config.slides
      : CATEGORIAS_SECTION_DEFAULTS.config.slides;
    return slides.some((slide) => slide?.enabled !== false);
  }

  if (id === 'instagram' || id === 'tiktok') {
    return Array.isArray(config.posts) && config.posts.some((post) =>
      post?.enabled !== false && (id === 'instagram' ? post?.image : post?.image || post?.thumb)
    );
  }

  return id === 'complementos' || id === 'informacion';
}
