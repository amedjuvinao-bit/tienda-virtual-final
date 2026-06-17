// frontend/src/admin/dashboard/components/DashboardRecentOrders.jsx

import { ChevronRight, ClipboardList } from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

function getStatusStyle(statusType) {
  const statusMap = {
    success: styles.statusSuccess,
    warning: styles.statusWarning,
    info: styles.statusInfo,
    danger: styles.statusDanger,
  };

  return statusMap[statusType] || styles.statusInfo;
}

export default function DashboardRecentOrders({ orders = [] }) {
  return (
    <section className="p-5 lg:p-6" style={styles.card}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center"
            style={styles.kpiIcon}
          >
            <ClipboardList size={20} />
          </span>

          <div>
            <h2 className="text-lg font-black" style={styles.title}>
              Órdenes recientes
            </h2>

            <p className="mt-1 text-sm" style={styles.muted}>
              Últimos pedidos registrados en la tienda.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-black transition hover:opacity-80"
          style={styles.eyebrow}
        >
          Ver todas
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="overflow-hidden" style={{ borderRadius: '22px' }}>
        <div
          className="hidden grid-cols-[110px_minmax(0,1fr)_120px_120px_120px] gap-3 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] lg:grid"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.58), color-mix(in srgb, var(--admin-primary) 8%, rgba(255,255,255,0.45)))',
            color: 'var(--admin-card-muted-text)',
            borderBottom: '1px solid var(--admin-card-border)',
          }}
        >
          <span>Orden</span>
          <span>Cliente</span>
          <span>Total</span>
          <span>Estado</span>
          <span>Fecha</span>
        </div>

        <div className="space-y-3 lg:space-y-0">
          {orders.map((order) => (
            <article
              key={order.id}
              className="grid gap-3 p-4 lg:grid-cols-[110px_minmax(0,1fr)_120px_120px_120px] lg:items-center"
              style={{
                ...styles.alertItem,
                borderRadius: '0',
                borderLeft: '0',
                borderRight: '0',
                borderTop: '0',
              }}
            >
              <p className="text-sm font-black" style={styles.title}>
                #{order.id}
              </p>

              <p className="min-w-0 truncate text-sm font-bold" style={styles.title}>
                {order.customer}
              </p>

              <p className="text-sm font-black" style={styles.title}>
                {order.total}
              </p>

              <div>
                <span
                  className="inline-flex px-3 py-1 text-xs font-black"
                  style={getStatusStyle(order.statusType)}
                >
                  {order.status}
                </span>
              </div>

              <p className="text-xs font-bold lg:text-sm" style={styles.muted}>
                {order.date}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}