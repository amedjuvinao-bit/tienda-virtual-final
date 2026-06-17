// frontend/src/admin/dashboard/components/DashboardKpiGrid.jsx

import DashboardKpiCard from './DashboardKpiCard';

export default function DashboardKpiGrid({ items = [] }) {
  return (
    <section className="-mx-1 flex gap-7 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <DashboardKpiCard key={item.id} item={item} />
      ))}
    </section>
  );
}
