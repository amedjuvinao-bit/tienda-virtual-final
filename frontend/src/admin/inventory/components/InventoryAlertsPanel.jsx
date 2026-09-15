// frontend/src/admin/inventory/components/InventoryAlertsPanel.jsx

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  BellRing,
  Boxes,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  PackageCheck,
  PackageSearch,
  PackageX,
  RefreshCw,
  Route,
  ShieldAlert,
  UserCheck,
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

function ControlTab({ active, icon, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[64px] items-center justify-between gap-3 px-4 py-3 text-left transition"
      style={{
        borderRadius: 'var(--admin-radius)',
        border: active
          ? '1px solid var(--admin-primary)'
          : '1px solid var(--admin-card-border)',
        background: active ? 'var(--admin-primary-soft-bg)' : 'var(--admin-card-bg)',
        color: active ? 'var(--admin-primary-soft-text)' : 'var(--admin-card-text)',
        boxShadow: active
          ? '0 12px 28px color-mix(in srgb, var(--admin-primary) 16%, transparent)'
          : 'none',
      }}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span style={{ color: active ? 'var(--admin-primary)' : 'var(--admin-card-muted-text)' }}>
          {icon}
        </span>
        <span className="truncate text-sm font-black">{label}</span>
      </span>
      <span className="px-2.5 py-1 text-xs font-black" style={styles.badge}>
        {formatNumber(count)}
      </span>
    </button>
  );
}

function TransferRecommendationCard({ item, onPrepareTransfer }) {
  const urgencyStyle = item?.severity === 'critical'
    ? styles.dangerBadge
    : styles.warningBadge;

  return (
    <article className="p-4 md:p-5" style={styles.card}>
      <div className="grid gap-5 xl:grid-cols-[minmax(260px,1fr)_minmax(380px,1.35fr)_auto] xl:items-center">
        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-2 px-3 py-1 text-xs font-black"
            style={urgencyStyle}
          >
            {item?.severity === 'critical'
              ? <ShieldAlert size={15} />
              : <AlertTriangle size={15} />}
            {item?.severity === 'critical'
              ? 'Reposición urgente'
              : 'Reposición recomendada'}
          </span>

          <h4 className="mt-3 text-base font-black" style={styles.cardTitle}>
            {item?.product?.title || 'Producto sin nombre'}
          </h4>
          <p className="mt-1 text-sm" style={styles.cardMuted}>
            SKU: {item?.product?.sku || '—'} · {getVariantLabel(item)}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="p-3" style={styles.softCard}>
            <p className="text-[10px] font-black uppercase tracking-wide" style={styles.cardMuted}>
              Sale de
            </p>
            <p className="mt-1 text-sm font-black" style={styles.cardTitle}>
              {item?.source?.name || 'Sede origen'}
            </p>
            <p className="mt-1 text-xs" style={styles.cardMuted}>
              Disponible {formatNumber(item?.source?.availableStock)} · Quedaría{' '}
              {formatNumber(item?.source?.remainingAfterTransfer)}
            </p>
          </div>

          <span className="hidden text-center md:block" style={{ color: 'var(--admin-primary)' }}>
            <ArrowRight size={21} />
          </span>

          <div className="p-3" style={styles.softCard}>
            <p className="text-[10px] font-black uppercase tracking-wide" style={styles.cardMuted}>
              Llega a
            </p>
            <p className="mt-1 text-sm font-black" style={styles.cardTitle}>
              {item?.destination?.name || 'Sede destino'}
            </p>
            <p className="mt-1 text-xs" style={styles.cardMuted}>
              Disponible {formatNumber(item?.destination?.availableStock)} · Quedaría{' '}
              {formatNumber(item?.destination?.expectedAvailableStock)}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 xl:min-w-[180px]">
          <div className="px-4 py-3 text-center" style={styles.infoBox}>
            <p className="text-[10px] font-black uppercase tracking-wide" style={styles.cardMuted}>
              Cantidad sugerida
            </p>
            <p className="mt-1 text-2xl font-black" style={styles.cardTitle}>
              {formatNumber(item?.quantity)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onPrepareTransfer?.(item)}
            disabled={!onPrepareTransfer}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50"
            style={styles.primaryButton}
          >
            <ArrowRightLeft size={17} />
            Preparar traslado
          </button>
        </div>
      </div>
    </article>
  );
}

