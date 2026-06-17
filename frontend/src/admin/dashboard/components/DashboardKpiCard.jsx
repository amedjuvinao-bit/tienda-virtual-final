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
    <article className="relative h-[96px] overflow-hidden rounded-[18px] p-[1px]" style={styles.kpiFrame}>
      <div className="relative h-full overflow-hidden rounded-[17px] px-3 py-2.5" style={styles.kpiGlass}>
        <span className="pointer-events-none absolute inset-x-5 top-[2px] h-px" style={styles.kpiTopLight} />
        <span className="pointer-events-none absolute -right-9 -top-12 h-[145px] w-[34px] rotate-[38deg]" style={styles.kpiShine} />
        <span className="pointer-events-none absolute inset-0 rounded-[17px]" style={styles.kpiInnerBorder} />

        <div className="relative z-10 flex h-full items-center gap-2.5">
          <span
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[12px]"
            style={isWarning ? styles.warningIcon : styles.kpiIcon}
          >
            <Icon size={17} strokeWidth={2.45} />
          </span>

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="whitespace-nowrap text-[8.8px] font-black leading-3 tracking-[-0.01em]" style={styles.title}>
              {item?.title}
            </p>

            <p
              className="mt-1 whitespace-nowrap text-[17px] font-black leading-none tracking-[-0.055em]"
              style={styles.title}
              title={item?.value}
            >
              {item?.value}
            </p>

            <div className="mt-2 flex min-w-0 items-center gap-1 whitespace-nowrap text-[7.6px] font-black leading-[10px] tracking-[-0.02em]">
              {isWarning ? (
                <>
                  <AlertTriangle size={8.5} strokeWidth={2.8} style={styles.kpiWarningMark} />
                  <span style={styles.kpiWarningText}>{item?.helper}</span>
                </>
              ) : (
                <>
                  {item?.trend ? (
                    <>
                      <TrendingUp size={8.5} strokeWidth={2.8} style={styles.kpiTrendArrow} />
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
