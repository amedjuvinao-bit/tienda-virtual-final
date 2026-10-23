// Panel labels describe the editor, independently of the merchant's public copy.
// Persisted section IDs remain stable for existing links and settings.
export const ADMIN_SECTION_LABELS = Object.freeze({
  tendencia: 'En tendencia',
  look: 'Selección de productos',
  complementos: 'Complementos',
  categorias: 'Categorías',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  informacion: 'Información',
});

export function getAdminSectionLabel(section) {
  for (const key of [section?.id, section?.type]) {
    if (Object.prototype.hasOwnProperty.call(ADMIN_SECTION_LABELS, key)) return ADMIN_SECTION_LABELS[key];
  }
  return section?.name || 'Sección';
}
