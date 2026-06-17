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

const iconGradients = {
  pink: 'linear-gradient(135deg, #ff4db3, #ec4899)',
  rose: 'linear-gradient(135deg, #ff4f9a, #f43f5e)',
  fuchsia: 'linear-gradient(135deg, #d946ef, #ec4899)',
  soft: 'linear-gradient(135deg, #ff6fb6, #fb3f98)',
  warning: 'linear-gradient(135deg, #fbbf24, #fb923c)',
};

export default function DashboardKpiCard({ item = {} }) {
  const Icon = iconMap[item?.icon] || Package;
  const isWarning = item?.trendType === 'warning';
  const iconStyle = {
    ...styles.kpiIconChip,
    background: iconGradients[item?.accent] || iconGradients.pink,
    boxShadow: isWarning
      ? '0 10px 24px rgba(251,146,60,0.22), inset 0 1px 0 rgba(255,255,255,0.48)'
      : '0 10px 24px rgba(236,72,153,0.22), inset 0 1px 0 rgba(255,255,255,0.48)',
  };

  return (
    <article className="relative h-[112px] overflow-hidden rounded-[20px] p-[1px]" style={styles.kpiFrame}>
      <div className="relative h-full overflow-hidden rounded-[19px] px-3.5 py-3.5" style={styles.kpiGlass}>
        <span className="pointer-events-none absolute inset-x-6 top-0 h-px" style={styles.kpiTopLight} />
        <span className="pointer-events-none absolute left-0 top-0 h-20 w-24 rounded-tl-[19px]" style={styles.kpiCornerHighlight} />
        <span className="pointer-events-none absolute -right-5 -top-10 h-[155px] w-[40px] rotate-[38deg]" style={styles.kpiShine} />
        <span className="pointer-events-none absolute inset-0 rounded-[19px]" style={styles.kpiInnerBorder} />

        <div className="relative z-10 flex h-full flex-col justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]" style={iconStyle}>
              <Icon size={21} strokeWidth={2.35} />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] font-bold leading-[15px] tracking-[-0.01em]" style={styles.kpiTitle}>
                {item?.title}
              </p>

              <p
                className="mt-1 whitespace-nowrap text-[22px] font-black leading-none tracking-[-0.045em]"
                style={styles.kpiValue}
                title={item?.value}
              >
                {item?.value}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-bold leading-none tracking-[-0.01em]">
            {isWarning ? (
              <>
                <AlertTriangle size={12} strokeWidth={2.7} style={styles.kpiWarningMark} />
                <span style={styles.kpiWarningText}>{item?.helper}</span>
              </>
            ) : (
              <>
                {item?.trend ? (
                  <>
                    <TrendingUp size={12} strokeWidth={2.7} style={styles.kpiTrendArrow} />
                    <span style={styles.kpiTrendText}>{item.trend}</span>
                  </>
                ) : null}
                <span className="min-w-0" style={styles.kpiHelperText}>{item?.helper}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
