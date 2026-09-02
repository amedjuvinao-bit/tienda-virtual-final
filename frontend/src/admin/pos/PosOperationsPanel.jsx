import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ArchiveRestore,
  Clock3,
  ExternalLink,
  History,
  Loader2,
  PauseCircle,
  ReceiptText,
  Save,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
  closePosHeldSale,
  createPosHeldSale,
  getCurrentPosCustomerSelection,
  getPosHeldSales,
  getPosSalesHistory,
  openPosHeldSale,
} from '../api/adminPosApi';
import PosReceiptActions from './PosReceiptActions';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function money(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function customerName(selection = {}) {
  if (selection.mode === 'existing') {
    return selection.selectedCustomer?.fullName || selection.selectedCustomer?.displayName || 'Cliente existente';
  }
  if (selection.mode === 'quick') {
    return selection.quickCustomer?.fullName || 'Cliente rápido';
  }
  return 'Consumidor final';
}

function orderCustomerName(order = {}) {
  return order.customer?.name || order.customer?.fullName || 'Consumidor final';
}

function statusLabel(status) {
  return {
    paid: 'Pagada',
    processing: 'En proceso',
    pending: 'Pendiente',
    delivered: 'Entregada',
    shipped: 'Enviada',
    cancelled: 'Anulada',
    canceled: 'Anulada',
    refunded: 'Reembolsada',
    failed: 'Fallida',
  }[status] || status || 'Sin estado';
}

function statusStyle(status) {
  if (['paid', 'delivered'].includes(status)) {
    return { background: '#ecfdf5', color: '#047857', borderColor: '#bbf7d0' };
  }
  if (['cancelled', 'canceled', 'refunded', 'failed'].includes(status)) {
    return { background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' };
  }
  return {
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary)',
    borderColor: 'var(--admin-primary-soft-border)',
  };
}

function ActionButton({ children, onClick, disabled = false, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderColor: primary ? 'var(--admin-primary)' : 'var(--admin-card-border)',
        background: primary ? 'var(--admin-primary)' : 'var(--admin-card-bg)',
        color: primary ? 'var(--admin-primary-text)' : 'var(--admin-card-text)',
      }}
    >
      {children}
    </button>
  );
}

function OperationsModal({ view, onViewChange, onClose, children, heldCount }) {
  useEffect(() => {
    if (!view) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [view, onClose]);

  if (!view) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90000] flex min-h-screen items-center justify-center p-3 sm:p-5">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-[4px]" aria-label="Cerrar operaciones POS" />
      <section
        className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border shadow-2xl"
        style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-card-text)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Operaciones comerciales POS"
      >
        <header className="flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--admin-primary)' }}>Centro operativo POS</p>
            <h2 className="mt-1 text-2xl font-black">Continuidad e historial de ventas</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Recupera una venta o consulta su trazabilidad sin abandonar el punto de venta.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)' }} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <nav className="grid grid-cols-2 border-b px-5 pt-3" style={{ borderColor: 'var(--admin-card-border)' }}>
          <button
            type="button"
            onClick={() => onViewChange('held')}
            className="flex items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-black"
            style={{ borderColor: view === 'held' ? 'var(--admin-primary)' : 'transparent', color: view === 'held' ? 'var(--admin-primary)' : 'var(--admin-card-muted-text)' }}
          >
            <PauseCircle className="h-4 w-4" /> Ventas en espera ({heldCount})
          </button>
          <button
            type="button"
            onClick={() => onViewChange('history')}
            className="flex items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-black"
            style={{ borderColor: view === 'history' ? 'var(--admin-primary)' : 'transparent', color: view === 'history' ? 'var(--admin-primary)' : 'var(--admin-card-muted-text)' }}
          >
            <History className="h-4 w-4" /> Historial POS
          </button>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </section>
    </div>,
    document.body
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="rounded-3xl border p-10 text-center" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
      <Icon className="mx-auto h-10 w-10" style={{ color: 'var(--admin-primary)' }} />
      <p className="mt-3 text-base font-black">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>{text}</p>
    </div>
  );
}

