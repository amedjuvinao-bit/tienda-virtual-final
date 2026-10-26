import { cartVariables } from "../cart/CartMaterial";
export function memoryStyle(config) {
  const j = config.journal,
    s = config.style,
    p = config.presentation;
  return {
    ...cartVariables(config),
    "--memory-radius": `${j.photoRadiusPx}px`,
    "--memory-height": `${j.boardHeightPx}px`,
    "--memory-shadow": `${j.photoShadow * 100}%`,
    "--memory-title-color": s.titleTextColor,
    "--memory-body-size": `${s.bodyFontSizePx}px`,
    "--memory-heading":
      j.headingFont === "theme"
        ? "var(--font-headings, Georgia, serif)"
        : '"Memory Editorial", Georgia, serif',
    "--service-button-bg": s.buttonBg,
    "--service-button-ink": s.buttonTextColor,
    "--service-button-edge": s.buttonBorderColor,
    "--service-button-radius": `${s.buttonRadiusPx}px`,
    "--service-button-alpha": `${p.checkoutGlassOpacity * 100}%`,
    "--service-button-blur": `${p.checkoutGlassBlur}px`,
  };
}
