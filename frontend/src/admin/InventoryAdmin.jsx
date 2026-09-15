// frontend/src/admin/InventoryAdmin.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  BookOpen,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Download,
  Gauge,
  Layers3,
  PackageSearch,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  ShieldCheck,
  Warehouse,
} from 'lucide-react';
import api from '../lib/api';
import InventoryAdjustmentModal from './inventory/components/InventoryAdjustmentModal';
import InventoryApprovalsPanel from './inventory/components/InventoryApprovalsPanel';
import InventoryAlertsPanel from './inventory/components/InventoryAlertsPanel';
import InventoryKardexModal from './inventory/components/InventoryKardexModal';
import InventoryMovementsModal from './inventory/components/InventoryMovementsModal';
import InventoryReservationsPanel from './inventory/components/InventoryReservationsPanel';
import InventoryTransferModal from './inventory/components/InventoryTransferModal';
import './inventory/inventoryPlus.css';

const LOW_STOCK_LIMIT = 5;
const PAGE_LIMIT = 100;
const MAX_PAGES = 100;
const ROWS_PER_PAGE = 8;

const STOCK_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'withStock', label: 'Con stock' },
  { value: 'withoutStock', label: 'Sin stock' },
  { value: 'lowStock', label: 'Bajo stock' },
];

const styles = {
  pageText: { color: 'var(--admin-page-text)' },
  headerCard: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-glass-strong-bg)',
    color: 'var(--admin-card-text)',
    boxShadow: 'var(--admin-glass-shadow)',
  },
  card: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-glass-bg)',
    color: 'var(--admin-card-text)',
    boxShadow: 'var(--admin-glass-shadow)',
  },
  statCard: {
    borderRadius: 'calc(var(--admin-radius) + 6px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
    boxShadow: 'var(--admin-glass-shadow)',
  },
  filterCard: {
    borderRadius: 'calc(var(--admin-radius) + 4px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
  },
  title: { color: 'var(--admin-card-text)' },
  muted: { color: 'var(--admin-card-muted-text)' },
  eyebrow: { color: 'var(--admin-primary)' },
  input: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-input-border)',
    background: 'var(--admin-input-bg)',
    color: 'var(--admin-input-text)',
    outline: 'none',
  },
  primaryButton: {
    borderRadius: '999px',
    border: '1px solid color-mix(in srgb, var(--admin-button-bg) 70%, rgba(255,255,255,0.45) 30%)',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-button-bg) 82%, #0f172a 18%), color-mix(in srgb, var(--admin-button-bg) 58%, #0f172a 42%))',
    color: '#ffffff',
    boxShadow:
      '0 12px 28px color-mix(in srgb, var(--admin-button-bg) 24%, transparent), inset 0 1px 0 rgba(255,255,255,0.30)',
    textShadow: '0 1px 8px rgba(0,0,0,0.52)',
  },
  softButton: {
    borderRadius: '999px',
    border: '1px solid var(--admin-button-soft-border)',
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
  },
  errorBox: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-danger)',
    background: 'var(--admin-danger-soft-bg)',
    color: 'var(--admin-danger-text)',
  },
  inventoryCard: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 90%, var(--admin-primary) 10%), var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
    boxShadow: '0 16px 38px color-mix(in srgb, var(--admin-primary) 10%, transparent)',
  },
  productIconBox: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary)',
  },
  badge: {
    borderRadius: '999px',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary-soft-text)',
    whiteSpace: 'nowrap',
  },
  stockBox: {
    borderRadius: 'calc(var(--admin-radius) + 2px)',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary-soft-text)',
  },
  reservedBox: {
    borderRadius: 'calc(var(--admin-radius) + 2px)',
    border: '1px solid color-mix(in srgb, var(--admin-warning) 55%, var(--admin-card-border))',
    background: 'color-mix(in srgb, var(--admin-warning-soft-bg) 70%, var(--admin-card-bg) 30%)',
    color: 'var(--admin-card-text)',
  },
  availableBox: {
    borderRadius: 'calc(var(--admin-radius) + 2px)',
    border: '1px solid color-mix(in srgb, #22c55e 55%, var(--admin-card-border))',
    background: 'color-mix(in srgb, #22c55e 12%, var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
  },
  lowStockBadge: {
    borderRadius: '999px',
    border: '1px solid var(--admin-warning)',
    background: 'var(--admin-warning-soft-bg)',
    color: 'var(--admin-warning-text)',
    whiteSpace: 'nowrap',
  },
  outStockBadge: {
    borderRadius: '999px',
    border: '1px solid var(--admin-danger)',
    background: 'var(--admin-danger-soft-bg)',
    color: 'var(--admin-danger-text)',
    whiteSpace: 'nowrap',
  },
  goodStockBadge: {
    borderRadius: '999px',
    border: '1px solid color-mix(in srgb, #22c55e 55%, var(--admin-card-border))',
    background: 'color-mix(in srgb, #22c55e 12%, var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
    whiteSpace: 'nowrap',
  },
};

