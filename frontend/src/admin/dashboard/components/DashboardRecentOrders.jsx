// frontend/src/admin/dashboard/components/DashboardRecentOrders.jsx

import { CalendarDays, ChevronRight, ClipboardList, Hash, ReceiptText, UserRound } from 'lucide-react';
import { dashboardStyles as styles } from '../dashboardStyles';

const MAX_VISIBLE_ORDERS = 5;

function getStatusStyle(statusType) {
  const statusMap = {
    success: {
      color: '#15803d',
      border: '1px solid rgba(34,197,94,0.34)',
      background: 'linear-gradient(135deg, rgba(240,253,244,0.96), rgba(220,252,231,0.82))',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.88), 0 5px 12px rgba(34,197,94,0.12)',
    },
    warning: {
      color: '#d97706',
      border: '1px solid rgba(245,158,11,0.34)',
      background: 'linear-gradient(135deg, rgba(255,251,235,0.96), rgba(254,243,199,0.82))',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.88), 0 5px 12px rgba(245,158,11,0.12)',
    },
    info: {
      color: '#2563eb',
      border: '1px solid rgba(59,130,246,0.32)',
      background: 'linear-gradient(135deg, rgba(239,246,255,0.96), rgba(219,234,254,0.82))',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.88), 0 5px 12px rgba(59,130,246,0.12)',
    },
    danger: {
      color: '#e11d48',
      border: '1px solid rgba(244,63,94,0.32)',
      background: 'linear-gradient(135deg, rgba(255,241,242,0.96), rgba(255,228,230,0.82))',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.88), 0 5px 12px rgba(244,63,94,0.12)',
    },
  };

  return statusMap[statusType] || statusMap.info;
}

function DiamondGlints({ small = false }) {
  const size = small ? 3.5 : 4.5;

  return (
    <>
      <span
        className="pointer-events-none absolute right-[7px] top-[6px] rounded-full recent-orders-diamond-dot"
        style={{
          width: size,
          height: size,
          background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 0 6px rgba(255,255,255,0.82), 0 0 12px color-mix(in srgb, var(--admin-primary) 28%, transparent)',
        }}
      />
      <span
        className="pointer-events-none absolute right-[1px] top-[8px] h-px w-[16px]"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.78), transparent)', opacity: 0.72 }}
      />
      <span
        className="pointer-events-none absolute right-[8px] top-[1px] h-[16px] w-px"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.66), transparent)', opacity: 0.58 }}
      />
    </>
  );
}

function normalizeOrder(order = {}, index = 0) {
  return {
    id: order.id || `ORD-${index + 1}`,
    customer: order.customer || 'Cliente sin nombre',
    total: order.total || '$0.00',
    status: order.status || 'Pendiente',
    statusType: order.statusType || 'warning',
    date: order.date || 'Sin fecha',
  };
}

