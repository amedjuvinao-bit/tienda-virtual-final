import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { PrimaryButton } from './OrderDetailPrimitives';
import { ReturnInspectionField } from './OrderReturnPanelUi';
import {
  inspectionPayload,
  positiveInteger,
  returnInputStyle,
  returnItemId,
} from './orderReturnPanelModel';

export default function OrderReturnInspectionSection({
  busy,
  draft,
  id,
  onAction,
  returnCase,
  setInspection,
}) {
  return (
    <div style={{ marginTop: 11, padding: 11, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, background: ORDER_DETAIL_THEME.cardBg, borderRadius: 15 }}>
      <strong style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>Inspección física por unidad</strong>
      {(returnCase.items || []).map((item) => {
        const lineId = returnItemId(item);
        const values = draft.inspections?.[lineId] || {};
        const receivedQuantity = positiveInteger(item.receivedQuantity);
        return (
          <div key={lineId} className="order-return-inspection" style={{ marginTop: 9, padding: 10, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, background: ORDER_DETAIL_THEME.cardBg, borderRadius: 14 }}>
            <strong style={{ display: 'block', color: ORDER_DETAIL_THEME.cardText, fontSize: 11 }}>{item.title}</strong>
            <div style={{ marginTop: 4, color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, lineHeight: 1.45 }}>
              Clasifica las {receivedQuantity} unidad(es) recibida(s). La suma de Aptas, Averiadas, En cuarentena y Rechazadas debe ser exactamente {receivedQuantity}.
            </div>
            <div className="order-return-inspection-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(105px, 1fr)) minmax(170px, 1.4fr)', gap: 8, marginTop: 9, alignItems: 'stretch' }}>
              <ReturnInspectionField
                label="Aptas"
                helper="Vuelven al inventario disponible."
                ariaLabel={`Aptas ${item.title}`}
                value={values.sellableQuantity ?? receivedQuantity}
                max={receivedQuantity}
                onChange={(event) => setInspection(id, lineId, { sellableQuantity: event.target.value })}
              />
              <ReturnInspectionField
                label="Averiadas"
                helper="Se acepta la devolución, pero no se venden."
                ariaLabel={`Averiadas ${item.title}`}
                value={values.damagedQuantity || ''}
                max={receivedQuantity}
                onChange={(event) => setInspection(id, lineId, { damagedQuantity: event.target.value })}
              />
              <ReturnInspectionField
                label="En cuarentena"
                helper="Quedan separadas para una revisión posterior."
                ariaLabel={`Cuarentena ${item.title}`}
                value={values.quarantineQuantity || ''}
                max={receivedQuantity}
                onChange={(event) => setInspection(id, lineId, { quarantineQuantity: event.target.value })}
              />
              <ReturnInspectionField
                label="Rechazadas"
                helper="No se acepta la devolución de estas unidades."
                ariaLabel={`Rechazadas ${item.title}`}
                value={values.rejectedQuantity || ''}
                max={receivedQuantity}
                onChange={(event) => setInspection(id, lineId, { rejectedQuantity: event.target.value })}
              />
              <label style={{ display: 'flex', minWidth: 0, flexDirection: 'column', gap: 4, padding: 9, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, background: ORDER_DETAIL_THEME.inputBg, borderRadius: 13 }}>
                <strong style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 11 }}>Nota de inspección</strong>
                <span style={{ minHeight: 26, color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, lineHeight: 1.35 }}>Explica el daño o la decisión tomada.</span>
                <input aria-label={`Nota inspección ${item.title}`} value={values.inspectionNote || ''} onChange={(event) => setInspection(id, lineId, { inspectionNote: event.target.value })} placeholder="Ej.: empaque abierto" style={returnInputStyle({ marginTop: 2 })} />
              </label>
            </div>
          </div>
        );
      })}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <PrimaryButton disabled={busy} onClick={() => onAction?.(returnCase, 'inspect', inspectionPayload(returnCase, draft))}>Cerrar inspección</PrimaryButton>
      </div>
    </div>
  );
}
