// frontend/src/admin/ProductosAdmin.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Copy,
  Filter,
  Layers3,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  Trash2,
  Warehouse,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmDialog from '../components/ConfirmDialog';
import Can from './security/Can';
import useAdminPermissions from './security/useAdminPermissions';
import { formatProductTypeLabel, PRODUCT_TYPES } from './products/productCatalogConfig';
import api from '../lib/api';

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('es-CO');
}

function shortId(value) {
  const text = String(value || '');
  if (!text) return '—';
  if (text.length <= 10) return text;
  return `${text.slice(0, 6)}…${text.slice(-4)}`;
}

function getInventorySummary(product) {
  const fallbackStock = Number(product?.stock ?? 0) || 0;

  return product?.inventorySummary || {
    stock: fallbackStock,
    reservedStock: 0,
    availableStock: fallbackStock,
    variantsCount: Array.isArray(product?.inventory) ? product.inventory.length : 0,
    branchesCount: 0,
    lowStockCount: 0,
    source: 'Product.stock',
  };
}

function getMarginSummary(product) {
  const price = Number(product?.financialSummary?.price ?? product?.price ?? 0) || 0;
  const cost = Number(product?.financialSummary?.cost ?? product?.cost ?? 0) || 0;
  const marginValue = Number(
    product?.financialSummary?.marginValue ?? Math.max(0, price - cost)
  );
  const marginPercent = Number(
    product?.financialSummary?.marginPercent ??
      (price > 0 ? (marginValue / price) * 100 : 0)
  );

  return {
    price,
    cost,
    marginValue,
    marginPercent,
  };
}

