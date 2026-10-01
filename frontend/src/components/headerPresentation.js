const HEX_COLOR = /^#([\da-f]{3}|[\da-f]{6})$/i;

export function isDarkHeaderBackground(bgColor) {
  const bg = String(bgColor || '').trim();
  if (!HEX_COLOR.test(bg)) return false;
  const digits = bg.slice(1).length === 3
    ? [...bg.slice(1)].map((digit) => digit + digit).join('')
    : bg.slice(1);
  const [red, green, blue] = [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue < 140;
}

export function resolveHeaderLogo(header = {}, fallback = '') {
  const bg = String(header.bgColor || '').trim();
  if (!HEX_COLOR.test(bg)) return header.logoLight || header.logoDark || fallback;
  return isDarkHeaderBackground(bg)
    ? header.logoLight || header.logoDark || fallback
    : header.logoDark || header.logoLight || fallback;
}

export const HEADER_FONT_PRESETS = {
  classic: {
    label: 'Editorial', description: 'Serif con presencia y ritmo de revista.',
    family: '"Playfair Display", Georgia, serif', weight: 600, style: 'normal', spacing: '-0.035em', transform: 'none',
  },
  modern: {
    label: 'Contemporáneo', description: 'Mayúsculas amplias y trazo preciso.',
    family: 'Manrope, system-ui, sans-serif', weight: 800, style: 'normal', spacing: '0.14em', transform: 'uppercase',
  },
  elegant: {
    label: 'Alta costura', description: 'Contraste fino y aire de boutique.',
    family: '"Cormorant Garamond", Georgia, serif', weight: 700, style: 'italic', spacing: '0.04em', transform: 'none',
  },
  cute: {
    label: 'Jovial', description: 'Curvas redondas con personalidad.',
    family: '"Baloo 2", system-ui, sans-serif', weight: 700, style: 'normal', spacing: '0.015em', transform: 'none',
  },
};

export function resolveHeaderTypography(header = {}, headingsFont = 'Georgia, serif') {
  const preset = HEADER_FONT_PRESETS[header.fontPreset];
  const custom = String(header.fontFamily || '').trim();
  return {
    fontFamily: custom || preset?.family || headingsFont,
    fontWeight: preset?.weight || 700,
    fontStyle: preset?.style || 'italic',
    letterSpacing: preset?.spacing || 'normal',
    textTransform: preset?.transform || 'none',
  };
}

export function headerMenuDestination(value) {
  const ref = String(value || '').trim();
  if (!ref || /[\\\x00-\x1f\x7f]/.test(ref)) return null;
  if (/^\/(?!\/)/.test(ref) && !/^\/(admin(?:\/|$)|probe-site-settings(?:\/|$))/i.test(ref) && !/:([a-z]+)\b/i.test(ref)) {
    return { to: ref, isExternal: false };
  }
  if (/^#[a-z][\w-]*$/i.test(ref)) return { to: ref, isExternal: false };
  try {
    const url = new URL(ref);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) {
      return { to: url.href, isExternal: true };
    }
  } catch { /* No es una URL absoluta válida. */ }
  return null;
}

export function normalizeHeaderMenu(items) {
  return (Array.isArray(items) ? items : []).flatMap((item) => {
    const name = String(item?.title || '').trim();
    const destination = headerMenuDestination(item?.ref);
    return name && destination ? [{ name, ...destination }] : [];
  });
}

export function validateHeaderMenu(items) {
  for (const [index, item] of (items || []).entries()) {
    if (!String(item?.title || '').trim()) return `El enlace ${index + 1} necesita un nombre.`;
    if (!headerMenuDestination(item?.ref)) {
      return `Revisa el destino del enlace ${index + 1}: usa una ruta pública, una sección (#nombre) o una URL http(s).`;
    }
  }
  return '';
}
