import React, { useEffect, useId, useRef, useState } from 'react';
import { getBannerTemplate, safeBannerLink, safeHotspotColor } from '../lib/bannerTemplates';
import lensMap from '../assets/bannerLensDisplacement.png';
import './bannerTemplateView.css';

function GlassLink({ action, secondary = false, preview = false, onSelect, selected = false }) {
  const [pressed, setPressed] = useState(false);
  if (action?.enabled === false || !action?.text) return null;
  const href = safeBannerLink(action.link);
  const className = `rb-liquid-button${secondary ? ' rb-liquid-button--secondary' : ''}${pressed ? ' is-pressed' : ''}${preview ? ' rb-template__editable' : ''}`;
  const props = {
    className,
    'data-selected': preview && selected ? 'true' : undefined,
    onPointerDown: () => { setPressed(true); window.setTimeout(() => setPressed(false), 440); },
    onClick: preview ? (event) => { event.preventDefault(); onSelect?.(); } : undefined,
  };
  const contents = <><span className="rb-liquid-button__label">{action.text}</span><span aria-hidden="true">↗</span></>;
  return href ? <a {...props} href={href}>{contents}</a>
    : <span {...props} title={preview ? 'Editar este botón' : 'Configura un enlace en el panel'} role={preview ? 'button' : undefined} tabIndex={preview ? 0 : undefined} onKeyDown={preview ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(); } } : undefined} aria-disabled={preview ? undefined : 'true'}>{contents}</span>;
}

function ActionLens({ primary, secondary, preview, onSelect, selectedPart }) {
  const groupRef = useRef(null);
  const lensRef = useRef(null);
  const copyRef = useRef(null);
  const animationRef = useRef(0);
  const positionRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const [visible, setVisible] = useState(false);
  const filterId = useId().replace(/:/g, '');

  useEffect(() => {
    const group = groupRef.current;
    const copy = copyRef.current;
    if (!group || !copy) return undefined;
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { copy.style.width = `${group.offsetWidth}px`; });
    resize?.observe(group);
    copy.style.width = `${group.offsetWidth}px`;
    return () => { resize?.disconnect(); cancelAnimationFrame(animationRef.current); };
  }, []);

  const paint = () => {
    const lens = lensRef.current;
    const copy = copyRef.current;
    if (!lens || !copy) return;
    const pos = positionRef.current;
    const width = lens.offsetWidth;
    const height = lens.offsetHeight;
    lens.style.transform = `translate3d(${pos.x - width / 2}px, ${pos.y - height / 2}px, 0)`;
    copy.style.left = `${width / 2 - pos.x}px`;
    copy.style.top = `${height / 2 - pos.y}px`;
    copy.style.transformOrigin = `${pos.x}px ${pos.y}px`;
  };

  const animate = () => {
    const pos = positionRef.current;
    pos.x += (pos.targetX - pos.x) * .3;
    pos.y += (pos.targetY - pos.y) * .3;
    paint();
    if (Math.abs(pos.targetX - pos.x) + Math.abs(pos.targetY - pos.y) > .3) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      animationRef.current = 0;
    }
  };

  const aim = (x, y) => {
    const group = groupRef.current;
    if (!group || !lensRef.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const pos = positionRef.current;
    pos.targetX = Math.max(0, Math.min(group.offsetWidth, x));
    pos.targetY = Math.max(0, Math.min(group.offsetHeight, y));
    if (!visible) {
      pos.x = pos.targetX;
      pos.y = pos.targetY;
      paint();
      setVisible(true);
    } else if (!animationRef.current) {
      animationRef.current = requestAnimationFrame(animate);
    }
  };

  const aimAtPointer = (event) => {
    const group = groupRef.current;
    const rect = group.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    aim((event.clientX - rect.left) * group.offsetWidth / rect.width,
      (event.clientY - rect.top) * group.offsetHeight / rect.height);
  };

  const hide = () => { setVisible(false); cancelAnimationFrame(animationRef.current); animationRef.current = 0; };
  const clone = (action, secondary) => action?.enabled === false || !action?.text ? null :
    <span className={`rb-liquid-button${secondary ? ' rb-liquid-button--secondary' : ''}`}>
      <span className="rb-liquid-button__label" data-label={action.text} /><span className="rb-action-lens__arrow" />
    </span>;

  return <div ref={groupRef} className="rb-template__actions"
    onPointerEnter={aimAtPointer} onPointerMove={aimAtPointer} onPointerLeave={hide}
    onPointerUp={(event) => { if (event.pointerType === 'touch') hide(); }}
    onFocusCapture={(event) => {
      const group = groupRef.current;
      const rect = event.target.getBoundingClientRect();
      const bounds = group.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      aim((rect.left + rect.width / 2 - bounds.left) * group.offsetWidth / bounds.width,
        (rect.top + rect.height / 2 - bounds.top) * group.offsetHeight / bounds.height);
    }}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) hide(); }}>
    <GlassLink action={primary} preview={preview} selected={selectedPart === 'action:primary'} onSelect={() => onSelect?.('action:primary')} />
    <GlassLink action={secondary} secondary preview={preview} selected={selectedPart === 'action:secondary'} onSelect={() => onSelect?.('action:secondary')} />
    <svg className="rb-action-lens-filter" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id={filterId} x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
        <feImage href={lensMap} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="displacement" />
        <feDisplacementMap in="SourceGraphic" in2="displacement" scale=".42" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
    <span ref={lensRef} className="rb-action-lens" data-visible={visible ? 'true' : 'false'} aria-hidden="true">
      <span className="rb-action-lens__backdrop" style={{ backdropFilter: `url(#${filterId})`, WebkitBackdropFilter: `url(#${filterId})` }} />
      <span className="rb-action-lens__distort" style={{ filter: `url(#${filterId})` }}>
        <span ref={copyRef} className="rb-action-lens__copy">{clone(primary, false)}{clone(secondary, true)}</span>
      </span>
    </span>
  </div>;
}

function CopyLink({ href, preview, onSelect, selected, children }) {
  const safe = safeBannerLink(href);
  const props = { className: preview ? 'rb-template__editable' : undefined, 'data-selected': preview && selected ? 'true' : undefined };
  return safe ? <a {...props} href={safe} onClick={preview ? (event) => { event.preventDefault(); onSelect?.(); } : undefined}>{children}</a>
    : <span {...props} role={preview ? 'button' : undefined} tabIndex={preview ? 0 : undefined} onClick={preview ? onSelect : undefined} onKeyDown={preview ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(); } } : undefined}>{children}</span>;
}

const percent = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : fallback;

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
      <ActionLens primary={c.primary} secondary={c.secondary} preview={preview} onSelect={onSelect} selectedPart={selectedPart} />
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
          <CardTag className="rb-template__spot-card" href={href && !preview ? href : undefined} data-open={cardSelected ? 'true' : undefined} data-selected={preview && selectedPart === `card:${item.sourceIndex}` ? 'true' : undefined} role={preview ? 'button' : undefined} tabIndex={preview ? 0 : undefined} onClick={preview ? () => onSelect?.(`card:${item.sourceIndex}`) : undefined} onKeyDown={preview ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(`card:${item.sourceIndex}`); } } : undefined}>
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
