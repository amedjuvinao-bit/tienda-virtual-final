import { normalizeMobileMenuIcon } from './mobileMenuIcons';

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
  if (header.logoMode === 'light') return header.logoLight || header.logoDark || fallback;
  if (header.logoMode === 'dark') return header.logoDark || header.logoLight || fallback;
  const bg = String(header.bgColor || '').trim();
  if (!HEX_COLOR.test(bg)) return header.logoLight || header.logoDark || fallback;
  return isDarkHeaderBackground(bg)
    ? header.logoLight || header.logoDark || fallback
    : header.logoDark || header.logoLight || fallback;
}

export const HEADER_FONT_PRESETS = {
  classic: {
    label: 'Editorial', description: 'Serif de revista.',
    family: '"Playfair Display", Georgia, serif', weight: 500, style: 'normal', spacing: '-0.02em', transform: 'none',
  },
  modern: {
    label: 'Condensado', description: 'Trazo estrecho en mayúsculas.',
    family: '"Barlow Condensed", "Arial Narrow", sans-serif', weight: 600, style: 'normal', spacing: '0.08em', transform: 'uppercase',
  },
  elegant: {
    label: 'Firma', description: 'Caligrafía fluida.',
    family: '"Dancing Script", cursive', weight: 600, style: 'normal', spacing: '0', transform: 'none',
  },
  cute: {
    label: 'Atelier', description: 'Monoespaciada de estudio.',
    family: '"IBM Plex Mono", ui-monospace, monospace', weight: 500, style: 'normal', spacing: '-0.035em', transform: 'none',
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

export function resolveHeaderSurface(header = {}) {
  const shape = header.surfaceShape === 'floating' ? 'floating' : 'attached';
  const radiusValue = Number(header.cornerRadiusPx ?? 16);
  const radius = Number.isFinite(radiusValue) ? Math.max(0, Math.min(48, radiusValue)) : 16;
  const strengthValue = Number(header.glassStrength ?? 75);
  const strength = Number.isFinite(strengthValue) ? Math.max(0, Math.min(100, strengthValue)) : 75;
  const opacityValue = Number(header.bgOpacity ?? 1);
  const opacity = Number.isFinite(opacityValue) ? Math.max(0, Math.min(1, opacityValue)) : 1;
  const glass = header.liquidGlassEnabled === true;

  return {
    shape,
    glass,
    opacity: glass ? Math.min(opacity, 0.62) : opacity,
    style: {
      '--header-surface-radius': `${radius}px`,
      '--header-glass-blur': `${Math.round(16 + strength * 0.2)}px`,
      '--header-glass-saturation': `${(1.25 + strength * 0.008).toFixed(2)}`,
      '--header-glass-shine': `${(0.3 + strength * 0.005).toFixed(2)}`,
    },
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
    return name && destination ? [{ name, ...destination, icon: normalizeMobileMenuIcon(item?.icon) }] : [];
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
