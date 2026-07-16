// frontend/src/admin/dashboard/components/DashboardPosCashPanel.jsx

import {
  BadgeDollarSign,
  Banknote,
  ClipboardCheck,
  MonitorSmartphone,
  PanelsTopLeft,
  ReceiptText,
  Store,
  WalletCards,
} from 'lucide-react';

import { dashboardStyles as styles } from '../dashboardStyles';

function formatMoney(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) return '$0';

  return `$${Math.round(number).toLocaleString('es-CO')}`;
}

function formatNumber(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) return '0';

  return number.toLocaleString('es-CO');
}

function clampPercentage(value) {
  return Math.min(Math.max(Number(value || 0), 0), 100);
}

const nestedCardStyle = {
  ...styles.compactCard,
  background:
    'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 82%, rgba(255,255,255,0.18)), color-mix(in srgb, var(--admin-card-bg) 88%, var(--admin-primary) 5%))',
};

const iconBoxStyle = {
  border: '1px solid color-mix(in srgb, var(--admin-primary) 24%, rgba(255,255,255,0.54))',
  background:
    'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 72%, rgba(255,255,255,0.24)), color-mix(in srgb, var(--admin-card-bg) 84%, var(--admin-primary) 8%))',
  color: 'var(--admin-primary)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.58), 0 8px 18px rgba(148,68,92,0.08)',
};

function GlassIcon({ children }) {
  return (
    <span
      className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[15px]"
      style={iconBoxStyle}
    >
      <span
        className="pointer-events-none absolute inset-x-[7px] top-[4px] h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.82), transparent)',
        }}
      />
      <span className="relative z-10">{children}</span>
    </span>
  );
}

function PanelShell({ eyebrow, title, description, actionLabel, onAction, children }) {
  return (
    <section
      className="relative min-h-full overflow-hidden rounded-[24px] p-4 md:p-5"
      style={styles.card}
    >
      <span
        className="pointer-events-none absolute inset-x-10 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.86), transparent)',
        }}
      />

      <span
        className="pointer-events-none absolute -right-10 -top-14 h-[170px] w-[34px] rotate-[34deg]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), rgba(255,255,255,0.24), rgba(255,255,255,0.07), transparent)',
          opacity: 0.34,
          filter: 'blur(0.4px)',
        }}
      />

      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-[10.5px] font-black uppercase tracking-[0.24em]"
              style={styles.eyebrow}
            >
              {eyebrow}
            </p>
            <h3 className="mt-1 text-[17px] font-black leading-tight" style={styles.title}>
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-[11.5px] font-semibold leading-[15px]" style={styles.muted}>
                {description}
              </p>
            ) : null}
          </div>

          {actionLabel && typeof onAction === 'function' ? (
            <button
              type="button"
              onClick={onAction}
              className="relative inline-flex h-9 shrink-0 items-center justify-center overflow-hidden rounded-[14px] px-3 text-[11px] font-black"
              style={styles.actionButton}
            >
              {actionLabel}
            </button>
          ) : null}
        </div>

        {children}
      </div>
    </section>
  );
}