function StaleStockCard({ item }) {
  return (
    <article className="p-4" style={styles.card}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-black" style={styles.badge}>
            <Clock size={14} />
            {formatNumber(item?.inactiveDays)} días sin movimiento
          </span>
          <p className="mt-3 text-sm font-black" style={styles.cardTitle}>
            {item?.product?.title || 'Producto sin nombre'}
          </p>
          <p className="mt-1 text-sm" style={styles.cardMuted}>
            {item?.branch?.name || 'Sede no definida'} · {getVariantLabel(item)}
          </p>
        </div>

        <div className="min-w-[150px] px-4 py-3 text-center" style={styles.softCard}>
          <p className="text-[10px] font-black uppercase tracking-wide" style={styles.cardMuted}>
            Disponible
          </p>
          <p className="mt-1 text-2xl font-black" style={styles.cardTitle}>
            {formatNumber(item?.availableStock)}
          </p>
        </div>
      </div>
    </article>
  );
}

function CoverageCard({ item }) {
  const riskStyle = item?.severity === 'critical'
    ? styles.dangerBadge
    : item?.severity === 'warning'
      ? styles.warningBadge
      : styles.badge;
  const riskLabel = item?.severity === 'critical'
    ? 'Cobertura crítica'
    : item?.severity === 'warning'
      ? 'Cobertura corta'
      : 'Cobertura saludable';

  return (
    <article className="p-4" style={styles.card}>
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_minmax(320px,auto)] lg:items-center">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-black" style={riskStyle}>
            <Activity size={14} />
            {riskLabel}
          </span>
          <p className="mt-3 text-sm font-black" style={styles.cardTitle}>
            {item?.product?.title || 'Producto sin nombre'}
          </p>
          <p className="mt-1 text-sm" style={styles.cardMuted}>
            {item?.branch?.name || 'Sede no definida'} · {getVariantLabel(item)}
          </p>
          <p className="mt-2 text-xs leading-5" style={styles.cardMuted}>
            Estimación calculada con las salidas por venta de los últimos {formatNumber(item?.windowDays)} días.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <MiniStock label="Disponible" value={item?.availableStock} />
          <MiniStock label="Vendido" value={item?.soldQuantity} />
          <MiniStock label="Días cobertura" value={item?.coverageDays} highlight />
        </div>
      </div>
    </article>
  );
}

function StuckReservationCard({ item }) {
  const statusStyle = item?.overdue ? styles.dangerBadge : styles.warningBadge;

  return (
    <article className="p-4" style={styles.card}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-black" style={statusStyle}>
            <Clock size={14} />
            {item?.overdue ? 'Vencida y sin liberar' : 'Demora inusual'}
          </span>
          <p className="mt-3 text-sm font-black" style={styles.cardTitle}>
            {item?.reservationCode || item?.orderNumber || 'Reserva sin código'}
          </p>
          <p className="mt-1 text-sm" style={styles.cardMuted}>
            {item?.product?.title || 'Producto sin nombre'} · {item?.branch?.name || 'Sede no definida'}
          </p>
          <p className="mt-2 text-xs leading-5" style={styles.cardMuted}>
            {item?.message}
          </p>
        </div>

        <div className="grid min-w-[310px] grid-cols-2 gap-2">
          <MiniReservation label="Tiempo pendiente" value={`${formatNumber(item?.ageMinutes)} min`} />
          <MiniReservation label="Vencimiento" value={formatDate(item?.expiresAt)} />
        </div>
      </div>
    </article>
  );
}

function AnomalyCard({ item }) {
  const severityStyle = item?.severity === 'critical'
    ? styles.dangerBadge
    : styles.warningBadge;

  return (
    <article className="p-4" style={styles.card}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-black" style={severityStyle}>
            <AlertCircle size={14} />
            {item?.severity === 'critical' ? 'Revisión urgente' : 'Revisar integridad'}
          </span>
          <p className="mt-3 text-sm font-black" style={styles.cardTitle}>
            {item?.product?.title || item?.movementNumber || 'Registro de inventario'}
          </p>
          <p className="mt-1 text-sm" style={styles.cardMuted}>
            {item?.branch?.name || 'Sede no definida'} · {item?.message}
          </p>
        </div>
        <span className="w-fit px-3 py-1 text-xs font-black" style={styles.badge}>
          {item?.code || 'ANOMALÍA'}
        </span>
      </div>
    </article>
  );
}

