// frontend/src/admin/pos/PosSalesPage.js

import React, { useEffect, useMemo, useState } from 'react';
import { getPosBootstrap, getPosProducts, previewPosSale } from '../api/adminPosApi';
import { buildPosPreviewPayload } from './posPreviewPayload';

const e = React.createElement;
const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function formatMoney(value) {
  return money.format(Number(value || 0));
}

function getCartKey(item = {}) {
  return item.id || `${item.productId || ''}:${item.variantKey || 'default__default'}`;
}

function getVariantLabel(item = {}) {
  return [item.size, item.color].filter(Boolean).join(' / ') || 'Variante general';
}

function cardStyle(extra = {}) {
  return {
    borderColor: 'var(--admin-card-border)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
    ...extra,
  };
}

function primaryButtonStyle() {
  return { background: 'var(--admin-primary)', color: '#fff' };
}

export default function PosSalesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bootstrap, setBootstrap] = useState(null);
  const [branchId, setBranchId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [q, setQ] = useState('');
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [cart, setCart] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const branches = Array.isArray(bootstrap?.branches) ? bootstrap.branches : [];
  const methods = Array.isArray(bootstrap?.paymentMethods) ? bootstrap.paymentMethods : [];
  const branch = branches.find((item) => item.id === branchId) || bootstrap?.defaultBranch || null;

  const cartMap = useMemo(() => {
    return cart.reduce((acc, item) => {
      acc[item.cartKey] = item;
      return acc;
    }, {});
  }, [cart]);

  const localSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  }, [cart]);

  const totalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  }, [cart]);

  const totals = useMemo(() => ({
    subtotal: Number(preview?.subtotal ?? localSubtotal),
    discount: Number(preview?.discount?.amount || 0),
    taxes: Number(preview?.taxes?.iva?.amount || 0),
    total: Number(preview?.total ?? localSubtotal),
  }), [localSubtotal, preview]);

  const addToCart = (product) => {
    const rowKey = getCartKey(product);
    const availableStock = Number(product.availableStock || 0);
    if (!rowKey || availableStock <= 0) return;

    setCart((prev) => {
      const found = prev.find((item) => item.cartKey === rowKey);
      if (found) {
        return prev.map((item) => {
          if (item.cartKey !== rowKey) return item;
          return { ...item, quantity: Math.min(Number(item.quantity || 1) + 1, availableStock) };
        });
      }
      return [...prev, { ...product, cartKey: rowKey, quantity: 1, price: Number(product.price || 0), availableStock }];
    });
  };

  const subtractFromCart = (rowKey) => {
    setCart((prev) => prev
      .map((item) => item.cartKey === rowKey ? { ...item, quantity: Number(item.quantity || 1) - 1 } : item)
      .filter((item) => Number(item.quantity || 0) > 0));
  };

  const removeFromCart = (rowKey) => {
    setCart((prev) => prev.filter((item) => item.cartKey !== rowKey));
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getPosBootstrap();
        if (!active) return;
        setBootstrap(data);
        setBranchId(data?.defaultBranch?.id || data?.branches?.[0]?.id || '');
        setPaymentMethod(data?.defaultBranch?.settings?.defaultPaymentMethod || data?.paymentMethods?.[0]?.key || 'cash');
      } catch (err) {
        if (active) setError(err?.message || 'No fue posible cargar el POS.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setCart([]);
    setPreview(null);
    setPreviewError('');
  }, [branchId]);

  useEffect(() => {
    if (loading || !branchId) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setProductsLoading(true);
        setProductsError('');
        const data = await getPosProducts({ branchId, q, limit: 30 });
        if (active) setProducts(Array.isArray(data?.products) ? data.products : []);
      } catch (err) {
        if (active) {
          setProducts([]);
          setProductsError(err?.message || 'No fue posible buscar productos POS.');
        }
      } finally {
        if (active) setProductsLoading(false);
      }
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [branchId, loading, q]);

  useEffect(() => {
    if (!branchId || cart.length === 0) {
      setPreview(null);
      setPreviewError('');
      setPreviewLoading(false);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setPreviewLoading(true);
        setPreviewError('');
        const data = await previewPosSale(buildPosPreviewPayload({ branchId, cartItems: cart }));
        if (active) setPreview(data?.preview || null);
      } catch (err) {
        if (active) {
          setPreview(null);
          setPreviewError(err?.message || 'No fue posible calcular la venta POS.');
        }
      } finally {
        if (active) setPreviewLoading(false);
      }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [branchId, cart]);

  if (loading) {
    return e('div', { className: 'min-h-full p-8', style: { color: 'var(--admin-card-text)' } }, 'Cargando POS...');
  }

  return e('div', { className: 'min-h-full space-y-5' },
    e('div', null,
      e('h1', { className: 'text-2xl font-black tracking-tight', style: { color: 'var(--admin-card-text)' } }, 'POS / Ventas físicas'),
      e('p', { className: 'mt-1 text-sm', style: { color: 'var(--admin-card-muted-text)' } }, 'Venta de mostrador con total oficial calculado por el backend.')
    ),

    error ? e('div', { className: 'rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700' }, error) : null,

    e('div', { className: 'grid gap-3 lg:grid-cols-3' },
      e('div', { className: 'rounded-2xl border p-4', style: cardStyle() }, e('div', { className: 'text-xs font-black uppercase', style: { color: 'var(--admin-card-muted-text)' } }, 'Sede'), e('div', { className: 'mt-1 font-black' }, branch?.name || 'Sin sede')),
      e('div', { className: 'rounded-2xl border p-4', style: cardStyle() }, e('div', { className: 'text-xs font-black uppercase', style: { color: 'var(--admin-card-muted-text)' } }, 'Pago'), e('div', { className: 'mt-1 font-black' }, methods.find((item) => item.key === paymentMethod)?.label || paymentMethod)),
      e('div', { className: 'rounded-2xl border p-4', style: cardStyle() }, e('div', { className: 'text-xs font-black uppercase', style: { color: 'var(--admin-card-muted-text)' } }, 'Preview'), e('div', { className: 'mt-1 font-black' }, cart.length ? (preview ? 'Calculado' : 'Pendiente') : 'Sin productos'))
    ),

    e('div', { className: 'grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]' },
      e('div', { className: 'space-y-5' },
        e('section', { className: 'rounded-2xl border p-5', style: cardStyle() },
          e('div', { className: 'grid gap-4 lg:grid-cols-2' },
            e('div', null,
              e('label', { className: 'mb-2 block text-xs font-black uppercase tracking-[0.18em]', style: { color: 'var(--admin-card-muted-text)' } }, 'Sede de venta'),
              e('select', { value: branchId, onChange: (event) => setBranchId(event.target.value), className: 'w-full rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none', style: cardStyle() }, branches.map((item) => e('option', { key: item.id, value: item.id }, `${item.name} - ${item.code}`)))
            ),
            e('div', null,
              e('label', { className: 'mb-2 block text-xs font-black uppercase tracking-[0.18em]', style: { color: 'var(--admin-card-muted-text)' } }, 'Método de pago'),
              e('select', { value: paymentMethod, onChange: (event) => setPaymentMethod(event.target.value), className: 'w-full rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none', style: cardStyle() }, methods.map((item) => e('option', { key: item.key, value: item.key }, item.label)))
            )
          )
        ),

        e('section', { className: 'rounded-2xl border', style: cardStyle() },
          e('div', { className: 'border-b p-5', style: { borderColor: 'var(--admin-card-border)' } }, e('h2', { className: 'text-lg font-black' }, 'Buscar productos')),
          e('div', { className: 'p-5' },
            e('input', { value: q, onChange: (event) => setQ(event.target.value), placeholder: 'Buscar por nombre, SKU o código', className: 'w-full rounded-2xl border bg-transparent px-4 py-3 text-sm font-semibold outline-none', style: cardStyle({ background: 'var(--admin-page-bg)' }) }),
            productsLoading ? e('div', { className: 'mt-3 text-sm font-black', style: { color: 'var(--admin-primary)' } }, 'Buscando productos...') : null,
            productsError ? e('div', { className: 'mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700' }, productsError) : null,
            !productsError && !productsLoading && products.length === 0 ? e('div', { className: 'mt-5 rounded-2xl border p-8 text-center', style: cardStyle({ background: 'var(--admin-primary-soft-bg)' }) }, 'No hay productos con stock disponible') : null,
            products.length > 0 ? e('div', { className: 'mt-5 space-y-3' }, products.map((product) => {
              const rowKey = keyOf(product);
              const currentQty = Number(cartMap[rowKey]?.quantity || 0);
              const canAdd = Number(product.availableStock || 0) > currentQty;
              return e('div', { key: rowKey, className: 'flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between', style: cardStyle({ background: 'var(--admin-page-bg)' }) },
                e('div', null,
                  e('p', { className: 'text-sm font-black' }, product.title || 'Producto sin nombre'),
                  e('p', { className: 'mt-1 text-xs font-bold', style: { color: 'var(--admin-card-muted-text)' } }, `${product.sku || 'Sin SKU'} · ${variantLabel(product)}`),
                  e('p', { className: 'mt-2 text-xs font-black', style: { color: 'var(--admin-primary)' } }, `Stock: ${product.availableStock}${currentQty ? ` · En carrito: ${currentQty}` : ''}`)
                ),
                e('div', { className: 'flex items-center gap-3 md:flex-col md:items-end' },
                  e('strong', { style: { color: 'var(--admin-primary)' } }, formatMoney(product.price)),
                  e('button', { type: 'button', disabled: !canAdd, onClick: () => addToCart(product), className: 'rounded-xl px-3 py-2 text-xs font-black text-white disabled:opacity-50', style: primaryButtonStyle() }, canAdd ? 'Agregar' : 'Sin stock')
                )
              );
            })) : null
          )
        )
      ),

      e('section', { className: 'rounded-2xl border', style: cardStyle() },
        e('div', { className: 'border-b p-5', style: { borderColor: 'var(--admin-card-border)' } },
          e('div', { className: 'flex items-start justify-between gap-3' },
            e('div', null, e('h2', { className: 'text-lg font-black' }, 'Carrito de venta'), e('p', { className: 'mt-1 text-sm', style: { color: 'var(--admin-card-muted-text)' } }, cart.length ? `${totalItems} producto(s) agregados` : 'Resumen de productos y pago.')),
            cart.length ? e('button', { type: 'button', onClick: () => setCart([]), className: 'rounded-xl border px-3 py-2 text-xs font-black', style: cardStyle() }, 'Vaciar') : null
          )
        ),
        e('div', { className: 'space-y-4 p-5' },
          cart.length === 0 ? e('div', { className: 'rounded-2xl border p-5 text-center', style: cardStyle({ background: 'var(--admin-page-bg)' }) }, 'Sin productos agregados') : e('div', { className: 'space-y-3' }, cart.map((item) => e('div', { key: item.cartKey, className: 'rounded-2xl border p-4', style: cardStyle({ background: 'var(--admin-page-bg)' }) },
            e('div', { className: 'flex items-start justify-between gap-3' },
              e('div', null, e('p', { className: 'text-sm font-black' }, item.title), e('p', { className: 'mt-1 text-xs font-bold', style: { color: 'var(--admin-card-muted-text)' } }, `${variantLabel(item)} · ${formatMoney(item.price)} x ${item.quantity}`)),
              e('button', { type: 'button', onClick: () => removeFromCart(item.cartKey), className: 'rounded-xl border px-3 py-2 text-xs font-black', style: cardStyle() }, 'Quitar')
            ),
            e('div', { className: 'mt-4 flex items-center justify-between' },
              e('div', { className: 'inline-flex items-center rounded-xl border', style: cardStyle() }, e('button', { type: 'button', onClick: () => subtractFromCart(item.cartKey), className: 'px-3 py-2' }, '-'), e('span', { className: 'min-w-10 text-center text-sm font-black' }, item.quantity), e('button', { type: 'button', onClick: () => addToCart(item), className: 'px-3 py-2' }, '+')),
              e('strong', { style: { color: 'var(--admin-primary)' } }, formatMoney(Number(item.price || 0) * Number(item.quantity || 1)))
            )
          ))),
          previewError ? e('div', { className: 'rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700' }, previewError) : null,
          previewLoading ? e('div', { className: 'rounded-2xl border p-3 text-sm font-black', style: cardStyle({ color: 'var(--admin-primary)' }) }, 'Calculando total oficial...') : null,
          e('div', { className: 'space-y-3 rounded-2xl border p-4', style: cardStyle() },
            e('div', { className: 'flex justify-between text-sm' }, e('span', null, 'Subtotal'), e('strong', null, formatMoney(totals.subtotal))),
            e('div', { className: 'flex justify-between text-sm' }, e('span', null, 'Descuento'), e('strong', null, formatMoney(totals.discount))),
            e('div', { className: 'flex justify-between text-sm' }, e('span', null, 'Impuestos'), e('strong', null, formatMoney(totals.taxes))),
            e('div', { className: 'h-px', style: { background: 'var(--admin-card-border)' } }),
            e('div', { className: 'flex justify-between text-base' }, e('strong', null, 'Total'), e('strong', { style: { color: 'var(--admin-primary)' } }, formatMoney(totals.total)))
          ),
          e('button', { type: 'button', disabled: true, className: 'flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-black text-white disabled:opacity-60', style: primaryButtonStyle() }, 'Confirmar venta')
        )
      )
    )
  );
}