function ChannelRow({ item }) {
  const iconMap = {
    pos: Store,
    web: MonitorSmartphone,
    manual: PanelsTopLeft,
  };

  const Icon = iconMap[item?.id] || BadgeDollarSign;
  const percentage = clampPercentage(item?.percentage);

  return (
    <article className="relative overflow-hidden rounded-[18px] p-3" style={nestedCardStyle}>
      <div className="flex items-start gap-3">
        <GlassIcon>
          <Icon size={18} strokeWidth={2.35} />
        </GlassIcon>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12.5px] font-black leading-[15px]" style={styles.title}>
                {item?.title || item?.label || 'Canal'}
              </p>
              <p className="mt-0.5 text-[10.5px] font-bold leading-[13px]" style={styles.muted}>
                {item?.description || 'Ventas del periodo'}
              </p>
            </div>

            <div className="text-right">
              <p
                className="text-[14px] font-black leading-none"
                style={{ color: 'var(--admin-primary)' }}
              >
                {item?.amountFormatted || formatMoney(item?.amount)}
              </p>
              <p className="mt-1 text-[10.5px] font-bold leading-none" style={styles.muted}>
                {formatNumber(item?.orders)} órdenes
              </p>
            </div>
          </div>

          <div
            className="mt-3 h-2 overflow-hidden rounded-full"
            style={{
              border: '1px solid color-mix(in srgb, var(--admin-card-text) 10%, transparent)',
              background: 'color-mix(in srgb, var(--admin-card-text) 8%, transparent)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.24)',
            }}
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `${percentage}%`,
                background:
                  'linear-gradient(90deg, var(--admin-primary), color-mix(in srgb, var(--admin-primary) 54%, rgba(255,255,255,0.52)))',
                boxShadow:
                  '0 0 12px color-mix(in srgb, var(--admin-primary) 28%, transparent)',
              }}
            />
          </div>

          <div className="mt-1.5 flex justify-between text-[10.5px] font-black" style={styles.muted}>
            <span>{item?.label || 'Canal'}</span>
            <span>{percentage}% del total</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function CashMetric({ icon: Icon, label, value, helper }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[17px] p-3" style={nestedCardStyle}>
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px]"
          style={iconBoxStyle}
        >
          <Icon size={15} strokeWidth={2.4} />
        </span>

        <div className="min-w-0">
          <p className="text-[10.5px] font-black uppercase tracking-[0.13em]" style={styles.muted}>
            {label}
          </p>
          <p className="mt-1 text-[15px] font-black leading-none" style={styles.title}>
            {value}
          </p>
          {helper ? (
            <p className="mt-1 text-[10.5px] font-bold leading-[13px]" style={styles.muted}>
              {helper}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OpenSessionCard({ session }) {
  if (!session) return null;

  return (
    <div className="relative overflow-hidden rounded-[18px] p-3" style={nestedCardStyle}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-black leading-[15px]" style={styles.title}>
            {session.cashRegisterName || session.cashRegisterCode || 'Caja abierta'}
          </p>
          <p className="mt-1 text-[10.5px] font-bold leading-[13px]" style={styles.muted}>
            {session.branch || 'Sede sin nombre'} · {session.cashier || 'Cajero'}
          </p>
        </div>

        <span
          className="shrink-0 rounded-[12px] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.10em]"
          style={styles.statusSuccess}
        >
          Abierta
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <CashMetric
          icon={WalletCards}
          label="Esperado"
          value={session.expectedCashFormatted || formatMoney(session.expectedCash)}
        />
        <CashMetric
          icon={ReceiptText}
          label="Vendido"
          value={session.netSalesFormatted || formatMoney(session.netSales)}
        />
      </div>
    </div>
  );
}

export default function DashboardPosCashPanel({
  salesByChannel,
  cashSummary,
  onViewOrders,
  onViewCash,
}) {
  const channels = Array.isArray(salesByChannel?.channels) ? salesByChannel.channels : [];
  const mainSession = Array.isArray(cashSummary?.sessions) ? cashSummary.sessions[0] : null;

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)]">
      <PanelShell
        eyebrow="Canales de venta"
        title="POS vs Web"
        description="Distribución gerencial de ventas por origen durante el mes actual."
        actionLabel="Ver órdenes"
        onAction={onViewOrders}
      >
        <div className="relative overflow-hidden rounded-[22px] p-4" style={nestedCardStyle}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={styles.muted}>
                {salesByChannel?.periodLabel || 'Mes actual'}
              </p>
              <p
                className="mt-1 text-[30px] font-black leading-none tracking-[-0.05em]"
                style={{ color: 'var(--admin-primary)' }}
              >
                {salesByChannel?.totalSalesFormatted || formatMoney(salesByChannel?.totalSales)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[22px] font-black leading-none" style={styles.title}>
                {formatNumber(salesByChannel?.totalOrders)}
              </p>
              <p className="mt-1 text-[11px] font-bold leading-none" style={styles.muted}>
                órdenes del periodo
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-2.5">
          {channels.length > 0 ? (
            channels.map((channel) => <ChannelRow key={channel.id} item={channel} />)
          ) : (
            <p className="rounded-[18px] p-3 text-[12px] font-bold" style={styles.muted}>
              Todavía no hay ventas clasificadas por canal.
            </p>
          )}
        </div>
      </PanelShell>

      <PanelShell
        eyebrow="Caja POS"
        title="Resumen operativo"
        description="Estado actual de caja y ventas físicas del día."
        actionLabel="Abrir caja"
        onAction={onViewCash}
      >
        <div className="grid grid-cols-2 gap-2">
          <CashMetric
            icon={Banknote}
            label="POS hoy"
            value={cashSummary?.posSalesTodayFormatted || formatMoney(cashSummary?.posSalesToday)}
            helper={`${formatNumber(cashSummary?.posOrdersToday)} órdenes POS`}
          />
          <CashMetric
            icon={WalletCards}
            label="Efectivo"
            value={cashSummary?.expectedCashFormatted || formatMoney(cashSummary?.expectedCash)}
            helper={cashSummary?.statusLabel || 'Sin caja abierta'}
          />
          <CashMetric
            icon={ReceiptText}
            label="Caja hoy"
            value={cashSummary?.cashSalesTodayFormatted || formatMoney(cashSummary?.cashSalesToday)}
            helper={`${formatNumber(cashSummary?.sessionsToday)} sesiones registradas`}
          />
          <CashMetric
            icon={ClipboardCheck}
            label="Diferencia"
            value={cashSummary?.differenceTodayFormatted || formatMoney(cashSummary?.differenceToday)}
            helper={`${formatNumber(cashSummary?.closedSessionsToday)} cierres hoy`}
          />
        </div>

        {mainSession ? (
          <OpenSessionCard session={mainSession} />
        ) : (
          <div className="relative overflow-hidden rounded-[18px] p-3" style={nestedCardStyle}>
            <p className="text-[12px] font-black leading-[15px]" style={styles.title}>
              No hay caja abierta en este momento.
            </p>
            <p className="mt-1 text-[10.5px] font-bold leading-[13px]" style={styles.muted}>
              Al abrir una caja POS, aquí verás efectivo esperado, ventas y responsable.
            </p>
          </div>
        )}
      </PanelShell>
    </div>
  );
}
