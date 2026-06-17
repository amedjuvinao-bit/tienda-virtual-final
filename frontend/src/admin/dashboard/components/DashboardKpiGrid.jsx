// frontend/src/admin/dashboard/components/DashboardKpiGrid.jsx

import DashboardKpiCard from './DashboardKpiCard';

export default function DashboardKpiGrid({ items = [] }) {
  return (
    <section className="grid gap-3 lg:grid-cols-5">
      {items.map((item) => (
        <DashboardKpiCard key={item.id} item={item} />
      ))}
    </section>
  );
}
