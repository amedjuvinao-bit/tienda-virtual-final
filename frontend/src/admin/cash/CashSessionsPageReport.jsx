// frontend/src/admin/cash/CashSessionsPageReport.jsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  EyeOff,
  FileText,
  History,
  LockKeyhole,
  Printer,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UnlockKeyhole,
  UserCheck,
  Wallet,
  XCircle,
} from 'lucide-react';

import { getPosBootstrap } from '../api/adminPosApi';
import {
  addCashMovement,
  closeCashSession,
  getCashSessionById,
  getCurrentCashSession,
  listCashSessions,
  openCashSession,
  reviewCashMovement,
} from '../api/adminCashSessionApi';

const REGISTER_CODE = 'CAJA POS';

const MOVEMENT_TYPES = [
  { key: 'cash_in', label: 'Ingreso manual', note: 'Suma al efectivo esperado' },
  { key: 'cash_out', label: 'Salida manual', note: 'Resta del efectivo esperado' },
  { key: 'expense', label: 'Gasto pequeño', note: 'Resta del efectivo esperado' },
  { key: 'withdrawal', label: 'Retiro de efectivo', note: 'Resta del efectivo esperado' },
  { key: 'adjustment_out', type: 'adjustment', direction: 'out', label: 'Ajuste negativo', note: 'Requiere aprobación y resta del efectivo esperado' },
  { key: 'adjustment', label: 'Ajuste informativo', note: 'No cambia el efectivo esperado' },
];

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function money(value) {
  return moneyFormatter.format(Number(value || 0));
}

function visibleMoney(value, hiddenLabel = 'Oculto') {
  return value === null || value === undefined ? hiddenLabel : money(value);
}

function clean(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function numberValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CO', {
    hour12: false,
    timeZone: 'America/Bogota',
  });
}

function paymentTotals(session) {
  return session?.salesSummary?.paymentTotals || {};
}

function movementLabel(type, direction = '') {
  if (type === 'adjustment' && direction === 'out') return 'Ajuste negativo';
  if (type === 'adjustment' && direction === 'in') return 'Ajuste positivo';
  const found = MOVEMENT_TYPES.find((item) => item.key === type);
  if (found) return found.label;
  if (type === 'opening') return 'Apertura';
  if (type === 'closing') return 'Cierre';
  if (type === 'withdrawal') return 'Retiro de efectivo';
  return type || 'Movimiento';
}

function movementSign(movement) {
  if (movement?.direction === 'in') return '+';
  if (movement?.direction === 'out') return '-';
  return '';
}

