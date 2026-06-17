// frontend/src/admin/dashboard/components/DashboardHero.jsx

import { dashboardStyles as styles } from '../dashboardStyles';

export default function DashboardHero() {
  return (
    <section className="relative overflow-hidden px-8 py-6" style={styles.hero}>
      <div className="grid min-h-[118px] gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight md:text-[38px]" style={styles.title}>Panel de control</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6" style={styles.muted}>Resumen general de tu tienda. Revisa el rendimiento.</p>
        </div>
        <div className="hidden h-[118px] lg:block" style={styles.heroMedia} />
      </div>
    </section>
  );
}
