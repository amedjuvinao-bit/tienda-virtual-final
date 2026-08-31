import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  inputStyle,
  planField,
  secondaryButtonStyle,
} from './OrderLogisticsUi';

export default function OrderLogisticsShipmentPlan({
  canManage,
  onRunAction,
  onUpdateForm,
  shipment,
  view,
}) {
  const { form, isBusy, providerActive, shipmentId } = view;
  const update = (patch) => onUpdateForm(shipmentId, patch);

  return (
    <details style={{ order: 3, marginTop: 10 }}>
      <summary style={{ cursor: 'pointer', color: ORDER_DETAIL_THEME.cardText, fontSize: 11, fontWeight: 900 }}>
        {providerActive
          ? 'Ver o corregir los datos utilizados por Envia'
          : 'Plan manual de transportadora, paquetes y SLA'}
      </summary>
      <div className="order-logistics-plan-grid" style={{ gap: 8, marginTop: 10 }}>
        {!providerActive ? (
          <>
            {planField('Prioridad', (
              <select aria-label={`Prioridad ${shipment.code}`} value={form.priority} disabled={!canManage} onChange={(event) => update({ priority: event.target.value })} style={inputStyle()}>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            ))}
            {planField('Transportadora', <input aria-label={`Transportadora ${shipment.code}`} value={form.carrierName} disabled={!canManage} onChange={(event) => update({ carrierName: event.target.value })} placeholder="Nombre de la transportadora" style={inputStyle()} />)}
            {planField('Nivel de servicio', <input aria-label={`Servicio ${shipment.code}`} value={form.serviceLevel} disabled={!canManage} onChange={(event) => update({ serviceLevel: event.target.value })} placeholder="Servicio contratado" style={inputStyle()} />)}
            {planField('Número de guía', <input aria-label={`Guía ${shipment.code}`} value={form.trackingNumber} disabled={!canManage} onChange={(event) => update({ trackingNumber: event.target.value })} placeholder="Número entregado por la transportadora" style={inputStyle()} />)}
            {planField('Límite para picking', <input type="datetime-local" aria-label={`SLA picking ${shipment.code}`} value={form.pickingDueAt} disabled={!canManage} onChange={(event) => update({ pickingDueAt: event.target.value })} style={inputStyle()} />)}
            {planField('Límite para despacho', <input type="datetime-local" aria-label={`SLA despacho ${shipment.code}`} value={form.dispatchDueAt} disabled={!canManage} onChange={(event) => update({ dispatchDueAt: event.target.value })} style={inputStyle()} />)}
            {planField('Promesa de entrega', <input type="datetime-local" aria-label={`SLA entrega ${shipment.code}`} value={form.deliveryDueAt} disabled={!canManage} onChange={(event) => update({ deliveryDueAt: event.target.value })} style={inputStyle()} />)}
          </>
        ) : null}
        {planField('Número de paquetes', <input type="number" min="1" max="20" aria-label={`Paquetes ${shipment.code}`} value={form.packageCount} disabled={!canManage} onChange={(event) => update({ packageCount: event.target.value })} style={inputStyle()} />)}
        {planField('Peso por paquete (g)', <input type="number" min="0" aria-label={`Peso ${shipment.code}`} value={form.weightGrams} disabled={!canManage} onChange={(event) => update({ weightGrams: event.target.value })} style={inputStyle()} />)}
        {planField('Largo (cm)', <input type="number" min="0" aria-label={`Largo ${shipment.code}`} value={form.lengthCm} disabled={!canManage} onChange={(event) => update({ lengthCm: event.target.value })} style={inputStyle()} />)}
        {planField('Ancho (cm)', <input type="number" min="0" aria-label={`Ancho ${shipment.code}`} value={form.widthCm} disabled={!canManage} onChange={(event) => update({ widthCm: event.target.value })} style={inputStyle()} />)}
        {planField('Alto (cm)', <input type="number" min="0" aria-label={`Alto ${shipment.code}`} value={form.heightCm} disabled={!canManage} onChange={(event) => update({ heightCm: event.target.value })} style={inputStyle()} />)}
      </div>
      <p style={{ margin: '7px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 700 }}>
        {providerActive
          ? 'Envia utilizará estos datos para calcular las tarifas. La transportadora, el servicio y la guía se completan automáticamente.'
          : 'Registra manualmente la transportadora y la guía. El peso y las dimensiones se aplican a cada paquete.'}
      </p>
      {canManage ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={() => onRunAction(shipment, 'update_plan')} disabled={isBusy} style={secondaryButtonStyle()}>
            {providerActive ? 'Guardar peso y medidas' : 'Guardar plan manual'}
          </button>
        </div>
      ) : null}
    </details>
  );
}
