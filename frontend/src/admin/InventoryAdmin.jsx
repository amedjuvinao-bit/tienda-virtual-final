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
          String(row?.product?._id || row?.product || row?.productSnapshot?.id || row?._id)
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
    <section className="space-y-6">
      <div className="rounded-[24px] border border-pink-200/80 bg-white/70 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-pink-500">
              Inventario por sedes
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              Inventario
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Controla el stock disponible por sede, producto, talla, color y movimientos de inventario.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadInventory}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-pink-200 bg-white px-4 py-2 text-sm font-semibold text-pink-600 transition hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={loading ? 'animate-spin' : ''}
              />
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-600"
            >
              <Plus size={16} />
              Nuevo ajuste
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-pink-100 bg-white/75 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">
              Productos con stock
            </span>
            <PackageSearch size={20} className="text-pink-500" />
          </div>

          <p className="mt-4 text-3xl font-bold text-slate-900">
            {formatNumber(summary.productsWithStock)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Productos con existencia registrada
          </p>
        </article>

        <article className="rounded-2xl border border-pink-100 bg-white/75 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">
              Stock total
            </span>
            <PackageSearch size={20} className="text-pink-500" />
          </div>

          <p className="mt-4 text-3xl font-bold text-slate-900">
            {formatNumber(summary.totalStock)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Todas las sedes</p>
        </article>

        <article className="rounded-2xl border border-pink-100 bg-white/75 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">
              Disponible
            </span>
            <PackageSearch size={20} className="text-pink-500" />
          </div>

          <p className="mt-4 text-3xl font-bold text-slate-900">
            {formatNumber(summary.totalAvailable)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Listo para venta</p>
        </article>

        <article className="rounded-2xl border border-pink-100 bg-white/75 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">
              Movimientos
            </span>
            <ArrowRightLeft size={20} className="text-pink-500" />
          </div>

          <p className="mt-4 text-3xl font-bold text-slate-900">
            {formatNumber(summary.totalMovements)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Entradas, salidas y ajustes</p>
        </article>
      </div>

      <div className="rounded-[24px] border border-pink-200/80 bg-white/75 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Stock por sede
            </h2>
            <p className="text-sm text-slate-500">
              Aquí se muestra el inventario detallado por producto, sede, talla y color.
            </p>
          </div>

          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar producto, SKU o sede..."
            className="w-full rounded-xl border border-pink-200 bg-white px-4 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-pink-400 md:max-w-sm"
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-pink-100">
          <table className="min-w-full text-sm">
            <thead className="bg-pink-50 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
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

            <tbody className="divide-y divide-pink-100 bg-white/60">
              {loading && (
                <tr>
                  <td colSpan="8" className="px-4 py-10 text-center text-slate-500">
                    Cargando inventario...
                  </td>
                </tr>
              )}

              {!loading && filteredStockRows.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-10 text-center text-slate-500">
                    No hay registros de inventario para mostrar.
                  </td>
                </tr>
              )}

              {!loading &&
                filteredStockRows.map((row) => {
                  const color = getVariantColor(row);

                  return (
                    <tr key={row?._id} className="text-slate-700">
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {getProductTitle(row)}
                      </td>

                      <td className="px-4 py-4">
                        <span className="rounded-lg bg-pink-50 px-2 py-1 text-xs font-semibold text-slate-700">
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
                              className="h-4 w-4 rounded-full border border-slate-200"
                              style={{ backgroundColor: color }}
                            />
                          )}
                          <span>{color}</span>
                        </div>
                      </td>

                      <td className="px-4 py-4 font-bold text-slate-900">
                        {formatNumber(row?.stock)}
                      </td>

                      <td className="px-4 py-4 font-bold text-pink-600">
                        {formatNumber(getAvailableStock(row))}
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          className="rounded-lg bg-pink-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-pink-600"
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
    </section>
  );
}