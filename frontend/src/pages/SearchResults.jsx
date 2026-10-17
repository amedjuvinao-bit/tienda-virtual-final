import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import FooterSection from '../components/FooterSection';
import ProductCard from '../components/ProductCard';
import { API_BASE_URL } from '../config/apiBaseUrl';
import { EMPTY_PRODUCT_PAGE, normalizeProductPageResponse } from '../utils/productPagination';
import './searchResults.css';

const PAGE_SIZE = 24;

export default function SearchResults({ theme }) {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim().slice(0, 160);
  const category = (params.get('category') || '').trim().slice(0, 120);
  const categoryName = (params.get('categoryName') || '').trim().slice(0, 120);
  const categoryParams = { ...(category ? { category, categoryName } : {}) };
  const rawPage = Number(params.get('page'));
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000 ? rawPage : 1;
  const retry = params.get('retry');
  const [state, setState] = useState({ ...EMPTY_PRODUCT_PAGE, loading: false, error: '' });
  const [draft, setDraft] = useState(q);

  useEffect(() => { setDraft(q); }, [q]);

  useEffect(() => {
    if (!q && !category) {
      setState({ ...EMPTY_PRODUCT_PAGE, loading: false, error: '' });
      return undefined;
    }
    const controller = new AbortController();
    setState((previous) => ({ ...previous, products: [], loading: true, error: '' }));
    const query = new URLSearchParams({ ...(q ? { q } : {}), page: String(page), limit: String(PAGE_SIZE) });
    if (category) {
      query.append('categoryScope', category);
      if (categoryName && categoryName !== category) query.append('categoryScope', categoryName);
    }
    fetch(`${API_BASE_URL}/api/products?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('No pudimos cargar los resultados. Inténtalo de nuevo.');
        return response.json();
      })
      .then((data) => setState({ ...normalizeProductPageResponse(data, PAGE_SIZE), loading: false, error: '' }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ ...EMPTY_PRODUCT_PAGE, loading: false, error: 'No pudimos cargar los resultados. Inténtalo de nuevo.' });
      });
    return () => controller.abort();
  }, [q, category, categoryName, page, retry]);

  const submit = (event) => {
    event.preventDefault();
    const term = draft.trim();
    if (term || category) setParams({ ...categoryParams, ...(term ? { q: term.slice(0, 160) } : {}) });
  };
  const goToPage = (next) => {
    setParams({ ...categoryParams, ...(q ? { q } : {}), page: String(next) });
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  return <div className="search-results-page">
    <Header />
    <main className="search-results-main">
      <div className="search-results-intro">
        <Link to="/">Inicio</Link><span aria-hidden="true"> / </span><span>Buscar</span>
        <p className="search-results-eyebrow">ROSA BOUTIQUE · DESCUBRE</p>
        <h1>{category ? categoryName || 'Categoría' : q ? 'Resultados de búsqueda' : '¿Qué estás buscando?'}</h1>
        {(q || category) && <p className="search-results-caption">{state.loading ? 'Buscando…' : state.error ? 'No se pudieron cargar los resultados.' : `${state.pagination.totalProducts} ${state.pagination.totalProducts === 1 ? 'producto' : 'productos'}${category ? ` en ${categoryName || 'esta categoría'}` : ` para “${q}”`}`}</p>}
      </div>
      <form className="search-results-form" role="search" onSubmit={submit}>
        <input aria-label="Buscar productos" type="search" maxLength={160} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Nombre, categoría o referencia" />
        <button type="submit" disabled={!draft.trim() && !category}>Buscar</button>
      </form>
      {state.loading ? <div className="search-results-message" role="status">Cargando productos…</div>
        : state.error ? <div className="search-results-message" role="alert">{state.error} <button type="button" onClick={() => setParams({ ...categoryParams, ...(q ? { q } : {}), retry: String(Date.now()) })}>Reintentar</button></div>
          : !q && !category ? <div className="search-results-message">Escribe una palabra para explorar el catálogo.</div>
            : !state.products.length ? <div className="search-results-message">No encontramos productos {category ? `en ${categoryName || 'esta categoría'}` : `para “${q}”`}. Prueba con otra búsqueda.</div>
              : <>
                <div className="search-results-grid">{state.products.map((product) => <ProductCard key={product._id} product={product} cols={4} />)}</div>
                {state.pagination.totalPages > 1 && <nav className="search-results-pages" aria-label="Páginas de resultados">
                  <button type="button" disabled={!state.pagination.hasPreviousPage} onClick={() => goToPage(page - 1)}>Anterior</button>
                  <span>Página {state.pagination.page} de {state.pagination.totalPages}</span>
                  <button type="button" disabled={!state.pagination.hasNextPage} onClick={() => goToPage(page + 1)}>Siguiente</button>
                </nav>}
              </>}
    </main>
    <FooterSection theme={theme} />
  </div>;
}
