import { useEffect, useId, useRef, useState } from 'react';
import { API_BASE_URL } from '../config/apiBaseUrl';
import './headerSearch.css';

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export default function HeaderSearch({ open, anchorRef, onClose, onSearch, onSelectProduct, onPointerEnter }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState({ term: '', status: 'idle', products: [] });
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const resultsId = useId();

  useEffect(() => {
    if (!open) return;
    setQuery('');
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    setActiveIndex(-1);
    if (!open || term.length < 2) {
      setSuggestions({ term, status: 'idle', products: [] });
      return undefined;
    }

    const controller = new AbortController();
    setSuggestions({ term, status: 'loading', products: [] });
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: term, page: '1', limit: '5' });
        const response = await fetch(`${API_BASE_URL}/api/products?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('PRODUCT_SEARCH_FAILED');
        const data = await response.json();
        if (controller.signal.aborted) return;
        setSuggestions({
          term,
          status: 'ready',
          products: (Array.isArray(data.products) ? data.products : []).filter((product) => product?._id && product?.title).slice(0, 5),
        });
      } catch {
        if (!controller.signal.aborted) setSuggestions({ term, status: 'error', products: [] });
      }
    }, 280);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

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

  const term = query.trim();
  const current = suggestions.term === term && term.length >= 2 ? suggestions : { status: 'idle', products: [] };
  const products = current.products;
  const showDropdown = term.length >= 2 && current.status !== 'idle';
  const onInputKeyDown = (event) => {
    if (event.key === 'ArrowDown' && products.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % products.length);
    } else if (event.key === 'ArrowUp' && products.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + products.length - 1) % products.length);
    } else if (event.key === 'Enter' && activeIndex >= 0 && products[activeIndex]) {
      event.preventDefault();
      onSelectProduct(products[activeIndex]);
    }
  };

  return <div className="header-search-popover" role="dialog" aria-label="Buscar productos" onMouseEnter={onPointerEnter}>
    <form className="header-search-form" role="search" onSubmit={submit}>
      <input ref={inputRef} aria-label="Buscar productos" type="search" role="combobox" autoComplete="off" maxLength={160}
        aria-autocomplete="list" aria-expanded={products.length > 0} aria-controls={products.length ? resultsId : undefined}
        aria-activedescendant={activeIndex >= 0 && products[activeIndex] ? `${resultsId}-${activeIndex}` : undefined}
        placeholder="Buscar productos..." value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onInputKeyDown} />
      <button type="submit" aria-label="Ver resultados" disabled={!query.trim()}><span aria-hidden="true">→</span></button>
    </form>
    {showDropdown && <div className="header-search-suggestions" aria-live="polite">
      {current.status === 'loading' && <p className="header-search-suggestions__message" role="status">Buscando productos…</p>}
      {current.status === 'error' && <p className="header-search-suggestions__message" role="alert">No se pudieron cargar las sugerencias.</p>}
      {current.status === 'ready' && !products.length && <p className="header-search-suggestions__message">No encontramos productos para “{term}”.</p>}
      {products.length > 0 && <div id={resultsId} role="listbox" aria-label="Productos sugeridos" className="header-search-suggestions__list">
        {products.map((product, index) => <button
          key={product._id} id={`${resultsId}-${index}`} type="button" role="option"
          aria-selected={activeIndex === index} className="header-search-suggestions__product"
          onMouseEnter={() => setActiveIndex(index)} onClick={() => onSelectProduct(product)}>
          {product.image ? <img src={product.image} alt="" loading="lazy" /> : <span className="header-search-suggestions__placeholder" aria-hidden="true">✦</span>}
          <span className="header-search-suggestions__details"><strong>{product.title}</strong><small>{money.format(Number(product.price) || 0)}</small></span>
          <span aria-hidden="true">↗</span>
        </button>)}
      </div>}
      {current.status !== 'loading' && <button type="button" className="header-search-suggestions__all" onClick={() => onSearch(term)}>Ver todos los resultados <span aria-hidden="true">→</span></button>}
    </div>}
  </div>;
}
