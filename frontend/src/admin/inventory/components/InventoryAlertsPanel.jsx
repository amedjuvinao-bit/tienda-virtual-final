// frontend/src/admin/inventory/components/InventoryAlertsPanel.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  BellRing,
  Boxes,
  Clock,
  Loader2,
  PackageCheck,
  PackageSearch,
  PackageX,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import api from '../../../lib/api';

const styles = {
  overlay: {
    background: 'var(--admin-modal-overlay)',
  },

  modal: {
    width: 'min(1320px, calc(100vw - 34px))',
    maxHeight: 'calc(100vh - 34px)',
    borderRadius: 'calc(var(--admin-radius) + 12px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-modal-bg)',
    color: 'var(--admin-modal-text)',
    boxShadow: '0 34px 110px rgba(15, 23, 42, 0.34)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  header: {
    borderBottom: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-modal-bg) 82%, var(--admin-primary) 18%), var(--admin-modal-bg))',
  },

  body: {
    background:
      'radial-gradient(circle at top left, color-mix(in srgb, var(--admin-primary) 10%, transparent), transparent 30%), var(--admin-page-bg)',
  },

  footer: {
    borderTop: '1px solid var(--admin-card-border)',
    background: 'var(--admin-modal-bg)',
  },

  eyebrow: {
    color: 'var(--admin-primary)',
  },

  title: {
    color: 'var(--admin-modal-text)',
  },

  muted: {
    color: 'var(--admin-modal-muted-text)',
  },

  cardTitle: {
    color: 'var(--admin-card-text)',
  },

  cardMuted: {
    color: 'var(--admin-card-muted-text)',
  },

  card: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
    boxShadow: 'var(--admin-glass-shadow)',
  },

  softCard: {
    borderRadius: 'calc(var(--admin-radius) + 6px)',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-card-text)',
  },

  closeButton: {
    borderRadius: '999px',
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
    border: '1px solid var(--admin-button-soft-border)',
  },

  softButton: {
    borderRadius: 'var(--admin-radius)',
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
    border: '1px solid var(--admin-button-soft-border)',
  },

  primaryButton: {
    borderRadius: 'var(--admin-radius)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-text)',
    border: '1px solid var(--admin-button-border)',
  },

  errorBox: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-danger)',
    background: 'var(--admin-danger-soft-bg)',
    color: 'var(--admin-danger-text)',
  },

  criticalBox: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid var(--admin-danger)',
    background:
      'linear-gradient(135deg, var(--admin-danger-soft-bg), color-mix(in srgb, var(--admin-card-bg) 76%, var(--admin-danger) 24%))',
    color: 'var(--admin-card-text)',
  },

  warningBox: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid var(--admin-warning)',
    background:
      'linear-gradient(135deg, var(--admin-warning-soft-bg), color-mix(in srgb, var(--admin-card-bg) 80%, var(--admin-warning) 20%))',
    color: 'var(--admin-card-text)',
  },

  infoBox: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid var(--admin-primary-soft-border)',
    background:
      'linear-gradient(135deg, var(--admin-primary-soft-bg), color-mix(in srgb, var(--admin-card-bg) 86%, var(--admin-primary) 14%))',
    color: 'var(--admin-card-text)',
  },

  successBox: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid color-mix(in srgb, #22c55e 55%, var(--admin-card-border))',
    background: 'color-mix(in srgb, #22c55e 12%, var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
  },

  badge: {
    borderRadius: '999px',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary-soft-text)',
  },

  dangerBadge: {
    borderRadius: '999px',
    border: '1px solid var(--admin-danger)',
    background: 'var(--admin-danger-soft-bg)',
    color: 'var(--admin-danger-text)',
  },

  warningBadge: {
    borderRadius: '999px',
    border: '1px solid var(--admin-warning)',
    background: 'var(--admin-warning-soft-bg)',
    color: 'var(--admin-warning-text)',
  },
};

