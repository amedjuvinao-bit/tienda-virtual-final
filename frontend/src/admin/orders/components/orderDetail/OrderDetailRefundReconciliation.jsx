import { useState } from 'react';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { fmtDate, toCOP } from './orderDetailUtils';
import { OrderDetailIcons } from './OrderDetailIcons';
import {
  InfoLine,
  OrderDetailPanel,
  SectionTitle,
  SoftBadge,
} from './OrderDetailPrimitives';

const STAGES = [
  ['inventory', 'Inventario'],
  ['payment', 'Dinero'],
  ['cash', 'Caja'],
  ['billing', 'Nota crédito'],
];

const STATE_LABELS = {
  not_required: 'No aplica',
  pending: 'Pendiente',
  action_required: 'Requiere acción',
  processing: 'Procesando',
  completed: 'Completo',
  failed: 'Falló',
};

function badgeVariant(state) {
  if (state === 'completed' || state === 'not_required') return 'success';
  if (state === 'failed') return 'danger';
  return 'warning';
}

function nextReconciliationStep(reconciliation = {}) {
  const state = (key) => reconciliation?.[key]?.state || 'pending';

  if (['action_required', 'failed'].includes(state('payment'))) {
    return {
      title: 'Confirma el dinero devuelto',
      detail: 'Registra la referencia del reverso o comprobante para recalcular la caja.',
      variant: state('payment') === 'failed' ? 'danger' : 'warning',
    };
  }
  if (state('payment') === 'processing') {
    return {
      title: 'Espera la respuesta del medio de pago',
      detail: 'Ya existe una devolución monetaria en procesamiento. No la repitas.',
      variant: 'warning',
    };
  }
  if (['action_required', 'failed'].includes(state('billing'))) {
    return {
      title: 'Emite o recupera la nota crédito',
      detail: 'Continúa desde Facturación electrónica y vincula el documento oficial.',
      variant: state('billing') === 'failed' ? 'danger' : 'warning',
    };
  }
  if (state('billing') === 'pending') {
    return {
      title: 'Revisa el estado de la factura',
      detail: 'La obligación fiscal se definirá cuando la factura tenga un resultado definitivo.',
      variant: 'warning',
    };
  }
  if (state('cash') === 'failed') {
    return {
      title: 'Reconcilia nuevamente la caja',
      detail: 'El reintegro está registrado, pero el resumen de caja todavía debe recalcularse.',
      variant: 'danger',
    };
  }
  if (['pending', 'failed'].includes(state('inventory'))) {
    return {
      title: 'Termina la devolución de inventario',
      detail: 'Confirma la inspección y las unidades que realmente regresan a existencias.',
      variant: state('inventory') === 'failed' ? 'danger' : 'warning',
    };
  }
  if (reconciliation?.state === 'completed') {
    return {
      title: 'Conciliación cerrada',
      detail: 'Inventario, dinero, caja y documento fiscal quedaron coherentes.',
      variant: 'success',
    };
  }

  return {
    title: 'Actualizando conciliación',
    detail: 'El sistema está verificando qué obligación sigue pendiente.',
    variant: 'warning',
  };
}

