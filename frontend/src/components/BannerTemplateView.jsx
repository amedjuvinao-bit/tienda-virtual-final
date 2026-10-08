import React, { useState } from 'react';
import { getBannerTemplate, safeBannerLink } from '../lib/bannerTemplates';
import './bannerTemplateView.css';

function GlassLink({ action, secondary = false, preview = false }) {
  const [pressed, setPressed] = useState(false);
  if (action?.enabled === false || !action?.text) return null;
  const href = safeBannerLink(action.link);
  const className = `rb-liquid-button${secondary ? ' rb-liquid-button--secondary' : ''}${pressed ? ' is-pressed' : ''}`;
  const props = {
    className,
    onPointerDown: () => { setPressed(true); window.setTimeout(() => setPressed(false), 440); },
  };
  const contents = <><span className="rb-liquid-button__label">{action.text}</span><span aria-hidden="true">↗</span></>;
  return href ? <a {...props} href={href} onClick={preview ? (event) => event.preventDefault() : undefined}>{contents}</a>
    : <span className={className} title="Configura un enlace en el panel" aria-disabled="true">{contents}</span>;
}

function CopyLink({ href, preview, children, className, as: Tag = 'span' }) {
  const safe = safeBannerLink(href);
  return safe ? <a className={className} href={safe} onClick={preview ? (event) => event.preventDefault() : undefined}>{children}</a>
    : <Tag className={className}>{children}</Tag>;
}

const percent = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : fallback;

export default function BannerTemplateView({ banner, sections, preview = false, device, children }) {
  const { id, config: c } = getBannerTemplate(banner, sections);
  const [activeCard, setActiveCard] = useState(null);
  const css = {
    '--rb-template-text': c.textColor,
    '--rb-template-accent': c.accentColor,
    '--rb-template-glass': c.glassColor,
    '--rb-template-overlay': Math.min(70, Math.max(0, Number(c.overlayOpacity) || 0)) / 100,
  };
  const cards = c.cards.filter((item) => item.enabled !== false);

  return <div className={`rb-template rb-template--${id}`} style={css} data-banner-template={id} data-preview-device={preview ? device : undefined}>
    <div className="rb-template__picture">{children}</div>
    <div className="rb-template__wash" aria-hidden="true" />
    <div className="rb-template__content">
      {c.eyebrow && <p className="rb-template__eyebrow"><CopyLink href={c.eyebrowLink} preview={preview}>{c.eyebrow}</CopyLink></p>}
      {c.title && <h1 className="rb-template__title"><CopyLink href={c.titleLink} preview={preview}>{c.title}</CopyLink></h1>}
      {c.description && <p className="rb-template__description"><CopyLink href={c.descriptionLink} preview={preview}>{c.description}</CopyLink></p>}
      <div className="rb-template__actions">
        <GlassLink action={c.primary} preview={preview} />
        <GlassLink action={c.secondary} secondary preview={preview} />
      </div>
    </div>
    {id === 'atelier' ? <div className="rb-template__hotspots">
      {cards.map((item, index) => {
        const href = safeBannerLink(item.link);
        return <div key={index} className="rb-template__spot" style={{ left: `${percent(item.x, 70)}%`, top: `${percent(item.y, 55)}%` }}>
          <button type="button" className="rb-template__spot-trigger" aria-label={item.text || item.label} aria-expanded={activeCard === index} onClick={() => setActiveCard(activeCard === index ? null : index)}>+</button>
          <div className="rb-template__spot-card" data-open={activeCard === index}>
            {item.image && <img src={item.image} alt="" />}
            <span><small>{item.label}</small><strong>{item.text}</strong>{href && (preview ? <span className="rb-template__spot-link">Explorar ↗</span> : <a href={href}>Explorar ↗</a>)}</span>
          </div>
        </div>;
      })}
    </div> : <div className="rb-template__rail">
      {c.footerText && <span className="rb-template__rail-heading"><CopyLink href={c.footerTextLink} preview={preview}>{c.footerText}</CopyLink></span>}
      <div className="rb-template__cards">
        {cards.map((item, index) => {
          const href = safeBannerLink(item.link);
          const content = <>{item.image && <img src={item.image} alt="" />}<span className="rb-template__card-copy"><small>{item.label}</small><strong>{item.text}</strong></span><span aria-hidden="true">↗</span></>;
          return href ? <a key={index} className="rb-template__card" href={href} onClick={preview ? (event) => event.preventDefault() : undefined}>{content}</a>
            : <div key={index} className="rb-template__card">{content}</div>;
        })}
      </div>
    </div>}
  </div>;
}
