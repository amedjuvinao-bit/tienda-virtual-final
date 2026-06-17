// frontend/src/admin/dashboard/components/DashboardKpiCard.jsx

export default function DashboardKpiCard({ item }) {
  return (
    <div className="min-h-32 rounded-3xl border border-white/70 bg-white/60 p-4 shadow-lg backdrop-blur-2xl">
      <div className="text-sm font-black text-slate-950">{item?.title}</div>
      <div className="mt-2 truncate text-2xl font-black text-slate-950">{item?.value}</div>
      <div className="mt-2 text-xs font-bold text-emerald-600">{item?.trend}</div>
      <div className="mt-1 text-xs font-bold text-slate-500">{item?.helper}</div>
    </div>
  );
}
