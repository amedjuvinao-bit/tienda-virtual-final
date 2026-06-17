// frontend/src/admin/dashboard/components/DashboardHero.jsx

export default function DashboardHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/60 px-8 py-6 shadow-xl backdrop-blur-2xl">
      <div className="grid min-h-28 gap-6 lg:grid-cols-2 lg:items-center">
        <div className="flex items-center gap-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-xl text-pink-500 shadow-lg">
            ✦
          </div>
          <div>
            <div className="text-4xl font-black tracking-tight text-slate-950">
              Panel de control
            </div>
            <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Resumen general de tu tienda. Revisa el rendimiento y toma decisiones inteligentes.
            </div>
          </div>
        </div>

        <div className="hidden h-28 rounded-3xl border border-white/70 bg-white/40 shadow-inner lg:block" />
      </div>
    </section>
  );
}
