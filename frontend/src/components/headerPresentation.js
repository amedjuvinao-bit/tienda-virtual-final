const HEX_COLOR = /^#([\da-f]{3}|[\da-f]{6})$/i;

export function resolveHeaderLogo(header = {}, fallback = '/LOGO1.png') {
  const bg = String(header.bgColor || '').trim();
  if (!HEX_COLOR.test(bg)) return header.logoLight || header.logoDark || fallback;
  const digits = bg.slice(1).length === 3
    ? [...bg.slice(1)].map((digit) => digit + digit).join('')
    : bg.slice(1);
  const [red, green, blue] = [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue < 140
    ? header.logoLight || header.logoDark || fallback
    : header.logoDark || header.logoLight || fallback;
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
