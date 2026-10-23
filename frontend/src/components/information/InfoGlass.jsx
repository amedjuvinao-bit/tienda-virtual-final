import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Truck, Headset, Store, ShieldCheck, Package, Heart, MapPin, Clock, ArrowRight, X } from 'lucide-react';
import { resolveWhatsAppHref } from '../whatsappLink';
import { normalizeInfoGlass, infoGlassCard, safeInfoHref, safeInfoImage, INFO_GLASS_ASSETS } from '../../admin/appearance/sections/info/infoGlassHelpers';
import './infoGlass.css';

const icons = { truck: Truck, headset: Headset, store: Store, shield: ShieldCheck, package: Package, heart: Heart, location: MapPin, clock: Clock };
const relief = ['truck', 'headset', 'store'];
function Details({ card, config, trigger, onClose }) {
  const dialog = useRef(null), close = useRef(onClose); close.current = onClose;
  const doc = trigger?.ownerDocument || document, id = React.useId();
  useEffect(() => {
    const before = doc.activeElement, previous = doc.body.style.overflow;
    doc.body.style.overflow = 'hidden';
    dialog.current?.querySelector('button')?.focus();
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key === 'Tab') {
        const items = [...(dialog.current?.querySelectorAll('button,a[href],input,textarea,select,[tabindex="0"]') || [])].filter(el => !el.disabled);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    doc.addEventListener('keydown', keydown);
    return () => { doc.body.style.overflow = previous; doc.removeEventListener('keydown', keydown); if (before?.isConnected) before.focus(); };
  }, [doc]);
  return createPortal(<div className="info-glass-dialog-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="info-glass-dialog" role="dialog" aria-modal="true" aria-labelledby={id} ref={dialog}
      style={{ color: config.titleColor, backgroundColor: config.backgroundColor, fontFamily: config.bodyFont }}>
      <button type="button" className="info-glass-dialog-close" onClick={onClose} aria-label="Cerrar información"><X size={22} /></button>
      <h2 id={id} style={{ fontFamily: config.titleFont }}>{card.heading}</h2><p>{card.detailText || card.text}</p>
      <button type="button" className="info-glass-dialog-done" onClick={onClose}>Cerrar</button>
    </div>
  </div>, doc.body);
}
export default function InfoGlass({ section, theme }) {
  const c = normalizeInfoGlass(section.config);
  const cards = section.config.cards.map(infoGlassCard).filter(card => card.enabled);
  const [detail, setDetail] = useState(null), root = useRef(null);
  const [entered, setEntered] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setEntered(true); observer.disconnect(); } }, { threshold: .08 });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  if (!section.enabled) return null;
  const backdrop = c.backgroundMode === 'satin' ? INFO_GLASS_ASSETS + 'satin.webp' : c.backgroundMode === 'image' ? c.backgroundImage : '';
  const featured = cards.some(card => card.id === c.featuredId) ? c.featuredId : '';
  const style = {
    '--ig-max-width': c.maxWidth + 'px', '--ig-min-height': c.minHeight + 'px',
    '--ig-px': c.paddingX + 'px', '--ig-py': c.paddingY + 'px',
    '--ig-card-height': c.cardHeight + 'px', '--ig-card-padding': c.cardPadding + 'px',
    '--ig-gap': c.gap + 'px', '--ig-radius': c.radius + 'px', '--ig-depth': c.depth + 'px',
    '--ig-lift': c.featuredLift + 'px', '--ig-tint': c.cardTint, '--ig-edge': c.edgeColor,
    '--ig-accent': c.accentColor, '--ig-ink': c.titleColor, '--ig-body': c.bodyColor,
    '--ig-button': c.buttonColor, '--ig-button-ink': c.buttonTextColor, '--ig-side-button': c.sideButtonColor,
    '--ig-title-size': c.titleSize + 'px', '--ig-card-title-size': c.cardTitleSize + 'px',
    '--ig-body-size': c.bodySize + 'px', '--ig-icon-size': c.iconSize + 'px',
    '--ig-title-font': c.titleFont || 'Georgia, serif', '--ig-body-font': c.bodyFont || 'system-ui',
    '--ig-glass-alpha': c.glassOpacity / 100, '--ig-blur': c.blur + 'px',
    '--ig-art-alpha': c.materialOpacity / 100, '--ig-duration': c.animationDuration + 'ms',
    '--ig-mobile-title': c.mobileTitleSize + 'px', '--ig-mobile-height': c.mobileCardHeight + 'px',
    '--ig-mobile-padding': c.mobilePadding + 'px', '--ig-mobile-gap': c.mobileGap + 'px',
    '--ig-mobile-icon': c.mobileIconSize + 'px',
    backgroundColor: c.backgroundMode === 'inherit' ? 'transparent' : c.backgroundColor,
    backgroundImage: backdrop ? 'url(' + JSON.stringify(backdrop) + ')' : 'none',
    backgroundPosition: c.backgroundPositionX + '% ' + c.backgroundPositionY + '%',
    backgroundSize: c.backgroundZoom === 100 ? 'cover' : c.backgroundZoom + '% auto',
  };
  return <div className="info-glass-viewport"><section ref={root} className={'info-glass info-glass--' + c.hoverAnimation + (entered ? ' info-glass--entered' : '')}
    data-material={c.material} data-mobile-layout={c.mobileLayout} data-entrance={c.entranceAnimation} style={style} aria-label={c.eyebrow || c.title || 'Información'}>
    <div className="info-glass-inner">
      {(c.eyebrow || c.title) && <header className="info-glass-header">
        {c.eyebrow && <div className="info-glass-eyebrow"><span>{c.eyebrow}</span><i aria-hidden="true" /></div>}
        {c.title && <h2>{c.title}</h2>}
      </header>}
      <div className="info-glass-grid" style={{ '--ig-count': cards.length || 1 }}>
        {cards.map((card, index) => {
          const Icon = icons[card.icon] || Truck;
          const custom = card.iconType === 'image' ? safeInfoImage(card.iconUrl) : '';
          const artwork = !custom && c.iconStyle === 'relief' && relief.includes(card.icon) ? INFO_GLASS_ASSETS + card.icon + '.webp' : '';
          const whatsapp = card.actionMode === 'whatsapp' ? resolveWhatsAppHref({
            ...(card.href ? { phone: card.href } : theme?.global?.whatsapp || {}),
            ...(card.whatsappMessage ? { message: card.whatsappMessage } : {}),
          }) : '';
          const href = safeInfoHref(card.actionMode === 'whatsapp' ? whatsapp : card.href), isFeatured = featured === card.id;
          return <article key={card.id} className={'info-glass-card' + (isFeatured ? ' info-glass-card--featured' : '')}
            style={{ '--ig-card-weight': isFeatured ? c.featuredWidth / 100 : 1, '--ig-index': index }}>
            <span className="info-glass-back info-glass-back--one" aria-hidden="true" /><span className="info-glass-back info-glass-back--two" aria-hidden="true" />
            <div className="info-glass-face">
              {c.material === 'artwork' && <img className="info-glass-material" src={INFO_GLASS_ASSETS + 'glass.webp'} alt="" aria-hidden="true" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}
              <span className="info-glass-edge" aria-hidden="true" />
              <div className={'info-glass-icon' + (custom || artwork ? ' info-glass-icon--image' : '')}>
                {custom || artwork ? <img src={custom || artwork} alt="" loading="lazy" onLoad={e => { e.currentTarget.hidden = false; e.currentTarget.parentElement.querySelector('svg')?.setAttribute('hidden', ''); }} onError={e => { e.currentTarget.hidden = true; e.currentTarget.parentElement.querySelector('svg')?.removeAttribute('hidden'); }} /> : null}
                <Icon hidden={!!(custom || artwork)} aria-hidden="true" strokeWidth={1.35} />
              </div>
              <div className="info-glass-copy">
                {c.showNumbers && <div className="info-glass-number" aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span><i /></div>}
                {card.heading && <h3>{card.heading}</h3>}{card.text && <p>{card.text}</p>}
              </div>
              {card.buttonEnabled && card.buttonText && (card.actionMode === 'details' ?
                <button type="button" className="info-glass-action" onClick={event => setDetail({ card, trigger: event.currentTarget })}><span>{card.buttonText}</span><ArrowRight size={22} aria-hidden="true" /></button> :
                href ? <a className="info-glass-action" href={href} target={card.newTab && /^https?:/i.test(href) ? '_blank' : undefined} rel={card.newTab ? 'noopener noreferrer' : undefined}><span>{card.buttonText}</span><ArrowRight size={22} aria-hidden="true" /></a> :
                  <button type="button" className="info-glass-action" disabled title="Configura el destino de este botón en Apariencia → Información"><span>{card.buttonText}</span><ArrowRight size={22} aria-hidden="true" /></button>)}
            </div>
          </article>;
        })}
      </div>
    </div>
    {detail && <Details card={detail.card} config={c} trigger={detail.trigger} onClose={() => setDetail(null)} />}
  </section></div>;
}
