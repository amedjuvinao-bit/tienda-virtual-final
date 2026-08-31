import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { PrimaryButton, SoftBadge } from './OrderDetailPrimitives';
import {
  positiveInteger,
  resolutionLabel,
  RETURN_REASONS,
  returnInputStyle,
} from './orderReturnPanelModel';
import { fmtDate } from './orderDetailUtils';

export default function OrderReturnCreateSection({
  allowedCreateResolutions,
  busyId,
  canManage,
  createOpen,
  needsOverride,
  overrideReason,
  policy,
  reasonSummary,
  requestItems,
  requestable,
  resolution,
  resolutionAllowedForSelection,
  selectedItems,
  selectedNeedsManualReview,
  setCreateOpen,
  setOverrideReason,
  setReasonSummary,
  setRequestItem,
  setResolution,
  submitCreate,
}) {
  return (
    <>
      {canManage && requestable.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <PrimaryButton onClick={() => setCreateOpen((open) => !open)} disabled={Boolean(busyId)}>
            {createOpen ? 'Cerrar solicitud' : 'Nueva devolución o cambio'}
          </PrimaryButton>
        </div>
      ) : null}

      {createOpen ? (
        <div style={{ marginTop: 14, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, background: ORDER_DETAIL_THEME.inputBg, borderRadius: 18, padding: 14 }}>
          <div className="order-return-form-grid" style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 10 }}>
            <select aria-label="Resolución solicitada" value={resolution} onChange={(event) => setResolution(event.target.value)} style={returnInputStyle()}>
              {allowedCreateResolutions.map((value) => (
                <option key={value} value={value}>{resolutionLabel(value)}</option>
              ))}
            </select>
            <input aria-label="Resumen de la devolución" value={reasonSummary} onChange={(event) => setReasonSummary(event.target.value)} placeholder="Resumen para el expediente" style={returnInputStyle()} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 11 }}>
            {requestable.map((item) => {
              const draft = requestItems[item.orderItemId] || {};
              const quantity = positiveInteger(draft.quantity);
              return (
                <div key={item.orderItemId} className="order-return-request-line" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 90px 190px minmax(150px, 1fr)', gap: 8, alignItems: 'center', padding: 10, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 14, background: ORDER_DETAIL_THEME.cardBg }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: 12 }}>{item.title}</strong>
                    <span style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 10 }}>
                      Disponible {item.availableQuantity} de {item.deliveredQuantity} · hasta {fmtDate(item.eligibleUntil)}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                      {item.policyRuleKey && item.policyRuleKey !== 'default' ? (
                        <SoftBadge variant="primary">{item.policyRuleName || 'Política especial'} · {item.policyWindowDays || policy.windowDays || 30} días</SoftBadge>
                      ) : null}
                      {item.policyManualReview ? <SoftBadge variant="warning">Revisión manual</SoftBadge> : null}
                      {item.expired || item.policyReturnable === false ? <SoftBadge variant="danger">Requiere excepción</SoftBadge> : null}
                    </div>
                  </div>
                  <input aria-label={`Cantidad ${item.title}`} type="number" min="0" max={item.availableQuantity} value={draft.quantity || ''} onChange={(event) => setRequestItem(item.orderItemId, { quantity: Math.min(item.availableQuantity, positiveInteger(event.target.value)) })} style={returnInputStyle()} />
                  <select aria-label={`Motivo ${item.title}`} value={draft.reasonCode || 'other'} disabled={!quantity} onChange={(event) => setRequestItem(item.orderItemId, { reasonCode: event.target.value })} style={returnInputStyle()}>
                    {RETURN_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input aria-label={`Detalle ${item.title}`} value={draft.reasonText || ''} disabled={!quantity} onChange={(event) => setRequestItem(item.orderItemId, { reasonText: event.target.value })} placeholder="Detalle opcional" style={returnInputStyle()} />
                </div>
              );
            })}
          </div>

          {needsOverride ? (
            <input aria-label="Justificación fuera de política" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Justificación obligatoria para excepción de política" style={returnInputStyle({ marginTop: 10, borderColor: ORDER_DETAIL_THEME.warning })} />
          ) : null}

          {selectedNeedsManualReview ? (
            <div style={{ marginTop: 10, padding: '10px 12px', border: `1px solid ${ORDER_DETAIL_THEME.warning}`, background: ORDER_DETAIL_THEME.cardBg, borderRadius: 13, color: ORDER_DETAIL_THEME.cardText, fontSize: 11 }}>
              La política seleccionada exige revisión manual. El expediente se creará solicitado y no se autorizará automáticamente.
            </div>
          ) : null}

          {selectedItems.length && !resolutionAllowedForSelection ? (
            <div role="alert" style={{ marginTop: 10, color: ORDER_DETAIL_THEME.danger, fontSize: 11, fontWeight: 850 }}>
              La solución elegida no está permitida para todos los productos seleccionados.
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <PrimaryButton onClick={submitCreate} disabled={!selectedItems.length || !resolutionAllowedForSelection || Boolean(busyId) || (needsOverride && overrideReason.trim().length < 8)}>
              Crear expediente RMA
            </PrimaryButton>
          </div>
        </div>
      ) : null}
    </>
  );
}