function formatNumber(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('es-CO').format(number);
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalize(value) {
  return cleanText(value).toLowerCase();
}

function getObjectId(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value || '');
}

function getProductId(row) {
  return getObjectId(row?.product || row?.productId || row?.productSnapshot?._id || row?.productSnapshot?.id);
}

function getBranchId(row) {
  return getObjectId(row?.branch || row?.branchId || row?.branchSnapshot?._id || row?.branchSnapshot?.id);
}

function getProductTitle(row) {
  return row?.product?.title || row?.productSnapshot?.title || row?.title || 'Producto sin nombre';
}

function getProductSku(row) {
  return row?.product?.sku || row?.productSnapshot?.sku || row?.variant?.sku || row?.sku || '—';
}

function getBranchName(row) {
  return row?.branch?.name || row?.branchSnapshot?.name || row?.branchName || row?.name || 'Sede no definida';
}

function getBranchCode(row) {
  return row?.branch?.code || row?.branchSnapshot?.code || row?.code || '';
}

function getBranchType(row) {
  const type = normalize(row?.branch?.type || row?.branchSnapshot?.type || row?.type || '');
  const branchName = normalize(getBranchName(row));
  if (type.includes('warehouse') || type.includes('bodega')) return 'Bodega';
  if (branchName.includes('bodega')) return 'Bodega';
  return 'Sede';
}

function getVariantSize(row) {
  return row?.variant?.size || row?.size || '—';
}

function getVariantColor(row) {
  return row?.variant?.color || row?.color || '—';
}

function getVariantAttributes(row) {
  const attributes =
    row?.variant?.attributes ||
    row?.variantAttributes ||
    [];

  return (Array.isArray(attributes) ? attributes : [])
    .map((attribute) => ({
      key: String(attribute?.key || attribute?.label || '').trim(),
      label: String(attribute?.label || attribute?.key || '').trim(),
      value: String(attribute?.value || '').trim(),
    }))
    .filter((attribute) => attribute.key && attribute.value)
    .slice(0, 4);
}

function getVariantLabel(row) {
  const explicit = String(
    row?.variant?.label || row?.variantLabel || ''
  ).trim();
  if (explicit) return explicit;

  const attributes = getVariantAttributes(row);
  if (attributes.length) {
    return attributes.map((attribute) => attribute.value).join(' / ');
  }

  return [getVariantSize(row), getVariantColor(row)]
    .filter((value) => value && value !== '—')
    .join(' / ') || 'Presentación general';
}

function getVariantAttributesText(row) {
  return getVariantAttributes(row)
    .map((attribute) => `${attribute.label}: ${attribute.value}`)
    .join(' | ');
}

function getReservedStock(row) {
  const reservedStock = Number(row?.reservedStock || 0);
  return Number.isFinite(reservedStock) && reservedStock > 0 ? reservedStock : 0;
}

function getAvailableStock(row) {
  if (typeof row?.availableStock === 'number') return Math.max(0, row.availableStock);
  const stock = Number(row?.stock || 0);
  return Math.max(0, stock - getReservedStock(row));
}

function getLowStockLimit(row) {
  const value = Number(
    row?.reorderPoint ||
      row?.product?.reorderPoint ||
      row?.productSnapshot?.reorderPoint ||
      row?.product?.stockMin ||
      row?.productSnapshot?.stockMin ||
      LOW_STOCK_LIMIT
  );

  return Number.isFinite(value) && value > 0 ? value : LOW_STOCK_LIMIT;
}

function getStockStatus(row) {
  const available = getAvailableStock(row);
  const lowLimit = getLowStockLimit(row);

  if (available <= 0) return { label: 'Sin stock', style: styles.outStockBadge };
  if (available <= lowLimit) return { label: 'Bajo stock', style: styles.lowStockBadge };
  return { label: 'Disponible', style: styles.goodStockBadge };
}

