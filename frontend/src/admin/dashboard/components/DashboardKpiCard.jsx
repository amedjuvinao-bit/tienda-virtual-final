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
    <article className="relative h-[112px] overflow-hidden rounded-[22px] p-[1px]" style={styles.kpiFrame}>
      <div className="relative h-full overflow-hidden rounded-[21px] px-3.5 py-3" style={styles.kpiGlass}>
        <span className="pointer-events-none absolute inset-x-5 top-[2px] h-px" style={styles.kpiTopLight} />
        <span className="pointer-events-none absolute -right-10 -top-14 h-[170px] w-[42px] rotate-[38deg]" style={styles.kpiShine} />
        <span className="pointer-events-none absolute inset-0 rounded-[21px]" style={styles.kpiInnerBorder} />

        <div className="relative z-10 flex h-full gap-3">
          <span
            className="mt-1 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[16px]"
            style={isWarning ? styles.warningIcon : styles.kpiIcon}
          >
            <Icon size={21} strokeWidth={2.35} />
          </span>

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="whitespace-nowrap text-[10.5px] font-black leading-4 tracking-[-0.02em]" style={styles.title}>
              {item?.title}
            </p>

            <p
              className="mt-1 whitespace-nowrap text-[18px] font-black leading-none tracking-[-0.04em]"
              style={styles.title}
              title={item?.value}
            >
              {item?.value}
            </p>

            <div className="mt-3 flex min-w-0 items-center gap-1 whitespace-nowrap text-[8.8px] font-black leading-3">
              {isWarning ? (
                <>
                  <AlertTriangle size={10} strokeWidth={2.7} style={styles.kpiWarningMark} />
                  <span style={styles.kpiWarningText}>{item?.helper}</span>
                </>
              ) : (
                <>
                  {item?.trend ? (
                    <>
                      <TrendingUp size={10} strokeWidth={2.8} style={styles.kpiTrendArrow} />
                      <span style={styles.kpiTrendText}>{item.trend}</span>
                    </>
                  ) : null}
                  <span style={styles.kpiHelperText}>{item?.helper}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
