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
    <article className="relative h-[116px] overflow-hidden rounded-[22px] p-[1px]" style={styles.kpiFrame}>
      <div className="relative h-full overflow-hidden rounded-[21px] px-3 py-3.5 xl:px-4" style={styles.kpiGlass}>
        <span className="pointer-events-none absolute inset-x-4 top-[2px] h-px" style={styles.kpiTopLight} />
        <span className="pointer-events-none absolute -right-8 -top-14 h-[170px] w-[46px] rotate-[38deg]" style={styles.kpiShine} />
        <span className="pointer-events-none absolute inset-0 rounded-[21px]" style={styles.kpiInnerBorder} />

        <div className="relative z-10 grid h-full grid-cols-[42px_minmax(0,1fr)] gap-2.5 xl:grid-cols-[48px_minmax(0,1fr)] xl:gap-3">
          <span
            className="mt-1 flex h-[42px] w-[42px] items-center justify-center rounded-[15px] xl:h-[48px] xl:w-[48px] xl:rounded-[17px]"
            style={isWarning ? styles.warningIcon : styles.kpiIcon}
          >
            <Icon size={22} strokeWidth={2.35} />
          </span>

          <div className="min-w-0 pt-1">
            <p className="text-[11px] font-black leading-4 tracking-[-0.02em] xl:text-[12px]" style={styles.title}>
              {item?.title}
            </p>

            <p
              className="mt-2 text-[20px] font-black leading-none tracking-[-0.055em] xl:text-[21px]"
              style={styles.title}
              title={item?.value}
            >
              {item?.value}
            </p>
          </div>

          <div className="col-span-2 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[9.5px] font-black leading-4 xl:text-[10.5px]">
            {isWarning ? (
              <>
                <AlertTriangle size={11} strokeWidth={2.7} style={styles.kpiWarningMark} />
                <span style={styles.kpiWarningText}>{item?.helper}</span>
              </>
            ) : (
              <>
                {item?.trend ? (
                  <>
                    <TrendingUp size={11} strokeWidth={2.8} style={styles.kpiTrendArrow} />
                    <span style={styles.kpiTrendText}>{item.trend}</span>
                  </>
                ) : null}

                <span className="font-extrabold" style={styles.kpiHelperText}>
                  {item?.helper}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