function formatNumber(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('es-CO').format(number);
}

function formatCurrency(value) {
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
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getSeverityConfig(type) {
  if (type === 'outOfStock' || type === 'expiredReservation') {
    return {
      label: 'Crítica',
      style: styles.dangerBadge,
      icon: <ShieldAlert size={15} />,
    };
  }

  if (type === 'lowStock') {
    return {
      label: 'Advertencia',
      style: styles.warningBadge,
      icon: <AlertTriangle size={15} />,
    };
  }

  return {
    label: 'Informativa',
    style: styles.badge,
    icon: <Clock size={15} />,
  };
}

function getStockTitle(item) {
  return item?.product?.title || 'Producto sin nombre';
}

function getStockSku(item) {
  return item?.product?.sku || '—';
}

function getBranchName(item) {
  return item?.branch?.name || 'Sede no definida';
}

function getVariantLabel(item) {
  const explicit = String(item?.variant?.label || '').trim();
  if (explicit) return explicit;
  const attributes = Array.isArray(item?.variant?.attributes)
    ? item.variant.attributes
        .map((attribute) => String(attribute?.value || '').trim())
        .filter(Boolean)
    : [];
  return attributes.join(' / ') || [item?.variant?.size, item?.variant?.color]
    .filter(Boolean)
    .join(' / ') || 'Presentación general';
}

function getReservationTitle(item) {
  return item?.reservationCode || item?.orderNumber || 'Reserva sin código';
}

function getReservationProduct(item) {
  return item?.product?.title || 'Producto sin nombre';
}

function getReservationVariant(item) {
  return getVariantLabel(item);
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-8 text-center" style={styles.card}>
      <div
        className="flex h-12 w-12 items-center justify-center"
        style={{
          borderRadius: 'var(--admin-radius)',
          background: 'var(--admin-primary-soft-bg)',
          color: 'var(--admin-primary)',
          border: '1px solid var(--admin-primary-soft-border)',
        }}
      >
        {icon}
      </div>

      <p className="mt-3 text-sm font-black" style={styles.cardTitle}>
        {title}
      </p>

      <p className="mt-1 max-w-md text-sm leading-6" style={styles.cardMuted}>
        {description}
      </p>
    </div>
  );
}

