import React, { useId, useState } from 'react';
import { getBannerTemplate, safeBannerLink, safeHotspotColor } from '../lib/bannerTemplates';
import './bannerTemplateView.css';

function GlassContour() {
  const gradientId = `rb-contour-${useId().replace(/:/g, '')}`;
  return <svg className="rb-glass-contour" aria-hidden="true" focusable="false" preserveAspectRatio="none">
    <defs><linearGradient id={gradientId} gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#7be9e2" stopOpacity="0" />
      <stop offset=".22" stopColor="#7be9e2" stopOpacity=".8" />
      <stop offset=".5" stopColor="#b6a4ed" stopOpacity=".9" />
      <stop offset=".76" stopColor="#f9c5bf" stopOpacity=".8" />
      <stop offset="1" stopColor="#f9c5bf" stopOpacity="0" />
    </linearGradient></defs>
    <path className="rb-glass-contour__base" data-contour-base="" />
    <path className="rb-glass-contour__spectrum" data-contour-spectrum="" stroke={`url(#${gradientId})`} />
  </svg>;
}

function GlassLink({ action, secondary = false, preview = false, onSelect, selected = false }) {
  const [pressed, setPressed] = useState(false);
  if (action?.enabled === false || !action?.text) return null;
  const href = safeBannerLink(action.link);
  const className = `rb-liquid-button${secondary ? ' rb-liquid-button--secondary' : ''}${pressed ? ' is-pressed' : ''}${preview ? ' rb-template__editable' : ''}`;
  const props = {
    className,
    'data-selected': preview && selected ? 'true' : undefined,
    onPointerDown: () => { setPressed(true); window.setTimeout(() => setPressed(false), 440); },
    onPointerMove: moveGlassLens,
    onPointerLeave: clearGlassLens,
    onClick: preview ? (event) => { event.preventDefault(); onSelect?.(); } : undefined,
  };
  const contents = <><span className="rb-glass-surface" aria-hidden="true" /><GlassContour /><span className="rb-liquid-button__label">{action.text}</span><span aria-hidden="true">↗</span></>;
  return href ? <a {...props} href={href}>{contents}</a>
    : <span {...props} title={preview ? 'Editar este botón' : 'Configura un enlace en el panel'} role={preview ? 'button' : undefined} tabIndex={preview ? 0 : undefined} onKeyDown={preview ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(); } } : undefined} aria-disabled={preview ? undefined : 'true'}>{contents}</span>;
}

function CopyLink({ href, preview, onSelect, selected, children }) {
  const safe = safeBannerLink(href);
  const props = { className: preview ? 'rb-template__editable' : undefined, 'data-selected': preview && selected ? 'true' : undefined };
  return safe ? <a {...props} href={safe} onClick={preview ? (event) => { event.preventDefault(); onSelect?.(); } : undefined}>{children}</a>
    : <span {...props} role={preview ? 'button' : undefined} tabIndex={preview ? 0 : undefined} onClick={preview ? onSelect : undefined} onKeyDown={preview ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(); } } : undefined}>{children}</span>;
}

const percent = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : fallback;
const contourPoints = (width, height, radius) => {
  const inset = 1.5;
  const right = width - inset;
  const bottom = height - inset;
  const r = Math.min(radius, (bottom - inset) / 2, (right - inset) / 2);
  const points = [];
  const line = (x1, y1, x2, y2, nx, ny) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 4));
    for (let i = 0; i < steps; i++) points.push({ x: x1 + (x2 - x1) * i / steps, y: y1 + (y2 - y1) * i / steps, nx, ny });
  };
  const arc = (cx, cy, start) => {
    const steps = Math.max(5, Math.ceil(r * Math.PI / 8));
    for (let i = 0; i < steps; i++) {
      const angle = start + Math.PI / 2 * i / steps;
      points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), nx: Math.cos(angle), ny: Math.sin(angle) });
    }
  };
  line(inset + r, inset, right - r, inset, 0, -1);
  arc(right - r, inset + r, -Math.PI / 2);
  line(right, inset + r, right, bottom - r, 1, 0);
  arc(right - r, bottom - r, 0);
  line(right - r, bottom, inset + r, bottom, 0, 1);
  arc(inset + r, bottom - r, Math.PI / 2);
  line(inset, bottom - r, inset, inset + r, -1, 0);
  arc(inset + r, inset + r, Math.PI);
  return points;
};

