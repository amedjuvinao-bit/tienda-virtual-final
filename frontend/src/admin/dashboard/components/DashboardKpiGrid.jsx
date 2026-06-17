// frontend/src/admin/dashboard/components/DashboardKpiGrid.jsx

import DashboardKpiCard from './DashboardKpiCard';

export default function DashboardKpiGrid({ items = [] }) {
  return (
    <section className="grid grid-flow-col auto-cols-[220px] gap-4 overflow-x-auto pb-1 pr-2 2xl:grid-flow-row 2xl:grid-cols-5 2xl:auto-cols-auto 2xl:overflow-visible 2xl:pr-0">
      {items.map((item) => (
        <DashboardKpiCard key={item.id} item={item} />
      ))}
    </section>
  );
}
