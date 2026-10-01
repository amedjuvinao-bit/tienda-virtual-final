import { useEffect, useRef, useState } from 'react';
import './headerSearch.css';

export default function HeaderSearch({ open, anchorRef, onClose, onSearch, onPointerEnter }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose(true);
    };
    const onPointerDown = (event) => {
      if (!anchorRef.current?.contains(event.target)) onClose(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, anchorRef, onClose]);

  if (!open) return null;

  const submit = (event) => {
    event.preventDefault();
    const term = query.trim();
    if (term) onSearch(term);
  };

  return <div className="header-search-popover" role="dialog" aria-label="Buscar productos" onMouseEnter={onPointerEnter}>
    <form className="header-search-form" role="search" onSubmit={submit}>
      <input ref={inputRef} aria-label="Buscar productos" type="search" maxLength={160}
        placeholder="Busca nombre, categoría o referencia" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button type="submit" disabled={!query.trim()}>Buscar</button>
    </form>
  </div>;
}
