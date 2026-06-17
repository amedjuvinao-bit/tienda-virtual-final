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

export default function DashboardKpiCard({ item = {} }) {
  const Icon = iconMap[item?.icon] || Package;
  const isWarning = item?.trendType === 'warning';
  const trendLabel = isWarning ? 'Atención' : item?.trend;

  return (
    <article className="group relative min-h-[118px] overflow-hidden p-[1px]" style={styles.kpiFrame}>
      <div className="relative h-full overflow-hidden rounded-[25px] px-4 py-4" style={styles.kpiGlass}>
        <span className="pointer-events-none absolute inset-x-6 top-0 h-px" style={styles.kpiTopLight} />
        <span className="pointer-events-none absolute -left-14 -top-16 h-40 w-24 rotate-[28deg]" style={styles.kpiShine} />
        <span className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full" style={styles.kpiGlow} />

        <div className="relative z-10 flex h-full flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px]"
              style={isWarning ? styles.warningIcon : styles.kpiIcon}
            >
              <Icon size={20} strokeWidth={2.4} />
            </span>

            {trendLabel ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black leading-none"
                style={isWarning ? styles.kpiWarningPill : styles.kpiTrendPill}
              >
                {isWarning ? <AlertTriangle size={12} /> : <TrendingUp size={12} />}
                {trendLabel}
              </span>
            ) : null}
          </div>

          <div className="relative z-10 min-w-0">
            <p className="text-[12px] font-black leading-4 tracking-[0.01em]" style={styles.muted}>
              {item?.title}
            </p>

            <p
              className="mt-1 truncate text-[24px] font-black leading-none tracking-tight sm:text-[22px] xl:text-[24px]"
              style={styles.title}
              title={item?.value}
            >
              {item?.value}
            </p>

            <p className="mt-2 truncate text-[11px] font-bold leading-4" style={styles.muted} title={item?.helper}>
              {item?.helper}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
