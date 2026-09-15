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
  Palette,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  ShieldCheck,
  Sparkles,
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

function isHexColor(value) {
  return /^#([0-9A-F]{3}){1,2}$/i.test(String(value || '').trim());
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
    <section className="inventory-plus space-y-5" style={styles.pageText}>
      <header className="inventory-plus__hero">
        <Boxes className="inventory-plus__watermark" strokeWidth={0.8} />
        <div className="inventory-plus__hero-content">
          <div className="min-w-0 self-center">
            <p className="inventory-plus__eyebrow">
              <Sparkles size={15} /> Control inteligente por sedes
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl" style={styles.title}>
              Inventario bajo control
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6" style={styles.muted}>
              Consulta existencias, detecta riesgos y ejecuta movimientos desde un solo espacio. Cada unidad conserva su sede, variante e historial.
            </p>
            <span className="inventory-plus__status">
              <span className="inventory-plus__status-dot" />
              {loading ? 'Sincronizando información' : `${formatNumber(stockRows.length)} registros sincronizados`}
            </span>
          </div>

          <div className="inventory-plus__actions">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.16em]" style={styles.muted}>
              ¿Qué necesitas hacer?
            </p>
            <div className="inventory-plus__action-grid">
              <button
                type="button"
                onClick={() => setAdjustmentModalOpen(true)}
                className="inventory-plus__action-main inline-flex items-center gap-2 px-5 py-3 text-sm font-black"
                style={styles.primaryButton}
              >
                <Plus size={18} />
                Registrar movimiento
              </button>
              <button
                type="button"
                onClick={openGeneralTransferModal}
                className="inventory-plus__action-soft inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-black"
                style={styles.softButton}
              >
                <ArrowRightLeft size={17} /> Mover entre sedes
              </button>
              <button
                type="button"
                onClick={() => setAlertsPanelOpen(true)}
                className="inventory-plus__action-soft inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-black"
                style={styles.softButton}
              >
                <Gauge size={17} /> Centro de control
              </button>
            </div>
            <div className="inventory-plus__utility-row">
              <button
                type="button"
                onClick={loadInventory}
                disabled={loading}
                className="inventory-plus__utility-button inline-flex items-center gap-2 font-black disabled:cursor-not-allowed disabled:opacity-60"
                style={styles.softButton}
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                Actualizar
              </button>
              <InventoryReservationsPanel />
              <InventoryApprovalsPanel onChanged={loadInventory} />
            </div>
          </div>
        </div>

        {error && (
          <div className="relative z-[2] mx-5 mb-5 flex items-start gap-3 px-4 py-3 text-sm font-semibold" style={styles.errorBox}>
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </header>

      <section className="inventory-plus__overview" aria-label="Resumen del inventario">
        <article className="inventory-overview-card inventory-overview-card--feature">
          <PackageSearch className="inventory-overview-card__watermark" strokeWidth={0.9} />
          <p className="inventory-overview-card__label"><ShieldCheck size={17} /> Disponible para vender</p>
          <p className="inventory-overview-card__value">{formatNumber(summary.totalAvailable)}</p>
          <p className="inventory-overview-card__caption">Unidades libres después de descontar reservas.</p>
          <div className="inventory-overview-card__split">
            <MiniMetric label="Stock físico" value={summary.totalStock} />
            <MiniMetric label="Reservado" value={summary.totalReserved} />
          </div>
        </article>

        <article className="inventory-overview-card">
          <AlertCircle className="inventory-overview-card__watermark" strokeWidth={0.9} />
          <p className="inventory-overview-card__label" style={styles.muted}><AlertCircle size={17} style={styles.eyebrow} /> Atención requerida</p>
          <p className="inventory-overview-card__value" style={styles.title}>{formatNumber(summary.lowStock + summary.outOfStock)}</p>
          <p className="inventory-overview-card__caption">Referencias que conviene revisar ahora.</p>
          <div className="inventory-overview-card__split">
            <MiniMetric label="Bajo stock" value={summary.lowStock} />
            <MiniMetric label="Agotados" value={summary.outOfStock} />
          </div>
        </article>

        <article className="inventory-overview-card">
          <Activity className="inventory-overview-card__watermark" strokeWidth={0.9} />
          <p className="inventory-overview-card__label" style={styles.muted}><Activity size={17} style={styles.eyebrow} /> Actividad operativa</p>
          <p className="inventory-overview-card__value" style={styles.title}>{formatNumber(summary.totalMovements)}</p>
          <p className="inventory-overview-card__caption">Movimientos registrados en el historial.</p>
          <div className="inventory-overview-card__split">
            <MiniMetric label="Productos con stock" value={summary.productsWithStock} />
            <MiniMetric label="Sedes visibles" value={branchOptions.length} />
          </div>
        </article>
      </section>

      <section className="inventory-stock-workspace">
        <div className="inventory-stock-workspace__header">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inventory-stock-workspace__icon"><Layers3 size={21} /></span>
            <div className="min-w-0">
              <h2 className="text-xl font-black" style={styles.title}>Existencias por sede</h2>
              <p className="mt-1 text-sm" style={styles.muted}>
                {formatNumber(filteredStockRows.length)} resultado(s) · página {formatNumber(currentPage)} de {formatNumber(totalPages)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={exportInventory}
            disabled={loading || exporting || filteredStockRows.length === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
            style={styles.primaryButton}
          >
            <Download size={16} />
            {exporting ? 'Preparando archivo...' : 'Exportar resultados'}
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
            const color = getVariantColor(row);
            const variantAttributes = getVariantAttributes(row);
            const stockStatus = getStockStatus(row);
            const available = getAvailableStock(row);
            const reserved = getReservedStock(row);
            const canTransfer = available > 0;

            return (
              <article key={row?._id || `${getProductId(row)}-${getBranchId(row)}-${row?.variantKey || getVariantLabel(row)}`} className="inventory-row-card p-4 md:p-5" style={styles.inventoryCard}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center" style={styles.productIconBox}>
                      <Boxes size={22} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-black leading-6" style={styles.title}>{getProductTitle(row)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center px-3 py-1 text-xs font-black" style={styles.badge}>SKU: {getProductSku(row)}</span>
                        <span className="inline-flex items-center px-3 py-1 text-xs font-black" style={stockStatus.style}>{stockStatus.label}</span>
                      </div>
                    </div>
                  </div>

                  <div className="inventory-row-card__actions">
                    <button
                      type="button"
                      onClick={() => openTransferFromCard(row)}
                      disabled={!canTransfer}
                      className="inline-flex items-center gap-2 px-4 py-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60"
                      style={styles.softButton}
                    >
                      <ArrowRightLeft size={15} />
                      Trasladar
                    </button>

                    <button
                      type="button"
                      onClick={() => setMovementsModalRow(row)}
                      className="inline-flex items-center gap-2 px-4 py-3 text-xs font-black transition"
                      style={styles.primaryButton}
                    >
                      <ArrowRightLeft size={15} />
                      Movimientos
                    </button>

                    <button
                      type="button"
                      onClick={() => setKardexModalRow(row)}
                      className="inline-flex items-center gap-2 px-4 py-3 text-xs font-black transition"
                      style={styles.primaryButton}
                    >
                      <BookOpen size={15} />
                      Kardex
                    </button>
                  </div>
                </div>

                <div className="inventory-row-card__facts mt-5">
                  <InfoBlock icon={<Warehouse size={17} />} label="Ubicación" title={getBranchName(row)}>
                    <span className="inline-flex w-fit items-center px-3 py-1 text-xs font-black" style={styles.badge}>{getBranchType(row)}</span>
                  </InfoBlock>

                  <InfoBlock icon={<Ruler size={17} />} label="Variante" title={getVariantLabel(row)}>
                    <div className="flex flex-wrap gap-2">
                      {variantAttributes.length > 0 ? (
                        variantAttributes.map((attribute) => (
                          <span key={`${row?._id || row?.variantKey}-${attribute.key}`} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black" style={styles.badge}>
                            {attribute.key === 'color' && isHexColor(attribute.value) ? (
                              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: attribute.value, border: '1px solid var(--admin-table-border)' }} />
                            ) : attribute.key === 'color' ? (
                              <Palette size={13} />
                            ) : (
                              <Ruler size={13} />
                            )}
                            {attribute.label}: {attribute.value}
                          </span>
                        ))
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black" style={styles.badge}>
                            <Ruler size={13} /> Talla {getVariantSize(row)}
                          </span>
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black" style={styles.badge}>
                            {isHexColor(color) ? (
                              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: color, border: '1px solid var(--admin-table-border)' }} />
                            ) : (
                              <Palette size={13} />
                            )}
                            {color}
                          </span>
                        </>
                      )}
                    </div>
                  </InfoBlock>

                  <div className="inventory-stock-strip grid sm:grid-cols-3">
                    <StockValueBox label="Stock físico" value={row?.stock} style={styles.stockBox} />
                    <StockValueBox label="Reservado" value={reserved} style={styles.reservedBox} />
                    <StockValueBox label="Disponible" value={available} style={styles.availableBox} />
                  </div>
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

function MiniMetric({ label, value }) {
  return (
    <div className="inventory-overview-mini">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  );
}

function InfoBlock({ icon, label, title, children }) {
  return (
    <div className="inventory-row-card__info p-4" style={styles.filterCard}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center" style={styles.productIconBox}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>{label}</p>
          <p className="mt-1 text-sm font-black leading-5" style={styles.title}>{title}</p>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}

function StockValueBox({ label, value, style }) {
  return (
    <div className="px-4 py-4" style={style}>
      <p className="text-[10px] font-black uppercase tracking-wide" style={styles.muted}>{label}</p>
      <p className="mt-1 text-2xl font-black" style={styles.title}>{formatNumber(value)}</p>
    </div>
  );
}
