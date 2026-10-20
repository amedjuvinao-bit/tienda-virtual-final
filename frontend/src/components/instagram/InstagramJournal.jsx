import React, { useContext, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Instagram, ChevronLeft, ChevronRight } from 'lucide-react';
import { normalizeInstagramSection } from '../../admin/appearance/sections/instagram/instagramSectionHelpers';
import { normalizeJournal, journalPosts, journalHighlights, journalFeaturedId, journalIdentity } from '../../admin/appearance/sections/instagram/instagramJournalHelpers';
import { safeInstagramLink } from '../../admin/appearance/sections/instagram/instagramEditorialHelpers';
import { categoriasBackdrop } from '../../admin/appearance/sections/categorias/categoriasFanHelpers';
import InstagramJournalPost from './InstagramJournalPost';
import useJournalSaved from './useJournalSaved';
import { moveJournalGlass, resetJournalGlass } from './journalGlass';
import JournalLiquidLens from './JournalLiquidLens';
import JournalLightbox from './JournalLightbox';
import useInstagramFeed from './useInstagramFeed';
import { InstagramEditorFeed } from './InstagramEditorFeed';
import selectionHelpers from '@shared/instagram-selection';
import './instagramJournal.css';
import './instagramJournalGlass.css';
import './instagramJournalLiquid.css';
import './journalReel.css';
import './instagramJournalDepth.css';

