// frontend/src/admin/dashboard/components/DashboardRecentOrders.jsx

import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Hash,
  ReceiptText,
  UserRound,
} from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

function getStatusStyle(statusType) {
  const statusMap = {
    success: {
      color: '#15803d',
      border: '1px solid rgba(34,197,94,0.34)',
      background:
        'linear-gradient(135deg, rgba(240,253,244,0.96), rgba(220,252,231,0.82))',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.88), 0 5px 12px rgba(34,197,94,0.12)',
    },
    warning: {
      color: '#d97706',
      border: '1px solid rgba(245,158,11,0.34)',
      background:
        'linear-gradient(135deg, rgba(255,251,235,0.96), rgba(254,243,199,0.82))',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.88), 0 5px 12px rgba(245,158,11,0.12)',
    },
    info: {
      color: '#2563eb',
      border: '1px solid rgba(59,130,246,0.32)',
      background:
        'linear-gradient(135deg, rgba(239,246,255,0.96), rgba(219,234,254,0.82))',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.88), 0 5px 12px rgba(59,130,246,0.12)',
    },
    danger: {
      color: '#e11d48',
      border: '1px solid rgba(244,63,94,0.32)',
      background:
        'linear-gradient(135deg, rgba(255,241,242,0.96), rgba(255,228,230,0.82))',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.88), 0 5px 12px rgba(244,63,94,0.12)',
    },
  };

  return statusMap[statusType] || statusMap.info;
}

function DiamondGlints({ small = false }) {
  const size = small ? 3.5 : 4.5;

  return (
    <>
      <span
        className="pointer-events-none absolute right-[7px] top-[6px] rounded-full recent-orders-diamond-dot"
        style={{
          width: size,
          height: size,
          background: 'rgba(255,255,255,0.88)',
          boxShadow: `
            0 0 5px rgba(255,255,255,0.76),
            0 0 10px color-mix(in srgb, var(--admin-primary) 20%, transparent)
          `,
        }}
      />

      <span
        className="pointer-events-none absolute right-[1px] top-[8px] h-px w-[16px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.70), transparent)',
          opacity: 0.7,
        }}
      />

      <span
        className="pointer-events-none absolute right-[8px] top-[1px] h-[16px] w-px"
        style={{
          background:
            'linear-gradient(180deg, transparent, rgba(255,255,255,0.60), transparent)',
          opacity: 0.56,
        }}
      />
    </>
  );
}