const formatPoint = ({ x, y }) => `${x.toFixed(1)} ${y.toFixed(1)}`;
const moveGlassLens = (event) => {
  if (event.pointerType && event.pointerType !== 'mouse') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
  const radius = parseFloat(window.getComputedStyle(target).borderTopLeftRadius) || Math.min(rect.height / 2, 30);
  const points = contourPoints(rect.width, rect.height, radius);
  const curved = points.map((point) => {
    const distance = Math.hypot(point.x - x, point.y - y);
    const shift = 5.5 * Math.exp(-distance * distance / (2 * 39 * 39));
    return { x: point.x - point.nx * shift, y: point.y - point.ny * shift };
  });
  const contour = `M ${curved.map(formatPoint).join(' L ')} Z`;
  const base = target.querySelector('[data-contour-base]');
  const spectrum = target.querySelector('[data-contour-spectrum]');
  const svg = target.querySelector('.rb-glass-contour');
  if (!base || !spectrum || !svg) return;
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  base.setAttribute('d', contour);
  let nearest = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.hypot(points[i].x - x, points[i].y - y) < Math.hypot(points[nearest].x - x, points[nearest].y - y)) nearest = i;
  }
  const segment = Array.from({ length: Math.min(25, points.length) }, (_, offset) => curved[(nearest - 12 + offset + points.length) % points.length]);
  spectrum.setAttribute('d', `M ${segment.map(formatPoint).join(' L ')}`);
  const gradient = svg.querySelector('linearGradient');
  gradient?.setAttribute('x1', segment[0].x);
  gradient?.setAttribute('y1', segment[0].y);
  gradient?.setAttribute('x2', segment[segment.length - 1].x);
  gradient?.setAttribute('y2', segment[segment.length - 1].y);
  const surface = target.querySelector('.rb-glass-surface');
  if (surface) surface.style.clipPath = `path('${contour}')`;
  target.dataset.refracting = 'true';
};
const clearGlassLens = (event) => {
  delete event.currentTarget.dataset.refracting;
  event.currentTarget.querySelector('.rb-glass-surface')?.style.removeProperty('clip-path');
};

