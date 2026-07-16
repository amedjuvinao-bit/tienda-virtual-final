// frontend/src/admin/ProductosAdmin.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, PackageSearch, Plus, Warehouse } from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmDialog from '../components/ConfirmDialog';
import Can from './security/Can';
import useAdminPermissions from './security/useAdminPermissions';
import { formatProductTypeLabel, PRODUCT_TYPES } from './products/productCatalogConfig';

// ✅ usa el cliente que ya agrega x-admin-token / X-Session-Id
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

function getSearchText(product) {
  return [
    product?.title,
    product?.description,
    product?._id,
    product?.sku,
    product?.barcode,
    product?.category,
    product?.productType,
    ...(Array.isArray(product?.categories) ? product.categories : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getMarginSummary(product) {
  const price = Number(product?.financialSummary?.price ?? product?.price ?? 0) || 0;
  const cost = Number(product?.financialSummary?.cost ?? product?.cost ?? 0) || 0;
  const marginValue = Number(product?.financialSummary?.marginValue ?? Math.max(0, price - cost));
  const marginPercent = Number(product?.financialSummary?.marginPercent ?? (price > 0 ? (marginValue / price) * 100 : 0));

  return {
    price,
    cost,
    marginValue,
    marginPercent,
  };
}

export default function ProductosAdmin() {
  const { can } = useAdminPermissions();

  const canUpdateProduct = can('products:update');
  const canDeleteProduct = can('products:delete');
  const canUseProductActions = canUpdateProduct || canDeleteProduct;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await api.get('/api/products/admin/list', {
          params: {
            all: 1,
            productType: productTypeFilter,
          },
        });

        if (cancel) return;

        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];

        setProducts(list);
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
  }, [productTypeFilter]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    if (!needle) return products;

    return products.filter((product) => getSearchText(product).includes(needle));
  }, [products, q]);

  const summary = useMemo(() => {
    return products.reduce(
      (acc, product) => {
        const inv = getInventorySummary(product);
        const margin = getMarginSummary(product);

        acc.stock += Number(inv.stock || 0);
        acc.available += Number(inv.availableStock || 0);
        acc.reserved += Number(inv.reservedStock || 0);
        acc.costValue += Number(margin.cost || 0) * Number(inv.stock || 0);
        acc.saleValue += Number(margin.price || 0) * Number(inv.stock || 0);
        return acc;
      },
      {
        stock: 0,
        available: 0,
        reserved: 0,
        costValue: 0,
        saleValue: 0,
      }
    );
  }, [products]);

  const copySku = async (sku) => {
    if (!sku) return;

    try {
      await navigator.clipboard.writeText(sku);
      toast.success('SKU copiado');
    } catch {
      toast.error('No se pudo copiar el SKU');
    }
  };

  const handleDelete = async () => {
    if (!canDeleteProduct) {
      toast.error('No tienes permiso para eliminar productos');
      setConfirmOpen(false);
      setProductToDelete(null);
      return;
    }

    if (!productToDelete) return;

    try {
      await api.delete(`/api/products/${productToDelete}`);
      setProducts((prev) => prev.filter((p) => p._id !== productToDelete));
      toast.success('Producto eliminado');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo eliminar el producto');
    } finally {
      setConfirmOpen(false);
      setProductToDelete(null);
    }
  };

  return (
    <div
      style={{
        padding: 'var(--admin-padding)',
        color: 'var(--admin-card-text)',
      }}
    >
      <div
        className="flex flex-wrap items-start justify-between gap-4"
        style={{ marginBottom: 'var(--admin-gap)' }}
      >
        <div>
          <p
            className="text-[11px] font-black uppercase tracking-[0.22em]"
            style={{ color: 'var(--admin-primary)' }}
          >
            Catálogo universal
          </p>
          <h1
            className="mt-1 text-2xl font-semibold"
            style={{ color: 'var(--admin-card-text)' }}
          >
            Productos
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
            Gestiona datos comerciales aquí. Las existencias reales vienen desde Inventario por sede.
          </p>
        </div>

        <Can permission="products:create">
          <button
            onClick={() => navigate('/admin/productos/nuevo')}
            className="flex items-center text-sm font-medium transform transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              gap: 'calc(var(--admin-gap) * 0.45)',
              padding:
                'calc(var(--admin-padding) * 0.5) calc(var(--admin-padding) * 0.9)',
              background: 'var(--admin-button-bg)',
              color: 'var(--admin-button-text)',
              borderRadius: 'calc(var(--admin-radius) * 0.45)',
              boxShadow:
                'var(--admin-shadow-sm, 0 4px 14px rgba(0,0,0,0.08))',
            }}
          >
            <Plus className="w-4 h-4" />
            Agregar producto
          </button>
        </Can>
      </div>

      <div
        className="grid gap-3 md:grid-cols-4"
        style={{ marginBottom: 'var(--admin-gap)' }}
      >
        {[
          { label: 'Productos', value: products.length },
          { label: 'Stock real', value: formatNumber(summary.stock) },
          { label: 'Disponible', value: formatNumber(summary.available) },
          { label: 'Costo estimado', value: formatCurrency(summary.costValue) },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border px-4 py-3 shadow-sm"
            style={{
              borderColor: 'var(--admin-card-border)',
              background: 'var(--admin-card-bg)',
              color: 'var(--admin-card-text)',
            }}
          >
            <p
              className="text-[10px] font-black uppercase tracking-[0.18em]"
              style={{ color: 'var(--admin-card-muted-text)' }}
            >
              {item.label}
            </p>
            <p className="mt-1 text-xl font-black leading-none">{item.value}</p>
          </div>
        ))}
      </div>

      <div
        className="flex flex-wrap items-center"
        style={{
          gap: 'calc(var(--admin-gap) * 0.55)',
          marginBottom: 'var(--admin-gap)',
        }}
      >
        <input
          className="w-full max-w-sm outline-none"
          placeholder="Buscar por nombre, descripción, SKU, código o ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            border: '1px solid var(--admin-input-border)',
            borderRadius: 'calc(var(--admin-radius) * 0.45)',
            background: 'var(--admin-input-bg)',
            color: 'var(--admin-input-text)',
            padding:
              'calc(var(--admin-padding) * 0.5) calc(var(--admin-padding) * 0.7)',
          }}
        />

        <select
          value={productTypeFilter}
          onChange={(event) => setProductTypeFilter(event.target.value)}
          className="outline-none"
          style={{
            border: '1px solid var(--admin-input-border)',
            borderRadius: 'calc(var(--admin-radius) * 0.45)',
            background: 'var(--admin-input-bg)',
            color: 'var(--admin-input-text)',
            padding:
              'calc(var(--admin-padding) * 0.5) calc(var(--admin-padding) * 0.7)',
          }}
        >
          <option value="all">Todos los tipos</option>
          {PRODUCT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        <span
          className="text-sm"
          style={{ color: 'var(--admin-card-muted-text)' }}
        >
          {loading ? 'Cargando…' : `${filtered.length} de ${products.length}`}
        </span>
      </div>

      {error && (
        <div
          className="text-sm"
          style={{
            marginBottom: 'var(--admin-gap)',
            borderRadius: 'calc(var(--admin-radius) * 0.45)',
            border: '1px solid var(--admin-danger)',
            background: 'var(--admin-danger-soft-bg)',
            color: 'var(--admin-danger-text)',
            padding: 'calc(var(--admin-padding) * 0.7)',
          }}
        >
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table
          className="min-w-full overflow-hidden"
          style={{
            border: '1px solid var(--admin-table-border)',
            borderRadius: 'calc(var(--admin-radius) * 0.55)',
            color: 'var(--admin-table-text)',
          }}
        >
          <thead
            className="text-sm"
            style={{
              background: 'var(--admin-table-head-bg)',
              color: 'var(--admin-table-text)',
            }}
          >
            <tr>
              <th className="text-left p-3 border-b" style={{ borderColor: 'var(--admin-table-border)' }}>
                Producto
              </th>
              <th className="text-left p-3 border-b" style={{ borderColor: 'var(--admin-table-border)' }}>
                Tipo
              </th>
              <th className="text-left p-3 border-b" style={{ borderColor: 'var(--admin-table-border)' }}>
                Precio / margen
              </th>
              <th className="text-left p-3 border-b" style={{ borderColor: 'var(--admin-table-border)' }}>
                Inventario real
              </th>
              <th className="text-left p-3 border-b" style={{ borderColor: 'var(--admin-table-border)' }}>
                Estado
              </th>
              <th className="text-left p-3 border-b" style={{ borderColor: 'var(--admin-table-border)' }}>
                ID
              </th>

              {canUseProductActions && (
                <th
                  className="text-left p-3 border-b min-w-[230px]"
                  style={{ borderColor: 'var(--admin-table-border)' }}
                >
                  Acciones
                </th>
              )}
            </tr>
          </thead>

          <tbody className="text-sm">
            {!loading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={canUseProductActions ? 7 : 6}
                  className="p-4 text-center"
                  style={{ color: 'var(--admin-table-muted-text)' }}
                >
                  Sin resultados
                </td>
              </tr>
            )}

            {filtered.map((p) => {
              const inventory = getInventorySummary(p);
              const margin = getMarginSummary(p);
              const stockSource = inventory.source === 'InventoryStock' ? 'Inventario' : 'Producto';

              return (
                <tr
                  key={p._id}
                  style={{ background: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      'var(--admin-table-row-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td className="p-3 border-b" style={{ borderColor: 'var(--admin-table-border)' }}>
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
                        style={{
                          borderColor: 'var(--admin-primary-soft-border)',
                          background: 'var(--admin-primary-soft-bg)',
                          color: 'var(--admin-primary)',
                        }}
                      >
                        {p.image ? (
                          <img src={p.image} alt={p.title} className="h-full w-full object-cover" />
                        ) : (
                          <PackageSearch className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold" style={{ color: 'var(--admin-table-text)' }}>
                          {p.title}
                        </p>
                        {p.sku ? (
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className="font-mono text-[12px]"
                              style={{
                                background: 'var(--admin-primary-soft-bg)',
                                color: 'var(--admin-primary-soft-text)',
                                padding: '2px 8px',
                                borderRadius: 'calc(var(--admin-radius) * 0.35)',
                              }}
                            >
                              {p.sku}
                            </span>

                            <button
                              onClick={() => copySku(p.sku)}
                              title="Copiar SKU"
                              style={{
                                padding: 4,
                                borderRadius: 'calc(var(--admin-radius) * 0.3)',
                                color: 'var(--admin-card-muted-text)',
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td className="p-3 border-b" style={{ borderColor: 'var(--admin-table-border)' }}>
                    <div className="grid gap-1">
                      <span className="font-semibold">{formatProductTypeLabel(p.productType)}</span>
                      <span className="text-xs" style={{ color: 'var(--admin-table-muted-text)' }}>
                        {p.category || 'Sin categoría'}
                      </span>
                      <span
                        className="w-fit text-[11px] font-bold uppercase tracking-[0.12em]"
                        style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          background: p.trackInventory
                            ? 'var(--admin-primary-soft-bg)'
                            : 'var(--admin-button-soft-bg)',
                          color: p.trackInventory
                            ? 'var(--admin-primary-soft-text)'
                            : 'var(--admin-button-soft-text)',
                        }}
                      >
                        {p.trackInventory ? 'Con inventario' : 'Sin inventario'}
                      </span>
                    </div>
                  </td>

                  <td className="p-3 border-b" style={{ borderColor: 'var(--admin-table-border)' }}>
                    <div className="grid gap-1">
                      <span className="font-semibold">{formatCurrency(margin.price)}</span>
                      <span className="text-xs" style={{ color: 'var(--admin-table-muted-text)' }}>
                        Costo: {formatCurrency(margin.cost)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--admin-primary)' }}>
                        Margen: {formatCurrency(margin.marginValue)} · {margin.marginPercent.toFixed(1)}%
                      </span>
                    </div>
                  </td>

                  <td
                    className="p-3 border-b"
                    style={{
                      borderColor: 'var(--admin-table-border)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <div className="grid gap-1">
                      <span className="font-semibold">Stock: {formatNumber(inventory.stock)}</span>
                      <span className="text-xs" style={{ color: 'var(--admin-table-muted-text)' }}>
                        Disponible: {formatNumber(inventory.availableStock)} · Reservado: {formatNumber(inventory.reservedStock)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--admin-table-muted-text)' }}>
                        {inventory.branchesCount || 0} sedes · {inventory.variantsCount || 0} variantes · {stockSource}
                      </span>
                    </div>
                  </td>

                  <td className="p-3 border-b" style={{ borderColor: 'var(--admin-table-border)' }}>
                    <span
                      className="text-xs"
                      style={{
                        padding: '4px 8px',
                        borderRadius: 'calc(var(--admin-radius) * 0.35)',
                        background: p.active
                          ? 'var(--admin-primary-soft-bg)'
                          : 'var(--admin-button-soft-bg)',
                        color: p.active
                          ? 'var(--admin-primary-soft-text)'
                          : 'var(--admin-button-soft-text)',
                      }}
                    >
                      {p.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>

                  <td
                    className="p-3 border-b font-mono text-[12px]"
                    style={{ borderColor: 'var(--admin-table-border)' }}
                  >
                    {p._id}
                  </td>

                  {canUseProductActions && (
                    <td className="p-3 border-b" style={{ borderColor: 'var(--admin-table-border)' }}>
                      <div className="flex flex-wrap gap-2">
                        <Can permission="products:update">
                          <button
                            style={{
                              padding: '4px 12px',
                              borderRadius: 'calc(var(--admin-radius) * 0.35)',
                              background: 'var(--admin-button-bg)',
                              color: 'var(--admin-button-text)',
                              fontSize: 12,
                            }}
                            onClick={() => navigate(`/admin/productos/editar/${p._id}`)}
                          >
                            Editar
                          </button>
                        </Can>

                        <button
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 12px',
                            borderRadius: 'calc(var(--admin-radius) * 0.35)',
                            background: 'var(--admin-button-soft-bg)',
                            color: 'var(--admin-button-soft-text)',
                            fontSize: 12,
                          }}
                          onClick={() => navigate(`/admin/inventario?productId=${p._id}`)}
                        >
                          <Warehouse className="h-3.5 w-3.5" />
                          Inventario
                        </button>

                        <Can permission="products:delete">
                          <button
                            style={{
                              padding: '4px 12px',
                              borderRadius: 'calc(var(--admin-radius) * 0.35)',
                              background: 'var(--admin-danger)',
                              color: '#fff',
                              fontSize: 12,
                            }}
                            onClick={() => {
                              setProductToDelete(p._id);
                              setConfirmOpen(true);
                            }}
                          >
                            Eliminar
                          </button>
                        </Can>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de confirmación */}
      <ConfirmDialog
        show={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        message="¿Seguro que deseas eliminar este producto?"
      />
    </div>
  );
}
