// frontend/src/admin/InventoryAdmin.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PackageSearch,
  RefreshCw,
  Plus,
  ArrowRightLeft,
  AlertCircle,
} from 'lucide-react';
import api from '../lib/api';
import InventoryAdjustmentModal from './inventory/components/InventoryAdjustmentModal';

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

  tableWrapper: {
    borderRadius: 'calc(var(--admin-radius) + 2px)',
    border: '1px solid var(--admin-table-border)',
    overflow: 'hidden',
  },

  tableHead: {
    background: 'var(--admin-table-head-bg)',
    color: 'var(--admin-table-head-text)',
  },

  tableBody: {
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-table-text)',
  },

  tableRow: {
    borderTop: '1px solid var(--admin-table-border)',
    color: 'var(--admin-table-text)',
  },

  skuBadge: {
    borderRadius: 'calc(var(--admin-radius) - 8px)',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary-soft-text)',
  },

  actionButton: {
    borderRadius: 'calc(var(--admin-radius) - 8px)',
    border: '1px solid var(--admin-button-bg)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-text)',
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

export default function InventoryAdmin() {
  const [stockRows, setStockRows] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

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

  const filteredStockRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return stockRows;

    return stockRows.filter((row) => {
      const productTitle = getProductTitle(row).toLowerCase();
      const productSku = getProductSku(row).toLowerCase();
      const branchName = getBranchName(row).toLowerCase();
      const size = String(getVariantSize(row)).toLowerCase();
      const color = String(getVariantColor(row)).toLowerCase();

      return (
        productTitle.includes(term) ||
        productSku.includes(term) ||
        branchName.includes(term) ||
        size.includes(term) ||
        color.includes(term)
      );
    });
  }, [stockRows, searchTerm]);

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

          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar producto, SKU o sede..."
            className="admin-inventory-search w-full px-4 py-2 text-sm transition md:max-w-sm"
            style={styles.input}
          />
        </div>

        <div className="mt-6 overflow-x-auto" style={styles.tableWrapper}>
          <table className="min-w-full text-sm">
            <thead
              className="text-left text-xs font-bold uppercase tracking-wide"
              style={styles.tableHead}
            >
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Sede</th>
                <th className="px-4 py-3">Talla</th>
                <th className="px-4 py-3">Color</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Disponible</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>

            <tbody style={styles.tableBody}>
              {loading && (
                <tr style={styles.tableRow}>
                  <td
                    colSpan="8"
                    className="px-4 py-10 text-center"
                    style={styles.muted}
                  >
                    Cargando inventario...
                  </td>
                </tr>
              )}

              {!loading && filteredStockRows.length === 0 && (
                <tr style={styles.tableRow}>
                  <td
                    colSpan="8"
                    className="px-4 py-10 text-center"
                    style={styles.muted}
                  >
                    No hay registros de inventario para mostrar.
                  </td>
                </tr>
              )}

              {!loading &&
                filteredStockRows.map((row) => {
                  const color = getVariantColor(row);

                  return (
                    <tr
                      key={row?._id}
                      className="admin-inventory-table-row"
                      style={styles.tableRow}
                    >
                      <td className="px-4 py-4 font-semibold" style={styles.title}>
                        {getProductTitle(row)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className="px-2 py-1 text-xs font-semibold"
                          style={styles.skuBadge}
                        >
                          {getProductSku(row)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {getBranchName(row)}
                      </td>

                      <td className="px-4 py-4">
                        {getVariantSize(row)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {isHexColor(color) && (
                            <span
                              className="h-4 w-4 rounded-full"
                              style={{
                                backgroundColor: color,
                                border: '1px solid var(--admin-table-border)',
                              }}
                            />
                          )}
                          <span>{color}</span>
                        </div>
                      </td>

                      <td className="px-4 py-4 font-bold" style={styles.title}>
                        {formatNumber(row?.stock)}
                      </td>

                      <td
                        className="px-4 py-4 font-bold"
                        style={{ color: 'var(--admin-primary)' }}
                      >
                        {formatNumber(getAvailableStock(row))}
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          className="admin-inventory-action-button px-3 py-1.5 text-xs font-semibold transition"
                          style={styles.actionButton}
                        >
                          Ver movimientos
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <InventoryAdjustmentModal
        open={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
        stockRows={stockRows}
        onSaved={loadInventory}
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

          .admin-inventory-table-row:hover {
            background: var(--admin-table-row-hover) !important;
          }

          .admin-inventory-search::placeholder {
            color: var(--admin-input-placeholder);
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