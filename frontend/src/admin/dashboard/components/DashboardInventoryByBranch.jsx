// frontend/src/admin/dashboard/components/DashboardInventoryByBranch.jsx

import { Building2, ChevronRight, Store } from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

export default function DashboardInventoryByBranch({ items = [] }) {
  return (
    <section className="p-5 lg:p-6" style={styles.card}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center"
            style={styles.kpiIcon}
          >
            <Building2 size={20} />
          </span>

          <div>
            <h2 className="text-lg font-black" style={styles.title}>
              Resumen de inventario por sede
            </h2>

            <p className="mt-1 text-sm" style={styles.muted}>
              Distribución general de productos entre sedes.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-black transition hover:opacity-80"
          style={styles.eyebrow}
        >
          Ver detalle
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const percentage = Math.min(Math.max(Number(item.percentage || 0), 0), 100);

          return (
            <article key={item.id} className="p-4" style={styles.alertItem}>
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center"
                  style={{
                    borderRadius: '16px',
                    background:
                      'linear-gradient(135deg, rgba(255,255,255,0.82), color-mix(in srgb, var(--admin-primary) 16%, rgba(255,255,255,0.62)))',
                    color: 'var(--admin-primary)',
                    border: '1px solid rgba(255,255,255,0.70)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.68)',
                  }}
                >
                  <Store size={18} />
                </span>

                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black" style={styles.title}>
                    {item.branch}
                  </h3>

                  <p className="mt-1 text-xs font-bold" style={styles.muted}>
                    Productos
                  </p>
                </div>
              </div>

              <p className="mt-5 text-3xl font-black tracking-tight" style={styles.title}>
                {item.products?.toLocaleString?.('es-CO') || item.products}
              </p>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs font-black">
                  <span style={styles.muted}>Participación</span>
                  <span style={styles.eyebrow}>{percentage}%</span>
                </div>

                <div className="h-3 overflow-hidden" style={styles.progressTrack}>
                  <div
                    className="h-full"
                    style={{
                      ...styles.progressFill,
                      width: `${percentage}%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-xs font-bold" style={styles.muted}>
                  {percentage}% del inventario
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}