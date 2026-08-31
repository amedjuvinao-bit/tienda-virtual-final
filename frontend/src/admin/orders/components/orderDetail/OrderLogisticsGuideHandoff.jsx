import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  inputStyle,
  planField,
  primaryButtonStyle,
  secondaryButtonStyle,
} from './OrderLogisticsUi';

export function OrderLogisticsGuideStatus({ shipment, view }) {
  if (view.hasActiveLabel) {
    return (
      <div style={{ marginTop: 10, border: '1px solid #86efac', borderRadius: 14, padding: 12, background: '#ecfdf5' }}>
        <div style={{ color: '#047857', fontSize: 9, fontWeight: 950, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Guía lista
        </div>
        <div style={{ marginTop: 5, color: ORDER_DETAIL_THEME.cardText, fontSize: 13, fontWeight: 950 }}>
          {shipment.carrier?.name || shipment.shippingIntegration?.selectedRate?.carrier || 'Transportadora'} · {shipment.carrier?.serviceLevel || shipment.shippingIntegration?.selectedRate?.service || 'Servicio'}
        </div>
        <div style={{ marginTop: 3, color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 750 }}>
          Número de guía: {shipment.carrier?.trackingNumber || 'generado'}
        </div>
        <div style={{ marginTop: 7, borderRadius: 10, padding: '7px 9px', background: '#d1fae5', color: '#047857', fontSize: 9, fontWeight: 850 }}>
          {view.webhookRegistered
            ? view.isProductionGuide
              ? 'Seguimiento automático listo: Envia actualizará esta orden. No selecciones estados manualmente.'
              : 'Seguimiento automático listo para probar. La simulación está separada abajo en “Pruebas Sandbox”.'
            : 'Seguimiento automático pendiente. Registra el webhook desde Configuración → Envíos.'}
        </div>
        {(shipment.shippingIntegration?.providerStatus || view.lastTrackingEvent?.status) ? (
          <div style={{ marginTop: 7, color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 750 }}>
            {view.isProductionGuide ? 'Último estado de Envia' : 'Último aviso de prueba de Envia'}: <strong>{shipment.shippingIntegration?.providerStatus || view.lastTrackingEvent?.status}</strong>
            {shipment.shippingIntegration?.providerStatusDescription ? ` · ${shipment.shippingIntegration.providerStatusDescription}` : ''}
            {!view.isProductionGuide ? ' · simulación, no cambia el paquete real' : ''}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
          <a href={shipment.shippingIntegration.labelUrl} target="_blank" rel="noreferrer" style={{ ...primaryButtonStyle(), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            Descargar etiqueta
          </a>
          {view.showPublicTracking ? (
            <a href={shipment.carrier.trackingUrl} target="_blank" rel="noreferrer" style={{ ...secondaryButtonStyle(), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              Ver seguimiento público
            </a>
          ) : null}
        </div>
        {!view.isProductionGuide ? (
          <p style={{ margin: '8px 0 0', color: '#047857', fontSize: 9, fontWeight: 800 }}>
            El seguimiento público se habilitará únicamente para las guías reales de producción.
          </p>
        ) : null}
      </div>
    );
  }

  if (view.labelCancelled && shipment.shippingIntegration?.labelUrl) {
    return (
      <div style={{ marginTop: 9, borderRadius: 12, padding: 9, background: '#fff1f2', color: '#be123c', fontSize: 9, fontWeight: 850 }}>
        La guía anterior está cancelada y ya no puede utilizarse.
        {shipment.shippingIntegration?.cancellation?.status === 'refund_pending'
          ? ' El reintegro del saldo sigue pendiente de confirmación.'
          : shipment.shippingIntegration?.cancellation?.status === 'refunded'
            ? ' Envia confirmó el reintegro del saldo.'
            : ''}
      </div>
    );
  }

  return null;
}

export function OrderLogisticsHandoff({
  canManage,
  onRunProviderAction,
  onUpdateForm,
  shipment,
  view,
}) {
  if (!canManage || !view.hasActiveLabel || !view.providerConfigured) return null;

  return (
    <div style={{ marginTop: 10, border: `1px solid ${view.handoffComplete ? '#86efac' : ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 14, padding: 12, background: view.handoffComplete ? '#f0fdf4' : ORDER_DETAIL_THEME.cardBg }}>
      <div style={{ color: view.handoffComplete ? '#047857' : ORDER_DETAIL_THEME.cardText, fontSize: 11, fontWeight: 950 }}>
        Paso final: entrega física a la transportadora
      </div>
      {view.pickupFailed ? (
        <div style={{ marginTop: 8, borderRadius: 10, padding: 9, background: '#fff7ed', color: '#9a3412', fontSize: 10, fontWeight: 800, lineHeight: 1.5 }}>
          La guía existe, pero falta la confirmación de la recolección que debía programarse al generarla. Cancela esta guía desde “Gestionar guía” y crea otra antes de preparar los productos.
        </div>
      ) : view.pickupScheduled ? (
        <div style={{ marginTop: 7, color: '#047857', fontSize: 10, fontWeight: 800, lineHeight: 1.5 }}>
          Recolección confirmada <strong>{view.pickup.confirmation}</strong> para el {view.pickup.requestedDate}{view.pickup.timeFrom && view.pickup.timeTo ? `, entre ${view.pickup.timeFrom} y ${view.pickup.timeTo}` : ''}. Ten el paquete cerrado y etiquetado antes de esa fecha.
        </div>
      ) : view.handoffMode === 'dropoff' ? (
        <div style={{ marginTop: 7, color: '#047857', fontSize: 10, fontWeight: 800, lineHeight: 1.5 }}>
          Entrega en punto seleccionada. Imprime la etiqueta, prepara el paquete y llévalo a un punto autorizado de la transportadora.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 9, marginTop: 9 }}>
          {view.dropoffAvailable ? (
            <div style={{ border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 12, padding: 10 }}>
              <div style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 10, fontWeight: 950 }}>Llevar a un punto autorizado</div>
              <p style={{ margin: '4px 0 8px', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 700, lineHeight: 1.45 }}>
                No genera una solicitud adicional. Lleva el paquete etiquetado y conserva el comprobante.
              </p>
              <button type="button" onClick={() => onRunProviderAction(shipment, 'dropoff')} disabled={view.isBusy} style={secondaryButtonStyle()}>
                Elegir entrega en punto
              </button>
            </div>
          ) : null}
          {(view.standalonePickup || view.pickupMandatory) ? (
            <div style={{ border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 12, padding: 10 }}>
              <div style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 10, fontWeight: 950 }}>Opción B · Solicitar recolección</div>
              <p style={{ margin: '4px 0 8px', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 700, lineHeight: 1.45 }}>
                Envia consulta si la transportadora admite recolección. En producción puede tener un costo adicional.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {planField('Fecha', <input type="date" aria-label={`Fecha de recolección ${shipment.code}`} value={view.form.pickupDate} onChange={(event) => onUpdateForm(view.shipmentId, { pickupDate: event.target.value })} style={inputStyle()} />)}
                {planField('Desde', <input type="time" aria-label={`Inicio de recolección ${shipment.code}`} value={view.form.pickupTimeStart} onChange={(event) => onUpdateForm(view.shipmentId, { pickupTimeStart: event.target.value })} style={inputStyle()} />)}
                {planField('Hasta', <input type="time" aria-label={`Fin de recolección ${shipment.code}`} value={view.form.pickupTimeEnd} onChange={(event) => onUpdateForm(view.shipmentId, { pickupTimeEnd: event.target.value })} style={inputStyle()} />)}
              </div>
              <input aria-label={`Instrucciones de recolección ${shipment.code}`} value={view.form.pickupInstructions} onChange={(event) => onUpdateForm(view.shipmentId, { pickupInstructions: event.target.value })} placeholder="Instrucciones internas (opcional)" style={{ ...inputStyle(), width: '100%', marginTop: 6 }} />
              <button type="button" onClick={() => onRunProviderAction(shipment, 'pickup')} disabled={view.isBusy} style={{ ...primaryButtonStyle(), marginTop: 8 }}>
                {view.isProductionGuide ? 'Solicitar recolección real' : 'Solicitar recolección Sandbox'}
              </button>
            </div>
          ) : null}
          {!view.dropoffAvailable && !view.standalonePickup && !view.pickupMandatory ? (
            <div style={{ borderRadius: 12, padding: 10, background: '#fff7ed', color: '#9a3412', fontSize: 10, fontWeight: 800 }}>
              Esta guía requería programar la recolección al generarla. Cancélala y crea una nueva indicando la fecha.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
