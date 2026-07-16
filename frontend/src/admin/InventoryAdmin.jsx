// frontend/src/admin/InventoryAdmin.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  BellRing,
  BookOpen,
  Boxes,
  Clock,
  Download,
  PackageSearch,
  Palette,
  Plus,
  RefreshCw,
  Ruler,
  Warehouse,
} from 'lucide-react';
import api from '../lib/api';
import InventoryAdjustmentModal from './inventory/components/InventoryAdjustmentModal';
import InventoryAlertsPanel from './inventory/components/InventoryAlertsPanel';
import InventoryKardexModal from './inventory/components/InventoryKardexModal';
import InventoryMovementsModal from './inventory/components/InventoryMovementsModal';
import InventoryReservationsPanel from './inventory/components/InventoryReservationsPanel';
import InventoryTransferModal from './inventory/components/InventoryTransferModal';

const LOW_STOCK_LIMIT = 5;
const PAGE_LIMIT = 100;
const MAX_PAGES = 100;

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

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.includes(',') || text.includes(';') || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadVisibleInventoryCsv(rows = []) {
  const headers = [
    'Producto',
    'SKU',
    'Sede',
    'Codigo sede',
    'Tipo sede',
    'Talla',
    'Color',
    'Stock fisico',
    'Reservado',
    'Disponible',
    'Punto minimo',
    'Estado',
  ];

  const lines = [headers.map(escapeCsv).join(',')];

  rows.forEach((row) => {
    const status = getStockStatus(row).label;
    lines.push(
      [
        getProductTitle(row),
        getProductSku(row),
        getBranchName(row),
        getBranchCode(row),
        getBranchType(row),
        getVariantSize(row),
        getVariantColor(row),
        Number(row?.stock || 0),
        getReservedStock(row),
        getAvailableStock(row),
        getLowStockLimit(row),
        status,
      ]
        .map(escapeCsv)
        .join(',')
    );
  });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `inventario_filtrado_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
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
  const [movementsModalRow, setMovementsModalRow] = useState(null);
  const [kardexModalRow, setKardexModalRow] = useState(null);
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);

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

  const clearFilters = () => {
    setSearchTerm('');
    setBranchFilter('all');
    setStockFilter('all');
  };

  const openGeneralTransferModal = () => {
    setInitialTransferStockRow(null);
    setTransferModalOpen(true);
  };

  const openTransferFromCard = (row) => {
    setInitialTransferStockRow(row);
    setTransferModalOpen(true);
  };

  const closeTransferModal = () => {
    setTransferModalOpen(false);
    setInitialTransferStockRow(null);
  };

  return (
    <section className="space-y-6" style={styles.pageText}>
      <div className="p-6 backdrop-blur" style={styles.headerCard}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={styles.eyebrow}>
              Inventario por sedes
            </p>
            <h1 className="mt-2 text-2xl font-black md:text-3xl" style={styles.title}>
              Inventario
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6" style={styles.muted}>
              Controla el stock físico, reservado y disponible por sede, producto, talla, color y movimientos. Esta vista carga todas las páginas del backend para no trabajar con solo 20 registros.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadInventory}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-70"
              style={styles.softButton}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>

            <button
              type="button"
              onClick={() => setAdjustmentModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-black transition"
              style={styles.primaryButton}
            >
              <Plus size={16} />
              Nuevo ajuste
            </button>

            <button
              type="button"
              onClick={openGeneralTransferModal}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-black transition"
              style={styles.softButton}
            >
              <ArrowRightLeft size={16} />
              Trasladar
            </button>

            <button
              type="button"
              onClick={() => setAlertsPanelOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-black transition"
              style={styles.softButton}
            >
              <BellRing size={16} />
              Alertas
            </button>

            <InventoryReservationsPanel />
          </div>
        </div>

        {error && (
          <div className="mt-5 flex items-start gap-3 px-4 py-3 text-sm font-semibold" style={styles.errorBox}>
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Productos con stock" value={summary.productsWithStock} description="Productos con existencia" icon={<PackageSearch size={20} />} />
        <SummaryCard label="Stock físico" value={summary.totalStock} description="Todas las sedes" icon={<Boxes size={20} />} />
        <SummaryCard label="Reservado" value={summary.totalReserved} description="Apartado por órdenes" icon={<Clock size={20} />} />
        <SummaryCard label="Disponible" value={summary.totalAvailable} description="Listo para venta" icon={<PackageSearch size={20} />} />
        <SummaryCard label="Bajo stock" value={summary.lowStock} description="Según punto mínimo" icon={<AlertCircle size={20} />} />
        <SummaryCard label="Movimientos" value={summary.totalMovements} description="Entradas, salidas y traslados" icon={<ArrowRightLeft size={20} />} />
      </div>

      <div className="p-6 backdrop-blur" style={styles.card}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-black" style={styles.title}>Stock por sede</h2>
            <p className="mt-1 text-sm leading-6" style={styles.muted}>
              Mostrando {formatNumber(filteredStockRows.length)} de {formatNumber(stockRows.length)} registros cargados.
            </p>
          </div>

          <button
            type="button"
            onClick={() => downloadVisibleInventoryCsv(filteredStockRows)}
            disabled={loading || filteredStockRows.length === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
            style={styles.primaryButton}
          >
            <Download size={16} />
            Exportar vista actual
          </button>
        </div>

        <div className="mt-5 p-4" style={styles.filterCard}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px_220px_auto] lg:items-end">
            <div>
              <label className="text-xs font-black uppercase tracking-wide" style={styles.muted}>Buscar</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Producto, SKU, sede, talla o color..."
                className="mt-2 w-full px-4 py-3 text-sm transition"
                style={styles.input}
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wide" style={styles.muted}>Sede</label>
              <select
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                className="mt-2 w-full px-4 py-3 text-sm font-semibold transition"
                style={styles.input}
              >
                <option value="all">Todas las sedes</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wide" style={styles.muted}>Estado</label>
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
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
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

          {!loading && filteredStockRows.map((row) => {
            const color = getVariantColor(row);
            const stockStatus = getStockStatus(row);
            const available = getAvailableStock(row);
            const reserved = getReservedStock(row);
            const canTransfer = available > 0;

            return (
              <article key={row?._id || `${getProductId(row)}-${getBranchId(row)}-${getVariantSize(row)}-${getVariantColor(row)}`} className="p-4 md:p-5" style={styles.inventoryCard}>
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

                  <div className="flex flex-wrap items-center gap-2">
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

                <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_1.25fr]">
                  <InfoBlock icon={<Warehouse size={17} />} label="Ubicación" title={getBranchName(row)}>
                    <span className="inline-flex w-fit items-center px-3 py-1 text-xs font-black" style={styles.badge}>{getBranchType(row)}</span>
                  </InfoBlock>

                  <InfoBlock icon={<Ruler size={17} />} label="Variante" title="Talla y color">
                    <div className="flex flex-wrap gap-2">
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
                    </div>
                  </InfoBlock>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <StockValueBox label="Stock físico" value={row?.stock} style={styles.stockBox} />
                    <StockValueBox label="Reservado" value={reserved} style={styles.reservedBox} />
                    <StockValueBox label="Disponible" value={available} style={styles.availableBox} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <InventoryAdjustmentModal open={adjustmentModalOpen} onClose={() => setAdjustmentModalOpen(false)} stockRows={stockRows} onSaved={loadInventory} />
      <InventoryTransferModal open={transferModalOpen} onClose={closeTransferModal} stockRows={stockRows} initialStockRow={initialTransferStockRow} onSaved={loadInventory} />
      <InventoryMovementsModal open={Boolean(movementsModalRow)} onClose={() => setMovementsModalRow(null)} stockRow={movementsModalRow} onChanged={loadInventory} />
      <InventoryKardexModal open={Boolean(kardexModalRow)} onClose={() => setKardexModalRow(null)} stockRow={kardexModalRow} />
      <InventoryAlertsPanel open={alertsPanelOpen} onClose={() => setAlertsPanelOpen(false)} />
    </section>
  );
}

function SummaryCard({ label, value, description, icon }) {
  return (
    <article className="p-5" style={styles.statCard}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold" style={styles.muted}>{label}</span>
        <span style={styles.eyebrow}>{icon}</span>
      </div>
      <p className="mt-4 text-3xl font-black" style={styles.title}>{formatNumber(value)}</p>
      <p className="mt-1 text-xs font-semibold" style={styles.muted}>{description}</p>
    </article>
  );
}

function InfoBlock({ icon, label, title, children }) {
  return (
    <div className="p-4" style={styles.filterCard}>
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
