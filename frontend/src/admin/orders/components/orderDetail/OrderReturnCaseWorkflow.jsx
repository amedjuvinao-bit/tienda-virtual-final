import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { GhostButton, PrimaryButton } from './OrderDetailPrimitives';
import {
  positiveInteger,
  returnInputStyle,
  returnItemId,
} from './orderReturnPanelModel';

export function ReturnAuthorizationSection({
  busy,
  draft,
  id,
  onAction,
  policy,
  returnCase,
  setDraft,
  setLineValue,
}) {
  const needsRiskReview = returnCase.riskAssessment?.decision === 'manual_review';

  const authorize = () => onAction?.(returnCase, 'authorize', {
    riskReviewNote: String(draft.riskReviewNote || '').trim(),
    items: (returnCase.items || []).map((item) => ({
      orderItemId: returnItemId(item),
      authorizedQuantity: positiveInteger(
        draft.authorized?.[returnItemId(item)] ?? item.requestedQuantity
      ),
    })),
    shipping: {
      method: draft.carrierName ? 'carrier' : 'drop_off',
      carrierName: draft.carrierName || '',
      trackingNumber: draft.trackingNumber || '',
      labelUrl: draft.labelUrl || '',
      instructions: draft.instructions || policy.instructions || '',
    },
  });

  return (
    <div style={{ marginTop: 11 }}>
      {needsRiskReview ? (
        <label style={{ display: 'block', marginBottom: 9, color: ORDER_DETAIL_THEME.cardText, fontSize: 10, fontWeight: 850 }}>
          Conclusión de la revisión antifraude
          <input
            aria-label={`Conclusión antifraude ${returnCase.returnNumber}`}
            value={draft.riskReviewNote || ''}
            onChange={(event) => setDraft(id, { riskReviewNote: event.target.value })}
            placeholder="Explica qué verificaste antes de autorizar (obligatorio)"
            style={returnInputStyle({ marginTop: 5, borderColor: ORDER_DETAIL_THEME.warning })}
          />
        </label>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {(returnCase.items || []).map((item) => (
          <label key={returnItemId(item)} style={{ flex: '1 1 180px', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 800 }}>
            Autorizar · {item.title}
            <input aria-label={`Autorizar ${item.title}`} type="number" min="0" max={item.requestedQuantity} value={draft.authorized?.[returnItemId(item)] ?? item.requestedQuantity} onChange={(event) => setLineValue(id, 'authorized', returnItemId(item), Math.min(item.requestedQuantity, positiveInteger(event.target.value)))} style={returnInputStyle({ marginTop: 5 })} />
          </label>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 8 }}>
        <input aria-label={`Motivo rechazo ${returnCase.returnNumber}`} value={draft.reason || ''} onChange={(event) => setDraft(id, { reason: event.target.value })} placeholder="Motivo si se rechaza" style={returnInputStyle()} />
        <GhostButton disabled={busy || String(draft.reason || '').trim().length < 5} onClick={() => onAction?.(returnCase, 'reject', { reason: String(draft.reason || '').trim() })}>Rechazar</GhostButton>
        <PrimaryButton disabled={busy || (needsRiskReview && String(draft.riskReviewNote || '').trim().length < 8) || !(returnCase.items || []).some((item) => positiveInteger(draft.authorized?.[returnItemId(item)] ?? item.requestedQuantity) > 0)} onClick={authorize}>Autorizar</PrimaryButton>
      </div>

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 850 }}>Logística y etiqueta de retorno</summary>
        <div className="order-return-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
          <input aria-label={`Transportadora ${returnCase.returnNumber}`} value={draft.carrierName || ''} onChange={(event) => setDraft(id, { carrierName: event.target.value })} placeholder="Transportadora (opcional)" style={returnInputStyle()} />
          <input aria-label={`Guía ${returnCase.returnNumber}`} value={draft.trackingNumber || ''} onChange={(event) => setDraft(id, { trackingNumber: event.target.value })} placeholder="Número de guía (opcional)" style={returnInputStyle()} />
          <input aria-label={`URL etiqueta ${returnCase.returnNumber}`} value={draft.labelUrl || ''} onChange={(event) => setDraft(id, { labelUrl: event.target.value })} placeholder="URL HTTPS de etiqueta de transportadora" style={returnInputStyle()} />
          <input aria-label={`Instrucciones ${returnCase.returnNumber}`} value={draft.instructions || policy.instructions || ''} onChange={(event) => setDraft(id, { instructions: event.target.value })} placeholder="Instrucciones para el cliente" style={returnInputStyle()} />
        </div>
      </details>
    </div>
  );
}

export function ReturnReceivingSection({
  busy,
  draft,
  id,
  onAction,
  policy,
  returnCase,
  setDraft,
  setLineValue,
}) {
  const activeIntegratedLabel = Boolean(
    returnCase.shipping?.integration?.provider &&
    returnCase.shipping.integration.provider !== 'manual' &&
    returnCase.shipping.integration.status !== 'cancelled' &&
    returnCase.shipping?.trackingNumber &&
    returnCase.shipping?.labelUrl
  );
  const waitingForCarrierDelivery = Boolean(
    activeIntegratedLabel && !returnCase.shipping?.awaitingWarehouseReceipt
  );
  const markInTransit = () => onAction?.(returnCase, 'mark_in_transit', {
    shipping: {
      carrierName: draft.carrierName || returnCase.shipping?.carrierName,
      trackingNumber: draft.trackingNumber || returnCase.shipping?.trackingNumber,
      labelUrl: draft.labelUrl || returnCase.shipping?.labelUrl,
      instructions: draft.instructions || returnCase.shipping?.instructions || policy.instructions,
    },
  });

  const receive = () => onAction?.(returnCase, 'receive', {
    items: (returnCase.items || []).map((item) => ({
      orderItemId: returnItemId(item),
      receivedQuantity: positiveInteger(
        draft.received?.[returnItemId(item)] ?? item.authorizedQuantity
      ),
    })),
  });

  return (
    <div style={{ marginTop: 11 }}>
      <div className="order-return-form-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
        <input aria-label={`Transportadora ${returnCase.returnNumber}`} value={draft.carrierName || returnCase.shipping?.carrierName || ''} onChange={(event) => setDraft(id, { carrierName: event.target.value })} placeholder="Transportadora" style={returnInputStyle()} />
        <input aria-label={`Guía ${returnCase.returnNumber}`} value={draft.trackingNumber || returnCase.shipping?.trackingNumber || ''} onChange={(event) => setDraft(id, { trackingNumber: event.target.value })} placeholder="Número de guía" style={returnInputStyle()} />
        <input aria-label={`URL etiqueta ${returnCase.returnNumber}`} value={draft.labelUrl || returnCase.shipping?.labelUrl || ''} onChange={(event) => setDraft(id, { labelUrl: event.target.value })} placeholder="URL HTTPS de etiqueta" style={returnInputStyle()} />
        <input aria-label={`Instrucciones ${returnCase.returnNumber}`} value={draft.instructions || returnCase.shipping?.instructions || policy.instructions || ''} onChange={(event) => setDraft(id, { instructions: event.target.value })} placeholder="Instrucciones para el cliente" style={returnInputStyle()} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {(returnCase.items || []).filter((item) => positiveInteger(item.authorizedQuantity) > 0).map((item) => (
          <label key={returnItemId(item)} style={{ flex: '1 1 180px', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 800 }}>
            Recibir · {item.title}
            <input aria-label={`Recibir ${item.title}`} type="number" min="0" max={item.authorizedQuantity} value={draft.received?.[returnItemId(item)] ?? item.authorizedQuantity} onChange={(event) => setLineValue(id, 'received', returnItemId(item), Math.min(item.authorizedQuantity, positiveInteger(event.target.value)))} style={returnInputStyle({ marginTop: 5 })} />
          </label>
        ))}
      </div>

      <input aria-label={`Motivo cancelación ${returnCase.returnNumber}`} value={draft.cancellationReason || ''} onChange={(event) => setDraft(id, { cancellationReason: event.target.value })} placeholder="Motivo si el cliente cancela el RMA" style={returnInputStyle({ marginTop: 8 })} />
      {waitingForCarrierDelivery ? (
        <p style={{ margin: '8px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 780 }}>
          Registrar recepción se habilitará cuando la transportadora reporte la llegada a la sede.
        </p>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <GhostButton disabled={busy || activeIntegratedLabel || String(draft.cancellationReason || '').trim().length < 5} onClick={() => onAction?.(returnCase, 'cancel', { reason: String(draft.cancellationReason || '').trim() })}>Cancelar RMA</GhostButton>
        {returnCase.status === 'authorized' && (
          !returnCase.shipping?.integration?.provider ||
          returnCase.shipping.integration.provider === 'manual' ||
          returnCase.shipping.integration.status === 'cancelled'
        ) ? (
          <GhostButton disabled={busy} onClick={markInTransit}>Marcar en tránsito</GhostButton>
        ) : null}
        <PrimaryButton disabled={busy || waitingForCarrierDelivery || !(returnCase.items || []).some((item) => positiveInteger(draft.received?.[returnItemId(item)] ?? item.authorizedQuantity) > 0)} onClick={receive}>Registrar recepción</PrimaryButton>
      </div>
    </div>
  );
}
