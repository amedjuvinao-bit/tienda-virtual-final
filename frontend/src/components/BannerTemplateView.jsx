import React, { useRef, useState } from 'react';
import { getBannerTemplate, moveBannerButtonLight, safeBannerLink, safeHotspotColor } from '../lib/bannerTemplates';
import './bannerTemplateView.css';

function GlassLink({ action, secondary = false, preview = false, onSelect, selected = false }) {
  const [pressed, setPressed] = useState(false);
  if (action?.enabled === false || !action?.text) return null;
  const href = safeBannerLink(action.link);
  const className = `rb-liquid-button${secondary ? ' rb-liquid-button--secondary' : ''}${pressed ? ' is-pressed' : ''}${preview ? ' rb-template__editable' : ''}`;
  const props = {
    className,
    'data-selected': preview && selected ? 'true' : undefined,
    onPointerMove: moveBannerButtonLight,
    onPointerDown: () => { setPressed(true); window.setTimeout(() => setPressed(false), 440); },
    onClick: preview ? (event) => { event.preventDefault(); onSelect?.(); } : undefined,
  };
  const contents = <><span className="rb-liquid-button__label">{action.text}</span><span aria-hidden="true">↗</span></>;
  return href ? <a {...props} href={href}>{contents}</a>
    : <span {...props} title={preview ? 'Editar este botón' : undefined} role={preview ? 'button' : undefined} tabIndex={preview ? 0 : undefined} onKeyDown={preview ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(); } } : undefined} aria-disabled={preview ? undefined : 'true'}>{contents}</span>;
}

function CopyLink({ href, preview, onSelect, selected, children }) {
  const safe = safeBannerLink(href);
  const props = { className: preview ? 'rb-template__editable' : undefined, 'data-selected': preview && selected ? 'true' : undefined };
  return safe ? <a {...props} href={safe} onClick={preview ? (event) => { event.preventDefault(); onSelect?.(); } : undefined}>{children}</a>
    : <span {...props} role={preview ? 'button' : undefined} tabIndex={preview ? 0 : undefined} onClick={preview ? onSelect : undefined} onKeyDown={preview ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(); } } : undefined}>{children}</span>;
}

const percent = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : fallback;