function BranchAlertCard({ item }) {
  const variant = Number(item?.critical || 0) > 0
    ? styles.criticalBox
    : styles.warningBox;

  return (
    <article className="p-4" style={variant}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black" style={styles.cardTitle}>
            {item?.name || 'Sede no definida'}
          </p>
          <p className="mt-1 text-xs" style={styles.cardMuted}>
            {item?.code || 'Sin código'}
          </p>
        </div>
        <span className="px-2.5 py-1 text-xs font-black" style={styles.badge}>
          {formatNumber(item?.total)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold" style={styles.cardMuted}>
        <span>{formatNumber(item?.critical)} críticas</span>
        <span>·</span>
        <span>{formatNumber(item?.warning)} advertencias</span>
      </div>
    </article>
  );
}

function getTransferStatus(status) {
  if (status === 'posted') return { label: 'Aplicado', style: styles.badge };
  if (status === 'cancelled') return { label: 'Rechazado', style: styles.dangerBadge };
  if (status === 'reversed') return { label: 'Reversado', style: styles.warningBadge };
  return { label: 'Pendiente', style: styles.warningBadge };
}

function getActorLabel(actor) {
  return actor?.name || actor?.username || 'Usuario no identificado';
}

function getResponsibleActor(primary, fallback) {
  if (primary?.id || primary?.name || primary?.username) return primary;
  return fallback;
}

function TransferActivityCard({ item }) {
  const status = getTransferStatus(item?.status);
  const reviewedAt = item?.reviewedAt || null;
  const appliedDirectly =
    item?.status === 'posted' && !reviewedAt && Boolean(item?.postedAt);

  return (
    <article className="p-4 md:p-5" style={styles.card}>
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,1.2fr)_minmax(280px,1fr)_minmax(260px,1fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 text-xs font-black" style={status.style}>
              {status.label}
            </span>
            <span className="text-xs font-black" style={styles.cardMuted}>
              {item?.movementNumber || 'Traslado sin número'}
            </span>
          </div>
          <p className="mt-3 text-sm font-black" style={styles.cardTitle}>
            {item?.product?.title || 'Producto sin nombre'}
          </p>
          <p className="mt-1 text-sm" style={styles.cardMuted}>
            {getVariantLabel(item)} · {formatNumber(item?.quantity)} unidad(es)
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide" style={styles.cardMuted}>
            Ruta operativa
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm font-black" style={styles.cardTitle}>
            <Route size={16} style={{ color: 'var(--admin-primary)' }} />
            {item?.source?.name || 'Origen'} → {item?.destination?.name || 'Destino'}
          </p>
          <p className="mt-2 text-xs" style={styles.cardMuted}>
            Creado {formatDate(item?.createdAt)}
          </p>
        </div>

        <div className="min-w-0 p-3" style={styles.softCard}>
          <p className="text-[10px] font-black uppercase tracking-wide" style={styles.cardMuted}>
            Responsables
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm font-bold" style={styles.cardTitle}>
            <UserCheck size={15} style={{ color: 'var(--admin-primary)' }} />
            Solicitó: {getActorLabel(getResponsibleActor(item?.requestedBy, item?.createdBy))}
          </p>
          {reviewedAt && (
            <p className="mt-2 text-xs leading-5" style={styles.cardMuted}>
              Revisó: {getActorLabel(item?.reviewedBy)} · {formatDate(reviewedAt)}
            </p>
          )}
          {appliedDirectly && (
            <p className="mt-2 text-xs leading-5" style={styles.cardMuted}>
              Aplicado directamente · {formatDate(item?.postedAt)}
            </p>
          )}
          {item?.reviewNote && (
            <p className="mt-2 text-xs leading-5" style={styles.cardMuted}>
              Nota: {item.reviewNote}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function InventoryAlertsPanel({ open, onClose, onPrepareTransfer }) {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('priorities');

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
  const transferRecommendations = Array.isArray(alerts?.transferRecommendations)
    ? alerts.transferRecommendations
    : [];
  const staleStockItems = Array.isArray(alerts?.staleStockItems)
    ? alerts.staleStockItems
    : [];
  const recentTransfers = Array.isArray(alerts?.recentTransfers)
    ? alerts.recentTransfers
    : [];
  const coverageEstimates = Array.isArray(alerts?.coverageEstimates)
    ? alerts.coverageEstimates
    : [];
  const stuckReservations = Array.isArray(alerts?.stuckReservations)
    ? alerts.stuckReservations
    : [];
  const inventoryAnomalies = Array.isArray(alerts?.inventoryAnomalies)
    ? alerts.inventoryAnomalies
    : [];
  const branchAlerts = Array.isArray(alerts?.branchAlerts)
    ? alerts.branchAlerts
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
    setActiveTab('priorities');
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
                Control operativo
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl" style={styles.title}>
                Centro de control de inventario
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6" style={styles.muted}>
                Prioriza alertas, prepara reposiciones y anticipa riesgos con cobertura, reservas y anomalías reales.
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

              <nav className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Vistas del centro de control">
                <ControlTab
                  active={activeTab === 'priorities'}
                  icon={<ShieldAlert size={19} />}
                  label="Prioridades"
                  count={Number(summary.critical || 0) + Number(summary.warning || 0)}
                  onClick={() => setActiveTab('priorities')}
                />
                <ControlTab
                  active={activeTab === 'replenishment'}
                  icon={<ArrowRightLeft size={19} />}
                  label="Reposición entre sedes"
                  count={summary.transferRecommendations}
                  onClick={() => setActiveTab('replenishment')}
                />
                <ControlTab
                  active={activeTab === 'traceability'}
                  icon={<Activity size={19} />}
                  label="Trazabilidad"
                  count={recentTransfers.length}
                  onClick={() => setActiveTab('traceability')}
                />
                <ControlTab
                  active={activeTab === 'intelligence'}
                  icon={<PackageSearch size={19} />}
                  label="Inteligencia"
                  count={
                    Number(summary.coverageCritical || 0) +
                    Number(summary.coverageWarning || 0) +
                    Number(summary.stuckReservations || 0) +
                    Number(summary.anomalies || 0)
                  }
                  onClick={() => setActiveTab('intelligence')}
                />
              </nav>

              {loading && (
                <section className="p-8 text-center" style={styles.card}>
                  <div className="inline-flex items-center gap-2 text-sm font-black" style={styles.cardMuted}>
                    <Loader2 size={18} className="animate-spin" />
                    Cargando alertas de inventario...
                  </div>
                </section>
              )}

              {!loading && activeTab === 'priorities' && !hasAlerts && (
                <EmptyState
                  icon={<PackageCheck size={22} />}
                  title="Inventario sin alertas críticas"
                  description="No hay productos agotados, bajo stock ni reservas pendientes en este momento."
                />
              )}

              {!loading && activeTab === 'priorities' && (
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
              )}

              {!loading && activeTab === 'priorities' && outOfStockItems.length > 0 && (
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

              {!loading && activeTab === 'priorities' && lowStockItems.length > 0 && (
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

              {!loading && activeTab === 'priorities' && expiredReservations.length > 0 && (
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

              {!loading && activeTab === 'priorities' && pendingReservations.length > 0 && (
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

              {!loading && activeTab === 'priorities' && (
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
                        Las alertas usan el disponible real: stock físico menos unidades reservadas.
                        Los agotados y las reservas vencidas aparecen como críticos.
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {!loading && activeTab === 'replenishment' && (
                <>
                  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                      title="Traslados sugeridos"
                      value={summary.transferRecommendations}
                      description="Reposiciones posibles sin comprar inventario."
                      icon={<ArrowRightLeft size={21} />}
                      variant={Number(summary.transferRecommendations || 0) > 0 ? 'info' : 'success'}
                    />
                    <SummaryCard
                      title="Pendientes"
                      value={summary.pendingTransfers}
                      description="Solicitudes que esperan aprobación."
                      icon={<Clock size={21} />}
                      variant={Number(summary.pendingTransfers || 0) > 0 ? 'warning' : 'success'}
                    />
                    <SummaryCard
                      title="Aplicados"
                      value={summary.appliedTransfers}
                      description="Traslados recientes ya ejecutados."
                      icon={<CheckCircle2 size={21} />}
                      variant="success"
                    />
                    <SummaryCard
                      title="Sin rotación"
                      value={summary.staleStock}
                      description="Existencias sin movimientos recientes."
                      icon={<Boxes size={21} />}
                      variant={Number(summary.staleStock || 0) > 0 ? 'warning' : 'success'}
                    />
                  </section>

                  {transferRecommendations.length === 0 ? (
                    <EmptyState
                      icon={<PackageCheck size={22} />}
                      title="No hay traslados recomendados"
                      description="No encontramos excedentes en otras sedes para cubrir los productos agotados o con bajo stock."
                    />
                  ) : (
                    <AlertSection
                      title="Reposiciones sugeridas"
                      description="Cada sugerencia protege el mínimo de la sede origen. Al prepararla queda pendiente de aprobación."
                      icon={<ArrowRightLeft size={19} />}
                      count={transferRecommendations.length}
                    >
                      {transferRecommendations.map((item) => (
                        <TransferRecommendationCard
                          key={item.id}
                          item={item}
                          onPrepareTransfer={onPrepareTransfer}
                        />
                      ))}
                    </AlertSection>
                  )}
                </>
              )}

              {!loading && activeTab === 'intelligence' && (
                <>
                  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                      title="Cobertura crítica"
                      value={summary.coverageCritical}
                      description="Menos de 7 días al ritmo de venta."
                      icon={<Activity size={21} />}
                      variant={Number(summary.coverageCritical || 0) > 0 ? 'critical' : 'success'}
                    />
                    <SummaryCard
                      title="Cobertura corta"
                      value={summary.coverageWarning}
                      description="Entre 7 y 14 días estimados."
                      icon={<AlertTriangle size={21} />}
                      variant={Number(summary.coverageWarning || 0) > 0 ? 'warning' : 'success'}
                    />
                    <SummaryCard
                      title="Reservas atascadas"
                      value={summary.stuckReservations}
                      description="Pendientes por más tiempo del esperado."
                      icon={<Clock size={21} />}
                      variant={Number(summary.stuckReservations || 0) > 0 ? 'warning' : 'success'}
                    />
                    <SummaryCard
                      title="Anomalías"
                      value={summary.anomalies}
                      description="Inconsistencias que requieren revisión."
                      icon={<ShieldAlert size={21} />}
                      variant={Number(summary.anomalies || 0) > 0 ? 'critical' : 'success'}
                    />
                  </section>

                  <AlertSection
                    title="Cobertura estimada"
                    description="Proyección transparente basada en ventas aplicadas de los últimos 30 días."
                    icon={<Activity size={19} />}
                    count={coverageEstimates.length}
                  >
                    {coverageEstimates.length === 0 ? (
                      <EmptyState
                        icon={<PackageCheck size={22} />}
                        title="Aún no hay consumo suficiente"
                        description="La cobertura aparecerá cuando existan salidas por venta recientes para estos productos."
                      />
                    ) : (
                      coverageEstimates.map((item) => (
                        <CoverageCard key={item.id} item={item} />
                      ))
                    )}
                  </AlertSection>

                  {branchAlerts.length > 0 && (
                    <AlertSection
                      title="Alertas por sede"
                      description="Concentra los riesgos para decidir dónde actuar primero."
                      icon={<MapPin size={19} />}
                      count={branchAlerts.length}
                    >
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {branchAlerts.map((item) => (
                          <BranchAlertCard key={item.id} item={item} />
                        ))}
                      </div>
                    </AlertSection>
                  )}

                  {stuckReservations.length > 0 && (
                    <AlertSection
                      title="Reservas atascadas"
                      description="Reservas pendientes por 30 minutos o que ya superaron su vencimiento."
                      icon={<Clock size={19} />}
                      count={stuckReservations.length}
                    >
                      {stuckReservations.map((item) => (
                        <StuckReservationCard key={item.id} item={item} />
                      ))}
                    </AlertSection>
                  )}

                  {inventoryAnomalies.length > 0 && (
                    <AlertSection
                      title="Anomalías operativas"
                      description="Validaciones automáticas de existencias y movimientos aplicados."
                      icon={<ShieldAlert size={19} />}
                      count={inventoryAnomalies.length}
                    >
                      {inventoryAnomalies.map((item) => (
                        <AnomalyCard key={item.id} item={item} />
                      ))}
                    </AlertSection>
                  )}

                  {stuckReservations.length === 0 && inventoryAnomalies.length === 0 && (
                    <section className="p-5" style={styles.successBox}>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-black" style={styles.cardTitle}>
                            Operación consistente
                          </p>
                          <p className="mt-1 text-sm leading-6" style={styles.cardMuted}>
                            No se detectaron reservas atascadas ni anomalías de integridad.
                          </p>
                        </div>
                      </div>
                    </section>
                  )}
                </>
              )}

              {!loading && activeTab === 'traceability' && (
                <>
                  <section className="grid gap-4 md:grid-cols-3">
                    <SummaryCard
                      title="Pendientes"
                      value={summary.pendingTransfers}
                      description="Traslados solicitados que esperan decisión."
                      icon={<Clock size={21} />}
                      variant={Number(summary.pendingTransfers || 0) > 0 ? 'warning' : 'success'}
                    />
                    <SummaryCard
                      title="Aplicados"
                      value={summary.appliedTransfers}
                      description="Movimientos aprobados y ejecutados."
                      icon={<CheckCircle2 size={21} />}
                      variant="success"
                    />
                    <SummaryCard
                      title="Rechazados"
                      value={summary.rejectedTransfers}
                      description="Solicitudes canceladas durante la revisión."
                      icon={<AlertCircle size={21} />}
                      variant={Number(summary.rejectedTransfers || 0) > 0 ? 'critical' : 'success'}
                    />
                  </section>

                  {recentTransfers.length === 0 ? (
                    <EmptyState
                      icon={<Route size={22} />}
                      title="Aún no hay traslados registrados"
                      description="Cuando se solicite, apruebe o rechace un traslado, su recorrido aparecerá aquí."
                    />
                  ) : (
                    <AlertSection
                      title="Actividad reciente de traslados"
                      description="Consulta la ruta, el estado y los responsables de cada movimiento entre sedes."
                      icon={<Activity size={19} />}
                      count={recentTransfers.length}
                    >
                      {recentTransfers.map((item) => (
                        <TransferActivityCard key={item.id} item={item} />
                      ))}
                    </AlertSection>
                  )}

                  <AlertSection
                    title="Inventario sin rotación"
                    description="Existencias disponibles que llevan al menos 90 días sin un movimiento aplicado."
                    icon={<MapPin size={19} />}
                    count={staleStockItems.length}
                  >
                    {staleStockItems.length === 0 ? (
                      <EmptyState
                        icon={<PackageCheck size={22} />}
                        title="Sin inventario estancado"
                        description="No hay existencias disponibles con más de 90 días sin movimiento."
                      />
                    ) : (
                      staleStockItems.map((item) => (
                        <StaleStockCard key={item.id} item={item} />
                      ))
                    )}
                  </AlertSection>
                </>
              )}

              {!loading && activeTab === 'traceability' && (
                <section className="p-5" style={styles.softCard}>
                <div className="flex items-start gap-3">
                  <UserCheck
                    size={18}
                    className="mt-0.5 shrink-0"
                    style={{ color: 'var(--admin-primary)' }}
                  />

                  <div>
                    <p className="text-sm font-black" style={styles.cardTitle}>
                      Control auditable
                    </p>

                    <p className="mt-1 text-sm leading-6" style={styles.cardMuted}>
                      La trazabilidad conserva quién solicitó y quién revisó cada traslado, además de su fecha y decisión.
                    </p>
                  </div>
                </div>
                </section>
              )}
            </div>
          </div>

          <footer className="shrink-0 px-5 py-4 md:px-8" style={styles.footer}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm" style={styles.muted}>
                Datos calculados con inventario, reservas y movimientos reales por sede.
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
