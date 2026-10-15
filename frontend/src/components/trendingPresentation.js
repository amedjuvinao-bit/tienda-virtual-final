export const DEFAULT_TRENDING_PRESENTATION = Object.freeze({
  mode: "classic",
  backgroundColor: "#fff8f6",
  backgroundImage: "",
  backdropMode: "boutique",
  glowColor: "#f4b5cc",
  glowStrength: 0.24,
  glassColor: "#fffaf7",
  glassOpacity: 0.68,
  blurPx: 18,
  borderColor: "#dbad81",
  borderOpacity: 0.68,
  borderWidthPx: 1,
  shadowStrength: 0.28,
  imageRadiusPx: 26,
  imageHeightPx: 360,
  dockRadiusPx: 22,
  dockGapPx: 10,
  dockPaddingPx: 12,
  hoverLiftPx: 7,
  actionColor: "#d83d77",
  actionBackgroundColor: "#fffaf8",
  actionSizePx: 36,
  cardTitleColor: "#35242a",
  cardPriceColor: "#a35b1d",
  cardMetaColor: "#66464d",
  cardDescColor: "#725a60",
  cardMutedColor: "#85757b",
  productTitleSizePx: 13,
  priceSizePx: 14,
  oldPriceSizePx: 10,
  metaSizePx: 10,
  descSizePx: 10,
  showDescription: false,
  showWatermark: false,
  ornamentEnabled: true,
  titleMode: "text",
  titleColor: "#ab5264",
  titleSizePx: 52,
  titleFontFamily: "Georgia, serif",
});

const validHex = (value) => typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
const bounded = (value, fallback, min, max) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export function normalizeTrendingPresentation(raw) {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const defaults = DEFAULT_TRENDING_PRESENTATION;
  const result = { mode: input.mode === "floatingGlass" ? "floatingGlass" : "classic" };
  for (const key of ["backgroundColor", "glowColor", "glassColor", "borderColor", "actionColor", "actionBackgroundColor", "cardTitleColor", "cardPriceColor", "cardMetaColor", "cardDescColor", "cardMutedColor"]) {
    result[key] = validHex(input[key]) ? input[key] : defaults[key];
  }
  result.backgroundImage = typeof input.backgroundImage === "string" && /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i.test(input.backgroundImage)
    ? input.backgroundImage : "";
  result.backdropMode = ["boutique", "color", "custom"].includes(input.backdropMode) ? input.backdropMode : result.backgroundImage ? "custom" : defaults.backdropMode;
  for (const [key, min, max] of [
    ["glowStrength", 0, 1], ["glassOpacity", 0.25, 1], ["blurPx", 0, 40],
    ["borderOpacity", 0, 1], ["borderWidthPx", 0, 4], ["shadowStrength", 0, 1],
    ["imageRadiusPx", 0, 60], ["imageHeightPx", 240, 600], ["dockRadiusPx", 0, 60],
    ["dockGapPx", 0, 30], ["dockPaddingPx", 8, 30], ["hoverLiftPx", 0, 18],
    ["actionSizePx", 28, 52], ["productTitleSizePx", 10, 20],
    ["priceSizePx", 10, 22], ["oldPriceSizePx", 8, 15],
    ["metaSizePx", 8, 18], ["descSizePx", 8, 18],
  ]) result[key] = bounded(input[key], defaults[key], min, max);
  result.ornamentEnabled = typeof input.ornamentEnabled === "boolean" ? input.ornamentEnabled : defaults.ornamentEnabled;
  result.showWatermark = typeof input.showWatermark === "boolean" ? input.showWatermark : defaults.showWatermark;
  result.showDescription = typeof input.showDescription === "boolean" ? input.showDescription : defaults.showDescription;
  result.titleMode = input.titleMode === "image" ? "image" : "text";
  result.titleColor = validHex(input.titleColor) ? input.titleColor : defaults.titleColor;
  result.titleSizePx = bounded(input.titleSizePx, defaults.titleSizePx, 20, 80);
  result.titleFontFamily = typeof input.titleFontFamily === "string" && input.titleFontFamily.length <= 110
    ? input.titleFontFamily : defaults.titleFontFamily;
  return result;
}

export function hexToRgbTriplet(value) {
  const hex = validHex(value) ? value.slice(1) : "ffffff";
  const expanded = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  return [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16)).join(", ");
}

export function trendingPresentationVars(value) {
  const config = normalizeTrendingPresentation(value);
  return {
    "--trending-background": config.backgroundColor,
    "--trending-glow-rgb": hexToRgbTriplet(config.glowColor),
    "--trending-glow-strength": config.glowStrength,
    "--trending-glass-rgb": hexToRgbTriplet(config.glassColor),
    "--trending-glass-opacity": config.glassOpacity,
    "--trending-blur": `${config.blurPx}px`,
    "--trending-border-rgb": hexToRgbTriplet(config.borderColor),
    "--trending-border-opacity": config.borderOpacity,
    "--trending-border-width": `${config.borderWidthPx}px`,
    "--trending-shadow-strength": config.shadowStrength,
    "--trending-image-radius": `${config.imageRadiusPx}px`,
    "--trending-dock-radius": `${config.dockRadiusPx}px`,
    "--trending-dock-gap": `${config.dockGapPx}px`,
    "--trending-dock-padding": `${config.dockPaddingPx}px`,
    "--trending-hover-lift": `${config.hoverLiftPx}px`,
    "--trending-action-color": config.actionColor,
    "--trending-action-background-rgb": hexToRgbTriplet(config.actionBackgroundColor),
    "--trending-action-size": `${config.actionSizePx}px`,
  };
}
