import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, BadgeCheck, Loader2, X } from 'lucide-react';
import { paymentLabel } from './posCheckoutModel';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function money(value) {
  return moneyFormatter.format(Number(value || 0));
}

function PaymentSummary({ payment = {} }) {
  const splits = Array.isArray(payment.splitPayments) ? payment.splitPayments : [];

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
      <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--admin-card-muted-text)' }}>Cobro</p>
      <p className="mt-2 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{payment.methodLabel || paymentLabel(payment.method)}</p>
      {payment.method === 'cash' ? (
        <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
          Recibido {money(payment.receivedAmount)} · Cambio {money(payment.changeAmount)}
        </p>
      ) : null}
      {payment.reference ? <p className="mt-1 break-all text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Referencia: {payment.reference}</p> : null}
      {payment.method === 'mixed' ? (
        <div className="mt-3 divide-y" style={{ borderColor: 'var(--admin-card-border)' }}>
          {splits.map((split, index) => (
            <div key={`${split.method}-${index}`} className="flex items-start justify-between gap-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-black" style={{ color: 'var(--admin-card-text)' }}>{split.methodLabel || paymentLabel(split.method)}</p>
                {split.reference ? <p className="mt-0.5 truncate font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{split.reference}</p> : null}
                {split.method === 'cash' && split.changeAmount > 0 ? <p className="mt-0.5 font-bold text-emerald-700">Cambio {money(split.changeAmount)}</p> : null}
              </div>
              <strong style={{ color: 'var(--admin-card-text)' }}>{money(split.amount)}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PosSaleReviewModal({ review, saving = false, error = '', onClose, onConfirm }) {
  useEffect(() => {
    if (!review) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, review, saving]);

  if (!review || typeof document === 'undefined') return null;

  const preview = review.preview || {};
  const items = Array.isArray(preview.items) ? preview.items : [];
  const payment = preview.payment || review.payload?.payment || {};
  const discount = preview.discount || review.payload?.discount || {};

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-3 sm:p-6" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-review-title"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border"
        style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)', boxShadow: '0 28px 80px rgba(15, 23, 42, 0.28)' }}
      >
        <header className="flex items-start justify-between gap-4 border-b p-5 sm:p-6" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>Revisión final</p>
            <h2 id="pos-review-title" className="mt-1 text-2xl font-black" style={{ color: 'var(--admin-card-text)' }}>Confirma antes de cobrar</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Verifica productos, descuento y medios de pago. La venta aún no ha sido creada.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar revisión" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border disabled:opacity-50" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
              <div className="grid grid-cols-[minmax(0,1fr)_58px_100px] gap-3 border-b px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em]" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>
                <span>Producto</span><span className="text-center">Cant.</span><span className="text-right">Subtotal</span>
              </div>
              {items.map((item, index) => (
                <div key={`${item.productId}-${item.variantKey}-${index}`} className="grid grid-cols-[minmax(0,1fr)_58px_100px] gap-3 border-b px-4 py-4 text-sm last:border-b-0" style={{ borderColor: 'var(--admin-card-border)' }}>
                  <div className="min-w-0">
                    <p className="truncate font-black" style={{ color: 'var(--admin-card-text)' }}>{item.title || 'Producto'}</p>
                    <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{item.variantLabel || [item.size, item.color].filter(Boolean).join(' / ') || 'Variante general'} · {money(item.unitPrice)}</p>
                  </div>
                  <strong className="text-center" style={{ color: 'var(--admin-card-text)' }}>{item.quantity}</strong>
                  <strong className="text-right" style={{ color: 'var(--admin-card-text)' }}>{money(item.lineSubtotal)}</strong>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <PaymentSummary payment={payment} />
              <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)' }}>
                <div className="flex items-center justify-between text-sm"><span style={{ color: 'var(--admin-card-muted-text)' }}>Subtotal</span><strong style={{ color: 'var(--admin-card-text)' }}>{money(preview.subtotal)}</strong></div>
                <div className="mt-2 flex items-center justify-between text-sm"><span style={{ color: 'var(--admin-card-muted-text)' }}>Descuento</span><strong style={{ color: 'var(--admin-card-text)' }}>- {money(discount.amount)}</strong></div>
                {discount.amount > 0 ? <p className="mt-2 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{discount.reason}</p> : null}
                <div className="my-3 h-px" style={{ background: 'var(--admin-card-border)' }} />
                <div className="flex items-center justify-between"><span className="font-black" style={{ color: 'var(--admin-card-text)' }}>Total a cobrar</span><strong className="text-2xl" style={{ color: 'var(--admin-primary)' }}>{money(preview.total)}</strong></div>
              </div>
            </div>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t p-5 sm:flex-row sm:justify-end sm:p-6" style={{ borderColor: 'var(--admin-card-border)' }}>
          <button type="button" onClick={onClose} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black disabled:opacity-50" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}>
            <ArrowLeft className="h-4 w-4" />
            Volver y editar
          </button>
          <button type="button" onClick={onConfirm} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-60" style={{ background: 'var(--admin-primary)' }}>
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <BadgeCheck className="h-5 w-5" />}
            {saving ? 'Registrando venta...' : `Confirmar cobro por ${money(preview.total)}`}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
