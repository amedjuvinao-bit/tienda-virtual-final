// frontend/src/admin/pos/PosSalesPage.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CreditCard,
  Loader2,
  PackageSearch,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { getPosBootstrap, getPosProducts } from '../api/adminPosApi';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

function getPaymentLabel(method) {
  const labels = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    card: 'Tarjeta / Datáfono',
    mixed: 'Pago mixto',
    other: 'Otro',
  };

  return labels[method] || method || 'Pago';
}

function getVariantLabel(product = {}) {
  const parts = [product.size, product.color].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'Variante general';
}

function InfoPill({ icon: Icon, label, value }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-primary-soft-bg)',
        color: 'var(--admin-primary-soft-text)',
      }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap opacity-75">{label}</span>
      <span className="truncate" style={{ color: 'var(--admin-card-text)' }}>
        {value}
      </span>
    </div>
  );
}

function PosCard({ children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border ${className}`}
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        boxShadow: 'var(--admin-shadow-sm, 0 8px 24px rgba(0,0,0,0.06))',
      }}
    >
      {children}
    </section>
  );
}

function ProductImage({ product }) {
  if (product?.image) {
    return (
      <img
        src={product.image}
        alt={product.title || ''}
        className="h-16 w-16 rounded-2xl object-cover"
      />
    );
  }

  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-2xl border"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-primary-soft-bg)',
        color: 'var(--admin-primary)',
      }}
    >
      <ShoppingBag className="h-6 w-6" />
    </div>
  );
}

function PosProductRow({ product }) {
  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-4 lg:flex-row lg:items-center lg:justify-between"
      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}
    >
      <div className="flex min-w-0 gap-3">
        <ProductImage product={product} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
            {product.title || 'Producto sin nombre'}
          </p>

          <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
            {product.sku ? <span>SKU: {product.sku}</span> : null}
            {product.barcode ? <span>Código: {product.barcode}</span> : null}
            <span>{getVariantLabel(product)}</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-black"
              style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}
            >
              Stock: {Number(product.availableStock || 0)}
            </span>
            {product.category ? (
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: 'var(--admin-card-bg)', color: 'var(--admin-card-muted-text)' }}
              >
                {product.category}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 lg:flex-col lg:items-end">
        <strong className="text-base" style={{ color: 'var(--admin-primary)' }}>
          {formatMoney(product.price)}
        </strong>

        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: 'var(--admin-primary)' }}
          title="El agregado al carrito se conectará en el siguiente paso"
        >
          <Plus className="h-4 w-4" />
          Agregar
        </button>
      </div>
    </div>
  );
}

export default function PosSalesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bootstrap, setBootstrap] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');

  const branches = useMemo(
    () => (Array.isArray(bootstrap?.branches) ? bootstrap.branches : []),
    [bootstrap]
  );

  const paymentMethods = useMemo(
    () => (Array.isArray(bootstrap?.paymentMethods) ? bootstrap.paymentMethods : []),
    [bootstrap]
  );

  const selectedBranch = useMemo(() => {
    return branches.find((branch) => branch.id === selectedBranchId) || bootstrap?.defaultBranch || null;
  }, [branches, bootstrap?.defaultBranch, selectedBranchId]);

  const billingActive = bootstrap?.billing?.electronicBillingActive === true;

  const loadBootstrap = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await getPosBootstrap();
      setBootstrap(data);

      const defaultBranchId = data?.defaultBranch?.id || data?.branches?.[0]?.id || '';
      setSelectedBranchId(defaultBranchId);
      setPaymentMethod(data?.defaultBranch?.settings?.defaultPaymentMethod || data?.paymentMethods?.[0]?.key || 'cash');
    } catch (err) {
      setError(err?.message || 'No fue posible cargar el POS.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (loading || !selectedBranchId) {
      setProducts([]);
      return undefined;
    }

    let active = true;

    const timeout = window.setTimeout(async () => {
      try {
        setProductsLoading(true);
        setProductsError('');

        const data = await getPosProducts({
          branchId: selectedBranchId,
          q: searchTerm,
          limit: 30,
        });

        if (!active) return;
        setProducts(Array.isArray(data?.products) ? data.products : []);
      } catch (err) {
        if (!active) return;
        setProducts([]);
        setProductsError(err?.message || 'No fue posible buscar productos POS.');
      } finally {
        if (active) setProductsLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [loading, selectedBranchId, searchTerm]);

  return (
    <div className="min-h-full space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl border"
              style={{
                borderColor: 'var(--admin-primary-soft-border)',
                background: 'var(--admin-primary-soft-bg)',
                color: 'var(--admin-primary)',
              }}
            >
              <Store className="h-5 w-5" />
            </div>

            <div>
              <h1
                className="text-2xl font-black tracking-tight"
                style={{ color: 'var(--admin-card-text)' }}
              >
                POS / Ventas físicas
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                Registra ventas de mostrador conectadas a órdenes, pagos e inventario por sede.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={loadBootstrap}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            borderColor: 'var(--admin-primary-soft-border)',
            background: 'var(--admin-primary-soft-bg)',
            color: 'var(--admin-primary)',
          }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar POS
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">No se pudo cargar la información del POS</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <PosCard className="flex min-h-[360px] items-center justify-center p-8">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--admin-primary)' }} />
            <p className="mt-3 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
              Cargando configuración del POS...
            </p>
          </div>
        </PosCard>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            <InfoPill
              icon={Building2}
              label="Sede"
              value={selectedBranch?.name || 'Sin sede POS'}
            />
            <InfoPill
              icon={CreditCard}
              label="Pago"
              value={getPaymentLabel(paymentMethod)}
            />
            <InfoPill
              icon={ReceiptText}
              label="Facturación"
              value={billingActive ? `Activa (${bootstrap?.billing?.provider || 'proveedor'})` : 'No activa'}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
            <div className="space-y-5">
              <PosCard className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                  <div className="flex-1">
                    <label
                      className="mb-2 block text-xs font-black uppercase tracking-[0.18em]"
                      style={{ color: 'var(--admin-card-muted-text)' }}
                    >
                      Sede de venta
                    </label>
                    <select
                      value={selectedBranchId}
                      onChange={(event) => setSelectedBranchId(event.target.value)}
                      className="w-full rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none"
                      style={{
                        borderColor: 'var(--admin-card-border)',
                        color: 'var(--admin-card-text)',
                        background: 'var(--admin-card-bg)',
                      }}
                    >
                      {branches.length === 0 ? (
                        <option value="">No hay sedes habilitadas para POS</option>
                      ) : (
                        branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name} - {branch.code}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="flex-1">
                    <label
                      className="mb-2 block text-xs font-black uppercase tracking-[0.18em]"
                      style={{ color: 'var(--admin-card-muted-text)' }}
                    >
                      Método de pago
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      className="w-full rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none"
                      style={{
                        borderColor: 'var(--admin-card-border)',
                        color: 'var(--admin-card-text)',
                        background: 'var(--admin-card-bg)',
                      }}
                    >
                      {paymentMethods.map((method) => (
                        <option key={method.key} value={method.key}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </PosCard>

              <PosCard className="overflow-hidden">
                <div className="border-b p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>
                        Buscar productos
                      </h2>
                      <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                        Consulta el inventario disponible de la sede seleccionada.
                      </p>
                    </div>
                    <PackageSearch className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} />
                  </div>
                </div>

                <div className="p-5">
                  <div
                    className="flex items-center gap-3 rounded-2xl border px-4 py-3"
                    style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}
                  >
                    <Search className="h-5 w-5 shrink-0" style={{ color: 'var(--admin-card-muted-text)' }} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Buscar por nombre, SKU o código de barras"
                      className="w-full bg-transparent text-sm font-semibold outline-none"
                      style={{ color: 'var(--admin-card-text)' }}
                    />
                    {productsLoading ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--admin-primary)' }} /> : null}
                  </div>

                  {productsError ? (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-black">No se pudo buscar productos</p>
                        <p className="mt-1">{productsError}</p>
                      </div>
                    </div>
                  ) : null}

                  {!productsError && productsLoading ? (
                    <div
                      className="mt-5 rounded-2xl border p-8 text-center"
                      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-primary-soft-bg)' }}
                    >
                      <Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--admin-primary)' }} />
                      <p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
                        Buscando productos...
                      </p>
                    </div>
                  ) : null}

                  {!productsError && !productsLoading && products.length === 0 ? (
                    <div
                      className="mt-5 rounded-2xl border p-8 text-center"
                      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-primary-soft-bg)' }}
                    >
                      <ShoppingBag className="mx-auto h-9 w-9" style={{ color: 'var(--admin-primary)' }} />
                      <p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
                        No hay productos con stock disponible
                      </p>
                      <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                        La búsqueda ya está conectada. Cuando exista stock en la sede, aquí aparecerán los productos para agregarlos al carrito.
                      </p>
                    </div>
                  ) : null}

                  {!productsError && !productsLoading && products.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      {products.map((product) => (
                        <PosProductRow key={product.id || `${product.productId}-${product.variantKey}`} product={product} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </PosCard>
            </div>

            <PosCard className="overflow-hidden">
              <div className="border-b p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
                <h2 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>
                  Carrito de venta
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                  Resumen de productos, descuentos y pago.
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div
                  className="rounded-2xl border p-5 text-center"
                  style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}
                >
                  <ReceiptText className="mx-auto h-8 w-8" style={{ color: 'var(--admin-primary)' }} />
                  <p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
                    Sin productos agregados
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>
                    Agrega productos desde el buscador para calcular la venta.
                  </p>
                </div>

                <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)' }}>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--admin-card-muted-text)' }}>Subtotal</span>
                    <strong style={{ color: 'var(--admin-card-text)' }}>{formatMoney(0)}</strong>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--admin-card-muted-text)' }}>Descuento</span>
                    <strong style={{ color: 'var(--admin-card-text)' }}>{formatMoney(0)}</strong>
                  </div>
                  <div className="h-px" style={{ background: 'var(--admin-card-border)' }} />
                  <div className="flex items-center justify-between text-base">
                    <span className="font-black" style={{ color: 'var(--admin-card-text)' }}>Total</span>
                    <strong className="text-xl" style={{ color: 'var(--admin-primary)' }}>{formatMoney(0)}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: 'var(--admin-primary)' }}
                >
                  <BadgeCheck className="h-5 w-5" />
                  Confirmar venta
                </button>
              </div>
            </PosCard>
          </div>
        </>
      )}
    </div>
  );
}