function getProductInitials(title = '') {
  const words = String(title || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return 'PR';

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function getInventoryHealth(product) {
  const inventory = getInventorySummary(product);

  if (!product?.trackInventory) {
    return {
      label: 'Sin inventario',
      tone: 'neutral',
      icon: Layers3,
    };
  }

  if (Number(inventory.stock || 0) <= 0) {
    return {
      label: 'Sin stock',
      tone: 'danger',
      icon: AlertTriangle,
    };
  }

  if (
    Number(inventory.lowStockCount || 0) > 0 ||
    Number(inventory.availableStock || 0) <= 2
  ) {
    return {
      label: 'Bajo stock',
      tone: 'warning',
      icon: AlertTriangle,
    };
  }

  return {
    label: 'Stock OK',
    tone: 'success',
    icon: CheckCircle2,
  };
}

function toneVars(tone = 'neutral') {
  const tones = {
    primary: {
      background: 'var(--admin-primary-soft-bg)',
      color: 'var(--admin-primary-soft-text)',
      borderColor: 'var(--admin-primary-soft-border)',
    },
    success: {
      background: 'color-mix(in srgb, #22c55e 14%, var(--admin-card-bg))',
      color: 'color-mix(in srgb, #22c55e 72%, var(--admin-card-text))',
      borderColor: 'color-mix(in srgb, #22c55e 55%, var(--admin-card-border))',
    },
    warning: {
      background: 'var(--admin-warning-soft-bg)',
      color: 'var(--admin-warning-text)',
      borderColor: 'color-mix(in srgb, var(--admin-warning) 65%, var(--admin-card-border))',
    },
    danger: {
      background: 'var(--admin-danger-soft-bg)',
      color: 'var(--admin-danger-text)',
      borderColor: 'color-mix(in srgb, var(--admin-danger) 65%, var(--admin-card-border))',
    },
    neutral: {
      background: 'var(--admin-button-soft-bg)',
      color: 'var(--admin-card-text)',
      borderColor: 'var(--admin-button-soft-border)',
    },
  };

  return tones[tone] || tones.neutral;
}

function badgeStyle(tone = 'neutral') {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    width: 'fit-content',
    border: '1px solid',
    borderRadius: 999,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    ...toneVars(tone),
  };
}

const styles = {
  page: {
    padding: 'var(--admin-padding)',
    color: 'var(--admin-card-text)',
  },
  shell: {
    border: '1px solid var(--admin-card-border)',
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    background: 'var(--admin-glass-bg)',
    boxShadow: 'var(--admin-glass-shadow)',
    overflow: 'hidden',
  },
  header: {
    borderBottom: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 88%, var(--admin-primary) 12%), var(--admin-card-bg))',
  },
  eyebrow: {
    color: 'var(--admin-primary)',
    letterSpacing: '0.22em',
  },
  muted: {
    color: 'var(--admin-card-muted-text)',
  },
  primaryButton: {
    border:
      '1px solid color-mix(in srgb, var(--admin-button-bg) 72%, rgba(255,255,255,0.45) 28%)',
    borderRadius: 999,
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-button-bg) 88%, #0f172a 12%), color-mix(in srgb, var(--admin-button-bg) 66%, #0f172a 34%))',
    color: '#ffffff',
    boxShadow:
      '0 14px 30px color-mix(in srgb, var(--admin-button-bg) 22%, transparent), inset 0 1px 0 rgba(255,255,255,0.28)',
    textShadow: '0 1px 8px rgba(0,0,0,0.38)',
  },
  inventoryButton: {
    border: '1px solid rgba(255,255,255,0.30)',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    color: '#ffffff',
    boxShadow:
      '0 14px 30px rgba(124,58,237,0.28), inset 0 1px 0 rgba(255,255,255,0.28)',
    textShadow: '0 1px 8px rgba(0,0,0,0.45)',
  },
  softButton: {
    border: '1px solid var(--admin-button-soft-border)',
    borderRadius: 999,
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-card-text)',
  },
  dangerButton: {
    border:
      '1px solid color-mix(in srgb, var(--admin-danger) 75%, rgba(255,255,255,0.35) 25%)',
    borderRadius: 999,
    background:
      'linear-gradient(135deg, var(--admin-danger), color-mix(in srgb, var(--admin-danger) 78%, #0f172a 22%))',
    color: '#ffffff',
    textShadow: '0 1px 8px rgba(0,0,0,0.38)',
  },
  input: {
    border: '1px solid var(--admin-input-border)',
    borderRadius: 999,
    background: 'var(--admin-input-bg)',
    color: 'var(--admin-input-text)',
    outline: 'none',
  },
  kpi: {
    border: '1px solid var(--admin-card-border)',
    borderRadius: 'calc(var(--admin-radius) + 4px)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
    boxShadow: '0 14px 32px color-mix(in srgb, var(--admin-primary) 8%, transparent)',
  },
  productCard: {
    border: '1px solid var(--admin-card-border)',
    borderRadius: 'calc(var(--admin-radius) + 6px)',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 96%, var(--admin-primary) 4%), var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
    boxShadow: '0 12px 28px color-mix(in srgb, var(--admin-primary) 7%, transparent)',
  },
  metricBox: {
    border: '1px solid var(--admin-card-border)',
    borderRadius: 'calc(var(--admin-radius) + 2px)',
    background: 'color-mix(in srgb, var(--admin-card-bg) 88%, var(--admin-primary) 6%)',
  },
};

const EMPTY_SUMMARY = {
  total: 0,
  active: 0,
  tracked: 0,
  stock: 0,
  available: 0,
  reserved: 0,
  costValue: 0,
  saleValue: 0,
};

