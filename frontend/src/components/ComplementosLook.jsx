import React, { useMemo } from 'react';
import { ArrowRight, ChevronRight, ChevronsRight, MoveRight, Sparkles, Flower2 } from 'lucide-react';
import { COMPLEMENTOS_SECTION_DEFAULTS, normalizeComplementosSection, safeComplementosHref } from '../admin/appearance/sections/complementos/complementosSectionHelpers';
import './complementosLook.css';

function Arrow({ variant }) {
  const props = { size: 20, 'aria-hidden': true };
  if (variant === 'none') return null;
  if (variant === 'chevron-right') return <ChevronRight {...props} />;
  if (variant === 'double-chevron') return <ChevronsRight {...props} />;
  if (variant === 'long-arrow' || variant === 'minimal-line') return <MoveRight {...props} />;
  if (variant === 'spark-arrow') return <><Sparkles size={16} aria-hidden="true" /><ArrowRight {...props} /></>;
  return <ArrowRight {...props} />;
}

export default function ComplementosLook({ theme, imageSrc }) {
  const section = useMemo(() => {
    const entries = Array.isArray(theme?.sections) ? theme.sections : [];
    const found = entries.find((s) => [s?.id, s?.type].some((value) => typeof value === 'string' && value.trim().toLowerCase() === 'complementos'));
    return normalizeComplementosSection(found || {
      ...COMPLEMENTOS_SECTION_DEFAULTS,
      config: { ...COMPLEMENTOS_SECTION_DEFAULTS.config, ...(imageSrc ? { imageSrc } : {}) },
    });
  }, [theme, imageSrc]);
  const { config: c, style: s } = section;
  if (!section.enabled) return null;
  const vars = {
    '--comp-margin': `${s.sectionMarginTopPx}px`, '--comp-padding': `${s.sectionPaddingXPx}px`,
    '--comp-max': `${s.contentMaxWidthPx}px`, '--comp-width': `${s.imageWidthPercent}%`,
    '--comp-height': `${s.imageHeightPx}px`, '--comp-radius': `${s.imageRadiusPx}px`,
    '--comp-bg': s.bannerBg, '--comp-image-fit': s.imageObjectFit,
    '--comp-position': `${s.imagePositionX}% ${s.imagePositionY}%`,
    '--comp-image-border': `${s.imageBorderPx}px solid ${s.imageBorderColor}`,
    '--comp-ring': `${s.ringWidthPx}px solid ${s.ringColor}`,
    '--comp-shadow': s.imageShadow ? '0 18px 40px #6e254820' : 'none',
    '--comp-title': s.titleColor, '--comp-subtitle': s.subtitleColor,
    '--comp-font': s.titleFontFamily, '--comp-title-size': `${s.titleFontSizePx}px`,
    '--comp-title-weight': s.titleWeight, '--comp-subtitle-size': `${s.subtitleFontSizePx}px`,
    '--comp-tracking': `${s.subtitleLetterSpacingPx}px`, '--comp-content-width': `${s.contentWidthPercent}%`,
    '--comp-content-padding': `${s.contentPaddingPx}px`, '--comp-gap': `${s.contentGapPx}px`,
    '--comp-align': s.contentAlign, '--comp-frame-inset': `${s.frameInsetPx}px`,
    '--comp-frame-color': s.frameColor, '--comp-frame-width': `${s.frameWidthPx}px`,
    '--comp-frame-opacity': s.frameOpacity / 100, '--comp-panel-tint': `${s.panelTintPercent}%`,
    '--comp-panel-blur': `${s.panelBlurPx}px`, '--comp-overlay': s.overlayColor,
    '--comp-overlay-opacity': s.overlayOpacity / 100,
    '--comp-button-bg': s.buttonBg, '--comp-button-color': s.buttonTextColor,
    '--comp-button-hover-bg': s.buttonHoverBg, '--comp-button-hover-color': s.buttonHoverTextColor,
    '--comp-button-tint': `${s.buttonTintPercent}%`, '--comp-button-hover-tint': `${Math.min(100, s.buttonTintPercent + 6)}%`,
    '--comp-button-blur': `${s.buttonBlurPx}px`, '--comp-button-border': `${s.buttonBorderPx}px solid ${s.buttonBorderColor}`,
    '--comp-button-radius': `${s.buttonRadiusPx}px`, '--comp-button-size': `${s.buttonFontSizePx}px`,
    '--comp-button-weight': s.buttonFontWeight, '--comp-button-px': `${s.buttonPx}px`,
    '--comp-button-py': `${s.buttonPy}px`, '--comp-button-gap': `${s.buttonGapPx}px`,
    '--comp-button-scale': s.buttonHoverScale,
    '--comp-button-shadow': s.buttonShadow ? '0 6px 18px #752b3d25' : 'none',
    '--comp-button-hover-shadow': s.buttonHoverShadow ? '0 10px 24px #752b3d35' : 'none',
    '--comp-mobile-height': `${s.mobileHeightPx}px`, '--comp-mobile-title-size': `${s.mobileTitleFontSizePx}px`,
    '--comp-mobile-subtitle-size': `${s.mobileSubtitleFontSizePx}px`,
    '--comp-mobile-button-size': `${s.mobileButtonFontSizePx}px`,
    '--comp-mobile-content-padding': `${s.mobileContentPaddingPx}px`,
    '--comp-mobile-padding': `${s.mobileSectionPaddingXPx}px`, '--comp-mobile-radius': `${s.mobileImageRadiusPx}px`,
    '--comp-mobile-position': `${s.mobileImagePositionX}% ${s.mobileImagePositionY}%`,
    '--comp-mobile-fit': s.mobileImageObjectFit,
  };
  return <section className="complementos-look-section" style={vars} aria-label="Complementos">
    <div className="complementos-look-container">
      <div className={`complementos-banner complementos-banner--${s.layout}`} data-content-position={s.contentPosition} data-mobile-position={s.mobileContentPosition}>
        <img className="complementos-look-image complementos-image--desktop" src={c.imageSrc} alt={c.imageAlt} loading="lazy" decoding="async" />
        <img className="complementos-look-image complementos-image--mobile" src={c.mobileImageSrc || c.imageSrc} alt={`${c.imageAlt} (móvil)`} loading="lazy" decoding="async" />
        <div className="complementos-banner__overlay" aria-hidden="true" />
        {s.frameEnabled && <div className="complementos-banner__frame" aria-hidden="true" />}
        <div className="complementos-banner__content">
          {c.titleEnabled && c.title && <h2 className="complementos-banner__title">{c.title}</h2>}
          {c.dividerEnabled && <div className="complementos-banner__divider" aria-hidden="true"><span /><Flower2 size={20} strokeWidth={1} /><span /></div>}
          {c.subtitleEnabled && c.subtitle && <p className="complementos-banner__subtitle">{c.subtitle}</p>}
          {c.buttonEnabled && <a className={`complementos-look-button complementos-button--${s.buttonAnimation}`} href={safeComplementosHref(c.linkHref)}>
            <span>{c.buttonText}</span><Arrow variant={s.buttonArrowStyle} />
          </a>}
        </div>
      </div>
    </div>
  </section>;
}
