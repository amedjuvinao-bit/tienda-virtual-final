import { validateHeaderMenu } from '../../components/headerPresentation';

export function validateAppearanceDraft({ theme, changedTheme, changedMenus }) {
      if (changedMenus.header) {
        const menuError = validateHeaderMenu(changedMenus.header);
        if (menuError) { return menuError; }
      }

      const hexOk = (v) => !v || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

      const c = theme.colors || {};
      if (changedTheme.colors && ![c.primary, c.secondary, c.text, c.background, c.accent].every(hexOk)) {
        return "Revisa que todos los colores generales sean hex válidos (#RRGGBB).";
      }

      const h = theme.header || {};
      const headerColorList = [
        h.bgColor,
        h.textColor,
        h.linkColor,
        h.searchBgColor,
        h.searchTextColor,
        h.searchAccentColor,
        h.searchBorderColor,
        h.iconColor,
        h.iconHoverColor,
        h.mobileMenuBgColor,
        h.mobileMenuTextColor,
        h.mobileMenuBorderColor,
        h.mobileMenuAccentColor,
        h.mobileMenuMutedColor,
        h.mobileMenuTitleColor,
        h.mobileMenuButtonBg,
        h.mobileMenuButtonTextColor,
        h.mobileMenuSecondaryButtonBg,
        h.mobileMenuSecondaryButtonTextColor,
        h.mobileMenuSocialBg,
        h.mobileMenuSocialIconColor,
        h.mobileMenuOverlayColor,
      ];

      if (changedTheme.header && !headerColorList.every(hexOk)) {
        return "Revisa que los colores del Header sean hex válidos (#RRGGBB).";
      }

      if (changedTheme.header && !['gold', 'wine', 'satin', 'porcelain'].includes(h.iconSet)) {
        return 'Selecciona un modelo válido para los íconos.';
      }
      if (changedTheme.header && (!Number.isInteger(h.iconSizePx) || h.iconSizePx < 28 || h.iconSizePx > 40)) {
        return 'El tamaño de los íconos debe estar entre 28 y 40 px.';
      }
      if (changedTheme.header && !Object.values(h.iconOverrides || {}).every((icons) =>
        Object.values(icons || {}).every((url) => !url || /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i.test(url))
      )) {
        return 'Carga las imágenes personalizadas en Cloudinary.';
      }

      const op = Number(h.bgOpacity);
      if (changedTheme.header && (Number.isNaN(op) || op < 0 || op > 1)) {
        return "La transparencia del header debe estar entre 0 y 1.";
      }

      const mobileOverlayOpacity = Number(h.mobileMenuOverlayOpacity);
      if (changedTheme.header && (
        Number.isNaN(mobileOverlayOpacity) ||
        mobileOverlayOpacity < 0 ||
        mobileOverlayOpacity > 1
      )) {
        return "La opacidad del overlay del menú móvil debe estar entre 0 y 1.";
      }

      const lh = Number(h.logoHeightPx);
      if (changedTheme.header && (Number.isNaN(lh) || lh < 30 || lh > 160)) {
        return "El tamaño del logo debe estar entre 30 y 160 px.";
      }

      if (changedTheme.header && !['attached', 'floating'].includes(h.surfaceShape)) {
        return 'Elige una forma válida para el encabezado.';
      }
      if (changedTheme.header && (h.liquidGlassEnabled !== true && h.liquidGlassEnabled !== false)) {
        return 'Revisa la opción de vidrio líquido.';
      }
      const cornerRadius = Number(h.cornerRadiusPx);
      const glassStrength = Number(h.glassStrength);
      if (changedTheme.header && (!Number.isFinite(cornerRadius) || cornerRadius < 0 || cornerRadius > 48 || !Number.isFinite(glassStrength) || glassStrength < 0 || glassStrength > 100)) {
        return 'El redondeo debe estar entre 0 y 48 px y la intensidad del vidrio entre 0 y 100%.';
      }

      const mobileAnimDuration = Number(h.mobileMenuAnimationDurationMs);
      if (changedTheme.header && (
        Number.isNaN(mobileAnimDuration) ||
        mobileAnimDuration < 120 ||
        mobileAnimDuration > 1200
      )) {
        return "La duración de animación del menú móvil debe estar entre 120 y 1200 ms.";
      }

      const mobileWidth = Number(h.mobileMenuWidthPercent);
      if (changedTheme.header && (Number.isNaN(mobileWidth) || mobileWidth < 60 || mobileWidth > 100)) {
        return "El ancho del menú móvil debe estar entre 60% y 100%.";
      }

      // ✅ Validación básica banner (tipo + altura + sliderInterval)
      const b = theme.banner || {};
      const bannerType = String(b.type || "slider");
      if (changedTheme.banner && !["slider", "image", "video"].includes(bannerType)) {
        return "El tipo de banner debe ser: slider, image o video.";
      }
      const hm = String(b.heightMode || "auto");
      if (changedTheme.banner && !["auto", "fullscreen"].includes(hm)) {
        return "El modo de altura del banner debe ser automático o pantalla completa.";
      }
      if (changedTheme.banner && hm === "auto") {
        const hp = Number(b.heightPx);
        if (Number.isNaN(hp) || hp < 240 || hp > 1200) {
          return "La altura del banner debe estar entre 240 y 1200 px.";
        }
      }
      for (const [label, modeKey, heightKey] of [
        ["tableta", "tabletHeightMode", "tabletHeightPx"],
        ["móvil", "mobileHeightMode", "mobileHeightPx"],
      ]) {
        if (!changedTheme.banner) break;
        const mode = b[modeKey] || "fullscreen";
        const height = Number(b[heightKey]);
        if (!["auto", "fullscreen"].includes(mode) || (mode === "auto" && (!Number.isFinite(height) || height < 240 || height > 1200))) {
          return `La altura de ${label} debe estar entre 240 y 1200 px o usar pantalla completa.`;
        }
      }
      if (changedTheme.banner && bannerType === "slider") {
        const iv = Number(b.sliderIntervalMs);
        if (Number.isFinite(iv) && (iv < 1000 || iv > 15000)) {
          return "El intervalo entre diapositivas debe estar entre 1000 y 15000 ms.";
        }
        const slides = Array.isArray(b.slides) ? b.slides : [];
        const bad = slides.find((s) => s && s.image === "");
        if (bad) {
          return "Cada diapositiva debe tener una imagen; elimina las que estén vacías.";
        }
      }

  return null;
}