export default function OrderDetailRefundReconciliation({
  refunds = [],
  loading = false,
  canConfirmPayment = false,
  confirmingId = '',
  onConfirmPayment,
  canAutomate = false,
  automatingId = '',
  onAutomate,
}) {
  const [references, setReferences] = useState({});

  if (!loading && refunds.length === 0) return null;

  return (
    <OrderDetailPanel style={{ padding: 18 }}>
      <SectionTitle
        icon={OrderDetailIcons.RotateCcw}
        title="Devoluciones y conciliación"
        subtitle="Inventario, dinero, caja y documento fiscal deben cerrar el mismo recorrido"
        action={
          loading ? <SoftBadge variant="warning">Consultando</SoftBadge> : null
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {refunds.map((refund) => {
          const reconciliation = refund?.reconciliation || {};
          const nextStep = nextReconciliationStep(reconciliation);
          const paymentState = reconciliation?.payment?.state || 'pending';
          const reference = references[refund._id] || '';
          const automationRequired = ['payment', 'billing'].some((key) =>
            ['action_required', 'failed'].includes(reconciliation?.[key]?.state)
          );
          const isAutomating = automatingId === refund._id;
          const isConfirming = confirmingId === refund._id;
          const stageMessages = STAGES.flatMap(([key, label]) => {
            const stage = reconciliation?.[key] || {};
            if (!stage.errorMessage && !stage.reference && !stage.providerStatus) return [];
            return [{ key, label, ...stage }];
          });

          return (
            <article
              key={refund._id || refund.refundNumber}
              style={{
                border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                borderRadius: 18,
                background: ORDER_DETAIL_THEME.inputBg,
                padding: 15,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 13,
                }}
              >
                <div>
                  <strong style={{ fontSize: 14 }}>{refund.refundNumber}</strong>
                  <div style={{ marginTop: 4, color: ORDER_DETAIL_THEME.mutedText, fontSize: 12 }}>
                    {toCOP(refund.amount)} · {fmtDate(refund.processedAt || refund.createdAt)}
                  </div>
                </div>
                <SoftBadge variant={badgeVariant(reconciliation.state)}>
                  {STATE_LABELS[reconciliation.state] || 'Pendiente'}
                </SoftBadge>
              </div>

              <div
                aria-live="polite"
                className="refund-reconciliation-next-step"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr)',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 12,
                  border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                  borderRadius: 14,
                  background: ORDER_DETAIL_THEME.cardBg,
                  padding: 11,
                }}
              >
                <SoftBadge variant={nextStep.variant}>Siguiente paso</SoftBadge>
                <div>
                  <strong style={{ display: 'block', fontSize: 12 }}>
                    {nextStep.title}
                  </strong>
                  <span
                    style={{
                      display: 'block',
                      marginTop: 2,
                      color: ORDER_DETAIL_THEME.mutedText,
                      fontSize: 11,
                      lineHeight: 1.45,
                    }}
                  >
                    {nextStep.detail}
                  </span>
                </div>
              </div>

              <div
                className="refund-reconciliation-stages"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: 8,
                }}
              >
                {STAGES.map(([key, label]) => {
                  const stage = reconciliation?.[key] || {};
                  return (
                    <div
                      key={key}
                      style={{
                        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                        background: ORDER_DETAIL_THEME.cardBg,
                        borderRadius: 14,
                        padding: 10,
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>
                        {label}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <SoftBadge variant={badgeVariant(stage.state)}>
                          {STATE_LABELS[stage.state] || 'Pendiente'}
                        </SoftBadge>
                      </div>
                    </div>
                  );
                })}
              </div>

              {stageMessages.length ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    marginTop: 10,
                    color: ORDER_DETAIL_THEME.mutedText,
                    fontSize: 11,
                  }}
                >
                  {stageMessages.map((stage) => (
                    <div key={stage.key}>
                      <strong style={{ color: ORDER_DETAIL_THEME.cardText }}>
                        {stage.label}:
                      </strong>{' '}
                      {stage.errorMessage || stage.reference || stage.providerStatus}
                      {stage.attempts ? ` · intento ${stage.attempts}` : ''}
                    </div>
                  ))}
                </div>
              ) : null}

              {canAutomate && automationRequired ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button
                    type="button"
                    disabled={isAutomating || isConfirming}
                    onClick={() => onAutomate?.(refund)}
                    style={{
                      border: 0,
                      borderRadius: 12,
                      padding: '10px 14px',
                      background: ORDER_DETAIL_THEME.primary,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: isAutomating ? 'wait' : 'pointer',
                      opacity: isAutomating || isConfirming ? 0.6 : 1,
                    }}
                  >
                    {isAutomating ? 'Automatizando…' : 'Automatizar cierre'}
                  </button>
                </div>
              ) : null}

              {reconciliation?.billing?.state === 'action_required' ? (
                <div style={{ marginTop: 12 }}>
                  <InfoLine
                    label="Acción fiscal:"
                    value="Emite la nota crédito desde Facturación electrónica y vincúlala a esta devolución."
                    strong
                  />
                </div>
              ) : null}

              {['action_required', 'failed'].includes(paymentState) ? (
                <div
                  className="refund-reconciliation-action"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <input
                    aria-label={`Referencia devolución ${refund.refundNumber}`}
                    value={reference}
                    onChange={(event) =>
                      setReferences((current) => ({
                        ...current,
                        [refund._id]: event.target.value,
                      }))
                    }
                    placeholder="Referencia del reintegro o comprobante"
                    disabled={!canConfirmPayment || isConfirming || isAutomating}
                    style={{
                      minWidth: 0,
                      border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                      background: ORDER_DETAIL_THEME.cardBg,
                      color: ORDER_DETAIL_THEME.cardText,
                      borderRadius: 12,
                      padding: '10px 12px',
                      fontSize: 12,
                    }}
                  />
                  <button
                    type="button"
                    disabled={
                      !canConfirmPayment ||
                      reference.trim().length < 4 ||
                      isConfirming ||
                      isAutomating
                    }
                    onClick={() => onConfirmPayment?.(refund, reference.trim())}
                    style={{
                      border: 0,
                      borderRadius: 12,
                      padding: '10px 14px',
                      background: ORDER_DETAIL_THEME.primary,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: 'pointer',
                      opacity:
                        !canConfirmPayment || reference.trim().length < 4 ? 0.5 : 1,
                    }}
                  >
                    {isConfirming ? 'Conciliando…' : 'Confirmar dinero devuelto'}
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <style>
        {`
          @media (max-width: 820px) {
            .refund-reconciliation-stages {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }
          @media (max-width: 560px) {
            .refund-reconciliation-stages,
            .refund-reconciliation-next-step,
            .refund-reconciliation-action {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </OrderDetailPanel>
  );
}
