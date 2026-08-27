import {
  dangerButtonStyle,
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from './OrderLogisticsUi';

export default function OrderLogisticsShipmentActions({
  canManage,
  onRunAction,
  onUpdateForm,
  shipment,
  view,
}) {
  return (
    <>
      {view.status === 'packed' ? (
        <input aria-label={`Referencia de despacho ${shipment.code}`} value={view.form.dispatchReference} disabled={!canManage} onChange={(event) => onUpdateForm(view.shipmentId, { dispatchReference: event.target.value })} placeholder="Referencia de entrega al transportador (obligatoria)" style={{ ...inputStyle(), order: 7, width: '100%', marginTop: 10 }} />
      ) : null}
      {view.status === 'in_transit' && !view.automaticTrackingEnabled ? (
        <div style={{ order: 7, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <input aria-label={`Evidencia de entrega ${shipment.code}`} value={view.form.deliveryReference} disabled={!canManage} onChange={(event) => onUpdateForm(view.shipmentId, { deliveryReference: event.target.value })} placeholder="Referencia de evidencia (obligatoria)" style={inputStyle()} />
          <input aria-label={`Recibe ${shipment.code}`} value={view.form.recipient} disabled={!canManage} onChange={(event) => onUpdateForm(view.shipmentId, { recipient: event.target.value })} placeholder="Nombre de quien recibe" style={inputStyle()} />
        </div>
      ) : null}

      <div style={{ order: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {view.status === 'exception' ? (
          <div style={{ flex: '1 1 420px', borderRadius: 14, background: '#fff1f2', padding: 10 }}>
            <div style={{ color: '#9f1239', fontSize: 11, fontWeight: 900 }}>{view.openIncident?.type || 'Incidencia'} · {view.openIncident?.severity || 'medium'}</div>
            <div style={{ marginTop: 4, color: '#881337', fontSize: 11 }}>{view.openIncident?.description}</div>
            {canManage ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input aria-label={`Resolución ${shipment.code}`} value={view.form.resolution} onChange={(event) => onUpdateForm(view.shipmentId, { resolution: event.target.value })} placeholder="Resolución aplicada" style={{ ...inputStyle(), flex: 1 }} />
                <button type="button" onClick={() => onRunAction(shipment, 'resolve_incident')} disabled={view.isBusy} style={secondaryButtonStyle()}>Resolver incidencia</button>
              </div>
            ) : null}
          </div>
        ) : (
          <details>
            <summary style={{ cursor: 'pointer', color: '#be123c', fontSize: 10, fontWeight: 900 }}>Reportar incidencia</summary>
            {canManage ? (
              <div style={{ display: 'grid', gridTemplateColumns: '140px 120px minmax(220px, 1fr) auto', gap: 6, marginTop: 8 }}>
                <select aria-label={`Tipo de incidencia ${shipment.code}`} value={view.form.incidentType} onChange={(event) => onUpdateForm(view.shipmentId, { incidentType: event.target.value })} style={inputStyle()}>
                  <option value="delay">Retraso</option><option value="stock_mismatch">Diferencia de inventario</option><option value="damage">Daño</option><option value="address">Dirección</option><option value="carrier">Transportadora</option><option value="customer_unavailable">Cliente ausente</option><option value="other">Otra</option>
                </select>
                <select aria-label={`Severidad ${shipment.code}`} value={view.form.severity} onChange={(event) => onUpdateForm(view.shipmentId, { severity: event.target.value })} style={inputStyle()}>
                  <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option>
                </select>
                <input aria-label={`Descripción de incidencia ${shipment.code}`} value={view.form.incidentDescription} onChange={(event) => onUpdateForm(view.shipmentId, { incidentDescription: event.target.value })} placeholder="Describe lo ocurrido" style={inputStyle()} />
                <button type="button" onClick={() => onRunAction(shipment, 'report_incident')} disabled={view.isBusy} style={dangerButtonStyle()}>Abrir incidencia</button>
              </div>
            ) : null}
          </details>
        )}
        {view.automaticTrackingEnabled && view.status === 'delivered' ? (
          <div role="status" style={{ marginLeft: 'auto', borderRadius: 12, padding: '9px 11px', background: '#ecfdf5', color: '#047857', fontSize: 10, fontWeight: 900 }}>
            Entrega confirmada automáticamente
          </div>
        ) : view.automaticTrackingEnabled && view.nextRequiresCarrierUpdate ? (
          <div role="status" style={{ marginLeft: 'auto', borderRadius: 12, padding: '9px 11px', background: '#eef2ff', color: '#4338ca', fontSize: 10, fontWeight: 900 }}>
            Esperando actualización automática de Envia
          </div>
        ) : canManage && view.next && !view.waitingForAutomaticHandoff ? (
          <button type="button" onClick={() => onRunAction(shipment, view.next[0])} disabled={view.isBusy} style={primaryButtonStyle()}>
            {view.isBusy ? 'Actualizando…' : view.next[1]}
          </button>
        ) : null}
      </div>
    </>
  );
}
