import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  Eye,
  Heart,
  ListChecks,
  PackageSearch,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useAdminPermissions from './security/useAdminPermissions';
import favoriteAdminApi from './favoriteAdminApi';
import './FavoritosAdmin.css';

const EMPTY_FILTERS = Object.freeze({
  dateFrom: '',
  dateTo: '',
  minItems: '',
  maxItems: '',
  minValue: '',
  maxValue: '',
  sort: 'recent_activity',
});

const QUICK_VIEWS = [
  ['all', 'Todos'],
  ['recent', 'Recientes'],
  ['high_intent', 'Alta intención'],
  ['high_value', 'Alto valor'],
  ['stale', 'Sin actividad'],
];

const METRIC_CARDS = [
  { key: 'totalLists', label: 'Listas activas', help: 'Sesiones con productos', icon: Heart },
  { key: 'totalItems', label: 'Productos guardados', help: 'Interés comercial acumulado', icon: ListChecks },
  { key: 'potentialValue', label: 'Valor potencial', help: 'Suma vigente de favoritos', icon: CircleDollarSign, money: true, tone: 'value' },
  { key: 'averageListValue', label: 'Valor promedio', help: 'Promedio por lista', icon: TrendingUp, money: true },
  { key: 'recentLists', label: 'Actividad reciente', help: 'Actualizadas en 7 días', icon: Clock3, tone: 'success' },
  { key: 'highIntentLists', label: 'Alta intención', help: 'Tres productos o más', icon: Sparkles, tone: 'info' },
];

