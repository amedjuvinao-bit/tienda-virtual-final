import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import './headerSearch.css';

export default function HeaderSearch({ open, onClose, onSearch }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusable = [...document.querySelectorAll('.header-search-panel button:not(:disabled), .header-search-panel input:not(:disabled)')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const submit = (event) => {
    event.preventDefault();
    const term = query.trim();
    if (term) onSearch(term);
  };

  return <div className="header-search-layer">
    <button type="button" className="header-search-backdrop" aria-label="Cerrar búsqueda" onClick={onClose} />
    <div className="header-search-panel" role="dialog" aria-modal="true" aria-label="Buscar productos">
      <div className="header-search-topline">
        <div><small>ROSA BOUTIQUE</small><h2>Encuentra lo que te inspira</h2></div>
        <button type="button" className="header-search-close" aria-label="Cerrar búsqueda" onClick={onClose}><X size={21} /></button>
      </div>
      <form className="header-search-form" role="search" onSubmit={submit}>
        <Search size={20} aria-hidden="true" />
        <input ref={inputRef} aria-label="Buscar productos" type="search" maxLength={160} placeholder="Busca por nombre, categoría o referencia" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button type="submit" disabled={!query.trim()}>Buscar</button>
      </form>
      <p>Escribe lo que buscas y presiona Enter para ver los productos.</p>
    </div>
  </div>;
}
