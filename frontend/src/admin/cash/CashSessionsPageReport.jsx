// frontend/src/admin/cash/CashSessionsPageReport.jsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
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
  Store,
  UnlockKeyhole,
  UserCheck,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

import { getPosBootstrap } from '../api/adminPosApi';
import {
  addCashMovement,
  certifyCashJourney,
  closeCashSession,
  getCashJourneySummary,
  getCashSessionById,
  getCurrentCashSession,
  listCashSessions,
  openCashSession,
  reviewCashClosing,
  reviewCashMovement,
} from '../api/adminCashSessionApi';

const REGISTER_CODE = 'CAJA POS';
const CASH_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

function emptyDenominationCounts() {
  return Object.fromEntries(CASH_DENOMINATIONS.map((value) => [value, '']));
}

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
  const denominations = Array.isArray(session?.cashCount?.denominations)
    ? session.cashCount.denominations.filter((entry) => Number(entry.quantity || 0) > 0)
    : [];
  const closingReviews = Array.isArray(session?.closingReviews) ? session.closingReviews : [];
  const reconciliation = session?.reconciliation || {};
  const reconciliationChecks = Array.isArray(reconciliation?.checks) ? reconciliation.checks : [];
  const denominationRows = denominations.map((entry) => `
    <tr><td>${escapeHtml(money(entry.value))}</td><td class="right">${escapeHtml(entry.quantity)}</td><td class="right">${escapeHtml(money(entry.subtotal))}</td></tr>
  `).join('');
  const reviewRows = closingReviews.map((review) => `
    <tr><td>${escapeHtml(review.status || '')}</td><td>${escapeHtml(review.requestedBySnapshot?.displayName || 'Cajero')}</td><td class="right">${escapeHtml(money(review.countedCash))}</td><td class="right">${escapeHtml(visibleMoney(review.differenceAmount))}</td><td>${escapeHtml(review.reviewedBySnapshot?.displayName || '—')}${review.reviewNotes ? ` · ${escapeHtml(review.reviewNotes)}` : ''}</td></tr>
  `).join('');
  const reconciliationRows = reconciliationChecks.map((item) => `
    <tr><td>${escapeHtml(item.label || item.code || '')}</td><td>${escapeHtml(item.status === 'ok' ? 'Correcto' : item.status === 'attention' ? 'Atención' : 'Inconsistencia')}</td><td class="right">${escapeHtml(money(item.expected))}</td><td class="right">${escapeHtml(money(item.actual))}</td><td>${escapeHtml(item.message || '')}</td></tr>
  `).join('');
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

    <h2>Arqueo por denominaciones</h2>
    <table>
      <tr><th>Denominación</th><th class="right">Cantidad</th><th class="right">Subtotal</th></tr>
      ${denominationRows || '<tr><td colspan="3">Cierre manual sin desglose de denominaciones.</td></tr>'}
    </table>

    ${closingReviews.length ? `<h2>Revisión de diferencias</h2><table><tr><th>Estado</th><th>Solicitó</th><th class="right">Contado</th><th class="right">Diferencia</th><th>Supervisión</th></tr>${reviewRows}</table>` : ''}

    ${reconciliationChecks.length ? `<h2>Conciliación automática</h2><table><tr><th>Control</th><th>Estado</th><th class="right">Esperado</th><th class="right">Real</th><th>Resultado</th></tr>${reconciliationRows}</table>` : ''}

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

function Card({ children, className = '', style = {}, ...props }) {
  return (
    <section
      {...props}
      className={`rounded-3xl border ${className}`}
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
        boxShadow: 'var(--admin-shadow-card, 0 18px 50px rgba(15, 23, 42, 0.08))',
        ...style,
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

function Stat({ icon: Icon, label, value, helper, wrapValue = false }) {
  return (
    <div className="rounded-3xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>{label}</p>
          <p className={`mt-1 text-lg font-black ${wrapValue ? '' : 'truncate'}`}>{value}</p>
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
  const closingLocked = control.closingLocked === true;

  return (
    <div className="mb-5 grid gap-3 lg:grid-cols-2">
      <div className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: blind ? '#bfdbfe' : '#bbf7d0', background: blind ? '#eff6ff' : '#ecfdf5', color: blind ? '#1d4ed8' : '#047857' }}>
        {blind ? <EyeOff className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />}
        <div>
          <p className="text-sm font-black">{blind ? 'Conteo ciego activo' : 'Vista de supervisión'}</p>
          <p className="mt-1 text-xs font-bold">{blind ? 'El esperado y los totales monetarios se revelan al cerrar.' : 'Puedes consultar el esperado y revisar solicitudes del cajero.'}</p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: pending || closingLocked ? '#fde68a' : '#bbf7d0', background: pending || closingLocked ? '#fffbeb' : '#ecfdf5', color: pending || closingLocked ? '#b45309' : '#047857' }}>
        {pending || closingLocked ? <Clock3 className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
        <div>
          <p className="text-sm font-black">{closingLocked ? 'Arqueo pendiente de supervisión' : pending ? `${pending} movimiento(s) por revisar` : 'Sin aprobaciones pendientes'}</p>
          <p className="mt-1 text-xs font-bold">{closingLocked ? 'Ventas y movimientos están congelados hasta la decisión.' : pending ? 'La caja no podrá cerrarse hasta resolverlos.' : 'El cierre está libre de solicitudes abiertas.'}</p>
        </div>
      </div>
    </div>
  );
}

