// src/theme/applyTheme.js

export function applyTheme(theme) {
  try {
    if (!theme || typeof theme !== "object") return;

    const root = document.documentElement;

    const set = (name, value) => {
      if (value !== undefined && value !== null && value !== "") {
        root.style.setProperty(name, String(value));
      }
    };

    const clamp01 = (n, fallback = 1) => {
      const x = Number(n);
      if (Number.isNaN(x)) return fallback;
      return Math.max(0, Math.min(1, x));
    };

    const isHex = (v) =>
      typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

    const hexToRgb = (hex) => {
      if (!isHex(hex)) return "255, 215, 234"; // fallback rosado
      let h = hex.replace("#", "").trim();
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    };

    const colors = theme.colors || {};
    const fonts = theme.fonts || {};
    const header = theme.header || {};
    const home = theme.home || {};
    const footer = theme.footer || {};

    // 🎨 Colores globales
    set("--color-primary", colors.primary || "#111827");
    set("--color-secondary", colors.secondary || "#4b5563");
    set("--color-text", colors.text || "#111827");
    set("--color-bg", colors.background || "#ffffff");
    set("--color-accent", colors.accent || "#ef4444");

    // 🅰️ Tipografías globales
    const baseFont =
      fonts.base ||
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    const headingsFont =
      fonts.headings ||
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    set("--font-base", baseFont);
    set("--font-headings", headingsFont);
    set("--font-size-base", String(fonts.fontSize || 16) + "px");
    set("--line-height-base", String(fonts.lineHeight || 1.6));

    // 🔝 HEADER
    const bg = header.bgColor || "#FFE3EC";
    const bgOpacity = clamp01(header.bgOpacity, 1);

    // Menú
    const menuText = header.textColor || "#111827";
    const menuHover = header.linkColor || "#c2410c";

    // Íconos (independiente)
    const iconColor = header.iconColor || "#111827";
    const iconHover = header.iconHoverColor || "#c2410c";

    // Tipografía del header (preset o custom)
    const preset = (header.fontPreset || "").trim();
    const presetMap = {
      classic: '"Playfair Display", Georgia, serif',
      modern: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
      elegant: '"Cormorant Garamond", Georgia, serif',
      cute: '"Baloo 2", system-ui, sans-serif',
    };

    const headerFontFamily =
      (header.fontFamily && header.fontFamily.trim()) ||
      (presetMap[preset] || "") ||
      headingsFont ||
      baseFont;

    const headerFontSizePx = Number(header.fontSizePx || 16);

    // ✅ Fondo con alpha real
    set("--header-bg", bg);
    set("--header-bg-rgb", hexToRgb(bg));
    set("--header-bg-opacity", String(bgOpacity));
    set("--header-bg-alpha", String(bgOpacity)); // ✅ compatibilidad con CSS actual (usa --header-bg-alpha)

    // ✅ Variables para menú / íconos separados
    set("--header-menu-text", menuText);
    set("--header-menu-hover", menuHover);
    set("--header-icon-color", iconColor);
    set("--header-icon-hover", iconHover);

    set("--header-font-family", headerFontFamily);
    set(
      "--header-font-size",
      String(Number.isNaN(headerFontSizePx) ? 16 : headerFontSizePx) + "px"
    );

    // ✅ Animación (menú)
    const menuAnim = (header.menuAnimation || "soft").trim();
    const setMenuAnim = (cfg) => {
      set("--header-menu-hover-scale", cfg.scale);
      set("--header-menu-hover-ty", cfg.ty);
      set("--header-menu-hover-rot", cfg.rot);
      set("--header-menu-hover-glow", cfg.glow);
    };

    if (menuAnim === "none")
      setMenuAnim({ scale: 1, ty: "0px", rot: "0deg", glow: "0px" });
    else if (menuAnim === "float")
      setMenuAnim({ scale: 1.06, ty: "-2px", rot: "0deg", glow: "10px" });
    else if (menuAnim === "rotate")
      setMenuAnim({ scale: 1.05, ty: "0px", rot: "-3deg", glow: "10px" });
    else if (menuAnim === "pop")
      setMenuAnim({ scale: 1.14, ty: "0px", rot: "0deg", glow: "14px" });
    else setMenuAnim({ scale: 1.1, ty: "0px", rot: "0deg", glow: "8px" }); // soft default

    // ✅ Animación (íconos)
    const iconAnim = (header.iconAnimation || "soft").trim();
    const setIconAnim = (cfg) => {
      set("--header-icon-hover-scale", cfg.scale);
      set("--header-icon-hover-ty", cfg.ty);
      set("--header-icon-hover-rot", cfg.rot);
      set("--header-icon-hover-glow", cfg.glow);
    };

    if (iconAnim === "none")
      setIconAnim({ scale: 1, ty: "0px", rot: "0deg", glow: "0px" });
    else if (iconAnim === "float")
      setIconAnim({ scale: 1.08, ty: "-2px", rot: "0deg", glow: "10px" });
    else if (iconAnim === "rotate")
      setIconAnim({ scale: 1.06, ty: "0px", rot: "6deg", glow: "10px" });
    else if (iconAnim === "pop")
      setIconAnim({ scale: 1.15, ty: "0px", rot: "0deg", glow: "14px" });
    else setIconAnim({ scale: 1.1, ty: "0px", rot: "0deg", glow: "8px" }); // soft default

    // 🏠 HOME
    set("--home-bg-image", home.bgImage || "");
    set("--home-text-color", home.textColor || colors.text || "#111827");

    // 🔻 FOOTER
    set("--footer-bg", footer.bgColor || colors.primary || "#111827");
    set("--footer-text", footer.textColor || "#ffffff");
  } catch (err) {
    console.error("Error aplicando tema en applyTheme:", err);
  }
}