function movementAmountText(movement) {
  return `${movementSign(movement)}${money(movement?.amount)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getMovements(session) {
  return Array.isArray(session?.cashMovements) ? session.cashMovements : [];
}

function isAppliedMovement(movement) {
  return !['pending', 'rejected'].includes(movement?.approvalStatus);
}

function movementApprovalLabel(movement) {
  if (movement?.approvalStatus === 'pending') return 'Pendiente de aprobación';
  if (movement?.approvalStatus === 'approved') return 'Aprobado';
  if (movement?.approvalStatus === 'rejected') return 'Rechazado';
  return 'Aplicado';
}

function movementApprovalColors(movement) {
  if (movement?.approvalStatus === 'pending') return { background: '#fffbeb', color: '#b45309', borderColor: '#fde68a' };
  if (movement?.approvalStatus === 'rejected') return { background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' };
  return { background: '#ecfdf5', color: '#047857', borderColor: '#bbf7d0' };
}

function sumMovements(session, direction) {
  return getMovements(session)
    .filter((movement) => movement.direction === direction && isAppliedMovement(movement))
    .reduce((total, movement) => total + Number(movement.amount || 0), 0);
}

function buildReportHtml(session) {
  const totals = paymentTotals(session);
  const movements = getMovements(session);
  const manualIn = sumMovements(session, 'in');
  const manualOut = sumMovements(session, 'out');
  const difference = Number(session?.differenceAmount || 0);
  const differenceLabel = difference > 0 ? 'Sobrante' : difference < 0 ? 'Faltante' : 'Sin diferencia';
  const rows = movements
    .map((movement) => `
      <tr>
        <td>${escapeHtml(movementLabel(movement.type, movement.direction))}</td>
        <td>${escapeHtml(movement.reason || 'Sin motivo')}</td>
        <td>${escapeHtml(movement.reference || '—')}</td>
        <td>
          ${escapeHtml(movementApprovalLabel(movement))}
          ${movement.reviewedAt ? `<div class="muted">${escapeHtml(movement.reviewedBySnapshot?.displayName || 'Supervisor')} · ${escapeHtml(formatDate(movement.reviewedAt))}${movement.reviewNotes ? ` · ${escapeHtml(movement.reviewNotes)}` : ''}</div>` : ''}
        </td>
        <td>${escapeHtml(formatDate(movement.createdAt))}</td>
        <td class="right ${movement.direction === 'out' ? 'red' : movement.direction === 'in' ? 'green' : ''}">${escapeHtml(movementAmountText(movement))}</td>
      </tr>
    `)
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Reporte cierre de caja ${escapeHtml(session?.sessionCode || '')}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
    .wrap { max-width: 900px; margin: 0 auto; }
    .top { border-left: 8px solid #ec4899; padding: 18px 22px; background: #fff1f7; border-radius: 16px; }
    h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: .05em; }
    h2 { margin: 24px 0 10px; font-size: 15px; text-transform: uppercase; letter-spacing: .12em; color: #6b7280; }
    .muted { color: #6b7280; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 18px; }
    .box { border: 1px solid #f9a8d4; border-radius: 14px; padding: 12px; }
    .label { color: #6b7280; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; }
    .value { margin-top: 5px; font-size: 17px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th { background: #fce7f3; text-align: left; padding: 10px; font-size: 10px; text-transform: uppercase; letter-spacing: .1em; }
    td { border-bottom: 1px solid #f9a8d4; padding: 10px; vertical-align: top; }
    .right { text-align: right; font-weight: 800; }
    .green { color: #047857; }
    .red { color: #b91c1c; }
    .footer { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .line { border-top: 1px solid #111827; padding-top: 8px; text-align: center; font-size: 12px; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <h1>Reporte de cierre de caja</h1>
      <p class="muted">${escapeHtml(session?.sessionCode || '')} · ${escapeHtml(session?.cashRegisterCode || '')}</p>
      <p class="muted">Sede: ${escapeHtml(session?.branchSnapshot?.name || '')} · Cajero: ${escapeHtml(session?.cashierSnapshot?.displayName || '')}</p>
    </div>

    <div class="grid">
      <div class="box"><div class="label">Apertura</div><div class="value">${escapeHtml(money(session?.openingAmount))}</div></div>
      <div class="box"><div class="label">Ventas POS</div><div class="value">${escapeHtml(money(session?.salesSummary?.netSales))}</div></div>
      <div class="box"><div class="label">Esperado</div><div class="value">${escapeHtml(visibleMoney(session?.expectedCash))}</div></div>
      <div class="box"><div class="label">Diferencia</div><div class="value">${escapeHtml(visibleMoney(session?.differenceAmount))}</div></div>
    </div>

    <h2>Datos de apertura y cierre</h2>
    <table>
      <tr><th>Apertura</th><th>Cierre</th><th>Estado</th><th>Contado</th></tr>
      <tr><td>${escapeHtml(formatDate(session?.openedAt))}</td><td>${escapeHtml(formatDate(session?.closedAt))}</td><td>${escapeHtml(session?.status || '')}</td><td class="right">${escapeHtml(visibleMoney(session?.countedCash))}</td></tr>
    </table>

    <h2>Ventas y pagos</h2>
    <table>
      <tr><th>Órdenes</th><th>Artículos</th><th>Efectivo</th><th>Transferencia</th><th>Tarjeta</th><th>Total</th></tr>
      <tr>
        <td>${escapeHtml(session?.salesSummary?.ordersCount || 0)}</td>
        <td>${escapeHtml(session?.salesSummary?.itemsCount || 0)}</td>
        <td class="right">${escapeHtml(visibleMoney(totals.cash))}</td>
        <td class="right">${escapeHtml(visibleMoney(totals.transfer))}</td>
        <td class="right">${escapeHtml(visibleMoney(totals.card))}</td>
        <td class="right">${escapeHtml(visibleMoney(session?.salesSummary?.netSales))}</td>
      </tr>
    </table>

    <h2>Movimientos manuales</h2>
    <div class="grid">
      <div class="box"><div class="label">Ingresos</div><div class="value green">${escapeHtml(money(manualIn))}</div></div>
      <div class="box"><div class="label">Salidas / gastos</div><div class="value red">${escapeHtml(money(manualOut))}</div></div>
      <div class="box"><div class="label">Resultado</div><div class="value">${escapeHtml(differenceLabel)}</div></div>
      <div class="box"><div class="label">Generado</div><div class="value" style="font-size:12px">${escapeHtml(formatDate(new Date()))}</div></div>
    </div>
    <table>
      <tr><th>Tipo</th><th>Motivo</th><th>Referencia</th><th>Estado</th><th>Fecha</th><th class="right">Valor</th></tr>
      ${rows || '<tr><td colspan="6">Sin movimientos registrados.</td></tr>'}
    </table>

    <div class="footer">
      <div class="line">Firma cajero</div>
      <div class="line">Firma responsable / supervisor</div>
    </div>
  </div>
</body>
</html>`;
}

