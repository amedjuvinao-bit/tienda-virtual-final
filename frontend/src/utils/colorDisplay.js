// frontend/src/utils/colorDisplay.js

const NAMED_COLOR_LABELS = {
  black: 'Negro',
  white: 'Blanco',
  red: 'Rojo',
  blue: 'Azul',
  yellow: 'Amarillo',
  green: 'Verde',
  pink: 'Rosado',
  hotpink: 'Fucsia',
  fuchsia: 'Fucsia',
  crimson: 'Rojo intenso',
  salmon: 'Salmón',
  skyblue: 'Celeste',
  royalblue: 'Azul rey',
  navy: 'Azul marino',
  teal: 'Verde azulado',
  turquoise: 'Turquesa',
  seagreen: 'Verde mar',
  limegreen: 'Verde lima',
  olive: 'Oliva',
  khaki: 'Caqui',
  coral: 'Coral',
  chocolate: 'Chocolate',
  sienna: 'Marrón',
  gray: 'Gris',
  grey: 'Gris',
  lightgray: 'Gris claro',
  gold: 'Dorado',
  purple: 'Morado',
  lilac: 'Lila',
  beige: 'Beige',
  brown: 'Café',
  orange: 'Naranja',
};

const HEX_COLOR_LABELS = {
  '#000000': 'Negro',
  '#ffffff': 'Blanco',
  '#ff0000': 'Rojo',
  '#0000ff': 'Azul',
  '#ffff00': 'Amarillo',
  '#008000': 'Verde',
  '#ffc0cb': 'Rosado',
  '#ff69b4': 'Fucsia',
  '#d4af37': 'Dorado',
  '#f5f5dc': 'Beige',
  '#a52a2a': 'Café',
  '#ffa500': 'Naranja',
  '#808080': 'Gris',
  '#87ceeb': 'Celeste',

  '#ffcdd2': 'Rosado claro',
  '#f8bbd0': 'Rosa suave',
  '#e1bee7': 'Lila claro',
  '#d1c4e9': 'Lavanda',
  '#c5cae9': 'Azul lavanda',
  '#bbdefb': 'Azul claro',
  '#b2ebf2': 'Celeste claro',
  '#b2dfdb': 'Turquesa claro',
  '#c8e6c9': 'Verde claro',
  '#dcedc8': 'Verde pastel',
  '#fff9c4': 'Amarillo claro',
  '#ffe0b2': 'Durazno claro',
  '#ffccbc': 'Salmón claro',
  '#d7ccc8': 'Arena',
  '#f48fb1': 'Rosado intenso',
  '#ce93d8': 'Morado claro',
  '#9fa8da': 'Azul violeta',
  '#90caf9': 'Azul cielo',
  '#80deea': 'Celeste',
  '#80cbc4': 'Turquesa',
  '#a5d6a7': 'Verde menta',
  '#e6ee9c': 'Lima claro',
  '#ffe082': 'Amarillo dorado',
  '#ffab91': 'Coral claro',
};

export function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || '').trim());
}

export function normalizeHexColor(value) {
  const raw = String(value || '').trim();
  if (!isHexColor(raw)) return '';

  if (raw.length === 4) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }

  return raw.toLowerCase();
}

function hexToRgb(value) {
  const hex = normalizeHexColor(value).replace('#', '');
  if (!hex) return null;
  const int = Number.parseInt(hex, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: lightness };

  const delta = max - min;
  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);

  let hue;
  if (max === rn) hue = (gn - bn) / delta + (gn < bn ? 6 : 0);
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;

  return { h: hue * 60, s: saturation, l: lightness };
}

function approximateColorName(value) {
  const rgb = hexToRgb(value);
  if (!rgb) return '';

  const { h, s, l } = rgbToHsl(rgb);

  if (l <= 0.12) return 'Negro';
  if (l >= 0.92 && s <= 0.16) return 'Blanco';
  if (s <= 0.12) return l < 0.55 ? 'Gris oscuro' : 'Gris claro';

  const tone = l >= 0.78 ? ' claro' : l <= 0.32 ? ' oscuro' : '';

  if (h < 15 || h >= 345) return `Rojo${tone}`;
  if (h < 35) return `Naranja${tone}`;
  if (h < 55) return `Dorado${tone}`;
  if (h < 70) return `Amarillo${tone}`;
  if (h < 155) return `Verde${tone}`;
  if (h < 185) return `Turquesa${tone}`;
  if (h < 210) return `Celeste${tone}`;
  if (h < 250) return `Azul${tone}`;
  if (h < 285) return `Morado${tone}`;
  if (h < 325) return `Rosado${tone}`;
  return `Fucsia${tone}`;
}

export function getColorDisplayName(value) {
  if (value && typeof value === 'object') {
    const explicitName = value.name || value.label || value.title;
    if (explicitName && !isHexColor(explicitName)) return String(explicitName).trim();
    return getColorDisplayName(value.hex || value.value || value.color || '');
  }

  const raw = String(value || '').trim();
  if (!raw) return '';

  const lower = raw.toLowerCase();
  if (NAMED_COLOR_LABELS[lower]) return NAMED_COLOR_LABELS[lower];

  const hex = normalizeHexColor(raw);
  if (hex) return HEX_COLOR_LABELS[hex] || approximateColorName(hex) || 'Color personalizado';

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function getColorVisualValue(value) {
  if (value && typeof value === 'object') {
    return value.hex || value.value || value.color || value.name || '';
  }
  return String(value || '').trim();
}

export function buildColorOption(value) {
  const visual = getColorVisualValue(value);
  return {
    value: visual,
    label: getColorDisplayName(value),
    visual,
  };
}
