// frontend/src/admin/dashboard/components/DashboardAlertsPanel.jsx

import {
  AlertTriangle,
  ChevronRight,
  Clock3,
  PackageSearch,
  Tags,
} from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

const alertIconMap = {
  stock: PackageSearch,
  category: Tags,
  orders: Clock3,
};

export default function DashboardAlertsPanel({ alerts = [] }) {
  return (
    <section className="p-5 lg:p-6" style={styles.card}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center"
            style={styles.warningIcon}
          >
            <AlertTriangle size={20} />
          </span>

          <div>
            <h2 className="text-lg font-black" style={styles.title}>
              Alertas importantes
            </h2>

            <p className="mt-1 text-sm" style={styles.muted}>
              Revisa los puntos que requieren atención.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="shrink-0 text-xs font-black transition hover:opacity-80"
          style={styles.eyebrow}
        >
          Ver todas
        </button>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon = alertIconMap[alert.type] || AlertTriangle;

          return (
            <article
              key={alert.id}
              className="group flex items-center justify-between gap-3 p-4"
              style={styles.alertItem}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center"
                  style={{
                    borderRadius: '16px',
                    background:
                      'linear-gradient(135deg, rgba(255,255,255,0.78), color-mix(in srgb, var(--admin-primary) 18%, rgba(255,255,255,0.62)))',
                    color: 'var(--admin-primary)',
                    border: '1px solid rgba(255,255,255,0.70)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.68)',
                  }}
                >
                  <Icon size={18} />
                </span>

                <div className="min-w-0">
                  <h3 className="text-sm font-black" style={styles.title}>
                    {alert.title}
                  </h3>

                  <p className="mt-1 text-xs font-semibold leading-5" style={styles.muted}>
                    {alert.description}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 px-3 py-2 text-xs font-black transition group-hover:-translate-y-0.5"
                style={styles.actionButton}
              >
                {alert.action}
                <ChevronRight size={14} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}