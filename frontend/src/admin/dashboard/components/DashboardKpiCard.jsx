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

function getSparklinePath(values = []) {
  if (!Array.isArray(values) || values.length === 0) return '';

  const width = 118;
  const height = 34;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function getSparklineAreaPath(values = []) {
  const path = getSparklinePath(values);
  if (!path) return '';

  return `${path} L 118 34 L 0 34 Z`;
}

export default function DashboardKpiCard({ item }) {
  const Icon = iconMap[item?.icon] || Package;
  const hasSparkline = Array.isArray(item?.sparkline) && item.sparkline.length > 0;
  const isWarning = item?.trendType === 'warning';

  return (
    <article
      className="relative min-h-[118px] overflow-hidden p-4"
      style={{
        ...styles.card,
        borderRadius: '24px',
      }}
    >
      <div className="relative z-10 flex h-full flex-col justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center"
            style={isWarning ? styles.warningIcon : styles.kpiIcon}
          >
            <Icon size={20} />
          </div>

          <div className="min-w-0 flex-1">
            <p
              className="line-clamp-2 text-[13px] font-black leading-4"
              style={styles.title}
            >
              {item?.title}
            </p>

            <p
              className="mt-2 truncate text-[22px] font-black leading-none tracking-tight"
              style={styles.title}
              title={item?.value}
            >
              {item?.value}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-black">
              {item?.trend && (
                <span
                  className="inline-flex items-center gap-1"
                  style={{
                    color: isWarning ? '#be123c' : '#16a34a',
                  }}
                >
                  <TrendingUp size={12} />
                  {item.trend}
                </span>
              )}

              <span className="leading-4" style={styles.muted}>
                {item?.helper}
              </span>
            </div>
          </div>
        </div>

        {hasSparkline && (
          <div className="h-[34px] w-full">
            <svg
              viewBox="0 0 118 34"
              className="h-full w-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={`kpi-fill-${item.id}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--admin-primary)" stopOpacity="0.26" />
                  <stop offset="100%" stopColor="var(--admin-primary)" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path d={getSparklineAreaPath(item.sparkline)} fill={`url(#kpi-fill-${item.id})`} />

              <path
                d={getSparklinePath(item.sparkline)}
                fill="none"
                stroke="var(--admin-primary)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {!hasSparkline && (
          <div className="flex items-center gap-2 text-[12px] font-black" style={{ color: '#be123c' }}>
            <AlertTriangle size={15} />
            Requieren atención
          </div>
        )}
      </div>

      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl"
        style={{
          background: isWarning
            ? 'rgba(251, 191, 36, 0.24)'
            : 'color-mix(in srgb, var(--admin-primary) 18%, transparent)',
        }}
      />
    </article>
  );
}