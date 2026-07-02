// frontend/src/admin/inventory/components/InventoryReservationsPanel.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  TimerReset,
  X,
  XCircle,
} from 'lucide-react';
import api from '../../../lib/api';

const RESERVATION_STATUS_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'failed', label: 'Fallidas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'expired', label: 'Vencidas' },
  { value: 'released', label: 'Liberadas' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'expiredPending', label: 'Pendientes vencidas' },
];

const RESERVATION_STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  released: 'Liberada',
  expired: 'Vencida',
  cancelled: 'Cancelada',
  failed: 'Fallida',
};

const RESERVATION_STATUS_STYLES = {
  pending: {
    border: '1px solid var(--admin-warning)',
    background: 'var(--admin-warning-soft-bg)',
    color: 'var(--admin-warning-text)',
  },
  confirmed: {
    border:
      '1px solid color-mix(in srgb, var(--admin-success, #22c55e) 60%, var(--admin-card-border))',
    background:
      'color-mix(in srgb, var(--admin-success, #22c55e) 12%, var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
  },
  released: {
    border: '1px solid var(--admin-button-soft-border)',
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
  },
  expired: {
    border: '1px solid var(--admin-danger)',
    background: 'var(--admin-danger-soft-bg)',
    color: 'var(--admin-danger-text)',
  },
  cancelled: {
    border: '1px solid var(--admin-danger)',
    background: 'var(--admin-danger-soft-bg)',
    color: 'var(--admin-danger-text)',
  },
  failed: {
    border: '1px solid var(--admin-danger)',
    background: 'var(--admin-danger-soft-bg)',
    color: 'var(--admin-danger-text)',
  },
};

const styles = {
  triggerButton: {
    borderRadius: '999px',
    border: '1px solid color-mix(in srgb, var(--admin-primary) 42%, rgba(255, 255, 255, 0.28))',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-primary) 82%, rgba(255, 255, 255, 0.46)), color-mix(in srgb, var(--admin-primary) 38%, rgba(255, 255, 255, 0.14)) 54%, color-mix(in srgb, var(--admin-card-bg) 60%, var(--admin-primary) 40%))',
    color: 'var(--admin-button-text)',
    boxShadow:
      '0 16px 34px color-mix(in srgb, var(--admin-primary) 34%, transparent), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(255,255,255,0.10)',
    backdropFilter: 'blur(16px) saturate(185%)',
    WebkitBackdropFilter: 'blur(16px) saturate(185%)',
    textShadow: '0 1px 12px rgba(255,255,255,0.24)',
  },

  triggerShine: {
    position: 'absolute',
    inset: '1px auto 1px -48%',
    width: '44%',
    borderRadius: 'inherit',
    background:
      'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.42) 45%, transparent 100%)',
    transform: 'skewX(-18deg)',
    opacity: 0.72,
    pointerEvents: 'none',
  },

  overlay: {
    background:
      'color-mix(in srgb, var(--admin-page-bg, #0f172a) 54%, transparent)',
    backdropFilter: 'blur(12px)',
  },

  modal: {
    borderRadius: 'calc(var(--admin-radius) + 14px)',
    border: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 96%, var(--admin-primary) 4%), var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
    boxShadow:
      '0 34px 110px color-mix(in srgb, var(--admin-primary) 18%, rgba(15, 23, 42, 0.45))',
  },

  title: {
    color: 'var(--admin-card-text)',
  },

  muted: {
    color: 'var(--admin-card-muted-text)',
  },

  eyebrow: {
    color: 'var(--admin-primary)',
  },

  closeButton: {
    borderRadius: '999px',
    border: '1px solid var(--admin-button-soft-border)',
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
  },

  helpBox: {
    borderRadius: 'calc(var(--admin-radius) + 6px)',
    border: '1px solid var(--admin-primary-soft-border)',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-primary-soft-bg) 82%, var(--admin-card-bg) 18%), var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
  },

  helpItem: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-card-border)',
    background: 'color-mix(in srgb, var(--admin-card-bg) 90%, var(--admin-primary) 10%)',
  },

  filterCard: {
    borderRadius: 'calc(var(--admin-radius) + 4px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-glass-bg)',
    color: 'var(--admin-card-text)',
  },

  input: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-input-border)',
    background: 'var(--admin-input-bg)',
    color: 'var(--admin-input-text)',
    outline: 'none',
  },

  primaryButton: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-button-bg)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-text)',
    boxShadow:
      '0 12px 26px color-mix(in srgb, var(--admin-primary) 22%, transparent)',
  },

  softButton: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-button-soft-border)',
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
  },

  statCard: {
    borderRadius: 'calc(var(--admin-radius) + 6px)',
    border: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 92%, var(--admin-primary) 8%), var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
    boxShadow:
      '0 16px 36px color-mix(in srgb, var(--admin-primary) 9%, transparent)',
  },

  list: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-glass-bg)',
    overflow: 'hidden',
  },

  listHeader: {
    borderBottom: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(90deg, var(--admin-table-head-bg), color-mix(in srgb, var(--admin-table-head-bg) 86%, var(--admin-primary) 14%))',
    color: 'var(--admin-table-head-text)',
  },

  reservationCard: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 94%, var(--admin-primary) 6%), var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
    boxShadow:
      '0 12px 28px color-mix(in srgb, var(--admin-primary) 8%, transparent)',
  },

  badge: {
    borderRadius: '999px',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary-soft-text)',
    whiteSpace: 'nowrap',
  },

  valuePill: {
    borderRadius: '999px',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
    whiteSpace: 'nowrap',
  },

  errorBox: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-danger)',
    background: 'var(--admin-danger-soft-bg)',
    color: 'var(--admin-danger-text)',
  },

  itemBox: {
    borderRadius: 'calc(var(--admin-radius) + 2px)',
    border: '1px solid var(--admin-card-border)',
    background:
      'color-mix(in srgb, var(--admin-card-bg) 90%, var(--admin-primary) 10%)',
  },
};

