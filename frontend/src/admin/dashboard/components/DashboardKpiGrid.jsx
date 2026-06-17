// frontend/src/admin/dashboard/components/DashboardKpiGrid.jsx

import DashboardKpiCard from './DashboardKpiCard';

export default function DashboardKpiGrid({ items = [] }) {
  return (
    <section className="grid grid-cols-5 gap-3 xl:gap-4">
      {items.map((item) => (
        <DashboardKpiCard key={item.id} item={item} />
      ))}
    </section>
  );
}
