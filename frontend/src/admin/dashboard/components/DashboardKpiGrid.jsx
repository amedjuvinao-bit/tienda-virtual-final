// frontend/src/admin/dashboard/components/DashboardKpiGrid.jsx

import DashboardKpiCard from './DashboardKpiCard';
import { dashboardStyles as styles } from '../dashboardStyles';

export default function DashboardKpiGrid({ items = [] }) {
  return (
    <section
      className="relative overflow-hidden rounded-[24px] px-0 py-0"
      style={styles.kpiRow}
    >
      <span className="pointer-events-none absolute inset-0" style={styles.kpiRowBackdrop} />

      <div className="relative z-10 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => (
          <DashboardKpiCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}