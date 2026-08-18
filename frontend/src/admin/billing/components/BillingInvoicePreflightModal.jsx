import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';

import { formatCurrency } from '../billingFormatters';
import { ActionButton } from './BillingUi';

function valueOrDash(value) {
  const text = String(value ?? '').trim();
  return text || '—';
}

function Detail({ label, value, wide = false }) {
  return (
    <div
      className={`min-w-0 rounded-2xl border px-3 py-2.5 ${wide ? 'md:col-span-2' : ''}`}
      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black [overflow-wrap:anywhere]">
        {valueOrDash(value)}
      </p>
    </div>
  );
}

function FindingList({ title, findings, tone }) {
  if (!findings?.length) return null;

  const danger = tone === 'danger';
  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        borderColor: danger ? 'rgba(220, 38, 38, 0.32)' : 'rgba(217, 119, 6, 0.32)',
        background: danger ? 'rgba(220, 38, 38, 0.08)' : 'rgba(217, 119, 6, 0.08)',
        color: danger ? '#b91c1c' : '#a16207',
      }}
    >
      <div className="flex items-center gap-2 text-sm font-black">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </div>
      <ul className="mt-2 grid gap-2 text-xs font-bold leading-5">
        {findings.map((finding) => (
          <li key={`${finding.code}-${finding.field}`} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{finding.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function BillingInvoicePreflightModal({
  open,
  order,
  preflight,
  loading,
  emitting,
  error,
  onClose,
  onRetry,
  onConfirm,
}) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setConfirmed(false);
  }, [preflight?.fingerprint, open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || emitting) return;
      event.preventDefault();
      onClose?.();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [emitting, onClose, open]);

  if (!open) return null;

  const customer = preflight?.customer || {};
  const payload = preflight?.payload || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const ready = preflight?.ready === true;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-2 md:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-preflight-title"
      data-testid="billing-invoice-preflight"
    >
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'var(--admin-modal-overlay, rgba(15, 23, 42, 0.62))' }} />

      <div
        className="relative z-10 flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border shadow-2xl"
        style={{ background: 'var(--admin-modal-bg, var(--admin-card-bg))', borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4 md:px-6" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-accent, #ec4899)' }}>
                Control fiscal obligatorio
              </p>
              <h2 id="billing-preflight-title" className="mt-1 text-xl font-black md:text-2xl">
                Revisa antes de emitir en Factus
              </h2>
              <p className="mt-1 break-words text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                Orden #{order?.orderNumber || preflight?.orderNumber || '—'} · esta fotografía quedará vinculada a la emisión.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar revisión fiscal"
            onClick={onClose}
            disabled={emitting}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6">
          {loading ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <LoaderCircle className="h-10 w-10 animate-spin" style={{ color: 'var(--admin-accent, #ec4899)' }} />
              <p className="mt-4 text-lg font-black">Comprobando datos fiscales…</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
                No se está enviando nada a Factus todavía.
              </p>
            </div>
          ) : error && !preflight ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <AlertTriangle className="h-10 w-10 text-red-600" />
              <p className="mt-4 text-lg font-black">No se pudo preparar la revisión</p>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-red-700">{error}</p>
              <ActionButton className="mt-5" icon={RefreshCw} onClick={onRetry}>Intentar nuevamente</ActionButton>
            </div>
          ) : (
            <div className="grid gap-4">
              {error ? (
                <section
                  className="rounded-2xl border px-4 py-3 text-sm font-bold text-red-700"
                  style={{ borderColor: 'rgba(220, 38, 38, 0.32)', background: 'rgba(220, 38, 38, 0.08)' }}
                >
                  {error}
                </section>
              ) : null}

              <section
                className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between"
                style={{
                  borderColor: ready ? 'rgba(16, 185, 129, 0.34)' : 'rgba(220, 38, 38, 0.32)',
                  background: ready ? 'rgba(16, 185, 129, 0.08)' : 'rgba(220, 38, 38, 0.08)',
                }}
              >
                <div className="flex items-center gap-3">
                  {ready ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <AlertTriangle className="h-6 w-6 text-red-600" />}
                  <div>
                    <p className="font-black">{ready ? 'Lista para emitir' : 'Emisión bloqueada'}</p>
                    <p className="mt-0.5 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
                      {ready ? 'Los controles fiscales previos fueron aprobados.' : 'Corrige los datos indicados y vuelve a revisar.'}
                    </p>
                  </div>
                </div>
                <span className="rounded-full border px-3 py-1 text-xs font-black uppercase" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                  {valueOrDash(preflight?.provider)} · {valueOrDash(preflight?.environment)}
                </span>
              </section>

              <FindingList title="Bloqueos que debes corregir" findings={preflight?.blockers} tone="danger" />
              <FindingList title="Advertencias informativas" findings={preflight?.warnings} tone="warning" />

              <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)' }}>
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5" />
                  <h3 className="font-black">Comprador que recibirá Factus</h3>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <Detail label="Tipo de persona" value={customer.personType} />
                  <Detail label="Tipo de documento" value={customer.documentType} />
                  <Detail label="Documento" value={customer.documentNumber} />
                  <Detail label="Nombre o razón social" value={customer.businessName || [customer.firstName, customer.lastName].filter(Boolean).join(' ')} />
                  <Detail label="Correo fiscal" value={customer.email} />
                  <Detail label="Teléfono" value={customer.phone} />
                  <Detail label="Municipio" value={[customer.city, customer.department].filter(Boolean).join(' · ')} />
                  <Detail label="Código municipio" value={customer.municipalityCode} />
                  <Detail label="Dirección fiscal" value={customer.address} wide />
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
                <div className="border-b px-4 py-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                  <h3 className="font-black">Conceptos que se enviarán</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead>
                      <tr style={{ color: 'var(--admin-card-muted-text)' }}>
                        <th className="px-4 py-3 text-[10px] font-black uppercase">Código</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase">Descripción</th>
                        <th className="px-4 py-3 text-right text-[10px] font-black uppercase">Cantidad</th>
                        <th className="px-4 py-3 text-right text-[10px] font-black uppercase">Valor unitario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={`${item.code_reference}-${index}`} className="border-t" style={{ borderColor: 'var(--admin-card-border)' }}>
                          <td className="px-4 py-3 text-xs font-bold">{valueOrDash(item.code_reference)}</td>
                          <td className="px-4 py-3 font-black">{valueOrDash(item.name)}</td>
                          <td className="px-4 py-3 text-right font-bold">{valueOrDash(item.quantity)}</td>
                          <td className="px-4 py-3 text-right font-black">{formatCurrency(item.price)}</td>
                        </tr>
                      ))}
                      {!items.length ? (
                        <tr><td colSpan="4" className="px-4 py-6 text-center text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>No se pudieron construir los conceptos.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="ml-auto grid w-full max-w-md gap-2 rounded-2xl border p-4 text-sm" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                <div className="flex justify-between gap-4"><span className="font-bold">Subtotal</span><strong>{formatCurrency(preflight?.totals?.subtotal)}</strong></div>
                <div className="flex justify-between gap-4"><span className="font-bold">Descuentos</span><strong>{formatCurrency(preflight?.totals?.totalDiscount)}</strong></div>
                <div className="flex justify-between gap-4"><span className="font-bold">IVA</span><strong>{formatCurrency(preflight?.totals?.taxAmount)}</strong></div>
                <div className="flex justify-between gap-4"><span className="font-bold">Envío</span><strong>{formatCurrency(preflight?.totals?.shipping)}</strong></div>
                <div className="mt-1 flex justify-between gap-4 border-t pt-3 text-base" style={{ borderColor: 'var(--admin-card-border)' }}><span className="font-black">Total</span><strong>{formatCurrency(preflight?.totals?.total)}</strong></div>
              </section>

              {ready ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span className="text-sm font-bold leading-5">
                    Confirmo que revisé la identificación, el nombre, el municipio, los conceptos y el total. Entiendo que Factus generará un documento fiscal con estos datos.
                  </span>
                </label>
              ) : null}
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t px-5 py-4 md:flex-row md:items-center md:justify-end md:px-6" style={{ borderColor: 'var(--admin-card-border)' }}>
          <ActionButton onClick={onClose} disabled={emitting}>Cancelar</ActionButton>
          {!loading && preflight ? (
            <ActionButton
              icon={emitting ? LoaderCircle : ShieldCheck}
              variant="primary"
              disabled={!ready || !confirmed || emitting}
              onClick={() => onConfirm?.(preflight)}
              className={emitting ? '[&>svg]:animate-spin' : ''}
            >
              {emitting ? 'Emitiendo…' : 'Confirmar y emitir'}
            </ActionButton>
          ) : null}
        </footer>
      </div>
    </div>,
    document.body
  );
}
