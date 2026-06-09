// frontend/src/admin/InventoryAdmin.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PackageSearch,
  RefreshCw,
  Plus,
  ArrowRightLeft,
  AlertCircle,
  MapPin,
  Boxes,
  Warehouse,
  Ruler,
  Palette,
} from 'lucide-react';
import api from '../lib/api';
import InventoryAdjustmentModal from './inventory/components/InventoryAdjustmentModal';
import InventoryMovementsModal from './inventory/components/InventoryMovementsModal';
import InventoryTransferModal from './inventory/components/InventoryTransferModal';

const LOW_STOCK_LIMIT = 5;

const STOCK_FILTERS = [
  {
    value: 'all',
    label: 'Todos',
  },
  {
    value: 'withStock',
    label: 'Con stock',
  },
  {
    value: 'withoutStock',
    label: 'Sin stock',
  },
  {
    value: 'lowStock',
    label: 'Bajo stock',
  },
];

const styles = {
  pageText: {
    color: 'var(--admin-page-text)',
  },

  headerCard: {
    borderRadius: 'calc(var(--admin-radius) + 6px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-glass-strong-bg)',
    color: 'var(--admin-card-text)',
    boxShadow: 'var(--admin-glass-shadow)',
  },

  card: {
    borderRadius: 'calc(var(--admin-radius) + 6px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-glass-bg)',
    color: 'var(--admin-card-text)',
    boxShadow: 'var(--admin-glass-shadow)',
  },

  statCard: {
    borderRadius: 'calc(var(--admin-radius) + 4px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-glass-bg)',
    color: 'var(--admin-card-text)',
    boxShadow: 'var(--admin-glass-shadow)',
  },

  filterCard: {
    borderRadius: 'calc(var(--admin-radius) + 2px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
  },

  eyebrow: {
    color: 'var(--admin-primary)',
  },

  title: {
    color: 'var(--admin-card-text)',
  },

  muted: {
    color: 'var(--admin-card-muted-text)',
  },

  icon: {
    color: 'var(--admin-primary)',
  },

  secondaryButton: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-button-bg)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-text)',
    boxShadow: '0 12px 26px color-mix(in srgb, var(--admin-primary) 22%, transparent)',
  },

  primaryButton: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-button-bg)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-text)',
    boxShadow: '0 12px 26px color-mix(in srgb, var(--admin-primary) 22%, transparent)',
  },

  softButton: {
    borderRadius: 'var(--admin-radius)',
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

  input: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-input-border)',
    background: 'var(--admin-input-bg)',
    color: 'var(--admin-input-text)',
    outline: 'none',
  },

  inventoryList: {
    borderRadius: 'calc(var(--admin-radius) + 6px)',
    border: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--admin-card-bg) 92%, var(--admin-primary) 8%), var(--admin-card-bg))',
    overflow: 'hidden',
  },

  listHeader: {
    borderBottom: '1px solid var(--admin-card-border)',
    background: 'var(--admin-table-head-bg)',
    color: 'var(--admin-table-head-text)',
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

  skuBadge: {
    borderRadius: '999px',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary-soft-text)',
    whiteSpace: 'nowrap',
  },

  branchBadge: {
    borderRadius: '999px',
    border: '1px solid var(--admin-button-soft-border)',
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
    whiteSpace: 'nowrap',
  },

  sectionBlock: {
    borderRadius: 'calc(var(--admin-radius) + 2px)',
    border: '1px solid var(--admin-card-border)',
    background: 'color-mix(in srgb, var(--admin-card-bg) 88%, var(--admin-primary) 12%)',
  },

  sectionIconBox: {
    borderRadius: 'calc(var(--admin-radius) - 4px)',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary)',
  },

  valuePill: {
    borderRadius: '999px',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
    whiteSpace: 'nowrap',
  },

  stockBox: {
    borderRadius: 'calc(var(--admin-radius) + 2px)',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary-soft-text)',
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

  actionButton: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-button-bg)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-text)',
    boxShadow: '0 10px 22px color-mix(in srgb, var(--admin-primary) 20%, transparent)',
  },

  cardSoftActionButton: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-button-soft-border)',
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
  },
};

function formatNumber(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat('es-CO').format(number);
}

function getProductTitle(row) {
  return (
    row?.product?.title ||
    row?.productSnapshot?.title ||
    row?.title ||
    'Producto sin nombre'
  );
}

