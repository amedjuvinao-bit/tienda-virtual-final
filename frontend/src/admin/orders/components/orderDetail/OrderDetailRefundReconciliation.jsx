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

export default function OrderDetailRefundReconciliation({
  refunds = [],
  loading = false,
  canConfirmPayment = false,
  confirmingId = '',
  onConfirmPayment,
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
          const paymentState = reconciliation?.payment?.state || 'pending';
          const reference = references[refund._id] || '';

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

              {reconciliation?.billing?.state === 'action_required' ? (
                <div style={{ marginTop: 12 }}>
                  <InfoLine
                    label="Acción fiscal:"
                    value="Emite la nota crédito desde Facturación electrónica y vincúlala a esta devolución."
                    strong
                  />
                </div>
              ) : null}

              {paymentState === 'action_required' ? (
                <div
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
                    disabled={!canConfirmPayment || confirmingId === refund._id}
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
                      confirmingId === refund._id
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
                    {confirmingId === refund._id ? 'Conciliando…' : 'Confirmar dinero devuelto'}
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
            div[style*="grid-template-columns: repeat(4, minmax(0, 1fr))"] {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }
          @media (max-width: 560px) {
            div[style*="grid-template-columns: repeat(4, minmax(0, 1fr))"],
            div[style*="grid-template-columns: minmax(0, 1fr) auto"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </OrderDetailPanel>
  );
}
