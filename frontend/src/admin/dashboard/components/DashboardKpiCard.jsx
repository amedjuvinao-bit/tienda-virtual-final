// frontend/src/admin/dashboard/components/DashboardKpiCard.jsx

import {
  AlertTriangle,
  Heart,
  Package,
  ShoppingCart,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

const iconMap = {
  income: WalletCards,
  cart: ShoppingCart,
  'cart-active': ShoppingCart,
  heart: Heart,
  warning: AlertTriangle,
  product: Package,
};

const iconToneMap = {
  pink: {
    color: 'var(--admin-primary)',
  },
  rose: {
    color: 'var(--admin-primary)',
  },
  fuchsia: {
    color: 'var(--admin-primary)',
  },
  soft: {
    color: 'var(--admin-primary)',
  },
  warning: {
    color: '#f59e0b',
  },
};

export default function DashboardKpiCard({ item = {} }) {
  const Icon = iconMap[item?.icon] || Package;
  const isWarning = item?.trendType === 'warning';
  const iconTone = iconToneMap[item?.accent] || iconToneMap.pink;

  const frameStyle = {
    ...styles.kpiFrame,
    border: '1px solid rgba(255,255,255,0.34)',
    background: `
      linear-gradient(
        145deg,
        rgba(255,255,255,0.08) 0%,
        rgba(255,255,255,0.025) 42%,
        color-mix(in srgb, var(--admin-primary) 2%, transparent) 100%
      )
    `,
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.42),
      inset 0 -1px 0 rgba(15,23,42,0.04),
      0 8px 18px rgba(12,6,35,0.045),
      0 0 16px color-mix(in srgb, var(--admin-primary) 4%, transparent)
    `,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  };

  const glassStyle = {
    ...styles.kpiGlass,
    border: '1px solid rgba(255,255,255,0.24)',
    background: `
      linear-gradient(
        145deg,
        rgba(255,255,255,0.052) 0%,
        rgba(255,255,255,0.016) 46%,
        color-mix(in srgb, var(--admin-primary) 2%, transparent) 100%
      )
    `,
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.46),
      inset 0 -1px 0 rgba(15,23,42,0.04),
      inset 0 0 16px rgba(255,255,255,0.045),
      inset 0 -8px 16px rgba(255,255,255,0.026),
      0 8px 20px rgba(12,6,35,0.040)
    `,
    backdropFilter: 'blur(28px) saturate(185%)',
    WebkitBackdropFilter: 'blur(28px) saturate(185%)',
  };

  const iconStyle = {
    ...styles.kpiIconChip,
    border: '1px solid rgba(255,255,255,0.34)',
    background: `
      linear-gradient(
        145deg,
        rgba(255,255,255,0.11) 0%,
        rgba(255,255,255,0.022) 48%,
        color-mix(in srgb, var(--admin-primary) 3%, transparent) 100%
      )
    `,
    color: iconTone.color,
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.66),
      inset 0 -1px 0 rgba(15,23,42,0.10),
      inset 0 0 0 1px rgba(255,255,255,0.04),
      inset 0 0 9px rgba(255,255,255,0.035),
      0 7px 16px rgba(12,6,35,0.06),
      0 0 14px color-mix(in srgb, var(--admin-primary) 10%, transparent)
    `,
    backdropFilter: 'blur(28px) saturate(190%)',
    WebkitBackdropFilter: 'blur(28px) saturate(190%)',
    transition: 'transform 240ms ease, filter 240ms ease, box-shadow 240ms ease',
    willChange: 'transform, filter',
  };

  return (
    <>
      <style>
        {`
          @keyframes dashboardKpiEnter {
            0% {
              opacity: 0;
              transform: translateY(14px) scale(0.985);
              filter: blur(6px);
            }
            70% {
              opacity: 1;
              filter: blur(0);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }

          @keyframes dashboardKpiShine {
            0%, 100% {
              opacity: 0.62;
              transform: translateX(0) rotate(37deg);
            }
            50% {
              opacity: 0.92;
              transform: translateX(-7px) rotate(37deg);
            }
          }

          @keyframes dashboardKpiIconShine {
            0%, 100% {
              opacity: 0.68;
            }
            50% {
              opacity: 1;
            }
          }

          .dashboard-kpi-card {
            animation: dashboardKpiEnter 620ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
            transform-origin: center;
            transition:
              transform 240ms ease,
              filter 240ms ease;
            will-change: transform, filter;
          }

          .dashboard-kpi-card:hover {
            transform: translateY(-2px);
            filter: brightness(1.018) saturate(1.035);
          }

          .dashboard-kpi-card:hover .dashboard-kpi-icon {
            transform: translateY(-1px) scale(1.035);
            filter: brightness(1.04) saturate(1.06);
          }

          .dashboard-kpi-card:hover .dashboard-kpi-main-shine {
            animation: dashboardKpiShine 1.8s ease-in-out infinite;
          }

          .dashboard-kpi-card:hover .dashboard-kpi-icon-shine {
            animation: dashboardKpiIconShine 1.5s ease-in-out infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .dashboard-kpi-card,
            .dashboard-kpi-main-shine,
            .dashboard-kpi-icon-shine {
              animation: none !important;
              transition: none !important;
            }

            .dashboard-kpi-card:hover,
            .dashboard-kpi-card:hover .dashboard-kpi-icon {
              transform: none !important;
              filter: none !important;
            }
          }
        `}
      </style>

      <article
        className="dashboard-kpi-card relative h-[84px] overflow-hidden rounded-[18px] p-[1px]"
        style={frameStyle}
      >
        <div
          className="relative h-full overflow-hidden rounded-[17px] px-3 py-2.5"
          style={glassStyle}
        >
          <span
            className="pointer-events-none absolute inset-x-5 top-0 h-px"
            style={{
              ...styles.kpiTopLight,
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.90), transparent)',
              opacity: 0.9,
            }}
          />

          <span
            className="pointer-events-none absolute left-0 top-0 h-[58px] w-[82px] rounded-tl-[17px]"
            style={{
              ...styles.kpiCornerHighlight,
              background:
                'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.10) 0%, transparent 62%)',
              opacity: 0.58,
            }}
          />

          <span
            className="dashboard-kpi-main-shine pointer-events-none absolute -right-8 -top-12 h-[150px] w-[48px] rotate-[37deg]"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 18%, rgba(255,255,255,0.68) 48%, rgba(255,255,255,0.16) 78%, transparent 100%)',
              opacity: 0.82,
              filter: 'blur(0.2px)',
            }}
          />

          <span
            className="pointer-events-none absolute -right-10 -top-8 h-[126px] w-[70px] rotate-[37deg]"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.07) 70%, transparent 100%)',
              opacity: 0.48,
              filter: 'blur(7px)',
            }}
          />

          <span
            className="pointer-events-none absolute right-3 top-1.5 h-12 w-20 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.045) 28%, transparent 72%)',
              filter: 'blur(11px)',
              opacity: 0.68,
            }}
          />

          <span
            className="pointer-events-none absolute inset-0 rounded-[17px]"
            style={{
              ...styles.kpiInnerBorder,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: `
                inset 0 1px 0 rgba(255,255,255,0.20),
                inset 0 -1px 0 rgba(15,23,42,0.03)
              `,
            }}
          />

          <div className="relative z-10 flex h-full flex-col justify-between gap-1.5">
            <div className="flex min-w-0 items-start gap-2">
              <span
                className="dashboard-kpi-icon relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[12px]"
                style={iconStyle}
              >
                <span
                  className="pointer-events-none absolute inset-x-[7px] top-[3px] h-px"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, rgba(255,255,255,0.92), transparent)',
                    opacity: 0.9,
                  }}
                />

                <span
                  className="dashboard-kpi-icon-shine pointer-events-none absolute -right-3 -top-6 h-12 w-[5px] rotate-[34deg]"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, rgba(255,255,255,0.62), transparent)',
                    opacity: 0.72,
                  }}
                />

                <span
                  className="pointer-events-none absolute inset-0 rounded-[12px]"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.075), transparent 52%)',
                    opacity: 0.7,
                  }}
                />

                <span
                  className="pointer-events-none absolute right-[6px] top-[6px] h-[3px] w-[3px] rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.96)',
                    boxShadow:
                      '0 0 8px rgba(255,255,255,0.84), 0 0 12px color-mix(in srgb, var(--admin-primary) 16%, transparent)',
                    opacity: 0.92,
                  }}
                />

                <span
                  className="pointer-events-none absolute inset-[1px] rounded-[11px]"
                  style={{
                    border: '1px solid rgba(255,255,255,0.05)',
                    boxShadow:
                      'inset 0 0 9px rgba(255,255,255,0.028), inset 0 0 11px rgba(15,23,42,0.028)',
                  }}
                />

                <Icon size={17} strokeWidth={2.35} />
              </span>

              <div className="min-w-0 flex-1 pt-[1px]">
                <p
                  className="text-[11.8px] font-bold leading-[14px] tracking-[-0.01em]"
                  style={styles.kpiTitle}
                >
                  {item?.title}
                </p>

                <p
                  className="mt-0.5 whitespace-nowrap text-[18px] font-black leading-none tracking-[-0.04em]"
                  style={styles.kpiValue}
                  title={item?.value}
                >
                  {item?.value}
                </p>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[10.8px] font-bold leading-none tracking-[-0.01em]">
              {isWarning ? (
                <>
                  <AlertTriangle size={11} strokeWidth={2.7} style={styles.kpiWarningMark} />
                  <span style={styles.kpiWarningText}>{item?.helper}</span>
                </>
              ) : (
                <>
                  {item?.trend ? (
                    <>
                      <TrendingUp size={11} strokeWidth={2.7} style={styles.kpiTrendArrow} />
                      <span style={styles.kpiTrendText}>{item.trend}</span>
                    </>
                  ) : null}

                  <span className="min-w-0" style={styles.kpiHelperText}>
                    {item?.helper}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </article>
    </>
  );
}