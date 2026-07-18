// frontend/src/admin/dashboard/components/DashboardPosCashPanel.jsx

import {
  BadgeDollarSign,
  Banknote,
  ClipboardCheck,
  Edit3,
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

const PANEL_FRAME = {
  border:
    '1px solid color-mix(in srgb, var(--admin-primary) 20%, rgba(255,255,255,0.44))',
  background: `
    linear-gradient(
      145deg,
      rgba(255,255,255,0.052) 0%,
      rgba(255,255,255,0.012) 48%,
      color-mix(in srgb, var(--admin-primary) 5%, transparent) 100%
    )
  `,
  boxShadow: `
    inset 0 1px 0 rgba(255,255,255,0.50),
    inset 0 -1px 0 rgba(15,23,42,0.12),
    0 16px 32px rgba(12,6,35,0.070),
    0 0 18px color-mix(in srgb, var(--admin-primary) 10%, transparent)
  `,
  backdropFilter: 'blur(18px) saturate(180%)',
  WebkitBackdropFilter: 'blur(18px) saturate(180%)',
};

const PANEL_BODY = {
  background: `
    linear-gradient(
      145deg,
      rgba(255,255,255,0.042) 0%,
      rgba(255,255,255,0.010) 52%,
      color-mix(in srgb, var(--admin-primary) 3%, transparent) 100%
    )
  `,
  boxShadow: `
    inset 0 1px 0 rgba(255,255,255,0.34),
    inset 0 -1px 0 rgba(15,23,42,0.10)
  `,
  backdropFilter: 'blur(14px) saturate(165%)',
  WebkitBackdropFilter: 'blur(14px) saturate(165%)',
};

const GLASS_CARD = {
  border:
    '1px solid color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.30))',
  background: `
    linear-gradient(
      145deg,
      rgba(255,255,255,0.034) 0%,
      rgba(255,255,255,0.008) 52%,
      color-mix(in srgb, var(--admin-primary) 4%, transparent) 100%
    )
  `,
  boxShadow: `
    inset 0 1px 0 rgba(255,255,255,0.28),
    inset 0 -1px 0 rgba(15,23,42,0.10),
    0 8px 16px rgba(12,6,35,0.040),
    0 0 10px color-mix(in srgb, var(--admin-primary) 7%, transparent)
  `,
  backdropFilter: 'blur(13px) saturate(160%)',
  WebkitBackdropFilter: 'blur(13px) saturate(160%)',
};

const GLASS_BUTTON = {
  border:
    '1px solid color-mix(in srgb, var(--admin-primary) 18%, rgba(255,255,255,0.36))',
  background: `
    linear-gradient(
      145deg,
      rgba(255,255,255,0.046) 0%,
      rgba(255,255,255,0.010) 54%,
      color-mix(in srgb, var(--admin-primary) 4%, transparent) 100%
    )
  `,
  color: 'var(--admin-card-text)',
  boxShadow: `
    inset 0 1px 0 rgba(255,255,255,0.38),
    inset 0 -1px 0 rgba(15,23,42,0.12),
    0 7px 14px rgba(12,6,35,0.050),
    0 0 10px color-mix(in srgb, var(--admin-primary) 10%, transparent)
  `,
  backdropFilter: 'blur(14px) saturate(165%)',
  WebkitBackdropFilter: 'blur(14px) saturate(165%)',
};

function GlassIcon({ children, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'h-8 w-8 rounded-[13px]' : 'h-10 w-10 rounded-[15px]';

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${sizeClass}`}
      style={{
        border:
          '1px solid color-mix(in srgb, var(--admin-primary) 22%, rgba(255,255,255,0.38))',
        background: `
          linear-gradient(
            145deg,
            rgba(255,255,255,0.050) 0%,
            rgba(255,255,255,0.012) 52%,
            color-mix(in srgb, var(--admin-primary) 5%, transparent) 100%
          )
        `,
        color: 'var(--admin-primary)',
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.44),
          inset 0 -1px 0 rgba(15,23,42,0.14),
          0 7px 15px rgba(12,6,35,0.055),
          0 0 13px color-mix(in srgb, var(--admin-primary) 15%, transparent)
        `,
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-[7px] top-[3px] h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.82), transparent)',
          opacity: 0.9,
        }}
      />

      <span
        className="pointer-events-none absolute right-[6px] top-[6px] h-[4px] w-[4px] rounded-full"
        style={{
          background: 'rgba(255,255,255,0.90)',
          boxShadow:
            '0 0 7px rgba(255,255,255,0.75), 0 0 12px color-mix(in srgb, var(--admin-primary) 24%, transparent)',
        }}
      />

      <span className="relative z-10">{children}</span>
    </span>
  );
}

function GlassButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dashboard-pos-button relative inline-flex h-8 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[13px] px-2.5 text-[10.5px] font-black"
      style={GLASS_BUTTON}
    >
      <span
        className="dashboard-pos-button-shine pointer-events-none absolute -left-8 top-[-16px] h-[54px] w-[12px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)',
        }}
      />
      <Edit3 size={12} className="relative z-10" />
      <span className="relative z-10">{children}</span>
    </button>
  );
}