function printReport(session) {
  if (!session?.id) return;

  const reportWindow = window.open('', '_blank', 'width=980,height=720');
  if (!reportWindow) return;

  reportWindow.document.open();
  reportWindow.document.write(buildReportHtml(session));
  reportWindow.document.close();
  reportWindow.focus();
  setTimeout(() => reportWindow.print(), 350);
}

function Card({ children, className = '' }) {
  return (
    <section
      className={`rounded-3xl border ${className}`}
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
        boxShadow: 'var(--admin-shadow-card, 0 18px 50px rgba(15, 23, 42, 0.08))',
      }}
    >
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none transition ${props.className || ''}`}
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
        caretColor: 'var(--admin-primary)',
      }}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none transition"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
      }}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className="min-h-[96px] w-full resize-none rounded-2xl border px-4 py-3 text-sm font-bold outline-none transition"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
        caretColor: 'var(--admin-primary)',
      }}
    />
  );
}

function Button({ children, disabled, onClick, type = 'button', variant = 'primary' }) {
  const primary = variant === 'primary';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        borderColor: primary ? 'var(--admin-primary)' : 'var(--admin-card-border)',
        background: primary ? 'var(--admin-primary)' : 'var(--admin-card-bg)',
        color: primary ? '#fff' : 'var(--admin-card-text)',
      }}
    >
      {children}
    </button>
  );
}

function Message({ type = 'success', children }) {
  const error = type === 'error';

  return (
    <div
      className="flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold"
      style={{
        borderColor: error ? '#fecaca' : '#bbf7d0',
        background: error ? '#fef2f2' : '#ecfdf5',
        color: error ? '#b91c1c' : '#047857',
      }}
    >
      {error ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

function Stat({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-3xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>{label}</p>
          <p className="mt-1 truncate text-lg font-black">{value}</p>
          {helper ? <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{helper}</p> : null}
        </div>
      </div>
    </div>
  );
}

function SessionStats({ session }) {
  const totals = paymentTotals(session);
  const difference = Number(session?.differenceAmount || 0);
  const differenceLabel = difference > 0 ? 'Sobrante' : difference < 0 ? 'Faltante' : 'Sin diferencia';
  const blindCountActive = session?.cashControl?.blindCountActive === true;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Stat icon={blindCountActive ? EyeOff : Banknote} label="Efectivo esperado" value={visibleMoney(session?.expectedCash)} helper={blindCountActive ? 'Se revelará después del cierre' : 'Monto esperado al cierre'} />
        <Stat icon={Wallet} label="Ventas" value={String(session?.salesSummary?.ordersCount || 0)} helper="Órdenes POS asociadas" />
        <Stat icon={CreditCard} label="Total vendido" value={visibleMoney(session?.salesSummary?.netSales)} helper={blindCountActive ? 'Protegido durante el arqueo' : 'Ventas netas'} />
        <Stat icon={LockKeyhole} label={blindCountActive ? 'Diferencia' : differenceLabel} value={blindCountActive ? 'Pendiente' : money(Math.abs(difference))} helper="Se calcula al cerrar" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Banknote} label="Efectivo" value={visibleMoney(totals.cash)} />
        <Stat icon={Smartphone} label="Transferencia" value={visibleMoney(totals.transfer)} />
        <Stat icon={CreditCard} label="Tarjeta" value={visibleMoney(totals.card)} />
        <Stat icon={Wallet} label="Otros pagos" value={blindCountActive ? 'Oculto' : money((totals.mixed || 0) + (totals.other || 0))} />
      </div>
    </div>
  );
}

function ProfessionalControlBanner({ session }) {
  const control = session?.cashControl || {};
  const pending = Number(control.pendingMovementsCount || 0);
  const blind = control.blindCountActive === true;

  return (
    <div className="mb-5 grid gap-3 lg:grid-cols-2">
      <div className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: blind ? '#bfdbfe' : '#bbf7d0', background: blind ? '#eff6ff' : '#ecfdf5', color: blind ? '#1d4ed8' : '#047857' }}>
        {blind ? <EyeOff className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />}
        <div>
          <p className="text-sm font-black">{blind ? 'Conteo ciego activo' : 'Vista de supervisión'}</p>
          <p className="mt-1 text-xs font-bold">{blind ? 'El esperado y los totales monetarios se revelan al cerrar.' : 'Puedes consultar el esperado y revisar solicitudes del cajero.'}</p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: pending ? '#fde68a' : '#bbf7d0', background: pending ? '#fffbeb' : '#ecfdf5', color: pending ? '#b45309' : '#047857' }}>
        {pending ? <Clock3 className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
        <div>
          <p className="text-sm font-black">{pending ? `${pending} movimiento(s) por revisar` : 'Sin aprobaciones pendientes'}</p>
          <p className="mt-1 text-xs font-bold">{pending ? 'La caja no podrá cerrarse hasta resolverlos.' : 'El cierre está libre de solicitudes abiertas.'}</p>
        </div>
      </div>
    </div>
  );
}

function MovementsBox({ session, form, setForm, disabled, onSubmit, onReview }) {
  const movements = getMovements(session).slice().reverse().slice(0, 8);
  const selectedType = MOVEMENT_TYPES.find((item) => item.key === form.type) || MOVEMENT_TYPES[0];
  const canReview = session?.cashControl?.canReviewMovements === true;

  return (
    <div className="mt-5 rounded-3xl border p-5" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>Movimientos manuales</p>
        <h3 className="mt-1 text-lg font-black">Ingresos, salidas y gastos</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>{selectedType.note}</p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 xl:grid-cols-[220px_180px_minmax(0,1fr)_200px_auto] xl:items-end">
        <Field label="Tipo">
          <Select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))} disabled={disabled}>
            {MOVEMENT_TYPES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </Select>
        </Field>
        <Field label="Monto">
          <Input type="number" min="0" step="100" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} disabled={disabled} placeholder="Ej: 10000" />
        </Field>
        <Field label="Motivo">
          <Input value={form.reason} onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))} disabled={disabled} placeholder="Ej: compra de bolsas" />
        </Field>
        <Field label="Referencia">
          <Input value={form.reference} onChange={(event) => setForm((prev) => ({ ...prev, reference: event.target.value }))} disabled={disabled} placeholder="Opcional" />
        </Field>
        <Button type="submit" disabled={disabled}>
          <Banknote className="h-4 w-4" /> Registrar
        </Button>
      </form>

      <div className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
        {movements.length === 0 ? (
          <p className="p-4 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Esta caja todavía no tiene movimientos.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--admin-card-border)' }}>
            {movements.map((movement, index) => (
              <div key={movement._id || `${movement.type}-${movement.createdAt}-${index}`} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_170px_140px_auto] md:items-center">
                <div>
                  <p className="text-sm font-black">{movementLabel(movement.type, movement.direction)}</p>
                  <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                    {movement.reason || 'Sin motivo'}{movement.reference ? ` · Ref: ${movement.reference}` : ''}
                  </p>
                  {movement.reviewedAt ? (
                    <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                      Revisó {movement.reviewedBySnapshot?.displayName || 'Supervisor'} · {formatDate(movement.reviewedAt)}{movement.reviewNotes ? ` · ${movement.reviewNotes}` : ''}
                    </p>
                  ) : null}
                </div>
                <div>
                  <span className="inline-flex rounded-full border px-3 py-1 text-xs font-black" style={movementApprovalColors(movement)}>{movementApprovalLabel(movement)}</span>
                  <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatDate(movement.createdAt)}</p>
                </div>
                <p className="text-right text-sm font-black" style={{ color: movement.direction === 'out' ? '#b91c1c' : movement.direction === 'in' ? '#047857' : 'var(--admin-card-text)' }}>
                  {movementAmountText(movement)}
                </p>
                <div className="flex min-w-[150px] justify-end gap-2">
                  {movement.approvalStatus === 'pending' && canReview ? (
                    <>
                      <button type="button" disabled={disabled} onClick={() => onReview(movement, 'approve')} className="rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-60" style={{ borderColor: '#bbf7d0', color: '#047857' }}>Aprobar</button>
                      <button type="button" disabled={disabled} onClick={() => onReview(movement, 'reject')} className="rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-60" style={{ borderColor: '#fecaca', color: '#b91c1c' }}>Rechazar</button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MovementReviewDialog({ review, notes, setNotes, saving, onCancel, onConfirm }) {
  if (!review?.movement) return null;
  const rejecting = review.decision === 'reject';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label={rejecting ? 'Rechazar movimiento de caja' : 'Aprobar movimiento de caja'}>
      <Card className="w-full max-w-lg overflow-hidden">
        <div className="border-b p-5" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-primary-soft-bg)' }}>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: rejecting ? '#fecaca' : '#bbf7d0', color: rejecting ? '#b91c1c' : '#047857' }}>
              {rejecting ? <XCircle className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="text-xl font-black">{rejecting ? 'Rechazar movimiento' : 'Aprobar movimiento'}</h2>
              <p className="mt-1 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{movementLabel(review.movement.type, review.movement.direction)} · {movementAmountText(review.movement)}</p>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: 'var(--admin-card-border)' }}>
            <p className="font-black">{review.movement.reason || 'Sin motivo'}</p>
            <p className="mt-1 font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Solicitó {review.movement.createdBySnapshot?.displayName || 'Cajero'} · {formatDate(review.movement.createdAt)}</p>
          </div>
          <Field label={rejecting ? 'Motivo del rechazo' : 'Nota de aprobación (opcional)'}>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={saving} placeholder={rejecting ? 'Explica por qué se rechaza la solicitud' : 'Ejemplo: soporte verificado'} autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={saving}>Volver</Button>
            <Button onClick={onConfirm} disabled={saving || (rejecting && !clean(notes))}>{saving ? 'Guardando...' : rejecting ? 'Confirmar rechazo' : 'Confirmar aprobación'}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ReportPanel({ session, onClose }) {
  if (!session) return null;

  const totals = paymentTotals(session);
  const movements = getMovements(session);
  const manualIn = sumMovements(session, 'in');
  const manualOut = sumMovements(session, 'out');

  return (
    <Card className="overflow-hidden border-2" style={{ borderColor: 'var(--admin-primary)' }}>
      <div className="border-b p-5" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-primary-soft-bg)' }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>Reporte de cierre</p>
            <h2 className="mt-1 text-2xl font-black">{session.sessionCode}</h2>
            <p className="mt-1 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
              Caja {session.cashRegisterCode} · Sede {session.branchSnapshot?.name || '—'} · Estado {session.status === 'closed' ? 'Cerrada' : 'Abierta'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => printReport(session)}><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
            <Button variant="ghost" onClick={onClose}>Cerrar reporte</Button>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat icon={UnlockKeyhole} label="Apertura" value={money(session.openingAmount)} helper={formatDate(session.openedAt)} />
          <Stat icon={CreditCard} label="Ventas POS" value={money(session.salesSummary?.netSales)} helper={`${session.salesSummary?.ordersCount || 0} orden(es)`} />
          <Stat icon={Banknote} label="Esperado" value={visibleMoney(session.expectedCash)} helper="Monto final esperado" />
          <Stat icon={LockKeyhole} label="Contado" value={visibleMoney(session.countedCash)} helper={`Diferencia ${visibleMoney(session.differenceAmount)}`} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Banknote} label="Efectivo" value={visibleMoney(totals.cash)} />
          <Stat icon={Smartphone} label="Transferencia" value={visibleMoney(totals.transfer)} />
          <Stat icon={CreditCard} label="Tarjeta" value={visibleMoney(totals.card)} />
          <Stat icon={Wallet} label="Movimientos" value={`${movementSign({ direction: 'in' })}${money(manualIn)} / -${money(manualOut)}`} />
        </div>

        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--admin-card-border)' }}>
            <h3 className="text-sm font-black uppercase tracking-[0.12em]">Detalle de movimientos</h3>
          </div>
          {movements.length === 0 ? (
            <p className="p-4 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Sin movimientos registrados.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--admin-card-border)' }}>
              {movements.map((movement, index) => (
                <div key={movement._id || `${movement.type}-${movement.createdAt}-${index}`} className="grid gap-3 p-4 md:grid-cols-[1fr_180px_160px] md:items-center">
                  <div>
                    <p className="text-sm font-black">{movementLabel(movement.type, movement.direction)}</p>
                    <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                      {movement.reason || 'Sin motivo'}{movement.reference ? ` · Ref: ${movement.reference}` : ''}
                    </p>
                    <p className="mt-1 text-xs font-black" style={{ color: movementApprovalColors(movement).color }}>{movementApprovalLabel(movement)}</p>
                    {movement.reviewedAt ? (
                      <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                        Revisó {movement.reviewedBySnapshot?.displayName || 'Supervisor'} · {formatDate(movement.reviewedAt)}{movement.reviewNotes ? ` · ${movement.reviewNotes}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatDate(movement.createdAt)}</p>
                  <p className="text-right text-sm font-black" style={{ color: movement.direction === 'out' ? '#b91c1c' : movement.direction === 'in' ? '#047857' : 'var(--admin-card-text)' }}>
                    {movementAmountText(movement)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function HistoryTable({ sessions, onReport }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}>
            <History className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-black">Histórico de cierres</h2>
            <p className="text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Últimas cajas abiertas o cerradas.</p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr style={{ color: 'var(--admin-card-muted-text)' }}>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Caja y reporte</th>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Estado</th>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Apertura</th>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Ventas</th>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Esperado</th>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Contado</th>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Todavía no hay movimientos de caja.</td></tr>
            ) : sessions.map((session) => (
              <tr key={session.id} className="border-t" style={{ borderColor: 'var(--admin-card-border)' }}>
                <td className="px-5 py-4 font-black">
                  <p>{session.cashRegisterCode}</p>
                  <p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{session.sessionCode}</p>
                  <button type="button" onClick={() => onReport(session.id)} className="mt-2 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}>
                    <FileText className="h-4 w-4" /> Ver reporte
                  </button>
                </td>
                <td className="px-5 py-4"><span className="rounded-full px-3 py-1 text-xs font-black uppercase" style={{ background: session.status === 'open' ? '#ecfdf5' : 'var(--admin-primary-soft-bg)', color: session.status === 'open' ? '#047857' : 'var(--admin-card-muted-text)' }}>{session.status === 'open' ? 'Abierta' : session.status === 'closed' ? 'Cerrada' : session.status}</span></td>
                <td className="px-5 py-4 font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatDate(session.openedAt)}</td>
                <td className="px-5 py-4 font-black">{session.salesSummary?.ordersCount || 0}</td>
                <td className="px-5 py-4 font-black">{visibleMoney(session.expectedCash)}</td>
                <td className="px-5 py-4 font-black">{visibleMoney(session.countedCash)}</td>
                <td className="px-5 py-4 font-black">{visibleMoney(session.differenceAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function CashSessionsPageReport() {
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [cashRegisterCode, setCashRegisterCode] = useState(REGISTER_CODE);
  const [openingAmount, setOpeningAmount] = useState('50000');
  const [openingNotes, setOpeningNotes] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [movementForm, setMovementForm] = useState({ type: 'cash_in', amount: '', reason: '', reference: '' });
  const [currentSession, setCurrentSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [reportSession, setReportSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [movementSaving, setMovementSaving] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [movementReview, setMovementReview] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedBranch = useMemo(() => branches.find((branch) => branch.id === selectedBranchId) || null, [branches, selectedBranchId]);
  const hasOpenSession = Boolean(currentSession?.id && currentSession.status === 'open');
  const pendingMovementsCount = Number(currentSession?.cashControl?.pendingMovementsCount || 0);

  const refreshForBranch = useCallback(async (branchId = selectedBranchId, registerCode = cashRegisterCode) => {
    if (!branchId) return;
    const [current, history] = await Promise.all([
      getCurrentCashSession({ branchId, cashRegisterCode: registerCode }),
      listCashSessions({ branchId, limit: 12 }),
    ]);

    const session = current?.session || null;
    setCurrentSession(session);
    setSessions(Array.isArray(history?.sessions) ? history.sessions : []);
    setCountedCash('');
  }, [cashRegisterCode, selectedBranchId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const bootstrap = await getPosBootstrap();
      const branchRows = Array.isArray(bootstrap?.branches) ? bootstrap.branches : [];
      const defaultBranchId = selectedBranchId || bootstrap?.defaultBranch?.id || branchRows.find((branch) => branch.isMain)?.id || branchRows[0]?.id || '';

      setBranches(branchRows);
      setSelectedBranchId(defaultBranchId);
      if (defaultBranchId) await refreshForBranch(defaultBranchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible cargar el módulo de caja.');
    } finally {
      setLoading(false);
    }
  }, [cashRegisterCode, refreshForBranch, selectedBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!movementReview) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !reviewSaving) {
        setMovementReview(null);
        setReviewNotes('');
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [movementReview, reviewSaving]);

  const handleBranchChange = async (event) => {
    const branchId = event.target.value;
    setSelectedBranchId(branchId);
    setSuccess('');
    setError('');
    try {
      setLoading(true);
      await refreshForBranch(branchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible consultar la caja de la sede.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCash = async (event) => {
    event.preventDefault();
    if (!selectedBranchId) {
      setError('Debes seleccionar una sede.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const response = await openCashSession({ branchId: selectedBranchId, cashRegisterCode, cashRegisterName: 'Caja POS', openingAmount: numberValue(openingAmount), openingNotes });
      setCurrentSession(response?.session || null);
      setOpeningNotes('');
      setReportSession(null);
      setSuccess('Caja abierta correctamente. Ya puedes vender en POS.');
      await refreshForBranch(selectedBranchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible abrir la caja.');
    } finally {
      setSaving(false);
    }
  };

  const handleMovement = async (event) => {
    event.preventDefault();
    if (!currentSession?.id) return;
    if (numberValue(movementForm.amount) <= 0) {
      setError('El monto del movimiento debe ser mayor que cero.');
      return;
    }
    if (!clean(movementForm.reason)) {
      setError('Debes escribir el motivo del movimiento.');
      return;
    }

    try {
      setMovementSaving(true);
      setError('');
      setSuccess('');
      const movementType = MOVEMENT_TYPES.find((item) => item.key === movementForm.type) || MOVEMENT_TYPES[0];
      const response = await addCashMovement(currentSession.id, {
        ...movementForm,
        type: movementType.type || movementType.key,
        direction: movementType.direction || '',
      });
      setCurrentSession(response?.session || null);
      setMovementForm({ type: movementForm.type, amount: '', reason: '', reference: '' });
      setSuccess(response?.message || 'Movimiento de caja registrado correctamente.');
      await refreshForBranch(selectedBranchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible registrar el movimiento de caja.');
    } finally {
      setMovementSaving(false);
    }
  };

  const openMovementReview = (movement, decision) => {
    setMovementReview({ movement, decision });
    setReviewNotes('');
  };

  const closeMovementReview = () => {
    if (reviewSaving) return;
    setMovementReview(null);
    setReviewNotes('');
  };

  const confirmMovementReview = async () => {
    const movement = movementReview?.movement;
    const decision = movementReview?.decision;
    if (!currentSession?.id || !movement?._id || !decision) return;
    if (decision === 'reject' && !clean(reviewNotes)) {
      setError('Debes indicar el motivo del rechazo.');
      return;
    }

    try {
      setReviewSaving(true);
      setError('');
      setSuccess('');
      const response = await reviewCashMovement(currentSession.id, movement._id, {
        decision,
        reviewNotes,
      });
      setCurrentSession(response?.session || null);
      setMovementReview(null);
      setReviewNotes('');
      setSuccess(response?.message || 'Movimiento revisado correctamente.');
      await refreshForBranch(selectedBranchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible revisar el movimiento de caja.');
    } finally {
      setReviewSaving(false);
    }
  };

  const openReport = async (sessionId) => {
    try {
      setReportLoading(true);
      setError('');
      const response = await getCashSessionById(sessionId);
      setReportSession(response?.session || null);
      window.setTimeout(() => {
        document.getElementById('cash-report-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (err) {
      setError(err?.message || 'No fue posible cargar el reporte de cierre.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleCloseCash = async (event) => {
    event.preventDefault();
    if (!currentSession?.id) return;
    if (!clean(countedCash)) {
      setError('Debes ingresar el efectivo contado antes de cerrar la caja.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const response = await closeCashSession(currentSession.id, { countedCash: numberValue(countedCash), closingNotes });
      const closedSession = response?.session || null;
      setCurrentSession(null);
      setClosingNotes('');
      setCountedCash('');
      setReportSession(closedSession);
      setSuccess(`Caja cerrada correctamente. Diferencia: ${money(closedSession?.differenceAmount || 0)}. Ya puedes ver o imprimir el reporte.`);
      await refreshForBranch(selectedBranchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible cerrar la caja.');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setError('');
      setSuccess('');
      setLoading(true);
      await refreshForBranch(selectedBranchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible actualizar la caja.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}><Wallet className="h-6 w-6" /></span>
            <div>
              <h1 className="text-2xl font-black">Caja y cierre diario</h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Controla apertura, ventas POS, movimientos manuales, cierre y reporte de caja.</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleRefresh} disabled={loading || saving || movementSaving || reviewSaving}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar caja</Button>
        </div>
      </Card>

      {error ? <Message type="error">{error}</Message> : null}
      {success ? <Message>{success}</Message> : null}
      <MovementReviewDialog review={movementReview} notes={reviewNotes} setNotes={setReviewNotes} saving={reviewSaving} onCancel={closeMovementReview} onConfirm={confirmMovementReview} />

      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px_220px]">
          <Field label="Sede">
            <Select value={selectedBranchId} onChange={handleBranchChange} disabled={loading || saving || movementSaving || reviewSaving}>
              {branches.length === 0 ? <option value="">Sin sedes POS</option> : null}
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} - {branch.code}</option>)}
            </Select>
          </Field>
          <Field label="Código de caja">
            <Input value={cashRegisterCode} onChange={(event) => setCashRegisterCode(event.target.value)} disabled={loading || saving || movementSaving || reviewSaving || hasOpenSession} />
          </Field>
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)' }}>
            <div className="flex items-center gap-3"><Building2 className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} /><div><p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>Estado sede</p><p className="text-sm font-black">{selectedBranch?.settings?.requireCashSessionForPos ? 'Exige caja abierta' : 'Caja opcional'}</p></div></div>
          </div>
        </div>
      </Card>

      {reportSession ? (
        <div
          id="cash-report-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Reporte de cierre de caja"
        >
          <ReportPanel session={reportSession} onClose={() => setReportSession(null)} />
        </div>
      ) : null}

      {hasOpenSession ? (
        <Card className="p-5">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>Caja abierta</p><h2 className="mt-1 text-xl font-black">{currentSession.sessionCode}</h2><p className="mt-1 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Apertura: {formatDate(currentSession.openedAt)} · Cajero: {currentSession.cashierSnapshot?.displayName || 'Administrador'}</p></div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setReportSession(currentSession)}><FileText className="h-4 w-4" /> Vista reporte</Button>
              <span className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black" style={{ borderColor: '#bbf7d0', background: '#ecfdf5', color: '#047857' }}><UnlockKeyhole className="h-4 w-4" /> Abierta</span>
            </div>
          </div>

          <ProfessionalControlBanner session={currentSession} />
          <SessionStats session={currentSession} />
          <MovementsBox session={currentSession} form={movementForm} setForm={setMovementForm} disabled={saving || movementSaving || reviewSaving} onSubmit={handleMovement} onReview={openMovementReview} />

          {pendingMovementsCount > 0 ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold" style={{ borderColor: '#fde68a', background: '#fffbeb', color: '#b45309' }}>
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
              <span>El cierre está bloqueado hasta que un supervisor apruebe o rechace los {pendingMovementsCount} movimiento(s) pendientes.</span>
            </div>
          ) : null}

          <form onSubmit={handleCloseCash} className="mt-5 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_auto] lg:items-end">
            <Field label="Efectivo contado"><Input type="number" min="0" step="100" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} disabled={saving || movementSaving || reviewSaving || pendingMovementsCount > 0} /></Field>
            <Field label="Observación de cierre"><Textarea value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} placeholder="Ejemplo: cierre sin novedades" disabled={saving || movementSaving || reviewSaving || pendingMovementsCount > 0} /></Field>
            <Button type="submit" disabled={saving || movementSaving || reviewSaving || pendingMovementsCount > 0}><LockKeyhole className="h-4 w-4" /> {saving ? 'Cerrando...' : pendingMovementsCount > 0 ? 'Cierre bloqueado' : 'Cerrar caja'}</Button>
          </form>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="mb-5 flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}><UnlockKeyhole className="h-6 w-6" /></span><div><h2 className="text-xl font-black">Abrir caja</h2><p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Abre la caja antes de vender en POS. El código debe coincidir con el POS: CAJA POS.</p></div></div>
          <form onSubmit={handleOpenCash} className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_auto] lg:items-end">
            <Field label="Monto inicial"><Input type="number" min="0" step="100" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} disabled={saving || loading} /></Field>
            <Field label="Observación de apertura"><Textarea value={openingNotes} onChange={(event) => setOpeningNotes(event.target.value)} placeholder="Ejemplo: apertura normal de la tienda" disabled={saving || loading} /></Field>
            <Button type="submit" disabled={saving || loading || !selectedBranchId}><UnlockKeyhole className="h-4 w-4" /> {saving ? 'Abriendo...' : 'Abrir caja'}</Button>
          </form>
        </Card>
      )}

      {reportLoading ? <Message>Generando reporte de cierre...</Message> : null}
      <HistoryTable sessions={sessions} onReport={openReport} />
    </section>
  );
}