function reconciliationPresentation(status) {
  if (status === 'critical') return { label: 'Requiere revisión', color: '#b91c1c', background: '#fef2f2', borderColor: '#fecaca' };
  if (status === 'attention') return { label: 'Con novedades', color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' };
  return { label: 'Jornada conciliada', color: '#047857', background: '#ecfdf5', borderColor: '#bbf7d0' };
}

function CashJourneyPanel({ summary, range, onRangeChange, loading, certifying, notes, setNotes, onCertify }) {
  if (!summary) return null;
  const totals = summary.totals || {};
  const payments = totals.paymentTotals || {};
  const presentation = reconciliationPresentation(summary.status);
  const rows = Array.isArray(summary.sessions) ? summary.sessions.slice(0, 6) : [];
  const journeyClose = summary.journeyClose || null;
  const closeBlockers = [];
  if (!Number(totals.sessionsCount || 0)) closeBlockers.push('Aún no hay cajas en la jornada.');
  if (Number(totals.openSessionsCount || 0)) closeBlockers.push('Cierra todas las cajas.');
  if (Number(totals.pendingReviewCount || 0)) closeBlockers.push('Resuelve los arqueos pendientes.');
  if (Number(summary.issueCounts?.critical || 0)) closeBlockers.push('Corrige las inconsistencias críticas.');
  const requiresNotes = Number(totals.shortages || 0) > 0 || Number(totals.overages || 0) > 0;
  const canCertify = range === 'today' && !journeyClose && closeBlockers.length === 0 && (!requiresNotes || clean(notes));

  return (
    <Card className="overflow-hidden" data-testid="cash-journey-stage3">
      <div className="border-b p-5" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-primary-soft-bg)' }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: presentation.borderColor, color: presentation.color, background: presentation.background }}><ShieldCheck className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>Control de jornada · Cierre operativo</p>
              <h2 className="mt-1 text-xl font-black">Conciliación automática de caja</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Cruza sesiones, ventas POS, medios de pago, movimientos y arqueos desde el servidor.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onRangeChange('today')} disabled={loading} className="rounded-xl border px-3 py-2 text-xs font-black" style={{ borderColor: range === 'today' ? 'var(--admin-primary)' : 'var(--admin-card-border)', color: range === 'today' ? 'var(--admin-primary)' : 'var(--admin-card-muted-text)', background: 'var(--admin-card-bg)' }}>Hoy</button>
            <button type="button" onClick={() => onRangeChange('last_7_days')} disabled={loading} className="rounded-xl border px-3 py-2 text-xs font-black" style={{ borderColor: range === 'last_7_days' ? 'var(--admin-primary)' : 'var(--admin-card-border)', color: range === 'last_7_days' ? 'var(--admin-primary)' : 'var(--admin-card-muted-text)', background: 'var(--admin-card-bg)' }}>Últimos 7 días</button>
            <span className="inline-flex rounded-xl border px-3 py-2 text-xs font-black" style={{ color: presentation.color, background: presentation.background, borderColor: presentation.borderColor }}>{presentation.label}</span>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat icon={History} label="Cajas" value={String(totals.sessionsCount || 0)} helper={`${totals.closedSessionsCount || 0} cerradas · ${totals.openSessionsCount || 0} abiertas`} />
          <Stat icon={Wallet} label="Ventas conciliadas" value={money(totals.netSales)} helper={`${totals.ordersCount || 0} órdenes POS`} />
          <Stat icon={Banknote} label="Efectivo contado" value={money(totals.countedCash)} helper={`Esperado ${money(totals.expectedCash)}`} />
          <Stat icon={AlertCircle} label="Diferencia acumulada" value={money(Math.abs(Number(totals.differenceAmount || 0)))} helper={`Faltantes ${money(totals.shortages)} · Sobrantes ${money(totals.overages)}`} wrapValue />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Stat icon={Banknote} label="Efectivo" value={money(payments.cash)} />
          <Stat icon={Smartphone} label="Transferencia" value={money(payments.transfer)} />
          <Stat icon={CreditCard} label="Tarjeta" value={money(payments.card)} />
          <Stat icon={Wallet} label="Mixto / otros" value={money(Number(payments.mixed || 0) + Number(payments.other || 0))} />
          <Stat icon={ShieldCheck} label="Total medios" value={money(payments.total)} />
        </div>

        {Array.isArray(summary.alerts) && summary.alerts.length > 0 ? (
          <div className="space-y-2">
            {summary.alerts.map((alert) => <div key={alert.code} className="flex items-start gap-3 rounded-2xl border p-3 text-sm font-bold" style={{ borderColor: alert.severity === 'critical' ? '#fecaca' : '#fde68a', background: alert.severity === 'critical' ? '#fef2f2' : '#fffbeb', color: alert.severity === 'critical' ? '#b91c1c' : '#b45309' }}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{alert.message}</span></div>)}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold" style={{ borderColor: '#bbf7d0', background: '#ecfdf5', color: '#047857' }}><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><span>No se detectaron inconsistencias en el período seleccionado.</span></div>
        )}

        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr style={{ color: 'var(--admin-card-muted-text)' }}><th className="px-4 py-3 text-xs font-black uppercase">Sesión</th><th className="px-4 py-3 text-xs font-black uppercase">Cajero</th><th className="px-4 py-3 text-xs font-black uppercase">Ventas</th><th className="px-4 py-3 text-xs font-black uppercase">Esperado</th><th className="px-4 py-3 text-xs font-black uppercase">Contado</th><th className="px-4 py-3 text-xs font-black uppercase">Control</th></tr></thead>
              <tbody>{rows.map((row) => { const rowPresentation = reconciliationPresentation(row.reconciliationStatus); return <tr key={row.id} className="border-t" style={{ borderColor: 'var(--admin-card-border)' }}><td className="px-4 py-3"><p className="font-black">{row.sessionCode}</p><p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatDate(row.openedAt)}</p></td><td className="px-4 py-3 font-bold">{row.cashierSnapshot?.displayName || 'Administrador'}</td><td className="px-4 py-3 font-black">{money(row.netSales)}</td><td className="px-4 py-3 font-black">{money(row.expectedCash)}</td><td className="px-4 py-3 font-black">{row.status === 'closed' ? money(row.countedCash) : 'Pendiente'}</td><td className="px-4 py-3"><span className="inline-flex rounded-xl border px-2 py-1 text-xs font-black" style={{ color: rowPresentation.color, background: rowPresentation.background, borderColor: rowPresentation.borderColor }}>{rowPresentation.label}</span></td></tr>; })}</tbody>
            </table>
          </div>
        ) : null}

        {range === 'today' ? (
          <div className="rounded-3xl border p-5" data-testid="cash-journey-close-stage4" style={{ borderColor: journeyClose ? '#bbf7d0' : 'var(--admin-card-border)', background: journeyClose ? '#ecfdf5' : 'var(--admin-page-bg)' }}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: journeyClose ? '#bbf7d0' : 'var(--admin-card-border)', color: journeyClose ? '#047857' : 'var(--admin-primary)', background: 'var(--admin-card-bg)' }}><ShieldCheck className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Cierre diario</p>
                  <h3 className="mt-1 text-lg font-black">{journeyClose ? 'Jornada certificada' : 'Certificar jornada'}</h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>{journeyClose ? `Certificó ${journeyClose.certifiedBySnapshot?.displayName || 'Supervisor'} · ${formatDate(journeyClose.certifiedAt)}` : 'Congela el consolidado del día y evita nuevas aperturas de caja en esta sede.'}</p>
                </div>
              </div>
              {journeyClose ? <span className="inline-flex rounded-xl border px-3 py-2 text-xs font-black" style={{ borderColor: '#bbf7d0', color: '#047857', background: '#fff' }}>Certificado {journeyClose.businessDate}</span> : null}
            </div>
            {journeyClose ? (
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="rounded-2xl border p-3 text-sm font-bold" style={{ borderColor: '#bbf7d0', background: '#fff', color: '#047857' }}>{journeyClose.notes || 'Jornada cerrada sin novedades.'}</div>
                <div className="rounded-2xl border p-3 text-xs font-bold" style={{ borderColor: '#bbf7d0', background: '#fff', color: 'var(--admin-card-muted-text)' }}>Huella: {String(journeyClose.contentDigest || '').slice(0, 16)}</div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <Field label={requiresNotes ? 'Observación obligatoria por diferencias' : 'Observación final (opcional)'}><Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={requiresNotes ? 'Explica el faltante o sobrante antes de certificar' : 'Ejemplo: jornada revisada sin novedades'} disabled={loading || certifying} /></Field>
                <Button onClick={onCertify} disabled={loading || certifying || !canCertify}><ShieldCheck className="h-4 w-4" /> {certifying ? 'Certificando...' : 'Certificar jornada'}</Button>
              </div>
            )}
            {!journeyClose && closeBlockers.length > 0 ? <p className="mt-3 text-sm font-bold" style={{ color: '#b45309' }}>{closeBlockers.join(' ')}</p> : null}
          </div>
        ) : null}
      </div>
    </Card>
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

