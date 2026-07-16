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

const TEXT = {
  title: {
    color: 'var(--admin-card-text)',
    textShadow: '0 1px 0 color-mix(in srgb, var(--admin-card-bg) 58%, transparent)',
  },
  muted: {
    color: 'color-mix(in srgb, var(--admin-card-text) 76%, var(--admin-card-muted-text) 24%)',
    textShadow: '0 1px 0 color-mix(in srgb, var(--admin-card-bg) 50%, transparent)',
  },
  soft: {
    color: 'color-mix(in srgb, var(--admin-card-text) 66%, var(--admin-card-muted-text) 34%)',
  },
  eyebrow: {
    color: 'var(--admin-primary)',
    textShadow: '0 0 10px color-mix(in srgb, var(--admin-primary) 18%, transparent)',
  },
  value: {
    color: 'var(--admin-primary)',
    textShadow: '0 0 12px color-mix(in srgb, var(--admin-primary) 20%, transparent)',
  },
};

const SURFACE = {
  panel: {
    borderRadius: '24px',
    border:
      '1px solid color-mix(in srgb, var(--admin-primary) 22%, rgba(255,255,255,0.38))',
    background: `
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--admin-card-bg) 92%, rgba(255,255,255,0.08)) 0%,
        color-mix(in srgb, var(--admin-card-bg) 86%, var(--admin-primary) 7%) 56%,
        color-mix(in srgb, var(--admin-card-bg) 90%, rgba(255,255,255,0.06)) 100%
      )
    `,
    boxShadow: `
      inset 0 1px 0 color-mix(in srgb, rgba(255,255,255,0.46) 62%, var(--admin-card-bg) 38%),
      inset 0 -1px 0 rgba(15,23,42,0.10),
      0 16px 36px rgba(12,6,35,0.105),
      0 0 22px color-mix(in srgb, var(--admin-primary) 7%, transparent)
    `,
    backdropFilter: 'blur(18px) saturate(168%)',
    WebkitBackdropFilter: 'blur(18px) saturate(168%)',
  },
  card: {
    border:
      '1px solid color-mix(in srgb, var(--admin-primary) 18%, rgba(255,255,255,0.34))',
    background: `
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--admin-card-bg) 88%, rgba(255,255,255,0.10)) 0%,
        color-mix(in srgb, var(--admin-card-bg) 90%, var(--admin-primary) 5%) 60%,
        color-mix(in srgb, var(--admin-card-bg) 92%, rgba(255,255,255,0.04)) 100%
      )
    `,
    boxShadow: `
      inset 0 1px 0 color-mix(in srgb, rgba(255,255,255,0.42) 60%, var(--admin-card-bg) 40%),
      0 8px 18px rgba(12,6,35,0.060)
    `,
  },
  button: {
    border:
      '1px solid color-mix(in srgb, var(--admin-primary) 24%, rgba(255,255,255,0.40))',
    background: `
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--admin-card-bg) 82%, rgba(255,255,255,0.18)) 0%,
        color-mix(in srgb, var(--admin-card-bg) 88%, var(--admin-primary) 8%) 100%
      )
    `,
    color: 'var(--admin-card-text)',
    boxShadow: `
      inset 0 1px 0 color-mix(in srgb, rgba(255,255,255,0.54) 60%, var(--admin-card-bg) 40%),
      0 8px 16px rgba(12,6,35,0.075)
    `,
  },
};

