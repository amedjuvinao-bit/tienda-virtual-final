import React from "react";
import PolishedGlassRim from "../PolishedGlassRim";
export function cartVariables(config) {
  const { style: s, presentation: p } = config;
  const shadow = {
    soft: [8, 24, 14],
    medium: [14, 36, 20],
    strong: [24, 56, 28],
  }[s.shadowStyle] || [8, 24, 14];
  return {
    "--cart-ink": s.textPrimaryColor,
    "--cart-muted": s.textSecondaryColor,
    "--cart-accent": s.accentColor,
    "--cart-tint": s.cardBg,
    "--cart-light": s.cardBorderColor,
    "--cart-radius": `${s.cardRadiusPx}px`,
    "--cart-padding": `${s.cardPaddingPx}px`,
    "--cart-blur": `${p.glassBlur}px`,
    "--cart-alpha": `${p.glassOpacity * 100}%`,
    "--cart-label": s.tableHeaderTextColor,
    "--cart-qty-bg": s.quantityButtonBg,
    "--cart-line": s.tableLineColor,
    "--cart-image-w": `${s.imageWidthPx}px`,
    "--cart-image-h": `${s.imageHeightPx}px`,
    "--cart-image-radius": `${s.imageRadiusPx}px`,
    "--cart-edge": `${p.borderWidth}px`,
    "--cart-shadow":
      s.shadowStyle === "none"
        ? "none"
        : `0 ${shadow[0]}px ${shadow[1]}px -16px color-mix(in srgb, ${s.textPrimaryColor} ${shadow[2]}%, transparent)`,
    "--pg-highlight": s.cardBorderColor,
    "--pg-edge": s.accentColor,
  };
}
export function CartGlass({ config, className = "", children, ...rest }) {
  return (
    <section {...rest} className={`cart-glass ${className}`}>
      {children}
      <PolishedGlassRim
        radius={config.style.cardRadiusPx}
        width={config.presentation.borderWidth}
        reflection={config.presentation.reflection}
      />
    </section>
  );
}