function getProductSku(row) {
  return (
    row?.product?.sku ||
    row?.productSnapshot?.sku ||
    row?.variant?.sku ||
    row?.sku ||
    '—'
  );
}

function getBranchName(row) {
  return (
    row?.branch?.name ||
    row?.branchSnapshot?.name ||
    row?.branchName ||
    'Sede no definida'
  );
}

function getBranchOptionName(branch) {
  if (typeof branch === 'string') return branch;

  return (
    branch?.name ||
    branch?.title ||
    branch?.label ||
    branch?.branchName ||
    'Sede sin nombre'
  );
}

function getBranchType(row) {
  const type = String(
    row?.branch?.type ||
      row?.branchSnapshot?.type ||
      row?.type ||
      ''
  )
    .trim()
    .toLowerCase();

  const branchName = getBranchName(row).toLowerCase();

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

function isHexColor(value) {
  return /^#([0-9A-F]{3}){1,2}$/i.test(String(value || '').trim());
}

function getAvailableStock(row) {
  if (typeof row?.availableStock === 'number') return row.availableStock;

  const stock = Number(row?.stock || 0);
  const reservedStock = Number(row?.reservedStock || 0);

  return stock - reservedStock;
}

function getLowStockLimit(row) {
  const reorderPoint = Number(
    row?.reorderPoint ||
      row?.product?.reorderPoint ||
      row?.productSnapshot?.reorderPoint ||
      LOW_STOCK_LIMIT
  );

  return Number.isFinite(reorderPoint) && reorderPoint > 0
    ? reorderPoint
    : LOW_STOCK_LIMIT;
}

function getStockStatus(row) {
  const availableStock = Number(getAvailableStock(row) || 0);
  const lowStockLimit = getLowStockLimit(row);

  if (availableStock <= 0) {
    return {
      label: 'Sin stock',
      style: styles.outStockBadge,
    };
  }

  if (availableStock <= lowStockLimit) {
    return {
      label: 'Bajo stock',
      style: styles.lowStockBadge,
    };
  }

  return {
    label: 'Disponible',
    style: styles.goodStockBadge,
  };
}

function matchesStockFilter(row, stockFilter) {
  const availableStock = Number(getAvailableStock(row) || 0);
  const lowStockLimit = getLowStockLimit(row);

  if (stockFilter === 'withStock') {
    return availableStock > 0;
  }

  if (stockFilter === 'withoutStock') {
    return availableStock <= 0;
  }

  if (stockFilter === 'lowStock') {
    return availableStock > 0 && availableStock <= lowStockLimit;
  }

  return true;
}

function getBranchesFromResponse(response) {
  const data = response?.data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.branches)) return data.branches;
  if (Array.isArray(data?.data?.branches)) return data.data.branches;
  if (Array.isArray(data?.data?.data)) return data.data.data;

  return [];
}