export default function PosOperationsPanel({
  branchId,
  branchName,
  cartItems,
  paymentMethod,
  paymentDetails,
  discount,
  permissions = {},
  currentHeldSaleId = '',
  disabled = false,
  onHeld,
  onRestore,
  onDiscardCurrent,
}) {
  const [view, setView] = useState('');
  const [heldSales, setHeldSales] = useState([]);
  const [historySales, setHistorySales] = useState([]);
  const [heldLoading, setHeldLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [discardTarget, setDiscardTarget] = useState(null);

  const loadHeld = async (search = '') => {
    if (!branchId) return;
    try {
      setHeldLoading(true);
      setError('');
      const data = await getPosHeldSales({ branchId, q: search, limit: 40 });
      setHeldSales(Array.isArray(data?.heldSales) ? data.heldSales : []);
    } catch (err) {
      setError(err?.message || 'No fue posible cargar las ventas en espera.');
    } finally {
      setHeldLoading(false);
    }
  };

  const loadHistory = async (search = '') => {
    if (!branchId) return;
    try {
      setHistoryLoading(true);
      setError('');
      const data = await getPosSalesHistory({ branchId, q: search, limit: 40 });
      setHistorySales(Array.isArray(data?.sales) ? data.sales : []);
    } catch (err) {
      setError(err?.message || 'No fue posible cargar el historial POS.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    setHeldSales([]);
    setHistorySales([]);
    setQuery('');
    setError('');
    setMessage('');
    if (branchId) loadHeld();
  }, [branchId]);

  useEffect(() => {
    const refresh = () => loadHeld(query);
    window.addEventListener('pos:held-sales-changed', refresh);
    return () => window.removeEventListener('pos:held-sales-changed', refresh);
  }, [branchId, query]);

  const openView = (nextView) => {
    setView(nextView);
    setQuery('');
    setError('');
    setMessage('');
    if (nextView === 'held') loadHeld();
    else loadHistory();
  };

  const changeView = (nextView) => openView(nextView);

  const saveHeldSale = async () => {
    if (!branchId || cartItems.length === 0) return;
    try {
      setWorkingId('saving');
      setError('');
      const data = await createPosHeldSale({
        branchId,
        items: cartItems,
        customerSelection: getCurrentPosCustomerSelection(),
        paymentMethod,
        paymentDetails,
        discount,
        note: saveNote,
      });
      setSaveDialogOpen(false);
      setSaveNote('');
      setMessage(`Venta ${data?.heldSale?.code || ''} guardada correctamente.`);
      onHeld?.(data?.heldSale || null);
      await loadHeld();
      setView('held');
    } catch (err) {
      setError(err?.message || 'No fue posible guardar la venta en espera.');
    } finally {
      setWorkingId('');
    }
  };

  const restoreHeldSale = async (sale) => {
    try {
      setWorkingId(sale.id);
      setError('');
      const data = await openPosHeldSale(sale.id);
      onRestore?.(data?.heldSale || sale);
      setView('');
    } catch (err) {
      setError(err?.message || 'No fue posible recuperar la venta en espera.');
    } finally {
      setWorkingId('');
    }
  };

  const discardHeldSale = async () => {
    if (!discardTarget?.id) return;
    try {
      setWorkingId(discardTarget.id);
      setError('');
      await closePosHeldSale(discardTarget.id, { reason: 'discarded' });
      if (discardTarget.id === currentHeldSaleId) onDiscardCurrent?.();
      setDiscardTarget(null);
      setMessage('La venta en espera fue descartada y quedó registrada.');
      await loadHeld(query);
    } catch (err) {
      setError(err?.message || 'No fue posible descartar la venta en espera.');
    } finally {
      setWorkingId('');
    }
  };

  const search = (event) => {
    event.preventDefault();
    if (view === 'held') loadHeld(query);
    else loadHistory(query);
  };

  return (
    <>
      <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)', boxShadow: 'var(--admin-shadow-sm, 0 8px 24px rgba(0,0,0,0.06))' }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border" style={{ borderColor: 'var(--admin-primary-soft-border)', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}>
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Continuidad de venta</p>
              <p className="mt-1 text-sm font-black">{currentHeldSaleId ? 'Venta recuperada en edición' : 'Guarda o consulta operaciones POS'}</p>
              <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>{branchName || 'Sede actual'} · El stock se confirma al momento del cobro.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => setSaveDialogOpen(true)} disabled={disabled || cartItems.length === 0 || !permissions.canSell} primary>
              <Save className="h-4 w-4" /> Guardar en espera
            </ActionButton>
            <ActionButton onClick={() => openView('held')} disabled={!branchId}>
              <PauseCircle className="h-4 w-4" /> En espera ({heldSales.length})
            </ActionButton>
            <ActionButton onClick={() => openView('history')} disabled={!branchId}>
              <History className="h-4 w-4" /> Historial
            </ActionButton>
          </div>
        </div>
      </section>

      <OperationsModal view={view} onViewChange={changeView} onClose={() => setView('')} heldCount={heldSales.length}>
        <form onSubmit={search} className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="flex min-h-11 flex-1 items-center gap-3 rounded-2xl border px-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
            <Search className="h-5 w-5 shrink-0" style={{ color: 'var(--admin-card-muted-text)' }} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === 'held' ? 'Buscar por código, nota o cliente' : 'Buscar por orden, cliente, celular o referencia'} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" />
          </div>
          <ActionButton
            primary
            disabled={heldLoading || historyLoading}
            onClick={() => (view === 'held' ? loadHeld(query) : loadHistory(query))}
          >
            Buscar
          </ActionButton>
        </form>

        {message ? <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p> : null}
        {error ? <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}

        {view === 'held' ? (
          heldLoading ? (
            <div className="py-16 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--admin-primary)' }} /><p className="mt-3 text-sm font-bold">Cargando ventas en espera...</p></div>
          ) : heldSales.length === 0 ? (
            <EmptyState icon={PauseCircle} title="No hay ventas en espera" text="Cuando guardes un carrito para atenderlo después, aparecerá aquí para cualquier sesión autorizada de esta sede." />
          ) : (
            <div className="space-y-3">
              {heldSales.map((sale) => (
                <article key={sale.id} className="grid gap-4 rounded-2xl border p-4 lg:grid-cols-[minmax(0,1fr)_170px_auto] lg:items-center" style={{ borderColor: sale.id === currentHeldSaleId ? 'var(--admin-primary)' : 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-base">{sale.code}</strong>
                      {sale.id === currentHeldSaleId ? <span className="rounded-full px-2 py-1 text-[10px] font-black uppercase" style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}>En edición</span> : null}
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-sm font-bold"><UserRound className="h-4 w-4" /> {customerName(sale.customerSelection)}</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>{sale.totalItems} unidad(es) · {sale.items.length} producto(s) · {formatDate(sale.updatedAt)}</p>
                    {sale.note ? <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>{sale.note}</p> : null}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>Subtotal guardado</p>
                    <p className="mt-1 text-lg font-black" style={{ color: 'var(--admin-primary)' }}>{money(sale.subtotal)}</p>
                    <p className="mt-1 text-[11px] font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>Se recalcula al cobrar</p>
                  </div>
                  <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                    <ActionButton primary onClick={() => restoreHeldSale(sale)} disabled={Boolean(workingId)}><ArchiveRestore className="h-4 w-4" /> {workingId === sale.id ? 'Cargando...' : 'Recuperar'}</ActionButton>
                    <ActionButton onClick={() => setDiscardTarget(sale)} disabled={Boolean(workingId)}><Trash2 className="h-4 w-4" /> Descartar</ActionButton>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : historyLoading ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--admin-primary)' }} /><p className="mt-3 text-sm font-bold">Cargando historial POS...</p></div>
        ) : historySales.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No hay ventas POS para estos filtros" text="Las ventas confirmadas de esta sede aparecerán aquí con sus comprobantes y acceso a la gestión completa de la orden." />
        ) : (
          <div className="space-y-3">
            {historySales.map((order) => (
              <article key={order.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_150px_170px_minmax(250px,auto)] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-base">Orden {order.orderNumber}</strong>
                      <span className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase" style={statusStyle(order.status)}>{statusLabel(order.status)}</span>
                    </div>
                    <p className="mt-1 text-sm font-bold">{orderCustomerName(order)}</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>{formatDate(order.createdAt)} · {order.totalItems} unidad(es) · {order.payment?.methodLabel || order.payment?.method || 'Pago POS'}</p>
                  </div>
                  <div><p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>Total</p><p className="mt-1 text-lg font-black" style={{ color: 'var(--admin-primary)' }}>{money(order.total)}</p></div>
                  <div><p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>Cajero</p><p className="mt-1 text-sm font-black">{order.cashier?.displayName || order.cashier?.username || 'Sin registro'}</p></div>
                  <div className="space-y-2 xl:text-right">
                    {permissions.canReceipt ? <PosReceiptActions compact sale={{ order }} /> : <p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Sin permiso para comprobantes</p>}
                    {permissions.canManageOrders ? (
                      <Link to={`/admin/ordenes?q=${encodeURIComponent(order.orderNumber)}&openOrder=${order.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)', background: 'var(--admin-card-bg)' }}>
                        <ExternalLink className="h-4 w-4" />
                        {permissions.canRefundOrders || permissions.canUpdateOrderStatus
                          ? 'Gestionar devolución o anulación'
                          : 'Abrir orden'}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </OperationsModal>

      <ConfirmDialog
        show={saveDialogOpen}
        onClose={() => { if (!workingId) setSaveDialogOpen(false); }}
        onConfirm={saveHeldSale}
        title="Guardar venta en espera"
        message="La venta quedará disponible para recuperarla en esta sede. El inventario no se reserva y se validará nuevamente al cobrar."
        confirmLabel="Guardar venta"
        cancelLabel="Volver"
        tone="info"
        loading={workingId === 'saving'}
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>La venta quedará disponible para recuperarla en esta sede. El inventario no se reserva y se validará nuevamente al cobrar.</p>
        <label htmlFor="pos-held-note" className="mt-4 block text-sm font-black">Nota de identificación (opcional)</label>
        <input id="pos-held-note" value={saveNote} onChange={(event) => setSaveNote(event.target.value)} maxLength={240} placeholder="Ejemplo: Cliente regresa a las 4:00 p. m." className="mt-2 w-full rounded-2xl border bg-transparent px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }} />
      </ConfirmDialog>

      <ConfirmDialog
        show={Boolean(discardTarget)}
        onClose={() => { if (!workingId) setDiscardTarget(null); }}
        onConfirm={discardHeldSale}
        title={`Descartar ${discardTarget?.code || 'venta en espera'}`}
        message="Se retirará de la lista activa, pero la acción quedará registrada. No afecta inventario porque esta venta aún no fue cobrada."
        confirmLabel="Sí, descartar"
        cancelLabel="Conservar"
        tone="warning"
        loading={workingId === discardTarget?.id}
      />
    </>
  );
}
