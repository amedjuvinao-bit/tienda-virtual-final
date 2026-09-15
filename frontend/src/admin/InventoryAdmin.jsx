// frontend/src/admin/InventoryAdmin.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  BookOpen,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Gauge,
  Layers3,
  MoreHorizontal,
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

const MOVEMENT_TYPE_LABELS = {
  initial_stock: 'Stock inicial',
  purchase_in: 'Entrada por compra',
  sale_out: 'Salida por venta',
  return_in: 'Entrada por devolución',
  return_out: 'Salida por devolución',
  adjustment_in: 'Ajuste positivo',
  adjustment_out: 'Ajuste negativo',
  transfer: 'Traslado',
  damage_out: 'Salida por daño',
  loss_out: 'Salida por pérdida',
  correction: 'Corrección',
};

const INVENTORY_VIEWS = [
  { id: 'summary', label: 'Resumen', icon: Gauge },
  { id: 'stock', label: 'Existencias', icon: Boxes },
  { id: 'movements', label: 'Movimientos', icon: Activity },
  { id: 'alerts', label: 'Alertas', icon: AlertCircle },
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

function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function getMovementProductTitle(movement) {
  return movement?.product?.title || movement?.productSnapshot?.title || 'Producto sin nombre';
}

function getMovementBranchName(movement) {
  const from = movement?.branchFrom?.name || movement?.branchFromSnapshot?.name;
  const to = movement?.branchTo?.name || movement?.branchToSnapshot?.name;
  if (movement?.direction === 'transfer') return `${from || 'Origen'} → ${to || 'Destino'}`;
  return movement?.direction === 'out' ? from || 'Sede origen' : to || from || 'Sede destino';
}

function getMovementTypeLabel(type) {
  return MOVEMENT_TYPE_LABELS[type] || type || 'Movimiento';
}

function getMovementStatusLabel(status) {
  if (status === 'posted') return 'Aplicado';
  if (status === 'draft') return 'Pendiente';
  if (status === 'cancelled') return 'Cancelado';
  if (status === 'reversed') return 'Reversado';
  return status || 'Sin estado';
}

function getMovementQuantity(movement) {
  const quantity = formatNumber(movement?.quantity);
  if (movement?.direction === 'out') return `-${quantity}`;
  if (movement?.direction === 'in') return `+${quantity}`;
  return quantity;
}

export default function InventoryAdmin() {
  const [activeView, setActiveView] = useState('summary');
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [openRowMenuId, setOpenRowMenuId] = useState('');
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
  const [movementsModalOpen, setMovementsModalOpen] = useState(false);
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

  const priorityRows = useMemo(
    () => stockRows
      .filter((row) => getAvailableStock(row) <= getLowStockLimit(row))
      .sort((a, b) => getAvailableStock(a) - getAvailableStock(b))
      .slice(0, 5),
    [stockRows]
  );

  const recentMovements = useMemo(
    () => [...movements]
      .sort((a, b) => new Date(b?.postedAt || b?.createdAt || 0) - new Date(a?.postedAt || a?.createdAt || 0))
      .slice(0, 8),
    [movements]
  );

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

  const showStockView = (filter = 'all') => {
    setStockFilter(filter);
    setActiveView('stock');
  };

  const openMovements = (row = null) => {
    setMovementsModalRow(row);
    setMovementsModalOpen(true);
    setOpenRowMenuId('');
  };

  const closeMovements = () => {
    setMovementsModalOpen(false);
    setMovementsModalRow(null);
  };

  return (
    <section className="inventory-plus" style={styles.pageText}>
      <header className="inventory-shell">
        <Boxes className="inventory-shell__watermark" strokeWidth={0.75} />
        <div className="inventory-shell__top">
          <div className="inventory-shell__identity">
            <span className="inventory-shell__logo"><Boxes size={23} /></span>
            <div>
              <div className="inventory-shell__title-line">
                <h1>Inventario</h1>
                <span className="inventory-shell__live"><i /> {loading ? 'Actualizando' : 'Datos al día'}</span>
              </div>
              <p>Controla lo disponible, detecta riesgos y registra cada cambio.</p>
            </div>
          </div>

          <div className="inventory-shell__actions">
            <button type="button" onClick={() => setAdjustmentModalOpen(true)} className="inventory-button inventory-button--primary">
              <Plus size={17} /> Nuevo movimiento
            </button>
            <div className="inventory-actions-menu">
              <button type="button" onClick={() => setActionsMenuOpen((open) => !open)} className="inventory-button inventory-button--soft" aria-expanded={actionsMenuOpen}>
                Acciones <ChevronDown size={16} />
              </button>
              {actionsMenuOpen && (
                <div className="inventory-actions-menu__panel">
                  <button type="button" onClick={() => { setActionsMenuOpen(false); openGeneralTransferModal(); }}><ArrowRightLeft size={16} /> Trasladar entre sedes</button>
                  <button type="button" onClick={() => { setActionsMenuOpen(false); setAlertsPanelOpen(true); }}><Gauge size={16} /> Abrir centro de control</button>
                  <button type="button" onClick={() => { setActionsMenuOpen(false); loadInventory(); }}><RefreshCw size={16} /> Actualizar información</button>
                  <button type="button" onClick={() => { setActionsMenuOpen(false); exportInventory(); }} disabled={exporting}><Download size={16} /> {exporting ? 'Preparando archivo...' : 'Exportar inventario'}</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="inventory-shell__navigation">
          <nav className="inventory-view-tabs" aria-label="Secciones de inventario">
            {INVENTORY_VIEWS.map(({ id, label, icon: Icon }) => {
              const count = id === 'stock' ? stockRows.length : id === 'movements' ? movements.length : id === 'alerts' ? summary.lowStock + summary.outOfStock : null;
              return (
                <button key={id} type="button" onClick={() => setActiveView(id)} className={activeView === id ? 'is-active' : ''}>
                  <Icon size={16} /> <span>{label}</span>
                  {count !== null && <strong>{formatNumber(count)}</strong>}
                </button>
              );
            })}
          </nav>
          <div className="inventory-shell__service-actions">
            <InventoryReservationsPanel />
            <InventoryApprovalsPanel onChanged={loadInventory} />
          </div>
        </div>
      </header>

      {error && (
        <div className="inventory-inline-error" style={styles.errorBox}>
          <AlertCircle size={18} /> <p>{error}</p>
        </div>
      )}

      {activeView === 'summary' && (
        <section className="inventory-view inventory-dashboard-view">
          <div className="inventory-dashboard__lead">
            <div className="inventory-dashboard__lead-copy">
              <span className="inventory-dashboard__kicker"><ShieldCheck size={16} /> Estado general</span>
              <p className="inventory-dashboard__big-number">{formatNumber(summary.totalAvailable)}</p>
              <h2>unidades listas para vender</h2>
              <p>Es el stock realmente disponible después de descontar las reservas.</p>
              <button type="button" onClick={() => showStockView('withStock')}>Consultar existencias <ChevronRight size={16} /></button>
            </div>
            <PackageSearch className="inventory-dashboard__mark" strokeWidth={0.7} />
          </div>

          <div className="inventory-dashboard__priorities">
            <div className="inventory-view__heading">
              <div>
                <span className="inventory-view__eyebrow">Decisiones rápidas</span>
                <h2>¿Qué necesita atención?</h2>
              </div>
              <button type="button" onClick={() => setActiveView('alerts')} className="inventory-text-button">Ver alertas <ChevronRight size={16} /></button>
            </div>
            <button type="button" className="inventory-priority-line inventory-priority-line--warning" onClick={() => showStockView('lowStock')}>
              <span><AlertCircle size={18} /></span><div><strong>{formatNumber(summary.lowStock)} con bajo stock</strong><small>Conviene reponerlos pronto</small></div><ChevronRight size={17} />
            </button>
            <button type="button" className="inventory-priority-line inventory-priority-line--danger" onClick={() => showStockView('withoutStock')}>
              <span><PackageSearch size={18} /></span><div><strong>{formatNumber(summary.outOfStock)} agotados</strong><small>No están disponibles para vender</small></div><ChevronRight size={17} />
            </button>
            <div className="inventory-priority-line inventory-priority-line--neutral">
              <span><ShieldCheck size={18} /></span><div><strong>{formatNumber(summary.totalReserved)} unidades reservadas</strong><small>Separadas para pedidos en proceso</small></div>
            </div>
          </div>

          <div className="inventory-dashboard__facts">
            <DashboardFact label="Stock físico" value={summary.totalStock} help="Unidades registradas" />
            <DashboardFact label="Productos con stock" value={summary.productsWithStock} help="Referencias disponibles" />
            <DashboardFact label="Sedes activas" value={branchOptions.length} help="Ubicaciones visibles" />
            <DashboardFact label="Movimientos" value={summary.totalMovements} help="Registros históricos" />
          </div>

          <div className="inventory-dashboard__guide">
            <span className="inventory-dashboard__guide-icon"><Gauge size={19} /></span>
            <div><strong>Empieza por las alertas</strong><p>Revisa los productos críticos y decide si debes ajustar existencias o mover unidades desde otra sede.</p></div>
            <button type="button" onClick={() => setAlertsPanelOpen(true)}>Abrir control operativo</button>
          </div>
        </section>
      )}

      {activeView === 'stock' && (
        <section className="inventory-view inventory-stock-view">
          <div className="inventory-view__heading inventory-view__heading--padded">
            <div>
              <span className="inventory-view__eyebrow">Inventario por sede</span>
              <h2>Existencias</h2>
              <p>{formatNumber(filteredStockRows.length)} resultados · página {currentPage} de {totalPages}</p>
            </div>
            <button type="button" onClick={exportInventory} disabled={exporting || filteredStockRows.length === 0} className="inventory-button inventory-button--soft">
              <Download size={16} /> {exporting ? 'Preparando archivo...' : 'Exportar CSV'}
            </button>
          </div>

          <div className="inventory-filter-bar">
            <div className="inventory-search-field">
              <Search size={17} />
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por producto, SKU, talla o color" style={styles.input} />
            </div>
            <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} style={styles.input} aria-label="Filtrar por sede">
              <option value="all">Todas las sedes</option>
              {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} style={styles.input} aria-label="Filtrar por disponibilidad">
              {STOCK_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
            </select>
            <button type="button" onClick={clearFilters} disabled={!hasActiveFilters} className="inventory-filter-clear">Limpiar</button>
          </div>

          <div className="inventory-table" role="table" aria-label="Existencias de inventario">
            <div className="inventory-table__header" role="row">
              <span>Producto</span><span>Ubicación</span><span>Variante</span><span>Físico</span><span>Reservado</span><span>Disponible</span><span />
            </div>
            {loading && <div className="inventory-empty-state">Cargando inventario completo...</div>}
            {!loading && filteredStockRows.length === 0 && <div className="inventory-empty-state">No encontramos existencias con estos filtros.</div>}
            {!loading && visibleStockRows.map((row) => {
              const rowId = String(row?._id || `${getProductId(row)}-${getBranchId(row)}-${row?.variantKey || getVariantLabel(row)}`);
              const status = getStockStatus(row);
              const available = getAvailableStock(row);
              return (
                <div key={rowId} className="inventory-table__row" role="row">
                  <div className="inventory-table__product" role="cell">
                    <span className="inventory-table__product-icon"><Boxes size={18} /></span>
                    <div><strong>{getProductTitle(row)}</strong><small>SKU {getProductSku(row)}</small></div>
                    <em style={status.style}>{status.label}</em>
                  </div>
                  <div className="inventory-table__detail" role="cell"><Warehouse size={15} /><span><small>Ubicación</small>{getBranchName(row)}</span></div>
                  <div className="inventory-table__detail" role="cell"><Ruler size={15} /><span><small>Variante</small>{getVariantLabel(row)}</span></div>
                  <InventoryAmount mobileLabel="Físico" value={row?.stock} />
                  <InventoryAmount mobileLabel="Reservado" value={getReservedStock(row)} />
                  <InventoryAmount mobileLabel="Disponible" value={available} tone="success" />
                  <div className="inventory-row-menu" role="cell">
                    <button type="button" onClick={() => setOpenRowMenuId((id) => id === rowId ? '' : rowId)} aria-label={`Gestionar ${getProductTitle(row)}`}><MoreHorizontal size={19} /></button>
                    {openRowMenuId === rowId && (
                      <div className="inventory-row-menu__panel">
                        <button type="button" onClick={() => { setOpenRowMenuId(''); openTransferFromCard(row); }} disabled={available <= 0}><ArrowRightLeft size={15} /> Trasladar</button>
                        <button type="button" onClick={() => openMovements(row)}><Activity size={15} /> Movimientos</button>
                        <button type="button" onClick={() => { setOpenRowMenuId(''); setKardexModalRow(row); }}><BookOpen size={15} /> Kardex</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!loading && filteredStockRows.length > 0 && (
            <div className="inventory-pagination">
              <p>Mostrando {formatNumber((currentPage - 1) * ROWS_PER_PAGE + 1)}–{formatNumber(Math.min(currentPage * ROWS_PER_PAGE, filteredStockRows.length))} de {formatNumber(filteredStockRows.length)}</p>
              <div className="inventory-pagination__controls">
                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}><ChevronLeft size={17} /></button>
                <strong>{currentPage} / {totalPages}</strong>
                <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}><ChevronRight size={17} /></button>
              </div>
            </div>
          )}
        </section>
      )}

      {activeView === 'movements' && (
        <section className="inventory-view inventory-movements-view">
          <div className="inventory-view__heading inventory-view__heading--padded">
            <div><span className="inventory-view__eyebrow">Trazabilidad</span><h2>Movimientos recientes</h2><p>Entradas, salidas, ajustes y traslados registrados.</p></div>
            <button type="button" onClick={loadInventory} disabled={loading} className="inventory-button inventory-button--soft"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar</button>
          </div>
          <div className="inventory-movement-list">
            {recentMovements.length === 0 && <div className="inventory-empty-state">Todavía no hay movimientos para mostrar.</div>}
            {recentMovements.map((movement) => (
              <div key={movement?._id || movement?.movementNumber} className="inventory-movement-row">
                <span className={`inventory-movement-row__direction inventory-movement-row__direction--${movement?.direction || 'neutral'}`}><ArrowRightLeft size={16} /></span>
                <div className="inventory-movement-row__main"><strong>{getMovementProductTitle(movement)}</strong><small>{movement?.movementNumber || 'Sin número'} · {getMovementBranchName(movement)}</small></div>
                <span className="inventory-movement-row__type">{getMovementTypeLabel(movement?.type)}</span>
                <strong className={`inventory-movement-row__quantity inventory-movement-row__quantity--${movement?.direction || 'neutral'}`}>{getMovementQuantity(movement)}</strong>
                <span className="inventory-movement-row__status">{getMovementStatusLabel(movement?.status)}</span>
                <time>{formatDate(movement?.postedAt || movement?.createdAt)}</time>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeView === 'alerts' && (
        <section className="inventory-view inventory-alerts-view">
          <div className="inventory-view__heading inventory-view__heading--padded">
            <div><span className="inventory-view__eyebrow">Prioridad operativa</span><h2>Alertas de inventario</h2><p>Empieza por los productos con menos disponibilidad.</p></div>
            <button type="button" onClick={() => setAlertsPanelOpen(true)} className="inventory-button inventory-button--primary"><Gauge size={16} /> Centro de control</button>
          </div>
          <div className="inventory-alert-summary">
            <AlertMetric label="Bajo stock" value={summary.lowStock} tone="warning" help="Cerca del punto mínimo" />
            <AlertMetric label="Agotados" value={summary.outOfStock} tone="danger" help="Sin unidades disponibles" />
            <AlertMetric label="Reservado" value={summary.totalReserved} tone="neutral" help="Apartado por pedidos" />
          </div>
          <div className="inventory-alert-list">
            {priorityRows.length === 0 && <div className="inventory-empty-state inventory-empty-state--success"><ShieldCheck size={22} /> No hay productos críticos en este momento.</div>}
            {priorityRows.map((row) => {
              const available = getAvailableStock(row);
              return (
                <button key={row?._id || `${getProductId(row)}-${getBranchId(row)}`} type="button" className="inventory-alert-row" onClick={() => { setSearchTerm(getProductSku(row)); showStockView('all'); }}>
                  <span className={available <= 0 ? 'is-danger' : 'is-warning'}><AlertCircle size={18} /></span>
                  <div><strong>{getProductTitle(row)}</strong><small>{getBranchName(row)} · {getVariantLabel(row)}</small></div>
                  <p><small>Disponible</small><strong>{formatNumber(available)}</strong></p>
                  <p><small>Punto mínimo</small><strong>{formatNumber(getLowStockLimit(row))}</strong></p>
                  <ChevronRight size={18} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      <InventoryAdjustmentModal open={adjustmentModalOpen} onClose={() => setAdjustmentModalOpen(false)} stockRows={stockRows} onSaved={loadInventory} />
      <InventoryTransferModal open={transferModalOpen} onClose={closeTransferModal} stockRows={stockRows} initialStockRow={initialTransferStockRow} initialSuggestion={initialTransferSuggestion} onSaved={loadInventory} />
      <InventoryMovementsModal open={movementsModalOpen} onClose={closeMovements} stockRow={movementsModalRow} onChanged={loadInventory} />
      <InventoryKardexModal open={Boolean(kardexModalRow)} onClose={() => setKardexModalRow(null)} stockRow={kardexModalRow} />
      <InventoryAlertsPanel open={alertsPanelOpen} onClose={() => setAlertsPanelOpen(false)} onPrepareTransfer={openSuggestedTransfer} />
    </section>
  );
}

function DashboardFact({ label, value, help }) {
  return <div className="inventory-dashboard-fact"><span>{label}</span><strong>{formatNumber(value)}</strong><small>{help}</small></div>;
}

function InventoryAmount({ mobileLabel, value, tone = 'neutral' }) {
  return <div className={`inventory-table__amount inventory-table__amount--${tone}`} role="cell"><small>{mobileLabel}</small><strong>{formatNumber(value)}</strong></div>;
}

function AlertMetric({ label, value, tone, help }) {
  return <div className={`inventory-alert-metric inventory-alert-metric--${tone}`}><span>{label}</span><strong>{formatNumber(value)}</strong><small>{help}</small></div>;
}
