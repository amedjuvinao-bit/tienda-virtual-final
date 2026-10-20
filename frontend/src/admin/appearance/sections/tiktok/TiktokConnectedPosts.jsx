import React, { useContext, useState } from 'react';
import { Eye, EyeOff, RefreshCw, ExternalLink, Music2 as TikTok } from 'lucide-react';
import { TiktokEditorFeed } from '../../../../components/tiktok/TiktokEditorFeed';
import { JournalSelect } from '../instagram/JournalFields';
import { Button } from '../ui/UiComponents';
import { safeTiktokLink } from './tiktokStageHelpers';
import selectionHelpers from '@shared/tiktok-selection';
import '../instagram/instagramConnectedPosts.css';

export default function TiktokConnectedPosts({ config, onChange }) {
  const feed = useContext(TiktokEditorFeed);
  const [search, setSearch] = useState(''), [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const connected = config.stageSource === 'connected';
  const account = feed?.account;
  const selection = selectionHelpers.selectionFor(config, account?.id);
  const order = selectionHelpers.orderFor(config, account?.id);
  const posts = selectionHelpers.orderedPosts(feed?.posts || [], config, account?.id);
  const visiblePosts = posts.filter(post => selectionHelpers.isPostVisible(selection, post.id));
  const visible = id => selectionHelpers.isPostVisible(selection, id);
  const filtered = posts.filter(post => (!search.trim() || `${post.title || ''} ${post.caption || ''} ${post.alt || ''}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')))
    && (filter === 'all' || filter === 'visible' && visible(post.id) || filter === 'hidden' && !visible(post.id) ));
  const pages = Math.max(1, Math.ceil(filtered.length / 6)), current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * 6, (current + 1) * 6);
  const patchVisibility = (ids, value) => onChange({ stageSelection: selectionHelpers.updateSelection(config, account.id, ids, value) });
  function changeMode(mode) {
    // When requiring approval, retain the currently visible loaded posts. Future posts wait for selection.
    const included = mode === 'selected' ? [...new Set([...selection.included].filter(visible).concat(posts.filter(p => visible(p.id)).map(p => p.id)))] : [...selection.included];
    onChange({ stageSelection: { accountId: account.id, mode, included, excluded: [...selection.excluded] } });
  }
  return <section className="ig-media-manager" aria-label="Administrar publicaciones de TikTok">
    <JournalSelect label="Contenido que se muestra en la tienda" value={connected ? 'connected' : 'manual'}
      options={[["connected", 'Publicaciones de la cuenta de TikTok'], ['manual', 'Videos y enlaces manuales']]}
      onChange={value => onChange({ stageSource: value })} />
    {!connected ? <p className="ig-media-manager__hint">{account ? `${account.username ? '@'+account.username : account.name || 'La cuenta'} está conectada. Elige la cuenta de TikTok para seleccionar sus videos.` : 'Puedes conservar tus videos manuales o seleccionar la cuenta de TikTok.'}</p>
      : <>
        <header className="ig-media-manager__header">
          <div className="ig-media-manager__account">{account?.avatar ? <img src={account.avatar} alt="" /> : <TikTok size={24} />}<div><strong>{account ? (account.username ? `@${account.username}` : account.name || 'Cuenta conectada') : 'Tu cuenta de TikTok'}</strong><p>{posts.length} cargadas · {posts.filter(p => visible(p.id)).length} visibles</p></div></div>
          <Button kind="outline" disabled={!feed || feed.loading} onClick={() => { setPage(0); feed.refresh(); }}><RefreshCw size={15} />{feed?.loading ? 'Cargando…' : 'Actualizar'}</Button>
        </header>
        <p className="ig-media-manager__note">Ocultar aquí conserva el original en TikTok. Guarda la apariencia para publicar tus cambios.</p>
        {feed?.connected && <details className="ig-media-manager__policy"><summary>Publicaciones nuevas: {selection.mode === 'selected' ? 'requieren mi selección' : 'automáticas'}</summary><JournalSelect label="Al recibir publicaciones nuevas" value={selection.mode}
          options={[["all", 'Mostrarlas automáticamente, excepto las ocultas'], ['selected', 'Esperar mi selección antes de mostrarlas']]}
          onChange={changeMode} /><p className="ig-media-manager__note">Al esperar selección, las publicaciones cargadas que ya eran visibles se conservan y las siguientes quedan ocultas hasta que las elijas.</p></details>}
        {feed?.loading && !posts.length && <p role="status">Cargando publicaciones de TikTok…</p>}
        {feed?.error && <div role="alert"><p>{feed.error}</p><Button kind="outline" disabled={feed.loading} onClick={feed.retry}>Volver a intentar</Button></div>}
        {feed && !feed.loading && !feed.error && !feed.connected && <p>Conecta una cuenta en <a href="/admin/configuracion/tiktok">Configuración → TikTok</a> para ver sus publicaciones.</p>}
        {feed?.stale && <p role="status">Mostramos las últimas publicaciones guardadas. Puedes actualizar para consultar TikTok.</p>}
        {posts.length > 0 && <>
          <JournalSelect label="Orden de las publicaciones" value={order.mode} options={[["tiktok", 'Mantener el orden de TikTok'], ['manual', 'Ordenar manualmente']]}
            onChange={mode => onChange({ stageOrder: { ...order, mode, ids: order.ids.length ? order.ids : visiblePosts.map(post => post.id) } })} />
          <p className="ig-media-manager__note">Marca el video principal para mostrarlo en grande. {order.mode === 'manual' ? 'Usa Mover antes y Mover después para ordenar las publicaciones visibles; puedes cargar más sin perder el orden guardado.' : 'Las demás publicaciones siguen el orden de TikTok.'}</p>
          <div className="ig-media-manager__tools">
            <label>Buscar entre las cargadas<input type="search" value={search} placeholder="Texto de la publicación…" onChange={e => { setSearch(e.target.value); setPage(0); }} /></label>
            <JournalSelect label="Filtrar publicaciones" value={filter} options={[["all", 'Todas'], ['visible', 'Visibles'], ['hidden', 'Ocultas']]} onChange={v => { setFilter(v); setPage(0); }} />
          </div>
          <div className="ig-media-manager__bulk"><span>{filtered.length} resultados entre las cargadas</span><Button kind="outline" disabled={!filtered.length || feed.loading} onClick={() => patchVisibility(filtered.map(p => p.id), true)}>Mostrar resultados</Button><Button kind="outline" disabled={!filtered.length || feed.loading} onClick={() => patchVisibility(filtered.map(p => p.id), false)}>Ocultar resultados</Button></div>
          <div className="ig-media-manager__grid">{shown.map(post => {
            const title = post.title || post.caption || post.alt || 'Publicación sin texto';
            const link = safeTiktokLink(post.link);
            const date = new Date(post.timestamp);
            const position = visiblePosts.findIndex(item => item.id === post.id);
            return <article key={post.id} className="ig-media-manager__card" data-visible={visible(post.id)}>
              <div className="ig-media-manager__image"><img src={post.image} alt={post.alt || 'Publicación de TikTok'} loading="lazy" /><span>{'Video'}</span></div>
              <div className="ig-media-manager__body"><p title={title}>{title}</p>
                <details className="text-xs"><summary className="cursor-pointer">Personalizar título</summary><label className="block mt-2">Título en la tienda<input className="w-full border rounded-lg p-2" aria-label={`Título personalizado: ${title}`} value={config.stageOverrides?.accountId === account?.id ? config.stageOverrides?.byId?.[post.id]?.title ?? '' : ''} placeholder={title} onChange={e => {
                  const byId = config.stageOverrides?.accountId === account?.id ? { ...config.stageOverrides.byId } : {};
                  if(e.target.value) byId[post.id] = { title: e.target.value }; else delete byId[post.id];
                  onChange({ stageOverrides: { accountId: account.id, byId } });
                }} /></label></details>{!Number.isNaN(+date) && <time dateTime={date.toISOString()}>{date.toLocaleDateString('es-CO')}</time>}
                <button type="button" className="ig-media-manager__toggle" aria-pressed={visible(post.id)} aria-label={`${visible(post.id) ? 'Ocultar' : 'Mostrar'} publicación: ${title}`} onClick={() => patchVisibility([post.id], !visible(post.id))}>{visible(post.id) ? <Eye size={16} /> : <EyeOff size={16} />}{visible(post.id) ? 'Visible en tienda' : 'Oculta en tienda'}</button>
                <button type="button" className="ig-media-manager__principal" aria-label={`Usar como principal: ${title}`} aria-pressed={config.stageFeaturedId === post.id}
                  onClick={() => onChange({ stageFeaturedId: post.id, stageFeaturedAccount: String(account.id), stageSelection: selectionHelpers.updateSelection(config, account.id, [post.id], true) })}>{config.stageFeaturedId === post.id ? 'Principal · se muestra en grande' : 'Usar como principal'}</button>
                {order.mode === 'manual' && visible(post.id) && <div className="ig-media-manager__order"><span>Posición {position + 1} entre las cargadas</span>
                  <button type="button" disabled={position <= 0} aria-label={`Mover antes: ${title}`} onClick={() => onChange({ stageOrder: selectionHelpers.movePost(config, account.id, posts, post.id, -1) })}>← Mover antes</button>
                  <button type="button" disabled={position === visiblePosts.length - 1} aria-label={`Mover después: ${title}`} onClick={() => onChange({ stageOrder: selectionHelpers.movePost(config, account.id, posts, post.id, 1) })}>Mover después →</button>
                </div>}
                {link && <a href={link} target="_blank" rel="noopener noreferrer">Ver en TikTok <ExternalLink size={13} /></a>}
              </div>
            </article>;
          })}</div>
          {!filtered.length && <p role="status">No hay coincidencias entre las publicaciones cargadas.</p>}
          {pages > 1 && <nav className="ig-media-manager__pagination" aria-label="Páginas de publicaciones cargadas"><Button kind="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>Anterior</Button><span>{current + 1} / {pages}</span><Button kind="outline" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Siguiente</Button></nav>}
        </>}
        {feed?.connected && !posts.length && !feed.loading && !feed.error && <p>TikTok no devolvió publicaciones disponibles para esta cuenta.</p>}
        {feed?.nextCursor && <Button disabled={feed.loading} onClick={feed.loadMore}>{feed.loading ? 'Cargando…' : 'Cargar más de TikTok'}</Button>}
        {posts.length > 0 && !feed?.nextCursor && !feed?.loading && <p className="ig-media-manager__hint">Has cargado todas las publicaciones disponibles en TikTok.</p>}
      </>}
  </section>;
}