export default function DashboardRecentOrders({ orders = [] }) {
  const visibleOrders = orders.slice(0, 5);

  const rootStyle = {
    border:
      '1px solid color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.78))',
    background: `
      linear-gradient(
        145deg,
        rgba(255,255,255,0.40) 0%,
        rgba(255,255,255,0.18) 48%,
        color-mix(in srgb, var(--admin-primary) 9%, rgba(255,255,255,0.10)) 100%
      )
    `,
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,1),
      inset 0 -1px 0 rgba(15,23,42,0.05),
      0 18px 38px rgba(12,6,35,0.08),
      0 0 18px color-mix(in srgb, var(--admin-primary) 10%, transparent)
    `,
    backdropFilter: 'blur(26px) saturate(185%)',
    WebkitBackdropFilter: 'blur(26px) saturate(185%)',
  };

  const shellStyle = {
    background: `
      linear-gradient(
        145deg,
        rgba(255,255,255,0.28) 0%,
        rgba(255,255,255,0.10) 48%,
        color-mix(in srgb, var(--admin-primary) 6%, rgba(255,255,255,0.04)) 100%
      )
    `,
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.86),
      inset 0 -1px 0 rgba(15,23,42,0.05)
    `,
    backdropFilter: 'blur(20px) saturate(170%)',
    WebkitBackdropFilter: 'blur(20px) saturate(170%)',
  };

  const iconChipStyle = {
    border:
      '1px solid color-mix(in srgb, var(--admin-primary) 20%, rgba(255,255,255,0.78))',
    background: `
      linear-gradient(
        145deg,
        rgba(255,255,255,0.58) 0%,
        rgba(255,255,255,0.24) 52%,
        color-mix(in srgb, var(--admin-primary) 10%, rgba(255,255,255,0.10)) 100%
      )
    `,
    color: 'var(--admin-primary)',
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,1),
      inset 0 -1px 0 rgba(15,23,42,0.08),
      0 10px 24px rgba(12,6,35,0.08),
      0 0 14px color-mix(in srgb, var(--admin-primary) 14%, transparent)
    `,
    backdropFilter: 'blur(18px) saturate(175%)',
    WebkitBackdropFilter: 'blur(18px) saturate(175%)',
  };

  const buttonStyle = {
    border:
      '1px solid color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.72))',
    background: `
      linear-gradient(
        145deg,
        rgba(255,255,255,0.44) 0%,
        rgba(255,255,255,0.18) 52%,
        color-mix(in srgb, var(--admin-primary) 7%, rgba(255,255,255,0.08)) 100%
      )
    `,
    color: 'var(--admin-card-text)',
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.92),
      inset 0 -1px 0 rgba(15,23,42,0.07),
      0 8px 18px rgba(12,6,35,0.07)
    `,
    backdropFilter: 'blur(14px) saturate(165%)',
    WebkitBackdropFilter: 'blur(14px) saturate(165%)',
  };

  const tableStyle = {
    border:
      '1px solid color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.76))',
    background: `
      linear-gradient(
        145deg,
        rgba(255,255,255,0.30) 0%,
        rgba(255,255,255,0.10) 48%,
        color-mix(in srgb, var(--admin-primary) 7%, rgba(255,255,255,0.04)) 100%
      )
    `,
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.86),
      inset 0 -1px 0 rgba(15,23,42,0.05),
      0 12px 24px rgba(12,6,35,0.055)
    `,
    backdropFilter: 'blur(18px) saturate(165%)',
    WebkitBackdropFilter: 'blur(18px) saturate(165%)',
  };

  return (
    <section
      className="dashboard-recent-orders-panel relative flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] p-[1px]"
      style={rootStyle}
    >
      <style>
        {`
          @keyframes recentOrdersEnter {
            0% {
              opacity: 0;
              transform: translateY(14px) scale(0.988);
              filter: blur(8px);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }

          @keyframes recentOrdersRowEnter {
            0% {
              opacity: 0;
              transform: translateY(8px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes recentOrdersShine {
            0% {
              transform: translateX(-130%) rotate(28deg);
              opacity: 0;
            }
            35% {
              opacity: 0.34;
            }
            100% {
              transform: translateX(170%) rotate(28deg);
              opacity: 0;
            }
          }

          @keyframes recentOrdersDotPulse {
            0%, 100% {
              opacity: 0.72;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.16);
            }
          }

          .dashboard-recent-orders-panel {
            animation: recentOrdersEnter 540ms ease-out both;
          }

          .recent-orders-row {
            animation: recentOrdersRowEnter 420ms ease-out both;
            transition:
              background 180ms ease,
              transform 180ms ease,
              filter 180ms ease;
          }

          .recent-orders-row:hover {
            transform: translateY(-1px);
            filter: brightness(1.025) saturate(1.035);
            background:
              linear-gradient(
                135deg,
                rgba(255,255,255,0.34),
                color-mix(in srgb, var(--admin-primary) 6%, rgba(255,255,255,0.10))
              ) !important;
          }

          .recent-orders-table-shine {
            animation: recentOrdersShine 4.2s ease-in-out infinite;
          }

          .recent-orders-diamond-dot {
            animation: recentOrdersDotPulse 3.4s ease-in-out infinite;
          }

          .recent-orders-button {
            transition:
              transform 180ms ease,
              box-shadow 180ms ease,
              border-color 180ms ease;
          }

          .recent-orders-button:hover {
            transform: translateY(-1px);
            border-color: color-mix(in srgb, var(--admin-primary) 24%, rgba(255,255,255,0.84)) !important;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.96),
              inset 0 -1px 0 rgba(15,23,42,0.07),
              0 10px 20px rgba(12,6,35,0.08) !important;
          }

          @media (prefers-reduced-motion: reduce) {
            .dashboard-recent-orders-panel,
            .recent-orders-row,
            .recent-orders-table-shine,
            .recent-orders-diamond-dot {
              animation: none !important;
              transition: none !important;
            }

            .recent-orders-row:hover,
            .recent-orders-button:hover {
              transform: none !important;
            }
          }
        `}
      </style>

      <div
        className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[27px] px-5 py-4 lg:px-6 lg:py-5"
        style={shellStyle}
      >
        <span
          className="pointer-events-none absolute inset-x-10 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)',
            opacity: 0.92,
          }}
        />

        <span
          className="pointer-events-none absolute -right-10 -top-10 h-[220px] w-[58px] rotate-[34deg]"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), rgba(255,255,255,0.32), rgba(255,255,255,0.08), transparent)',
            opacity: 0.36,
            filter: 'blur(1px)',
          }}
        />

        <div className="relative z-10 mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px]"
              style={iconChipStyle}
            >
              <DiamondGlints />
              <ClipboardList
                size={20}
                strokeWidth={2.2}
                style={{
                  filter:
                    'drop-shadow(0 0 6px color-mix(in srgb, var(--admin-primary) 34%, transparent))',
                }}
              />
            </span>

            <div className="min-w-0">
              <h2 className="text-[17px] font-black leading-none" style={styles.title}>
                Órdenes recientes
              </h2>

              <p
                className="mt-1.5 text-[13px] font-semibold leading-5"
                style={{
                  ...styles.muted,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                Últimos pedidos registrados en la tienda.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="recent-orders-button inline-flex shrink-0 items-center gap-1.5 rounded-[14px] px-4 py-2 text-[12px] font-black"
            style={buttonStyle}
          >
            Ver todas
            <ChevronRight size={14} />
          </button>
        </div>

        <div
          className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px]"
          style={tableStyle}
        >
          <span
            className="recent-orders-table-shine pointer-events-none absolute -left-12 top-0 h-full w-[18px]"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
            }}
          />

          <div
            className="
              grid shrink-0 grid-cols-[minmax(0,1.35fr)_92px_104px_92px]
              items-center gap-2 px-4 py-3
              text-[10px] font-black uppercase tracking-[0.07em]
            "
            style={{
              color: 'var(--admin-card-muted-text)',
              borderBottom:
                '1px solid color-mix(in srgb, var(--admin-primary) 14%, rgba(255,255,255,0.42))',
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.26), rgba(255,255,255,0.09))',
            }}
          >
            <span>Orden / cliente</span>
            <span>Total</span>
            <span>Estado</span>
            <span className="text-right">Fecha</span>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-5">
            {visibleOrders.length > 0 ? (
              visibleOrders.map((order, index) => (
                <article
                  key={order.id}
                  className="
                    recent-orders-row grid min-h-0
                    grid-cols-[minmax(0,1.35fr)_92px_104px_92px]
                    items-center gap-2 px-4
                  "
                  style={{
                    borderBottom:
                      index === visibleOrders.length - 1
                        ? 'none'
                        : '1px solid color-mix(in srgb, var(--admin-primary) 12%, rgba(255,255,255,0.34))',
                    background:
                      index % 2 === 0
                        ? 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.055))'
                        : 'linear-gradient(135deg, rgba(255,255,255,0.11), rgba(255,255,255,0.035))',
                    animationDelay: `${110 + index * 55}ms`,
                  }}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Hash
                        size={13}
                        strokeWidth={2.4}
                        style={{ color: 'var(--admin-primary)' }}
                      />

                      <p className="truncate text-[12.5px] font-black" style={styles.title}>
                        {order.id}
                      </p>
                    </div>

                    <div className="mt-1 flex min-w-0 items-center gap-1.5">
                      <UserRound size={11.5} strokeWidth={2.2} style={styles.muted} />

                      <p
                        className="min-w-0 truncate text-[11px] font-semibold"
                        style={styles.muted}
                        title={order.customer}
                      >
                        {order.customer}
                      </p>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center gap-1.5">
                    <ReceiptText
                      size={12.5}
                      strokeWidth={2.2}
                      style={{ color: 'var(--admin-primary)' }}
                    />

                    <p
                      className="truncate text-[11.5px] font-black"
                      style={styles.title}
                      title={order.total}
                    >
                      {order.total}
                    </p>
                  </div>

                  <span
                    className="inline-flex w-full items-center justify-center rounded-full px-2 py-1.5 text-[10.5px] font-black"
                    style={getStatusStyle(order.statusType)}
                    title={order.status}
                  >
                    <span className="truncate">{order.status}</span>
                  </span>

                  <div className="flex min-w-0 items-center justify-end gap-1">
                    <CalendarDays
                      size={12.5}
                      strokeWidth={2.2}
                      style={{ color: 'var(--admin-primary)' }}
                    />

                    <p
                      className="min-w-0 truncate text-right text-[10.8px] font-semibold"
                      style={styles.muted}
                      title={order.date}
                    >
                      {order.date}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-bold" style={styles.muted}>
                No hay órdenes recientes para mostrar.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}