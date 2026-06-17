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

  return (
    <article
      className="relative min-h-[154px] w-[430px] shrink-0 overflow-hidden p-[2px] sm:w-[455px] lg:w-[470px]"
      style={styles.kpiFrame}
    >
      <div className="relative h-full overflow-hidden rounded-[31px] px-8 py-7" style={styles.kpiGlass}>
        <span className="pointer-events-none absolute inset-x-8 top-[5px] h-px" style={styles.kpiTopLight} />
        <span className="pointer-events-none absolute -right-10 -top-28 h-[240px] w-[92px] rotate-[39deg]" style={styles.kpiShine} />
        <span className="pointer-events-none absolute inset-0 rounded-[31px]" style={styles.kpiInnerBorder} />

        <div className="relative z-10 flex h-full gap-7">
          <span
            className="mt-1 flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[24px]"
            style={isWarning ? styles.warningIcon : styles.kpiIcon}
          >
            <Icon size={42} strokeWidth={2.15} />
          </span>

          <div className="flex min-w-0 flex-1 flex-col justify-between pt-1">
            <div className="min-w-0">
              <p className="truncate text-[23px] font-black leading-7 tracking-[-0.02em]" style={styles.title}>
                {item?.title}
              </p>

              <p
                className="mt-5 truncate text-[39px] font-black leading-none tracking-[-0.04em]"
                style={styles.title}
                title={item?.value}
              >
                {item?.value}
              </p>
            </div>

            <div className="flex min-w-0 items-center gap-2 text-[18px] font-black leading-6">
              {isWarning ? (
                <>
                  <AlertTriangle size={20} strokeWidth={2.6} style={styles.kpiWarningMark} />
                  <span style={styles.kpiWarningText}>Atención</span>
                </>
              ) : (
                item?.trend && (
                  <>
                    <TrendingUp size={20} strokeWidth={2.8} style={styles.kpiTrendArrow} />
                    <span style={styles.kpiTrendText}>{item.trend}</span>
                  </>
                )
              )}

              <span className="min-w-0 truncate font-extrabold" style={styles.kpiHelperText} title={item?.helper}>
                {item?.helper}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
