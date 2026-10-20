import React, { useContext, useState } from 'react';
import { Eye, EyeOff, RefreshCw, ExternalLink, Instagram } from 'lucide-react';
import { InstagramEditorFeed } from '../../../../components/instagram/InstagramEditorFeed';
import { JournalSelect } from './JournalFields';
import { Button } from '../ui/UiComponents';
import { safeInstagramLink } from './instagramEditorialHelpers';
import selectionHelpers from '@shared/instagram-selection';
import './instagramConnectedPosts.css';

export default function InstagramConnectedPosts({ config, onChange }) {
  const feed = useContext(InstagramEditorFeed);
  const [search, setSearch] = useState(''), [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const connected = config.journalSource === 'connected';
  const account = feed?.account;
  const selection = selectionHelpers.selectionFor(config, account?.id);
  const order = selectionHelpers.orderFor(config, account?.id);
  const posts = selectionHelpers.orderedPosts(feed?.posts || [], config, account?.id);
  const visiblePosts = posts.filter(post => selectionHelpers.isPostVisible(selection, post.id));
  const visible = id => selectionHelpers.isPostVisible(selection, id);
  const filtered = posts.filter(post => (!search.trim() || `${post.caption || ''} ${post.alt || ''}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')))
    && (filter === 'all' || filter === 'visible' && visible(post.id) || filter === 'hidden' && !visible(post.id) || filter === 'reels' && post.kind === 'reel'));
  const pages = Math.max(1, Math.ceil(filtered.length / 12)), current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * 12, (current + 1) * 12);
  const patchVisibility = (ids, value) => onChange({ journalConnectedSelection: selectionHelpers.updateSelection(config, account.id, ids, value) });
  function changeMode(mode) {
    // When requiring approval, retain the currently visible loaded posts. Future posts wait for selection.
    const included = mode === 'selected' ? [...new Set([...selection.included].filter(visible).concat(posts.filter(p => visible(p.id)).map(p => p.id)))] : [...selection.included];
    onChange({ journalConnectedSelection: { accountId: account.id, mode, included, excluded: [...selection.excluded] } });
  }
  return <section className="ig-media-manager" aria-label="Administrar publicaciones de Instagram">
    <JournalSelect label="Contenido que se muestra en la tienda" value={connected ? 'connected' : 'manual'}
      options={[["connected", 'Publicaciones de la cuenta de Instagram'], ['manual', 'Fotos y enlaces manuales']]}
      onChange={value => onChange({ journalSource: value })} />
    {!connected ? <p className="ig-media-manager__hint">{account ? `@${account.username} está conectada. Elige Publicaciones de la cuenta de Instagram para seleccionar sus fotos y reels.` : 'Puedes conservar tus fotos manuales o seleccionar la cuenta de Instagram.'}</p>
      : <>
        <header className="ig-media-manager__header">
          <div className="ig-media-manager__account">{account?.avatar ? <img src={account.avatar} alt="" /> : <Instagram size={24} />}<div><strong>{account ? `@${account.username}` : 'Tu cuenta de Instagram'}</strong><p>{posts.length} cargadas · {posts.filter(p => visible(p.id)).length} visibles</p></div></div>
          <Button kind="outline" disabled={!feed || feed.loading} onClick={() => { setPage(0); feed.refresh(); }}><RefreshCw size={15} />{feed?.loading ? 'Cargando…' : 'Actualizar'}</Button>
        </header>
        <p className="ig-media-manager__note">Ocultar aquí conserva el original en Instagram. Guarda los cambios al salir de Apariencia.</p>
        {feed?.connected && <details className="ig-media-manager__policy"><summary>Publicaciones nuevas: {selection.mode === 'selected' ? 'requieren mi selección' : 'automáticas'}</summary><JournalSelect label="Al recibir publicaciones nuevas" value={selection.mode}
          options={[["all", 'Mostrarlas automáticamente, excepto las ocultas'], ['selected', 'Esperar mi selección antes de mostrarlas']]}
          onChange={changeMode} /><p className="ig-media-manager__note">Al esperar selección, las publicaciones cargadas que ya eran visibles se conservan y las siguientes quedan ocultas hasta que las elijas.</p></details>}
        {feed?.loading && !posts.length && <p role="status">Cargando publicaciones de Instagram…</p>}
        {feed?.error && <div role="alert"><p>{feed.error}</p><Button kind="outline" disabled={feed.loading} onClick={feed.retry}>Volver a intentar</Button></div>}
        {feed && !feed.loading && !feed.error && !feed.connected && <p>Conecta una cuenta en <a href="/admin/configuracion/instagram">Configuración → Instagram</a> para ver sus publicaciones.</p>}
        {feed?.stale && <p role="status">Mostramos las últimas publicaciones guardadas. Puedes actualizar para consultar Instagram.</p>}
        {posts.length > 0 && <>
          <JournalSelect label="Orden de las publicaciones" value={order.mode} options={[["instagram", 'Mantener el orden de Instagram'], ['manual', 'Ordenar manualmente']]}
            onChange={mode => onChange({ journalConnectedOrder: { ...order, mode, ids: order.ids.length ? order.ids : visiblePosts.map(post => post.id) } })} />
          <p className="ig-media-manager__note">Marca la foto o reel principal para mostrarla en grande. {order.mode === 'manual' ? 'Usa Mover antes y Mover después para ordenar las publicaciones visibles; puedes cargar más sin perder el orden guardado.' : 'Las demás publicaciones siguen el orden de Instagram.'}</p>
          <div className="ig-media-manager__tools">
            <label>Buscar entre las cargadas<input type="search" value={search} placeholder="Texto de la publicación…" onChange={e => { setSearch(e.target.value); setPage(0); }} /></label>
            <JournalSelect label="Filtrar publicaciones" value={filter} options={[["all", 'Todas'], ['visible', 'Visibles'], ['hidden', 'Ocultas'], ['reels', 'Reels']]} onChange={v => { setFilter(v); setPage(0); }} />
          </div>
          <div className="ig-media-manager__bulk"><span>{filtered.length} resultados entre las cargadas</span><Button kind="outline" disabled={!filtered.length || feed.loading} onClick={() => patchVisibility(filtered.map(p => p.id), true)}>Mostrar resultados</Button><Button kind="outline" disabled={!filtered.length || feed.loading} onClick={() => patchVisibility(filtered.map(p => p.id), false)}>Ocultar resultados</Button></div>
          <div className="ig-media-manager__grid">{shown.map(post => {
            const title = post.caption || post.alt || 'Publicación sin texto';
            const link = safeInstagramLink(post.link);
            const date = new Date(post.timestamp);
            const position = visiblePosts.findIndex(item => item.id === post.id);
            return <article key={post.id} className="ig-media-manager__card" data-visible={visible(post.id)}>
              <div className="ig-media-manager__image"><img src={post.image} alt={post.alt || 'Publicación de Instagram'} loading="lazy" /><span>{post.kind === 'reel' ? 'Reel' : post.album?.length > 1 ? 'Álbum' : 'Foto'}</span></div>
              <div className="ig-media-manager__body"><p title={title}>{title}</p>{!Number.isNaN(+date) && <time dateTime={date.toISOString()}>{date.toLocaleDateString('es-CO')}</time>}
                <button type="button" className="ig-media-manager__toggle" aria-pressed={visible(post.id)} aria-label={`${visible(post.id) ? 'Ocultar' : 'Mostrar'} publicación: ${title}`} onClick={() => patchVisibility([post.id], !visible(post.id))}>{visible(post.id) ? <Eye size={16} /> : <EyeOff size={16} />}{visible(post.id) ? 'Visible en tienda' : 'Oculta en tienda'}</button>
                <button type="button" className="ig-media-manager__principal" aria-label={`Usar como principal: ${title}`} aria-pressed={config.journalFeaturedPostId === post.id}
                  onClick={() => onChange({ journalFeaturedPostId: post.id, journalFeaturedAccountId: String(account.id), journalConnectedSelection: selectionHelpers.updateSelection(config, account.id, [post.id], true) })}>{config.journalFeaturedPostId === post.id ? 'Principal · se muestra en grande' : 'Usar como principal'}</button>
                {order.mode === 'manual' && visible(post.id) && <div className="ig-media-manager__order"><span>Posición {position + 1} entre las cargadas</span>
                  <button type="button" disabled={position <= 0} aria-label={`Mover antes: ${title}`} onClick={() => onChange({ journalConnectedOrder: selectionHelpers.movePost(config, account.id, posts, post.id, -1) })}>← Mover antes</button>
                  <button type="button" disabled={position === visiblePosts.length - 1} aria-label={`Mover después: ${title}`} onClick={() => onChange({ journalConnectedOrder: selectionHelpers.movePost(config, account.id, posts, post.id, 1) })}>Mover después →</button>
                </div>}
                {link && <a href={link} target="_blank" rel="noopener noreferrer">Ver en Instagram <ExternalLink size={13} /></a>}
              </div>
            </article>;
          })}</div>
          {!filtered.length && <p role="status">No hay coincidencias entre las publicaciones cargadas.</p>}
          {pages > 1 && <nav className="ig-media-manager__pagination" aria-label="Páginas de publicaciones cargadas"><Button kind="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>Anterior</Button><span>{current + 1} / {pages}</span><Button kind="outline" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Siguiente</Button></nav>}
        </>}
        {feed?.connected && !posts.length && !feed.loading && !feed.error && <p>Instagram no devolvió publicaciones disponibles para esta cuenta.</p>}
        {feed?.nextCursor && <Button disabled={feed.loading} onClick={feed.loadMore}>{feed.loading ? 'Cargando…' : 'Cargar más de Instagram'}</Button>}
        {posts.length > 0 && !feed?.nextCursor && !feed?.loading && <p className="ig-media-manager__hint">Has cargado todas las publicaciones disponibles en Instagram.</p>}
      </>}
  </section>;
}
