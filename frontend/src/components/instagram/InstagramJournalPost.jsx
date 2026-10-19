import React, { useEffect, useRef } from 'react';
import { ArrowUpRight, Bookmark, Clapperboard, Heart, MessageCircle, MoreHorizontal, Send, Copy, Maximize2 } from 'lucide-react';
import { photoCrop, safeInstagramLink } from '../../admin/appearance/sections/instagram/instagramEditorialHelpers';
import { safeJournalVideo } from '../../admin/appearance/sections/instagram/instagramJournalHelpers';

export function JournalAvatar({ settings, small = false }) {
  return <span className={`ig-journal__avatar${small ? ' ig-journal__avatar--small' : ''}`} aria-hidden="true">
    {settings.journalAvatarImage ? <img src={settings.journalAvatarImage} alt="" /> : settings.journalMonogram}
  </span>;
}
export default function InstagramJournalPost({ post, settings: j, user, compact = false, saved, onSave, onShare, onSelect }) {
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
  return <article className={`ig-journal__post${compact ? ' ig-journal__post--compact' : ' ig-journal__post--featured'}`} data-post-id={post.id} aria-label={description}>
    <div className="ig-journal__post-header">
      <JournalAvatar settings={j} small={compact} />
      <div className="ig-journal__identity"><strong>{user.replace(/^@/, '')}</strong>{!compact && <span>{j.journalName}</span>}</div>
      {href && <details ref={menu} className="ig-journal__menu" onKeyDown={event => { if (event.key === 'Escape') { menu.current.open = false; menu.current.querySelector('summary')?.focus(); } }}>
        <summary aria-label={`Opciones: ${description}`}><MoreHorizontal aria-hidden="true" /></summary>
        <div><a href={href} target="_blank" rel="noopener noreferrer" onClick={() => { menu.current.open = false; }}>Abrir en Instagram <ArrowUpRight size={16} /></a>
          <button type="button" onClick={() => { menu.current.open = false; onShare(post, true); }}>Copiar enlace <Copy size={16} /></button></div>
      </details>}
    </div>
    <div className="ig-journal__media">
      {compact ? <button type="button" className="ig-journal__image-button" onClick={() => onSelect(post.id)} aria-label={`Ver en grande: ${description}`}>{picture}<span className="ig-journal__expand"><Maximize2 size={16} /> Ver en grande</span></button>
        : video ? <video key={`${post.id}:${video}`} src={video} poster={post.image} controls playsInline preload="none" aria-label={`Reel: ${description}`} /> : picture}
      {post.kind === 'reel' && (compact || !video) && <span className="ig-journal__reel"><Clapperboard size={18} aria-hidden="true" /> Reel</span>}
    </div>
    <div className="ig-journal__post-bottom">
      {!compact && j.journalShowActions && <div className="ig-journal__actions">
        {href && <><a href={href} target="_blank" rel="noopener noreferrer" aria-label="Dar me gusta en Instagram" title="Dar me gusta en Instagram"><Heart /></a>
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Comentar en Instagram" title="Comentar en Instagram"><MessageCircle /></a>
          <button type="button" onClick={() => onShare(post)} aria-label="Compartir publicación" title="Compartir publicación"><Send /></button></>}
        <button type="button" className="ig-journal__save" aria-label={saved ? 'Quitar de guardadas' : 'Guardar en este navegador'} title="Guardadas en este navegador" aria-pressed={saved} onClick={() => onSave(post.id)}><Bookmark fill={saved ? 'currentColor' : 'none'} /></button>
      </div>}
      {j.journalShowCaptions && post.caption && <p className="ig-journal__caption">{post.caption}</p>}
      {href && <a className="ig-journal__post-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${j.journalPostText}: ${description}`}>{j.journalPostText}<ArrowUpRight size={16} aria-hidden="true" /></a>}
    </div>
  </article>;
}
