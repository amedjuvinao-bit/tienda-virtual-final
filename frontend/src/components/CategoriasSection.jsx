import React, { useMemo, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CATEGORIAS_SECTION_DEFAULTS, normalizeCategoriasSection } from '../admin/appearance/sections/categorias/categoriasSectionHelpers';
import { categoriasBackdrop, safeCategoryHref } from '../admin/appearance/sections/categorias/categoriasFanHelpers';
import CategoriaArtwork from './CategoriaArtwork';
import './categoriasFan.css';

function TitleImage({ src, alt, text }) {
  const [failed, setFailed] = useState(false);
  return !failed && src ? <img className="categories-fan__title-image" src={src} alt={alt || text} onError={() => setFailed(true)} /> : text;
}

export default function CategoriasSection({ theme }) {
  const section = useMemo(() => {
    const entries = Array.isArray(theme?.sections) ? theme.sections : [];
    return normalizeCategoriasSection(entries.find((item) => item?.id === 'categorias' || item?.type === 'categorias') || CATEGORIAS_SECTION_DEFAULTS);
  }, [theme]);
  const { config: c, style: s } = section;
  const visible = c.slides.filter((item) => item.enabled !== false);
  const [activeId, setActiveId] = useState(null);
  const root = useRef(null);
  if (!section.enabled || !visible.length) return null;
  const active = visible.find((item) => item.id === activeId);
  const backdrop = categoriasBackdrop(theme, c, s);
  const rows = [];
  for (let start = 0; start < visible.length; start += s.fanColumns) rows.push(visible.slice(start, start + s.fanColumns));
  const vars = {
    '--cat-scene-color': backdrop.color, '--cat-scene-image': backdrop.image ? `url(${JSON.stringify(backdrop.image)})` : 'none',
    '--cat-scene-wash': `${s.fanBackgroundWash}%`, '--cat-max': s.fanWidthMode === 'full' ? 'none' : `${s.sectionMaxWidthPx}px`,
    '--cat-section-min-height': s.fanSectionHeightMode === 'screen' ? '100vh' : s.fanSectionHeightMode === 'custom' ? `${s.fanSectionMinHeightPx}px` : '0px',
    '--cat-padding-top': `${s.sectionPaddingTopPx}px`, '--cat-padding-bottom': `${s.sectionPaddingBottomPx}px`,
    '--cat-padding-x': `${s.sectionPaddingXPx}px`, '--cat-title': s.fanTitleColor, '--cat-text': s.fanTextColor,
    '--cat-font': s.fanTitleFont || 'var(--font-headings, Georgia, serif)', '--cat-title-size': `${s.fanTitleSizePx}px`, '--cat-title-weight': s.fanTitleWeight,
    '--cat-label-size': `${s.fanLabelSizePx}px`, '--cat-gap': `${s.fanGapPx}px`, '--cat-height': `${s.fanHeightPx}px`,
    '--cat-hover-lift': `${s.fanHoverLiftPx}px`, '--cat-expand': s.fanExpand, '--cat-image-zoom': s.fanImageZoom,
    '--cat-radius': `${s.fanRadiusPx}px`, '--cat-image-fit': s.imageObjectFit, '--cat-glass': s.fanGlassColor, '--cat-glass-tint': `${s.fanGlassTint}%`,
    '--cat-glass-blur': `${s.fanGlassBlurPx}px`, '--cat-glass-border': s.fanGlassBorder,
    '--cat-shadow': s.fanShadow ? '0 18px 30px #722d4b36' : 'none',
    '--cat-mobile-columns': s.fanMobileColumns, '--cat-mobile-height': `${s.fanMobileHeightPx}px`,
    '--cat-mobile-gap': `${s.fanMobileGapPx}px`, '--cat-mobile-tilt': `${s.fanMobileTiltDeg}deg`,
    '--cat-mobile-title-size': `${s.fanMobileTitleSizePx}px`, '--cat-mobile-label-size': `${s.fanMobileLabelSizePx}px`,
    '--cat-mobile-padding': `${s.fanMobilePaddingXPx}px`,
  };
  const parallax = (event) => {
    if (!s.fanMotionEnabled || !s.fanParallax || !window.matchMedia?.('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    root.current?.style.setProperty('--cat-pointer-x', `${((event.clientX - rect.left) / rect.width - .5) * -10}px`);
    root.current?.style.setProperty('--cat-pointer-y', `${((event.clientY - rect.top) / rect.height - .5) * -7}px`);
  };
  const resetPointer = () => {
    root.current?.style.setProperty('--cat-pointer-x', '0px'); root.current?.style.setProperty('--cat-pointer-y', '0px');
  };
  return <section ref={root} className="categories-fan" aria-label="Categorías" style={vars} data-height-mode={s.fanSectionHeightMode} data-motion={s.fanMotionEnabled ? 'on' : 'off'} data-glint={s.fanGlint ? 'on' : 'off'} onPointerMove={parallax} onPointerLeave={resetPointer}>
    <div className="categories-fan__background" aria-hidden="true" />
    <div className="categories-fan__inner">
      <header className="categories-fan__header">
        {s.fanShowEyebrow && c.eyebrow && <span className="categories-fan__eyebrow">{c.eyebrow}</span>}
        {s.fanShowTitle && <h2 className="categories-fan__title">{c.useTitleImage ? <TitleImage key={c.titleImage} src={c.titleImage} alt={c.titleAlt} text={c.titleText} /> : c.titleText}</h2>}
        {s.fanShowSubtitle && c.subtitleText && <p className="categories-fan__subtitle">{c.subtitleText}</p>}
      </header>
      <div className="categories-fan__collections" onMouseLeave={() => setActiveId(null)}>
        {rows.map((row, rowIndex) => <div className="categories-fan__row" key={rowIndex}>
          {row.map((slide, index) => {
            const position = row.length === 1 ? 0 : index / (row.length - 1) * 2 - 1;
            return <a key={slide.id} href={safeCategoryHref(slide.href)} aria-label={`Explorar ${slide.title || 'categoría'}`}
              className={`categories-fan__category ${activeId === slide.id ? 'is-active' : ''}`}
              style={{ '--cat-turn': `${position * s.fanSpreadDeg}deg`, '--cat-lift': `${position * position * s.fanLiftPx}px`, '--cat-position': position }}
              onMouseEnter={() => setActiveId(slide.id)} onFocus={() => setActiveId(slide.id)} onBlur={() => setActiveId(null)}>
              <CategoriaArtwork slide={slide} className="category-artwork--desktop" />
              <CategoriaArtwork slide={slide} mobile className="category-artwork--mobile" />
              {s.showBadge && slide.badge && <span className="categories-fan__badge">{slide.badge}</span>}
              <span className="categories-fan__label"><span>{slide.title || 'Categoría'}</span>{s.fanShowArrow && <ArrowUpRight size={20} aria-hidden="true" />}</span>
            </a>;
          })}
        </div>)}
      </div>
      {s.fanShowFooter && <p className="categories-fan__footer" aria-live="polite">{s.fanShowDescription && active
        ? active.subtitle || active.review || `${active.title} · Explorar colección` : c.footerText}</p>}
    </div>
  </section>;
}