function WorkspaceDialog({ label, title, description, icon: Icon, onClose, children, wide = false }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="cash-workspace-dialog" role="dialog" aria-modal="true" aria-label={label}>
      <section className={`cash-workspace-dialog__panel ${wide ? 'cash-workspace-dialog__panel--wide' : ''}`}>
        <header className="cash-workspace-dialog__header">
          <div className="flex min-w-0 items-start gap-3">
            <span className="cash-workspace-dialog__icon"><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 className="text-xl font-black">{title}</h2>
              {description ? <p className="mt-1 text-sm font-medium" style={{ color: 'var(--admin-card-muted-text)' }}>{description}</p> : null}
            </div>
          </div>
          <button type="button" className="cash-workspace-dialog__close" onClick={onClose} aria-label={`Cerrar ${label}`}>
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="cash-workspace-dialog__body">{children}</div>
      </section>
    </div>,
    document.body
  );
}

function OperationAction({ icon: Icon, title, description, action, tone = 'primary', badge, disabled = false }) {
  return (
    <button type="button" className={`cash-operation-action cash-operation-action--${tone}`} onClick={action} disabled={disabled}>
      <span className="cash-operation-action__icon"><Icon className="h-6 w-6" /></span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="block text-base font-black">{title}</span>
          {badge ? <span className="cash-operation-action__badge">{badge}</span> : null}
        </span>
        <span className="mt-1 block text-sm font-medium">{description}</span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0" />
    </button>
  );
}