function SummaryCard({ title, value, description, icon, variant = 'info' }) {
  const cardStyle =
    variant === 'critical'
      ? styles.criticalBox
      : variant === 'warning'
        ? styles.warningBox
        : variant === 'success'
          ? styles.successBox
          : styles.infoBox;

  return (
    <article className="p-5" style={cardStyle}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide" style={styles.cardMuted}>
            {title}
          </p>

          <p className="mt-2 text-3xl font-black" style={styles.cardTitle}>
            {formatNumber(value)}
          </p>

          <p className="mt-2 text-sm leading-5" style={styles.cardMuted}>
            {description}
          </p>
        </div>

        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center"
          style={{
            borderRadius: 'var(--admin-radius)',
            background: 'var(--admin-card-bg)',
            color:
              variant === 'critical'
                ? 'var(--admin-danger)'
                : variant === 'warning'
                  ? 'var(--admin-warning-text)'
                  : 'var(--admin-primary)',
            border: '1px solid var(--admin-card-border)',
          }}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

function StockAlertCard({ item }) {
  const config = getSeverityConfig(item?.type);
  return (
    <article className="p-4" style={styles.card}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-2 px-3 py-1 text-xs font-black"
              style={config.style}
            >
              {config.icon}
              {config.label}
            </span>

            <span className="px-3 py-1 text-xs font-black" style={styles.badge}>
              {item?.type === 'outOfStock' ? 'Agotado' : 'Bajo stock'}
            </span>
          </div>

          <h4 className="mt-3 text-base font-black" style={styles.cardTitle}>
            {getStockTitle(item)}
          </h4>

          <p className="mt-1 text-sm leading-6" style={styles.cardMuted}>
            SKU: {getStockSku(item)} · {getBranchName(item)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 text-xs font-black" style={styles.badge}>
              Variante {getVariantLabel(item)}
            </span>
          </div>

          <p className="mt-3 text-sm leading-6" style={styles.cardMuted}>
            {item?.message || 'Alerta de inventario.'}
          </p>
        </div>

        <div className="grid min-w-[280px] grid-cols-3 gap-2">
          <MiniStock label="Físico" value={item?.stock?.physicalStock} />
          <MiniStock label="Reservado" value={item?.stock?.reservedStock} />
          <MiniStock label="Disponible" value={item?.stock?.availableStock} highlight />
        </div>
      </div>
    </article>
  );
}

function ReservationAlertCard({ item }) {
  const config = getSeverityConfig(item?.type);
  const isExpired = item?.type === 'expiredReservation';

  return (
    <article className="p-4" style={styles.card}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-2 px-3 py-1 text-xs font-black"
              style={config.style}
            >
              {config.icon}
              {config.label}
            </span>

            <span className="px-3 py-1 text-xs font-black" style={styles.badge}>
              {isExpired ? 'Reserva vencida' : 'Reserva activa'}
            </span>
          </div>

          <h4 className="mt-3 text-base font-black" style={styles.cardTitle}>
            {getReservationTitle(item)}
          </h4>

          <p className="mt-1 text-sm leading-6" style={styles.cardMuted}>
            {getReservationProduct(item)} · {getReservationVariant(item)}
          </p>

          <p className="mt-1 text-sm leading-6" style={styles.cardMuted}>
            {item?.branch?.name || 'Sede no definida'} · Cantidad reservada:{' '}
            <b style={styles.cardTitle}>{formatNumber(item?.totalQuantity)}</b>
          </p>

          <p className="mt-3 text-sm leading-6" style={styles.cardMuted}>
            {item?.message || 'Alerta de reserva.'}
          </p>
        </div>

        <div className="grid min-w-[300px] gap-2">
          <MiniReservation
            label={isExpired ? 'Venció' : 'Vence'}
            value={formatDate(item?.expiresAt)}
          />

          <MiniReservation
            label="Tiempo restante"
            value={
              item?.minutesToExpire === null || item?.minutesToExpire === undefined
                ? '—'
                : `${formatNumber(item.minutesToExpire)} min`
            }
          />

          <MiniReservation label="Total" value={formatCurrency(item?.total)} />
        </div>
      </div>
    </article>
  );
}

function MiniStock({ label, value, highlight = false }) {
  return (
    <div
      className="px-3 py-3"
      style={{
        borderRadius: 'var(--admin-radius)',
        border: highlight
          ? '1px solid color-mix(in srgb, #22c55e 55%, var(--admin-card-border))'
          : '1px solid var(--admin-card-border)',
        background: highlight
          ? 'color-mix(in srgb, #22c55e 12%, var(--admin-card-bg))'
          : 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
      }}
    >
      <p className="text-[10px] font-black uppercase tracking-wide" style={styles.cardMuted}>
        {label}
      </p>

      <p className="mt-1 text-xl font-black" style={styles.cardTitle}>
        {formatNumber(value)}
      </p>
    </div>
  );
}

function MiniReservation({ label, value }) {
  return (
    <div
      className="px-3 py-3"
      style={{
        borderRadius: 'var(--admin-radius)',
        border: '1px solid var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
      }}
    >
      <p className="text-[10px] font-black uppercase tracking-wide" style={styles.cardMuted}>
        {label}
      </p>

      <p className="mt-1 text-sm font-black" style={styles.cardTitle}>
        {value || '—'}
      </p>
    </div>
  );
}

function AlertSection({ title, description, icon, count, children }) {
  return (
    <section className="p-5" style={styles.card}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center"
            style={{
              borderRadius: 'var(--admin-radius)',
              background: 'var(--admin-primary-soft-bg)',
              color: 'var(--admin-primary)',
              border: '1px solid var(--admin-primary-soft-border)',
            }}
          >
            {icon}
          </div>

          <div>
            <h3 className="text-lg font-black" style={styles.cardTitle}>
              {title}
            </h3>

            <p className="mt-1 text-sm leading-6" style={styles.cardMuted}>
              {description}
            </p>
          </div>
        </div>

        <span className="w-fit px-3 py-1 text-xs font-black uppercase tracking-wide" style={styles.badge}>
          {formatNumber(count)} registros
        </span>
      </div>

      <div className="mt-5 space-y-3">{children}</div>
    </section>
  );
}

export default function InventoryAlertsPanel({ open, onClose }) {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const summary = alerts?.summary || {};
  const lowStockItems = Array.isArray(alerts?.lowStockItems)
    ? alerts.lowStockItems
    : [];
  const outOfStockItems = Array.isArray(alerts?.outOfStockItems)
    ? alerts.outOfStockItems
    : [];
  const expiredReservations = Array.isArray(alerts?.expiredReservations)
    ? alerts.expiredReservations
    : [];
  const pendingReservations = Array.isArray(alerts?.pendingReservations)
    ? alerts.pendingReservations
    : [];

  const hasAlerts =
    lowStockItems.length > 0 ||
    outOfStockItems.length > 0 ||
    expiredReservations.length > 0 ||
    pendingReservations.length > 0;

  const loadAlerts = useCallback(async () => {
    if (!open) return;

    try {
      setLoading(true);
      setError('');

      const response = await api.get('/api/admin/inventory/alerts', {
        params: {
          limit: 20,
        },
      });

      setAlerts(response?.data?.data || null);
    } catch (err) {
      console.error('❌ Error cargando alertas de inventario:', err);

      setError(
        err?.response?.data?.message ||
          err?.userMessage ||
          'No se pudieron cargar las alertas de inventario.'
      );
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setAlerts(null);
    setError('');
    loadAlerts();
  }, [open, loadAlerts]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow || '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed left-0 top-0 z-[99999] flex h-screen w-screen items-center justify-center p-2 md:p-4"
      aria-modal="true"
      role="dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div className="absolute inset-0 backdrop-blur-sm" style={styles.overlay} />

      <div className="relative z-[100000]" style={styles.modal}>
        <header className="shrink-0 px-6 py-5 md:px-8" style={styles.header}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.26em]" style={styles.eyebrow}>
                Alertas de inventario
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl" style={styles.title}>
                Control de productos críticos
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6" style={styles.muted}>
                Revisa agotados, bajo stock y reservas pendientes para tomar decisiones rápidas de reposición.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={loadAlerts}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
                style={styles.primaryButton}
              >
                {loading ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <RefreshCw size={17} />
                )}
                Actualizar
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="inline-flex h-11 w-11 items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-60"
                style={styles.closeButton}
                title="Cerrar"
              >
                <X size={21} />
              </button>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5" style={styles.body}>
            <div className="flex flex-col gap-4">
              {error && (
                <div className="flex items-start gap-3 px-4 py-3 text-sm font-semibold" style={styles.errorBox}>
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  title="Críticas"
                  value={summary.critical}
                  description="Agotados y reservas vencidas pendientes."
                  icon={<ShieldAlert size={21} />}
                  variant={Number(summary.critical || 0) > 0 ? 'critical' : 'success'}
                />

                <SummaryCard
                  title="Bajo stock"
                  value={summary.lowStock}
                  description="Productos cerca del punto mínimo."
                  icon={<AlertTriangle size={21} />}
                  variant={Number(summary.lowStock || 0) > 0 ? 'warning' : 'success'}
                />

                <SummaryCard
                  title="Agotados"
                  value={summary.outOfStock}
                  description="Variantes sin unidades disponibles."
                  icon={<PackageX size={21} />}
                  variant={Number(summary.outOfStock || 0) > 0 ? 'critical' : 'success'}
                />

                <SummaryCard
                  title="Reservas"
                  value={summary.pendingReservations}
                  description="Unidades apartadas por órdenes pendientes."
                  icon={<Clock size={21} />}
                  variant={Number(summary.pendingReservations || 0) > 0 ? 'info' : 'success'}
                />
              </section>

              {loading && (
                <section className="p-8 text-center" style={styles.card}>
                  <div className="inline-flex items-center gap-2 text-sm font-black" style={styles.cardMuted}>
                    <Loader2 size={18} className="animate-spin" />
                    Cargando alertas de inventario...
                  </div>
                </section>
              )}

              {!loading && !hasAlerts && (
                <EmptyState
                  icon={<PackageCheck size={22} />}
                  title="Inventario sin alertas críticas"
                  description="No hay productos agotados, bajo stock ni reservas pendientes en este momento."
                />
              )}

              {!loading && outOfStockItems.length > 0 && (
                <AlertSection
                  title="Productos agotados"
                  description="Variantes sin disponibilidad. Deben priorizarse para reposición o revisión."
                  icon={<PackageX size={19} />}
                  count={summary.outOfStock}
                >
                  {outOfStockItems.map((item) => (
                    <StockAlertCard key={item.id} item={item} />
                  ))}
                </AlertSection>
              )}

              {!loading && lowStockItems.length > 0 && (
                <AlertSection
                  title="Productos con bajo stock"
                  description="Variantes con disponibilidad menor o igual al punto mínimo configurado."
                  icon={<AlertTriangle size={19} />}
                  count={summary.lowStock}
                >
                  {lowStockItems.map((item) => (
                    <StockAlertCard key={item.id} item={item} />
                  ))}
                </AlertSection>
              )}

              {!loading && expiredReservations.length > 0 && (
                <AlertSection
                  title="Reservas vencidas pendientes"
                  description="Reservas que ya vencieron y deben ser liberadas por el job automático."
                  icon={<ShieldAlert size={19} />}
                  count={summary.expiredReservations}
                >
                  {expiredReservations.map((item) => (
                    <ReservationAlertCard key={item.id} item={item} />
                  ))}
                </AlertSection>
              )}

              {!loading && pendingReservations.length > 0 && (
                <AlertSection
                  title="Reservas pendientes activas"
                  description="Reservas que todavía apartan unidades mientras el cliente completa el pago."
                  icon={<BellRing size={19} />}
                  count={summary.pendingReservations}
                >
                  {pendingReservations.map((item) => (
                    <ReservationAlertCard key={item.id} item={item} />
                  ))}
                </AlertSection>
              )}

              <section className="p-5" style={styles.softCard}>
                <div className="flex items-start gap-3">
                  <PackageSearch
                    size={18}
                    className="mt-0.5 shrink-0"
                    style={{ color: 'var(--admin-primary)' }}
                  />

                  <div>
                    <p className="text-sm font-black" style={styles.cardTitle}>
                      Lectura rápida
                    </p>

                    <p className="mt-1 text-sm leading-6" style={styles.cardMuted}>
                      Las alertas se calculan con el disponible real: stock físico menos unidades reservadas.
                      Si hay productos agotados o reservas vencidas pendientes, aparecen como críticas.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <footer className="shrink-0 px-5 py-4 md:px-8" style={styles.footer}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm" style={styles.muted}>
                Alertas generadas desde inventario por sedes y reservas pendientes.
              </p>

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="inline-flex items-center justify-center px-6 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
                style={styles.softButton}
              >
                Cerrar
              </button>
            </div>
          </footer>
        </div>

        <style>
          {`
            @media (max-width: 720px) {
              div[style*="width: min(1320px, calc(100vw - 34px))"] {
                width: calc(100vw - 18px) !important;
                max-height: calc(100vh - 18px) !important;
                border-radius: 22px !important;
              }
            }
          `}
        </style>
      </div>
    </div>,
    document.body
  );
}