export default function ProductosAdmin() {
  const { can } = useAdminPermissions();

  const canUpdateProduct = can('products:update');
  const canDeleteProduct = can('products:delete');
  const canUseProductActions = canUpdateProduct || canDeleteProduct;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [serverQ, setServerQ] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [inventoryFilter, setInventoryFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [taxonomyOptions, setTaxonomyOptions] = useState({
    categories: [],
    collections: [],
  });
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
    from: 0,
    to: 0,
  });
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState('publish');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiveSelection, setArchiveSelection] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setServerQ(q.trim());
      setTagFilter(tagInput.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [q, tagInput]);

  useEffect(() => {
    api.get('/api/products/admin/taxonomy')
      .then(({ data }) => {
        setTaxonomyOptions({
          categories: Array.isArray(data?.categories)
            ? data.categories
            : [],
          collections: Array.isArray(data?.collections)
            ? data.collections
            : [],
        });
      })
      .catch(() => {
        setTaxonomyOptions({
          categories: [],
          collections: [],
        });
      });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    serverQ,
    productTypeFilter,
    statusFilter,
    inventoryFilter,
    categoryFilter,
    collectionFilter,
    tagFilter,
    sort,
    limit,
  ]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [
    page,
    limit,
    serverQ,
    productTypeFilter,
    statusFilter,
    inventoryFilter,
    categoryFilter,
    collectionFilter,
    tagFilter,
    sort,
  ]);

  useEffect(() => {
    let cancel = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await api.get('/api/products/admin/list', {
          params: {
            page,
            limit,
            q: serverQ,
            productType: productTypeFilter,
            status: statusFilter,
            inventory: inventoryFilter,
            categoryId: categoryFilter,
            collectionId: collectionFilter,
            tag: tagFilter,
            sort,
          },
        });

        if (cancel) return;

        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];

        setProducts(list);
        setPagination({
          page: Number(res.data?.pagination?.page || 1),
          limit: Number(res.data?.pagination?.limit || limit),
          total: Number(
            res.data?.pagination?.total ?? res.data?.total ?? 0
          ),
          pages: Math.max(
            1,
            Number(res.data?.pagination?.pages || 1)
          ),
          from: Number(res.data?.pagination?.from || 0),
          to: Number(res.data?.pagination?.to || 0),
        });
        setSummary({
          ...EMPTY_SUMMARY,
          ...(res.data?.summary || {}),
        });

        const resolvedPage = Number(
          res.data?.pagination?.page || page
        );
        if (resolvedPage !== page) {
          setPage(resolvedPage);
        }
      } catch (err) {
        if (cancel) return;

        console.error('Error cargando productos admin:', err?.message || err);
        setError('No se pudieron cargar los productos con inventario real.');
      } finally {
        if (!cancel) setLoading(false);
      }
    };

    load();

    return () => {
      cancel = true;
    };
  }, [
    page,
    limit,
    serverQ,
    productTypeFilter,
    statusFilter,
    inventoryFilter,
    categoryFilter,
    collectionFilter,
    tagFilter,
    sort,
    reloadToken,
  ]);

  const currentPageIds = useMemo(
    () => products.map((product) => String(product._id)),
    [products]
  );
  const allPageSelected =
    currentPageIds.length > 0 &&
    currentPageIds.every((id) => selectedIds.has(id));

  const filtersActive =
    Boolean(q.trim()) ||
    productTypeFilter !== 'all' ||
    statusFilter !== 'all' ||
    inventoryFilter !== 'all' ||
    Boolean(categoryFilter) ||
    Boolean(collectionFilter) ||
    Boolean(tagInput.trim()) ||
    sort !== '-createdAt';

  const clearFilters = () => {
    setQ('');
    setServerQ('');
    setProductTypeFilter('all');
    setStatusFilter('all');
    setInventoryFilter('all');
    setCategoryFilter('');
    setCollectionFilter('');
    setTagInput('');
    setTagFilter('');
    setSort('-createdAt');
    setPage(1);
  };

  const toggleProduct = (productId) => {
    const id = String(productId || '');

    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  };

  const toggleCurrentPage = () => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allPageSelected) {
        currentPageIds.forEach((id) => next.delete(id));
      } else {
        currentPageIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const reloadProducts = () => {
    setReloadToken((value) => value + 1);
  };

  const copySku = async (sku) => {
    if (!sku) return;

    try {
      await navigator.clipboard.writeText(sku);
      toast.success('SKU copiado');
    } catch {
      toast.error('No se pudo copiar el SKU');
    }
  };

  const openArchiveConfirmation = (ids) => {
    setArchiveSelection(
      [...new Set(ids.map((id) => String(id || '')).filter(Boolean))]
    );
    setConfirmOpen(true);
  };

  const handleArchive = async () => {
    if (bulkBusy) return;

    if (!canDeleteProduct) {
      toast.error('No tienes permiso para eliminar productos');
      setConfirmOpen(false);
      setArchiveSelection([]);
      return;
    }

    if (!archiveSelection.length) return;

    try {
      setBulkBusy(true);

      if (archiveSelection.length === 1) {
        await api.delete(`/api/products/${archiveSelection[0]}`);
        toast.success('Producto retirado del catálogo');
      } else {
        const response = await api.post(
          '/api/products/admin/bulk/archive',
          {
            ids: archiveSelection,
          }
        );
        const archivedCount = Number(
          response.data?.archivedCount || 0
        );
        const failedCount = Number(response.data?.failedCount || 0);

        if (failedCount > 0) {
          toast.warning(
            `${archivedCount} retirados y ${failedCount} sin procesar`
          );
        } else {
          toast.success(
            `${archivedCount} productos retirados del catálogo`
          );
        }
      }

      setSelectedIds(new Set());
      reloadProducts();
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          'No se pudieron retirar los productos'
      );
    } finally {
      setBulkBusy(false);
      setConfirmOpen(false);
      setArchiveSelection([]);
    }
  };

  const runBulkUpdate = async () => {
    const ids = [...selectedIds];

    if (!canUpdateProduct || !ids.length) return;

    try {
      setBulkBusy(true);
      const response = await api.post(
        '/api/products/admin/bulk/update',
        {
          ids,
          action: bulkAction,
        }
      );
      const matched = Number(response.data?.matched || 0);

      toast.success(
        `${matched} producto${matched === 1 ? '' : 's'} actualizado${
          matched === 1 ? '' : 's'
        }`
      );
      setSelectedIds(new Set());
      reloadProducts();
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          'No se pudo aplicar la acción masiva'
      );
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div className="px-5 py-5 md:px-7 md:py-6" style={styles.header}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black uppercase" style={styles.eyebrow}>
                Catálogo universal
              </p>
              <h1 className="mt-1 text-3xl font-black leading-tight" style={{ color: 'var(--admin-card-text)' }}>
                Productos
              </h1>
              <p className="mt-2 text-sm leading-relaxed" style={styles.muted}>
                Gestiona la ficha comercial del producto. El stock real se consulta desde Inventario por sede y variante.
              </p>
            </div>

            <Can permission="products:create">
              <button
                type="button"
                onClick={() => navigate('/admin/productos/nuevo')}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-black transition hover:-translate-y-0.5 active:translate-y-0 !text-white"
                style={styles.primaryButton}
              >
                <Plus className="h-4 w-4" />
                Agregar producto
              </button>
            </Can>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Productos', value: formatNumber(summary.total), sub: `${formatNumber(summary.active)} activos`, icon: PackageSearch },
              { label: 'Stock real', value: formatNumber(summary.stock), sub: `${formatNumber(summary.reserved)} reservado`, icon: Boxes },
              { label: 'Disponible', value: formatNumber(summary.available), sub: `${formatNumber(summary.tracked)} con inventario`, icon: Warehouse },
              { label: 'Costo estimado', value: formatCurrency(summary.costValue), sub: `Venta ${formatCurrency(summary.saleValue)}`, icon: Layers3 },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label} className="p-4" style={styles.kpi}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={styles.muted}>
                        {item.label}
                      </p>
                      <p className="mt-2 text-2xl font-black leading-none" style={{ color: 'var(--admin-card-text)' }}>
                        {item.value}
                      </p>
                      <p className="mt-2 text-xs font-semibold" style={styles.muted}>
                        {item.sub}
                      </p>
                    </div>
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
                      style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4 md:px-7" style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_170px_155px_185px_120px]">
            <label className="relative block min-w-0">
              <Search
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--admin-card-muted-text)' }}
              />
              <input
                className="h-12 w-full pl-11 pr-4 text-sm font-semibold"
                placeholder="Buscar producto, SKU o categoría…"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                style={styles.input}
              />
            </label>

            <select
              value={productTypeFilter}
              onChange={(event) => setProductTypeFilter(event.target.value)}
              className="h-12 w-full px-4 text-sm font-semibold"
              style={styles.input}
            >
              <option value="all">Tipos</option>
              {PRODUCT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-12 w-full px-4 text-sm font-semibold"
              style={styles.input}
            >
              <option value="all">Estados</option>
              <option value="published">Publicados</option>
              <option value="hidden">Ocultos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>

            <select
              value={inventoryFilter}
              onChange={(event) => setInventoryFilter(event.target.value)}
              className="h-12 w-full px-4 text-sm font-semibold"
              style={styles.input}
            >
              <option value="all">Inventario</option>
              <option value="tracked">Con inventario</option>
              <option value="not_tracked">Sin inventario</option>
              <option value="with_stock">Con stock</option>
              <option value="without_stock">Sin stock</option>
              <option value="low_stock">Bajo stock</option>
            </select>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!filtersActive}
              className="inline-flex h-12 items-center justify-center gap-2 px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
              style={styles.softButton}
            >
              <X className="h-4 w-4" />
              Limpiar
            </button>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 w-full px-4 text-xs font-bold"
              style={styles.input}
            >
              <option value="">Todas las categorías</option>
              {taxonomyOptions.categories.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.path || item.name}
                </option>
              ))}
            </select>
            <select
              value={collectionFilter}
              onChange={(event) => setCollectionFilter(event.target.value)}
              className="h-10 w-full px-4 text-xs font-bold"
              style={styles.input}
            >
              <option value="">Todas las colecciones</option>
              {taxonomyOptions.collections.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              className="h-10 w-full px-4 text-xs font-bold"
              style={styles.input}
              placeholder="Filtrar por etiqueta exacta"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs font-bold" style={styles.muted}>
            <span className="inline-flex items-center gap-2">
              <Filter className="h-3.5 w-3.5" />
              {loading
                ? 'Cargando productos…'
                : `${formatNumber(pagination.total)} productos · Mostrando ${formatNumber(pagination.from)}–${formatNumber(pagination.to)}`}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="h-9 px-3 text-xs font-bold"
                style={styles.input}
                aria-label="Ordenar productos"
              >
                <option value="-createdAt">Más recientes</option>
                <option value="-updatedAt">Últimos actualizados</option>
                <option value="title">Nombre A–Z</option>
                <option value="-title">Nombre Z–A</option>
                <option value="-price">Mayor precio</option>
                <option value="price">Menor precio</option>
                <option value="-stock">Mayor stock</option>
                <option value="stock">Menor stock</option>
              </select>

              <select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="h-9 px-3 text-xs font-bold"
                style={styles.input}
                aria-label="Productos por página"
              >
                {[10, 20, 50].map((value) => (
                  <option key={value} value={value}>
                    {value} por página
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 md:px-7">
          {error && (
            <div
              className="mb-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold"
              style={{
                borderColor: 'var(--admin-danger)',
                background: 'var(--admin-danger-soft-bg)',
                color: 'var(--admin-danger-text)',
              }}
            >
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {canUseProductActions && products.length > 0 && (
            <div
              className="mb-4 flex flex-col gap-3 rounded-2xl border p-3 md:flex-row md:items-center md:justify-between"
              style={{
                borderColor: 'var(--admin-card-border)',
                background: 'var(--admin-card-bg)',
              }}
            >
              <label className="inline-flex items-center gap-3 text-sm font-black">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleCurrentPage}
                  className="h-4 w-4"
                  style={{ accentColor: 'var(--admin-primary)' }}
                />
                Seleccionar esta página
              </label>

              <span className="text-xs font-bold" style={styles.muted}>
                {selectedIds.size
                  ? `${selectedIds.size} seleccionado${selectedIds.size === 1 ? '' : 's'}`
                  : 'Sin selección'}
              </span>
            </div>
          )}

          {selectedIds.size > 0 && (
            <div
              className="mb-4 flex flex-col gap-3 rounded-2xl border p-4 lg:flex-row lg:items-center lg:justify-between"
              style={{
                borderColor: 'var(--admin-primary-soft-border)',
                background: 'var(--admin-primary-soft-bg)',
              }}
            >
              <div>
                <p className="text-sm font-black" style={{ color: 'var(--admin-primary-soft-text)' }}>
                  Acción sobre {selectedIds.size} producto{selectedIds.size === 1 ? '' : 's'}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="mt-1 text-xs font-bold underline"
                  style={{ color: 'var(--admin-primary-soft-text)' }}
                >
                  Limpiar selección
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canUpdateProduct && (
                  <>
                    <select
                      value={bulkAction}
                      onChange={(event) => setBulkAction(event.target.value)}
                      disabled={bulkBusy}
                      className="h-10 px-3 text-xs font-bold disabled:opacity-50"
                      style={styles.input}
                    >
                      <option value="publish">Publicar</option>
                      <option value="hide">Ocultar de la tienda</option>
                      <option value="activate">Activar</option>
                      <option value="deactivate">Desactivar</option>
                    </select>
                    <button
                      type="button"
                      onClick={runBulkUpdate}
                      disabled={bulkBusy}
                      className="inline-flex h-10 items-center justify-center px-4 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50 !text-white"
                      style={styles.primaryButton}
                    >
                      Aplicar
                    </button>
                  </>
                )}

                {canDeleteProduct && (
                  <button
                    type="button"
                    onClick={() => openArchiveConfirmation([...selectedIds])}
                    disabled={bulkBusy}
                    className="inline-flex h-10 items-center justify-center gap-2 px-4 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50 !text-white"
                    style={styles.dangerButton}
                  >
                    <Trash2 className="h-4 w-4" />
                    Retirar
                  </button>
                )}
              </div>
            </div>
          )}

          {!loading && products.length === 0 && (
            <div
              className="grid min-h-[240px] place-items-center rounded-3xl border border-dashed p-8 text-center"
              style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}
            >
              <div>
                <PackageSearch className="mx-auto h-10 w-10" style={{ color: 'var(--admin-primary)' }} />
                <h3 className="mt-3 text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>
                  Sin productos para mostrar
                </h3>
                <p className="mt-1 text-sm" style={styles.muted}>
                  Ajusta los filtros o crea un producto nuevo.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-3">
            {products.map((product) => {
              const inventory = getInventorySummary(product);
              const margin = getMarginSummary(product);
              const health = getInventoryHealth(product);
              const HealthIcon = health.icon;
              const stockSource = inventory.source === 'InventoryStock' ? 'Inventario' : 'Producto heredado';
              const marginSafe = Math.max(0, Math.min(100, Number(margin.marginPercent || 0)));

              return (
                <article
                  key={product._id}
                  className="relative overflow-hidden p-4 transition hover:-translate-y-0.5 md:p-5"
                  style={styles.productCard}
                >
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 w-1"
                    style={{ background: 'linear-gradient(180deg, var(--admin-primary), color-mix(in srgb, var(--admin-primary) 25%, transparent))' }}
                  />

                  <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(170px,0.65fr)_minmax(210px,0.8fr)_150px] lg:items-center">
                    <div className="flex min-w-0 gap-4">
                      {canUseProductActions && (
                        <label
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border"
                          style={{
                            borderColor: 'var(--admin-card-border)',
                            background: 'var(--admin-button-soft-bg)',
                          }}
                          title="Seleccionar producto"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(String(product._id))}
                            onChange={() => toggleProduct(product._id)}
                            className="h-4 w-4"
                            style={{ accentColor: 'var(--admin-primary)' }}
                            aria-label={`Seleccionar ${product.title || 'producto'}`}
                          />
                        </label>
                      )}
                      <div
                        className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border text-sm font-black"
                        style={{
                          borderColor: 'var(--admin-primary-soft-border)',
                          background: 'var(--admin-primary-soft-bg)',
                          color: 'var(--admin-primary)',
                        }}
                      >
                        {product.image ? (
                          <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
                        ) : (
                          getProductInitials(product.title)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span style={badgeStyle('primary')}>{formatProductTypeLabel(product.productType)}</span>
                          <span
                            style={badgeStyle(
                              product.active === false
                                ? 'neutral'
                                : product.visible === false
                                  ? 'warning'
                                  : 'success'
                            )}
                          >
                            {product.active === false
                              ? 'Inactivo'
                              : product.visible === false
                                ? 'Oculto'
                                : 'Publicado'}
                          </span>
                        </div>

                        <h2 className="mt-2 truncate text-base font-black leading-snug" style={{ color: 'var(--admin-card-text)' }}>
                          {product.title || 'Producto sin nombre'}
                        </h2>

                        <p className="mt-1 truncate text-sm font-semibold" style={styles.muted}>
                          {product.category || 'Sin categoría'}
                        </p>

                        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                          <span
                            className="inline-flex max-w-[180px] items-center rounded-xl px-3 py-1.5 font-mono text-xs font-black"
                            style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary-soft-text)' }}
                            title={product.sku || ''}
                          >
                            <span className="truncate">{product.sku || 'SIN-SKU'}</span>
                          </span>
                          {product.sku && (
                            <button
                              type="button"
                              onClick={() => copySku(product.sku)}
                              className="grid h-8 w-8 place-items-center rounded-xl transition hover:scale-105"
                              style={styles.softButton}
                              title="Copiar SKU"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                          <span className="text-xs font-semibold" style={styles.muted} title={product._id}>
                            ID {shortId(product._id)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="p-3" style={styles.metricBox}>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>Venta</p>
                        <p className="mt-1 text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>{formatCurrency(margin.price)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3" style={styles.metricBox}>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>Costo</p>
                          <p className="mt-1 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{formatCurrency(margin.cost)}</p>
                        </div>
                        <div className="p-3" style={styles.metricBox}>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>Margen</p>
                          <p className="mt-1 text-sm font-black" style={{ color: 'var(--admin-primary)' }}>{margin.marginPercent.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--admin-button-soft-bg)' }}>
                        <div className="h-full rounded-full" style={{ width: `${marginSafe}%`, background: 'var(--admin-primary)' }} />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-3 text-center" style={styles.metricBox}>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>Stock</p>
                          <p className="mt-1 text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>{formatNumber(inventory.stock)}</p>
                        </div>
                        <div className="p-3 text-center" style={styles.metricBox}>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>Disp.</p>
                          <p className="mt-1 text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>{formatNumber(inventory.availableStock)}</p>
                        </div>
                        <div className="p-3 text-center" style={styles.metricBox}>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>Res.</p>
                          <p className="mt-1 text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>{formatNumber(inventory.reservedStock)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span style={badgeStyle(health.tone)}>
                          <HealthIcon className="h-3.5 w-3.5" />
                          {health.label}
                        </span>
                        <span style={badgeStyle(product.trackInventory ? 'primary' : 'neutral')}>
                          {product.trackInventory ? 'Con inventario' : 'Sin inventario'}
                        </span>
                      </div>

                      <p className="text-xs font-semibold" style={styles.muted}>
                        {inventory.branchesCount || 0} sedes · {inventory.variantsCount || 0} variantes · {stockSource}
                      </p>
                    </div>

                    {canUseProductActions && (
                      <div className="grid gap-2 lg:justify-end">
                        <Can permission="products:update">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/productos/editar/${product._id}`)}
                            className="inline-flex h-10 w-full items-center justify-center gap-2 px-4 text-sm font-black transition hover:scale-[1.02] lg:w-[138px] !text-white"
                            style={styles.primaryButton}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                        </Can>

                        <button
                          type="button"
                          onClick={() => navigate(`/admin/inventario?productId=${product._id}`)}
                          className="inline-flex h-10 w-full items-center justify-center gap-2 px-4 text-sm font-black transition hover:scale-[1.02] lg:w-[138px] !text-white"
                          style={styles.inventoryButton}
                        >
                          <Warehouse className="h-4 w-4" />
                          Inventario
                        </button>

                        <Can permission="products:delete">
                          <button
                            type="button"
                            onClick={() => {
                              openArchiveConfirmation([product._id]);
                            }}
                            className="inline-flex h-10 w-full items-center justify-center gap-2 px-4 text-sm font-black transition hover:scale-[1.02] lg:w-[138px] !text-white"
                            style={styles.dangerButton}
                          >
                            <Trash2 className="h-4 w-4" />
                            Retirar
                          </button>
                        </Can>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {pagination.pages > 1 && (
            <div
              className="mt-5 flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between"
              style={{
                borderColor: 'var(--admin-card-border)',
                background: 'var(--admin-card-bg)',
              }}
            >
              <p className="text-xs font-bold" style={styles.muted}>
                Página {formatNumber(pagination.page)} de {formatNumber(pagination.pages)}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={loading || pagination.page <= 1}
                  className="inline-flex h-10 items-center justify-center gap-2 px-4 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
                  style={styles.softButton}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(pagination.pages, current + 1)
                    )
                  }
                  disabled={
                    loading || pagination.page >= pagination.pages
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 px-4 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
                  style={styles.softButton}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        show={confirmOpen}
        onClose={() => {
          if (bulkBusy) return;
          setConfirmOpen(false);
          setArchiveSelection([]);
        }}
        onConfirm={handleArchive}
        message={
          archiveSelection.length > 1
            ? `¿Seguro que deseas retirar ${archiveSelection.length} productos? Se conservarán sus historiales, inventario e imágenes.`
            : '¿Seguro que deseas retirar este producto? Se conservarán su historial, inventario e imágenes.'
        }
      />
    </div>
  );
}
