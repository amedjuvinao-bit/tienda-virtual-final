// frontend/src/admin/pos/PosSalesPage.js

import React, { useEffect, useMemo, useState } from 'react';
import { createPosSale, getPosBootstrap, getPosProducts, previewPosSale } from '../api/adminPosApi';
import { buildPosPreviewPayload, buildPosSalePayload } from './posPreviewPayload';

const e = React.createElement;
const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const money = (v) => fmt.format(Number(v || 0));
const keyOf = (p = {}) => p.id || `${p.productId || ''}:${p.variantKey || 'default__default'}`;
const variant = (p = {}) => [p.size, p.color].filter(Boolean).join(' / ') || 'Variante general';
const card = (extra = {}) => ({ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-card-text)', ...extra });
const primary = () => ({ background: 'var(--admin-primary)', color: '#fff' });

export default function PosSalesPage() {
  const [boot, setBoot] = useState(null);
  const [branchId, setBranchId] = useState('');
  const [method, setMethod] = useState('cash');
  const [q, setQ] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const branches = Array.isArray(boot?.branches) ? boot.branches : [];
  const methods = Array.isArray(boot?.paymentMethods) ? boot.paymentMethods : [];
  const localTotal = useMemo(() => cart.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0), [cart]);
  const total = Number(preview?.total ?? localTotal);

  useEffect(() => { (async () => {
    try {
      const data = await getPosBootstrap();
      setBoot(data);
      setBranchId(data?.defaultBranch?.id || data?.branches?.[0]?.id || '');
      setMethod(data?.defaultBranch?.settings?.defaultPaymentMethod || data?.paymentMethods?.[0]?.key || 'cash');
    } catch (e2) { setErr(e2?.message || 'No fue posible cargar el POS.'); }
  })(); }, []);

  useEffect(() => { setCart([]); setPreview(null); setMsg(''); setErr(''); }, [branchId]);

  useEffect(() => {
    if (!branchId) return undefined;
    let ok = true;
    const t = setTimeout(async () => {
      try { const data = await getPosProducts({ branchId, q, limit: 30 }); if (ok) setProducts(data?.products || []); }
      catch (e2) { if (ok) setErr(e2?.message || 'No fue posible buscar productos.'); }
    }, 300);
    return () => { ok = false; clearTimeout(t); };
  }, [branchId, q]);

  useEffect(() => {
    if (!branchId || cart.length === 0) { setPreview(null); return undefined; }
    let ok = true;
    const t = setTimeout(async () => {
      try { const data = await previewPosSale(buildPosPreviewPayload({ branchId, cartItems: cart })); if (ok) setPreview(data?.preview || null); }
      catch (e2) { if (ok) { setPreview(null); setErr(e2?.message || 'No fue posible calcular la venta.'); } }
    }, 250);
    return () => { ok = false; clearTimeout(t); };
  }, [branchId, cart]);

  const add = (p) => {
    const k = keyOf(p); const max = Number(p.availableStock || 0); if (!k || max <= 0) return;
    setCart((old) => old.find((i) => i.cartKey === k) ? old.map((i) => i.cartKey === k ? { ...i, quantity: Math.min(Number(i.quantity || 1) + 1, max) } : i) : [...old, { ...p, cartKey: k, quantity: 1, price: Number(p.price || 0), availableStock: max }]);
  };
  const sub = (k) => setCart((old) => old.map((i) => i.cartKey === k ? { ...i, quantity: Number(i.quantity || 1) - 1 } : i).filter((i) => Number(i.quantity || 0) > 0));
  const rem = (k) => setCart((old) => old.filter((i) => i.cartKey !== k));

  const save = async () => {
    if (!preview || cart.length === 0 || busy) return;
    try {
      setBusy(true); setErr(''); setMsg('');
      const data = await createPosSale(buildPosSalePayload({ branchId, cartItems: cart, paymentMethod: method, total }));
      const number = data?.order?.orderNumber || data?.order?.number || data?.order?._id || '';
      setCart([]); setPreview(null); setMsg(number ? `Venta creada. Orden ${number}.` : 'Venta creada correctamente.');
    } catch (e2) { setErr(e2?.message || 'No fue posible crear la venta.'); }
    finally { setBusy(false); }
  };

  return e('div', { className: 'min-h-full space-y-5' },
    e('div', null, e('h1', { className: 'text-2xl font-black', style: { color: 'var(--admin-card-text)' } }, 'POS / Ventas físicas'), e('p', { className: 'mt-1 text-sm', style: { color: 'var(--admin-card-muted-text)' } }, 'Venta física con inventario y orden real.')),
    msg ? e('div', { className: 'rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700' }, msg) : null,
    err ? e('div', { className: 'rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700' }, err) : null,
    e('section', { className: 'rounded-2xl border p-5', style: card() }, e('div', { className: 'grid gap-4 lg:grid-cols-2' }, e('select', { value: branchId, onChange: (ev) => setBranchId(ev.target.value), className: 'rounded-xl border px-4 py-3', style: card() }, branches.map((b) => e('option', { key: b.id, value: b.id }, `${b.name} - ${b.code}`))), e('select', { value: method, onChange: (ev) => setMethod(ev.target.value), className: 'rounded-xl border px-4 py-3', style: card() }, methods.map((m) => e('option', { key: m.key, value: m.key }, m.label))))),
    e('div', { className: 'grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]' },
      e('section', { className: 'rounded-2xl border p-5', style: card() }, e('input', { value: q, onChange: (ev) => setQ(ev.target.value), placeholder: 'Buscar por nombre, SKU o código', className: 'w-full rounded-xl border px-4 py-3', style: card({ background: 'var(--admin-page-bg)' }) }), products.length === 0 ? e('p', { className: 'mt-5 text-center text-sm font-black' }, 'No hay productos con stock disponible') : e('div', { className: 'mt-5 space-y-3' }, products.map((p) => { const k = keyOf(p); const inCart = Number(cart.find((i) => i.cartKey === k)?.quantity || 0); const can = Number(p.availableStock || 0) > inCart; return e('div', { key: k, className: 'rounded-2xl border p-4', style: card({ background: 'var(--admin-page-bg)' }) }, e('div', { className: 'flex items-center justify-between gap-3' }, e('div', null, e('p', { className: 'font-black' }, p.title), e('p', { className: 'text-xs', style: { color: 'var(--admin-card-muted-text)' } }, `${p.sku || 'Sin SKU'} · ${variant(p)} · Stock ${p.availableStock}`)), e('button', { disabled: !can, onClick: () => add(p), className: 'rounded-xl px-3 py-2 text-xs font-black text-white disabled:opacity-50', style: primary() }, can ? 'Agregar' : 'Sin stock'))); }))),
      e('section', { className: 'rounded-2xl border p-5', style: card() }, e('h2', { className: 'text-lg font-black' }, 'Carrito de venta'), cart.length === 0 ? e('p', { className: 'mt-4 rounded-2xl border p-5 text-center text-sm', style: card({ background: 'var(--admin-page-bg)' }) }, 'Sin productos agregados') : e('div', { className: 'mt-4 space-y-3' }, cart.map((i) => e('div', { key: i.cartKey, className: 'rounded-2xl border p-4', style: card({ background: 'var(--admin-page-bg)' }) }, e('div', { className: 'flex justify-between gap-3' }, e('div', null, e('p', { className: 'font-black' }, i.title), e('p', { className: 'text-xs' }, `${variant(i)} · ${money(i.price)} x ${i.quantity}`)), e('button', { onClick: () => rem(i.cartKey), className: 'rounded-xl border px-3 py-2 text-xs', style: card() }, 'Quitar')), e('div', { className: 'mt-3 flex justify-between' }, e('div', null, e('button', { onClick: () => sub(i.cartKey), className: 'px-3 py-2' }, '-'), e('span', { className: 'px-3 font-black' }, i.quantity), e('button', { onClick: () => add(i), className: 'px-3 py-2' }, '+')), e('strong', { style: { color: 'var(--admin-primary)' } }, money(Number(i.price || 0) * Number(i.quantity || 1))))))), e('div', { className: 'mt-4 space-y-3 rounded-2xl border p-4', style: card() }, e('div', { className: 'flex justify-between' }, e('span', null, 'Subtotal'), e('strong', null, money(preview?.subtotal ?? localTotal))), e('div', { className: 'flex justify-between' }, e('span', null, 'Total'), e('strong', { style: { color: 'var(--admin-primary)' } }, money(total)))), e('button', { disabled: !preview || cart.length === 0 || busy, onClick: save, className: 'mt-4 w-full rounded-2xl px-4 py-3 text-sm font-black text-white disabled:opacity-60', style: primary() }, busy ? 'Creando venta...' : 'Confirmar venta'))
    )
  );
}
