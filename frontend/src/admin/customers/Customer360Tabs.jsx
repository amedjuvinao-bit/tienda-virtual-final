import React from 'react';
import {
  Activity,
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  CreditCard,
  ExternalLink,
  FileCheck2,
  Loader2,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Truck,
  WalletCards,
} from 'lucide-react';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const STATUS_LABELS = {
  accepted: 'Aceptada',
  active: 'Activo',
  action_required: 'Requiere acción',
  approved: 'Aprobado',
  authorized: 'Autorizada',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
  completed: 'Completado',
  consumed: 'Consumido',
  converted: 'Convertido',
  declined: 'Rechazado',
  delivered: 'Entregado',
  depleted: 'Agotado',
  done: 'Realizado',
  error: 'Error',
  expired: 'Vencido',
  failed: 'Fallido',
  generated: 'Generada',
  in_transit: 'En tránsito',
  inactive: 'Inactivo',
  issued: 'Emitido',
  paid: 'Pagado',
  pending: 'Pendiente',
  pending_gateway: 'Esperando pasarela',
  pending_manual: 'Confirmación manual',
  processed: 'Procesado',
  processing: 'Procesando',
  recoverable: 'Recuperable',
  reconciliation_pending: 'Conciliación pendiente',
  rejected: 'Rechazada',
  released: 'Liberado',
  requested: 'Solicitada',
  reserved: 'Reservado',
  resolved: 'Resuelta',
  sent: 'Enviada',
  shipped: 'Despachado',
  succeeded: 'Exitoso',
  validated: 'Validada',
};

const SUCCESS_STATUSES = new Set([
  'accepted',
  'active',
  'approved',
  'completed',
  'consumed',
  'converted',
  'delivered',
  'done',
  'generated',
  'paid',
  'processed',
  'resolved',
  'sent',
  'shipped',
  'succeeded',
  'validated',
]);
const DANGER_STATUSES = new Set([
  'cancelled',
  'canceled',
  'declined',
  'error',
  'failed',
  'rejected',
]);

function money(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatDate(value, includeTime = false) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Sin registro';
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function statusLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return STATUS_LABELS[normalized] || normalized.replaceAll('_', ' ') || 'Sin estado';
}

function StatusBadge({ value }) {
  const normalized = String(value || '').trim().toLowerCase();
  const success = SUCCESS_STATUSES.has(normalized);
  const danger = DANGER_STATUSES.has(normalized);
  const colors = success
    ? { color: '#047857', background: '#ecfdf5', borderColor: '#bbf7d0' }
    : danger
      ? { color: '#b91c1c', background: '#fef2f2', borderColor: '#fecaca' }
      : { color: '#c2410c', background: '#fff7ed', borderColor: '#fed7aa' };
  return (
    <span className="inline-flex rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide" style={colors}>
      {statusLabel(normalized)}
    </span>
  );
}

function Metric({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="mt-2 text-xl font-black" style={{ color: 'var(--admin-card-text)' }}>{value}</p>
      {helper ? <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{helper}</p> : null}
    </div>
  );
}

function Empty({ children }) {
  return (
    <div className="rounded-3xl border bg-white p-8 text-center text-sm font-bold" style={{ borderColor: 'rgba(236,72,153,0.16)', color: 'var(--admin-card-muted-text)' }}>
      {children}
    </div>
  );
}

function SectionTitle({ title, description }) {
  return (
    <div>
      <h3 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>{title}</h3>
      <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>{description}</p>
    </div>
  );
}

function OrderLink({ orderId, orderNumber, children = 'Abrir orden' }) {
  if (!orderId && !orderNumber) return null;
  const params = new URLSearchParams();
  if (orderNumber) params.set('q', orderNumber);
  if (orderId) params.set('openOrder', orderId);
  return (
    <a href={`/admin/ordenes?${params.toString()}`} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-black" style={{ borderColor: 'rgba(236,72,153,0.24)', color: 'var(--admin-primary)', background: '#fff' }}>
      <ExternalLink className="h-3.5 w-3.5" /> {children}
    </a>
  );
}

function Restricted({ label }) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-black">Información protegida</p>
          <p className="mt-1 text-sm">Tu rol puede consultar el cliente, pero no tiene permiso para ver {label}.</p>
        </div>
      </div>
    </div>
  );
}

