import { fmtDate, toCOP } from './orderDetailUtils';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { InfoLine, SoftBadge } from './OrderDetailPrimitives';
import { getManualPaymentEvidence } from './manualPaymentConfirmationModel';

export default function OrderManualPaymentEvidence({ order }) {
  const evidence = getManualPaymentEvidence(order);
  if (!evidence) return null;

  return (
    <section
      aria-label="Evidencia de pago manual"
      style={{
        marginTop: 16,
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.inputBg,
        borderRadius: 20,
        padding: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <strong style={{ fontSize: 13, fontWeight: 900 }}>
            Evidencia administrativa
          </strong>
          <p style={{ margin: '4px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 11 }}>
            Registro inmutable de la confirmación manual.
          </p>
        </div>
        <SoftBadge variant="success">Verificada</SoftBadge>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '10px 18px',
        }}
      >
        <InfoLine label="Método:" value={evidence.methodLabel} strong />
        <InfoLine label="Referencia:" value={evidence.reference} />
        <InfoLine
          label="Monto:"
          value={`${toCOP(evidence.amount)} ${evidence.currency}`}
        />
        <InfoLine label="Confirmado:" value={fmtDate(evidence.confirmedAt)} />
        <InfoLine
          label="Administrador:"
          value={[evidence.actorLabel, evidence.actorRole].filter(Boolean).join(' · ')}
        />
        {evidence.id ? <InfoLine label="Evidencia:" value={evidence.id} /> : null}
      </div>
      <div style={{ marginTop: 10 }}>
        <InfoLine label="Motivo:" value={evidence.reason} />
      </div>
    </section>
  );
}
