import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  History,
  Loader2,
  ReceiptText,
  ShieldCheck,
  X,
} from 'lucide-react';
import { fetchCouponOperations, fetchCouponRedemptions } from './api/adminCouponsApi';

const STATUS_LABELS = {
  reserved: 'Reservado',
  applied: 'Aplicado',
  released: 'Liberado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

const SOURCE_LABELS = {
  checkout: 'Tienda virtual',
  pos: 'POS',
  admin: 'Administración',
  manual: 'Manual',
};

function money(value) {
  return `$ ${Number(value || 0).toLocaleString('es-CO')}`;
}

function dateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function Metric({ label, value, helper }) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
      <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>{helper}</p>
    </div>
  );
}

export default function CouponOperationsModal({ couponId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [redemptions, setRedemptions] = useState({ rows: [], total: 0, page: 1, pages: 1 });
  const [filters, setFilters] = useState({ q: '', status: '', source: '', from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (page = 1, nextFilters = filters) => {
    try {
      setLoading(true);
      setError('');
      const [operations, history] = await Promise.all([
        detail ? Promise.resolve(detail) : fetchCouponOperations(couponId),
        fetchCouponRedemptions(couponId, { ...nextFilters, page, limit: 10 }),
      ]);
      setDetail(operations);
      setRedemptions(history);
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'No se pudo cargar la actividad del cupón.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!couponId) return undefined;
    setDetail(null);
    setFilters({ q: '', status: '', source: '', from: '', to: '' });
    load(1, { q: '', status: '', source: '', from: '', to: '' });
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponId]);

  if (!couponId) return null;
  const activity = detail?.activity || {};

  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/55 p-3" role="dialog" aria-modal="true" aria-label="Actividad del cupón">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border shadow-2xl" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg, #fff8fb)', color: 'var(--admin-card-text)' }}>
        <div className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>Trazabilidad del cupón</p>
            <h2 className="mt-1 text-2xl font-black">{detail?.coupon?.name || detail?.coupon?.code || 'Actividad'}</h2>
            <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
              {detail?.coupon?.code || ''} · usos, órdenes y cambios administrativos en un solo lugar.
            </p>
          </div>
          <button type="button" aria-label="Cerrar actividad" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: 'var(--admin-card-border)' }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}
          {loading && !detail ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm font-bold"><Loader2 className="h-4 w-4 animate-spin" /> Cargando actividad...</div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Usos confirmados" value={activity.byStatus?.applied?.count || 0} helper="Compras aprobadas" />
                <Metric label="Reservados" value={activity.byStatus?.reserved?.count || 0} helper="Esperando pago" />
                <Metric label="Liberados" value={(activity.byStatus?.released?.count || 0) + (activity.byStatus?.cancelled?.count || 0)} helper="No consumen el límite" />
                <Metric label="Valor descontado" value={money(activity.totalDiscount)} helper="Aplicado y reembolsado" />
              </div>

              <section className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                <div className="flex flex-col gap-3 border-b p-4" style={{ borderColor: 'var(--admin-card-border)' }}>
                  <div className="flex items-center gap-2"><ReceiptText className="h-4 w-4" style={{ color: 'var(--admin-primary)' }} /><h3 className="font-black">Historial de usos</h3></div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <input aria-label="Buscar orden o cliente" value={filters.q} onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))} placeholder="Buscar orden o cliente" className="rounded-xl border bg-transparent px-3 py-2 text-xs font-bold" style={{ borderColor: 'var(--admin-card-border)' }} />
                    <select aria-label="Estado de redención" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="rounded-xl border bg-transparent px-3 py-2 text-xs font-bold" style={{ borderColor: 'var(--admin-card-border)' }}>
                      <option value="">Todos los estados</option>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <select aria-label="Canal de redención" value={filters.source} onChange={(e) => setFilters((prev) => ({ ...prev, source: e.target.value }))} className="rounded-xl border bg-transparent px-3 py-2 text-xs font-bold" style={{ borderColor: 'var(--admin-card-border)' }}>
                      <option value="">Todos los canales</option>
                      {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <input aria-label="Desde" type="date" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} className="rounded-xl border bg-transparent px-3 py-2 text-xs font-bold" style={{ borderColor: 'var(--admin-card-border)' }} />
                    <input aria-label="Hasta" type="date" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} className="rounded-xl border bg-transparent px-3 py-2 text-xs font-bold" style={{ borderColor: 'var(--admin-card-border)' }} />
                    <button type="button" onClick={() => load(1, filters)} className="rounded-xl px-3 py-2 text-xs font-black text-white" style={{ background: 'var(--admin-primary)' }}>Aplicar filtros</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-xs">
                    <thead><tr style={{ color: 'var(--admin-card-muted-text)' }}>
                      <th className="px-4 py-3">FECHA</th><th className="px-4 py-3">ESTADO</th><th className="px-4 py-3">ORDEN</th><th className="px-4 py-3">CLIENTE</th><th className="px-4 py-3">SEDE / CANAL</th><th className="px-4 py-3 text-right">DESCUENTO</th>
                    </tr></thead>
                    <tbody>
                      {(redemptions.rows || []).map((row) => (
                        <tr key={row.id} className="border-t" style={{ borderColor: 'var(--admin-card-border)' }}>
                          <td className="px-4 py-3 font-semibold">{dateTime(row.createdAt)}</td>
                          <td className="px-4 py-3"><span className="rounded-full px-2 py-1 font-black" style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}>{STATUS_LABELS[row.status] || row.status}</span></td>
                          <td className="px-4 py-3 font-bold">{row.order?.id ? <a className="inline-flex items-center gap-1 underline" href={`/admin/ordenes?q=${encodeURIComponent(row.order.number || '')}&openOrder=${row.order.id}`}>{row.order.number || 'Ver orden'} <ExternalLink className="h-3 w-3" /></a> : '—'}</td>
                          <td className="px-4 py-3 font-semibold">{row.customer?.id ? <a className="underline" href={`/admin/clientes?q=${encodeURIComponent(row.customer.code || '')}`}>{row.customer.code || row.customer.email || row.customer.document || 'Ver cliente'}</a> : row.customer?.email || row.customer?.document || 'No identificado'}</td>
                          <td className="px-4 py-3"><p className="font-bold">{row.branch?.name || row.branch?.code || 'Sin sede'}</p><p style={{ color: 'var(--admin-card-muted-text)' }}>{SOURCE_LABELS[row.source] || row.source}</p></td>
                          <td className="px-4 py-3 text-right font-black">{money(row.totalDiscountAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!redemptions.rows?.length ? <p className="p-6 text-center text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>No hay usos que coincidan con estos filtros.</p> : null}
                </div>
                <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: 'var(--admin-card-border)' }}>
                  <p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{redemptions.total || 0} registro(s) · página {redemptions.page || 1} de {redemptions.pages || 1}</p>
                  <div className="flex gap-2">
                    <button aria-label="Página anterior de usos" type="button" disabled={loading || redemptions.page <= 1} onClick={() => load(redemptions.page - 1)} className="rounded-xl border p-2 disabled:opacity-40" style={{ borderColor: 'var(--admin-card-border)' }}><ChevronLeft className="h-4 w-4" /></button>
                    <button aria-label="Página siguiente de usos" type="button" disabled={loading || redemptions.page >= redemptions.pages} onClick={() => load(redemptions.page + 1)} className="rounded-xl border p-2 disabled:opacity-40" style={{ borderColor: 'var(--admin-card-border)' }}><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              </section>

              <section className="mt-5 rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" style={{ color: 'var(--admin-primary)' }} /><h3 className="font-black">Cambios administrativos</h3></div>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {(detail?.audit || []).map((event) => (
                    <div key={event.id} className="flex gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--admin-card-border)' }}>
                      <History className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--admin-primary)' }} />
                      <div><p className="text-sm font-black">{event.description || event.action}</p><p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>{event.actor} · {dateTime(event.createdAt)}</p></div>
                    </div>
                  ))}
                  {!detail?.audit?.length ? <p className="text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>Aún no hay cambios administrativos registrados para este cupón.</p> : null}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