function matchesStockFilter(row, stockFilter) {
  const available = getAvailableStock(row);
  const lowLimit = getLowStockLimit(row);

  if (stockFilter === 'withStock') return available > 0;
  if (stockFilter === 'withoutStock') return available <= 0;
  if (stockFilter === 'lowStock') return available > 0 && available <= lowLimit;
  return true;
}

function getRowsFromResponse(response) {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.data)) return data.data.data;
  return [];
}

async function fetchAllPages(endpoint, params = {}) {
  const rows = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await api.get(endpoint, {
      params: {
        ...params,
        page,
        limit: PAGE_LIMIT,
      },
    });

    rows.push(...getRowsFromResponse(response));

    const responseTotalPages = Number(response?.data?.totalPages || 1);
    totalPages = Number.isFinite(responseTotalPages) && responseTotalPages > 0 ? responseTotalPages : 1;
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES);

  return rows;
}

function buildBranchOptions(branches = [], stockRows = []) {
  const map = new Map();

  branches.forEach((branch) => {
    const id = getBranchId(branch);
    if (!id) return;
    map.set(id, {
      id,
      name: getBranchName(branch),
      code: getBranchCode(branch),
      type: getBranchType(branch),
    });
  });

  stockRows.forEach((row) => {
    const id = getBranchId(row);
    if (!id || map.has(id)) return;
    map.set(id, {
      id,
      name: getBranchName(row),
      code: getBranchCode(row),
      type: getBranchType(row),
    });
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function getExportFilename(headers = {}) {
  const disposition = String(headers?.['content-disposition'] || '');
  const match = disposition.match(/filename="?([^";]+)"?/i);

  return match?.[1] || `inventario_por_sedes_${Date.now()}.csv`;
}

export default function InventoryAdmin() {
  const [stockRows, setStockRows] = useState([]);
  const [movements, setMovements] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [initialTransferStockRow, setInitialTransferStockRow] = useState(null);
  const [initialTransferSuggestion, setInitialTransferSuggestion] = useState(null);
  const [movementsModalRow, setMovementsModalRow] = useState(null);
  const [kardexModalRow, setKardexModalRow] = useState(null);
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [stockData, movementsData, branchesResponse] = await Promise.all([
        fetchAllPages('/api/admin/inventory/stock'),
        fetchAllPages('/api/admin/inventory/movements'),
        api.get('/api/admin/branches', { params: { page: 1, limit: 100, sort: 'name' } }),
      ]);

      setStockRows(stockData);
      setMovements(movementsData);
      setBranches(getRowsFromResponse(branchesResponse));
    } catch (err) {
      console.error('❌ Error cargando inventario:', err);
      setError(
        err?.response?.data?.message ||
          err?.userMessage ||
          'No se pudo cargar el inventario completo.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const branchOptions = useMemo(() => buildBranchOptions(branches, stockRows), [branches, stockRows]);

  const filteredStockRows = useMemo(() => {
    const term = normalize(searchTerm);

    return stockRows.filter((row) => {
      const searchText = [
        getProductTitle(row),
        getProductSku(row),
        getBranchName(row),
        getBranchCode(row),
        getBranchType(row),
        getVariantLabel(row),
        getVariantAttributesText(row),
        getVariantSize(row),
        getVariantColor(row),
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = !term || searchText.includes(term);
      const matchesBranch = branchFilter === 'all' || getBranchId(row) === branchFilter;
      const matchesStock = matchesStockFilter(row, stockFilter);

      return matchesSearch && matchesBranch && matchesStock;
    });
  }, [stockRows, searchTerm, branchFilter, stockFilter]);

  const summary = useMemo(() => {
    const productsWithStock = new Set();
    let totalStock = 0;
    let totalReserved = 0;
    let totalAvailable = 0;
    let lowStock = 0;
    let outOfStock = 0;

    stockRows.forEach((row) => {
      const stock = Number(row?.stock || 0);
      const reserved = getReservedStock(row);
      const available = getAvailableStock(row);

      totalStock += stock;
      totalReserved += reserved;
      totalAvailable += available;

      if (stock > 0) productsWithStock.add(getProductId(row) || row?._id);
      if (available <= 0) outOfStock += 1;
      if (available > 0 && available <= getLowStockLimit(row)) lowStock += 1;
    });

    return {
      productsWithStock: productsWithStock.size,
      totalStock,
      totalReserved,
      totalAvailable,
      totalMovements: movements.length,
      lowStock,
      outOfStock,
    };
  }, [stockRows, movements]);

  const hasActiveFilters = searchTerm.trim() !== '' || branchFilter !== 'all' || stockFilter !== 'all';

  const totalPages = Math.max(1, Math.ceil(filteredStockRows.length / ROWS_PER_PAGE));
  const visibleStockRows = useMemo(() => {
    const firstRow = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredStockRows.slice(firstRow, firstRow + ROWS_PER_PAGE);
  }, [currentPage, filteredStockRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, branchFilter, stockFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const clearFilters = () => {
    setSearchTerm('');
    setBranchFilter('all');
    setStockFilter('all');
  };

  const exportInventory = async () => {
    try {
      setExporting(true);
      setError('');

      const response = await api.get('/api/admin/inventory/export', {
        params: {
          ...(searchTerm.trim() ? { q: searchTerm.trim() } : {}),
          ...(branchFilter !== 'all' ? { branchId: branchFilter } : {}),
          ...(stockFilter !== 'all' ? { stockStatus: stockFilter } : {}),
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');

      link.href = url;
      link.download = getExportFilename(response.headers);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('❌ Error exportando inventario:', err);
      setError('No se pudo exportar el inventario. Verifica que tu perfil tenga permiso de exportación.');
    } finally {
      setExporting(false);
    }
  };

  const openGeneralTransferModal = () => {
    setInitialTransferStockRow(null);
    setInitialTransferSuggestion(null);
    setTransferModalOpen(true);
  };

  const openTransferFromCard = (row) => {
    setInitialTransferStockRow(row);
    setInitialTransferSuggestion(null);
    setTransferModalOpen(true);
  };

  const openSuggestedTransfer = (suggestion) => {
    const sourceStockRow = stockRows.find(
      (row) => getObjectId(row) === String(suggestion?.sourceStockId || '')
    );

    if (!sourceStockRow) {
      setError('No se encontró el inventario de origen sugerido. Actualiza la vista e inténtalo nuevamente.');
      return;
    }

    setError('');
    setInitialTransferStockRow(sourceStockRow);
    setInitialTransferSuggestion({
      sourceStockId: suggestion.sourceStockId,
      destinationBranchId: suggestion?.destination?.id || '',
      quantity: suggestion.quantity,
      reason: suggestion.reason,
      reference: `REPOSICION-${suggestion?.product?.sku || 'INVENTARIO'}`,
      notes: 'Traslado preparado desde el centro de control de inventario.',
    });
    setAlertsPanelOpen(false);
    setTransferModalOpen(true);
  };

  const closeTransferModal = () => {
    setTransferModalOpen(false);
    setInitialTransferStockRow(null);
    setInitialTransferSuggestion(null);
  };

  return (
    <section className="inventory-plus" style={styles.pageText}>
      <header className="inventory-plus__hero">
        <Boxes className="inventory-plus__watermark" strokeWidth={0.8} />
        <div className="inventory-plus__hero-content">
          <div className="inventory-plus__identity">
            <span className="inventory-plus__identity-icon"><Boxes size={23} /></span>
            <div className="min-w-0">
              <div className="inventory-plus__title-line">
                <h1 style={styles.title}>Inventario</h1>
                <span className="inventory-plus__status">
                  <span className="inventory-plus__status-dot" />
                  {loading ? 'Actualizando' : 'Datos al día'}
                </span>
              </div>
              <p style={styles.muted}>Existencias, riesgos y movimientos de todas tus sedes.</p>
            </div>
          </div>

          <div className="inventory-plus__main-actions" aria-label="Acciones principales de inventario">
            <button
              type="button"
              onClick={() => setAdjustmentModalOpen(true)}
              className="inventory-plus__action-main"
              style={styles.primaryButton}
            >
              <Plus size={18} /> Nuevo movimiento
            </button>
            <button type="button" onClick={openGeneralTransferModal} className="inventory-plus__action-soft" style={styles.softButton}>
              <ArrowRightLeft size={17} /> Trasladar
            </button>
            <button type="button" onClick={() => setAlertsPanelOpen(true)} className="inventory-plus__action-soft" style={styles.softButton}>
              <Gauge size={17} /> Centro de control
            </button>
            <button
              type="button"
              onClick={loadInventory}
              disabled={loading}
              className="inventory-plus__refresh disabled:cursor-not-allowed disabled:opacity-60"
              style={styles.softButton}
              title="Actualizar inventario"
              aria-label="Actualizar inventario"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="inventory-plus__secondary-actions">
          <div className="inventory-plus__sync-copy">
            <ShieldCheck size={15} />
            <strong>{formatNumber(stockRows.length)} registros</strong>
            <span>verificados por sede y variante</span>
          </div>
          <div className="inventory-plus__utility-row">
            <InventoryReservationsPanel />
            <InventoryApprovalsPanel onChanged={loadInventory} />
          </div>
        </div>

        {error && (
          <div className="inventory-plus__error flex items-start gap-3 px-4 py-3 text-sm font-semibold" style={styles.errorBox}>
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </header>

      <section className="inventory-plus__overview" aria-label="Estado general del inventario">
        <SummaryMetric icon={<PackageSearch size={19} />} label="Disponible" value={summary.totalAvailable} hint="listo para vender" tone="primary" />
        <SummaryMetric icon={<Boxes size={19} />} label="Stock físico" value={summary.totalStock} hint="en todas las sedes" />
        <SummaryMetric icon={<ShieldCheck size={19} />} label="Reservado" value={summary.totalReserved} hint="apartado por pedidos" />
        <SummaryMetric icon={<AlertCircle size={19} />} label="Bajo stock" value={summary.lowStock} hint="requiere atención" tone={summary.lowStock > 0 ? 'warning' : 'success'} />
        <SummaryMetric icon={<PackageSearch size={19} />} label="Agotados" value={summary.outOfStock} hint="sin unidades" tone={summary.outOfStock > 0 ? 'danger' : 'success'} />
        <SummaryMetric icon={<Activity size={19} />} label="Movimientos" value={summary.totalMovements} hint="en el historial" />
      </section>

      <section className="inventory-stock-workspace">
        <div className="inventory-stock-workspace__header">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inventory-stock-workspace__icon"><Layers3 size={21} /></span>
            <div className="min-w-0">
              <h2 className="text-lg font-black" style={styles.title}>Existencias</h2>
              <p className="text-xs" style={styles.muted}>
                {formatNumber(filteredStockRows.length)} resultados · página {formatNumber(currentPage)} de {formatNumber(totalPages)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={exportInventory}
            disabled={loading || exporting || filteredStockRows.length === 0}
            className="inventory-export-button inline-flex items-center justify-center gap-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
            style={styles.softButton}
          >
            <Download size={16} />
            {exporting ? 'Preparando archivo...' : 'Exportar CSV'}
          </button>
        </div>

        <div className="inventory-filter-bar">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_190px_auto] lg:items-end">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wide" style={styles.muted}>Buscar producto o variante</label>
              <div className="relative mt-2">
                <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={styles.muted} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Nombre, SKU, talla, color..."
                  className="w-full py-3 pl-11 pr-4 text-sm transition"
                  style={styles.input}
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wide" style={styles.muted}>Ubicación</label>
              <select
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                className="mt-2 w-full px-4 py-3 text-sm font-semibold transition"
                style={styles.input}
              >
                <option value="all">Todas las sedes</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wide" style={styles.muted}>Disponibilidad</label>
              <select
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value)}
                className="mt-2 w-full px-4 py-3 text-sm font-semibold transition"
                style={styles.input}
              >
                {STOCK_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="inline-flex items-center justify-center px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50"
              style={styles.softButton}
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="inventory-row-list">
          {loading && (
            <div className="px-4 py-12 text-center text-sm font-semibold" style={styles.muted}>
              Cargando inventario completo...
            </div>
          )}

          {!loading && filteredStockRows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm font-semibold" style={styles.muted}>
              No hay registros de inventario para mostrar.
            </div>
          )}

          {!loading && visibleStockRows.map((row) => {
            const stockStatus = getStockStatus(row);
            const available = getAvailableStock(row);
            const reserved = getReservedStock(row);
            const canTransfer = available > 0;

            return (
              <article key={row?._id || `${getProductId(row)}-${getBranchId(row)}-${row?.variantKey || getVariantLabel(row)}`} className="inventory-row-card" style={styles.inventoryCard}>
                <div className="inventory-row-card__product">
                  <div className="inventory-row-card__icon" style={styles.productIconBox}><Boxes size={20} /></div>
                  <div className="min-w-0">
                    <div className="inventory-row-card__name-line">
                      <p className="inventory-row-card__name" style={styles.title}>{getProductTitle(row)}</p>
                      <span className="inventory-row-card__status" style={stockStatus.style}>{stockStatus.label}</span>
                    </div>
                    <p className="inventory-row-card__sku" style={styles.muted}>SKU {getProductSku(row)}</p>
                  </div>
                </div>

                <div className="inventory-row-card__details">
                  <RowFact icon={<Warehouse size={15} />} label="Ubicación" value={getBranchName(row)} />
                  <RowFact icon={<Ruler size={15} />} label="Variante" value={getVariantLabel(row)} />
                </div>

                <div className="inventory-stock-strip">
                  <StockValueBox label="Físico" value={row?.stock} style={styles.stockBox} />
                  <StockValueBox label="Reservado" value={reserved} style={styles.reservedBox} />
                  <StockValueBox label="Disponible" value={available} style={styles.availableBox} />
                </div>

                <div className="inventory-row-card__actions">
                    <button
                      type="button"
                      onClick={() => openTransferFromCard(row)}
                      disabled={!canTransfer}
                      className="inventory-row-action inventory-row-action--soft disabled:cursor-not-allowed disabled:opacity-60"
                      style={styles.softButton}
                      title="Trasladar entre sedes"
                    >
                      <ArrowRightLeft size={15} />
                      Trasladar
                    </button>

                    <button
                      type="button"
                      onClick={() => setMovementsModalRow(row)}
                      className="inventory-row-action inventory-row-action--soft"
                      style={styles.softButton}
                    >
                      <Activity size={15} />
                      Movimientos
                    </button>

                    <button
                      type="button"
                      onClick={() => setKardexModalRow(row)}
                      className="inventory-row-action inventory-row-action--primary"
                      style={styles.primaryButton}
                    >
                      <BookOpen size={15} />
                      Kardex
                    </button>
                </div>
              </article>
            );
          })}
        </div>

        {!loading && filteredStockRows.length > 0 && (
          <div className="inventory-pagination">
            <p className="text-sm font-semibold" style={styles.muted}>
              Mostrando {formatNumber((currentPage - 1) * ROWS_PER_PAGE + 1)}–{formatNumber(Math.min(currentPage * ROWS_PER_PAGE, filteredStockRows.length))} de {formatNumber(filteredStockRows.length)}
            </p>
            <div className="inventory-pagination__controls">
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} title="Página anterior">
                <ChevronLeft size={17} />
              </button>
              <span className="px-2 text-sm font-black" style={styles.title}>{currentPage} / {totalPages}</span>
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} title="Página siguiente">
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </section>

      <InventoryAdjustmentModal open={adjustmentModalOpen} onClose={() => setAdjustmentModalOpen(false)} stockRows={stockRows} onSaved={loadInventory} />
      <InventoryTransferModal open={transferModalOpen} onClose={closeTransferModal} stockRows={stockRows} initialStockRow={initialTransferStockRow} initialSuggestion={initialTransferSuggestion} onSaved={loadInventory} />
      <InventoryMovementsModal open={Boolean(movementsModalRow)} onClose={() => setMovementsModalRow(null)} stockRow={movementsModalRow} onChanged={loadInventory} />
      <InventoryKardexModal open={Boolean(kardexModalRow)} onClose={() => setKardexModalRow(null)} stockRow={kardexModalRow} />
      <InventoryAlertsPanel open={alertsPanelOpen} onClose={() => setAlertsPanelOpen(false)} onPrepareTransfer={openSuggestedTransfer} />
    </section>
  );
}

function SummaryMetric({ icon, label, value, hint, tone = 'neutral' }) {
  return (
    <article className={`inventory-summary-metric inventory-summary-metric--${tone}`}>
      <span className="inventory-summary-metric__icon">{icon}</span>
      <div>
        <p className="inventory-summary-metric__label">{label}</p>
        <p className="inventory-summary-metric__value">{formatNumber(value)}</p>
        <p className="inventory-summary-metric__hint">{hint}</p>
      </div>
    </article>
  );
}

function RowFact({ icon, label, value }) {
  return (
    <div className="inventory-row-fact">
      <span className="inventory-row-fact__icon">{icon}</span>
      <div className="min-w-0">
        <p className="inventory-row-fact__label">{label}</p>
        <p className="inventory-row-fact__value">{value}</p>
      </div>
    </div>
  );
}

function StockValueBox({ label, value, style }) {
  return (
    <div className="inventory-stock-value" style={style}>
      <p>{label}</p>
      <strong>{formatNumber(value)}</strong>
    </div>
  );
}
