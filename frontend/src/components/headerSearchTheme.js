import { isDarkHeaderBackground } from './headerPresentation';

const safeHex = (value) => typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.trim()) ? value.trim() : '';

function luminance(hex) {
  const digits = hex.length === 4 ? [...hex.slice(1)].map((digit) => digit.repeat(2)).join('') : hex.slice(1);
  const channels = [0, 2, 4].map((index) => parseInt(digits.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function readableColor(candidate, background, minimumContrast) {
  const foreground = safeHex(candidate);
  if (!foreground) return '';
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05) >= minimumContrast ? foreground : '';
}

export function resolveHeaderSearchColors(header = {}, colors = {}) {
  const background = safeHex(header.searchBgColor) || safeHex(header.bgColor) || safeHex(colors.background) || '#ffe3ec';
  const dark = isDarkHeaderBackground(background);
  return {
    background,
    text: safeHex(header.searchTextColor) || (dark ? '#ffffff' : '#542b41'),
    accent: safeHex(header.searchAccentColor) || readableColor(header.linkColor, background, 3) || readableColor(header.iconHoverColor, background, 3) || readableColor(colors.primary, background, 3) || (dark ? '#ffffff' : '#854968'),
    border: safeHex(header.searchBorderColor) || readableColor(header.iconColor, background, 1.5) || (dark ? '#eac4d4' : '#ffffff'),
  };
}

export function headerSearchColorVariables(header, colors) {
  const palette = resolveHeaderSearchColors(header, colors);
  return {
    '--header-search-bg': palette.background,
    '--header-search-text': palette.text,
    '--header-search-accent': palette.accent,
    '--header-search-border': palette.border,
  };
}