function GlassIcon({ children }) {
  return (
    <span
      className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[15px]"
      style={{
        border:
          '1px solid color-mix(in srgb, var(--admin-primary) 28%, rgba(255,255,255,0.42))',
        background: `
          linear-gradient(
            145deg,
            color-mix(in srgb, var(--admin-card-bg) 82%, rgba(255,255,255,0.12)) 0%,
            color-mix(in srgb, var(--admin-card-bg) 88%, var(--admin-primary) 9%) 100%
          )
        `,
        color: 'var(--admin-primary)',
        boxShadow: `
          inset 0 1px 0 color-mix(in srgb, rgba(255,255,255,0.50) 60%, var(--admin-card-bg) 40%),
          0 9px 18px rgba(12,6,35,0.075),
          0 0 14px color-mix(in srgb, var(--admin-primary) 15%, transparent)
        `,
        backdropFilter: 'blur(16px) saturate(175%)',
        WebkitBackdropFilter: 'blur(16px) saturate(175%)',
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-[7px] top-[4px] h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.78), transparent)',
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
      style={SURFACE.panel}
    >
      <span
        className="pointer-events-none absolute inset-x-10 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.74), transparent)',
        }}
      />

      <span
        className="pointer-events-none absolute -right-10 -top-14 h-[170px] w-[34px] rotate-[34deg]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), rgba(255,255,255,0.18), rgba(255,255,255,0.05), transparent)',
          opacity: 0.28,
          filter: 'blur(0.4px)',
        }}
      />

      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-[10.5px] font-black uppercase tracking-[0.24em]"
              style={TEXT.eyebrow}
            >
              {eyebrow}
            </p>
            <h3 className="mt-1 text-[17px] font-black leading-tight" style={TEXT.title}>
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-[11.5px] font-semibold leading-[15px]" style={TEXT.muted}>
                {description}
              </p>
            ) : null}
          </div>

          {actionLabel && typeof onAction === 'function' ? (
            <button
              type="button"
              onClick={onAction}
              className="relative inline-flex h-9 shrink-0 items-center justify-center overflow-hidden rounded-[14px] px-3 text-[11px] font-black"
              style={SURFACE.button}
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
    <article className="relative overflow-hidden rounded-[18px] p-3" style={SURFACE.card}>
      <div className="flex items-start gap-3">
        <GlassIcon>
          <Icon size={18} strokeWidth={2.35} />
        </GlassIcon>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12.5px] font-black leading-[15px]" style={TEXT.title}>
                {item?.title || item?.label || 'Canal'}
              </p>
              <p className="mt-0.5 text-[10.5px] font-bold leading-[13px]" style={TEXT.muted}>
                {item?.description || 'Ventas del periodo'}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[14px] font-black leading-none" style={TEXT.value}>
                {item?.amountFormatted || formatMoney(item?.amount)}
              </p>
              <p className="mt-1 text-[10.5px] font-bold leading-none" style={TEXT.muted}>
                {formatNumber(item?.orders)} órdenes
              </p>
            </div>
          </div>

          <div
            className="mt-3 h-2 overflow-hidden rounded-full"
            style={{
              border:
                '1px solid color-mix(in srgb, var(--admin-card-text) 12%, transparent)',
              background: 'color-mix(in srgb, var(--admin-card-text) 9%, transparent)',
              boxShadow: 'inset 0 1px 0 color-mix(in srgb, rgba(255,255,255,0.22) 60%, transparent)',
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

          <div className="mt-1.5 flex justify-between text-[10.5px] font-black" style={TEXT.muted}>
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
    <div className="relative min-w-0 overflow-hidden rounded-[17px] p-3" style={SURFACE.card}>
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px]"
          style={{
            color: 'var(--admin-primary)',
            border:
              '1px solid color-mix(in srgb, var(--admin-primary) 22%, rgba(255,255,255,0.34))',
            background:
              'color-mix(in srgb, var(--admin-card-bg) 84%, var(--admin-primary) 8%)',
          }}
        >
          <Icon size={15} strokeWidth={2.4} />
        </span>

        <div className="min-w-0">
          <p className="text-[10.5px] font-black uppercase tracking-[0.13em]" style={TEXT.muted}>
            {label}
          </p>
          <p className="mt-1 text-[15px] font-black leading-none" style={TEXT.title}>
            {value}
          </p>
          {helper ? (
            <p className="mt-1 text-[10.5px] font-bold leading-[13px]" style={TEXT.muted}>
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
    <div className="relative overflow-hidden rounded-[18px] p-3" style={SURFACE.card}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-black leading-[15px]" style={TEXT.title}>
            {session.cashRegisterName || session.cashRegisterCode || 'Caja abierta'}
          </p>
          <p className="mt-1 text-[10.5px] font-bold leading-[13px]" style={TEXT.muted}>
            {session.branch || 'Sede sin nombre'} · {session.cashier || 'Cajero'}
          </p>
        </div>

        <span
          className="shrink-0 rounded-[12px] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.10em]"
          style={{
            border: '1px solid rgba(34,197,94,0.24)',
            background: 'rgba(34,197,94,0.14)',
            color: '#22c55e',
            textShadow: '0 0 8px rgba(34,197,94,0.18)',
          }}
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
        <div className="relative overflow-hidden rounded-[22px] p-4" style={SURFACE.card}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={TEXT.muted}>
                {salesByChannel?.periodLabel || 'Mes actual'}
              </p>
              <p
                className="mt-1 text-[30px] font-black leading-none tracking-[-0.05em]"
                style={TEXT.value}
              >
                {salesByChannel?.totalSalesFormatted || formatMoney(salesByChannel?.totalSales)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[22px] font-black leading-none" style={TEXT.title}>
                {formatNumber(salesByChannel?.totalOrders)}
              </p>
              <p className="mt-1 text-[11px] font-bold leading-none" style={TEXT.muted}>
                órdenes del periodo
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-2.5">
          {channels.length > 0 ? (
            channels.map((channel) => <ChannelRow key={channel.id} item={channel} />)
          ) : (
            <p className="rounded-[18px] p-3 text-[12px] font-bold" style={TEXT.muted}>
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
          <div className="relative overflow-hidden rounded-[18px] p-3" style={SURFACE.card}>
            <p className="text-[12px] font-black leading-[15px]" style={TEXT.title}>
              No hay caja abierta en este momento.
            </p>
            <p className="mt-1 text-[10.5px] font-bold leading-[13px]" style={TEXT.muted}>
              Al abrir una caja POS, aquí verás efectivo esperado, ventas y responsable.
            </p>
          </div>
        )}
      </PanelShell>
    </div>
  );
}