function MovementReviewDialog({ review, notes, setNotes, saving, onCancel, onConfirm }) {
  if (!review?.movement) return null;
  const rejecting = review.decision === 'reject';

  if (typeof document === 'undefined') return null;

  return createPortal((
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label={rejecting ? 'Rechazar movimiento de caja' : 'Aprobar movimiento de caja'}>
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
  ), document.body);
}

function ReportPanel({ session, onClose }) {
  if (!session) return null;

  const totals = paymentTotals(session);
  const movements = getMovements(session);
  const manualIn = sumMovements(session, 'in');
  const manualOut = sumMovements(session, 'out');
  const denominations = Array.isArray(session?.cashCount?.denominations)
    ? session.cashCount.denominations.filter((entry) => Number(entry.quantity || 0) > 0)
    : [];
  const closingReviews = Array.isArray(session?.closingReviews) ? session.closingReviews : [];
  const reconciliation = session?.reconciliation || {};
  const reconciliationChecks = Array.isArray(reconciliation?.checks) ? reconciliation.checks : [];

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
          <Stat
            icon={Wallet}
            label="Movimientos"
            wrapValue
            value={(
              <span className="flex flex-col gap-1 text-sm leading-tight">
                <span style={{ color: '#047857' }}>Entradas +{money(manualIn)}</span>
                <span style={{ color: '#b91c1c' }}>Salidas -{money(manualOut)}</span>
              </span>
            )}
          />
        </div>

        {denominations.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--admin-card-border)' }}><h3 className="text-sm font-black uppercase tracking-[0.12em]">Arqueo por denominaciones</h3></div>
            <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {denominations.map((entry) => <div key={entry.value} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-bold" style={{ borderColor: 'var(--admin-card-border)' }}><span>{money(entry.value)} × {entry.quantity}</span><span>{money(entry.subtotal)}</span></div>)}
            </div>
          </div>
        ) : null}

        {closingReviews.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--admin-card-border)' }}><h3 className="text-sm font-black uppercase tracking-[0.12em]">Revisión de diferencias</h3></div>
            <div className="divide-y" style={{ borderColor: 'var(--admin-card-border)' }}>
              {closingReviews.map((review) => <div key={review._id} className="grid gap-2 p-4 text-sm md:grid-cols-[1fr_160px_1fr]"><div><p className="font-black">{review.status === 'approved' ? 'Aprobado' : review.status === 'rejected' ? 'Rechazado' : 'Pendiente'}</p><p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{review.requestedBySnapshot?.displayName || 'Cajero'} · {formatDate(review.requestedAt)}</p></div><p className="font-black">{money(review.countedCash)} · {visibleMoney(review.differenceAmount)}</p><p className="font-bold">{review.reviewedBySnapshot?.displayName || 'Sin revisión'}{review.reviewNotes ? ` · ${review.reviewNotes}` : ''}</p></div>)}
            </div>
          </div>
        ) : null}

        {reconciliationChecks.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)' }} data-testid="cash-report-reconciliation">
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--admin-card-border)' }}><h3 className="text-sm font-black uppercase tracking-[0.12em]">Conciliación automática</h3></div>
            <div className="divide-y" style={{ borderColor: 'var(--admin-card-border)' }}>
              {reconciliationChecks.map((item) => {
                const presentation = reconciliationPresentation(item.status === 'ok' ? 'healthy' : item.status);
                return <div key={item.code} className="grid gap-2 p-4 text-sm md:grid-cols-[minmax(0,1fr)_130px_180px]"><div><p className="font-black">{item.label || item.code}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{item.message}</p></div><span className="h-fit w-fit rounded-xl border px-2 py-1 text-xs font-black" style={{ color: presentation.color, background: presentation.background, borderColor: presentation.borderColor }}>{item.status === 'ok' ? 'Correcto' : item.status === 'attention' ? 'Atención' : 'Inconsistencia'}</span><p className="font-black md:text-right">Esperado {money(item.expected)} · Real {money(item.actual)}</p></div>;
              })}
            </div>
          </div>
        ) : null}

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
  const [activeView, setActiveView] = useState('operation');
  const [operationDialog, setOperationDialog] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [cashRegisterCode, setCashRegisterCode] = useState(REGISTER_CODE);
  const [openingAmount, setOpeningAmount] = useState('50000');
  const [openingNotes, setOpeningNotes] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [denominationCounts, setDenominationCounts] = useState(emptyDenominationCounts);
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
  const [closingReviewNotes, setClosingReviewNotes] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [canSupervise, setCanSupervise] = useState(false);
  const [journeyRange, setJourneyRange] = useState('today');
  const [journeySummary, setJourneySummary] = useState(null);
  const [todayJourneyClose, setTodayJourneyClose] = useState(null);
  const [journeyCloseNotes, setJourneyCloseNotes] = useState('');
  const [journeyCertifying, setJourneyCertifying] = useState(false);

  const selectedBranch = useMemo(() => branches.find((branch) => branch.id === selectedBranchId) || null, [branches, selectedBranchId]);
  const hasOpenSession = Boolean(currentSession?.id && currentSession.status === 'open');
  const journeyCertified = Boolean(todayJourneyClose);
  const pendingMovementsCount = Number(currentSession?.cashControl?.pendingMovementsCount || 0);
  const closingLocked = currentSession?.cashControl?.closingLocked === true;
  const pendingClosingReview = useMemo(
    () => (Array.isArray(currentSession?.closingReviews)
      ? currentSession.closingReviews.find((review) => review.status === 'pending') || null
      : null),
    [currentSession]
  );
  const denominationRows = useMemo(
    () => CASH_DENOMINATIONS.map((value) => ({
      value,
      quantity: numberValue(denominationCounts[value]),
      subtotal: value * numberValue(denominationCounts[value]),
    })),
    [denominationCounts]
  );
  const denominationTotal = useMemo(
    () => denominationRows.reduce((sum, entry) => sum + entry.subtotal, 0),
    [denominationRows]
  );

  const refreshForBranch = useCallback(async (branchId = selectedBranchId, registerCode = cashRegisterCode, range = journeyRange) => {
    if (!branchId) return;
    const [current, history] = await Promise.all([
      getCurrentCashSession({ branchId, cashRegisterCode: registerCode }),
      listCashSessions({ branchId, limit: 12 }),
    ]);
    const supervisorAccess = current?.access?.canSupervise === true;
    const journey = supervisorAccess
      ? await getCashJourneySummary({ branchId, range })
      : null;

    const session = current?.session || null;
    setCanSupervise(supervisorAccess);
    setJourneySummary(journey?.summary || null);
    if (range === 'today') setTodayJourneyClose(journey?.summary?.journeyClose || null);
    setCurrentSession(session);
    setSessions(Array.isArray(history?.sessions) ? history.sessions : []);
    setCountedCash('');
    setDenominationCounts(emptyDenominationCounts());
  }, [cashRegisterCode, journeyRange, selectedBranchId]);

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
    if (!movementReview && !reportSession && !operationDialog) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !reviewSaving && !saving && !movementSaving) {
        if (movementReview) {
          setMovementReview(null);
          setReviewNotes('');
        } else if (reportSession) {
          setReportSession(null);
        } else {
          setOperationDialog(null);
        }
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [movementReview, movementSaving, operationDialog, reportSession, reviewSaving, saving]);

  const handleBranchChange = async (event) => {
    const branchId = event.target.value;
    setSelectedBranchId(branchId);
    setActiveView('operation');
    setOperationDialog(null);
    setJourneyRange('today');
    setTodayJourneyClose(null);
    setSuccess('');
    setError('');
    try {
      setLoading(true);
      await refreshForBranch(branchId, cashRegisterCode, 'today');
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
    } catch (err) {
      setError(err?.message || 'No fue posible cargar el reporte de cierre.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleCloseCash = async (event) => {
    event.preventDefault();
    if (!currentSession?.id) return;
    const hasDenominationEntry = Object.values(denominationCounts).some((value) => clean(value) !== '');
    if (!clean(countedCash) && !hasDenominationEntry) {
      setError('Debes ingresar el efectivo contado antes de cerrar la caja.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const response = await closeCashSession(currentSession.id, {
        countedCash: denominationTotal,
        denominations: denominationRows,
        closingNotes,
      });
      const closedSession = response?.session || null;
      setClosingNotes('');
      setCountedCash('');
      setDenominationCounts(emptyDenominationCounts());
      if (response?.requiresApproval) {
        setCurrentSession(closedSession);
        setSuccess(response?.message || 'Arqueo enviado a supervisión.');
      } else {
        setCurrentSession(null);
        setReportSession(closedSession);
        setSuccess(`Caja cerrada correctamente. Diferencia: ${money(closedSession?.differenceAmount || 0)}. Ya puedes ver o imprimir el reporte.`);
      }
      setOperationDialog(null);
      await refreshForBranch(selectedBranchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible cerrar la caja.');
    } finally {
      setSaving(false);
    }
  };

  const handleClosingReview = async (decision) => {
    if (!currentSession?.id || !pendingClosingReview?._id) return;
    if (!clean(closingReviewNotes)) {
      setError('Debes registrar una observación de supervisión.');
      return;
    }
    try {
      setReviewSaving(true);
      setError('');
      setSuccess('');
      const response = await reviewCashClosing(currentSession.id, pendingClosingReview._id, {
        decision,
        reviewNotes: closingReviewNotes,
      });
      setClosingReviewNotes('');
      if (decision === 'approve') {
        setCurrentSession(null);
        setReportSession(response?.session || null);
      } else {
        setCurrentSession(response?.session || null);
      }
      setOperationDialog(null);
      setSuccess(response?.message || 'Arqueo revisado correctamente.');
      await refreshForBranch(selectedBranchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible revisar el arqueo.');
    } finally {
      setReviewSaving(false);
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

  const handleJourneyRangeChange = (nextRange) => {
    if (nextRange === journeyRange) return;
    setJourneyRange(nextRange);
  };

  const handleCertifyJourney = async () => {
    if (!selectedBranchId) return;
    try {
      setJourneyCertifying(true);
      setError('');
      setSuccess('');
      const response = await certifyCashJourney({ branchId: selectedBranchId, notes: journeyCloseNotes });
      setJourneySummary((previous) => previous ? { ...previous, journeyClose: response?.journeyClose || null } : previous);
      setTodayJourneyClose(response?.journeyClose || null);
      setJourneyCloseNotes('');
      setSuccess(response?.message || 'Jornada certificada correctamente.');
      await refreshForBranch(selectedBranchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible certificar el cierre diario de caja.');
    } finally {
      setJourneyCertifying(false);
    }
  };

  const navigation = [
    { key: 'operation', label: 'Operación', icon: Wallet },
    ...(canSupervise ? [{ key: 'reconciliation', label: 'Conciliación y cierre', icon: ShieldCheck }] : []),
    { key: 'history', label: 'Histórico', icon: History },
  ];

  return (
    <section className="cash-workspace space-y-4">
      <Card className="cash-workspace__header overflow-hidden">
        <div className="cash-workspace__hero">
          <div className="flex min-w-0 items-center gap-4">
            <span className="cash-workspace__hero-icon"><Wallet className="h-6 w-6" /></span>
            <div className="min-w-0">
              <h1 className="text-2xl font-black">Caja</h1>
              <p className="mt-1 text-sm font-medium" style={{ color: 'var(--admin-card-muted-text)' }}>
                {hasOpenSession ? `Sesión activa · ${currentSession.sessionCode}` : journeyCertified ? 'Jornada finalizada y certificada' : 'Lista para iniciar la operación'}
              </p>
            </div>
          </div>
          <div className="cash-workspace__context">
            <Field label="Sede">
              <Select value={selectedBranchId} onChange={handleBranchChange} disabled={loading || saving || movementSaving || reviewSaving}>
                {branches.length === 0 ? <option value="">Sin sedes POS</option> : null}
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} - {branch.code}</option>)}
              </Select>
            </Field>
            <div className="cash-workspace__status">
              <Store className="h-5 w-5" />
              <div>
                <span>{hasOpenSession ? 'Caja abierta' : journeyCertified ? 'Jornada cerrada' : 'Caja cerrada'}</span>
                <small>{selectedBranch?.name || 'Sin sede seleccionada'}</small>
              </div>
            </div>
            <Button variant="ghost" onClick={handleRefresh} disabled={loading || saving || movementSaving || reviewSaving}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
          </div>
        </div>

        <nav className="cash-workspace__tabs" aria-label="Secciones de caja">
          {navigation.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setActiveView(key)} aria-current={activeView === key ? 'page' : undefined}>
              <Icon className="h-4 w-4" /> {label}
              {key === 'history' && sessions.length ? <span>{sessions.length}</span> : null}
              {key === 'reconciliation' && journeySummary?.status === 'attention' ? <span className="cash-workspace__alert-dot">!</span> : null}
            </button>
          ))}
        </nav>
      </Card>

      {error && !operationDialog ? <Message type="error">{error}</Message> : null}
      {success && !operationDialog ? <Message>{success}</Message> : null}
      {reportLoading ? <Message>Generando reporte de cierre...</Message> : null}

      <MovementReviewDialog review={movementReview} notes={reviewNotes} setNotes={setReviewNotes} saving={reviewSaving} onCancel={closeMovementReview} onConfirm={confirmMovementReview} />

      {reportSession && typeof document !== 'undefined' ? createPortal(
        <div id="cash-report-panel" role="dialog" aria-modal="true" aria-label="Reporte de cierre de caja">
          <ReportPanel session={reportSession} onClose={() => setReportSession(null)} />
        </div>,
        document.body
      ) : null}

      {activeView === 'operation' ? (
        hasOpenSession ? (
          <Card className="cash-operation p-5">
            <div className="cash-operation__heading">
              <div>
                <p className="cash-eyebrow">Operación en curso</p>
                <h2 className="mt-1 text-xl font-black">{currentSession.sessionCode}</h2>
                <p className="mt-1 text-sm font-medium" style={{ color: 'var(--admin-card-muted-text)' }}>
                  {currentSession.cashierSnapshot?.displayName || 'Administrador'} · Abierta {formatDate(currentSession.openedAt)}
                </p>
              </div>
              <span className="cash-status-pill cash-status-pill--open"><UnlockKeyhole className="h-4 w-4" /> Abierta</span>
            </div>

            <ProfessionalControlBanner session={currentSession} />
            <SessionStats session={currentSession} />

            {pendingClosingReview ? (
              <div className="mt-4 rounded-3xl border p-5" style={{ borderColor: '#fde68a', background: '#fffbeb' }}>
                <div className="flex items-start gap-3" style={{ color: '#b45309' }}>
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-black">Arqueo extraordinario pendiente</p>
                    <p className="mt-1 text-xs font-bold">Contado: {money(pendingClosingReview.countedCash)}{pendingClosingReview.differenceAmount !== null && pendingClosingReview.differenceAmount !== undefined ? ` · Diferencia: ${money(pendingClosingReview.differenceAmount)}` : ''} · Tolerancia: {money(pendingClosingReview.toleranceAmount)}</p>
                  </div>
                </div>
                {currentSession?.cashControl?.canReviewClosing ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
                    <Field label="Observación de supervisión"><Input value={closingReviewNotes} onChange={(event) => setClosingReviewNotes(event.target.value)} placeholder="Explica la decisión" disabled={reviewSaving} /></Field>
                    <Button type="button" variant="ghost" onClick={() => handleClosingReview('reject')} disabled={reviewSaving}><XCircle className="h-4 w-4" /> Rechazar</Button>
                    <Button type="button" onClick={() => handleClosingReview('approve')} disabled={reviewSaving}><CheckCircle2 className="h-4 w-4" /> Aprobar y cerrar</Button>
                  </div>
                ) : <p className="mt-3 text-sm font-bold" style={{ color: '#b45309' }}>Un supervisor debe revisar este conteo. La operación permanece congelada.</p>}
              </div>
            ) : (
              <div className="cash-operation__actions">
                <OperationAction icon={Banknote} title="Registrar movimiento" description="Ingresos, gastos, retiros y ajustes de efectivo." action={() => setOperationDialog('movement')} badge={pendingMovementsCount ? `${pendingMovementsCount} pendiente${pendingMovementsCount === 1 ? '' : 's'}` : ''} />
                <OperationAction icon={ClipboardCheck} title={pendingMovementsCount ? 'Cierre bloqueado' : 'Realizar arqueo'} description={pendingMovementsCount ? 'Primero deben resolverse los movimientos pendientes.' : 'Cuenta billetes y monedas para cerrar la caja.'} action={() => setOperationDialog('closing')} tone="closing" disabled={pendingMovementsCount > 0} />
                <OperationAction icon={FileText} title="Ver reporte actual" description="Consulta el resumen de la sesión sin salir de la operación." action={() => setReportSession(currentSession)} tone="neutral" />
              </div>
            )}

            {pendingMovementsCount > 0 ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold" style={{ borderColor: '#fde68a', background: '#fffbeb', color: '#b45309' }}>
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
                <span>Hay {pendingMovementsCount} movimiento(s) pendiente(s). Revísalos en “Registrar movimiento” antes de cerrar.</span>
              </div>
            ) : null}
          </Card>
        ) : journeyCertified ? (
          <Card className="cash-journey-finished p-6">
            <span className="cash-journey-finished__icon"><CheckCircle2 className="h-8 w-8" /></span>
            <div className="min-w-0 flex-1">
              <p className="cash-eyebrow">Operación finalizada</p>
              <h2 className="mt-1 text-2xl font-black">La jornada de esta sede ya fue certificada</h2>
              <p className="mt-2 text-sm font-medium" style={{ color: 'var(--admin-card-muted-text)' }}>No se pueden abrir nuevas cajas hoy. Consulta el certificado o los cierres anteriores desde las secciones correspondientes.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canSupervise ? <Button onClick={() => setActiveView('reconciliation')}><ShieldCheck className="h-4 w-4" /> Ver certificado</Button> : null}
              <Button variant="ghost" onClick={() => setActiveView('history')}><History className="h-4 w-4" /> Ver histórico</Button>
            </div>
          </Card>
        ) : (
          <Card className="cash-opening p-6">
            <div className="cash-opening__intro">
              <span className="cash-opening__icon"><UnlockKeyhole className="h-7 w-7" /></span>
              <div>
                <p className="cash-eyebrow">Inicio de jornada</p>
                <h2 className="mt-1 text-2xl font-black">Abrir caja</h2>
                <p className="mt-2 max-w-xl text-sm font-medium" style={{ color: 'var(--admin-card-muted-text)' }}>Registra el fondo inicial y deja la caja lista para recibir ventas del POS.</p>
              </div>
            </div>
            <form onSubmit={handleOpenCash} className="cash-opening__form">
              <Field label="Código de caja"><Input value={cashRegisterCode} onChange={(event) => setCashRegisterCode(event.target.value)} disabled={loading || saving} /></Field>
              <Field label="Monto inicial"><Input type="number" min="0" step="100" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} disabled={saving || loading} /></Field>
              <Field label="Observación de apertura"><Input value={openingNotes} onChange={(event) => setOpeningNotes(event.target.value)} placeholder="Ejemplo: apertura normal" disabled={saving || loading} /></Field>
              <Button type="submit" disabled={saving || loading || !selectedBranchId}><UnlockKeyhole className="h-4 w-4" /> {saving ? 'Abriendo...' : 'Abrir caja'}</Button>
            </form>
          </Card>
        )
      ) : null}

      {activeView === 'reconciliation' && canSupervise ? <CashJourneyPanel summary={journeySummary} range={journeyRange} onRangeChange={handleJourneyRangeChange} loading={loading} certifying={journeyCertifying} notes={journeyCloseNotes} setNotes={setJourneyCloseNotes} onCertify={handleCertifyJourney} /> : null}
      {activeView === 'history' ? <HistoryTable sessions={sessions} onReport={openReport} /> : null}

      {operationDialog === 'movement' && currentSession ? (
        <WorkspaceDialog label="Movimientos de caja" title="Movimientos de efectivo" description="Registra y revisa ingresos, salidas, gastos y ajustes." icon={Banknote} onClose={() => setOperationDialog(null)} wide>
          {error ? <div className="mb-4"><Message type="error">{error}</Message></div> : null}
          {success ? <div className="mb-4"><Message>{success}</Message></div> : null}
          <MovementsBox session={currentSession} form={movementForm} setForm={setMovementForm} disabled={saving || movementSaving || reviewSaving || closingLocked} onSubmit={handleMovement} onReview={openMovementReview} />
        </WorkspaceDialog>
      ) : null}

      {operationDialog === 'closing' && currentSession && !closingLocked ? (
        <WorkspaceDialog label="Arqueo y cierre de caja" title="Arqueo por denominaciones" description="Cuenta el efectivo. El sistema calculará el total y validará la diferencia." icon={ClipboardCheck} onClose={() => !saving && setOperationDialog(null)} wide>
          <form onSubmit={handleCloseCash} className="cash-counting-form">
            {error ? <Message type="error">{error}</Message> : null}
            <div className="cash-counting-form__total">
              <div><p className="cash-eyebrow">Total contado</p><p className="mt-1 text-3xl font-black">{money(denominationTotal)}</p></div>
              <p className="max-w-sm text-sm font-medium" style={{ color: 'var(--admin-card-muted-text)' }}>Ingresa únicamente la cantidad física de cada billete o moneda.</p>
            </div>
            <div className="cash-denominations">
              {denominationRows.map((entry) => (
                <label key={entry.value} className="cash-denomination">
                  <span><strong>{money(entry.value)}</strong><small>{money(entry.subtotal)}</small></span>
                  <Input type="number" min="0" step="1" inputMode="numeric" aria-label={`Cantidad de ${money(entry.value)}`} value={denominationCounts[entry.value]} onChange={(event) => setDenominationCounts((previous) => ({ ...previous, [entry.value]: event.target.value }))} disabled={saving || movementSaving || reviewSaving || pendingMovementsCount > 0} placeholder="0" />
                </label>
              ))}
            </div>
            <input className="sr-only" type="number" aria-label="Efectivo contado" value={countedCash} readOnly tabIndex={-1} />
            <div className="cash-counting-form__footer">
              <Field label="Observación de cierre"><Textarea value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} placeholder="Ejemplo: cierre sin novedades" disabled={saving || movementSaving || reviewSaving || pendingMovementsCount > 0} /></Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setOperationDialog(null)} disabled={saving}>Cancelar</Button>
                <Button type="submit" disabled={saving || movementSaving || reviewSaving || pendingMovementsCount > 0}><LockKeyhole className="h-4 w-4" /> {saving ? 'Procesando...' : pendingMovementsCount > 0 ? 'Cierre bloqueado' : 'Cerrar caja'}</Button>
              </div>
            </div>
          </form>
        </WorkspaceDialog>
      ) : null}
    </section>
  );
}
