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
  const height = 30;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function getSparklineAreaPath(values = []) {
  const path = getSparklinePath(values);
  if (!path) return '';
  return `${path} L 118 30 L 0 30 Z`;
}

export default function DashboardKpiCard({ item }) {
  const Icon = iconMap[item?.icon] || Package;
  const hasSparkline = Array.isArray(item?.sparkline) && item.sparkline.length > 0;
  const isWarning = item?.trendType === 'warning';

  return (
    <article className="relative min-h-[116px] overflow-hidden p-4" style={styles.compactCard}>
      <div className="relative z-10 grid h-full grid-rows-[auto_1fr_auto] gap-2">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center"
            style={isWarning ? styles.warningIcon : styles.kpiIcon}
          >
            <Icon size={19} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-black leading-4" style={styles.title}>
              {item?.title}
            </p>

            <p
              className="mt-1 whitespace-nowrap text-[20px] font-black leading-none tracking-tight"
              style={styles.title}
              title={item?.value}
            >
              {item?.value}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-black leading-4">
          {item?.trend && (
            <span className="inline-flex shrink-0 items-center gap-1 text-emerald-600">
              <TrendingUp size={12} />
              {item.trend}
            </span>
          )}

          <span className="min-w-0" style={styles.muted}>
            {item?.helper}
          </span>
        </div>

        {hasSparkline ? (
          <svg viewBox="0 0 118 30" className="h-[30px] w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`kpi-fill-${item.id}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--admin-primary)" stopOpacity="0.22" />
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
        ) : (
          <div className="inline-flex items-center gap-2 text-[12px] font-black text-rose-700">
            <AlertTriangle size={14} />
            Requieren atención
          </div>
        )}
      </div>
    </article>
  );
}
