import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bookmark, Clapperboard, Heart, MessageCircle, MoreHorizontal, Send, Copy, Maximize2 } from 'lucide-react';
import { photoCrop, safeInstagramLink } from '../../admin/appearance/sections/instagram/instagramEditorialHelpers';
import { safeJournalVideo } from '../../admin/appearance/sections/instagram/instagramJournalHelpers';
import { moveJournalGlass, resetJournalGlass } from './journalGlass';
import JournalLiquidLens from './JournalLiquidLens';
import JournalReelPlayer from './JournalReelPlayer';

export function JournalAvatar({ settings, small = false }) {
  const [failed, setFailed] = useState('');
  return <span className={`ig-journal__avatar${small ? ' ig-journal__avatar--small' : ''}`} aria-hidden="true">
    {settings.journalAvatarImage && failed !== settings.journalAvatarImage ? <img src={settings.journalAvatarImage} alt="" onError={() => setFailed(settings.journalAvatarImage)} /> : settings.journalMonogram}
  </span>;
}
export default function InstagramJournalPost({ post, settings: j, user, compact = false, saved, onSave, onShare, onSelect, onExpand }) {
  const menu = useRef(null);
  useEffect(() => {
    const close = event => { if (menu.current?.open && !menu.current.contains(event.target)) menu.current.open = false; };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const href = safeInstagramLink(post.link);
  const video = post.kind === 'reel' ? safeJournalVideo(post.videoUrl) : '';
  const crop = photoCrop(post);
  const description = post.alt || 'Publicación de la boutique';
  const picture = <picture>
    <img className={post.mobileImage ? "ig-journal__desktop-image" : undefined} src={post.image} alt={description} loading="lazy" decoding="async" style={{ objectFit: post.imageFit === 'contain' ? 'contain' : 'cover', objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})` }} />
    {post.mobileImage && <img className="ig-journal__mobile-image" src={post.mobileImage} alt={description} loading="lazy" decoding="async" style={{ objectFit: post.imageFit === 'contain' ? 'contain' : 'cover', objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})` }} />}
  </picture>;
  return <article className={`ig-journal__post${compact ? ' ig-journal__post--compact' : ' ig-journal__post--featured'}`} data-video={video ? 'true' : undefined} data-igj-glass={compact ? 'preview' : 'featured'} onPointerMove={event => moveJournalGlass(event, j)} onPointerLeave={resetJournalGlass} onPointerCancel={resetJournalGlass} data-post-id={post.id} aria-label={description}>
    <JournalLiquidLens settings={j} strength={compact ? .7 : 1} />
    <div className="ig-journal__post-header">
      <JournalAvatar settings={j} small={compact} />
      <div className="ig-journal__identity"><strong>{user.replace(/^@/, '')}</strong>{!compact && <span>{j.journalName}</span>}</div>
      <details ref={menu} className="ig-journal__menu" onKeyDown={event => { if (event.key === 'Escape') { menu.current.open = false; menu.current.querySelector('summary')?.focus(); } }}>
        <summary aria-label={`Opciones: ${description}`}><MoreHorizontal aria-hidden="true" /></summary>
        <div>{href && <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => { menu.current.open = false; }}>Abrir en Instagram <ArrowUpRight size={16} /></a>}
          <button type="button" onClick={() => { menu.current.open = false; onExpand(post); }}>Ver foto completa <Maximize2 size={16} /></button>
          <button type="button" onClick={() => { menu.current.open = false; onShare(post, true); }}>{href ? 'Copiar enlace' : 'Copiar enlace de esta foto'} <Copy size={16} /></button></div>
      </details>
    </div>
    <div className={`ig-journal__media${!compact && video ? ' ig-journal__media--reel' : ''}`}>
      {compact ? <button type="button" className="ig-journal__image-button" onClick={() => onSelect(post.id)} aria-label={`Ver en grande: ${description}`}>{picture}<span className="ig-journal__expand"><Maximize2 size={16} /> Ver en grande</span></button>
        : video ? <JournalReelPlayer key={`${post.id}:${video}`} post={post} src={video} onExpand={onExpand} /> : <button type="button" className="ig-journal__image-button" onClick={() => onExpand(post)} aria-label={`Ampliar foto: ${description}`}>{picture}<span className="ig-journal__expand"><Maximize2 size={16} /> Ver foto completa{post.album?.length > 1 ? ` · ${post.album.length} fotos` : ''}</span></button>}
      {post.album?.length > 1 && <button type="button" className="ig-journal__album-count" onClick={() => onExpand(post)} aria-label={`Ver las ${post.album.length} fotos de esta publicación`}>{post.album.length} fotos</button>}
      {post.kind === 'reel' && (compact || !video) && <span className="ig-journal__reel"><Clapperboard size={18} aria-hidden="true" /> Reel</span>}
    </div>
    {(compact || j.journalShowActions || (j.journalShowCaptions && post.caption) || href) && <div className="ig-journal__post-bottom">
      {!compact && <JournalLiquidLens settings={j} strength={.8} />}
      {!compact && j.journalShowActions && <div className="ig-journal__actions">
        {href && <><a href={href} target="_blank" rel="noopener noreferrer" aria-label="Dar me gusta en Instagram" title="Dar me gusta en Instagram"><Heart /></a>
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Comentar en Instagram" title="Comentar en Instagram"><MessageCircle /></a>
</>}
        {!href && <button type="button" onClick={() => onExpand(post)} aria-label="Ver foto completa" title="Ver foto completa"><Maximize2 /></button>}
        <button type="button" onClick={() => onShare(post)} aria-label={href ? "Compartir publicación" : "Compartir foto"} title="Compartir"><Send /></button>
        <button type="button" className="ig-journal__save" aria-label={saved ? 'Quitar de guardadas' : 'Guardar en este navegador'} title="Guardadas en este navegador" aria-pressed={saved} onClick={() => onSave(post.id)}><Bookmark fill={saved ? 'currentColor' : 'none'} /></button>
      </div>}
      {j.journalShowCaptions && (post.caption || (compact && post.alt)) && <p className="ig-journal__caption">{post.caption || post.alt}</p>}
      {compact && j.journalShowActions && <div className="ig-journal__actions ig-journal__compact-actions">
        <button type="button" onClick={() => onShare(post)} aria-label={`Compartir foto: ${description}`} title="Compartir"><Send /></button>
        <button type="button" onClick={() => onSave(post.id)} aria-label={`${saved ? 'Quitar foto de guardadas' : 'Guardar foto'}: ${description}`} aria-pressed={saved} title="Guardadas en este navegador"><Bookmark fill={saved ? 'currentColor' : 'none'} /></button>
      </div>}
      {compact && !href && <button type="button" className="ig-journal__post-link" onClick={() => onSelect(post.id)}>Ver en grande <Maximize2 size={16} /></button>}
      {!compact && !href && <button type="button" className="ig-journal__post-link" onClick={() => onExpand(post)}>Ver foto completa <Maximize2 size={16} /></button>}
      {href && <a className="ig-journal__post-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${j.journalPostText}: ${description}`}>{j.journalPostText}<ArrowUpRight size={16} aria-hidden="true" /></a>}
    </div>}
  </article>;
}