function money(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function formatDate(value) {
  if (!value) return 'Sin registro';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Sin registro'
    : date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function elapsed(value, now = Date.now()) {
  const time = new Date(value || 0).getTime();
  if (!Number.isFinite(time)) return 'Sin registro';
  const hours = Math.max(0, Math.floor((now - time) / 3_600_000));
  if (hours < 1) return 'Hace menos de 1 h';
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.floor(hours / 24)} d`;
}

function aliasFromSession(sessionId) {
  const tail = String(sessionId || '').slice(-6).toUpperCase();
  return tail ? `Visitante ${tail}` : 'Visitante anónimo';
}

function maskedSession(sessionId) {
  const value = String(sessionId || '');
  if (value.length < 18) return value || 'Sin sesión';
  return `${value.slice(0, 10)}••••••${value.slice(-6)}`;
}

function activityTone(row = {}) {
  const days = (Date.now() - new Date(row.lastUpdate || 0).getTime()) / 86_400_000;
  if (days <= 7) return ['recent', 'Reciente'];
  if (days >= 30) return ['stale', 'Sin actividad'];
  return ['normal', 'En seguimiento'];
}

function priorityLabel(itemsCount, potentialValue) {
  if (Number(itemsCount) >= 3 || Number(potentialValue) >= 200_000) return 'Alta';
  return 'Normal';
}

function downloadCsv(blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'favoritos.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function FavoritosAdmin() {
  const { isAuthenticated, adminToken, authLoading } = useAuth();
  const { can } = useAdminPermissions();
  const hasSession = !authLoading && isAuthenticated && Boolean(adminToken);
  const canExport = can('favorites:export');
  const canDelete = can('favorites:delete');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [view, setView] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const requestFilters = useMemo(() => ({
    ...filters,
    q: debouncedSearch,
    view,
    page,
    limit,
  }), [filters, debouncedSearch, view, page, limit]);

  const summaryFilters = useMemo(() => {
    const { page: ignoredPage, limit: ignoredLimit, sort: ignoredSort, ...rest } = requestFilters;
    void ignoredPage;
    void ignoredLimit;
    void ignoredSort;
    return rest;
  }, [requestFilters]);

  const requireSession = () => {
    if (hasSession) return true;
    setSessionError('Tu sesión administrativa no es válida. Inicia sesión nuevamente.');
    return false;
  };

  const load = async () => {
    if (authLoading || !requireSession()) return;
    setLoading(true);
    setSessionError('');
    setListError('');
    setSummaryError('');
    const [listResult, summaryResult] = await Promise.allSettled([
      favoriteAdminApi.list(requestFilters),
      favoriteAdminApi.summary(summaryFilters),
    ]);
    if (listResult.status === 'fulfilled') {
      const payload = listResult.value.data || {};
      setRows(Array.isArray(payload.data) ? payload.data : []);
      setTotal(Number(payload.total || 0));
      setTotalPages(Math.max(1, Number(payload.totalPages || 1)));
    } else {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setListError('No fue posible cargar el listado de favoritos.');
    }
    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value.data || null);
    } else {
      setSummary(null);
      setSummaryError('No fue posible cargar los indicadores de favoritos.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (hasSession) load();
    else if (!authLoading) {
      setRows([]);
      setSummary(null);
      setSessionError('Tu sesión administrativa no es válida. Inicia sesión nuevamente.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession, authLoading, requestFilters, summaryFilters]);

  const clearFilters = () => {
    setSearch('');
    setFilters(EMPTY_FILTERS);
    setView('all');
    setPage(1);
  };

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const openDetail = async (id) => {
    if (!requireSession()) return;
    setDetail({ _id: id });
    setDetailLoading(true);
    try {
      const response = await favoriteAdminApi.detail(id);
      setDetail(response.data);
    } catch {
      setDetail(null);
      toast.error('No fue posible cargar el detalle de favoritos.');
    } finally {
      setDetailLoading(false);
    }
  };

  const removeFavorite = async (item) => {
    if (!detail?._id || !item?._id || !canDelete || !requireSession()) return;
    setBusy(true);
    try {
      const response = await favoriteAdminApi.removeItem(detail._id, item._id);
      if (response.data?.deleted) setDetail(null);
      else setDetail(response.data);
      await load();
      toast.success('Producto retirado de favoritos.');
    } catch {
      toast.error('No fue posible retirar el producto.');
    } finally {
      setBusy(false);
    }
  };

  const deleteFavorites = async () => {
    if (!detail?._id || !canDelete || !requireSession()) return;
    if (!window.confirm('¿Eliminar definitivamente esta lista de favoritos?')) return;
    setBusy(true);
    try {
      await favoriteAdminApi.remove(detail._id);
      setDetail(null);
      await load();
      toast.success('Lista de favoritos eliminada.');
    } catch {
      toast.error('No fue posible eliminar la lista.');
    } finally {
      setBusy(false);
    }
  };

  const exportFavorites = async () => {
    if (!canExport || !requireSession()) return;
    setBusy(true);
    try {
      const response = await favoriteAdminApi.export(summaryFilters);
      downloadCsv(response.data);
      toast.success('Exportación de favoritos generada.');
    } catch {
      toast.error('No fue posible exportar favoritos.');
    } finally {
      setBusy(false);
    }
  };

  const copySession = async () => {
    try {
      await navigator.clipboard.writeText(detail?.sessionId || '');
      toast.success('Identificador copiado.');
    } catch {
      toast.error('No fue posible copiar el identificador.');
    }
  };

  return (
    <main className="favorites-admin-page">
      <header className="favorites-admin-header">
        <div className="favorites-admin-heading">
          <span className="favorites-admin-eyebrow">Intención de compra</span>
          <h1>Favoritos de clientes</h1>
          <p>Identifica productos deseados, señales de interés y oportunidades comerciales.</p>
        </div>
        <div className="favorites-admin-header-actions">
          <button type="button" className="favorites-admin-button secondary" onClick={load} disabled={loading || !hasSession}>
            <RefreshCw size={15} className={loading ? 'is-spinning' : ''} /> Actualizar
          </button>
          {canExport && (
            <button type="button" className="favorites-admin-button primary" onClick={exportFavorites} disabled={busy || !hasSession}>
              <Download size={15} /> Exportar
            </button>
          )}
        </div>
      </header>

      {sessionError && <div className="favorites-admin-feedback error" role="alert">{sessionError}</div>}

      <section className="favorites-admin-metrics" aria-label="Indicadores de favoritos">
        {METRIC_CARDS.map(({ key, label, help, icon: Icon, money: isMoney, tone = '' }) => (
          <article className={`favorites-admin-glass favorites-admin-metric ${tone}`} key={key}>
            <div className="favorites-admin-metric-topline">
              <span>{label}</span>
              <span className="favorites-admin-metric-icon"><Icon size={15} /></span>
            </div>
            <strong>{summary ? (isMoney ? money(summary[key]) : Number(summary[key] || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 })) : '—'}</strong>
            <small>{help}</small>
          </article>
        ))}
      </section>

      {summaryError && <div className="favorites-admin-feedback warning" role="alert">{summaryError}</div>}

      <section className="favorites-admin-glass favorites-admin-controls" aria-label="Filtros de favoritos">
        <div className="favorites-admin-controls-topline">
          <div className="favorites-admin-quick-views" aria-label="Vistas rápidas">
            {QUICK_VIEWS.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={view === key} onClick={() => { setView(key); setPage(1); }}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="favorites-admin-reset" onClick={clearFilters}>
            <RefreshCw size={13} /> Restablecer
          </button>
        </div>

        <div className="favorites-admin-filter-grid primary-filters">
          <label className="search-field">
            Buscar
            <span className="favorites-admin-search-input">
              <Search size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Sesión, producto, SKU o categoría" />
            </span>
          </label>
          <label>Desde<input type="date" value={filters.dateFrom} onChange={(event) => setFilter('dateFrom', event.target.value)} /></label>
          <label>Hasta<input type="date" value={filters.dateTo} onChange={(event) => setFilter('dateTo', event.target.value)} /></label>
          <label>
            Ordenar
            <select value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)}>
              <option value="recent_activity">Más recientes</option>
              <option value="oldest_activity">Más antiguos</option>
              <option value="most_items">Más productos</option>
              <option value="highest_value">Mayor valor</option>
            </select>
          </label>
          <label className="page-size-field">
            Filas
            <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          <button type="button" className="favorites-admin-advanced-toggle" onClick={() => setAdvancedOpen((open) => !open)} aria-expanded={advancedOpen}>
            <SlidersHorizontal size={14} /> Más filtros <ChevronDown size={14} className={advancedOpen ? 'is-open' : ''} />
          </button>
        </div>

        {advancedOpen && (
          <div className="favorites-admin-filter-grid advanced-filters">
            <label>Productos mínimos<input type="number" min="0" value={filters.minItems} onChange={(event) => setFilter('minItems', event.target.value)} /></label>
            <label>Productos máximos<input type="number" min="0" value={filters.maxItems} onChange={(event) => setFilter('maxItems', event.target.value)} /></label>
            <label>Valor mínimo<input type="number" min="0" step="1000" value={filters.minValue} onChange={(event) => setFilter('minValue', event.target.value)} /></label>
            <label>Valor máximo<input type="number" min="0" step="1000" value={filters.maxValue} onChange={(event) => setFilter('maxValue', event.target.value)} /></label>
          </div>
        )}
      </section>

      {listError && (
        <div className="favorites-admin-glass favorites-admin-feedback error" role="alert">
          <span>{listError}</span>
          <button type="button" onClick={load}>Reintentar listado</button>
        </div>
      )}

      <section className="favorites-admin-glass favorites-admin-table-wrap">
        <table className="favorites-admin-table">
          <colgroup>
            <col className="col-visitor" /><col className="col-products" /><col className="col-count" />
            <col className="col-value" /><col className="col-activity" /><col className="col-status" /><col className="col-action" />
          </colgroup>
          <thead>
            <tr><th>Visitante</th><th>Productos de interés</th><th>Productos</th><th>Valor potencial</th><th>Última actividad</th><th>Señal</th><th>Acción</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="favorites-admin-empty"><RefreshCw size={22} className="is-spinning" /><strong>Cargando favoritos</strong><span>Consultando señales de intención…</span></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="favorites-admin-empty"><PackageSearch size={25} /><strong>No hay favoritos para estos filtros</strong><span>Prueba otra vista o restablece los filtros.</span></td></tr>
            ) : rows.map((row) => {
              const [tone, activity] = activityTone(row);
              return (
                <tr key={row._id}>
                  <td><strong>{aliasFromSession(row.sessionId)}</strong><small title={row.sessionId}>{maskedSession(row.sessionId)}</small></td>
                  <td>
                    <div className="favorites-admin-preview">
                      {(row.productPreview || []).slice(0, 3).map((product, index) => (
                        product.image ? <img key={`${product.productId}-${index}`} src={product.image} alt="" /> : <span key={`${product.productId}-${index}`}><Boxes size={14} /></span>
                      ))}
                      <div><strong>{row.productPreview?.[0]?.title || 'Productos guardados'}</strong><small>{row.itemsCount > 1 ? `y ${row.itemsCount - 1} más` : 'Interés individual'}</small></div>
                    </div>
                  </td>
                  <td className="numeric"><strong>{Number(row.itemsCount || 0)}</strong></td>
                  <td className="numeric"><strong>{money(row.potentialValue)}</strong></td>
                  <td><strong>{elapsed(row.lastUpdate)}</strong><small>{formatDate(row.lastUpdate)}</small></td>
                  <td><span className={`favorites-admin-status ${tone}`}>{activity}</span></td>
                  <td><button type="button" className="favorites-admin-link-button" onClick={() => openDetail(row._id)}><Eye size={14} /> Ver detalle</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <footer className="favorites-admin-pagination">
        <span><strong>{total}</strong> listas · Página {page} de {totalPages}</span>
        <div>
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Siguiente</button>
        </div>
      </footer>

      {detail && (
        <div className="favorites-admin-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
          <aside className="favorites-admin-glass favorites-admin-drawer" role="dialog" aria-modal="true" aria-label="Detalle de favoritos">
            <header>
              <div><span className="favorites-admin-eyebrow">Detalle operativo</span><h2>{aliasFromSession(detail.sessionId)}</h2><p>{maskedSession(detail.sessionId)}</p></div>
              <button type="button" onClick={() => setDetail(null)}><X size={15} /> Cerrar</button>
            </header>
            <div className="favorites-admin-drawer-content">
              {detailLoading ? (
                <div className="favorites-admin-drawer-loading"><RefreshCw size={22} className="is-spinning" /> Cargando detalle…</div>
              ) : (
                <>
                  <section className="favorites-admin-detail-summary">
                    <div><span>Productos</span><strong>{Number(detail.itemsCount || 0)}</strong></div>
                    <div><span>Valor potencial</span><strong>{money(detail.potentialValue)}</strong></div>
                    <div><span>Actualización</span><strong>{elapsed(detail.lastUpdate)}</strong></div>
                    <div><span>Prioridad</span><strong>{priorityLabel(detail.itemsCount, detail.potentialValue)}</strong></div>
                  </section>

                  <section className="favorites-admin-detail-section identity">
                    <div><h3>Identificador de sesión</h3><p>{detail.sessionId}</p></div>
                    <button type="button" onClick={copySession}><Copy size={14} /> Copiar</button>
                  </section>

                  <section className="favorites-admin-detail-section">
                    <div className="favorites-admin-section-title"><div><h3>Productos guardados</h3><p>Precio vigente, variante y disponibilidad actual.</p></div><span>{detail.items?.length || 0}</span></div>
                    <div className="favorites-admin-products">
                      {(detail.items || []).map((item) => {
                        const current = item.current || {};
                        const currentPrice = current.valid ? Number(current.price || 0) : Number(item.price || 0);
                        return (
                          <article key={item._id || `${item.productId}-${item.variantKey}`}>
                            <div className="favorites-admin-product-image">{(current.image || item.image) ? <img src={current.image || item.image} alt="" /> : <Boxes size={20} />}</div>
                            <div className="favorites-admin-product-info">
                              <strong>{current.title || item.title || 'Producto no disponible'}</strong>
                              <span>{current.variantLabel || item.variantLabel || 'Sin variante'} · SKU {current.variantSku || item.sku || '—'}</span>
                              <span>{money(currentPrice)} · {current.inventoryTracked === false ? 'Sin control de inventario' : `Disponible: ${Number(current.availableStock || 0)}`}</span>
                              {(item.alerts || []).map((alert) => <em key={alert.code}><AlertTriangle size={13} /> {alert.message}</em>)}
                            </div>
                            <div className="favorites-admin-product-actions">
                              {item.slug && <a href={`/producto/${item.slug}`} target="_blank" rel="noreferrer" title="Abrir producto"><ArrowUpRight size={15} /></a>}
                              {canDelete && <button type="button" disabled={busy} onClick={() => removeFavorite(item)} title="Retirar de favoritos"><Trash2 size={15} /></button>}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>

                  {canDelete && (
                    <section className="favorites-admin-detail-section danger">
                      <div><h3>Acción destructiva</h3><p>Elimina la lista completa. Esta acción no se puede deshacer.</p></div>
                      <button type="button" disabled={busy} onClick={deleteFavorites}><Trash2 size={14} /> Eliminar lista</button>
                    </section>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