export default function BannerTemplateView({ banner, sections, preview = false, device, onSelect, selectedPart, placingCard = null, onPlaceCard, children }) {
  const { id, config: c } = getBannerTemplate(banner, sections);
  const [activeCard, setActiveCard] = useState(null);
  const css = {
    '--rb-template-text': c.textColor,
    '--rb-template-accent': c.accentColor,
    '--rb-template-glass': c.glassColor,
    '--rb-template-overlay': Math.min(70, Math.max(0, Number(c.overlayOpacity) || 0)) / 100,
  };
  const cards = c.cards.map((item, index) => ({ ...item, sourceIndex: index })).filter((item) => item.enabled !== false);

  return <div className={`rb-template rb-template--${id}`} style={css} data-banner-template={id} data-preview-device={preview ? device : undefined}>
    <div className="rb-template__picture">{children}</div>
    <div className="rb-template__wash" aria-hidden="true" />
    <div className="rb-template__content">
      {c.eyebrow && <p className="rb-template__eyebrow"><CopyLink href={c.eyebrowLink} preview={preview} selected={selectedPart === 'copy:eyebrow'} onSelect={() => onSelect?.('copy:eyebrow')}>{c.eyebrow}</CopyLink></p>}
      {c.title && <h1 className="rb-template__title"><CopyLink href={c.titleLink} preview={preview} selected={selectedPart === 'copy:title'} onSelect={() => onSelect?.('copy:title')}>{c.title}</CopyLink></h1>}
      {c.description && <p className="rb-template__description"><CopyLink href={c.descriptionLink} preview={preview} selected={selectedPart === 'copy:description'} onSelect={() => onSelect?.('copy:description')}>{c.description}</CopyLink></p>}
      <div className="rb-template__actions">
        <GlassLink action={c.primary} preview={preview} selected={selectedPart === 'action:primary'} onSelect={() => onSelect?.('action:primary')} />
        <GlassLink action={c.secondary} secondary preview={preview} selected={selectedPart === 'action:secondary'} onSelect={() => onSelect?.('action:secondary')} />
      </div>
    </div>
    {id === 'atelier' ? <div className="rb-template__hotspots">
      {cards.map((item, index) => {
        const href = safeBannerLink(item.link);
        const x = percent(item.x, 70);
        const y = percent(item.y, 55);
        const cardY = 20 + index * 28;
        const lineColor = safeHotspotColor(item.lineColor);
        const cardSelected = activeCard === index || (preview && selectedPart === `card:${item.sourceIndex}`);
        const CardTag = href && !preview ? 'a' : 'div';
        return <div key={item.sourceIndex} className="rb-template__spot" data-active={cardSelected ? 'true' : undefined} style={{ '--rb-spot-x': `${x}%`, '--rb-spot-y': `${y}%`, '--rb-card-y': `${cardY}%`, '--rb-card-mobile-y': `${58 + index * 20}%`, '--rb-spot-color': lineColor }}>
          <svg className="rb-template__spot-connector" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={`${x},${y} 73,${y} 73,${cardY} 76,${cardY}`} stroke={lineColor} />
          </svg>
          <button type="button" className="rb-template__spot-trigger" data-selected={preview && selectedPart === `card:${item.sourceIndex}` ? 'true' : undefined} aria-label={item.text || item.label} title={`Ver ${item.text || item.label}`} aria-pressed={cardSelected} onClick={() => { setActiveCard(index); if (preview) onSelect?.(`card:${item.sourceIndex}`); }}><span aria-hidden="true" /></button>
          <CardTag className="rb-template__spot-card" href={href && !preview ? href : undefined} data-open={cardSelected ? 'true' : undefined} data-selected={preview && selectedPart === `card:${item.sourceIndex}` ? 'true' : undefined} role={preview ? 'button' : undefined} tabIndex={preview ? 0 : undefined} onPointerMove={moveGlassLens} onPointerLeave={clearGlassLens} onClick={preview ? () => onSelect?.(`card:${item.sourceIndex}`) : undefined} onKeyDown={preview ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(`card:${item.sourceIndex}`); } } : undefined}>
            <span className="rb-glass-surface" aria-hidden="true" />
            <GlassContour />
            {item.image && <img src={item.image} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}
            <span className="rb-template__spot-copy"><strong>{item.text}</strong>{item.label && item.label !== item.text && <small>{item.label}</small>}</span>
            <span className="rb-template__spot-arrow" aria-hidden="true">→</span>
          </CardTag>
        </div>;
      })}
      {preview && placingCard !== null && <button type="button" className="rb-template__place-point" aria-label={`Señalar en la imagen el acceso ${placingCard + 1}`} title="Haz clic sobre el lugar que quieres señalar" onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        onPlaceCard?.(placingCard, Math.round(percent((event.clientX - rect.left) / rect.width * 100, 50)), Math.round(percent((event.clientY - rect.top) / rect.height * 100, 50)));
      }}><span>Haz clic sobre el lugar que quieres señalar</span></button>}
    </div> : <div className="rb-template__rail">
      {c.footerText && <span className="rb-template__rail-heading"><CopyLink href={c.footerTextLink} preview={preview} selected={selectedPart === 'copy:footerText'} onSelect={() => onSelect?.('copy:footerText')}>{c.footerText}</CopyLink></span>}
      <div className="rb-template__cards">
        {cards.map((item, index) => {
          const href = safeBannerLink(item.link);
          const content = <>{item.image && <img src={item.image} alt="" />}<span className="rb-template__card-copy"><small>{item.label}</small><strong>{item.text}</strong></span><span aria-hidden="true">↗</span></>;
          return href ? <a key={index} className="rb-template__card" href={href} data-selected={preview && selectedPart === `card:${item.sourceIndex}` ? 'true' : undefined} onClick={preview ? (event) => { event.preventDefault(); onSelect?.(`card:${item.sourceIndex}`); } : undefined}>{content}</a>
            : <div key={index} className="rb-template__card" data-selected={preview && selectedPart === `card:${item.sourceIndex}` ? 'true' : undefined} role={preview ? 'button' : undefined} tabIndex={preview ? 0 : undefined} onClick={preview ? () => onSelect?.(`card:${item.sourceIndex}`) : undefined} onKeyDown={preview ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(`card:${item.sourceIndex}`); } } : undefined}>{content}</div>;
        })}
      </div>
    </div>}
  </div>;
}
