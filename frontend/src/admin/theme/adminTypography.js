export const DEFAULT_ADMIN_FONT_PRESET = 'modernElegant';

export const ADMIN_FONT_PRESETS = Object.freeze([
  Object.freeze({
    value: 'modernElegant',
    label: 'Moderna elegante',
    description: 'Manrope precisa con títulos Playfair de alto contraste.',
    body: "'Manrope', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    heading: "'Playfair Display', Georgia, serif",
    sample: 'Aa',
    headingWeight: '600',
  }),
  Object.freeze({
    value: 'boutiqueEditorial',
    label: 'Boutique editorial',
    description: 'Source Sans humanista con Cormorant de aire editorial.',
    body: "'Source Sans 3', 'Segoe UI', sans-serif",
    heading: "'Cormorant Garamond', Georgia, serif",
    sample: 'Rr',
    headingWeight: '600',
  }),
  Object.freeze({
    value: 'executiveSerif',
    label: 'Ejecutiva premium',
    description: 'IBM Plex Sans y Serif: técnica, sobria y ejecutiva.',
    body: "'IBM Plex Sans', Arial, sans-serif",
    heading: "'IBM Plex Serif', Georgia, serif",
    sample: 'Ee',
    headingWeight: '600',
  }),
  Object.freeze({
    value: 'contemporary',
    label: 'Contemporánea',
    description: 'Space Grotesk geométrica para un panel digital y directo.',
    body: "'Space Grotesk', Arial, sans-serif",
    heading: "'Space Grotesk', Arial, sans-serif",
    sample: 'Gg',
    headingWeight: '700',
  }),
  Object.freeze({
    value: 'classicCalm',
    label: 'Clásica serena',
    description: 'Lora con Libre Baskerville para una lectura clásica y cálida.',
    body: "'Lora', Georgia, serif",
    heading: "'Libre Baskerville', Georgia, serif",
    sample: 'Ll',
    headingWeight: '700',
  }),
]);

const FONT_PRESET_MAP = new Map(
  ADMIN_FONT_PRESETS.map((preset) => [preset.value, preset])
);

export function normalizeAdminFontPreset(value) {
  return FONT_PRESET_MAP.has(value) ? value : DEFAULT_ADMIN_FONT_PRESET;
}

export function getAdminFontPreset(value) {
  return FONT_PRESET_MAP.get(normalizeAdminFontPreset(value));
}

export function applyAdminTypography(value) {
  const preset = getAdminFontPreset(value);
  const root = document.documentElement;

  root.dataset.adminFontPreset = preset.value;
  root.style.setProperty('--admin-font-body', preset.body);
  root.style.setProperty('--admin-font-heading', preset.heading);
  root.style.setProperty('--admin-font-heading-weight', preset.headingWeight || '700');

  return preset.value;
}
