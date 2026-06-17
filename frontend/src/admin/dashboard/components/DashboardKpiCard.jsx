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
    <article className="relative min-h-[116px] overflow-hidden p-[1px]" style={styles.kpiFrame}>
      <div className="relative h-full overflow-hidden rounded-[23px] px-4 py-4" style={styles.kpiGlass}>
        <span className="pointer-events-none absolute inset-x-5 top-[3px] h-px" style={styles.kpiTopLight} />
        <span className="pointer-events-none absolute -right-8 -top-14 h-[170px] w-[54px] rotate-[38deg]" style={styles.kpiShine} />
        <span className="pointer-events-none absolute inset-0 rounded-[23px]" style={styles.kpiInnerBorder} />

        <div className="relative z-10 flex h-full gap-3.5">
          <span
            className="mt-1 flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[17px]"
            style={isWarning ? styles.warningIcon : styles.kpiIcon}
          >
            <Icon size={27} strokeWidth={2.2} />
          </span>

          <div className="flex min-w-0 flex-1 flex-col justify-between pt-0.5">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-black leading-4 tracking-[-0.01em]" style={styles.title}>
                {item?.title}
              </p>

              <p
                className="mt-2 truncate text-[23px] font-black leading-none tracking-[-0.045em] xl:text-[22px] 2xl:text-[23px]"
                style={styles.title}
                title={item?.value}
              >
                {item?.value}
              </p>
            </div>

            <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-black leading-4">
              {isWarning ? (
                <>
                  <AlertTriangle size={13} strokeWidth={2.6} style={styles.kpiWarningMark} />
                  <span className="truncate" style={styles.kpiWarningText} title={item?.helper}>
                    {item?.helper}
                  </span>
                </>
              ) : (
                <>
                  {item?.trend ? (
                    <>
                      <TrendingUp size={13} strokeWidth={2.8} style={styles.kpiTrendArrow} />
                      <span className="shrink-0" style={styles.kpiTrendText}>
                        {item.trend}
                      </span>
                    </>
                  ) : null}

                  <span className="min-w-0 truncate font-extrabold" style={styles.kpiHelperText} title={item?.helper}>
                    {item?.helper}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