function formatNumber(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat('es-CO').format(number);
}

function formatMoney(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(number);
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getStatusLabel(status) {
  return RESERVATION_STATUS_LABELS[status] || status || 'Sin estado';
}

function getStatusStyle(status) {
  return RESERVATION_STATUS_STYLES[status] || styles.badge;
}

function getReservationItems(reservation) {
  return Array.isArray(reservation?.items) ? reservation.items : [];
}

function getProductTitle(item) {
  return (
    item?.productSnapshot?.title ||
    item?.product?.title ||
    item?.title ||
    'Producto sin nombre'
  );
}

function getProductSku(item) {
  return item?.productSnapshot?.sku || item?.product?.sku || item?.sku || '—';
}

function getBranchName(item) {
  return (
    item?.branchSnapshot?.name ||
    item?.branch?.name ||
    item?.branchName ||
    'Sede no definida'
  );
}

function getBranchCode(item) {
  return item?.branchSnapshot?.code || item?.branch?.code || '';
}

function getReservationDateLabel(reservation) {
  if (reservation?.status === 'confirmed') {
    return {
      label: 'Confirmada',
      value: formatDate(reservation.confirmedAt),
    };
  }

  if (reservation?.status === 'failed') {
    return {
      label: 'Fallida',
      value: formatDate(reservation.failedAt),
    };
  }

  if (reservation?.status === 'expired') {
    return {
      label: 'Vencida',
      value: formatDate(reservation.expiredAt),
    };
  }

  if (reservation?.status === 'released') {
    return {
      label: 'Liberada',
      value: formatDate(reservation.releasedAt),
    };
  }

  if (reservation?.status === 'cancelled') {
    return {
      label: 'Cancelada',
      value: formatDate(reservation.cancelledAt),
    };
  }

  return {
    label: 'Vence',
    value: formatDate(reservation?.expiresAt),
  };
}

export default function InventoryReservationsPanel() {
  const [open, setOpen] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [summary, setSummary] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [typingSearch, setTypingSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadReservations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        limit: 50,
        sort: '-createdAt',
      };

      if (statusFilter && statusFilter !== 'all' && statusFilter !== 'expiredPending') {
        params.status = statusFilter;
      }

      if (statusFilter === 'expiredPending') {
        params.expired = true;
      }

      if (searchTerm.trim()) {
        params.q = searchTerm.trim();
      }

      const response = await api.get('/api/admin/inventory/reservations', {
        params,
      });

      setReservations(Array.isArray(response?.data?.data) ? response.data.data : []);
      setSummary(response?.data?.summary || {});
    } catch (err) {
      console.error('❌ Error cargando reservas de inventario:', err);

      setError(
        err?.response?.data?.message ||
          err?.userMessage ||
          'No se pudieron cargar las reservas de inventario.'
      );
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    if (!open) return;

    loadReservations();
  }, [loadReservations, open]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const stats = useMemo(() => {
    return [
      {
        label: 'Confirmadas',
        value: summary?.confirmed || 0,
        icon: <CheckCircle2 size={18} />,
      },
      {
        label: 'Fallidas',
        value: summary?.failed || 0,
        icon: <XCircle size={18} />,
      },
      {
        label: 'Pendientes',
        value: summary?.pending || 0,
        icon: <Clock size={18} />,
      },
      {
        label: 'Vencidas',
        value: summary?.expired || 0,
        icon: <AlertCircle size={18} />,
      },
    ];
  }, [summary]);

  const hasActiveSearch = typingSearch.trim() !== '' || searchTerm.trim() !== '';

  const applySearch = () => {
    setSearchTerm(typingSearch.trim());
  };

  const clearSearch = () => {
    setTypingSearch('');
    setSearchTerm('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex shrink-0 items-center gap-2 overflow-hidden px-5 py-3 text-sm font-black transition hover:brightness-110"
        style={styles.triggerButton}
      >
        <span aria-hidden="true" style={styles.triggerShine} />
        <ShieldCheck size={16} className="relative z-10" />
        <span className="relative z-10">Ver reservas</span>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={styles.overlay}
          >
            <section
              className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden"
              style={styles.modal}
            >
              <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--admin-card-border)] p-5">
                <div>
                  <p
                    className="text-xs font-black uppercase tracking-[0.22em]"
                    style={styles.eyebrow}
                  >
                    Reservas de inventario
                  </p>

                  <h2 className="mt-2 text-xl font-black" style={styles.title}>
                    Control de reservas
                  </h2>

                  <p className="mt-2 max-w-3xl text-sm leading-6" style={styles.muted}>
                    Revisa las unidades que el sistema aparta temporalmente cuando una orden
                    entra al flujo de pago. Esto permite saber qué stock está comprometido,
                    qué se confirmó como venta y qué fue liberado por pago fallido o vencimiento.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center transition"
                  style={styles.closeButton}
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {error && (
                  <div
                    className="mb-5 flex items-start gap-3 px-4 py-3 text-sm"
                    style={styles.errorBox}
                  >
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="mb-5 p-4" style={styles.helpBox}>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                        style={styles.badge}
                      >
                        <HelpCircle size={20} />
                      </div>

                      <div>
                        <h3 className="text-sm font-black" style={styles.title}>
                          ¿Cómo funciona esta reserva?
                        </h3>

                        <p className="mt-1 text-sm leading-6" style={styles.muted}>
                          Cuando el cliente crea una orden, el sistema no descuenta todavía
                          el stock físico. Primero aparta la cantidad como reserva. Si el pago
                          se aprueba, la reserva se confirma y ahí sí se descuenta el inventario.
                          Si el pago falla o vence, la reserva se libera.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <HelpStep
                      icon={<Clock size={16} />}
                      title="1. Pendiente"
                      text="La orden apartó unidades. El stock físico sigue igual, pero el disponible baja."
                    />

                    <HelpStep
                      icon={<CheckCircle2 size={16} />}
                      title="2. Confirmada"
                      text="El pago fue aprobado. El sistema descuenta el stock físico y crea salida por venta."
                    />

                    <HelpStep
                      icon={<TimerReset size={16} />}
                      title="3. Fallida o vencida"
                      text="El pago no se completó. El sistema libera la reserva y el disponible vuelve a subir."
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {stats.map((stat) => (
                    <div key={stat.label} className="p-4" style={styles.statCard}>
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className="text-xs font-black uppercase tracking-wide"
                          style={styles.muted}
                        >
                          {stat.label}
                        </p>

                        <span style={styles.eyebrow}>{stat.icon}</span>
                      </div>

                      <p className="mt-3 text-2xl font-black" style={styles.title}>
                        {formatNumber(stat.value)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 p-4" style={styles.filterCard}>
                  <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto_auto] lg:items-end">
                    <div>
                      <label
                        className="text-xs font-black uppercase tracking-wide"
                        style={styles.muted}
                      >
                        Estado
                      </label>

                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="mt-2 w-full px-4 py-3 text-sm font-semibold transition"
                        style={styles.input}
                      >
                        {RESERVATION_STATUS_FILTERS.map((filter) => (
                          <option key={filter.value} value={filter.value}>
                            {filter.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        className="text-xs font-black uppercase tracking-wide"
                        style={styles.muted}
                      >
                        Buscar
                      </label>

                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={typingSearch}
                          onChange={(event) => setTypingSearch(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              applySearch();
                            }
                          }}
                          placeholder="Reserva, orden, producto, SKU, sede, talla o color..."
                          className="w-full px-4 py-3 text-sm transition"
                          style={styles.input}
                        />

                        <button
                          type="button"
                          onClick={applySearch}
                          className="inline-flex items-center justify-center px-4 py-3 text-sm font-black transition"
                          style={styles.primaryButton}
                          title="Buscar reservas"
                        >
                          <Search size={16} />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={clearSearch}
                      disabled={!hasActiveSearch}
                      className="inline-flex items-center justify-center px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={styles.softButton}
                    >
                      Limpiar búsqueda
                    </button>

                    <button
                      type="button"
                      onClick={loadReservations}
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={styles.primaryButton}
                    >
                      <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                      Actualizar
                    </button>
                  </div>
                </div>

                <div className="mt-6" style={styles.list}>
                  <div className="px-5 py-4" style={styles.listHeader}>
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <p className="text-xs font-black uppercase tracking-[0.18em]">
                        Historial de reservas
                      </p>

                      <p className="text-xs font-semibold opacity-80">
                        {formatNumber(reservations.length)} reservas encontradas
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    {loading && (
                      <div className="px-4 py-12 text-center text-sm" style={styles.muted}>
                        Cargando reservas...
                      </div>
                    )}

                    {!loading && reservations.length === 0 && (
                      <div className="px-4 py-12 text-center text-sm" style={styles.muted}>
                        No hay reservas de inventario para mostrar.
                      </div>
                    )}

                    {!loading &&
                      reservations.map((reservation) => {
                        const reservationItems = getReservationItems(reservation);
                        const statusStyle = getStatusStyle(reservation.status);
                        const dateInfo = getReservationDateLabel(reservation);

                        return (
                          <article
                            key={reservation?._id || reservation?.reservationCode}
                            className="p-4 transition md:p-5"
                            style={styles.reservationCard}
                          >
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black"
                                  style={styles.badge}
                                >
                                  <ShieldCheck size={14} />
                                  {reservation?.reservationCode || 'Sin código'}
                                </span>

                                <span
                                  className="inline-flex items-center px-3 py-1.5 text-xs font-black"
                                  style={statusStyle}
                                >
                                  {getStatusLabel(reservation?.status)}
                                </span>

                                <span
                                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black"
                                  style={styles.valuePill}
                                >
                                  <FileText size={14} style={styles.eyebrow} />
                                  Orden #{reservation?.orderNumber || '—'}
                                </span>
                              </div>

                              <div className="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                                <InfoLine label="Creada" value={formatDate(reservation?.createdAt)} />
                                <InfoLine label={dateInfo.label} value={dateInfo.value} />
                                <InfoLine
                                  label="Cantidad"
                                  value={formatNumber(reservation?.totalQuantity)}
                                />
                                <InfoLine
                                  label="Total reserva"
                                  value={formatMoney(reservation?.total)}
                                />
                              </div>

                              {reservation?.releaseReason && (
                                <p className="text-sm leading-6" style={styles.muted}>
                                  <strong>Motivo:</strong> {reservation.releaseReason}
                                </p>
                              )}
                            </div>

                            <div className="mt-4 grid gap-3">
                              {reservationItems.map((item) => {
                                const branchCode = getBranchCode(item);

                                return (
                                  <div
                                    key={
                                      item?._id ||
                                      `${getProductTitle(item)}-${item?.size}-${item?.color}`
                                    }
                                    className="p-4"
                                    style={styles.itemBox}
                                  >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                      <div className="min-w-0">
                                        <p className="text-sm font-black" style={styles.title}>
                                          {getProductTitle(item)}
                                        </p>

                                        <div className="mt-2 flex flex-wrap gap-2">
                                          <span
                                            className="inline-flex items-center gap-2 px-3 py-1 text-xs font-black"
                                            style={styles.badge}
                                          >
                                            <PackageCheck size={13} />
                                            SKU: {getProductSku(item)}
                                          </span>

                                          <span
                                            className="inline-flex items-center px-3 py-1 text-xs font-black"
                                            style={styles.valuePill}
                                          >
                                            {getBranchName(item)}
                                            {branchCode ? ` · ${branchCode}` : ''}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[420px]">
                                        <InfoPill label="Talla" value={item?.size || '—'} />
                                        <InfoPill label="Color" value={item?.color || '—'} />
                                        <InfoPill
                                          label="Cantidad"
                                          value={formatNumber(item?.quantity)}
                                        />
                                        <InfoPill
                                          label="Subtotal"
                                          value={formatMoney(item?.lineTotal)}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </article>
                        );
                      })}
                  </div>
                </div>
              </div>
            </section>
          </div>,
          document.body
        )}
    </>
  );
}

function HelpStep({ icon, title, text }) {
  return (
    <div className="p-3" style={styles.helpItem}>
      <div className="flex items-center gap-2">
        <span style={styles.eyebrow}>{icon}</span>

        <p className="text-xs font-black uppercase tracking-wide" style={styles.title}>
          {title}
        </p>
      </div>

      <p className="mt-2 text-xs leading-5" style={styles.muted}>
        {text}
      </p>
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide" style={styles.muted}>
        {label}
      </p>

      <p className="mt-1 font-black" style={styles.title}>
        {value || '—'}
      </p>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="px-3 py-2" style={styles.valuePill}>
      <p className="text-[9px] font-black uppercase tracking-wide" style={styles.muted}>
        {label}
      </p>

      <p className="mt-1 text-xs font-black" style={styles.title}>
        {value || '—'}
      </p>
    </div>
  );
}
