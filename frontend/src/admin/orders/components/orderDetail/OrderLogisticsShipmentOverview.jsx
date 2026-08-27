import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  STATUS_LABELS,
  STATUS_POSITION,
  STEPS,
  formatDeadline,
} from './orderLogisticsViewModel';

export function ShipmentHeader({ shipment, view }) {
  return (
    <div style={{ order: 1, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 13, fontWeight: 950 }}>
          {shipment.code} · {shipment.branchSnapshot?.name || shipment.branchSnapshot?.code || 'Sede operativa'}
        </div>
        <div style={{ marginTop: 3, color: ORDER_DETAIL_THEME.mutedText, fontSize: 11 }}>
          {shipment.quantity} unidad(es) · {shipment.packages?.length || 0} paquete(s) · revisión {Number(shipment.revision || 0)}
        </div>
      </div>
      <span style={{ alignSelf: 'flex-start', borderRadius: 999, padding: '6px 10px', background: view.status === 'exception' ? '#ffe4e6' : 'var(--admin-primary-soft-bg)', color: view.status === 'exception' ? '#be123c' : 'var(--admin-primary)', fontSize: 10, fontWeight: 950 }}>
        {STATUS_LABELS[view.status] || view.status}
      </span>
    </div>
  );
}

export function ShipmentProgress({ shipment, view }) {
  return (
    <details style={{ order: 4, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${ORDER_DETAIL_THEME.cardBorder}` }}>
      <summary style={{ cursor: 'pointer', color: ORDER_DETAIL_THEME.cardText, fontSize: 11, fontWeight: 900 }}>
        Ver avance detallado del paquete
      </summary>
      <p style={{ margin: '4px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 720, lineHeight: 1.4 }}>
        {view.waitingForAutomaticHandoff
          ? 'Primero genera la guía y define cómo llegará el paquete a la transportadora. Después podrás comenzar a reunir los productos.'
          : view.automaticTrackingEnabled && view.nextRequiresCarrierUpdate
            ? 'Tu trabajo de preparación terminó. Los siguientes estados llegarán automáticamente desde Envia.'
            : 'Pulsa únicamente el botón que describe la siguiente tarea.'}
      </p>
      <div className="order-logistics-step-grid" style={{ gap: 5, marginTop: 10 }}>
        {STEPS.map(([step, label], index) => {
          const active = view.status === 'exception'
            ? index <= (STATUS_POSITION[shipment.resumeStatus] ?? 0)
            : index <= view.position;
          return (
            <div key={step} style={{ borderRadius: 10, padding: '7px 4px', textAlign: 'center', background: active ? 'var(--admin-primary-soft-bg)' : 'var(--admin-bg)', color: active ? 'var(--admin-primary)' : ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 900 }}>
              {label}
            </div>
          );
        })}
      </div>

      <div className="order-logistics-deadline-grid" style={{ gap: 8, marginTop: 10 }}>
        {[
          ['Picking', shipment.sla?.pickingDueAt],
          ['Despacho', shipment.sla?.dispatchDueAt],
          ['Promesa de entrega', shipment.sla?.deliveryDueAt],
        ].map(([label, value]) => (
          <div key={label} style={{ borderRadius: 12, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, padding: 9 }}>
            <div style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ marginTop: 3, color: shipment.sla?.breachedAt ? '#be123c' : ORDER_DETAIL_THEME.cardText, fontSize: 11, fontWeight: 850 }}>{formatDeadline(value)}</div>
          </div>
        ))}
      </div>
    </details>
  );
}
