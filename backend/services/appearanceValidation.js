'use strict';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const hex = value => typeof value === 'string' && /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value);

// Validate the submitted patch, including the native-driver persistence branch.
// Flexible section configurations remain extensible, but must be bounded JSON.
function validateAppearanceInput({ theme, menus } = {}) {
  let nodes = 0;
  function inspect(value, path = '', depth = 0) {
    if (++nodes > 15000 || depth > 20) return 'La configuración supera la complejidad permitida.';
    if (typeof value === 'number' && !Number.isFinite(value)) return `${path}: número inválido.`;
    if (typeof value === 'string' && value.length > 12000) return `${path}: texto demasiado largo.`;
    if (Array.isArray(value)) {
      if (value.length > 500) return `${path}: demasiados elementos.`;
      for (let i = 0; i < value.length; i++) { const error = inspect(value[i], `${path}.${i}`, depth + 1); if (error) return error; }
    } else if (isObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (key.includes('.') || key.startsWith('$') || ['__proto__', 'constructor', 'prototype'].includes(key)) return 'La configuración contiene una clave no permitida.';
        const error = inspect(child, path ? `${path}.${key}` : key, depth + 1); if (error) return error;
      }
    }
    return null;
  }
  const structuralError = inspect({ theme, menus });
  if (structuralError) return structuralError;
  if (theme !== undefined && !isObject(theme)) return 'theme debe ser un objeto.';
  if (menus !== undefined && !isObject(menus)) return 'menus debe ser un objeto.';
  for (const key of ['colors', 'fonts', 'header', 'banner', 'global', 'footer', 'radius', 'spacing', 'logo']) {
    if (own(theme, key) && !isObject(theme[key])) return `theme.${key} debe ser un objeto.`;
  }
  const t = theme || {};
  function range(object, key, min, max, label, integer = false) {
    if (!own(object, key)) return null;
    const value = object[key];
    return typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))
      ? `${label}.${key} debe estar entre ${min} y ${max}.` : null;
  }
  function choices(object, key, allowed, label) {
    return own(object, key) && !allowed.includes(object[key]) ? `${label}.${key} no es válido.` : null;
  }
  function booleans(object, keys, label) {
    for (const key of keys) if (own(object, key) && typeof object[key] !== 'boolean') return `${label}.${key} debe ser verdadero o falso.`;
    return null;
  }
  const checks = [];
  for (const [key, value] of Object.entries(t.colors || {})) if (value !== '' && !hex(value)) return `Color general inválido: ${key}.`;
  for (const [key, value] of Object.entries(t.header || {})) {
    if (/Color$/.test(key) && value !== '' && !hex(value)) return `Color de encabezado inválido: ${key}.`;
  }
  const h = t.header || {}, b = t.banner || {}, f = t.fonts || {};
  for (const [key, min, max] of [['bgOpacity',0,1],['logoHeightPx',30,160],['cornerRadiusPx',0,48],['glassStrength',0,100],['fontSizePx',8,96],['mobileMenuOverlayOpacity',0,1],['mobileMenuAnimationDurationMs',120,1200],['mobileMenuWidthPercent',60,100]]) checks.push(range(h,key,min,max,'Encabezado'));
  checks.push(choices(h,'surfaceShape',['attached','floating'],'Encabezado'),choices(h,'logoMode',['auto','light','dark'],'Encabezado'));
  checks.push(booleans(h,['metallicMenuText','liquidGlassEnabled'],'Encabezado'));
  checks.push(range(f,'fontSize',8,72,'Tipografía'),range(f,'lineHeight',0.5,4,'Tipografía'));
  for (const key of ['sm','md','lg']) checks.push(range(t.radius,key,0,200,'Radios'));
  checks.push(range(t.spacing,'base',0,100,'Espaciado'));
  checks.push(choices(b,'type',['slider','image','video'],'Portada'),choices(b,'templateId',['plain','classic','discovery','editorial','atelier'],'Portada'));
  for (const prefix of ['', 'tablet', 'mobile']) {
    const mode = prefix ? `${prefix}HeightMode` : 'heightMode', height = prefix ? `${prefix}HeightPx` : 'heightPx';
    checks.push(choices(b,mode,['auto','fullscreen'],'Portada'),range(b,height,240,1200,'Portada'));
  }
  checks.push(range(b,'autoplayMs',1000,15000,'Portada'));
  checks.push(booleans(b,['sliderShowProgress','sliderShowCounter','sliderShowControls','videoAutoplay','videoMuted','videoLoop'],'Portada'));
  const motion = t.global?.sectionMotion;
  if (motion !== undefined) {
    if (!isObject(motion)) return 'La animación global debe ser un objeto.';
    checks.push(range(motion,'intensity',20,100,'Animación'),choices(motion,'preset',['stack','cinema','depth','cascade'],'Animación'),choices(motion,'experience',['entrances','journey'],'Animación'),choices(motion,'pace',['quick','balanced','leisurely'],'Animación'),choices(motion,'mobileMode',['adapted','same','off'],'Animación'),booleans(motion,['enabled'],'Animación'));
  }
  if (own(b,'slides')) {
    if (!Array.isArray(b.slides) || b.slides.length > 100) return 'La portada admite hasta 100 diapositivas.';
    for (const slide of b.slides) {
      if (!isObject(slide) || typeof slide.image !== 'string' || !slide.image.trim()) return 'Cada diapositiva debe tener una imagen.';
      for (const key of ['posX','posY','tabletPosX','tabletPosY','mobilePosX','mobilePosY']) checks.push(range(slide,key,0,100,'Diapositiva'));
    }
  }
  if (own(t,'sections')) {
    if (!Array.isArray(t.sections) || t.sections.length > 100) return 'Las secciones deben ser una lista de hasta 100 elementos.';
    const ids = new Set();
    for (const section of t.sections) {
      if (!isObject(section) || typeof section.id !== 'string' || !section.id.trim() || ids.has(section.id)) return 'Cada sección debe tener un identificador único.';
      ids.add(section.id);
      if (own(section,'config') && !isObject(section.config)) return 'La configuración de una sección debe ser un objeto.';
      if (own(section,'style') && !isObject(section.style)) return 'El estilo de una sección debe ser un objeto.';
      checks.push(booleans(section,['enabled'],section.id));
    }
  }
  for (const key of ['header','footer','social']) if (own(menus,key)) {
    if (!Array.isArray(menus[key]) || menus[key].length > 100) return 'Los menús deben tener hasta 100 enlaces.';
    for (const item of menus[key]) {
      if (!isObject(item)) return 'Cada enlace del menú debe ser un objeto.';
      const target = item.ref || item.href || '';
      if (typeof target !== 'string' || /^(?:javascript|data|vbscript):/i.test(target.trim()) || /[\u0000-\u001f]/.test(target)) return 'El destino del menú no es válido.';
    }
  }
  return checks.find(Boolean) || null;
}

module.exports = { validateAppearanceInput };