function PanelShell({ eyebrow, title, description, actionLabel, onAction, children }) {
  return (
    <section
      className="dashboard-pos-panel relative h-full min-h-0 overflow-hidden rounded-[27px] p-[1px]"
      style={PANEL_FRAME}
    >
      <style>
        {`
          @keyframes dashboardPosPanelEnter {
            from { opacity: 0; transform: translateY(12px) scale(0.985); filter: blur(5px); }
            to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
          }

          @keyframes dashboardPosShine {
            0% { transform: translateX(-145%) rotate(28deg); opacity: 0; }
            36% { opacity: 0.38; }
            100% { transform: translateX(185%) rotate(28deg); opacity: 0; }
          }

          .dashboard-pos-panel { animation: dashboardPosPanelEnter 520ms ease-out both; }
          .dashboard-pos-button { transition: transform 180ms ease, filter 180ms ease, border-color 180ms ease, box-shadow 180ms ease; }
          .dashboard-pos-button:hover { transform: translateY(-1px); filter: brightness(1.025) saturate(1.05); }
          .dashboard-pos-button-shine { animation: dashboardPosShine 3.3s ease-in-out infinite; }

          @media (prefers-reduced-motion: reduce) {
            .dashboard-pos-panel,
            .dashboard-pos-button,
            .dashboard-pos-button-shine { animation: none !important; transition: none !important; }
          }
        `}
      </style>

      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] px-4 py-3" style={PANEL_BODY}>
        <span
          className="pointer-events-none absolute inset-x-8 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.78), color-mix(in srgb, var(--admin-primary) 18%, rgba(255,255,255,0.42)), transparent)',
          }}
        />

        <span
          className="pointer-events-none absolute left-0 top-12 h-[calc(100%-96px)] w-px"
          style={{
            background:
              'linear-gradient(180deg, transparent, color-mix(in srgb, var(--admin-primary) 56%, rgba(255,255,255,0.44)), transparent)',
            boxShadow:
              '0 0 12px color-mix(in srgb, var(--admin-primary) 26%, transparent)',
          }}
        />

        <span
          className="pointer-events-none absolute -right-12 -top-16 h-[230px] w-[48px] rotate-[34deg]"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), rgba(255,255,255,0.23), rgba(255,255,255,0.06), transparent)',
            opacity: 0.30,
            filter: 'blur(0.8px)',
          }}
        />

        <div className="relative z-10 mb-3 flex shrink-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10.5px] font-black uppercase tracking-[0.24em]" style={styles.eyebrow}>
              {eyebrow}
            </p>
            <h3 className="mt-1 text-[16px] font-black leading-[17px]" style={styles.title}>
              {title}
            </h3>
            {description ? (
              <p
                className="mt-0.5 text-[11.5px] font-semibold leading-[15px]"
                style={{
                  ...styles.muted,
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {description}
              </p>
            ) : null}
          </div>

          {actionLabel && typeof onAction === 'function' ? (
            <GlassButton onClick={onAction}>{actionLabel}</GlassButton>
          ) : null}
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2.5">{children}</div>
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
    <article className="relative overflow-hidden rounded-[20px] px-3 py-3" style={GLASS_CARD}>
      <span
        className="pointer-events-none absolute left-0 top-3 h-[calc(100%-24px)] w-px"
        style={{
          background:
            'linear-gradient(180deg, transparent, color-mix(in srgb, var(--admin-primary) 58%, rgba(255,255,255,0.44)), transparent)',
        }}
      />

      <div className="relative z-10 flex items-start gap-3">
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

            <div className="shrink-0 text-right">
              <p
                className="text-[14px] font-black leading-none"
                style={{
                  color: 'var(--admin-primary)',
                  textShadow:
                    '0 0 10px color-mix(in srgb, var(--admin-primary) 18%, transparent)',
                }}
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
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.060)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.26), inset 0 -1px 0 rgba(15,23,42,0.12)',
            }}
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `${percentage}%`,
                background:
                  'linear-gradient(90deg, var(--admin-primary), color-mix(in srgb, var(--admin-primary) 58%, rgba(255,255,255,0.45)))',
                boxShadow:
                  '0 0 14px color-mix(in srgb, var(--admin-primary) 34%, transparent)',
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
    <div className="relative min-w-0 overflow-hidden rounded-[18px] px-3 py-3" style={GLASS_CARD}>
      <div className="relative z-10 flex items-start gap-2.5">
        <GlassIcon size="sm">
          <Icon size={15} strokeWidth={2.4} />
        </GlassIcon>

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
    <div className="relative overflow-hidden rounded-[20px] px-3 py-3" style={GLASS_CARD}>
      <div className="relative z-10 flex items-start justify-between gap-3">
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

      <div className="relative z-10 mt-3 grid grid-cols-2 gap-2">
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
        <div className="relative overflow-hidden rounded-[20px] px-4 py-4" style={GLASS_CARD}>
          <span
            className="pointer-events-none absolute inset-x-5 top-0 h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
            }}
          />
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={styles.muted}>
                {salesByChannel?.periodLabel || 'Mes actual'}
              </p>
              <p
                className="mt-1.5 text-[30px] font-black leading-none tracking-[-0.05em]"
                style={{
                  color: 'var(--admin-primary)',
                  textShadow:
                    '0 0 14px color-mix(in srgb, var(--admin-primary) 22%, transparent)',
                }}
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
          <div className="relative overflow-hidden rounded-[20px] px-3 py-3" style={GLASS_CARD}>
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
