import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useServicePage from '../components/service-pages/useServicePage';
import StorefrontLoadingScreen from '../components/StorefrontLoadingScreen';
import SearchResultsView from './SearchResultsView';
import { API_BASE_URL } from '../config/apiBaseUrl';
import { EMPTY_PRODUCT_PAGE, normalizeProductPageResponse } from '../utils/productPagination';
import './searchResults.css';

const PAGE_SIZE = 24;

export default function SearchResults({ theme }) {
  const appearance = useServicePage('search-page');
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
      .then((data) => { if (!controller.signal.aborted) setState({ ...normalizeProductPageResponse(data, PAGE_SIZE), loading: false, error: '' }); })
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

  if (appearance.loading) return <StorefrontLoadingScreen theme={theme}/>;
  return <SearchResultsView {...appearance} page={appearance.page || { useHeader: false, useFooter: false }}
    configError={appearance.error} onRetryConfig={appearance.retry} theme={theme}
    q={q} category={category} categoryName={categoryName} state={state} draft={draft} setDraft={setDraft}
    submit={submit} goToPage={goToPage}
    retrySearch={() => setParams({ ...categoryParams, ...(q ? { q } : {}), retry: String(Date.now()) })}/>;
}
