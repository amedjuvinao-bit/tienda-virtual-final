import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../ui/UiComponents';
import './instagramConnectedPosts.css';

export default function InstagramHighlightPicker({ posts, selectedId, onSelect, feed, isVisible }) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState(''), [page, setPage] = useState(0);
  const id = useId(), trigger = useRef(null), input = useRef(null);
  const selected = posts.find(post => post.id === selectedId);
  const filtered = posts.filter(post => `${post.caption || ''} ${post.alt || ''}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')));
  const pages = Math.max(1, Math.ceil(filtered.length / 6)), current = Math.min(page, pages - 1);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <div className="ig-media-manager ig-highlight-picker">
    <strong className="ig-highlight-picker__label">Publicación del destacado</strong>
    <button ref={trigger} type="button" className="ig-highlight-picker__current" aria-expanded={open} aria-controls={id}
      aria-label="Elegir publicación de Instagram para el destacado" onClick={() => { setOpen(!open); setPage(0); setSearch(''); }}>
      {selected?.image && <img src={selected.image} alt="" />}
      <span><strong>{selected ? 'Cambiar publicación de Instagram' : 'Elegir publicación de Instagram'}</strong><span>{selected?.caption || selected?.alt || (selectedId ? 'Selecciona otra publicación o carga más para encontrar la actual.' : 'Elige una foto, un reel o un álbum.')}</span></span>
      <span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <section id={id} className="ig-highlight-picker__panel" aria-label="Publicaciones de Instagram para el destacado" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <label>Buscar publicación de Instagram<input ref={input} type="search" value={search} placeholder="Buscar entre las publicaciones cargadas…" onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
      <p className="ig-media-manager__note">Elige una miniatura para actualizar el destacado y su imagen. Si está oculta, también se mostrará en la sección.</p>
      {feed?.loading && <p role="status">Cargando publicaciones de Instagram…</p>}
      {feed?.error && <div role="alert"><p>{feed.error}</p><Button kind="outline" disabled={feed.loading} onClick={feed.retry}>Reintentar publicaciones de Instagram</Button></div>}
      {!feed?.connected && !feed?.loading && !feed?.error && <p>Conecta una cuenta en <a href="/admin/configuracion/instagram">Ajustes → Instagram</a> para elegir sus publicaciones.</p>}
      <div className="ig-highlight-picker__grid">{filtered.slice(current * 6, (current + 1) * 6).map(post => <button key={post.id} type="button" className="ig-highlight-picker__option" aria-pressed={selectedId === post.id}
        aria-label={`Elegir para el destacado: ${post.caption || post.alt || post.id}`} onClick={() => { onSelect(post.id); close(); }}>
        <img src={post.image} alt="" loading="lazy" />
        <span className="ig-highlight-picker__kind">{post.kind === 'reel' ? 'Reel' : post.album?.length > 1 ? 'Álbum' : 'Foto'}{isVisible(post.id) ? '' : ' · Oculta'}</span>
        <span className="ig-highlight-picker__caption">{post.caption || post.alt || 'Publicación sin texto'}</span>
        {selectedId === post.id && <strong>Seleccionada</strong>}
      </button>)}</div>
      {!filtered.length && feed?.connected && !feed.loading && <p role="status">{search ? 'No hay coincidencias entre las publicaciones cargadas.' : 'No hay publicaciones cargadas para elegir.'}</p>}
      {pages > 1 && <nav className="ig-media-manager__pagination" aria-label="Páginas para elegir un destacado"><Button kind="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>Anteriores</Button><span>{current + 1} / {pages}</span><Button kind="outline" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Siguientes</Button></nav>}
      <div className="ig-highlight-picker__footer"><span>{posts.length} publicaciones cargadas</span>{feed?.nextCursor && <Button kind="outline" disabled={feed.loading} onClick={feed.loadMore}>{feed.loading ? 'Cargando…' : 'Cargar más para elegir'}</Button>}<Button kind="outline" onClick={close}>Cerrar selector</Button></div>
    </section>}
  </div>;
}