export default function BannerTemplateView({ banner, sections, preview = false, device, onSelect, selectedPart, placingCard = null, onPlaceCard, onMoveCard, children }) {
  const { id, config: c } = getBannerTemplate(banner, sections);
  const [activeCard, setActiveCard] = useState(null);
  const [dragged, setDragged] = useState(null);
  const dragRef = useRef(null);
  const suppressClick = useRef(false);
  const rootRef = useRef(null);
  const dragMove = (event) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const root = rootRef.current?.getBoundingClientRect();
    if (!root?.width || !root?.height) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) return;
    drag.moved = true;
    const x = Math.round(percent((event.clientX - root.left - drag.offsetX) / root.width * 100, drag.x));
    const y = Math.round(percent((event.clientY - root.top - drag.offsetY) / root.height * 100, drag.y));
    const cardWidth = drag.device === 'mobile' ? 58 : 22;
    const cardHeight = drag.cardHeight / root.height * 100;
    const position = { x: Math.max(cardWidth / 2, Math.min(100 - cardWidth / 2, x)), y: Math.max(cardHeight / 2, Math.min(100 - cardHeight / 2, y)) };
    drag.position = position;
    setDragged({ index: drag.index, device: drag.device, ...position });
  };
  const dragEnd = (event) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    setDragged(null);
    if (drag.moved) {
      suppressClick.current = true;
      if (event.type === 'pointerup') onMoveCard?.(drag.index, drag.device, drag.position.x, drag.position.y);
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }
  };
  const css = {
    '--rb-template-text': c.textColor,
    '--rb-template-accent': c.accentColor,
    '--rb-template-glass': c.glassColor,
    '--rb-template-overlay': Math.min(70, Math.max(0, Number(c.overlayOpacity) || 0)) / 100,
  };
  const cards = c.cards.map((item, index) => ({ ...item, sourceIndex: index })).filter((item) => item.enabled !== false);

  return <div ref={rootRef} className={`rb-template rb-template--${id}`} style={css} data-banner-template={id} data-button-animation={c.buttonAnimation} data-preview-device={preview ? device : undefined}>
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
        const defaults = { desktop: { x: 87, y: 20 + index * 28 }, tablet: { x: 87, y: 20 + index * 28 }, mobile: { x: 68, y: 58 + index * 20 } };
        const positions = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
          const saved = item.position?.[key];
          const live = dragged?.index === item.sourceIndex && dragged.device === key ? dragged : null;
          return [key, { x: percent(live?.x ?? saved?.x, fallback.x), y: percent(live?.y ?? saved?.y, fallback.y) }];
        }));
        const connector = (key) => {
          const { x: cx, y: cy } = positions[key];
          const edge = cx >= x ? cx - 11 : cx + 11;
          const elbow = cx >= x ? edge - 3 : edge + 3;
          return `${x},${y} ${elbow},${y} ${elbow},${cy} ${edge},${cy}`;
        };
        const lineColor = safeHotspotColor(item.lineColor);
        const cardSelected = activeCard === index || (preview && selectedPart === `card:${item.sourceIndex}`);
        const CardTag = href && !preview ? 'a' : 'div';
        return <div key={item.sourceIndex} className="rb-template__spot" data-active={cardSelected ? 'true' : undefined} style={{ '--rb-spot-x': `${x}%`, '--rb-spot-y': `${y}%`, '--rb-card-desktop-x': `${positions.desktop.x}%`, '--rb-card-desktop-y': `${positions.desktop.y}%`, '--rb-card-tablet-x': `${positions.tablet.x}%`, '--rb-card-tablet-y': `${positions.tablet.y}%`, '--rb-card-mobile-x': `${positions.mobile.x}%`, '--rb-card-mobile-y': `${positions.mobile.y}%`, '--rb-spot-color': lineColor }}>
          <svg className="rb-template__spot-connector" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline className="rb-template__connector-desktop" points={connector('desktop')} stroke={lineColor} /><polyline className="rb-template__connector-tablet" points={connector('tablet')} stroke={lineColor} />
          </svg>
          <button type="button" className="rb-template__spot-trigger" data-selected={preview && selectedPart === `card:${item.sourceIndex}` ? 'true' : undefined} aria-label={item.text || item.label} title={`Ver ${item.text || item.label}`} aria-pressed={cardSelected} onClick={() => { setActiveCard(index); if (preview) onSelect?.(`card:${item.sourceIndex}`); }}><span aria-hidden="true" /></button>
          <CardTag className="rb-template__spot-card" href={href && !preview ? href : undefined} data-open={cardSelected ? 'true' : undefined} data-selected={preview && selectedPart === `card:${item.sourceIndex}` ? 'true' : undefined} role={preview ? 'button' : undefined} tabIndex={preview ? 0 : undefined} onPointerDown={preview ? (event) => {
            if (event.button !== 0 || placingCard !== null) return;
            const root = rootRef.current?.getBoundingClientRect();
            const rect = event.currentTarget.getBoundingClientRect();
            if (!root?.width || !root?.height) return;
            const currentDevice = ['mobile', 'tablet', 'desktop'].includes(device) ? device : 'desktop';
            const center = positions[currentDevice];
            dragRef.current = { pointerId: event.pointerId, index: item.sourceIndex, device: currentDevice, x: center.x, y: center.y, startX: event.clientX, startY: event.clientY, offsetX: event.clientX - (root.left + center.x * root.width / 100), offsetY: event.clientY - (root.top + center.y * root.height / 100), cardHeight: rect.height, moved: false, position: center };
            event.currentTarget.setPointerCapture?.(event.pointerId);
          } : undefined} onPointerMove={(event) => { moveBannerButtonLight(event); if (preview) dragMove(event); }} onPointerUp={preview ? dragEnd : undefined} onPointerCancel={preview ? dragEnd : undefined} onClick={preview ? () => { if (!suppressClick.current) onSelect?.(`card:${item.sourceIndex}`); } : undefined} onKeyDown={preview ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(`card:${item.sourceIndex}`); } } : undefined}>
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
          return href ? <a key={index} className="rb-template__card" href={href} onPointerMove={moveBannerButtonLight} data-selected={preview && selectedPart === `card:${item.sourceIndex}` ? 'true' : undefined} onClick={preview ? (event) => { event.preventDefault(); onSelect?.(`card:${item.sourceIndex}`); } : undefined}>{content}</a>
            : <div key={index} className="rb-template__card" onPointerMove={moveBannerButtonLight} data-selected={preview && selectedPart === `card:${item.sourceIndex}` ? 'true' : undefined} role={preview ? 'button' : undefined} tabIndex={preview ? 0 : undefined} onClick={preview ? () => onSelect?.(`card:${item.sourceIndex}`) : undefined} onKeyDown={preview ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(`card:${item.sourceIndex}`); } } : undefined}>{content}</div>;
        })}
      </div>
    </div>}
  </div>;
}
