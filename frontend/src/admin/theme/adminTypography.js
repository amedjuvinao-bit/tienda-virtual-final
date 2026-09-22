export const DEFAULT_ADMIN_FONT_PRESET = 'modernElegant';

export const ADMIN_FONT_PRESETS = Object.freeze([
  Object.freeze({
    value: 'modernElegant',
    label: 'Moderna elegante',
    description: 'Inter para operar y Playfair para títulos con presencia.',
    body: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    heading: "'Playfair Display', Georgia, serif",
    sample: 'Aa',
  }),
  Object.freeze({
    value: 'boutiqueEditorial',
    label: 'Boutique editorial',
    description: 'Montserrat con Cormorant para una estética refinada.',
    body: "'Montserrat', 'Inter', system-ui, sans-serif",
    heading: "'Cormorant Garamond', Georgia, serif",
    sample: 'Rr',
  }),
  Object.freeze({
    value: 'executiveSerif',
    label: 'Ejecutiva premium',
    description: 'Inter y DM Serif: sobria, clara y con jerarquía ejecutiva.',
    body: "'Inter', system-ui, sans-serif",
    heading: "'DM Serif Display', Georgia, serif",
    sample: 'Ee',
  }),
  Object.freeze({
    value: 'contemporary',
    label: 'Contemporánea',
    description: 'Poppins uniforme para un panel moderno y tecnológico.',
    body: "'Poppins', 'Inter', system-ui, sans-serif",
    heading: "'Poppins', 'Inter', system-ui, sans-serif",
    sample: 'Pp',
  }),
  Object.freeze({
    value: 'classicCalm',
    label: 'Clásica serena',
    description: 'Lora e Inter para una lectura cálida, elegante y descansada.',
    body: "'Inter', system-ui, sans-serif",
    heading: "'Lora', Georgia, serif",
    sample: 'Ll',
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

  return preset.value;
}