export default function InventoryAdmin() {
  const [stockRows, setStockRows] = useState([]);
  const [movements, setMovements] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [branchesWarning, setBranchesWarning] = useState('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [initialTransferStockRow, setInitialTransferStockRow] = useState(null);
  const [movementsModalRow, setMovementsModalRow] = useState(null);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setBranchesWarning('');

      const [stockRes, movementsRes] = await Promise.all([
        api.get('/api/admin/inventory/stock'),
        api.get('/api/admin/inventory/movements'),
      ]);

      const stockData = Array.isArray(stockRes?.data?.data)
        ? stockRes.data.data
        : [];

      const movementsData = Array.isArray(movementsRes?.data?.data)
        ? movementsRes.data.data
        : [];

      setStockRows(stockData);
      setMovements(movementsData);

      try {
        const branchesRes = await api.get('/api/admin/branches', {
          params: {
            limit: 100,
            sort: 'name',
          },
        });

        setBranches(getBranchesFromResponse(branchesRes));
      } catch (branchesError) {
        console.warn('⚠️ No se pudieron cargar todas las sedes:', branchesError);

        setBranches([]);
        setBranchesWarning(
          'No se pudieron cargar todas las sedes. El filtro mostrará solo sedes con inventario.'
        );
      }
    } catch (err) {
      console.error('❌ Error cargando inventario:', err);
      setError(
        err?.response?.data?.message ||
          err?.userMessage ||
          'No se pudo cargar el inventario.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const branchOptions = useMemo(() => {
    const branchMap = new Map();

    branches.forEach((branch) => {
      const branchName = getBranchOptionName(branch);

      if (!branchName || branchName === 'Sede sin nombre') return;

      branchMap.set(branchName, branchName);
    });

    stockRows.forEach((row) => {
      const branchName = getBranchName(row);

      if (!branchName || branchName === 'Sede no definida') return;

      branchMap.set(branchName, branchName);
    });

    return Array.from(branchMap.values()).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
  }, [branches, stockRows]);

  const filteredStockRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return stockRows.filter((row) => {
      const productTitle = getProductTitle(row).toLowerCase();
      const productSku = getProductSku(row).toLowerCase();
      const branchName = getBranchName(row);
      const branchNameLower = branchName.toLowerCase();
      const size = String(getVariantSize(row)).toLowerCase();
      const color = String(getVariantColor(row)).toLowerCase();

      const matchesSearch =
        !term ||
        productTitle.includes(term) ||
        productSku.includes(term) ||
        branchNameLower.includes(term) ||
        size.includes(term) ||
        color.includes(term);

      const matchesBranch =
        branchFilter === 'all' || branchName === branchFilter;

      const matchesStock = matchesStockFilter(row, stockFilter);

      return matchesSearch && matchesBranch && matchesStock;
    });
  }, [stockRows, searchTerm, branchFilter, stockFilter]);

  const summary = useMemo(() => {
    const productsWithStock = new Set();

    let totalStock = 0;
    let totalAvailable = 0;

    stockRows.forEach((row) => {
      const stock = Number(row?.stock || 0);
      const availableStock = Number(getAvailableStock(row) || 0);

      totalStock += stock;
      totalAvailable += availableStock;

      if (stock > 0) {
        productsWithStock.add(
          String(
            row?.product?._id ||
              row?.product ||
              row?.productSnapshot?.id ||
              row?._id
          )
        );
      }
    });

    return {
      productsWithStock: productsWithStock.size,
      totalStock,
      totalAvailable,
      totalMovements: movements.length,
    };
  }, [stockRows, movements]);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    branchFilter !== 'all' ||
    stockFilter !== 'all';

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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-[0.22em]"
              style={styles.eyebrow}
            >
              Inventario por sedes
            </p>

            <h1 className="mt-2 text-2xl font-bold" style={styles.title}>
              Inventario
            </h1>

            <p className="mt-2 max-w-2xl text-sm" style={styles.muted}>
              Controla el stock disponible por sede, producto, talla, color y movimientos de inventario.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadInventory}
              disabled={loading}
              className="admin-inventory-secondary-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              style={styles.secondaryButton}
            >
              <RefreshCw
                size={16}
                className={loading ? 'animate-spin' : ''}
              />
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>

            <button
              type="button"
              onClick={() => setAdjustmentModalOpen(true)}
              className="admin-inventory-primary-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              style={styles.primaryButton}
            >
              <Plus size={16} />
              Nuevo ajuste
            </button>

            <button
              type="button"
              onClick={openGeneralTransferModal}
              className="admin-inventory-secondary-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              style={styles.secondaryButton}
            >
              <ArrowRightLeft size={16} />
              Trasladar
            </button>
          </div>
        </div>

        {error && (
          <div
            className="mt-5 flex items-start gap-3 px-4 py-3 text-sm"
            style={styles.errorBox}
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {branchesWarning && !error && (
          <div
            className="mt-5 flex items-start gap-3 px-4 py-3 text-sm"
            style={styles.errorBox}
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{branchesWarning}</p>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Productos con stock"
          value={summary.productsWithStock}
          description="Productos con existencia registrada"
          icon={<PackageSearch size={20} />}
        />

        <SummaryCard
          label="Stock total"
          value={summary.totalStock}
          description="Todas las sedes"
          icon={<PackageSearch size={20} />}
        />

        <SummaryCard
          label="Disponible"
          value={summary.totalAvailable}
          description="Listo para venta"
          icon={<PackageSearch size={20} />}
        />

        <SummaryCard
          label="Movimientos"
          value={summary.totalMovements}
          description="Entradas, salidas y ajustes"
          icon={<ArrowRightLeft size={20} />}
        />
      </div>

      <div className="p-6 backdrop-blur" style={styles.card}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold" style={styles.title}>
              Stock por sede
            </h2>

            <p className="text-sm" style={styles.muted}>
              Aquí se muestra el inventario detallado por producto, sede, talla y color.
            </p>
          </div>

          <p className="text-sm font-semibold" style={styles.muted}>
            Mostrando {formatNumber(filteredStockRows.length)} de{' '}
            {formatNumber(stockRows.length)} registros
          </p>
        </div>

        <div className="mt-5 p-4" style={styles.filterCard}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto] lg:items-end">
            <div>
              <label
                className="text-xs font-black uppercase tracking-wide"
                style={styles.muted}
              >
                Buscar
              </label>

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar producto, SKU, sede, talla o color..."
                className="admin-inventory-search mt-2 w-full px-4 py-3 text-sm transition"
                style={styles.input}
              />
            </div>

            <div>
              <label
                className="text-xs font-black uppercase tracking-wide"
                style={styles.muted}
              >
                Sede
              </label>

              <select
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                className="mt-2 w-full px-4 py-3 text-sm font-semibold transition"
                style={styles.input}
              >
                <option value="all">Todas las sedes</option>

                {branchOptions.map((branchName) => (
                  <option key={branchName} value={branchName}>
                    {branchName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="text-xs font-black uppercase tracking-wide"
                style={styles.muted}
              >
                Estado de stock
              </label>

              <select
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value)}
                className="mt-2 w-full px-4 py-3 text-sm font-semibold transition"
                style={styles.input}
              >
                {STOCK_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="admin-inventory-soft-button inline-flex items-center justify-center px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50"
              style={styles.softButton}
            >
              Limpiar filtros
            </button>
          </div>

          <p className="mt-3 text-xs leading-5" style={styles.muted}>
            Bajo stock se calcula con el punto de reorden del producto si existe.
            Si no existe, se toma como referencia {LOW_STOCK_LIMIT} unidades disponibles.
          </p>
        </div>

        <div className="mt-6" style={styles.inventoryList}>
          <div className="px-5 py-4" style={styles.listHeader}>
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <p className="text-xs font-black uppercase tracking-[0.18em]">
                Fichas de inventario
              </p>

              <p className="text-xs font-semibold opacity-80">
                Producto → ubicación → variante → cantidades → historial
              </p>
            </div>
          </div>

          <div className="space-y-4 p-4">
            {loading && (
              <div className="px-4 py-12 text-center text-sm" style={styles.muted}>
                Cargando inventario...
              </div>
            )}

            {!loading && filteredStockRows.length === 0 && (
              <div className="px-4 py-12 text-center text-sm" style={styles.muted}>
                No hay registros de inventario para mostrar.
              </div>
            )}

            {!loading &&
              filteredStockRows.map((row) => {
                const color = getVariantColor(row);
                const stockStatus = getStockStatus(row);
                const availableStock = Number(getAvailableStock(row) || 0);
                const canTransferFromCard = availableStock > 0;

                return (
                  <article
                    key={row?._id}
                    className="admin-inventory-readable-card p-4 transition md:p-5"
                    style={styles.inventoryCard}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center"
                          style={styles.productIconBox}
                        >
                          <Boxes size={21} />
                        </div>

                        <div className="min-w-0">
                          <p
                            className="text-lg font-black leading-6"
                            style={styles.title}
                          >
                            {getProductTitle(row)}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className="inline-flex items-center px-3 py-1 text-xs font-black"
                              style={styles.skuBadge}
                            >
                              SKU: {getProductSku(row)}
                            </span>

                            <span
                              className="inline-flex items-center px-3 py-1 text-xs font-black"
                              style={stockStatus.style}
                            >
                              {stockStatus.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
                        <button
                          type="button"
                          onClick={() => openTransferFromCard(row)}
                          disabled={!canTransferFromCard}
                          className="admin-inventory-card-soft-button inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                          style={styles.cardSoftActionButton}
                          title={
                            canTransferFromCard
                              ? 'Trasladar este inventario'
                              : 'No hay stock disponible para trasladar'
                          }
                        >
                          <ArrowRightLeft size={15} />
                          Trasladar desde aquí
                        </button>

                        <button
                          type="button"
                          onClick={() => setMovementsModalRow(row)}
                          className="admin-inventory-action-button inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-black transition sm:w-auto"
                          style={styles.actionButton}
                        >
                          <ArrowRightLeft size={15} />
                          Ver movimientos
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr]">
                      <InfoBlock
                        icon={<Warehouse size={17} />}
                        label="Ubicación"
                        title={getBranchName(row)}
                      >
                        <span
                          className="inline-flex w-fit items-center px-3 py-1 text-xs font-black"
                          style={styles.branchBadge}
                        >
                          {getBranchType(row)}
                        </span>
                      </InfoBlock>

                      <InfoBlock
                        icon={<Ruler size={17} />}
                        label="Variante"
                        title="Talla y color"
                      >
                        <div className="flex flex-wrap gap-2">
                          <span
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black"
                            style={styles.valuePill}
                          >
                            <Ruler size={13} style={styles.icon} />
                            Talla {getVariantSize(row)}
                          </span>

                          <span
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black"
                            style={styles.valuePill}
                          >
                            {isHexColor(color) ? (
                              <span
                                className="h-4 w-4 rounded-full"
                                style={{
                                  backgroundColor: color,
                                  border: '1px solid var(--admin-table-border)',
                                }}
                              />
                            ) : (
                              <Palette size={13} style={styles.icon} />
                            )}
                            {color}
                          </span>
                        </div>
                      </InfoBlock>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="px-4 py-4" style={styles.stockBox}>
                          <p
                            className="text-[10px] font-black uppercase tracking-wide"
                            style={styles.muted}
                          >
                            Stock físico
                          </p>

                          <p className="mt-1 text-2xl font-black" style={styles.title}>
                            {formatNumber(row?.stock)}
                          </p>
                        </div>

                        <div className="px-4 py-4" style={styles.availableBox}>
                          <p
                            className="text-[10px] font-black uppercase tracking-wide"
                            style={styles.muted}
                          >
                            Disponible
                          </p>

                          <p className="mt-1 text-2xl font-black" style={styles.title}>
                            {formatNumber(availableStock)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>
        </div>
      </div>

      <InventoryAdjustmentModal
        open={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
        stockRows={stockRows}
        onSaved={loadInventory}
      />

      <InventoryTransferModal
        open={transferModalOpen}
        onClose={closeTransferModal}
        stockRows={stockRows}
        initialStockRow={initialTransferStockRow}
        onSaved={loadInventory}
      />

      <InventoryMovementsModal
        open={Boolean(movementsModalRow)}
        onClose={() => setMovementsModalRow(null)}
        stockRow={movementsModalRow}
      />

      <style>
        {`
          .admin-inventory-primary-button:hover,
          .admin-inventory-secondary-button:hover,
          .admin-inventory-action-button:hover {
            background: var(--admin-button-hover) !important;
            color: var(--admin-button-hover-text) !important;
            border-color: var(--admin-button-hover) !important;
          }

          .admin-inventory-card-soft-button:hover:not(:disabled) {
            background: var(--admin-primary-soft-hover) !important;
          }

          .admin-inventory-soft-button:hover {
            background: var(--admin-primary-soft-hover) !important;
          }

          .admin-inventory-search::placeholder {
            color: var(--admin-input-placeholder);
          }

          .admin-inventory-readable-card:hover {
            background: linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 82%, var(--admin-primary) 18%), var(--admin-card-bg)) !important;
            transform: translateY(-1px);
          }
        `}
      </style>
    </section>
  );
}

function SummaryCard({ label, value, description, icon }) {
  return (
    <article className="p-5" style={styles.statCard}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={styles.muted}>
          {label}
        </span>

        <span style={styles.icon}>
          {icon}
        </span>
      </div>

      <p className="mt-4 text-3xl font-bold" style={styles.title}>
        {formatNumber(value)}
      </p>

      <p className="mt-1 text-xs" style={styles.muted}>
        {description}
      </p>
    </article>
  );
}

function InfoBlock({ icon, label, title, children }) {
  return (
    <div className="p-4" style={styles.sectionBlock}>
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          style={styles.sectionIconBox}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <p
            className="text-[10px] font-black uppercase tracking-[0.14em]"
            style={styles.muted}
          >
            {label}
          </p>

          <p className="mt-1 text-sm font-black leading-5" style={styles.title}>
            {title}
          </p>

          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}