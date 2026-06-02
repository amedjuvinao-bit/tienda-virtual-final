// frontend/src/admin/ProductosAdmin.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Copy } from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmDialog from '../components/ConfirmDialog';
import Can from './security/Can';
import useAdminPermissions from './security/useAdminPermissions';

// ✅ usa el cliente que ya agrega x-admin-token / X-Session-Id
import api from '../lib/api';

// Helper: calcula el stock a mostrar (matriz > global)
function getDisplayStock(p) {
  try {
    if (Array.isArray(p?.inventory) && p.inventory.length > 0) {
      return p.inventory.reduce((acc, row) => {
        const v = Number(row?.stock ?? row?.qty ?? row?.quantity ?? 0) || 0;
        return acc + v;
      }, 0);
    }
    return Number(p?.stock ?? 0) || 0;
  } catch {
    return Number(p?.stock ?? 0) || 0;
  }
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        // 🔸 trae TODOS (activos + inactivos) para administración
        const res = await api.get('/api/products', { params: { all: 1 } });

        if (cancel) return;

        const list = Array.isArray(res.data) ? res.data : [];
        setProducts(list);
      } catch (err) {
        if (cancel) return;

        console.error('Error cargando productos:', err?.message || err);
        setError('No se pudieron cargar los productos.');
      } finally {
        if (!cancel) setLoading(false);
      }
    };

    load();

    return () => {
      cancel = true;
    };
  }, []);

  const filtered = products.filter((p) => {
    if (!q.trim()) return true;

    const needle = q.toLowerCase();

    return (
      String(p.title || '').toLowerCase().includes(needle) ||
      String(p.description || '').toLowerCase().includes(needle) ||
      String(p._id || '').toLowerCase().includes(needle) ||
      String(p.sku || '').toLowerCase().includes(needle)
    );
  });

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
        className="flex justify-between items-center"
        style={{ marginBottom: 'var(--admin-gap)' }}
      >
        <h1
          className="text-xl font-semibold"
          style={{ color: 'var(--admin-card-text)' }}
        >
          Productos
        </h1>
      </div>

      <div
        className="flex items-center"
        style={{
          gap: 'calc(var(--admin-gap) * 0.55)',
          marginBottom: 'var(--admin-gap)',
        }}
      >
        <input
          className="w-full max-w-sm outline-none"
          placeholder="Buscar por nombre, descripción, SKU o ID…"
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

        <span
          className="text-sm"
          style={{ color: 'var(--admin-card-muted-text)' }}
        >
          {loading ? 'Cargando…' : `${filtered.length} de ${products.length}`}
        </span>

        <Can permission="products:create">
          <button
            onClick={() => navigate('/admin/productos/nuevo')}
            className="flex items-center ml-auto text-sm font-medium transform transition-all duration-200 hover:scale-105 active:scale-95"
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
              <th
                className="text-left p-3 border-b"
                style={{ borderColor: 'var(--admin-table-border)' }}
              >
                Nombre
              </th>
              <th
                className="text-left p-3 border-b"
                style={{ borderColor: 'var(--admin-table-border)' }}
              >
                SKU
              </th>
              <th
                className="text-left p-3 border-b"
                style={{ borderColor: 'var(--admin-table-border)' }}
              >
                Precio
              </th>
              <th
                className="text-left p-3 border-b"
                style={{ borderColor: 'var(--admin-table-border)' }}
              >
                Stock
              </th>
              <th
                className="text-left p-3 border-b"
                style={{ borderColor: 'var(--admin-table-border)' }}
              >
                Activo
              </th>
              <th
                className="text-left p-3 border-b"
                style={{ borderColor: 'var(--admin-table-border)' }}
              >
                ID
              </th>

              {canUseProductActions && (
                <th
                  className="text-left p-3 border-b w-40"
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
              const displayStock = getDisplayStock(p);

              return (
                <tr
                  key={p._id}
                  style={{
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      'var(--admin-table-row-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td
                    className="p-3 border-b"
                    style={{ borderColor: 'var(--admin-table-border)' }}
                  >
                    {p.title}
                  </td>

                  <td
                    className="p-3 border-b"
                    style={{ borderColor: 'var(--admin-table-border)' }}
                  >
                    {p.sku ? (
                      <div
                        className="flex items-center"
                        style={{ gap: 'calc(var(--admin-gap) * 0.45)' }}
                      >
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
                    ) : (
                      <span
                        className="text-xs"
                        style={{ color: 'var(--admin-table-muted-text)' }}
                      >
                        —
                      </span>
                    )}
                  </td>

                  <td
                    className="p-3 border-b"
                    style={{ borderColor: 'var(--admin-table-border)' }}
                  >
                    {Number(p.price || 0).toLocaleString('es-CO', {
                      style: 'currency',
                      currency: 'COP',
                    })}
                  </td>

                  <td
                    className="p-3 border-b"
                    style={{
                      borderColor: 'var(--admin-table-border)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {displayStock}
                  </td>

                  <td
                    className="p-3 border-b"
                    style={{ borderColor: 'var(--admin-table-border)' }}
                  >
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
                      {p.active ? 'Sí' : 'No'}
                    </span>
                  </td>

                  <td
                    className="p-3 border-b font-mono text-[12px]"
                    style={{ borderColor: 'var(--admin-table-border)' }}
                  >
                    {p._id}
                  </td>

                  {canUseProductActions && (
                    <td
                      className="p-3 border-b"
                      style={{ borderColor: 'var(--admin-table-border)' }}
                    >
                      <div
                        className="flex"
                        style={{ gap: 'calc(var(--admin-gap) * 0.45)' }}
                      >
                        <Can permission="products:update">
                          <button
                            style={{
                              padding: '4px 12px',
                              borderRadius: 'calc(var(--admin-radius) * 0.35)',
                              background: 'var(--admin-button-bg)',
                              color: 'var(--admin-button-text)',
                              fontSize: 12,
                            }}
                            onClick={() =>
                              navigate(`/admin/productos/editar/${p._id}`)
                            }
                          >
                            Editar
                          </button>
                        </Can>

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