export default function DashboardRecentOrders({ orders = [], onViewOrders }) {
  const visibleOrders = orders.slice(0, MAX_VISIBLE_ORDERS).map(normalizeOrder);

  const rootStyle = {
    border: '1px solid color-mix(in srgb, var(--admin-primary) 20%, rgba(255,255,255,0.46))',
    background: 'linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.012) 48%, color-mix(in srgb, var(--admin-primary) 5%, transparent) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.52), inset 0 -1px 0 rgba(15,23,42,0.12), 0 16px 32px rgba(12,6,35,0.065), 0 0 20px color-mix(in srgb, var(--admin-primary) 10%, transparent)',
    backdropFilter: 'blur(18px) saturate(180%)',
    WebkitBackdropFilter: 'blur(18px) saturate(180%)',
  };

  const shellStyle = {
    background: 'linear-gradient(145deg, rgba(255,255,255,0.044) 0%, rgba(255,255,255,0.010) 52%, color-mix(in srgb, var(--admin-primary) 3%, transparent) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -1px 0 rgba(15,23,42,0.10)',
    backdropFilter: 'blur(14px) saturate(165%)',
    WebkitBackdropFilter: 'blur(14px) saturate(165%)',
  };

  const iconChipStyle = {
    border: '1px solid color-mix(in srgb, var(--admin-primary) 26%, rgba(255,255,255,0.42))',
    background: 'linear-gradient(145deg, rgba(255,255,255,0.070) 0%, rgba(255,255,255,0.014) 50%, color-mix(in srgb, var(--admin-primary) 8%, transparent) 100%)',
    color: 'var(--admin-primary)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.52), inset 0 -1px 0 rgba(15,23,42,0.16), 0 9px 18px rgba(12,6,35,0.070), 0 0 16px color-mix(in srgb, var(--admin-primary) 18%, transparent)',
    backdropFilter: 'blur(18px) saturate(185%)',
    WebkitBackdropFilter: 'blur(18px) saturate(185%)',
  };

  const buttonStyle = {
    border: '1px solid color-mix(in srgb, var(--admin-primary) 22%, rgba(255,255,255,0.40))',
    background: 'linear-gradient(145deg, rgba(255,255,255,0.058) 0%, rgba(255,255,255,0.012) 54%, color-mix(in srgb, var(--admin-primary) 5%, transparent) 100%)',
    color: 'var(--admin-card-text)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.44), inset 0 -1px 0 rgba(15,23,42,0.12), 0 8px 16px rgba(12,6,35,0.055), 0 0 12px color-mix(in srgb, var(--admin-primary) 12%, transparent)',
    backdropFilter: 'blur(15px) saturate(170%)',
    WebkitBackdropFilter: 'blur(15px) saturate(170%)',
  };

  const tableStyle = {
    border: '1px solid color-mix(in srgb, var(--admin-primary) 24%, rgba(255,255,255,0.36))',
    background: 'linear-gradient(145deg, color-mix(in srgb, var(--admin-primary) 7%, rgba(255,255,255,0.050)) 0%, rgba(255,255,255,0.010) 54%, color-mix(in srgb, var(--admin-primary) 6%, transparent) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42), inset 0 -1px 0 rgba(15,23,42,0.13), 0 14px 28px rgba(12,6,35,0.075), 0 0 20px color-mix(in srgb, var(--admin-primary) 14%, transparent)',
    backdropFilter: 'blur(16px) saturate(175%)',
    WebkitBackdropFilter: 'blur(16px) saturate(175%)',
  };

  return (
    <section
      className="dashboard-recent-orders-panel relative flex h-full min-h-0 max-h-full self-stretch overflow-hidden rounded-[28px] p-[1px]"
      style={rootStyle}
    >
      <style>
        {`
          @keyframes recentOrdersEnter { 0% { opacity: 0; transform: translateY(14px) scale(0.988); filter: blur(8px); } 100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }
          @keyframes recentOrdersRowEnter { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
          @keyframes recentOrdersShine { 0% { transform: translateX(-145%) rotate(28deg); opacity: 0; } 36% { opacity: 0.42; } 100% { transform: translateX(185%) rotate(28deg); opacity: 0; } }
          @keyframes recentOrdersDotPulse { 0%, 100% { opacity: 0.72; transform: scale(1); } 50% { opacity: 1; transform: scale(1.16); } }
          @keyframes recentOrdersEdgePulse { 0%, 100% { opacity: 0.48; } 50% { opacity: 0.9; } }

          .dashboard-recent-orders-panel { animation: recentOrdersEnter 520ms ease-out both; }
          .recent-orders-row { animation: recentOrdersRowEnter 420ms ease-out both; transition: background 180ms ease, transform 180ms ease, filter 180ms ease, border-color 180ms ease, box-shadow 180ms ease; }
          .recent-orders-row:hover { transform: translateY(-2px); filter: brightness(1.03) saturate(1.06); background: linear-gradient(145deg, color-mix(in srgb, var(--admin-primary) 10%, rgba(255,255,255,0.052)) 0%, rgba(255,255,255,0.014) 56%, color-mix(in srgb, var(--admin-primary) 7%, transparent) 100%) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -1px 0 rgba(15,23,42,0.12), 0 10px 18px rgba(12,6,35,0.055), 0 0 14px color-mix(in srgb, var(--admin-primary) 10%, transparent) !important; }
          .recent-orders-table-shine { animation: recentOrdersShine 4.2s ease-in-out infinite; }
          .recent-orders-diamond-dot { animation: recentOrdersDotPulse 3.4s ease-in-out infinite; }
          .recent-orders-panel-edge { animation: recentOrdersEdgePulse 3.8s ease-in-out infinite; }
          .recent-orders-button { transition: transform 180ms ease, filter 180ms ease, box-shadow 180ms ease, border-color 180ms ease; }
          .recent-orders-button:hover { transform: translateY(-1px); filter: brightness(1.025) saturate(1.05); border-color: color-mix(in srgb, var(--admin-primary) 32%, rgba(255,255,255,0.46)) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,0.48), inset 0 -1px 0 rgba(15,23,42,0.12), 0 10px 20px rgba(12,6,35,0.075), 0 0 16px color-mix(in srgb, var(--admin-primary) 15%, transparent) !important; }
          @media (max-width: 1280px) { .recent-orders-grid { grid-template-columns: minmax(0, 1.55fr) 84px 96px 78px; } }
          @media (prefers-reduced-motion: reduce) { .dashboard-recent-orders-panel, .recent-orders-row, .recent-orders-table-shine, .recent-orders-diamond-dot, .recent-orders-panel-edge { animation: none !important; transition: none !important; } .recent-orders-row:hover, .recent-orders-button:hover { transform: none !important; } }
        `}
      </style>

      <div
        className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[27px] px-5 py-4 lg:px-6 lg:py-5"
        style={shellStyle}
      >
        <span className="pointer-events-none absolute inset-x-8 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.78), color-mix(in srgb, var(--admin-primary) 18%, rgba(255,255,255,0.42)), transparent)' }} />
        <span className="recent-orders-panel-edge pointer-events-none absolute left-0 top-12 h-[calc(100%-96px)] w-px" style={{ background: 'linear-gradient(180deg, transparent, color-mix(in srgb, var(--admin-primary) 56%, rgba(255,255,255,0.44)), transparent)', boxShadow: '0 0 12px color-mix(in srgb, var(--admin-primary) 26%, transparent)' }} />
        <span className="pointer-events-none absolute -right-12 -top-16 h-[230px] w-[48px] rotate-[34deg]" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), rgba(255,255,255,0.23), rgba(255,255,255,0.06), transparent)', opacity: 0.30, filter: 'blur(0.8px)' }} />

        <div className="relative z-10 mb-4 flex shrink-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[17px]" style={iconChipStyle}>
              <DiamondGlints />
              <ClipboardList size={18} strokeWidth={2.5} style={{ filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--admin-primary) 34%, transparent))' }} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[18px] font-black leading-[20px]" style={styles.title}>Órdenes recientes</h2>
              <p className="mt-1 text-[13px] font-semibold leading-[18px]" style={{ ...styles.muted, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>Últimos pedidos registrados en la tienda.</p>
            </div>
          </div>

          <button type="button" onClick={onViewOrders} className="recent-orders-button relative inline-flex h-9 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[14px] px-3 text-[11.5px] font-black" style={buttonStyle}>
            <span className="recent-orders-table-shine pointer-events-none absolute -left-8 top-[-16px] h-[58px] w-[13px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.34), transparent)' }} />
            <span className="relative z-10">Ver todas</span>
            <ChevronRight size={13} className="relative z-10" />
          </button>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px]" style={tableStyle}>
          <span className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--admin-primary) 20%, transparent) 0%, transparent 64%)', opacity: 0.22, filter: 'blur(13px)' }} />
          <span className="pointer-events-none absolute inset-x-6 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.76), transparent)' }} />
          <span className="pointer-events-none absolute left-0 top-6 h-[calc(100%-48px)] w-px" style={{ background: 'linear-gradient(180deg, transparent, color-mix(in srgb, var(--admin-primary) 72%, rgba(255,255,255,0.50)), transparent)', boxShadow: '0 0 12px color-mix(in srgb, var(--admin-primary) 34%, transparent)' }} />
          <span className="recent-orders-table-shine pointer-events-none absolute -left-12 top-0 h-full w-[18px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)', opacity: 0.48 }} />

          <div className="recent-orders-grid relative z-10 grid shrink-0 grid-cols-[minmax(0,1.6fr)_88px_100px_82px] items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.07em]" style={{ color: 'var(--admin-card-muted-text)', borderBottom: '1px solid color-mix(in srgb, var(--admin-primary) 15%, rgba(255,255,255,0.24))', background: 'linear-gradient(135deg, color-mix(in srgb, var(--admin-primary) 4%, rgba(255,255,255,0.014)), rgba(255,255,255,0.004))' }}>
            <span>Orden / cliente</span>
            <span>Total</span>
            <span>Estado</span>
            <span className="text-right">Fecha</span>
          </div>

          <div className="relative z-10 grid min-h-0 flex-1 grid-rows-[repeat(5,minmax(0,1fr))] overflow-hidden">
            {visibleOrders.length > 0 ? (
              visibleOrders.map((order, index) => (
                <article key={`${order.id}-${index}`} className="recent-orders-row recent-orders-grid grid min-h-0 grid-cols-[minmax(0,1.6fr)_88px_100px_82px] items-center gap-2 px-4 py-1.5" style={{ borderBottom: index === MAX_VISIBLE_ORDERS - 1 ? 'none' : '1px solid color-mix(in srgb, var(--admin-primary) 11%, rgba(255,255,255,0.18))', background: index % 2 === 0 ? 'linear-gradient(145deg, rgba(255,255,255,0.012), rgba(255,255,255,0.002))' : 'linear-gradient(145deg, color-mix(in srgb, var(--admin-primary) 3%, rgba(255,255,255,0.010)), rgba(255,255,255,0.002))', animationDelay: `${110 + index * 55}ms` }}>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Hash size={13} strokeWidth={2.4} style={{ color: 'var(--admin-primary)' }} />
                      <p className="truncate text-[12.5px] font-black" style={styles.title} title={order.id}>{order.id}</p>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5">
                      <UserRound size={11.5} strokeWidth={2.2} style={styles.muted} />
                      <p className="min-w-0 truncate text-[11px] font-semibold" style={styles.muted} title={order.customer}>{order.customer}</p>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center gap-1.5">
                    <ReceiptText size={12.5} strokeWidth={2.2} style={{ color: 'var(--admin-primary)' }} />
                    <p className="truncate text-[11.2px] font-black" style={styles.title} title={order.total}>{order.total}</p>
                  </div>

                  <span className="inline-flex w-full min-w-0 items-center justify-center rounded-full px-2 py-1.5 text-[10.2px] font-black" style={getStatusStyle(order.statusType)} title={order.status}>
                    <span className="truncate">{order.status}</span>
                  </span>

                  <div className="flex min-w-0 items-center justify-end gap-1">
                    <CalendarDays size={12.5} strokeWidth={2.2} style={{ color: 'var(--admin-primary)' }} />
                    <p className="min-w-0 truncate text-right text-[10.5px] font-semibold" style={styles.muted} title={order.date}>{order.date}</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="col-span-full row-span-full flex h-full items-center justify-center px-5 text-center text-sm font-bold" style={styles.muted}>No hay órdenes recientes para mostrar.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
