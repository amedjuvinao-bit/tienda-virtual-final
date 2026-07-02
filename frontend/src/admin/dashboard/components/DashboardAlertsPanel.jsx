// frontend/src/admin/dashboard/components/DashboardAlertsPanel.jsx

import {
  AlertTriangle,
  ChevronRight,
  Clock3,
  ImageOff,
  PackageSearch,
  Tags,
} from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

const MAX_VISIBLE_ALERTS = 3;

const alertIconMap = {
  stock: PackageSearch,
  category: Tags,
  image: ImageOff,
  orders: Clock3,
};

function normalizeAlert(alert = {}, index = 0) {
  return {
    id: alert.id || `dashboard-alert-${index + 1}`,
    title: alert.title || 'Alerta pendiente',
    description: alert.description || 'Revisa esta información del dashboard.',
    action: alert.action || 'Revisar',
    type: alert.type || 'general',
  };
}

function GlassIcon({ children, large = false }) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${
        large ? 'h-11 w-11 rounded-[18px]' : 'h-8 w-8 rounded-[13px]'
      }`}
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

      <span
        className="alert-icon-shine pointer-events-none absolute -right-3 -top-6 h-14 w-[5px] rotate-[34deg]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.34), transparent)',
          opacity: 0.48,
        }}
      />

      <span className="relative z-10">{children}</span>
    </span>
  );
}

function GlassButton({ children, large = false }) {
  return (
    <button
      type="button"
      className={`alert-pro-button relative inline-flex shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[13px] font-black ${
        large ? 'h-9 px-3 text-[11px]' : 'h-8 px-2.5 text-[10.5px]'
      }`}
      style={{
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
      }}
    >
      <span
        className="alert-button-shine pointer-events-none absolute -left-8 top-[-16px] h-[54px] w-[12px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)',
        }}
      />

      <span className="relative z-10">{children}</span>
      <ChevronRight size={12} className="relative z-10" />
    </button>
  );
}

export default function DashboardAlertsPanel({ alerts = [] }) {
  const visibleAlerts = alerts
    .slice(0, MAX_VISIBLE_ALERTS)
    .map((alert, index) => normalizeAlert(alert, index));

  const hasAlerts = visibleAlerts.length > 0;
  const isSingleAlert = visibleAlerts.length === 1;

  return (
    <section
      className="alerts-pro-panel relative h-full min-h-0 self-stretch overflow-hidden rounded-[27px] p-[1px]"
      style={{
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
      }}
    >
      <style>
        {`
          @keyframes alertsPanelEnter {
            from {
              opacity: 0;
              transform: translateY(12px) scale(0.985);
              filter: blur(5px);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }

          @keyframes alertRowEnter {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes alertShine {
            0% {
              transform: translateX(-145%) rotate(28deg);
              opacity: 0;
            }
            36% {
              opacity: 0.42;
            }
            100% {
              transform: translateX(185%) rotate(28deg);
              opacity: 0;
            }
          }

          @keyframes alertEdgePulse {
            0%, 100% {
              opacity: 0.46;
            }
            50% {
              opacity: 0.88;
            }
          }

          .alerts-pro-panel {
            animation: alertsPanelEnter 520ms ease-out both;
          }

          .alert-pro-row {
            animation: alertRowEnter 440ms ease-out both;
            transition:
              transform 180ms ease,
              filter 180ms ease,
              border-color 180ms ease,
              box-shadow 180ms ease;
          }

          .alert-pro-row:hover {
            transform: translateY(-2px);
            filter: brightness(1.025) saturate(1.05);
            border-color: color-mix(in srgb, var(--admin-primary) 32%, rgba(255,255,255,0.42)) !important;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.38),
              inset 0 -1px 0 rgba(15,23,42,0.12),
              0 11px 22px rgba(12,6,35,0.070),
              0 0 16px color-mix(in srgb, var(--admin-primary) 14%, transparent) !important;
          }

          .alert-pro-row:hover .alert-row-accent {
            opacity: 1;
          }

          .alert-pro-button {
            transition:
              transform 180ms ease,
              filter 180ms ease,
              border-color 180ms ease,
              box-shadow 180ms ease;
          }

          .alert-pro-button:hover {
            transform: translateY(-1px);
            filter: brightness(1.025) saturate(1.05);
            border-color: color-mix(in srgb, var(--admin-primary) 30%, rgba(255,255,255,0.42)) !important;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.46),
              inset 0 -1px 0 rgba(15,23,42,0.12),
              0 9px 18px rgba(12,6,35,0.070),
              0 0 15px color-mix(in srgb, var(--admin-primary) 14%, transparent) !important;
          }

          .alert-button-shine {
            animation: alertShine 3.3s ease-in-out infinite;
          }

          .alert-icon-shine {
            animation: alertEdgePulse 3.4s ease-in-out infinite;
          }

          .alert-panel-edge {
            animation: alertEdgePulse 3.8s ease-in-out infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .alerts-pro-panel,
            .alert-pro-row,
            .alert-button-shine,
            .alert-icon-shine,
            .alert-panel-edge {
              animation: none !important;
            }
          }
        `}
      </style>

      <div
        className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] px-4 py-3"
        style={{
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
        }}
      >
        <span
          className="pointer-events-none absolute inset-x-8 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.78), color-mix(in srgb, var(--admin-primary) 18%, rgba(255,255,255,0.42)), transparent)',
          }}
        />

        <span
          className="alert-panel-edge pointer-events-none absolute left-0 top-12 h-[calc(100%-96px)] w-px"
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

        <div className="relative z-10 mb-2.5 flex shrink-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <GlassIcon>
              <AlertTriangle size={16} strokeWidth={2.5} />
            </GlassIcon>

            <div className="min-w-0">
              <h2 className="text-[16px] font-black leading-[17px]" style={styles.title}>
                Alertas importantes
              </h2>
              <p className="mt-0.5 text-[11.5px] font-semibold leading-[15px]" style={styles.muted}>
                Revisa los puntos que requieren atención.
              </p>
            </div>
          </div>

          <GlassButton>Ver todas</GlassButton>
        </div>

        <div
          className={
            isSingleAlert
              ? 'relative z-10 flex min-h-[132px] flex-1 items-stretch'
              : 'relative z-10 grid min-h-0 flex-1 gap-2'
          }
          style={
            isSingleAlert
              ? undefined
              : {
                  gridTemplateRows: hasAlerts
                    ? `repeat(${visibleAlerts.length}, minmax(0, 1fr))`
                    : '1fr',
                }
          }
        >
          {hasAlerts ? (
            visibleAlerts.map((alert, index) => {
              const Icon = alertIconMap[alert.type] || AlertTriangle;

              return (
                <article
                  key={`${alert.id}-${index}`}
                  className={`
                    alert-pro-row relative grid min-h-0 items-center overflow-hidden rounded-[18px]
                    ${
                      isSingleAlert
                        ? 'h-full w-full grid-cols-[46px_minmax(0,1fr)_86px] gap-3 px-3.5 py-5'
                        : 'grid-cols-[32px_minmax(0,1fr)_76px] gap-2 px-2.5 py-2'
                    }
                  `}
                  style={{
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
                    animationDelay: `${120 + index * 80}ms`,
                  }}
                >
                  <span
                    className="alert-row-accent pointer-events-none absolute left-0 top-3 h-[calc(100%-24px)] w-px opacity-70"
                    style={{
                      background:
                        'linear-gradient(180deg, transparent, color-mix(in srgb, var(--admin-primary) 68%, rgba(255,255,255,0.48)), transparent)',
                      boxShadow:
                        '0 0 10px color-mix(in srgb, var(--admin-primary) 28%, transparent)',
                      transition: 'opacity 180ms ease',
                    }}
                  />

                  <span
                    className="pointer-events-none absolute inset-x-5 top-0 h-px"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                    }}
                  />

                  <GlassIcon large={isSingleAlert}>
                    <Icon size={isSingleAlert ? 18 : 15} strokeWidth={2.5} />
                  </GlassIcon>

                  <div className="min-w-0">
                    <h3
                      className={
                        isSingleAlert
                          ? 'text-[13px] font-black leading-[17px]'
                          : 'truncate text-[12px] font-black leading-[15px]'
                      }
                      style={{
                        ...styles.title,
                        ...(isSingleAlert
                          ? {
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }
                          : {}),
                      }}
                      title={alert.title}
                    >
                      {alert.title}
                    </h3>

                    <p
                      className={
                        isSingleAlert
                          ? 'mt-1.5 text-[11.4px] font-semibold leading-[15px]'
                          : 'mt-0.5 text-[10.8px] font-semibold leading-[13px]'
                      }
                      style={{
                        ...styles.muted,
                        display: '-webkit-box',
                        WebkitLineClamp: isSingleAlert ? 3 : 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                      title={alert.description}
                    >
                      {alert.description}
                    </p>
                  </div>

                  <GlassButton large={isSingleAlert}>{alert.action}</GlassButton>
                </article>
              );
            })
          ) : (
            <div
              className="flex h-full items-center justify-center px-4 text-center text-[12px] font-bold leading-5"
              style={styles.muted}
            >
              No hay alertas importantes por revisar.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}