function PaymentsTab({ data }) {
  if (!data.access?.payments) return <Restricted label="pagos" />;
  const summary = data.summary?.payments || {};
  const payments = data.payments || [];
  return (
    <div className="space-y-4">
      <SectionTitle title="Pagos del cliente" description="Estado por orden, método, pasarela e intentos de cobro." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={BadgeCheck} label="Pagados" value={summary.paid || 0} />
        <Metric icon={CalendarClock} label="Pendientes" value={summary.pending || 0} />
        <Metric icon={AlertCircle} label="Fallidos" value={summary.failed || 0} helper={`${summary.declinedAttempts || 0} intentos rechazados`} />
        <Metric icon={RefreshCw} label="Conciliación" value={summary.reconciliationRequired || 0} helper={`${summary.attempts || 0} intentos registrados`} />
      </div>
      {!payments.length ? <Empty>No hay pagos asociados a este cliente.</Empty> : (
        <div className="space-y-3">
          {payments.map((item) => (
            <article key={item.id} className="grid gap-3 rounded-3xl border bg-white p-4 lg:grid-cols-[1fr_0.8fr_0.8fr_auto] lg:items-center" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
              <div>
                <p className="font-black" style={{ color: 'var(--admin-card-text)' }}>Orden {item.orderNumber}</p>
                <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{item.providerLabel || item.provider || 'Sin pasarela'} · {item.methodLabel || item.method || 'Método sin registrar'}</p>
              </div>
              <div><StatusBadge value={item.status} /><p className="mt-2 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{item.attempts?.length || 0} intento(s)</p></div>
              <div><p className="text-base font-black" style={{ color: 'var(--admin-primary)' }}>{money(item.amount)}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{item.paidAt ? formatDate(item.paidAt) : 'Sin fecha de pago'}</p></div>
              <OrderLink orderId={item.orderId} orderNumber={item.orderNumber} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function BillingTab({ data }) {
  if (!data.access?.billing) return <Restricted label="facturación electrónica" />;
  const summary = data.summary?.billing || {};
  const invoices = data.invoices || [];
  return (
    <div className="space-y-4">
      <SectionTitle title="Facturación y notas crédito" description="Documentos electrónicos conectados con cada orden." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={FileCheck2} label="Facturas" value={summary.invoices || 0} />
        <Metric icon={BadgeCheck} label="Aceptadas" value={summary.accepted || 0} />
        <Metric icon={CalendarClock} label="Pendientes" value={summary.pending || 0} />
        <Metric icon={ReceiptText} label="Notas crédito" value={summary.creditNotes || 0} helper={money(summary.creditNoteAmount)} />
      </div>
      {!invoices.length ? <Empty>No hay facturas electrónicas asociadas.</Empty> : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <article key={invoice.id} className="rounded-3xl border bg-white p-4" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-black" style={{ color: 'var(--admin-card-text)' }}>{invoice.invoiceNumber || `Factura de ${invoice.orderNumber}`}</p><StatusBadge value={invoice.status} /></div>
                  <p className="mt-2 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Orden {invoice.orderNumber} · {invoice.provider || 'Proveedor sin registrar'} · {formatDate(invoice.acceptedAt || invoice.generatedAt)}</p>
                  <p className="mt-2 text-base font-black" style={{ color: 'var(--admin-primary)' }}>{money(invoice.total)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {invoice.pdfUrl ? <a href={invoice.pdfUrl} target="_blank" rel="noreferrer" className="rounded-xl border px-3 py-2 text-[11px] font-black" style={{ borderColor: 'rgba(236,72,153,0.24)', color: 'var(--admin-primary)' }}>PDF</a> : null}
                  {invoice.xmlUrl ? <a href={invoice.xmlUrl} target="_blank" rel="noreferrer" className="rounded-xl border px-3 py-2 text-[11px] font-black" style={{ borderColor: 'rgba(236,72,153,0.24)', color: 'var(--admin-primary)' }}>XML</a> : null}
                  <OrderLink orderId={invoice.orderId} orderNumber={invoice.orderNumber} />
                </div>
              </div>
              {invoice.creditNotes?.length ? (
                <div className="mt-4 space-y-2 rounded-2xl border p-3" style={{ borderColor: 'rgba(236,72,153,0.14)', background: '#fff7fb' }}>
                  <p className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--admin-card-muted-text)' }}>Notas crédito</p>
                  {invoice.creditNotes.map((note) => (
                    <div key={note.id || note.referenceCode} className="flex flex-col gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{note.number || note.referenceCode || 'Nota crédito'}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{note.reason || formatDate(note.createdAt)}</p></div>
                      <div className="flex items-center gap-3"><StatusBadge value={note.status} /><span className="text-sm font-black" style={{ color: 'var(--admin-primary)' }}>{money(note.amount)}</span></div>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ReturnsTab({ data }) {
  if (!data.access?.returns) return <Restricted label="devoluciones y reembolsos" />;
  const summary = data.summary?.returns || {};
  const returns = data.returns || [];
  const refunds = data.refunds || [];
  return (
    <div className="space-y-4">
      <SectionTitle title="Devoluciones, garantías y reembolsos" description="Casos RMA y conciliación económica conectados con la compra." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={RotateCcw} label="Casos" value={summary.total || 0} />
        <Metric icon={CalendarClock} label="Activos" value={summary.active || 0} />
        <Metric icon={PackageCheck} label="Resueltos" value={summary.resolved || 0} />
        <Metric icon={CreditCard} label="Reembolsado" value={money(summary.refundedAmount)} helper={`${summary.refunds || 0} reembolso(s)`} />
      </div>
      {!returns.length && !refunds.length ? <Empty>No hay devoluciones ni reembolsos asociados.</Empty> : null}
      {returns.map((item) => (
        <article key={item.id} className="grid gap-3 rounded-3xl border bg-white p-4 lg:grid-cols-[1fr_0.8fr_0.8fr_auto] lg:items-center" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
          <div><p className="font-black" style={{ color: 'var(--admin-card-text)' }}>{item.returnNumber}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Orden {item.orderNumber} · {item.itemsCount} producto(s) · {item.requestedUnits} unidad(es)</p></div>
          <div><StatusBadge value={item.status} /><p className="mt-2 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{statusLabel(item.requestedResolution)}</p></div>
          <div><p className="text-sm font-black" style={{ color: 'var(--admin-primary)' }}>{money(item.resolution?.amount || item.estimatedAmount)}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatDate(item.resolvedAt || item.requestedAt)}</p></div>
          <OrderLink orderId={item.orderId} orderNumber={item.orderNumber} />
        </article>
      ))}
      {refunds.length ? (
        <div className="rounded-3xl border bg-white p-4" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
          <p className="mb-3 text-xs font-black uppercase tracking-wide" style={{ color: 'var(--admin-card-muted-text)' }}>Reembolsos</p>
          <div className="space-y-2">{refunds.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'rgba(236,72,153,0.12)' }}><div><p className="text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{item.refundNumber}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Orden {item.orderNumber} · Conciliación: {statusLabel(item.reconciliation?.state)}</p></div><div className="flex flex-wrap items-center gap-3"><StatusBadge value={item.status} /><span className="font-black" style={{ color: 'var(--admin-primary)' }}>{money(item.amount)}</span><OrderLink orderId={item.orderId} orderNumber={item.orderNumber} /></div></div>)}</div>
        </div>
      ) : null}
    </div>
  );
}

function ShippingTab({ data }) {
  if (!data.access?.shipping) return <Restricted label="envíos" />;
  const summary = data.summary?.shipping || {};
  const shipments = data.shipments || [];
  return (
    <div className="space-y-4">
      <SectionTitle title="Envíos y entregas" description="Guías, transportadoras, SLA e incidencias logísticas." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Truck} label="Envíos" value={summary.total || 0} />
        <Metric icon={CalendarClock} label="En curso" value={summary.active || 0} />
        <Metric icon={PackageCheck} label="Entregados" value={summary.delivered || 0} />
        <Metric icon={AlertCircle} label="Alertas" value={(summary.incidents || 0) + (summary.slaBreaches || 0)} helper={`${summary.slaBreaches || 0} SLA vencido(s)`} />
      </div>
      {!shipments.length ? <Empty>No hay envíos asociados.</Empty> : shipments.map((item) => (
        <article key={`${item.orderId}-${item.id}`} className="grid gap-3 rounded-3xl border bg-white p-4 lg:grid-cols-[1fr_0.9fr_0.8fr_auto] lg:items-center" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
          <div><p className="font-black" style={{ color: 'var(--admin-card-text)' }}>{item.code || `Envío de ${item.orderNumber}`}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Orden {item.orderNumber} · {item.branch?.name || item.branch?.code || 'Sede sin registrar'}</p></div>
          <div><StatusBadge value={item.status} /><p className="mt-2 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{item.carrier?.name || 'Transportadora sin registrar'}</p></div>
          <div><p className="text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{item.carrier?.trackingNumber || 'Sin guía'}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{item.incidentCount || 0} incidencia(s)</p></div>
          <div className="flex flex-wrap gap-2">{item.carrier?.trackingUrl ? <a href={item.carrier.trackingUrl} target="_blank" rel="noreferrer" className="rounded-xl border px-3 py-2 text-[11px] font-black" style={{ borderColor: 'rgba(236,72,153,0.24)', color: 'var(--admin-primary)' }}>Rastrear</a> : null}<OrderLink orderId={item.orderId} orderNumber={item.orderNumber} /></div>
        </article>
      ))}
    </div>
  );
}

function CartsTab({ data }) {
  if (!data.access?.carts) return <Restricted label="carritos" />;
  const summary = data.summary?.carts || {};
  const carts = data.carts || [];
  return (
    <div className="space-y-4">
      <SectionTitle title="Carritos del cliente" description="Actividad de compra, abandono, recuperación y conversión." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={ShoppingCart} label="Carritos" value={summary.total || 0} />
        <Metric icon={Activity} label="Activos" value={summary.active || 0} />
        <Metric icon={AlertCircle} label="Abandonados" value={summary.abandoned || 0} helper={`${summary.recoverable || 0} recuperable(s)`} />
        <Metric icon={CreditCard} label="Valor abierto" value={money(summary.openValue)} helper={`${summary.converted || 0} convertido(s)`} />
      </div>
      {!carts.length ? <Empty>No hay carritos identificados para este cliente.</Empty> : carts.map((item) => (
        <article key={item.id} className="grid gap-3 rounded-3xl border bg-white p-4 lg:grid-cols-[1fr_0.7fr_0.8fr_auto] lg:items-center" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
          <div><p className="font-black" style={{ color: 'var(--admin-card-text)' }}>Carrito {item.sessionId}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatDate(item.lastActivityAt, true)} · {item.recoveryAttempts || 0} gestión(es)</p></div>
          <StatusBadge value={item.lifecycle} />
          <div><p className="font-black" style={{ color: 'var(--admin-primary)' }}>{money(item.subtotal)}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{item.units} unidad(es)</p></div>
          {item.convertedOrderId ? <OrderLink orderId={item.convertedOrderId} /> : null}
        </article>
      ))}
    </div>
  );
}

function StoreCreditTab({ data }) {
  if (!data.access?.storeCredit) return <Restricted label="saldos a favor" />;
  const summary = data.summary?.storeCredit || {};
  const credits = data.storeCredits || [];
  const usages = data.storeCreditUsages || [];
  return (
    <div className="space-y-4">
      <SectionTitle title="Saldos a favor" description="Créditos emitidos por devoluciones y su utilización en nuevas compras." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={WalletCards} label="Saldo vigente" value={money(summary.activeBalance)} helper={`${summary.activeCredits || 0} crédito(s) activo(s)`} />
        <Metric icon={ReceiptText} label="Total emitido" value={money(summary.issued)} />
        <Metric icon={BadgeCheck} label="Total utilizado" value={money(summary.consumed)} />
      </div>
      {!credits.length && !usages.length ? <Empty>El cliente no tiene saldos a favor.</Empty> : null}
      {credits.map((item) => (
        <article key={item.id} className="grid gap-3 rounded-3xl border bg-white p-4 lg:grid-cols-[1fr_0.7fr_0.8fr_auto] lg:items-center" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
          <div><p className="font-black" style={{ color: 'var(--admin-card-text)' }}>{item.creditNumber}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Emitido {formatDate(item.issuedAt)} · Vence {formatDate(item.expiresAt)}</p></div>
          <StatusBadge value={item.status} />
          <div><p className="font-black" style={{ color: 'var(--admin-primary)' }}>{money(item.balance)}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>de {money(item.originalAmount)}</p></div>
          <OrderLink orderId={item.sourceOrderId} orderNumber={item.sourceOrderNumber} />
        </article>
      ))}
      {usages.length ? <div className="rounded-3xl border bg-white p-4" style={{ borderColor: 'rgba(236,72,153,0.16)' }}><p className="mb-3 text-xs font-black uppercase tracking-wide" style={{ color: 'var(--admin-card-muted-text)' }}>Usos del saldo</p><div className="space-y-2">{usages.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'rgba(236,72,153,0.12)' }}><div><p className="text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>Orden {item.orderNumber}</p><p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatDate(item.consumedAt || item.releasedAt || item.reservedAt)}</p></div><div className="flex flex-wrap items-center gap-3"><StatusBadge value={item.status} /><span className="font-black" style={{ color: 'var(--admin-primary)' }}>{money(item.amount)}</span><OrderLink orderId={item.orderId} orderNumber={item.orderNumber} /></div></div>)}</div></div> : null}
    </div>
  );
}

function ActivityTab({ data }) {
  if (!data.access?.activity) return <Restricted label="la actividad operativa" />;
  const activity = data.activity || [];
  return (
    <div className="space-y-4">
      <SectionTitle title="Actividad completa" description="Cronología unificada de compras, pagos, documentos, devoluciones, envíos, carritos y saldos." />
      {!activity.length ? <Empty>No hay actividad operativa asociada.</Empty> : (
        <div className="space-y-2">
          {activity.map((item, index) => (
            <article key={`${item.type}-${item.occurredAt}-${index}`} className="grid gap-3 rounded-2xl border bg-white p-4 lg:grid-cols-[150px_1fr_130px_auto] lg:items-center" style={{ borderColor: 'rgba(236,72,153,0.14)' }}>
              <p className="text-xs font-black" style={{ color: 'var(--admin-card-muted-text)' }}>{formatDate(item.occurredAt, true)}</p>
              <div><p className="text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{item.title}</p>{item.detail ? <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{item.detail}</p> : null}</div>
              <div><StatusBadge value={item.status} />{item.amount != null ? <p className="mt-2 text-xs font-black" style={{ color: 'var(--admin-primary)' }}>{money(item.amount)}</p> : null}</div>
              <OrderLink orderId={item.orderId} orderNumber={item.orderNumber} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export const CUSTOMER_360_TABS = new Set([
  'payments',
  'billing',
  'returns',
  'shipping',
  'carts',
  'credit',
  'activity',
]);

export function Customer360TabContent({ activeTab, data, loading, error, onRetry }) {
  if (!CUSTOMER_360_TABS.has(activeTab)) return null;
  if (loading) {
    return <div className="flex h-full items-center justify-center rounded-3xl border bg-white" style={{ borderColor: 'rgba(236,72,153,0.18)' }}><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--admin-primary)' }} /><p className="mt-3 font-black">Construyendo ficha 360°...</p></div></div>;
  }
  if (error) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5" /><div><p className="font-black">No se pudo cargar la ficha 360°</p><p className="mt-1 text-sm">{error}</p><button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black"><RefreshCw className="h-4 w-4" /> Reintentar</button></div></div></div>;
  }
  if (!data) return <Empty>Selecciona una sección para cargar la ficha 360°.</Empty>;

  const content = {
    payments: <PaymentsTab data={data} />,
    billing: <BillingTab data={data} />,
    returns: <ReturnsTab data={data} />,
    shipping: <ShippingTab data={data} />,
    carts: <CartsTab data={data} />,
    credit: <StoreCreditTab data={data} />,
    activity: <ActivityTab data={data} />,
  }[activeTab];

  return (
    <div className="h-full overflow-y-auto pr-1">
      {data.coverage?.truncated ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">Se muestran las {data.coverage.loadedOrders} compras más recientes de {data.coverage.totalOrders}. Los totales indican la cobertura cargada.</div> : null}
      {content}
    </div>
  );
}
