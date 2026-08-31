import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { GhostButton, PrimaryButton } from './OrderDetailPrimitives';
import {
  positiveInteger,
  resolutionLabel,
  returnInputStyle,
} from './orderReturnPanelModel';

export default function OrderReturnResolutionSection({
  busy,
  canManage,
  canRefund,
  draft,
  id,
  onAutomaticExchange,
  onExchange,
  onRefund,
  onStoreCredit,
  policy,
  returnCase,
  setDraft,
}) {
  const resolutionRequired = returnCase.status === 'resolution_required';
  const amount = draft.amount ?? returnCase.estimatedRefundAmount;

  return (
    <>
      {resolutionRequired && returnCase.requestedResolution === 'refund' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, marginTop: 11 }}>
          <input aria-label={`Monto reembolso ${returnCase.returnNumber}`} type="number" min="1" max={returnCase.estimatedRefundAmount} value={amount} disabled={!canRefund} onChange={(event) => setDraft(id, { amount: event.target.value })} style={returnInputStyle()} />
          <PrimaryButton disabled={!canRefund || busy || positiveInteger(amount) <= 0} onClick={() => onRefund?.(returnCase, Number(amount))}>Crear reembolso</PrimaryButton>
        </div>
      ) : null}

      {resolutionRequired && returnCase.requestedResolution === 'store_credit' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, marginTop: 11 }}>
          <input aria-label={`Monto saldo a favor ${returnCase.returnNumber}`} type="number" min="1" max={returnCase.estimatedRefundAmount} value={amount} disabled={!canRefund} onChange={(event) => setDraft(id, { amount: event.target.value })} style={returnInputStyle()} />
          <PrimaryButton disabled={!canRefund || busy || positiveInteger(amount) <= 0} onClick={() => onStoreCredit?.(returnCase, Number(amount))}>Emitir saldo a favor</PrimaryButton>
        </div>
      ) : null}

      {canManage && resolutionRequired && returnCase.requestedResolution === 'exchange' ? (
        <div style={{ marginTop: 11, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 15, padding: 11, background: ORDER_DETAIL_THEME.cardBg }}>
          <strong style={{ display: 'block', fontSize: 12 }}>Siguiente paso: crear la orden de cambio</strong>
          <span style={{ display: 'block', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, marginTop: 3 }}>La opción automática crea una orden sin cobro y reserva el inventario aceptado.</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, marginTop: 9 }}>
            <input aria-label={`Referencia cambio ${returnCase.returnNumber}`} value={draft.reference || 'Cambio automático por RMA'} onChange={(event) => setDraft(id, { reference: event.target.value })} placeholder="Referencia o motivo del cambio" style={returnInputStyle()} />
            <PrimaryButton disabled={busy || policy.automaticExchangeEnabled === false} onClick={() => onAutomaticExchange?.(returnCase, String(draft.reference || 'Cambio automático por RMA').trim())}>Crear orden de cambio</PrimaryButton>
          </div>
          <details style={{ marginTop: 9 }}>
            <summary style={{ cursor: 'pointer', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 850 }}>Ya existe una orden de reemplazo</summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, marginTop: 8 }}>
              <input aria-label={`Orden reemplazo ${returnCase.returnNumber}`} value={draft.replacementOrderId || ''} onChange={(event) => setDraft(id, { replacementOrderId: event.target.value })} placeholder="ID interno de la orden existente" style={returnInputStyle()} />
              <GhostButton disabled={busy || String(draft.replacementOrderId || '').trim().length < 12 || String(draft.reference || '').trim().length < 4} onClick={() => onExchange?.(returnCase, String(draft.replacementOrderId || '').trim(), String(draft.reference || '').trim())}>Vincular existente</GhostButton>
            </div>
          </details>
        </div>
      ) : null}

      {returnCase.resolution?.state ? (
        <div style={{ marginTop: 10, color: ORDER_DETAIL_THEME.mutedText, fontSize: 11 }}>
          Resolución: <strong style={{ color: ORDER_DETAIL_THEME.cardText }}>{resolutionLabel(returnCase.resolution.type)}</strong>
          {returnCase.resolution.reference ? ` · ${returnCase.resolution.reference}` : ''}
          {returnCase.resolution.replacementOrderNumber ? ` · ${returnCase.resolution.replacementOrderNumber}` : ''}
          {returnCase.resolution.state !== 'completed'
            ? ' · conciliación en curso'
            : ''}
        </div>
      ) : null}
    </>
  );
}