export default function InstagramJournal({ theme, posts: fallback = [] }) {
  const raw = theme?.sections?.find(s => s?.id === 'instagram' || s?.type === 'instagram');
  const section = normalizeInstagramSection(raw);
  const c = section.config;
  const connectedMode = c.journalSource === 'connected';
  const editorFeed = useContext(InstagramEditorFeed);
  const publicFeed = useInstagramFeed(section.enabled && connectedMode && !editorFeed);
  const feed = editorFeed || publicFeed;
  const account = connectedMode && feed.connected ? feed.account : null;
  const resolved = { ...c,
    ...journalIdentity(c, account),
    ...(account && c.journalUseAccountAvatar !== false && account.avatar ? { journalAvatarImage: account.avatar } : {}),
  };
  const j = normalizeJournal(resolved);
  const manualPosts = journalPosts(Array.isArray(raw?.config?.posts) ? c.posts : fallback, j.journalLimit);
  const posts = connectedMode && feed.connected ? selectionHelpers.visiblePosts(feed.posts, c, feed.account?.id) : manualPosts;
  const preferred = connectedMode && feed.connected ? (posts.find(p => p.id === c.journalFeaturedPostId)?.id || posts[0]?.id) : journalFeaturedId(posts, c);
  const main = useRef(null);
  const [selection, setSelection] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const requested = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('ig_post');
  // A changed preferred post in the admin must immediately update the real preview.
  const featured = posts.find(p => p.id === (selection && selection.preferred === preferred ? selection.id : (!selection && posts.some(p => p.id === requested) ? requested : preferred))) || posts[0];
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState('');
  const highlightPages = useRef({ account: '', cursors: new Set() });
  const user = resolved.profileUser || resolved.journalName;
  const { ids: saved, toggle } = useJournalSaved(resolved.profileLink || user);
  useEffect(() => {
    if (!section.enabled || !connectedMode || editorFeed || !feed.connected || !j.journalShowHighlights) return;
    const accountId = String(feed.account?.id || '');
    if (!accountId) return;
    if (highlightPages.current.account !== accountId) highlightPages.current = { account: accountId, cursors: new Set() };
    if (feed.error) { highlightPages.current.cursors.clear(); return; }
    if (feed.loading || !feed.nextCursor || highlightPages.current.cursors.has(feed.nextCursor)) return;
    const selection = selectionHelpers.selectionFor(c, accountId);
    const missing = (Array.isArray(c.journalHighlights) ? c.journalHighlights : []).some(h =>
      h && h.enabled !== false && h.accountId === accountId && /^ig_[\w-]{1,100}$/.test(h.postId || '') &&
      selectionHelpers.isPostVisible(selection, h.postId) && !feed.posts.some(post => post.id === h.postId));
    if (missing) {
      highlightPages.current.cursors.add(feed.nextCursor);
      feed.loadMore();
    }
  }, [section.enabled, connectedMode, editorFeed, feed, c, j.journalShowHighlights]);
  useEffect(() => { if (lightbox && !posts.some(post => post.id === lightbox.id)) setLightbox(null); }, [lightbox, posts]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  if (!section.enabled) return null;
  if (!featured) return connectedMode ? <section className="ig-journal__connection-state" aria-label="Instagram de la tienda"><p role="status">{feed.loading ? 'Cargando publicaciones de Instagram…' : feed.error || (feed.connected ? 'Pronto compartiremos nuevas publicaciones.' : 'Pronto podrás ver aquí nuestras publicaciones de Instagram.')}</p>{feed.nextCursor && <button type="button" disabled={feed.loading} onClick={feed.loadMore}>{feed.loading ? 'Cargando…' : 'Cargar más publicaciones'}</button>}{feed.error && <button type="button" onClick={feed.retry}>Volver a intentar</button>}</section> : null;
  const profile = safeInstagramLink(resolved.profileLink);
  const highlights = journalHighlights(c, posts);
  const filterPosts = posts.filter(p => filter === 'reels' ? p.kind === 'reel' : filter === 'saved' ? saved.includes(p.id) : true);
  const others = filterPosts.filter(p => p.id !== featured.id);
  const maxPage = Math.max(0, Math.ceil(others.length / j.journalPageSize) - 1);
  const currentPage = Math.min(page, maxPage);
  const shown = others.slice(currentPage * j.journalPageSize, (currentPage + 1) * j.journalPageSize);
  const select = id => {
    setSelection({ id, preferred }); setNotice('Publicación mostrada en grande.');
    main.current?.focus({ preventScroll: true });
    if (main.current?.closest('.ig-journal')?.clientWidth < 768) main.current.scrollIntoView?.({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth' });
  };
  const setView = value => { setFilter(value); setPage(0); };
  async function share(post, copy = false) {
    let url = safeInstagramLink(post.link);
    if (!url) {
      const local = new URL(window.location.origin + window.location.pathname);
      local.searchParams.set('ig_post', post.id); local.hash = 'instagram'; url = local.href;
    }
    try {
      if (!copy && typeof navigator.share === 'function') await navigator.share({ title: post.alt || j.journalName, url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setNotice('Enlace copiado.'); }
      else setNotice(`Copia este enlace para compartir: ${url}`);
    } catch (error) {
      if (error?.name !== 'AbortError') setNotice('No se pudo compartir. Usa Copiar enlace en las opciones de la foto.');
    }
  }
  let background = j.journalBackgroundMode === 'included' ? '/instagram/journal-satin.webp' : j.journalBackgroundImage;
  let color = j.journalBackgroundColor;
  if (j.journalBackgroundMode === 'continuity') {
    const backdrop = categoriasBackdrop(theme, {}, { fanBackgroundMode: 'continuity' }); background = backdrop.image; color = backdrop.color;
  }
  if (j.journalBackgroundMode === 'color') background = '';
  if (j.journalBackgroundMode === 'global') { background = ''; color = theme?.colors?.background || '#fff'; }
  const common = { settings: j, user, onSave: id => setNotice(toggle(id)), onShare: share, onSelect: select, onExpand: setLightbox };
  return <section className="ig-journal" aria-label="Instagram de la tienda" data-glass={j.journalGlassEnabled ? 'true' : 'false'} data-finish={j.journalGlassFinish} style={{
    '--igj-background': color, '--igj-backdrop': background ? `url(${JSON.stringify(background)})` : 'none',
    '--igj-mobile-backdrop': j.journalMobileBackgroundImage ? `url(${JSON.stringify(j.journalMobileBackgroundImage)})` : background ? `url(${JSON.stringify(background)})` : 'none',
    '--igj-wash': j.journalBackgroundWash / 100, '--igj-ink': j.journalInk, '--igj-accent': j.journalAccent,
    '--igj-card': j.journalCardColor, '--igj-opacity': `${j.journalCardOpacity}%`,
    '--igj-button': j.journalButtonColor, '--igj-button-text': j.journalButtonTextColor,
    '--igj-font': j.journalFont, '--igj-title-size': j.journalTitleSize, '--igj-text-size': `${j.journalTextSize}px`,
    '--igj-mobile-title': `${j.journalMobileTitleSize}px`, '--igj-max': `${j.journalMaxWidth}px`,
    '--igj-px': `${j.journalPaddingX}px`, '--igj-py': `${j.journalPaddingY}px`, '--igj-gap': `${j.journalGap}px`,
    '--igj-main': `${j.journalMainWidth}fr`, '--igj-rest': `${100 - j.journalMainWidth}fr`, '--igj-ratio': j.journalImageRatio,
    '--igj-mobile-ratio': j.journalMobileImageRatio, '--igj-radius': `${j.journalRadius}px`,
    '--igj-shadow': j.journalShadow / 100, '--igj-blur': `${j.journalBlur}px`, '--igj-lift': `${j.journalHoverLift}px`,
    '--igj-glass-depth': `${j.journalGlassDepth}px`, '--igj-texture': j.journalGlassTexture / 100,
    '--igj-reflection': j.journalGlassReflection / 100,
    '--igj-liquid-tint': `${j.journalLiquidOpacity}%`, '--igj-liquid-blur': `${j.journalLiquidBlur}px`,
    '--igj-mobile-padding': `${j.journalMobilePadding}px`
  }}>
    <div className="ig-journal__inner">
      <header className="ig-journal__heading">
        {j.journalShowProfile && (profile ? <a className="ig-journal__profile" href={profile} target="_blank" rel="noopener noreferrer"><Instagram aria-hidden="true" />{user}</a> : <span className="ig-journal__profile"><Instagram aria-hidden="true" />{user}</span>)}
        {j.journalShowTitle && <h2>{j.journalTitle}<span aria-hidden="true">✧</span></h2>}
        {j.journalShowFollow && profile && <a className="ig-journal__follow" href={profile} target="_blank" rel="noopener noreferrer">{j.journalFollowText}<ArrowUpRight size={19} aria-hidden="true" /></a>}
      </header>
      <div className="ig-journal__layout" data-sidebar={j.journalShowSidebar ? 'true' : 'false'}>
        <div className="ig-journal__main" ref={main} tabIndex={-1} aria-label="Publicación principal"><InstagramJournalPost key={featured.id} post={featured} saved={saved.includes(featured.id)} {...common} /></div>
        {j.journalShowSidebar && <aside className="ig-journal__sidebar" data-igj-glass="sidebar" onPointerMove={event => moveJournalGlass(event, j)} onPointerLeave={resetJournalGlass} onPointerCancel={resetJournalGlass} aria-label={j.journalSidebarTitle || 'Más publicaciones'}>
          <JournalLiquidLens settings={j} />
          <h3>{j.journalSidebarTitle}</h3>
          {j.journalShowHighlights && highlights.length > 0 && <div className="ig-journal__highlights" aria-label="Destacados de Instagram">{highlights.map(h => <button type="button" key={h.id} onClick={() => select(h.postId)} aria-pressed={featured.id === h.postId} aria-label={`Ver destacado: ${h.title}`}><span><img src={h.image} alt="" loading="lazy" /></span><strong>{h.title}</strong></button>)}</div>}
          {j.journalShowFilters && <div className="ig-journal__filters" role="group" aria-label="Filtrar publicaciones">{[['all', 'Todas'], ['reels', 'Reels'], ['saved', 'Guardadas']].map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setView(value)}>{label}</button>)}</div>}
          <div className="ig-journal__previews">{shown.map(post => <InstagramJournalPost key={post.id} post={post} compact saved={saved.includes(post.id)} {...common} />)}</div>
          {!shown.length && <p className="ig-journal__empty">{filterPosts.some(p => p.id === featured.id) ? 'Esta publicación ya está abierta en grande.' : filter === 'saved' ? 'Guarda publicaciones con el marcador para encontrarlas aquí.' : filter === 'reels' ? (feed.nextCursor ? 'No hay reels entre las publicaciones cargadas. Puedes cargar más.' : 'Todavía no hay reels en esta selección.') : 'Pronto compartiremos más momentos.'}</p>}
          {maxPage > 0 && <nav className="ig-journal__pagination" aria-label="Más publicaciones de Instagram"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Publicaciones anteriores"><ChevronLeft size={18} /></button><span>{currentPage + 1} / {maxPage + 1}</span><button type="button" disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)} aria-label="Siguientes publicaciones"><ChevronRight size={18} /></button></nav>}
        </aside>}
      </div>
      {connectedMode && <div className="ig-journal__feed-status">
        {account && c.journalShowAccountStats === true && <p>{account.followers.toLocaleString('es')} seguidores · {account.mediaCount.toLocaleString('es')} publicaciones</p>}
        {feed.nextCursor && <button type="button" disabled={feed.loading} onClick={feed.loadMore}>{feed.loading ? 'Cargando…' : 'Cargar más publicaciones'}</button>}
        {feed.error && <><p role="status">{feed.error}{!feed.connected && manualPosts.length ? ' Mostramos nuestra selección guardada.' : ''}</p><button type="button" disabled={feed.loading} onClick={feed.retry}>Volver a intentar</button></>}
        {feed.stale && <p>Mostramos las últimas publicaciones guardadas mientras se restablece la conexión.</p>}
      </div>}
      {lightbox && <JournalLightbox key={lightbox.id} post={lightbox} onClose={() => setLightbox(null)} />}
      {j.journalShowSubtitle && j.journalSubtitle && <p className="ig-journal__subtitle">{j.journalSubtitle}</p>}
      <div className="ig-journal__notice" role="status" aria-live="polite">{notice}</div>
    </div>
  </section>;
}
